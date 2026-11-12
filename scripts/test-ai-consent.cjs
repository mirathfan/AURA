// Local-only integration tests: real Firestore transactions/rules/listeners;
// exported trigger handlers invoked directly, all provider HTTP replaced.
const assert = require('node:assert/strict');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8089', 'Local emulator required');
const projectId = 'demo-aura-beta';
const requireFunctions = require('node:module').createRequire(require('node:path').resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = requireFunctions('firebase-admin/app');
const { getFirestore, Timestamp } = requireFunctions('firebase-admin/firestore');
const app = initializeApp({ projectId });
const db = getFirestore();
const consent = require('../functions/lib/functions/src/shared/aiConsent');
const { resumeAiConsentPage } = require('../functions/lib/functions/src/shared/resumeAiConsent');
const { pauseIngestionForConsent } = require('../functions/lib/functions/src/shared/pausedIngestion');
const { onClosetItemWriteIndexIntelligence } = require('../functions/lib/functions/src/ai/wardrobeIntelligence/triggers');
const { ingestItemFromPhotos } = require('../functions/lib/functions/src/ingestItemFromPhotos');
const { AI_CONSENT_VERSION } = require('../functions/lib/shared/aiConsent');
const realFetch = global.fetch;
let transmissions = 0;
global.fetch = async (url, options) => {
  if (String(url).startsWith('http://127.0.0.1:8089/')) return realFetch(url, options);
  assert.ok(String(url).startsWith('https://api.openai.com/'), 'Unexpected network blocked');
  transmissions++;
  return new Response('{}');
};
const owner = `consent-${Date.now()}`;
const other = `${owner}-other`;
const recordRef = consent.aiConsentRef(owner);
let passed = 0;
async function check(name, test) { await test(); passed++; console.log(`PASS ${name}`); }
function scoped(uid, operation) { return consent.runWithAiConsentScope(() => { consent.setAiConsentUser(uid); return operation(); }); }
async function send(uid = owner) { return scoped(uid, async () => (await consent.consentedProviderFetch('https://api.openai.com/v1/responses', { method: 'POST', body: '{"input":"synthetic"}' })).text()); }
async function choose(status, revision, uid = owner) { return consent.updateAiConsent(uid, { status, expectedRevision: revision, policyVersion: AI_CONSENT_VERSION }); }
function token(uid) {
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ aud: projectId, iss: `https://securetoken.google.com/${projectId}`, sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'password', identities: {} } })}.`;
}
async function rest(method, path, uid, fields) {
  return realFetch(`http://127.0.0.1:8089/v1/projects/${projectId}/databases/(default)/documents/${path}${fields ? "?" + Object.keys(fields).map((key) => "updateMask.fieldPaths=" + encodeURIComponent(key)).join("&") : ""}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(uid)}` },
    ...(fields ? { body: JSON.stringify({ fields }) } : {}),
  });
}
async function trigger(handler, uid, itemId) {
  const after = await db.doc(`users/${uid}/items/${itemId}`).get();
  await handler.run({ id: 'synthetic-event', params: { uid, itemId }, data: { before: { data: () => undefined }, after } });
}

