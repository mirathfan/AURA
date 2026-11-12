#!/usr/bin/env node
// Local-only allowlisted release packaging. This script has no network or deploy capability.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const PRODUCTION = 'closet-app-57146';
const ALLOWED = [
  'functions/src', 'functions/scripts/write-main.cjs', 'functions/package.json',
  'functions/package-lock.json', 'functions/tsconfig.json', 'functions/tsconfig.dev.json', 'functions/.eslintrc.js',
  'shared', 'firestore.rules', 'storage.rules',
];
function validateTarget(project) {
  if (!/^aura-rehearsal-[a-z0-9-]{1,14}[a-z0-9]$/.test(project || '') || project === PRODUCTION) {
    throw new Error('Use an explicit aura-rehearsal-* project ID; production/default aliases are forbidden.');
  }
}
function collect(root, relative) {
  const full = path.join(root, relative);
  if (fs.lstatSync(full).isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${relative}`);
  if (fs.statSync(full).isDirectory()) return fs.readdirSync(full).sort().flatMap(n => collect(root, path.join(relative, n)));
  if (/(^|\/)\.env(?:\.|$)|\.(?:p8|p12|pem|mobileprovision)$|GoogleService-Info|service.?account.*\.json$/i.test(relative)) {
    throw new Error(`Credential/config file excluded: ${relative}`);
  }
  return [relative];
}
function prepare(project, output) {
  validateTarget(project);
  if (!output || !path.isAbsolute(output)) throw new Error('Output must be an absolute, new local directory.');
  const dest = path.resolve(output);
  if (dest === ROOT || dest.startsWith(ROOT + path.sep) || fs.existsSync(dest)) throw new Error('Use a new directory outside the repository.');
  const files = ALLOWED.flatMap(p => collect(ROOT, p));
  const payloads = files.map(file => {
    const bytes = fs.readFileSync(path.join(ROOT, file));
    const source = bytes.toString('utf8');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source) || /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/.test(source)) {
      throw new Error(`Potential secret in ${file}; no values displayed.`);
    }
    // Do not copy runtime configuration or a hardcoded production resource into a rehearsal.
    // Unit-test literals are retained locally but excluded from function upload below.
    if (!/\.test\.ts$|__tests__/.test(file) && /closet-app-57146|1043970871162/.test(source)) {
      throw new Error(`Production resource reference in ${file}; review before packaging.`);
    }
    return { file, bytes };
  });
  fs.mkdirSync(dest, { recursive: true });
  const hashes = {};
  for (const { file, bytes } of payloads) {
    fs.mkdirSync(path.dirname(path.join(dest, file)), { recursive: true });
    fs.writeFileSync(path.join(dest, file), bytes);
    hashes[file] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  const indexes = fs.readFileSync(path.join(ROOT, 'docs/deployment/firestore.indexes.p109.proposed.json'));
  fs.writeFileSync(path.join(dest, 'firestore.indexes.json'), indexes);
  hashes['firestore.indexes.json'] = crypto.createHash('sha256').update(indexes).digest('hex');
  const config = {
    firestore: { database: '(default)', location: 'nam5', rules: 'firestore.rules', indexes: 'firestore.indexes.json' },
    storage: { rules: 'storage.rules' },
    functions: [{ source: 'functions', codebase: 'default', disallowLegacyRuntimeConfig: true,
      ignore: ['node_modules', '.git', '.env*', '*.local', '*.log', 'src/**/__tests__/**', 'src/**/*.test.ts'],
      predeploy: ['npm --prefix "$RESOURCE_DIR" run lint', 'npm --prefix "$RESOURCE_DIR" run build'] }],
  };
  fs.writeFileSync(path.join(dest, 'firebase.json'), JSON.stringify(config, null, 2) + '\n');
  fs.writeFileSync(path.join(dest, '.firebaserc'), '{"projects":{}}\n');
  const manifest = { schema: 1, status: 'PREPARED_NOT_AUTHORIZED', proposedProject: project,
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    sourceIsDirty: !!execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    node: '22', firebaseCli: '15.13.0', providerCallsAuthorized: false, files: hashes };
  fs.writeFileSync(path.join(dest, 'rehearsal-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(dest, 'APPROVAL_REQUIRED.txt'),
    'Local preparation only. No cloud resources, deployment or provider calls are authorized.\n' +
    'Read docs/CLOUD_REHEARSAL_2026-10-11.md in the source repository before any cloud action.\n' +
    'No default Firebase alias or production env/credentials were copied. Keep AI disabled.\n');
  return manifest;
}
if (require.main === module) {
  try { const m = prepare(process.argv[2], process.argv[3]); console.log(`Prepared ${Object.keys(m.files).length} files. PREPARED_NOT_AUTHORIZED. No cloud action performed.`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validateTarget, prepare };
