#!/usr/bin/env node
'use strict';
// Local-only, exact allowlist packaging. No cloud commands or networking.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const PROJECT = 'aura-rehearsal-20261011';
const FILES = ['index.js', 'package.json', 'package-lock.json', '.gcloudignore'];

function prepare(project, destination, source = path.join(ROOT, 'rehearsal/health-canary')) {
  if (project !== PROJECT) throw new Error('Only the fixed rehearsal project is allowed.');
  if (!destination || !path.isAbsolute(destination)) throw new Error('Use an absolute new output directory.');
  const parent = fs.realpathSync(path.dirname(destination));
  const dest = path.join(parent, path.basename(destination));
  if (dest === ROOT || dest.startsWith(ROOT + path.sep) || fs.existsSync(dest)) {
    throw new Error('Output must be new and outside the repository.');
  }
  const payload = FILES.map(file => {
    const p = path.join(source, file);
    if (!fs.lstatSync(p).isFile()) throw new Error('Source must contain regular files only.');
    const bytes = fs.readFileSync(p);
    if (bytes.length > 262144 || /-----BEGIN .*PRIVATE KEY-----|closet-app-57146|1043970871162|\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}/.test(bytes.toString())) {
      throw new Error('Source failed size/credential/production-reference review.');
    }
    return { file, bytes };
  });
  const pkg = JSON.parse(payload.find(p => p.file === 'package.json').bytes);
  const lock = JSON.parse(payload.find(p => p.file === 'package-lock.json').bytes);
  if (JSON.stringify(pkg.dependencies) !== JSON.stringify({ '@google-cloud/functions-framework': '5.0.5' }) ||
      JSON.stringify(pkg.overrides) !== JSON.stringify({ cloudevents: { uuid: '11.1.1' } }) ||
      pkg.engines.node !== '22.x' || lock.packages[''].dependencies['@google-cloud/functions-framework'] !== '5.0.5' ||
      Object.entries(lock.packages).filter(([n]) => n.endsWith('/uuid')).some(([, p]) => p.version !== '11.1.1')) {
    throw new Error('Unexpected dependency or runtime.');
  }
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (name && (!entry.integrity || !entry.resolved?.startsWith('https://registry.npmjs.org/'))) {
      throw new Error('Only integrity-pinned public npm dependencies are allowed.');
    }
  }
  fs.mkdirSync(dest);
  const hashes = {};
  for (const { file, bytes } of payload) {
    fs.writeFileSync(path.join(dest, file), bytes, { flag: 'wx' });
    hashes[file] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  return { project, source: dest, files: hashes, uploadBytes: payload.reduce((n, p) => n + p.bytes.length, 0), status: 'LOCAL_ONLY_NOT_AUTHORIZED' };
}
if (require.main === module) {
  try { console.log(JSON.stringify(prepare(process.argv[2], process.argv[3]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { prepare, FILES };