(async () => {
  await check('new and existing users without consent cannot transmit', async () => {
    await assert.rejects(send());
    await db.doc(`users/${owner}`).set({ onboardingCompleted: true });
    await assert.rejects(send());
    assert.equal(transmissions, 0);
  });
  await check('decline is server-timestamped and denied', async () => {
    await choose('declined', 0);
    const value = (await recordRef.get()).data();
    assert.equal(value.status, 'declined'); assert.ok(value.updatedAt instanceof Timestamp);
    await assert.rejects(send());
  });
  await check('acceptance allows one scoped provider call and creates a resume job', async () => {
    await choose('accepted', 1); await send();
    assert.equal(transmissions, 1);
    assert.equal((await db.doc(`users/${owner}/aiConsentJobs/2-start`).get()).exists, true);
  });
  await check('rules allow owner viewing but forbid forging acceptance and cross-user access', async () => {
    assert.equal((await rest('GET', recordRef.path, owner)).status, 200);
    assert.equal((await rest('GET', recordRef.path, other)).status, 403);
    assert.equal((await rest('PATCH', recordRef.path, owner, { status: { stringValue: 'accepted' } })).status, 403);
    assert.equal((await rest('PATCH', `users/${owner}/aiConsentJobs/forged`, owner, { revision: { integerValue: '2' } })).status, 403);
  });
  await check('concurrent accept/revoke cannot undo revocation or allow another user', async () => {
    await Promise.allSettled([choose('accepted', 2), choose('revoked', 2)]);
    assert.equal((await recordRef.get()).get('status'), 'revoked');
    await assert.rejects(send()); await assert.rejects(send(other));
    assert.equal(transmissions, 1);
  });
  await check('outdated accepted version cannot transmit', async () => {
    await recordRef.update({ status: 'accepted', policyVersion: 'old' });
    await assert.rejects(send()); assert.equal(transmissions, 1);
  });
  await check('queued and redelivered ingestion/indexing events do not transmit after revocation', async () => {
    await choose('revoked');
    await db.doc(`users/${owner}/items/manual`).set({ name: 'Manual shirt', category: 'top', status: 'AVAILABLE', itemLifecycleStatus: 'ready', ingestionStatus: 'pending', photos: { primaryUrl: 'https://synthetic.invalid/photo.jpg' } });
    for (let n = 0; n < 2; n++) {
      await trigger(ingestItemFromPhotos, owner, 'manual');
      await trigger(onClosetItemWriteIndexIntelligence, owner, 'manual');
    }
    const item = (await db.doc(`users/${owner}/items/manual`).get()).data();
    assert.equal(item.ingestionStatus, 'consent_required');
    assert.equal(item.name, 'Manual shirt'); assert.equal(item.itemLifecycleStatus, 'ready');
    assert.equal(transmissions, 1);
  });
  await check('manual management and saved outfits remain available after revocation', async () => {
    const prepare = require('../functions/lib/functions/src/prepareMediaWrite').prepareMediaWriteForUser;
    await prepare(owner, 'items/manual', [{ mode: 'update', data: { name: 'Edited manually' } }]);
    await prepare(owner, 'savedOutfits/manual', [{ mode: 'merge', data: { title: 'Saved manually' } }]);
    assert.equal((await rest('PATCH', `users/${owner}/items/manual`, owner, { name: { stringValue: 'Edited manually' } })).status, 200);
    assert.equal((await rest('PATCH', `users/${owner}/savedOutfits/manual`, owner, { title: { stringValue: 'Saved manually' } })).status, 200);
    assert.equal((await rest('GET', `users/${owner}/savedOutfits/manual`, owner)).status, 200);
  });
  await check('deleted and completed uploads are not changed by delayed denied events', async () => {
    await pauseIngestionForConsent(owner, 'missing');
    assert.equal((await db.doc(`users/${owner}/items/missing`).get()).exists, false);
    await db.doc(`users/${owner}/items/done`).set({ ingestionStatus: 'done', name: 'Keep' });
    await pauseIngestionForConsent(owner, 'done');
    assert.equal((await db.doc(`users/${owner}/items/done`).get()).get('ingestionStatus'), 'done');
    for (const [id, data] of Object.entries({ candidate: { ingestionStatus: 'pending', itemLifecycleStatus: 'candidate' }, empty: { isDraft: true, draftState: 'draft' } })) {
      const ref = db.doc(`users/${owner}/items/${id}`);
      await ref.set(data); await pauseIngestionForConsent(owner, id);
      assert.deepEqual((await ref.get()).data(), data);
    }
  });
  await check('accept resumes existing items in idempotent pages; revocation cancels continuation', async () => {
    const batch = db.batch();
    for (let n = 0; n < 55; n++) batch.set(db.doc(`users/${owner}/items/queue-${String(n).padStart(2, '0')}`), { name: 'Synthetic shirt', ingestionStatus: 'consent_required' });
    await batch.commit();
    const revision = (await recordRef.get()).get('revision');
    const accepted = await choose('accepted', revision);
    const jobId = `${accepted.revision}-start`;
    await resumeAiConsentPage(owner, jobId); await resumeAiConsentPage(owner, jobId);
    const jobs = await db.collection(`users/${owner}/aiConsentJobs`).where('revision', '==', accepted.revision).get();
    assert.equal(jobs.size, 2);
    const next = jobs.docs.find((doc) => !doc.get('completed'));
    assert.ok(next);
    assert.equal((await db.doc(`users/${owner}/items/queue-00`).get()).get('ingestionStatus'), 'pending');
    await choose('revoked');
    await resumeAiConsentPage(owner, next.id);
    assert.equal((await next.ref.get()).get('cancelled'), true);
    assert.equal((await db.doc(`users/${owner}/items/queue-54`).get()).get('ingestionStatus'), 'consent_required');
    await assert.rejects(send());
  });
  await check('an in-flight response is invalidated after revocation even when consumed outside its scope', async () => {
    const revision = (await recordRef.get()).get('revision');
    await choose('accepted', revision);
    const response = await scoped(owner, () => consent.consentedProviderFetch('https://api.openai.com/v1/responses'));
    await choose('revoked');
    await assert.rejects(response.text());
  });
  await check('same-request retries stay denied after revoke/reaccept', async () => {
    const revision = (await recordRef.get()).get('revision');
    const accepted = await choose('accepted', revision);
    await scoped(owner, async () => {
      await consent.assertAiConsent();
      await choose('revoked'); await choose('accepted', accepted.revision + 1);
      const before = transmissions;
      await assert.rejects(consent.consentedProviderFetch('https://api.openai.com/v1/responses'));
      assert.equal(transmissions, before);
    });
  });
  console.log(`${passed} AI consent emulator checks passed; no provider requests sent.`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  global.fetch = realFetch;
  await db.recursiveDelete(db.doc(`users/${owner}`));
  await db.recursiveDelete(db.doc(`users/${other}`));
  await db.terminate(); await deleteApp(app);
});
