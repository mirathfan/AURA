// Run only against the isolated demo emulators in firebase.beta-test.json.
// firebase emulators:exec --project demo-aura-beta --config firebase.beta-test.json --only firestore,storage 'node scripts/test-beta-security.cjs'
const assert = require('node:assert/strict');
const projectId = 'demo-aura-beta';
for (const [key, expected] of Object.entries({
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8089',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9098',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9198',
})) {
  assert.equal(process.env[key], expected, `Refusing to run without local ${key}`);
}
const functionsRequire = require('node:module').createRequire(require('node:path').resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = functionsRequire('firebase-admin/app');
const { getFirestore } = functionsRequire('firebase-admin/firestore');
const { deleteDocumentTree } = require('../functions/lib/functions/src/shared/deleteDocumentTree');
const { assertFunctionRateLimit, minuteLimit } = require('../functions/lib/functions/src/shared/rateLimit');
const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const db = getFirestore();
const run = `beta-${Date.now()}`;
const owner = `${run}-owner`;
const other = `${run}-other`;
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
function token(uid) {
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc({
    aud: projectId, iss: `https://securetoken.google.com/${projectId}`,
    sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'password', identities: {} },
  })}.`;
}
async function firestore(method, path, uid, fields) {
  return fetch(`http://127.0.0.1:8089/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) },
    ...(fields ? { body: JSON.stringify({ fields }) } : {}),
  });
}
async function expectStatus(response, status) {
  const text = await response.text();
  assert.equal(response.status, status, text.slice(0, 500));
}
const userPath = `users/${owner}`;
const itemPath = `${userPath}/items/shirt`;
const imagePath = `users/${owner}/items/shirt/photo.jpg`;
async function storage(method, name, uid, body, contentType = 'image/jpeg') {
  const base = `http://127.0.0.1:9198/v0/b/${projectId}.appspot.com/o`;
  const url = method === 'POST' ? `${base}?uploadType=media&name=${encodeURIComponent(name)}` : `${base}/${encodeURIComponent(name)}`;
  const headers = { 'Content-Type': contentType, ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) };
  if (method === 'POST') {
    const boundary = 'aura-emulator-upload';
    headers['Content-Type'] = `multipart/related; boundary=${boundary}`;
    headers['x-goog-upload-protocol'] = 'multipart';
    body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${JSON.stringify({ name, contentType })}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
      body,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
  }
  return fetch(url, { method, headers, ...(body ? { body } : {}) });
}

