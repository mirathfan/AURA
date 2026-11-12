#!/usr/bin/env node
'use strict';
// Invocation-only controller. No deploy/IAM/billing mutations. Never run before approval.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { execFileSync } = require('node:child_process');
const PROJECT = 'aura-rehearsal-20261011';
const NUMBER = '1087494190017';
const OWNER = 'mirathfan@gmail.com';
const SERVICE = 'aura-rehearsal-health';
const REGION = 'us-central1';
const RUNTIME = `aura-canary-runtime@${PROJECT}.iam.gserviceaccount.com`;
const HEALTH = '{"status":"healthy"}\n';
const LEDGER = path.resolve(__dirname, '../../qa-artifacts/aura-health-canary-single-cloud-run');

function requireValue(ok, message) { if (!ok) throw new Error(message); }
function validateAdmission({ approval, project, billing, service, revision, policy }, now = Date.now()) {
  requireValue(approval.approved === true && typeof approval.approvalReference === 'string' && approval.approvalReference.length > 0 &&
    approval.projectId === PROJECT && approval.projectNumber === NUMBER && approval.authenticatedRequests === 20 &&
    approval.anonymousNegativeRequests === 1 && approval.runCapConfigured === true && approval.alertsConfigured === true &&
    Number.isFinite(approval.observedCostUsd) && approval.observedCostUsd >= 0 && approval.observedCostUsd < 2 &&
    Number.isFinite(approval.observedForecastUsd) && approval.observedForecastUsd >= 0 && approval.observedForecastUsd < 2 &&
    Date.parse(approval.expiresAt) > now && Date.parse(approval.expiresAt) <= now + 3600000,
  'Missing, expired or unsafe explicit test approval/control evidence.');
  requireValue(project.projectId === PROJECT && String(project.projectNumber) === NUMBER && project.lifecycleState === 'ACTIVE' && !project.parent,
    'Project identity/state/parent mismatch.');
  requireValue(billing.billingEnabled === true && billing.billingAccountName === 'billingAccounts/01B4D2-62CAD1-5848FD', 'Billing mismatch.');
  const meta = service.metadata || {};
  const annotations = meta.annotations || {};
  const template = service.spec?.template || {};
  const revisionAnnotations = template.metadata?.annotations || {};
  const spec = template.spec || {};
  const containers = spec.containers || [];
  const c = containers[0] || {};
  const limits = c.resources?.limits || {};
  requireValue(meta.name === SERVICE && String(meta.namespace) === NUMBER && meta.labels?.['cloud.googleapis.com/location'] === REGION,
    'Service identity mismatch.');
  requireValue(annotations['run.googleapis.com/invoker-iam-disabled'] !== 'true' && annotations['run.googleapis.com/ingress'] === 'all',
    'Private IAM/ingress configuration mismatch.');
  requireValue(annotations['run.googleapis.com/maxScale'] === '1' && Number(annotations['run.googleapis.com/minScale'] || 0) === 0 &&
    revisionAnnotations['autoscaling.knative.dev/maxScale'] === '1' && Number(revisionAnnotations['autoscaling.knative.dev/minScale'] || 0) === 0 &&
    revisionAnnotations['run.googleapis.com/cpu-throttling'] !== 'false' && revisionAnnotations['run.googleapis.com/startup-cpu-boost'] === 'false' &&
    revisionAnnotations['run.googleapis.com/execution-environment'] === 'gen2' &&
    spec.containerConcurrency === 1 && spec.timeoutSeconds === 15 && spec.serviceAccountName === RUNTIME &&
    containers.length === 1 && ['1', '1000m'].includes(limits.cpu) && limits.memory === '512Mi', 'Resource bounds/runtime identity mismatch.');
  requireValue(!(spec.volumes || []).length && !(c.env || []).length && !(c.volumeMounts || []).length &&
    !revisionAnnotations['run.googleapis.com/vpc-access-connector'] && !revisionAnnotations['run.googleapis.com/network-interfaces'] &&
    !revisionAnnotations['run.googleapis.com/cloudsql-instances'], 'Unexpected environment/data/network attachment.');
  requireValue(service.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True'), 'Service not Ready.');
  const traffic = service.status?.traffic || [];
  requireValue(traffic.length === 1 && traffic[0].percent === 100 && !traffic[0].tag &&
    traffic[0].revisionName === service.status.latestReadyRevisionName, 'Unexpected traffic/revision.');
  requireValue(revision?.metadata?.name === service.status.latestReadyRevisionName &&
    String(revision.metadata.namespace) === NUMBER && /^sha256:[a-f0-9]{64}$/.test(approval.imageDigest || '') &&
    revision.status?.imageDigest?.endsWith('@' + approval.imageDigest), 'Unreviewed image digest.');
  const bindings = policy.bindings || [];
  requireValue(!bindings.some(b => b.members?.some(m => m === 'allUsers' || m === 'allAuthenticatedUsers')), 'Public IAM binding.');
  const invokers = bindings.filter(b => b.role === 'roles/run.invoker');
  requireValue(invokers.length === 1 && !invokers[0].condition && invokers[0].members?.length === 1 &&
    invokers[0].members[0] === `user:${OWNER}`, 'Unexpected service invoker policy.');
  const url = new URL(service.status.url);
  requireValue(url.protocol === 'https:' && !url.username && !url.password && !url.port && url.pathname === '/' && !url.search && !url.hash &&
    (new RegExp(`^${SERVICE}-[a-z0-9]+-uc\\.a\\.run\\.app$`).test(url.hostname) ||
      url.hostname === `${SERVICE}-${NUMBER}.${REGION}.run.app`) && approval.serviceUrl === url.origin, 'Unexpected service URL.');
  return url.origin + '/healthz';
}

// Uses a total deadline, not an idle timeout. Never redirects/retries or logs bodies/tokens.
function requestHealth(url, token) {
  return new Promise((resolve, reject) => {
    let bytes = 0; const chunks = [];
    const req = https.get(url, { agent: false, headers: token ? { Authorization: `Bearer ${token}` } : {} }, res => {
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 4096) req.destroy(new Error('Response size bound exceeded.'));
        else chunks.push(chunk);
      });
      res.on('error', () => req.destroy(new Error('Response interrupted.')));
      res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), bytes }); });
    });
    const timer = setTimeout(() => req.destroy(new Error('Request deadline exceeded.')), 20000);
    req.on('error', () => { clearTimeout(timer); reject(new Error('Health request failed; no retry.')); });
  });
}

