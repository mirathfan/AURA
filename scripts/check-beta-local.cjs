// Local candidate checks only. No installs, cloud CLIs, provider evaluations,
// emulator lifecycle changes, emitted builds, or release/distribution actions.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'functions');
const checks = [
  {
    name: 'Client lint', cwd: root, entry: 'node_modules/eslint/bin/eslint.js',
    args: ['src', 'app', 'components', '--ext', '.js,.jsx,.ts,.tsx,.mjs,.cjs', '--no-cache'],
    env: { ESLINT_USE_FLAT_CONFIG: 'true' },
  },
  { name: 'Client TypeScript', cwd: root, entry: 'node_modules/typescript/bin/tsc', args: ['--noEmit'] },
  { name: 'Client tests', cwd: root, entry: 'node_modules/jest/bin/jest.js', args: ['--runInBand', '--watchman=false'] },
  {
    name: 'Backend lint', cwd: backend, entry: 'node_modules/eslint/bin/eslint.js',
    args: ['--ext', '.js,.ts', '.', '--no-cache'], env: { ESLINT_USE_FLAT_CONFIG: 'false' },
  },
  { name: 'Backend TypeScript', cwd: backend, entry: 'node_modules/typescript/bin/tsc', args: ['--noEmit'] },
  { name: 'Backend tests', cwd: backend, entry: 'node_modules/jest/bin/jest.js', args: ['--runInBand', '--watchman=false'] },
];

if (process.argv.length > 2) {
  console.error('Usage: node scripts/check-beta-local.cjs (no arguments)');
  process.exit(2);
}

// Check every installed entry before starting. Never fall back to npx/install.
const missing = checks.filter((check) => !fs.existsSync(path.join(check.cwd, check.entry)));
if (missing.length) {
  for (const check of missing) console.error(`BLOCKED ${check.name}: missing ${path.join(check.cwd, check.entry)}`);
  process.exit(2);
}

console.log(`AURA local beta QA — ${process.version}`);
console.log('Passing these checks does not approve cloud deployment or external beta.');
const results = [];
for (const check of checks) {
  console.log(`\nRunning ${check.name}`);
  const result = spawnSync(process.execPath, [path.join(check.cwd, check.entry), ...check.args], {
    cwd: check.cwd,
    shell: false,
    stdio: 'inherit',
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', ...check.env },
  });
  const passed = !result.error && !result.signal && result.status === 0;
  results.push({ name: check.name, passed });
  if (result.error) console.error(`${check.name}: ${result.error.message}`);
  if (result.signal) {
    console.error(`Stopped after ${check.name} received ${result.signal}; remaining checks were not run.`);
    break;
  }
}

console.log('\nLocal QA summary');
for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}`);
console.log('Not covered: emulators, cloud IAM/triggers, real providers, signed/device flows, public disclosures or TestFlight.');
process.exitCode = results.length === checks.length && results.every((result) => result.passed) ? 0 : 1;