const { getAuth } = functionsRequire('firebase-admin/auth');
const { getStorage } = functionsRequire('firebase-admin/storage');
const { Timestamp } = functionsRequire('firebase-admin/firestore');
const { beginAccountDeletion, processAccountDeletion, cleanupOperations } = require('../functions/lib/functions/src/shared/accountDeletionJob');
const { setUserDocument, userWriteBatch, deletionRef } = require('../functions/lib/functions/src/shared/accountLifecycle');
const { saveUserFile } = require('../functions/lib/functions/src/shared/accountStorage');
const { resumeAiConsentPage } = require('../functions/lib/functions/src/shared/resumeAiConsent');
const { AI_CONSENT_VERSION } = require('../functions/lib/shared/aiConsent');
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId, storageBucket: `${projectId}.appspot.com` });
const { removeDeletedAccountUpload, deleteAccountData } = require('../functions/lib/functions/src/deleteAccountData');
const bucket = getStorage().bucket();
async function fence(uid) { return beginAccountDeletion(uid, false); }
async function eligible(uid) { await deletionRef(uid).update({ dueAt: Timestamp.fromMillis(0) }); }
async function settled(uid) { await deletionRef(uid).update({ dueAt: Timestamp.fromMillis(0), createdAt: Timestamp.fromMillis(0) }); }
(async () => {
  for (const uid of [owner, other]) await getAuth().createUser({ uid });
  await db.doc(itemPath).set({ status: 'AVAILABLE' });
  await db.doc(`users/${other}/items/keep`).set({ name: 'other account' });
  await bucket.file(imagePath).save(Buffer.from('image'));
  await bucket.file(`users/${other}/keep.jpg`).save(Buffer.from('other'));
  let uploadSession;
  await check('start a client resumable upload before deletion', async () => {
    const response = await fetch(`http://127.0.0.1:9198/v0/b/${bucket.name}/o?name=${encodeURIComponent(`users/${owner}/resumable.jpg`)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token(owner)}`, 'Content-Type': 'application/json',
        'x-goog-upload-protocol': 'resumable', 'x-goog-upload-command': 'start', 'x-goog-upload-header-content-type': 'image/jpeg' },
      body: JSON.stringify({ name: `users/${owner}/resumable.jpg`, contentType: 'image/jpeg' }),
    });
    assert.equal(response.status, 200, await response.text());
    uploadSession = response.headers.get('x-goog-upload-url'); assert.ok(uploadSession);
    assert.ok(uploadSession.startsWith('http://127.0.0.1:9198/'), 'Local emulator URL required');
  });
  await check('two concurrent acceptance requests create one persistent fence', async () => {
    const results = await Promise.all([fence(owner), fence(owner)]);
    assert.equal(results[0].state, 'deleting'); assert.deepEqual(results[0], results[1]);
    assert.equal((await deletionRef(owner).get()).get('attempts'), 0);
  });
  await check('both client sessions cannot write/read after acceptance', async () => {
    await expectStatus(await firestore('PATCH', itemPath, owner, { name: { stringValue: 'late' } }), 403);
    await expectStatus(await firestore('GET', itemPath, owner), 403);
    await expectStatus(await firestore('PATCH', `users/${owner}/savedOutfits/new`, owner, { title: { stringValue: 'late' } }), 403);
    await expectStatus(await firestore('PATCH', `accountDeletionJobs/${owner}`, owner, { state: { stringValue: 'completed' } }), 403);
    await expectStatus(await firestore('GET', `accountDeletionJobs/${owner}`, owner), 200);
    await expectStatus(await firestore('GET', `accountDeletionJobs/${owner}`, other), 403);
  });
  await check('a resumable upload opened before the fence cannot finalize through client rules', async () => {
    const response = await fetch(uploadSession, { method: 'POST', headers: { Authorization: `Bearer ${token(owner)}`, 'x-goog-upload-command': 'upload, finalize', 'x-goog-upload-offset': '0' }, body: Buffer.from('late') });
    await expectStatus(response, 403);
  });
  await check('Storage rules reject late uploads and downloads through Firestore fence', async () => {
    await expectStatus(await storage('POST', `users/${owner}/late.jpg`, owner, Buffer.from('late')), 403);
    await expectStatus(await storage('GET', imagePath, owner), 403);
  });
  await check('privileged delayed chat/ingestion writes and prepared batches are blocked', async () => {
    const batch = userWriteBatch(db, owner); batch.set(db.doc(`users/${owner}/savedOutfits/late`), { name: 'late' });
    await assert.rejects(batch.commit(), /deletion is in progress/);
    await assert.rejects(setUserDocument(db.doc(`users/${owner}/threads/late/messages/late`), { content: 'late' }), /deletion is in progress/);
    await assert.rejects(saveUserFile(bucket.file(`users/${owner}/late-admin.jpg`), Buffer.from('late'), {}), /deletion is in progress/);
  });
  await check('queued consent indexing cannot restart after a fence', async () => {
    await db.doc(`users/${owner}/privacy/aiConsent`).set({ status: 'accepted', policyVersion: AI_CONSENT_VERSION, revision: 1, updatedAt: Timestamp.now() });
    await db.doc(`users/${owner}/aiConsentJobs/1-start`).set({ revision: 1, completed: false });
    await assert.rejects(resumeAiConsentPage(owner, '1-start'), /deletion is in progress/);
  });
  await check('partial Firestore failure persists retry; Auth remains until cleanup succeeds', async () => {
    await processAccountDeletion(owner, { ...cleanupOperations, firestore: async () => { await db.doc(itemPath).delete(); throw Error('simulated interruption'); } });
    assert.equal((await deletionRef(owner).get()).get('state'), 'retry');
    assert.equal((await getAuth().getUser(owner)).uid, owner);
  });
  await check('partial Storage failure preserves stage and is recoverable', async () => {
    await eligible(owner);
    await processAccountDeletion(owner, { ...cleanupOperations, storage: async () => { throw Error('storage unavailable'); } });
    assert.equal((await deletionRef(owner).get()).get('stage'), 'storage');
    assert.equal((await deletionRef(owner).get()).get('state'), 'retry');
    assert.equal((await getAuth().getUser(owner)).uid, owner);
  });
  await check('a killed worker lease blocks duplicate workers then expires for recovery', async () => {
    await deletionRef(owner).update({ state: 'deleting', lease: 'crashed-worker', dueAt: Timestamp.fromMillis(Date.now() + 600000) });
    let called = false;
    await processAccountDeletion(owner, { ...cleanupOperations, storage: async () => { called = true; } });
    assert.equal(called, false); await eligible(owner);
    await Promise.all([processAccountDeletion(owner), processAccountDeletion(owner)]);
    assert.equal((await deletionRef(owner).get()).get('stage'), 'settle');
    assert.equal((await getAuth().getUser(owner)).uid, owner);
    await settled(owner); await processAccountDeletion(owner);
    assert.equal((await deletionRef(owner).get()).get('state'), 'completed');
    await assert.rejects(getAuth().getUser(owner), (error) => error.code === 'auth/user-not-found');
  });
  await check('recursive cleanup includes orphans and consent records, and is idempotent', async () => {
    assert.equal((await db.doc(`users/${owner}/privacy/aiConsent`).get()).exists, false);
    assert.equal((await db.doc(`users/${owner}/aiConsentJobs/1-start`).get()).exists, false);
    assert.equal((await bucket.getFiles({ prefix: `users/${owner}/` }))[0].length, 0);
    await processAccountDeletion(owner); assert.equal((await deletionRef(owner).get()).get('state'), 'completed');
    assert.deepEqual(Object.keys((await deletionRef(owner).get()).data()).sort(), ['apple','completedAt','stage','state']);
  });
  await check('late privileged upload finalization is removed by generation after completion', async () => {
    const file = bucket.file(`users/${owner}/in-flight.jpg`); await file.save(Buffer.from('late'));
    const [metadata] = await file.getMetadata();
    await removeDeletedAccountUpload.run({ data: { name: file.name, bucket: bucket.name, generation: metadata.generation } });
    assert.equal((await file.exists())[0], false);
  });
  await check('completed tombstone prevents resurrection and cannot affect another account', async () => {
    await assert.rejects(setUserDocument(db.doc(`users/${owner}/items/resurrected`), { name: 'late' }), /deletion is in progress/);
    await expectStatus(await firestore('PATCH', itemPath, owner, { name: { stringValue: 'old token' } }), 403);
    assert.equal((await db.doc(`users/${other}/items/keep`).get()).exists, true);
    assert.equal((await bucket.file(`users/${other}/keep.jpg`).exists())[0], true);
    await setUserDocument(db.doc(`users/${other}/items/new`), { name: 'still works' });
    assert.equal((await getAuth().getUser(other)).uid, other);
  });
  await check('transactional writes racing acceptance are serialized, never resurrect after cleanup', async () => {
    const uid = `${run}-race`; await getAuth().createUser({ uid });
    const ref = db.doc(`users/${uid}/items/late`);
    await Promise.allSettled([setUserDocument(ref, { name: 'race' }), fence(uid)]);
    await settled(uid); await processAccountDeletion(uid);
    assert.equal((await ref.get()).exists, false);
    await assert.rejects(setUserDocument(ref, { name: 'late retry' }), /deletion is in progress/);
  });
  await check('email/Google/Apple and linked accounts use server provider data and explicit fallback', async () => {
    for (const provider of ['password', 'google.com', 'apple.com', 'linked']) {
      const uid = `${run}-${provider}`;
      await getAuth().createUser({ uid, ...(provider === 'password' ? { email: `${uid}@example.invalid`, password: 'fixture-password' } : {}) });
      if (provider !== 'password') await getAuth().updateUser(uid, { providerToLink: { providerId: provider === 'linked' ? 'google.com' : provider, uid: `synthetic-${uid}` } });
      if (provider === 'linked') await getAuth().updateUser(uid, { providerToLink: { providerId: 'apple.com', uid: `apple-${uid}` } });
      if (['apple.com', 'linked'].includes(provider)) {
        await assert.rejects(beginAccountDeletion(uid, false), (e) => e.details.code === 'APPLE_REVOCATION_REQUIRED');
        assert.equal((await deletionRef(uid).get()).exists, false);
        assert.equal((await beginAccountDeletion(uid, true)).apple, 'manual_required');
      } else assert.equal((await beginAccountDeletion(uid, false)).apple, 'not_linked');
      await settled(uid); await processAccountDeletion(uid);
    }
  });
  await check('Apple success proof must be recent and for the current server-linked subject', async () => {
    const uid = `${run}-apple-proof`, subject = `apple-${uid}`;
    await getAuth().createUser({ uid }); await getAuth().updateUser(uid, { providerToLink: { providerId: 'apple.com', uid: subject } });
    const proof = db.doc(`users/${uid}/private/appleRevocation`);
    const subjectHash = require('node:crypto').createHash('sha256').update(subject).digest('hex');
    await proof.set({ revokedAt: Timestamp.now(), subjectHash: 'other-subject' });
    await assert.rejects(beginAccountDeletion(uid, false), /Apple authorization/);
    await proof.set({ revokedAt: Timestamp.fromMillis(0), subjectHash });
    await assert.rejects(beginAccountDeletion(uid, false), /Apple authorization/);
    await proof.set({ revokedAt: Timestamp.now(), subjectHash });
    assert.equal((await beginAccountDeletion(uid, false)).apple, 'revoked');
    await settled(uid); await processAccountDeletion(uid);
  });
  await check('stale initial requests are rejected; previously accepted requests recover after Auth removal', async () => {
    const uid = `${run}-auth-last`; await getAuth().createUser({ uid });
    await assert.rejects(deleteAccountData.run({ auth: { uid, token: { auth_time: 1 } }, data: {} }), (e) => e.details.code === 'REQUIRES_RECENT_LOGIN');
    assert.equal((await deletionRef(uid).get()).exists, false);
    await beginAccountDeletion(uid, false); await settled(uid);
    await processAccountDeletion(uid, { ...cleanupOperations, auth: async () => { await getAuth().deleteUser(uid); throw Error('crash after Auth deletion'); } });
    assert.equal((await deletionRef(uid).get()).get('state'), 'retry');
    await eligible(uid); await processAccountDeletion(uid);
    assert.equal((await deletionRef(uid).get()).get('state'), 'completed');
  });
  await check('an upload crossing the fence is removed by its post-upload guard', async () => {
    const uid = `${run}-upload`; await getAuth().createUser({ uid });
    const file = bucket.file(`users/${uid}/photo.jpg`);
    const save = file.save.bind(file);
    file.save = async (bytes, options) => { await beginAccountDeletion(uid, false); await save(bytes, options); };
    await assert.rejects(saveUserFile(file, Buffer.from('late'), {}), /deletion is in progress/);
    assert.equal((await file.exists())[0], false);
    await settled(uid); await processAccountDeletion(uid);
  });
  console.log(`${passed} account-deletion emulator checks passed.`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await deleteApp(app); });
