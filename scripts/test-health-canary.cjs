const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { health } = require('../rehearsal/health-canary');
const { prepare, FILES } = require('./prepare-health-canary.cjs');
const { validateAdmission, runBounded, HEALTH } = require('./run-health-canary.cjs');
const NOW = Date.parse('2026-11-05T12:00:00Z');
const PROJECT = 'aura-rehearsal-20261011';
const SERVICE = 'aura-rehearsal-health';
const URI = `https://${SERVICE}-1087494190017.us-central1.run.app`;
const temp = t => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-canary-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
function fixture() {
  return { approval: { approved: true, approvalReference: 'synthetic-local-test-only', projectId: PROJECT,
    projectNumber: '1087494190017', authenticatedRequests: 20, anonymousNegativeRequests: 1,
    runCapConfigured: true, alertsConfigured: true, observedCostUsd: 0, observedForecastUsd: 0,
    expiresAt: new Date(NOW + 600000).toISOString(), imageDigest: 'sha256:' + 'a'.repeat(64), serviceUrl: URI },
  project: { projectId: PROJECT, projectNumber: '1087494190017', lifecycleState: 'ACTIVE' },
  billing: { billingEnabled: true, billingAccountName: 'billingAccounts/01B4D2-62CAD1-5848FD' },
  service: { metadata: { name: SERVICE, namespace: '1087494190017', labels: { 'cloud.googleapis.com/location': 'us-central1' },
    annotations: { 'run.googleapis.com/ingress': 'all', 'run.googleapis.com/maxScale': '1' } },
  spec: { template: { metadata: { annotations: { 'autoscaling.knative.dev/maxScale': '1', 'run.googleapis.com/startup-cpu-boost': 'false', 'run.googleapis.com/execution-environment': 'gen2' } },
    spec: { containerConcurrency: 1, timeoutSeconds: 15, serviceAccountName: `aura-canary-runtime@${PROJECT}.iam.gserviceaccount.com`,
      containers: [{ resources: { limits: { cpu: '1', memory: '512Mi' } } }] } } },
  status: { url: URI, conditions: [{ type: 'Ready', status: 'True' }], latestReadyRevisionName: SERVICE + '-00001-abc',
    traffic: [{ revisionName: SERVICE + '-00001-abc', percent: 100 }] } },
  revision: { metadata: { name: SERVICE + '-00001-abc', namespace: '1087494190017' }, status: { imageDigest: 'registry/image@sha256:' + 'a'.repeat(64) } },
  policy: { bindings: [{ role: 'roles/run.invoker', members: ['user:mirathfan@gmail.com'] }] } };
}
function dispatch(method, requestPath, query = {}) {
  const result = { headers: {} };
  const res = { set(k, v) { result.headers[k] = v; return this; }, status(n) { result.status = n; return this; },
    type(v) { result.type = v; return this; }, send(body) { result.body = body; return this; } };
  health({ method, path: requestPath, query }, res); return result;
}
test('health is static and ignores user/header input; unsupported paths/methods have no echo', () => {
  assert.deepEqual(dispatch('GET', '/healthz'), { headers: { 'Cache-Control': 'no-store' }, status: 200, type: 'application/json', body: HEALTH });
  assert.equal(dispatch('POST', '/healthz').status, 405);
  assert.equal(dispatch('GET', '/').status, 404);
  assert.equal(dispatch('GET', '/healthz', { token: 'do-not-echo' }).body, 'Not found\n');
});
test('source upload is exactly four files, integrity pinned and never copies ambient secrets', t => {
  const d = temp(t), source = path.join(d, 'source'); fs.mkdirSync(source);
  for (const f of FILES) fs.copyFileSync(path.join(__dirname, '../rehearsal/health-canary', f), path.join(source, f));
  fs.writeFileSync(path.join(source, '.env'), 'DO_NOT_COPY=synthetic');
  const output = path.join(d, 'output'); const manifest = prepare(PROJECT, output, source);
  assert.deepEqual(fs.readdirSync(output).sort(), [...FILES].sort()); assert.ok(manifest.uploadBytes < 262144);
  assert.throws(() => prepare('closet-app-57146', path.join(d, 'wrong'), source));
  assert.throws(() => prepare(PROJECT, output, source));
  fs.unlinkSync(path.join(source, 'index.js')); fs.symlinkSync(path.join(__dirname, '../rehearsal/health-canary/index.js'), path.join(source, 'index.js'));
  assert.throws(() => prepare(PROJECT, path.join(d, 'linked'), source));
});
test('admission accepts only exact approved bounded private service and image', () => {
  assert.equal(validateAdmission(fixture(), NOW), URI + '/healthz');
});
const unsafe = {
  'missing approval': f => { f.approval.approved = false; },
  'expired approval': f => { f.approval.expiresAt = new Date(NOW).toISOString(); },
  'unsafe spend': f => { f.approval.observedCostUsd = 2; },
  'unverified cap': f => { f.approval.runCapConfigured = false; },
  'wrong project': f => { f.project.projectId = 'closet-app-57146'; },
  'wrong number': f => { f.project.projectNumber = '1043970871162'; },
  'changed parent': f => { f.project.parent = { type: 'folder', id: '123' }; },
  'unlinked billing': f => { f.billing.billingEnabled = false; },
  'wrong region': f => { f.service.metadata.labels['cloud.googleapis.com/location'] = 'us-east1'; },
  'IAM disabled': f => { f.service.metadata.annotations['run.googleapis.com/invoker-iam-disabled'] = 'true'; },
  'public policy': f => { f.policy.bindings.push({ role: 'roles/run.invoker', members: ['allUsers'] }); },
  'broad authenticated policy': f => { f.policy.bindings[0].members.push('allAuthenticatedUsers'); },
  'unknown invoker': f => { f.policy.bindings[0].members = ['user:other@example.invalid']; },
  'too many instances': f => { f.service.metadata.annotations['run.googleapis.com/maxScale'] = '2'; },
  'warm instances': f => { f.service.metadata.annotations['run.googleapis.com/minScale'] = '1'; },
  'CPU billing always on': f => { f.service.spec.template.metadata.annotations['run.googleapis.com/cpu-throttling'] = 'false'; },
  'too much memory': f => { f.service.spec.template.spec.containers[0].resources.limits.memory = '1Gi'; },
  'unsupported gen2 memory': f => { f.service.spec.template.spec.containers[0].resources.limits.memory = '256Mi'; },
  'unreviewed execution environment': f => { f.service.spec.template.metadata.annotations['run.googleapis.com/execution-environment'] = 'gen1'; },
  'wrong runtime SA': f => { f.service.spec.template.spec.serviceAccountName = 'other'; },
  'data env': f => { f.service.spec.template.spec.containers[0].env = [{ name: 'FIREBASE_CONFIG', value: 'anything' }]; },
  'secret volume': f => { f.service.spec.template.spec.volumes = [{ name: 'secret' }]; },
  'tag route': f => { f.service.status.traffic[0].tag = 'old'; },
  'unreviewed image': f => { f.revision.status.imageDigest = 'registry/image@sha256:' + 'b'.repeat(64); },
  'foreign URL': f => { f.service.status.url = 'https://example.invalid'; },
  'unready service': f => { f.service.status.conditions = []; },
};
for (const [name, change] of Object.entries(unsafe)) test('admission rejects ' + name, () => {
  const f = fixture(); change(f); assert.throws(() => validateAdmission(f, NOW));
});
test('exactly 20 sequential authenticated requests plus one anonymous negative; persistent duplicate fence; no token/body ledger', async t => {
  const d = path.join(temp(t), 'run'); let count = 0, active = 0, peak = 0;
  const opts = { directory: d, url: URI + '/healthz', expiresAt: NOW + 600000, now: () => NOW,
    getToken: () => 'synthetic-secret-token', request: async (_url, token) => {
      active++; peak = Math.max(peak, active); count++; await Promise.resolve(); active--;
      return { status: token ? 200 : 403, body: token ? HEALTH : 'denied', bytes: token ? HEALTH.length : 6 };
    } };
  await runBounded(opts); assert.equal(count, 21); assert.equal(peak, 1);
  const log = fs.readFileSync(path.join(d, 'requests.jsonl'), 'utf8');
  assert.equal(log.includes('synthetic-secret-token'), false); assert.equal(log.includes('healthy'), false);
  assert.equal(log.split('\n').filter(x => x.includes('"reserved"') && x.includes('"authenticated"')).length, 20);
  await assert.rejects(runBounded(opts)); assert.equal(count, 21);
});
test('reservation precedes dispatch; ambiguous failure never retries or resumes', async t => {
  const d = path.join(temp(t), 'run'); let count = 0;
  const opts = { directory: d, url: URI, expiresAt: NOW + 10000, now: () => NOW, getToken: () => 'synthetic', request: async (_url, token) => {
    count++; const records = fs.readFileSync(path.join(d, 'requests.jsonl'), 'utf8'); assert.ok(records.includes('reserved'));
    if (token) throw new Error('sensitive text must not escape'); return { status: 403, body: '', bytes: 0 };
  } };
  await assert.rejects(runBounded(opts), /Canary stopped/); await assert.rejects(runBounded(opts)); assert.equal(count, 2);
  assert.ok(!fs.readFileSync(path.join(d, 'requests.jsonl'), 'utf8').includes('sensitive'));
});
for (const [label, response] of Object.entries({ anonymousAccepted: { status: 200, body: HEALTH, bytes: 21 }, redirect: { status: 302, body: '', bytes: 0 } })) {
  test('abort before token/auth requests on ' + label, async t => {
    let calls = 0; await assert.rejects(runBounded({ directory: path.join(temp(t), 'run'), url: URI,
      expiresAt: NOW + 10000, now: () => NOW, getToken: () => { throw new Error('must not get token'); }, request: async () => { calls++; return response; } }));
    assert.equal(calls, 1);
  });
}
test('operator STOP and expired window prevent dispatch', async t => {
  for (const stopped of [true, false]) {
    const directory = path.join(temp(t), 'run'); let calls = 0;
    await assert.rejects(runBounded({ directory, url: URI, expiresAt: stopped ? NOW + 10000 : NOW,
      now: () => { if (stopped && fs.existsSync(directory)) fs.writeFileSync(path.join(directory, 'STOP'), ''); return NOW; },
      getToken: () => 'synthetic', request: async () => { calls++; } }));
    assert.equal(calls, 0);
  }
});
test('concurrent controllers cannot dispatch a second batch', async t => {
  const directory = path.join(temp(t), 'run'); let release; let requests = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  const opts = { directory, url: URI, expiresAt: NOW + 10000, now: () => NOW,
    getToken: () => 'synthetic', request: async (_url, token) => {
      requests++; if (!token) await barrier;
      return { status: token ? 200 : 403, body: token ? HEALTH : '', bytes: token ? HEALTH.length : 0 };
    } };
  const first = runBounded(opts);
  await assert.rejects(runBounded(opts)); assert.equal(requests, 1);
  release(); await first; assert.equal(requests, 21);
});
test('authenticated failure aborts remaining slots and oversized response accounting aborts', async t => {
  for (const large of [false, true]) {
    let calls = 0;
    await assert.rejects(runBounded({ directory: path.join(temp(t), 'run'), url: URI,
      expiresAt: NOW + 10000, now: () => NOW, getToken: () => 'synthetic',
      request: async (_url, token) => { calls++; return {
        status: token ? (large ? 200 : 503) : 403,
        body: token ? HEALTH : '', bytes: token && large ? 65537 : 0,
      }; } }));
    assert.equal(calls, 2);
  }
});
test('proposal remains unapproved, fixed-target, no data/AI/jobs, private with two applicable controls', () => {
  const p = require('../docs/deployment/rehearsal.safeguards.proposed.json'); const c = p.phaseBCanary;
  assert.equal(p.billableProvisioningApproved, false); assert.equal(c.approved, false);
  assert.equal(p.lastVerifiedProjectState.billingLinked, false); assert.equal(p.projectId, PROJECT);
  assert.equal(c.cloudControlsVerified, false); assert.equal(c.deploymentApi, 'run.googleapis.com');
  assert.equal(c.publicInvokerAllowed, false); assert.deepEqual(c.runtimeRoleBindings, []);
  for (const k of ['functionsApiResources', 'eventTriggers', 'schedulerJobs', 'taskQueues', 'firestoreDatabases', 'firebaseAuthUsers', 'secretVersions', 'externalAiRequests']) assert.equal(c[k], 0);
  assert.equal(c.budgets.filter(b => b.applicable !== false).length, 2);
  assert.equal(c.maxControllerInvocationsIncludingRetries, 20); assert.equal(c.maxControllerRequestsTotal, 21);
  assert.equal(c.memoryMiB, 512); assert.equal(c.maxInstances, 1); assert.equal(c.timeoutSeconds, 15);
});
