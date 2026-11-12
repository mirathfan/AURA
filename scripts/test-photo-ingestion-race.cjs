// Isolated real Firestore/Storage transactions with deterministic provider and
// commit barriers. Never calls external providers or uses production credentials.
const assert = require('node:assert/strict');
const req = require('node:module').createRequire(require('node:path').resolve(__dirname, '../functions/package.json'));
for (const [key, value] of Object.entries({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8089', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9198', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9098' })) assert.equal(process.env[key], value);
const projectId = 'demo-aura-beta';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId, storageBucket: `${projectId}.appspot.com` });
process.env.OPENAI_API_KEY = 'synthetic-mocked-provider-only';
const { initializeApp, deleteApp } = req('firebase-admin/app');
const { getFirestore, Timestamp } = req('firebase-admin/firestore');
const { getStorage } = req('firebase-admin/storage');
const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const db = getFirestore(); db.settings({ ignoreUndefinedProperties: true });
const bucket = getStorage().bucket();
const base = '../functions/lib/functions/src/';
const lifecycle = require(base + 'shared/ingestionLifecycle');
const { deleteItemAtomically, itemDeletionRef, recoverItemMedia, cleanItemMedia } = require(base + 'shared/itemLifecycle');
const { setUserDocument, deletionRef } = require(base + 'shared/accountLifecycle');
const { saveUserFile } = require(base + 'shared/accountStorage');
const { deleteClosetItem } = require(base + 'deleteClosetItem');
const { removeDeletedAccountUpload } = require(base + 'deleteAccountData');
const { ingestItemFromPhotos } = require(base + 'ingestItemFromPhotos');
const { AI_CONSENT_VERSION } = require('../functions/lib/shared/aiConsent');
const { enqueueIndexing, processIndexingJob } = require(base + 'ai/wardrobeIntelligence/indexingRecovery');
const { pauseIngestionForConsent } = require(base + 'shared/pausedIngestion');
const { File } = req('@google-cloud/storage');
const realFetch = global.fetch;
let providerBarrier, transmissions = 0, passed = 0;
function barrier() {
  let arrive, release;
  const entered = new Promise((resolve) => { arrive = resolve; });
  const released = new Promise((resolve) => { release = resolve; });
  return { entered, release, wait: async () => { arrive(); await released; } };
}
global.fetch = async (url, ...args) => {
  if (/^http:\/\/127\.0\.0\.1:(8089|9098|9198)\//.test(String(url))) return realFetch(url, ...args);
  assert.equal(String(url), 'https://api.openai.com/v1/chat/completions', 'Unexpected network blocked');
  transmissions++;
  if (providerBarrier) await providerBarrier.wait();
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ category: 'top', subCategory: 't_shirt', name: 'Synthetic blue shirt', brand: 'Synthetic', colors: ['blue'], pattern: 'solid', material: 'cotton', bbox: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } }) } }] }));
};
const owners = [];
const run = `ingest-${Date.now()}`;
const item = (uid, id = 'shirt') => db.doc(`users/${uid}/items/${id}`);
async function owner(label) {
  const uid = `${run}-${label}`; owners.push(uid);
  await db.doc(`users/${uid}/privacy/aiConsent`).set({ status: 'accepted', policyVersion: AI_CONSENT_VERSION, revision: 1, updatedAt: Timestamp.now() });
  return uid;
}
let bytes;
async function seed(uid, id = 'shirt', overrides = {}) {
  const file = bucket.file(`users/${uid}/items/${id}/original.png`);
  await file.save(bytes, { metadata: { contentType: 'image/png' } });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
  await item(uid, id).set({ name: null, category: 'top', status: 'AVAILABLE', isDraft: true, draftState: 'photo_uploaded', itemLifecycleStatus: 'processing', ingestionStatus: 'pending', ingestion: { status: 'pending' }, photoUrl: url, photos: { primaryUrl: url, originalUrl: url }, ingestionSource: { sourceType: 'original' }, ...overrides });
  return (await item(uid, id).get());
}
async function trigger(uid, after, before = { data: () => undefined }) {
  return ingestItemFromPhotos.run({ id: 'synthetic-event', params: { uid, itemId: after.id }, data: { before, after } });
}
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
async function atProvider(uid, after, during) {
  providerBarrier = barrier();
  const work = trigger(uid, after);
  // Catch early handler failures without waiting forever for a barrier.
  await Promise.race([providerBarrier.entered, work.then(() => { throw Error('Worker exited before provider barrier'); })]);
  try { await during(); } finally { providerBarrier.release(); providerBarrier = undefined; }
  await work;
}
function token(uid) {
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString('base64url'); const t = Math.floor(Date.now() / 1000);
  return `${enc({ alg: 'none' })}.${enc({ aud: projectId, iss: `https://securetoken.google.com/${projectId}`, sub: uid, user_id: uid, iat: t, exp: t + 3600, auth_time: t, firebase: { sign_in_provider: 'password', identities: {} } })}.`;
}
async function rest(method, path, uid, fields) {
  return realFetch(`http://127.0.0.1:8089/v1/projects/${projectId}/databases/(default)/documents/${path}`, { method, headers: { Authorization: `Bearer ${token(uid)}`, 'Content-Type': 'application/json' }, ...(fields ? { body: JSON.stringify({ fields }) } : {}) });
}
async function startUpload(uid, name) {
  const response = await realFetch(`http://127.0.0.1:9198/v0/b/${bucket.name}/o?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { Authorization: `Bearer ${token(uid)}`, 'Content-Type': 'application/json', 'x-goog-upload-protocol': 'resumable', 'x-goog-upload-command': 'start', 'x-goog-upload-header-content-type': 'image/png' }, body: JSON.stringify({ name, contentType: 'image/png' }) });
  return response;
}
async function uploadNow(uid, name) {
  const boundary = 'aura-race-upload';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${JSON.stringify({ name, contentType: 'image/png' })}\r\n--${boundary}\r\nContent-Type: image/png\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--`),
  ]);
  return realFetch(`http://127.0.0.1:9198/v0/b/${bucket.name}/o?uploadType=media&name=${encodeURIComponent(name)}`, { method: 'POST', headers: { Authorization: `Bearer ${token(uid)}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'x-goog-upload-protocol': 'multipart' }, body });
}
(async () => {
  await db.doc("releaseControl/mediaSafety").set({ cleanupEnabled: true });
  bytes = await req('sharp')({ create: { width: 80, height: 80, channels: 3, background: { r: 20, g: 70, b: 210 } } }).png().toBuffer();
  await check('pre-claim media contention is retryable and redelivery finishes without duplicate dispatch', async () => {
    const uid = await owner('media-lock'); const after = await seed(uid);
    const lock = db.doc(`users/${uid}/mediaControl/cleanup`);
    await lock.set({ lease: 'synthetic', until: Timestamp.fromMillis(Date.now() + 60_000) });
    const before = transmissions;
    await assert.rejects(trigger(uid, after), (error) => error.details?.code === 'MEDIA_BUSY');
    assert.equal(transmissions, before);
    assert.equal(ingestItemFromPhotos.__endpoint.eventTrigger.retry, true);
    await lock.delete(); await trigger(uid, after); await trigger(uid, after);
    assert.equal((await item(uid).get()).get('ingestion.status'), 'done');
    assert.equal(transmissions, before + 1);
  });
  await check('original reproduced stale unsafe-URL event cannot recreate a deleted item', async () => {
    const uid = await owner('reproduction');
    await item(uid).set({ ingestionStatus: 'pending', ingestion: { status: 'pending' }, photoUrl: 'http://127.0.0.1/blocked.jpg' });
    const stale = await item(uid).get(); await item(uid).delete();
    const count = transmissions; await trigger(uid, stale);
    assert.equal((await item(uid).get()).exists, false); assert.equal(transmissions, count);
  });
  await check('delete during provider wait: late response and repeated event cannot resurrect', async () => {
    const uid = await owner('provider-delete'); const after = await seed(uid);
    await atProvider(uid, after, () => deleteItemAtomically(uid, 'shirt'));
    await trigger(uid, after); assert.equal((await item(uid).get()).exists, false);
    await assert.rejects(setUserDocument(item(uid), { name: 'late import' }, { merge: true }));
  });
  await check('delete immediately before final transaction: successful processing cannot resurrect', async () => {
    const uid = await owner('commit-delete'); const after = await seed(uid);
    const original = lifecycle.withIngestionItem; let reached = false;
    lifecycle.withIngestionItem = async (lease, build) => {
      if (build && !reached) { reached = true; await deleteItemAtomically(uid, 'shirt'); }
      return original(lease, build);
    };
    try { await trigger(uid, after); } finally { lifecycle.withIngestionItem = original; }
    assert.equal(reached, true); assert.equal((await item(uid).get()).exists, false);
    await recoverItemMedia(); assert.equal((await bucket.getFiles({ prefix: `users/${uid}/items/shirt/` }))[0].length, 0);
  });
  await check('manual edits during provider wait survive completed ingestion', async () => {
    const uid = await owner('edit'); const after = await seed(uid);
    await atProvider(uid, after, () => item(uid).update({ name: 'Keep my name', brand: 'Keep my brand', material: 'wool', notes: 'Keep my notes', category: 'outerwear' }));
    const data = (await item(uid).get()).data();
    assert.equal(data.ingestionStatus, 'done');
    for (const [key, value] of Object.entries({ name: 'Keep my name', brand: 'Keep my brand', material: 'wool', notes: 'Keep my notes', category: 'outerwear' })) assert.equal(data[key], value);
  });
  await check('source replacement and cancelled draft reject the old result', async () => {
    for (const [label, patch] of [['source', { ingestionSource: { sourceType: 'original', sourceHash: 'new-source' } }], ['cancel', { draftState: 'cancelled' }]]) {
      const uid = await owner(label); const after = await seed(uid);
      await atProvider(uid, after, () => item(uid).update(patch));
      assert.notEqual((await item(uid).get()).get('ingestionStatus'), 'done');
      assert.equal((await item(uid).get()).get('name'), null);
    }
  });
  await check('duplicate concurrent workers dispatch only one provider request', async () => {
    const uid = await owner('concurrent'); const after = await seed(uid); const count = transmissions;
    await atProvider(uid, after, () => trigger(uid, after));
    await trigger(uid, after);
    assert.equal(transmissions, count + 1); assert.equal((await item(uid).get()).get('ingestionStatus'), 'done');
  });
  await check('out-of-order event from a replaced creation cannot modify the new record', async () => {
    const uid = await owner('recreated'); const old = await seed(uid);
    await item(uid).delete(); await item(uid).set({ name: 'new identity', ingestionStatus: 'pending' });
    const count = transmissions; await trigger(uid, old);
    assert.equal((await item(uid).get()).get('name'), 'new identity'); assert.equal(transmissions, count);
  });
  await check('revocation during processing rejects completion; reaccept cannot revive the old run', async () => {
    const uid = await owner('revoke'); const after = await seed(uid);
    await atProvider(uid, after, () => db.doc(`users/${uid}/privacy/aiConsent`).update({ status: 'revoked', revision: 2 }));
    assert.equal((await item(uid).get()).get('ingestionStatus'), 'consent_required');
    const uid2 = await owner('reaccept'); const after2 = await seed(uid2);
    await atProvider(uid2, after2, () => db.doc(`users/${uid2}/privacy/aiConsent`).update({ status: 'accepted', revision: 3 }));
    assert.notEqual((await item(uid2).get()).get('ingestionStatus'), 'done');
    await item(uid2).update({ ingestionStatus: 'pending', 'ingestion.status': 'pending' });
    await pauseIngestionForConsent(uid2, 'shirt'); assert.equal((await item(uid2).get()).get('ingestionStatus'), 'pending');
  });
  await check('revocation between preflight and claim pauses work without dispatching', async () => {
    const uid = await owner('claim-revoke'); const snap = await seed(uid);
    const original = lifecycle.claimIngestion; const count = transmissions;
    lifecycle.claimIngestion = async (...args) => {
      await db.doc(`users/${uid}/privacy/aiConsent`).update({ status: 'revoked', revision: 2 });
      return original(...args);
    };
    try { await trigger(uid, snap); } finally { lifecycle.claimIngestion = original; }
    assert.equal(transmissions, count); assert.equal((await item(uid).get()).get('ingestionStatus'), 'consent_required');
  });
  await check('valid upload produces run-specific crop/thumb and original bytes remain unchanged', async () => {
    const uid = await owner('valid'); const after = await seed(uid); await trigger(uid, after);
    const data = (await item(uid).get()).data(); assert.equal(data.ingestionStatus, 'done');
    const [files] = await bucket.getFiles({ prefix: `users/${uid}/items/shirt/ingestion/` }); assert.equal(files.length, 2);
    files.forEach((file) => assert.ok(file.name.includes(`/ingestion/${data.ingestion.runId}/`)));
    assert.deepEqual((await bucket.file(`users/${uid}/items/shirt/original.png`).download())[0], bytes);
  });
  await check('item fence denies old-client delete/recreate and late Storage writes; other item is allowed', async () => {
    const uid = await owner('old-client'); await seed(uid);
    assert.equal((await rest('DELETE', item(uid).path, uid)).status, 403);
    await deleteClosetItem.run({ auth: { uid }, data: { uid, itemId: 'shirt' } });
    assert.equal((await rest('PATCH', item(uid).path, uid, { name: { stringValue: 'stale build 9' } })).status, 403);
    assert.equal((await rest('PATCH', itemDeletionRef(uid, 'shirt').path, uid, { dueAt: { integerValue: '0' } })).status, 403);
    for (const path of [`users/${uid}/items/shirt.jpg`, `users/${uid}/items/shirt.cleaned.png`, `users/${uid}/items/shirt/photo.png`]) assert.equal((await uploadNow(uid, path)).status, 403, path);
    assert.equal((await uploadNow(uid, `users/${uid}/items/surviving/photo.png`)).status, 200);
  });
  await check('late finalized item upload is removed idempotently and surviving shared photos are retained', async () => {
    const uid = await owner('late-item'); await seed(uid);
    const shared = `users/${uid}/items/shirt/original.png`;
    await item(uid, 'duplicate').set({ photoUrl: shared });
    await deleteItemAtomically(uid, 'shirt'); await recoverItemMedia(); assert.equal((await bucket.file(shared).exists())[0], true);
    const otherFile = bucket.file(`users/${uid}/items/shirt2/original.png`); await otherFile.save(bytes);
    const late = bucket.file(`users/${uid}/items/shirt/late.png`); await late.save(bytes); const [meta] = await late.getMetadata();
    for (let n = 0; n < 2; n++) await removeDeletedAccountUpload.run({ data: { name: late.name, bucket: bucket.name, generation: meta.generation } });
    assert.equal((await late.exists())[0], false); assert.equal((await otherFile.exists())[0], true);
  });
  await check('account fence during an active privileged upload removes the completed object', async () => {
    const uid = await owner('active-upload'); const file = bucket.file(`users/${uid}/items/shirt/late.png`); const original = file.save.bind(file);
    file.save = async (...args) => { await deletionRef(uid).set({ state: 'accepted' }); return original(...args); };
    await assert.rejects(saveUserFile(file, bytes, { metadata: { contentType: 'image/png' } }));
    assert.equal((await file.exists())[0], false);
  });
  await check('resumable upload authorized before account fence is cleaned on late finalization', async () => {
    const uid = await owner('resumable'); const path = `users/${uid}/items/shirt/late.png`;
    const response = await startUpload(uid, path); assert.equal(response.status, 200);
    const session = response.headers.get('x-goog-upload-url'); assert.ok(session.startsWith('http://127.0.0.1:9198/'));
    await deletionRef(uid).set({ state: 'accepted' });
    const finish = await realFetch(session, { method: 'POST', headers: { 'x-goog-upload-command': 'upload, finalize', 'x-goog-upload-offset': '0' }, body: bytes });
    // Emulator currently permits completion of the already authorized session.
    if (finish.ok) {
      const file = bucket.file(path); const [metadata] = await file.getMetadata();
      await removeDeletedAccountUpload.run({ data: { name: path, bucket: bucket.name, generation: metadata.generation } });
    } else assert.equal(finish.status, 403);
    assert.equal((await bucket.file(path).exists())[0], false);
    assert.equal((await rest('PATCH', item(uid).path, uid, { name: { stringValue: 'late' } })).status, 403);
  });
  await check('cross-user deletion and forged expected account are denied', async () => {
    const uid = await owner('isolation'), other = await owner('other'); await seed(other);
    await assert.rejects(deleteClosetItem.run({ auth: { uid }, data: { uid: other, itemId: 'shirt' } }), { code: 'permission-denied' });
    assert.equal((await item(other).get()).exists, true); assert.equal((await itemDeletionRef(other, 'shirt').get()).exists, false);
  });
  await check('queued indexing cannot recreate an item deleted while embedding is pending', async () => {
    const uid = await owner('index-delete'); await item(uid).set({ name: 'Synthetic shirt', category: 'top', status: 'AVAILABLE' });
    await enqueueIndexing(uid, 'shirt'); const wait = barrier();
    const work = processIndexingJob(uid, 'shirt', { createEmbedding: async () => { await wait.wait(); return [0.1, 0.2]; } });
    await Promise.race([wait.entered, work.then(() => { throw Error('Indexing exited before barrier'); })]);
    await deleteItemAtomically(uid, 'shirt'); wait.release(); await work;
    assert.equal((await item(uid).get()).exists, false);
  });
  await check('simultaneous claim transactions have exactly one owner', async () => {
    const uid = await owner('claim-race'); const snap = await seed(uid);
    const patch = { ingestionStatus: 'processing', ingestion: { status: 'processing', startedAt: Timestamp.now() } };
    const results = await Promise.all([lifecycle.claimIngestion(snap, patch), lifecycle.claimIngestion(snap, patch)]);
    assert.equal(results.filter(Boolean).length, 1);
  });
  await check('early error and import compare-and-update cannot overwrite a concurrent edit', async () => {
    const uid = await owner('early-edit'); const snap = await seed(uid);
    await item(uid).update({ name: 'Keep edit' });
    assert.equal(await lifecycle.mutateCurrentIngestionItem(snap, { name: 'stale import', ingestionStatus: 'failed' }), false);
    assert.equal((await item(uid).get()).get('name'), 'Keep edit');
    await deleteItemAtomically(uid, 'shirt');
    assert.equal(await lifecycle.mutateCurrentIngestionItem(snap, { name: 'late import' }), false);
  });
  await check('draft cleanup eligibility is checked against the current record', async () => {
    const uid = await owner('cleanup-edit');
    await item(uid).set({ isDraft: true, draftState: 'draft', createdAt: Date.now() - 1000 });
    await item(uid).update({ name: 'Do not remove my edit' });
    const result = await deleteClosetItem.run({ auth: { uid }, data: { uid, itemId: 'shirt', onlyIfEmptyDraft: true } });
    assert.equal(result.deleted, false); assert.equal((await item(uid).get()).exists, true);
  });
  await check('crashed ingestion lease is reclaimed and stale run loses mutation rights', async () => {
    const uid = await owner('crash'); const snap = await seed(uid);
    const lease = await lifecycle.claimIngestion(snap, { ingestionStatus: 'processing', ingestion: { status: 'processing', attempt: 1, startedAt: Timestamp.now() } }); assert.ok(lease);
    await item(uid).update({ 'ingestion.recoverAt': Timestamp.fromMillis(0) });
    await lifecycle.recoverStalledIngestion();
    const current = await item(uid).get();
    const lease2 = await lifecycle.claimIngestion(current, { ingestionStatus: 'processing', ingestion: { status: 'processing', attempt: 2, startedAt: Timestamp.now() } }); assert.ok(lease2);
    await assert.rejects(lifecycle.withIngestionItem(lease, () => ({ name: 'stale' })), lifecycle.IngestionStopped);
    await lifecycle.withIngestionItem(lease2, () => ({ ingestion: { status: 'done', runId: lease2.runId }, ingestionStatus: 'done' }));
  });
  await check('partial Storage cleanup failure retains durable recovery work', async () => {
    const uid = await owner('storage-failure'); await seed(uid); await deleteItemAtomically(uid, 'shirt');
    const original = File.prototype.delete; let failed = false;
    File.prototype.delete = async function (...args) { if (!failed && this.name.startsWith(`users/${uid}/`)) { failed = true; throw Error('synthetic storage outage'); } return original.apply(this, args); };
    try { await assert.rejects(recoverItemMedia(), /synthetic storage outage/); } finally { File.prototype.delete = original; }
    assert.ok((await itemDeletionRef(uid, 'shirt').get()).get('dueAt')); await recoverItemMedia();
    assert.equal((await bucket.getFiles({ prefix: `users/${uid}/items/shirt/` }))[0].length, 0);
  });
  await check('generated orphan cleanup preserves current run and referenced surviving output', async () => {
    const uid = await owner('orphan'); await seed(uid);
    const keep = `users/${uid}/items/shirt/ingestion/current/cropped.jpg`, orphan = `users/${uid}/items/shirt/ingestion/old/thumb.jpg`;
    await bucket.file(keep).save(bytes); await bucket.file(orphan).save(bytes);
    await item(uid).update({ 'photos.croppedUrl': keep }); await cleanItemMedia(uid, 'shirt', true, 'current');
    assert.equal((await bucket.file(keep).exists())[0], true); assert.equal((await bucket.file(orphan).exists())[0], false);
  });
  console.log(`${passed} photo ingestion race checks passed; ${transmissions} mocked provider calls; zero external transmissions.`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  global.fetch = realFetch;
  for (const uid of owners) {
    await db.recursiveDelete(db.doc(`users/${uid}`)); await deletionRef(uid).delete();
    await bucket.deleteFiles({ prefix: `users/${uid}/` });
  }
  await db.terminate(); await deleteApp(app);
});
