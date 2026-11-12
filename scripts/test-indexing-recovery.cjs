// Isolated Firestore integration; providers are mocks, no paid network calls.
const assert = require('node:assert/strict');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8089');
const req = require('node:module').createRequire(require('node:path').resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = req('firebase-admin/app');
const { getFirestore, Timestamp } = req('firebase-admin/firestore');
const app = initializeApp({ projectId: 'demo-aura-beta' });
const db = getFirestore();
// Match the production Admin initialization in functions/src/index.ts.
db.settings({ ignoreUndefinedProperties: true });
const base = '../functions/lib/functions/src/';
const { enqueueIndexing, processIndexingJob, recoverWardrobeIndexing } = require(base + 'ai/wardrobeIntelligence/indexingRecovery');
const { onClosetItemWriteIndexIntelligence } = require(base + 'ai/wardrobeIntelligence/triggers');
const { backfillWardrobeIntelligenceAll } = require(base + 'ai/wardrobeIntelligence/callables');
const { INDEXING_MAX_ATTEMPTS, INDEXING_LEASE_MS } = require(base + 'ai/wardrobeIntelligence/indexingPolicy');
const { buildClosetItemIntelligenceInput } = require(base + 'ai/wardrobeIntelligence/indexClosetItem');
const { AI_CONSENT_VERSION } = require('../functions/lib/shared/aiConsent');
const { redactUid } = require(base + 'shared/rateLimit');
const { retrieveHybridCandidates } = require(base + 'ai/wardrobeIntelligence/hybridRetrieval');
const consentApi = require(base + 'shared/aiConsent');
const realFetch = global.fetch;
global.fetch = async (url, ...args) => {
  if (String(url).startsWith('http://127.0.0.1:8089/')) return realFetch(url, ...args);
  throw new Error('External network forbidden by indexing test');
};
const run = `index-${Date.now()}`;
let now = Math.floor(Date.now() / 86400000) * 86400000 + 60_000;
let passed = 0, calls = 0, active = 0, peak = 0;
const owners = [];
const itemData = { name: 'Synthetic blue shirt', category: 'top', colors: ['blue'], status: 'AVAILABLE' };
const item = (uid, id = 'shirt') => db.doc(`users/${uid}/items/${id}`);
const job = (uid, id = 'shirt') => db.doc(`users/${uid}/wardrobeIndexJobs/${id}`);
async function choose(uid, status = 'accepted', revision = 1, version = AI_CONSENT_VERSION) {
  await db.doc(`users/${uid}/privacy/aiConsent`).set({ status, policyVersion: version, revision, updatedAt: Timestamp.now() });
}
async function owner(label, accepted = true) {
  const uid = `${run}-${label}`; owners.push(uid);
  if (accepted) await choose(uid);
  return uid;
}
async function mockEmbedding() {
  calls++; active++; peak = Math.max(peak, active);
  await new Promise((resolve) => setTimeout(resolve, 10));
  active--; return [0.1, 0.2, 0.3];
}
const options = { now: () => now, random: () => 0, createEmbedding: mockEmbedding };
async function seed(uid, id = 'shirt', data = itemData) { await item(uid, id).set(data); await enqueueIndexing(uid, id, { now }); }
async function work(uid, id = 'shirt', overrides = {}) { await processIndexingJob(uid, id, { ...options, ...overrides }); }
async function state(uid, id = 'shirt') { return (await job(uid, id).get()).data(); }
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
async function advance(uid, id = 'shirt') { now = Math.max(now, (await state(uid, id)).dueAt.toMillis()); }
function token(uid) {
  const enc = (value) => Buffer.from(JSON.stringify(value)).toString('base64url'); const t = Math.floor(Date.now() / 1000);
  return `${enc({ alg: 'none' })}.${enc({ aud: 'demo-aura-beta', iss: 'https://securetoken.google.com/demo-aura-beta', sub: uid, user_id: uid, iat: t, exp: t + 3600, firebase: { sign_in_provider: 'password', identities: {} } })}.`;
}
async function rest(method, path, uid) {
  return realFetch(`http://127.0.0.1:8089/v1/projects/demo-aura-beta/databases/(default)/documents/${path}`, {
    method, headers: { Authorization: `Bearer ${token(uid)}`, 'Content-Type': 'application/json' },
    ...(method === 'PATCH' ? { body: JSON.stringify({ fields: { state: { stringValue: 'completed' } } }) } : {}),
  });
}
(async () => {
  await check('missing, declined, revoked, outdated consent never dispatch; later acceptance resumes', async () => {
    const uid = await owner('consent', false); await seed(uid); const start = calls;
    for (const [status, version] of [['declined', AI_CONSENT_VERSION], ['revoked', AI_CONSENT_VERSION], ['accepted', 'old']]) {
      await choose(uid, status, 1, version); await work(uid); assert.equal((await state(uid)).state, 'terminal_failure');
    }
    assert.equal(calls, start); await choose(uid, 'accepted', 2); await work(uid); assert.equal((await state(uid)).state, 'completed');
  });
  await check('temporary outage retries durably; success and duplicate events do not re-embed', async () => {
    const uid = await owner('outage'); await seed(uid);
    await work(uid, 'shirt', { createEmbedding: async () => { throw Object.assign(new Error('secret provider message'), { status: 503 }); } });
    const task = await state(uid); assert.equal(task.state, 'retryable_failure'); assert.ok(!JSON.stringify(task).includes('secret'));
    await advance(uid); await work(uid); const count = calls;
    await enqueueIndexing(uid, 'shirt', { now }); await work(uid); assert.equal(calls, count);
    assert.equal((await state(uid)).state, 'completed');
  });
  await check('duplicate and out-of-order Firestore events use current content', async () => {
    const uid = await owner('events'); await seed(uid); const old = await item(uid).get();
    await item(uid).update({ name: 'Synthetic red trousers', category: 'bottom' });
    const event = { params: { uid, itemId: 'shirt' }, data: { before: { data: () => undefined }, after: old } };
    await Promise.all([onClosetItemWriteIndexIntelligence.run(event), onClosetItemWriteIndexIntelligence.run(event)]);
    // Event enqueue uses real time, while this test uses a logical clock.
    await advance(uid);
    const count = calls; await Promise.all([work(uid), work(uid)]); assert.equal(calls, count + 1);
    const current = (await item(uid).get()).data(); assert.equal(current.embeddingHash, buildClosetItemIntelligenceInput(current).embeddingHash);
  });
  await check('expired processing lease recovers a crashed worker', async () => {
    const uid = await owner('crash'); await seed(uid);
    await job(uid).update({ state: 'processing', attempts: 1, lease: 'killed', dueAt: Timestamp.fromMillis(now + INDEXING_LEASE_MS) });
    const count = calls; await work(uid); assert.equal(calls, count);
    now += INDEXING_LEASE_MS; await work(uid); assert.equal((await state(uid)).state, 'completed');
  });
  await check('failure immediately after provider completion keeps a retryable job', async () => {
    const uid = await owner('post-provider'); await seed(uid);
    const original = db.runTransaction.bind(db); let failNext = false;
    db.runTransaction = (...args) => { if (failNext) { failNext = false; return Promise.reject(new Error('simulated commit outage')); } return original(...args); };
    try { await work(uid, 'shirt', { createEmbedding: async () => { failNext = true; return [1, 2, 3]; } }); }
    finally { db.runTransaction = original; }
    assert.equal((await state(uid)).state, 'retryable_failure'); assert.equal((await item(uid).get()).get('embeddingHash'), undefined);
    await advance(uid); await work(uid); assert.equal((await state(uid)).state, 'completed');
  });
  await check('item edit during embedding discards stale output and indexes the new content', async () => {
    const uid = await owner('edit'); await seed(uid);
    await work(uid, 'shirt', { createEmbedding: async () => { await item(uid).update({ name: 'Green coat', colors: ['green'] }); return [1, 2, 3]; } });
    assert.equal((await item(uid).get()).get('embeddingHash'), undefined); assert.equal((await state(uid)).state, 'pending');
    await work(uid); const current = (await item(uid).get()).data(); assert.equal(current.embeddingHash, buildClosetItemIntelligenceInput(current).embeddingHash);
  });
  await check('item deletion and same-ID recreation cannot receive an old result', async () => {
    for (const recreate of [false, true]) {
      const uid = await owner(`delete-item-${recreate}`); await seed(uid);
      await work(uid, 'shirt', { createEmbedding: async () => { await item(uid).delete(); if (recreate) await item(uid).set(itemData); return [1, 2, 3]; } });
      assert.equal((await item(uid).get()).get('embeddingHash'), undefined);
      if (!recreate) assert.equal((await job(uid).get()).exists, false);
      else { await work(uid); assert.equal((await state(uid)).state, 'completed'); }
    }
  });
  await check('revocation after provider response blocks persistence; acceptance uses new revision', async () => {
    const uid = await owner('revoke'); await seed(uid);
    await work(uid, 'shirt', { createEmbedding: async () => { await choose(uid, 'revoked', 2); return [1, 2, 3]; } });
    assert.equal((await item(uid).get()).get('embeddingHash'), undefined); assert.equal((await state(uid)).reason, 'consent_required');
    const start = calls; await work(uid); assert.equal(calls, start); await choose(uid, 'accepted', 3); await work(uid);
    assert.equal((await state(uid)).state, 'completed');
  });
  await check('account deletion blocks queued and in-flight workers without recreating user data', async () => {
    const uid = await owner('account-delete'); await seed(uid);
    await work(uid, 'shirt', { createEmbedding: async () => {
      await db.doc(`accountDeletionJobs/${uid}`).set({ state: 'deleting' });
      await db.recursiveDelete(db.doc(`users/${uid}`)); return [1, 2, 3];
    } });
    await work(uid); assert.equal((await item(uid).get()).exists, false); assert.equal((await job(uid).get()).exists, false);
    // Synthetic test cleanup of opaque expired slot uses emulator admin only.
    now += INDEXING_LEASE_MS;
  });
  await check('maximum attempts stop automatically; explicit bounded recovery remains quota protected', async () => {
    const uid = await owner('max'); await seed(uid);
    const fail = { createEmbedding: async () => { throw new Error('outage'); } };
    for (let i = 0; i < INDEXING_MAX_ATTEMPTS; i++) { await work(uid, 'shirt', fail); const s = await state(uid); if (s.dueAt) await advance(uid); }
    assert.equal((await state(uid)).state, 'terminal_failure'); assert.equal((await state(uid)).attempts, 8);
    await enqueueIndexing(uid, 'shirt', { now }); assert.equal((await state(uid)).state, 'terminal_failure');
    await enqueueIndexing(uid, 'shirt', { now, retryTerminal: true }); await work(uid); assert.equal((await state(uid)).state, 'completed');
    const second = await owner('max-twice'); await seed(second);
    await job(second).update({ state: 'terminal_failure', attempts: 8, recoveryCycles: 1, dueAt: req('firebase-admin/firestore').FieldValue.delete() });
    await enqueueIndexing(second, 'shirt', { now, retryTerminal: true }); assert.equal((await state(second)).state, 'terminal_failure');
  });
  await check('ineligible item becomes eligible without requiring a manual terminal retry', async () => {
    const uid = await owner('draft'); await seed(uid, 'shirt', { ...itemData, isDraft: true, draftState: 'draft' });
    await work(uid); assert.equal((await state(uid)).reason, 'item_ineligible');
    await item(uid).update({ isDraft: false, draftState: 'ready' }); await work(uid); assert.equal((await state(uid)).state, 'completed');
  });
  await check('owner-only status is readable; clients cannot forge jobs or inspect other accounts', async () => {
    const uid = await owner('rules'); await seed(uid);
    assert.equal((await rest('GET', job(uid).path, uid)).status, 200);
    assert.equal((await rest('GET', job(uid).path, 'unrelated')).status, 403);
    assert.equal((await rest('PATCH', job(uid).path, uid)).status, 403);
    assert.equal((await rest('GET', 'functionRateLimits/wardrobeIndexing', uid)).status, 403);
    await work(uid);
  });
  await check('old unindexed wardrobe backfill queues work without paid calls and reports queued honestly', async () => {
    const uid = await owner('old'); for (let i = 0; i < 3; i++) await item(uid, `old-${i}`).set(itemData);
    const start = calls;
    const result = await backfillWardrobeIntelligenceAll.run({ auth: { uid }, data: {} });
    assert.equal(result.totalQueued, 3); assert.equal(result.totalIndexed, 0); assert.equal(calls, start);
    for (let i = 0; i < 3; i++) { await advance(uid, `old-${i}`); await work(uid, `old-${i}`); }
  });
  await check('global slots cap simultaneous work across users', async () => {
    const uids = await Promise.all(Array.from({ length: 8 }, (_, i) => owner(`parallel-${i}`)));
    await Promise.all(uids.map((uid) => seed(uid))); peak = 0;
    await Promise.all(uids.map((uid) => work(uid)));
    assert.ok(peak <= 4, `peak=${peak}`);
    for (const uid of uids) { await work(uid); assert.equal((await state(uid)).state, 'completed'); }
  });
  await check('provider 429/network timeout retry independently without blocking another item', async () => {
    const uid = await owner('isolated-failures'); await seed(uid, 'bad', { ...itemData, name: 'Temporary failure' }); await seed(uid, 'good');
    for (const error of [Object.assign(new Error('rate limited'), { status: 429 }), Object.assign(new Error('timeout'), { code: 'etimedout' })]) {
      await work(uid, 'bad', { createEmbedding: async () => { throw error; } });
      assert.equal((await state(uid, 'bad')).state, 'retryable_failure');
      await work(uid, 'good'); assert.equal((await state(uid, 'good')).state, 'completed'); await advance(uid, 'bad');
    }
    await work(uid, 'bad'); assert.equal((await state(uid, 'bad')).state, 'completed', JSON.stringify(await state(uid, 'bad')));
  });
  await check('actual SDK transport dispatches once per queued attempt with retries disabled', async () => {
    const uid = await owner('sdk'); await seed(uid); let sent = 0;
    process.env.OPENAI_API_KEY = 'synthetic-not-a-key'; process.env.AURA_EMBEDDING_DIMENSIONS = '3';
    global.fetch = async () => { sent++; return new Response(JSON.stringify({ error: { message: 'synthetic outage', type: 'server_error' } }), { status: 503, headers: { 'content-type': 'application/json' } }); };
    try {
      await work(uid, 'shirt', { createEmbedding: undefined });
      assert.equal(sent, 1); assert.equal((await state(uid)).state, 'retryable_failure');
      await advance(uid);
      global.fetch = async () => { sent++; return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { headers: { 'content-type': 'application/json' } }); };
      await work(uid, 'shirt', { createEmbedding: undefined });
      assert.equal(sent, 2); assert.equal((await state(uid)).state, 'completed');
    } finally { global.fetch = async () => { throw new Error('External network forbidden'); }; delete process.env.AURA_EMBEDDING_DIMENSIONS; }
  });
  await check('two simultaneous 25-item wardrobes isolate consent scopes, quotas, and results', async () => {
    now = (Math.floor(now / 86400000) + 1) * 86400000 + 60000;
    const uids = [await owner('multi-a'), await owner('multi-b')]; await choose(uids[1], 'accepted', 2);
    await Promise.all(uids.map(async (uid, index) => {
      for (let i = 0; i < 25; i++) await seed(uid, `multi-${i}`, { ...itemData, name: `Synthetic shirt owner${index}` });
    }));
    const counts = [0, 0]; let inflight = 0, simultaneous = 0, unblock;
    const barrier = new Promise((resolve) => { unblock = resolve; });
    const timer = setTimeout(unblock, 15000);
    const scopedProvider = async (text) => {
      const index = text.includes('owner1') ? 1 : 0;
      assert.equal((await consentApi.assertAiConsent()).revision, index + 1);
      counts[index]++; inflight++; simultaneous = Math.max(simultaneous, inflight);
      if (inflight === 4) unblock(); await barrier;
      await new Promise((resolve) => setTimeout(resolve, 10)); inflight--;
      return [0.1, 0.2, 0.3];
    };
    try {
      for (let round = 0; round < 10 && counts.some((count) => count < 25); round++) {
        await recoverWardrobeIndexing({ ...options, createEmbedding: scopedProvider }); now += 300000;
      }
    } finally { clearTimeout(timer); unblock(); }
    assert.deepEqual(counts, [25, 25]); assert.ok(simultaneous > 1 && simultaneous <= 4, `simultaneous=${simultaneous}`);
    for (const uid of uids) {
      const tasks = await db.collection(`users/${uid}/wardrobeIndexJobs`).get(); assert.ok(tasks.docs.every((task) => task.get('state') === 'completed'));
      const counters = await db.collection(`functionRateLimits/wardrobeIndexing/users/${redactUid(uid)}/windows`).get();
      for (const counter of counters.docs) assert.ok(counter.get('count') <= (counter.get('window') === 'minute' ? 10 : 50));
    }
    console.log(JSON.stringify({ multiUserBurst: [25, 25], providerCalls: counts, simultaneous }));
  });
  for (const size of [10, 25, 50, 100]) await check(`burst ${size}: eventual completion, existing 10/min 50/day quota, no duplicate provider calls`, async () => {
    now = (Math.floor(now / 86400000) + 1) * 86400000 + 60_000;
    const uid = await owner(`burst-${size}`); const started = now, count = calls;
    for (let i = 0; i < size; i++) await seed(uid, `item-${String(i).padStart(3, '0')}`);
    let sweeps = 0, largest = 0;
    for (; sweeps < 300; sweeps++) {
      largest = Math.max(largest, await recoverWardrobeIndexing(options));
      const jobs = await db.collection(`users/${uid}/wardrobeIndexJobs`).get();
      if (jobs.docs.every((doc) => doc.get('state') === 'completed')) break;
      const due = jobs.docs.map((doc) => doc.get('dueAt')?.toMillis()).filter(Number.isFinite);
      assert.ok(due.length); now = Math.max(now + 300_000, Math.min(...due));
    }
    assert.ok(sweeps < 300); assert.ok(largest <= 40); assert.equal(calls - count, size);
    const counters = await db.collection(`functionRateLimits/wardrobeIndexing/users/${redactUid(uid)}/windows`).get();
    for (const counter of counters.docs) assert.ok(counter.get('count') <= (counter.get('window') === 'minute' ? 10 : 50));
    if (size === 100) assert.ok(now - started >= 86400000 - 60_000);
    const before = calls; await recoverWardrobeIndexing(options); assert.equal(calls, before);
    console.log(JSON.stringify({ burst: size, providerCalls: calls - count, sweeps: sweeps + 1, logicalMinutes: (now - started) / 60000, largestSweep: largest }));
  });
  await check('provider/index failure falls back to owner structured wardrobe without hiding unindexed items', async () => {
    const uid = await owner('retrieval'); await item(uid).set(itemData);
    process.env.OPENAI_API_KEY = 'synthetic-not-a-key';
    const result = await consentApi.runWithAiConsentScope(async () => { consentApi.setAiConsentUser(uid); return retrieveHybridCandidates(uid, 'shirt', 10); });
    assert.deepEqual(result.candidates.map((c) => c.itemId), ['shirt']); assert.equal(result.candidates[0].distance, null);
  });
  console.log(`${passed} indexing emulator checks PASS; mock provider calls=${calls}, max observed concurrency=${peak}`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  global.fetch = realFetch;
  for (const uid of owners) { await db.recursiveDelete(db.doc(`users/${uid}`)); await db.doc(`accountDeletionJobs/${uid}`).delete(); }
  await deleteApp(app);
});
