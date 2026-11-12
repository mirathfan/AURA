const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, 'check-beta-local.cjs'), 'utf8');

function simulate({ missing = false, result = () => ({ status: 0 }), args = [] } = {}) {
  const calls = [];
  const messages = [];
  const stopped = Symbol('exit');
  const processStub = {
    argv: ['node', 'check-beta-local.cjs', ...args],
    execPath: process.execPath, version: process.version, env: {},
    exit(code) { this.exitCode = code; throw stopped; },
  };
  try {
    vm.runInNewContext(source, {
      __dirname, process: processStub,
      console: { log: (message) => messages.push(message), error: (message) => messages.push(message) },
      require(name) {
        if (name === 'node:fs') return { existsSync: () => !missing };
        if (name === 'node:path') return path;
        if (name === 'node:child_process') return {
          spawnSync(...values) { calls.push(values); return result(calls.length); },
        };
        throw new Error(`Unexpected dependency: ${name}`);
      },
    });
  } catch (error) { if (error !== stopped) throw error; }
  return { calls, messages, code: processStub.exitCode };
}

test('missing dependencies block all execution without installation', () => {
  const run = simulate({ missing: true });
  assert.equal(run.code, 2);
  assert.equal(run.calls.length, 0);
});

test('unknown arguments cannot select an external action', () => {
  const run = simulate({ args: ['--deploy'] });
  assert.equal(run.code, 2);
  assert.equal(run.calls.length, 0);
});

test('a failed check remains a failure even when later checks pass', () => {
  const run = simulate({ result: (index) => ({ status: index === 2 ? 1 : 0 }) });
  assert.equal(run.code, 1);
  assert.equal(run.calls.length, 6);
  assert.ok(run.messages.includes('FAIL Client TypeScript'));
});

test('interruption stops remaining checks and never reports success', () => {
  const run = simulate({ result: () => ({ status: null, signal: 'SIGINT' }) });
  assert.equal(run.code, 1);
  assert.equal(run.calls.length, 1);
});

test('successful checks use installed Node entry points without a shell', () => {
  const run = simulate();
  assert.equal(run.code, 0);
  assert.equal(run.calls.length, 6);
  for (const [command, args, options] of run.calls) {
    assert.equal(command, process.execPath);
    assert.equal(options.shell, false);
    assert.ok(path.isAbsolute(args[0]));
    assert.equal(options.env.CI, '1');
  }
});
