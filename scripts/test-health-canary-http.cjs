// Runs the packaged Functions Framework on loopback; no Google Cloud access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
test('isolated Node 22 Functions Framework serves static health and rejects other routes/methods', { timeout: 15000 }, async () => {
  const candidate = process.env.AURA_LOCAL_CANARY_PACKAGE;
  assert.ok(candidate && path.isAbsolute(candidate), 'Set absolute local packaged source path');
  const entry = path.join(candidate, 'node_modules/@google-cloud/functions-framework/build/src/main.js');
  assert.ok(fs.existsSync(entry));
  const allocation = net.createServer(); allocation.listen(0, '127.0.0.1'); await once(allocation, 'listening');
  const port = allocation.address().port; await new Promise(resolve => allocation.close(resolve));
  const child = spawn(process.execPath, [entry, '--target=health', '--signature-type=http', `--port=${port}`], {
    cwd: candidate, env: { PATH: process.env.PATH, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Local framework did not start')), 10000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', () => { clearTimeout(timeout); reject(new Error('Local framework exited early')); });
      child.stdout.on('data', data => { if (String(data).includes('URL:')) { clearTimeout(timeout); resolve(); } });
      child.stderr.resume();
    });
    for (const [method, route, status, body] of [
      ['GET', '/healthz', 200, '{"status":"healthy"}\n'],
      ['POST', '/healthz', 405, 'Method not allowed\n'],
      ['GET', '/', 404, 'Not found\n'],
      ['GET', '/healthz?token=synthetic-do-not-echo', 404, 'Not found\n'],
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(2000) });
      assert.equal(response.status, status); assert.equal(await response.text(), body);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    // Local framework has NO Cloud Run IAM frontend: this is deliberately not an auth test.
  } finally { child.kill('SIGTERM'); await exited; }
});