async function runBounded({ directory, url, getToken, request = requestHealth, expiresAt, now = Date.now }) {
  // Exclusive directory is a persistent consumed-attempt fence. Never remove/resume it automatically.
  fs.mkdirSync(directory, { mode: 0o700 });
  const fd = fs.openSync(path.join(directory, 'requests.jsonl'), 'wx', 0o600);
  const started = now(); let responseBytes = 0;
  function record(event) { fs.writeSync(fd, JSON.stringify(event) + '\n'); fs.fsyncSync(fd); }
  function checkWindow() { requireValue(now() < expiresAt && now() - started < 600000 && !fs.existsSync(path.join(directory, 'STOP')), 'Window expired or operator STOP.'); }
  async function one(kind, sequence, token) {
    checkWindow(); record({ event: 'reserved', kind, sequence }); // durable BEFORE dispatch
    const result = await request(url, token);
    responseBytes += result.bytes;
    requireValue(responseBytes <= 65536, 'Cumulative response size bound exceeded.');
    record({ event: 'response', kind, sequence, status: result.status, bytes: result.bytes });
    return result;
  }
  try {
    const denied = await one('anonymous-negative', 1);
    requireValue([401, 403].includes(denied.status), 'Anonymous access was not rejected; stop.');
    const token = await getToken();
    requireValue(typeof token === 'string' && token.length > 0 && token.length <= 8192 && !/\s/.test(token), 'Invalid token output.');
    for (let i = 1; i <= 20; i++) {
      const result = await one('authenticated', i, token);
      requireValue(result.status === 200 && result.body === HEALTH, 'Unexpected authenticated health response; stop.');
    }
    record({ event: 'complete', authenticated: 20, anonymousNegative: 1, responseBytes });
  } catch {
    record({ event: 'stopped', reason: 'Failure or safety bound; no retry/resume authorized.' });
    throw new Error('Canary stopped. Inspect status-only ledger; do not retry or delete its directory.');
  } finally { fs.closeSync(fd); }
}

function gcloud(args) {
  // No --quiet: never auto-accept a command's default enablement/permission prompt.
  // No stdin is supplied; an unexpected interactive prerequisite must fail closed.
  try { return execFileSync('gcloud', [...args, `--account=${OWNER}`, `--project=${PROJECT}`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 1024 * 1024,
      env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: 'false' } }).trim(); }
  catch { throw new Error('Read-only gcloud preflight/token command failed; details withheld.'); }
}
async function main(args) {
  requireValue(args.length === 2 && args[0] === '--execute-approved-20' && path.isAbsolute(args[1]), 'Requires explicit future approval and absolute admission JSON path. No cloud call made.');
  requireValue(!fs.existsSync(LEDGER), 'This single cloud test attempt was already reserved.');
  const approval = JSON.parse(fs.readFileSync(args[1], 'utf8'));
  requireValue(approval.approved === true, 'Test approval is not granted.');
  requireValue(['', '(unset)'].includes(gcloud(['config', 'get-value', 'auth/impersonate_service_account'])), 'Unexpected configured impersonation.');
  requireValue(gcloud(['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)']) === OWNER, 'Wrong active operator.');
  const read = args => JSON.parse(gcloud([...args, '--format=json']));
  const data = { approval,
    project: read(['projects', 'describe', PROJECT]), billing: read(['billing', 'projects', 'describe', PROJECT]),
    service: read(['run', 'services', 'describe', SERVICE, `--region=${REGION}`]),
    policy: read(['run', 'services', 'get-iam-policy', SERVICE, `--region=${REGION}`]) };
  requireValue(new RegExp(`^${SERVICE}-[a-z0-9-]+$`).test(data.service.status?.latestReadyRevisionName || ''), 'Invalid ready revision.');
  data.revision = read(['run', 'revisions', 'describe', data.service.status.latestReadyRevisionName, `--region=${REGION}`]);
  const url = validateAdmission(data);
  await runBounded({ directory: LEDGER, url, expiresAt: Date.parse(approval.expiresAt), getToken: () => gcloud(['auth', 'print-identity-token']) });
  console.log('PASS: 20 authenticated health responses; one anonymous request rejected. No tokens or bodies recorded.');
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { validateAdmission, runBounded, requestHealth, HEALTH };
