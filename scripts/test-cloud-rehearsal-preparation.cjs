const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { prepare, validateTarget } = require('./prepare-cloud-rehearsal.cjs');

test('reject production, implicit aliases and malformed targets', () => {
  for (const target of ['closet-app-57146', 'default', '', undefined, 'aura-rehearsal-x/../../prod', 'aura-rehearsal-']) {
    assert.throws(() => validateTarget(target));
  }
  assert.doesNotThrow(() => validateTarget('aura-rehearsal-20261011'));
});
test('refuse repository or existing-directory overwrite before writing', () => {
  assert.throws(() => prepare('aura-rehearsal-20261011', path.resolve(__dirname, '..')));
  assert.throws(() => prepare('aura-rehearsal-20261011', path.resolve(__dirname, '../tmp-rehearsal')));
  assert.throws(() => prepare('aura-rehearsal-20261011', '.'));
});
test('package full dependency closure while excluding environment, native and user data', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-rehearsal-package-test-'));
  try {
    const dest = path.join(temp, 'candidate');
    const manifest = prepare('aura-rehearsal-20261011', dest);
    assert.equal(manifest.providerCallsAuthorized, false);
    assert.equal(manifest.status, 'PREPARED_NOT_AUTHORIZED');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dest, '.firebaserc'))), { projects: {} });
    assert.equal(fs.existsSync(path.join(dest, 'functions/.env')), false);
    assert.equal(fs.existsSync(path.join(dest, 'ios')), false);
    assert.equal(fs.existsSync(path.join(dest, 'functions/node_modules')), false);
    assert.equal(fs.existsSync(path.join(dest, 'shared/aiConsent.ts')), true);
    assert.equal(fs.existsSync(path.join(dest, 'functions/src/prepareMediaWrite.ts')), true);
    assert.equal(fs.existsSync(path.join(dest, 'functions/scripts/write-main.cjs')), true);
    assert.equal(fs.existsSync(path.join(dest, 'functions/tsconfig.dev.json')), true);
    const indexes = JSON.parse(fs.readFileSync(path.join(dest, 'firestore.indexes.json')));
    assert.equal(indexes.indexes.length, 8);
    assert.equal(indexes.fieldOverrides.length, 9);
    assert.equal(indexes.indexes.filter(i => i.fields.some(f => f.vectorConfig?.dimension === 2048)).length, 2);
    const config = JSON.parse(fs.readFileSync(path.join(dest, 'firebase.json')));
    assert.ok(config.functions[0].ignore.includes('.env*'));
    assert.throws(() => prepare('aura-rehearsal-20261011', dest));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
