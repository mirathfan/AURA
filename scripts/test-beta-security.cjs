// Run only against the isolated demo emulators in firebase.beta-test.json.
// firebase emulators:exec --project demo-aura-beta --config firebase.beta-test.json --only firestore,storage 'node scripts/test-beta-security.cjs'
const assert = require('node:assert/strict');
const projectId = 'demo-aura-beta';
for (const [key, expected] of Object.entries({
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8089',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9198',
})) {
  assert.equal(process.env[key], expected, `Refusing to run without local ${key}`);
}
const functionsRequire = require('node:module').createRequire(require('node:path').resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = functionsRequire('firebase-admin/app');
const { getFirestore } = functionsRequire('firebase-admin/firestore');
const { deleteDocumentTree } = require('../functions/lib/functions/src/shared/deleteDocumentTree');
const { assertFunctionRateLimit, minuteLimit } = require('../functions/lib/functions/src/shared/rateLimit');
const app = initializeApp({ projectId });
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
(async () => {
  await require('../functions/lib/functions/src/prepareMediaWrite').prepareMediaWriteForUser(owner, '', [{ mode: 'set', data: { uid: owner, onboardingCompleted: true } }]);
  await check('owner can create onboarding profile', async () => expectStatus(await firestore('PATCH', userPath, owner, { uid: { stringValue: owner }, onboardingCompleted: { booleanValue: true } }), 200));
  await require('../functions/lib/functions/src/prepareMediaWrite').prepareMediaWriteForUser(owner, '', [{ mode: 'set', data: { betaRole: 'power' } }]);
  await check('owner cannot grant paid AI or beta access', async () => expectStatus(await firestore('PATCH', userPath, owner, { betaRole: { stringValue: 'power' } }), 403));
  await require('../functions/lib/functions/src/prepareMediaWrite').prepareMediaWriteForUser(owner, '', [{ mode: 'set', data: { profilePreferences: { featureAccess: {} } } }]);
  await check('nested profile cannot grant feature access', async () => expectStatus(await firestore('PATCH', userPath, owner, { profilePreferences: { mapValue: { fields: { featureAccess: { mapValue: { fields: {} } } } } } }), 403));
  await require('../functions/lib/functions/src/prepareMediaWrite').prepareMediaWriteForUser(owner, 'items/shirt', [{ mode: 'set', data: { status: 'AVAILABLE', category: 'top', wearCountSinceWash: 0 } }]);
  await check('owner can create closet item', async () => expectStatus(await firestore('PATCH', itemPath, owner, { status: { stringValue: 'AVAILABLE' }, category: { stringValue: 'top' }, wearCountSinceWash: { integerValue: '0' } }), 200));
  await check('unauthenticated closet read denied', async () => expectStatus(await firestore('GET', itemPath), 403));
  await check('cross-user closet read denied', async () => expectStatus(await firestore('GET', itemPath, other), 403));
  await check('cross-user closet write denied', async () => expectStatus(await firestore('PATCH', itemPath, other, { name: { stringValue: 'tampered' } }), 403));
  await check('client cannot reset rate counters', async () => expectStatus(await firestore('PATCH', `functionRateLimits/auraChat/users/${owner}/windows/day_1`, owner, { count: { integerValue: '0' } }), 403));
  await check('client cannot reset paid feature usage', async () => expectStatus(await firestore('PATCH', `${userPath}/usage/earlyAccess`, owner, { aiPolishUsed: { integerValue: '0' } }), 403));
  await require('../functions/lib/functions/src/prepareMediaWrite').prepareMediaWriteForUser(owner, 'savedOutfits/look', [{ mode: 'set', data: { active: true, title: 'Test look' } }]);
  await check('owner can save outfit', async () => expectStatus(await firestore('PATCH', `${userPath}/savedOutfits/look`, owner, { active: { booleanValue: true }, title: { stringValue: 'Test look' } }), 200));
  await check('cross-user saved outfit read denied', async () => expectStatus(await firestore('GET', `${userPath}/savedOutfits/look`, other), 403));
  await check('owner cannot directly delete account root', async () => expectStatus(await firestore('DELETE', userPath, owner), 403));
  await check('owner can upload image', async () => expectStatus(await storage('POST', imagePath, owner, Buffer.from('test image')), 200));
  await check('cross-user image read denied', async () => expectStatus(await storage('GET', imagePath, other), 403));
  await check('unauthenticated image read denied', async () => expectStatus(await storage('GET', imagePath), 403));
  await check('non-image item upload denied', async () => expectStatus(await storage('POST', imagePath, owner, Buffer.from('executable'), 'application/octet-stream'), 403));
  await check('oversized image denied', async () => expectStatus(await storage('POST', imagePath, owner, Buffer.alloc(10 * 1024 * 1024 + 1)), 403));
  await check('concurrent rate-limit requests cannot exceed capacity', async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => assertFunctionRateLimit(owner, run, [minuteLimit(3)])));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 3);
    results.filter((r) => r.status === 'rejected').forEach((r) => assert.equal(r.reason.code, 'resource-exhausted'));
  });
  await check('account tree deletion removes descendants beneath missing parents', async () => {
    const orphan = db.doc(`${userPath}/aiChats/missing/messages/private-message`);
    await orphan.set({ text: 'synthetic private content' });
    const unrelated = db.doc(`users/${other}/aiChats/missing/messages/keep`);
    await unrelated.set({ text: 'other user' });
    assert.equal((await db.doc(`${userPath}/aiChats/missing`).get()).exists, false);
    await deleteDocumentTree(db.doc(userPath));
    assert.equal((await orphan.get()).exists, false);
    assert.equal((await unrelated.get()).exists, true);
    assert.equal((await db.doc(itemPath).get()).exists, false);
  });
  console.log(`${passed} beta security checks passed (local emulators only).`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await db.terminate();
  await deleteApp(app);
});
