# P1-10 Phase 2A — private health canary readiness

**November 11 execution update:** Section 8 was conditionally approved and execution resumed after successful CLI sign-in. [Phase 2B results](PRIVATE_HEALTH_CANARY_EXECUTION_2026-11-11.md): $1 Run cap and early alerts installed/verified; API activation automatically added three unapproved APIs and a default Compute Editor grant. Mandatory stop occurred before upload/build/deployment. Workload checks were empty and billing was unlinked after 4 minutes 36 seconds. **FAIL / NOT READY to resume** pending changed-scope review. Approval-required wording below is historical; this result supersedes the earlier passkey blocker.

**November 5, 2026: local preparation completed. NOT READY FOR PHASE 2 EXECUTION.** The package and controller are locally testable; execution still requires explicit approval, an available authenticated Google Cloud CLI, fresh target/permission checks, and verification of configured spending controls before upload/deploy. No cloud reads, mutations, source upload or paid AI were performed in this phase. External TestFlight remains **NO-GO**.

## 1. Reconciled state and scope

[Phase 1C](REHEARSAL_BOOTSTRAP_2026-11-04.md) last verified `aura-rehearsal-20261011` / `1087494190017` at **2026-11-04T14:22:39.829Z**: ACTIVE, No organization/no folder, no billing account, one human Owner, 23 default enabled services and no identified workload assets. This is yesterday's verified state, not a fresh November 5 cloud assertion. Billing/on-call owner remains **Mir Athfan Ali / mirathfan@gmail.com**; intended operational budget remains **$25, not a hard cap**. No new project or replacement ID is needed.

The older safeguards' unexpected-billing banner, full-backend health packaging, three compulsory budgets and unresolved local lint status are superseded by this report and the updated [inert proposal](deployment/rehearsal.safeguards.proposed.json). Historical bootstrap observations are retained explicitly as history.

Use **one Cloud Run function through the Cloud Run Admin API**, rather than Firebase or the Cloud Functions v2 API. It is a standalone HTTP function, not an export from `functions/src/index.ts`. This reduces deployment dependencies and avoids loading AURA/Firebase/native-image/provider modules. A successful canary validates this narrow build/deploy/IAM lane only; it does **not** validate Firebase triggers, recovery, deletion, consent or the application's native startup.

## 2. Exact canary and artifact

| Setting | Proposed value |
|---|---|
| Project / number / region | `aura-rehearsal-20261011` / `1087494190017` / `us-central1` |
| Cloud Run service/function / entry point | `aura-rehearsal-health` / `health` |
| Runtime | Node.js 22, `--base-image=nodejs22`, HTTP Functions Framework **5.0.5**, isolated lockfile |
| Request | `GET /healthz`, no query or body |
| Response | HTTP 200, `application/json`, literal `{"status":"healthy"}` plus newline; `Cache-Control: no-store` |
| CPU / memory / concurrency | **1 vCPU / 512 MiB / 1** |
| Instances | **0 minimum / 1 maximum**, service and revision bounds |
| Timeout / billing | **15 seconds**, request-based CPU throttling; startup CPU boost disabled |
| Revision / updates | One deployment/build attempt, one serving revision, no tags; automatic base-image updates disabled for this short test window |
| Private access | Invoker IAM check enabled, no `allUsers`/`allAuthenticatedUsers`; service-scoped `roles/run.invoker` for `user:mirathfan@gmail.com` |
| Ingress | `all`, so an authenticated operator on the local computer can reach it; **IAM-private, not network-private**. No public invocation binding, proxy, IAP, LB, VPC or NAT |
| Runtime identity | `aura-canary-runtime@aura-rehearsal-20261011.iam.gserviceaccount.com`, **no project/data/secret/billing roles** |
| Build identity | `aura-canary-build@aura-rehearsal-20261011.iam.gserviceaccount.com`; dedicated, no downloaded key |
| Source bucket/object | `gs://aura-rehearsal-20261011-canary-source/health-source.tar.gz`, us-central1, Standard, uniform access, public-access prevention, soft delete **0**, versioning off, no retention lock |
| Image repository | `us-central1-docker.pkg.dev/aura-rehearsal-20261011/aura-canary/aura-rehearsal-health` |
| Source / artifact targets | <=1 MiB source; <=1 GiB registry; one additional managed staging/log bucket at most, same project/us-central1, actual name recorded and policies inspected |
| Jobs / databases / Firebase / secrets / AI | **Zero**. No Scheduler, Eventarc, Pub/Sub trigger, Tasks, provider credentials or user fixtures |

Authentication is enforced by **Cloud Run before the handler**. The handler does not accept a client boolean or pretend that a bearer-header presence check validates a token. Local Functions Framework exposes the static handler without Cloud Run IAM; local HTTP success does not establish private access. Cloud verification must reject the anonymous request before admitting the authenticated batch. [Cloud Run developer authentication](https://docs.cloud.google.com/run/docs/authenticating/developers)

The selected **gen2 execution environment requires at least 512 MiB**. The final configuration uses that supported minimum, reducing the earlier 1024 MiB proposal without pairing gen2 with an unsupported 256 MiB setting. [Execution environment requirements](https://docs.cloud.google.com/run/docs/configuring/execution-environments)

The [source](../rehearsal/health-canary/index.js) has no imports, request/body logging, Firebase access, environment/credential lookup or outbound operations. Unrecognized paths/query strings return 404; non-GET methods return 405. Framework dependencies include CloudEvents utilities, but **no event trigger or CloudEvents handler is deployed**. The [package](../rehearsal/health-canary/package.json) pins the framework and scopes a `cloudevents → uuid 11.1.1` override to this package. Initial audit found GHSA-w5hq-g745-h8pq in uuid 8; the transitive caller uses `v4()`. The patched CommonJS override passed framework startup and removes the reported advisory without modifying AURA's dependencies. [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq)

The [local packager](../scripts/prepare-health-canary.cjs) copies exactly **four regular files**: `index.js`, `package.json`, `package-lock.json`, `.gcloudignore`. It rejects another target, existing/repository output, symlinks, oversized files, non-registry/unpinned dependency sources and obvious credential/production literals. This is a bounded scan plus review, not a universal secret detector. No `.env`, native config, root lockfile, application code, tests, Git metadata, admission evidence or node_modules is uploaded. The current four files total **59,031 bytes**; final package lock SHA-256 **`13e0f1cdf2ac69abcd0144830f994bd444a470b4c975451f4276339d496a9110`**. Repackage/re-hash if source changes.

Local preparation, safe now (output must be new):

```sh
node scripts/prepare-health-canary.cjs aura-rehearsal-20261011 /absolute/new/canary-source
node --test scripts/test-health-canary.cjs scripts/test-cloud-rehearsal-preparation.cjs
```

## 3. API and scoped permission inventory

Required API set: `run.googleapis.com`, `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `iam.googleapis.com`, `cloudresourcemanager.googleapis.com`, `serviceusage.googleapis.com`, `storage.googleapis.com`, `logging.googleapis.com`, `monitoring.googleapis.com`. The first five were absent from Phase 1C's enabled list; the last four were already enabled. Freshly diff before any enablement. Cloud Billing console operations do not require enabling the Budget API on this project.

**Exclude:** Cloud Functions API, Firebase Management/Auth/Firestore/Rules/Storage APIs, Scheduler, Eventarc, Tasks, Secret Manager, IAM Credentials, Compute API, BigQuery exports, Budget API and any extra dependency not explicitly approved. Existing unrelated default APIs remain untouched. Cloud Run source deployment can create a Compute **default service account** even without deploying a VM; inspect it and Google's service agents before any upload. Stop on automatic Editor grants or unapproved principal/role/API dependencies; do not silently repair these with broader IAM. [Source deployment prerequisites](https://docs.cloud.google.com/run/docs/deploying-source-code)

| Principal / stage | Required scope and capabilities |
|---|---|
| Human bootstrap | Existing project Owner is last-observed access, not a new grant. Needs target `resourcemanager.projects.get`, get/setIamPolicy, `serviceusage.services.get/list/enable`, `iam.serviceAccounts.create/get/list/delete/getIamPolicy/setIamPolicy`, resource setup and cleanup permissions. No production or parent/organization grants |
| Human billing operator | Existing account Billing Admin is historical evidence; refresh. Link requires account `billing.resourceAssociations.create` and project `resourcemanager.projects.createBillingAssignment`; unlink requires project `resourcemanager.projects.deleteBillingAssignment` or account association-delete authority. Budget create/read/update/delete plus `billing.budgets.configureSpendCap` on this account, or documented project-scoped equivalents. No shared-account settings changes |
| Human deployment | `roles/run.sourceDeveloper` + Service Usage Consumer are supported source-deployer roles if current access is insufficient; `iam.serviceAccounts.actAs` only on the two named SAs. Bootstrap human additionally needs `run.services.getIamPolicy/setIamPolicy/delete`, build get/list/cancel, repository create/get/list/delete, Storage bucket/object setup/read/delete, log-bucket get/update. Do not grant a second Owner/Editor binding |
| Build SA | Supported **`roles/run.builder`**, scoped to the rehearsal project only: artifact upload/download/deleteArtifacts, source-object get, log-entry create and source-repo get. No billing, project IAM, data, secrets, Run invocation or runtime actAs. It can access artifacts/source elsewhere in this isolated project; do not later reuse this role/identity in a data-bearing rehearsal without review |
| Runtime SA | **No role grants**; not the default Compute SA. Platform collects logs; the handler does not call Google APIs |
| Human invoker | `roles/run.invoker` on **only** `aura-rehearsal-health`; no invoker key or extra invoker SA. Human Owner remains an administrator; service policy does not restrict an Owner from changing access |
| Google agents | Run `service-1087494190017@serverless-robot-prod.iam.gserviceaccount.com` with `roles/run.serviceAgent`; Build `service-1087494190017@gcp-sa-cloudbuild.iam.gserviceaccount.com` with `roles/cloudbuild.serviceAgent`; Artifact Registry managed agent if created. Record actual generated identities/roles. Do not grant service-agent roles to the runtime/build/human |
| Cleanup | Same approved human, target only: cancel build, remove invoker, delete service/revisions, repository/images, owned source objects/buckets, named SA grants/SAs; unlink project billing. Budget cleanup uses only recorded rehearsal budget IDs. No project deletion or IAM Deny administration |

Use the supported Run Builder role rather than assuming the earlier Functions-specific bucket grants are sufficient for this different deployment path. Its exact permission set is limited but project scoped. [Run IAM roles](https://docs.cloud.google.com/run/docs/reference/iam/roles), [custom build identity](https://docs.cloud.google.com/run/docs/configuring/services/build-service-account)

## 4. Spending controls, costs and exposure

All controls below are **proposed, not installed**. No $25 total hard limit exists.

| Control | Exact proposal | What it does / does not enforce |
|---|---|---|
| Run service cap | Monthly **$1**, project number `1087494190017`, service **152E-C115-5142**, `aura-rehearsal-run-cap`; require **Configured** status | Pauses eligible service usage after estimated gross threshold; delayed enforcement/in-flight/fixed costs can overrun |
| Functions service cap | **$1**, service **29E7-DA93-CA13**, **not applicable / do not create** in this direct Run lane | Required for reassessment only if a separately approved plan adds Cloud Functions API resources; never silently switch deployment model |
| Early alerts | `aura-rehearsal-all-services`, monthly **$25**, only this project, all services, credits excluded; actual **$0.50/$1/$2/$5**, forecast **$2** | Alerts only. Billing admins/users and project-owner email; no Pub/Sub, channel, export or automatic shutdown resource |
| Operational stop | **$2 actual OR forecast aggregate cost**, any cap activation, unexpected resource/access, count/size/time failure | Human stops testing, cancels build and executes approved cleanup. Delayed reports are not an enforcement mechanism |
| Attended window | **60 minutes from billing link through cleanup**; operator checks every **5 minutes** | One deploy/build; cancel any build at **15 elapsed minutes**, do not retry/increase size. Source deployment has no reviewed hard build-timeout override here; this is an attended cancellation threshold |
| Run limits | 1 CPU, 512 MiB, min0/max1, concurrency1, timeout15s, request-based billing | Limits capacity, not cumulative invocations or total spend; maximum instances can briefly be exceeded |
| Test controls | 20 authenticated + 1 anonymous negative; no retry/redirect; sequential; 20s client deadline, 10min batch deadline | Controller enforces its own requests. Platform startup probes, control-plane requests and another authorized actor are not counted by it |
| Storage / logs / network | <=1 MiB source, <=1 GiB artifacts, <=50 MiB log ingestion target; `_Default` 1 day, `_Required` 400 days; <=1 MiB test request/response payload+headers; 100 MiB project-egress target | Storage/log/egress numbers are operator targets, not allocation quotas. Build/image transfers and protocol overhead are outside the controller's byte accounting. No application outbound traffic |

Caps are single-project/single-service monthly controls, reset monthly, and can overrun; verify account eligibility, $1 acceptance, scope, fixed notifications and **Configured** state in the console. If unavailable or rejected, **stop before source upload**, with no alert-only substitution or automatic cap increase. Notification receipt remains unverified; an attended console is required. [Spend-cap behavior and permissions](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)

**Uncovered by the Run cap:** Cloud Build, Artifact Registry storage, Cloud Storage operations/retention, Logging/Monitoring beyond allowances, separate network SKUs and any unexpected service. A Functions cap would not cover them either. Free tiers are shared and must not be assumed available. [Run scaling caveat](https://docs.cloud.google.com/run/docs/configuring/max-instances), [Logging retention](https://docs.cloud.google.com/logging/quotas)

Planning estimate, **not measured cloud costs**: one 15-minute e2-standard-2 build at $0.006/minute is **$0.09**. Twenty requests each using the full 15s give 300 nominal request-seconds: about **$0.0072 CPU + $0.000375 memory + $0.000008 request charges**, before startup/rounding. Allow roughly **$0.10–$0.50 expected** for one short clean build/test with prompt teardown; reserve **$5 planning headroom** within the $25 intended budget. Builder machine/time, image size, retained data, network and delayed charges can exceed this estimate. A managed build that selects a larger machine is a stop/cancel condition, not permission to continue. No finite $25 maximum is demonstrated. [Build pricing](https://cloud.google.com/build/pricing), [Run pricing](https://cloud.google.com/run/pricing)

Unavoidable windows: billing link precedes verified controls; API activation can create identities/default configuration; build startup incurs uncovered costs before monitoring/cancellation; deployment startup/probes occur before the first test; IAM changes propagate; cleanup and billing reports lag. Source buildpacks use a provider-managed builder and base-image tag, so package-lock alone is not an image digest. Record the actual build, base image, resulting digest and revision; failure is teardown, not an unapproved second attempt.

## 5. Ordered future execution plan — NOT RUN

Every mutation in this section requires **new explicit approval covering setup, one source upload/build/deploy, the 21-request test and cleanup including billing unlink**. The prior Phase 1C unlink authorization is consumed and does not authorize a later relink/unlink cycle. No `gcloud config set`, Firebase default alias, Cloud Shell or production resource is used. Stop on any mismatch/failure; do not widen scope automatically.

### A. Local and read-only preflight

Restore an official Google Cloud CLI locally and record its version; it is currently unavailable. Do not install extra components or sign in without a separately appropriate local-tool/auth authorization. Verify the CLI supports all proposed flags; command syntax below was checked against current official references, not executed through a local gcloud parser.

```sh
# Bash; read-only. All variables are task-specific.
set -euo pipefail
AURA_P=aura-rehearsal-20261011
AURA_N=1087494190017
AURA_OWNER=mirathfan@gmail.com
AURA_REGION=us-central1
AURA_SERVICE=aura-rehearsal-health
AURA_RUNTIME=aura-canary-runtime@aura-rehearsal-20261011.iam.gserviceaccount.com
AURA_BUILD=aura-canary-build@aura-rehearsal-20261011.iam.gserviceaccount.com
AURA_BUCKET=aura-rehearsal-20261011-canary-source
gcloud version
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud config get-value auth/impersonate_service_account
gcloud config get-value core/disable_prompts
gcloud projects describe "$AURA_P" --account="$AURA_OWNER" --format=json
gcloud billing projects describe "$AURA_P" --account="$AURA_OWNER" --format=json
gcloud projects get-iam-policy "$AURA_P" --account="$AURA_OWNER" --format=json
gcloud services list --enabled --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud storage buckets list --project="$AURA_P" --account="$AURA_OWNER" --format=json
```

Require matching active human, no configured impersonation or automatic prompt acceptance, exact ID/number, ACTIVE, no parent, unlinked billing, unchanged Owner and no workload assets. Also use project-scoped **console Asset Inventory**, which worked without enabling its API in Phase 1B/C; do not enable Cloud Asset API to make a CLI inventory command work. Record baseline service/API/asset names and time. Any new workload or unexpected bill stops the plan before linking.

### B. First mutation — only after approval

```sh
gcloud billing projects link "$AURA_P" --billing-account=01B4D2-62CAD1-5848FD --account="$AURA_OWNER"
gcloud billing projects describe "$AURA_P" --account="$AURA_OWNER" --format=json
```

Start the 60-minute attended clock. Verify correct linked account and enabled billing. In Billing console, create the two target-only controls from §4, recording actual budget IDs, project number, recipients and cap state. Do not change the production budget or enable Budget API. If service activation is required for cap setup, enable only approved Run API first, inspect default identities, finish the cap, then stop unless verified. A control failure means use the **newly approved cleanup/unlink** path; no deployment.

### C. Approved APIs, identities, source storage and logging

```sh
# Enable only APIs missing from the refreshed baseline, among this exact list.
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com --project="$AURA_P" --account="$AURA_OWNER"
gcloud iam service-accounts create aura-canary-runtime --project="$AURA_P" --account="$AURA_OWNER"
gcloud iam service-accounts create aura-canary-build --project="$AURA_P" --account="$AURA_OWNER"
gcloud projects add-iam-policy-binding "$AURA_P" --member="serviceAccount:$AURA_BUILD" --role=roles/run.builder --condition=None --account="$AURA_OWNER"
gcloud iam service-accounts add-iam-policy-binding "$AURA_RUNTIME" --member="user:$AURA_OWNER" --role=roles/iam.serviceAccountUser --condition=None --project="$AURA_P" --account="$AURA_OWNER"
gcloud iam service-accounts add-iam-policy-binding "$AURA_BUILD" --member="user:$AURA_OWNER" --role=roles/iam.serviceAccountUser --condition=None --project="$AURA_P" --account="$AURA_OWNER"
gcloud artifacts repositories create aura-canary --repository-format=docker --location="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER"
gcloud storage buckets create "gs://$AURA_BUCKET" --location="$AURA_REGION" --default-storage-class=STANDARD --uniform-bucket-level-access --public-access-prevention --soft-delete-duration=0 --project="$AURA_P" --account="$AURA_OWNER"
gcloud storage buckets describe "gs://$AURA_BUCKET" --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud logging buckets list --location=global --project="$AURA_P" --account="$AURA_OWNER" --format=json
# Only if the preceding read confirms this exact existing _Default bucket/location:
gcloud logging buckets update _Default --location=global --retention-days=1 --project="$AURA_P" --account="$AURA_OWNER"
gcloud iam service-accounts list --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud projects get-iam-policy "$AURA_P" --account="$AURA_OWNER" --format=json
```

No role is granted to the runtime. Inspect all platform-created agents/default identities, runtime/build IAM, source bucket project number, region, soft delete 0, versioning off, no hold/retention, and image repository. Stop on an unavailable bucket/repository name; no alternate resource is implicitly approved. If `_Default` is absent or another location is used, do not create a bucket just to satisfy this command; record the actual default and obtain review before a changed log configuration. Retain `_Required`; it is not configurable to one day.

### D. Reviewed source upload and exactly one build/deployment

```sh
# Local artifact preparation. The output directory must not already exist.
AURA_SOURCE=/absolute/new/canary-source
AURA_ARCHIVE=/absolute/new/health-source.tar.gz
node scripts/prepare-health-canary.cjs "$AURA_P" "$AURA_SOURCE"
COPYFILE_DISABLE=1 tar -czf "$AURA_ARCHIVE" -C "$AURA_SOURCE" index.js package.json package-lock.json .gcloudignore
tar -tzf "$AURA_ARCHIVE"
shasum -a 256 "$AURA_ARCHIVE"
# Source upload is a separately approved cloud mutation. No overwrite permitted.
gcloud storage cp "$AURA_ARCHIVE" "gs://$AURA_BUCKET/health-source.tar.gz" --if-generation-match=0 --project="$AURA_P" --account="$AURA_OWNER"
gcloud run deploy "$AURA_SERVICE" \
  --source="gs://$AURA_BUCKET/health-source.tar.gz" \
  --function=health --base-image=nodejs22 --no-automatic-updates \
  --image="us-central1-docker.pkg.dev/$AURA_P/aura-canary/$AURA_SERVICE" \
  --build-service-account="projects/$AURA_P/serviceAccounts/$AURA_BUILD" \
  --service-account="$AURA_RUNTIME" --execution-environment=gen2 \
  --cpu=1 --memory=512Mi --concurrency=1 --timeout=15s \
  --min=0 --max=1 --min-instances=0 --max-instances=1 \
  --cpu-throttling --no-cpu-boost --ingress=all \
  --invoker-iam-check --no-allow-unauthenticated \
  --clear-env-vars --clear-secrets --labels=purpose=aura-private-canary \
  --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER"
```

Do not run from the AURA backend/root or answer an unexpected enablement prompt with yes. Do not add `--quiet` to deployment or use a shell/CLI setting that automatically accepts prerequisite prompts. Use a second terminal to inspect the single regional build while deployment runs; cancel at 15 minutes or on an unexpected machine/identity/resource. Record actual source generation, build ID, machine, logs destination, image digest, revision and all generated bucket names. At most one additional managed staging/log bucket is proposed; it must belong to this project in us-central1. A different resource/API/region requires a stop and review, not a retry. The GCS archive and custom image repository are supported source-deployment inputs. [Deployment command reference](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy)

```sh
gcloud builds list --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud run services describe "$AURA_SERVICE" --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud run services get-iam-policy "$AURA_SERVICE" --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud storage buckets list --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud artifacts repositories list --location=all --project="$AURA_P" --account="$AURA_OWNER" --format=json
# Only after private IAM, revision, bounds, roles, budgets and resources pass:
gcloud run services add-iam-policy-binding "$AURA_SERVICE" --member="user:$AURA_OWNER" --role=roles/run.invoker --condition=None --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER"
```

### E. The 20-request test and cost inspection

Copy the [admission template](deployment/canary-test-admission.template.json) to local evidence only. Fill it **after approval and the actual cloud checks**: approval reference, canonical service URI, ready revision image digest (read with `gcloud run revisions describe`), cap/alert evidence, current actual/forecast cost observations, and expiry <=1 hour ahead. If the provider has no forecast, record the operator's conservative estimate and label its source in evidence; never describe it as a provider forecast. Admission flags are operator attestations, **not security or billing enforcement**. Review project IAM as well as service IAM for inherited invocation rights.

```sh
# Invocation only; not executed during Phase 2A.
node scripts/run-health-canary.cjs --execute-approved-20 /absolute/local/approved-canary-admission.json
```

The [controller](../scripts/run-health-canary.cjs) re-reads project, billing, service, ready revision and service IAM via explicit-target gcloud commands; validates region/identity, approved image, private IAM, bounds and absence of env/secret/volume/network attachments; then acquires a **persistent exclusive directory** at `qa-artifacts/aura-health-canary-single-cloud-run`. It sends **one unauthenticated negative GET**, requires 401/403, obtains a short-lived human ID token in memory via gcloud, then sends **exactly 20 sequential authenticated GETs** on the successful path. Tokens are not passed as command arguments, written to disk or logged. Responses must match the static body exactly. Body limit 4 KiB/request; aggregate response limit 64 KiB; token limit 8 KiB; no redirects/retries.

Each request's slot is written and fsynced **before** dispatch. A crash/timeout/failed response may consume a slot without known delivery; the run aborts and the directory remains consumed. Never delete it or start a replacement path to get another batch. Failure can therefore mean **fewer than 20 authenticated requests**, not permission to top up. Concurrent controllers cannot both acquire it. Creating `STOP` inside that directory stops subsequent requests; an already in-flight request can finish. These are operator accident controls, not protection from a compromised Owner or a manually invoked service.

Capture status/count/latency/cost/resource metadata only; no token or raw request/response logging. Inspect project-filtered billing and service metrics immediately after testing. Do not infer final zero cost from empty reports. Cloud IAM denial, real token admission, Linux build/startup, platform scaling and cleanup are all **NOT RUN** in Phase 2A.

## 6. Executable shutdown and cleanup — future approved scope only

Run whether the test passes or fails. Keep the human on call until workload teardown and billing unlink are verified. Do not interpret a lost terminal as cancellation; active builds can finish after the client exits.

1. Stop the controller (`Ctrl-C` or its local `STOP` file). Snapshot only named resource/build IDs. Find the single build in the approved region and cancel it if QUEUED/WORKING; wait for terminal build/operation state **before** deleting the service, because an unfinished deployment could recreate it. If the build is not in the approved region, report the scope breach and obtain direction rather than starting a second build.

```sh
gcloud builds list --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER" --format=json
# Set this only to the observed single canary build ID; never select another project's build.
AURA_BUILD_ID='<observed-canary-build-id>'
gcloud builds cancel "$AURA_BUILD_ID" --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER"
gcloud builds describe "$AURA_BUILD_ID" --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER" --format=json
```

Cancel only when active; do not treat an expected already-terminal status as a reason to retry deployment. Once the build and deployment operation are terminal, remove the exact invoker binding if installed, delete the service, then check absence. Owner privileges can still invoke until service deletion; invoker withdrawal alone is not a complete shutdown.

```sh
gcloud run services remove-iam-policy-binding "$AURA_SERVICE" --member="user:$AURA_OWNER" --role=roles/run.invoker --condition=None --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER"
gcloud run services delete "$AURA_SERVICE" --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER" --quiet
gcloud run services list --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud run revisions list --service="$AURA_SERVICE" --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud run jobs list --region="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER" --format=json
```

If resources were never created, a verified NOT_FOUND can be recorded and that deletion skipped. Permission errors are not absence. No repeated create/deploy operations are permitted during cleanup.

2. Delete the approved image repository and source data **only after confirming they contain this canary's artifacts alone**. Artifact Registry deletion must finish; do not assume deleting the service deleted its image/source.

```sh
gcloud artifacts docker images list "us-central1-docker.pkg.dev/$AURA_P/aura-canary" --include-tags --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud artifacts repositories delete aura-canary --location="$AURA_REGION" --project="$AURA_P" --account="$AURA_OWNER" --quiet
gcloud storage buckets describe "gs://$AURA_BUCKET" --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud storage ls --all-versions "gs://$AURA_BUCKET/**" --project="$AURA_P" --account="$AURA_OWNER"
gcloud storage rm --recursive "gs://$AURA_BUCKET" --project="$AURA_P" --account="$AURA_OWNER"
```

For the one permitted additional managed bucket, record its exact name from build metadata, independently verify projectNumber `1087494190017`, us-central1, contents/purpose, and review deletion. Use that **literal validated name**, not a project-wide wildcard. Inspect retention/holds/versioning and soft-deleted objects first. Before deleting live synthetic objects, clear that bucket's soft-delete policy with `gcloud storage buckets update gs://<validated-name> --clear-soft-delete --project="$AURA_P" --account="$AURA_OWNER"`, verify it took effect, then run the same list/delete commands. Do not change any unrelated bucket or remove a retention lock. Already soft-deleted objects/buckets cannot be purged by clearing the policy; report their hard-delete times and residual costs, and **do not mark full cleanup PASS** until they expire. [Soft-delete limitation](https://docs.cloud.google.com/storage/docs/disable-soft-delete), [retained buckets](https://docs.cloud.google.com/storage/docs/use-soft-deleted-buckets)

3. Remove the canary build binding and delete the two dedicated SAs (their resource-scoped actAs bindings disappear with them). Leave the human Owner, Google-managed identities and unrelated baseline roles intact. No service-account keys should exist.

```sh
gcloud projects remove-iam-policy-binding "$AURA_P" --member="serviceAccount:$AURA_BUILD" --role=roles/run.builder --condition=None --account="$AURA_OWNER"
gcloud iam service-accounts delete "$AURA_BUILD" --project="$AURA_P" --account="$AURA_OWNER" --quiet
gcloud iam service-accounts delete "$AURA_RUNTIME" --project="$AURA_P" --account="$AURA_OWNER" --quiet
gcloud artifacts repositories list --location=all --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud storage buckets list --project="$AURA_P" --account="$AURA_OWNER" --format=json
# CLI 593.0.0: buckets list does not support --soft-deleted. No matches may exit nonzero;
# distinguish that result from permission errors, and verify an empty API listing if needed.
gcloud storage ls --soft-deleted --project="$AURA_P" --account="$AURA_OWNER" --json
gcloud iam service-accounts list --project="$AURA_P" --account="$AURA_OWNER" --format=json
gcloud projects get-iam-policy "$AURA_P" --account="$AURA_OWNER" --format=json
```

Use console Asset Inventory plus the direct service/revision/build/repository/Storage/IAM checks to reconcile every created resource against the before/after ledger. Require no canary service/revision, active build, repo/image, source object/bucket, dedicated SA or unexpected worker. Historical build records, default service agents, API metadata and audit logs may remain; they are not live deployed workloads. Preserve required audit logs (400 days), rather than promising an entirely empty project. Record any retained soft-deleted data explicitly.

4. **After verified teardown**, unlink billing from this project only, under the **new execution approval's cleanup authority**. If teardown fails, stop tests, report the retained resources and cost exposure, and seek explicit emergency unlink direction rather than claiming deletion succeeded. The execution approval request below does not silently authorize destructive recovery of unexpected resources.

```sh
gcloud billing projects unlink "$AURA_P" --account="$AURA_OWNER"
gcloud billing projects describe "$AURA_P" --account="$AURA_OWNER" --format=json
gcloud projects describe "$AURA_P" --account="$AURA_OWNER" --format=json
```

Require disabled billing/no account, same ID/number and ACTIVE state. Do not close the shared account. Keep target-only alerts for delayed charge review at **24 and 72 hours**; then remove only the recorded rehearsal budgets in the console under approved cleanup scope. These are owner follow-up requirements, **not installed automations**. APIs/default agents may remain enabled without workload/billing; disabling them is not needed to delete the canary and is not included automatically. No claims of zero final liability or immediate erasure of required audit history.

## 7. Local environment repair and validation

Reproduced root `npm run lint` exit 127 before repair. Installed Expo **54.0.37**, ESLint **9.39.3** and their lock entries matched, but `node_modules/.bin` did not exist and both CLI entry files had mode **0600**. The declared `file:modules/expo-vision-bg` dependency existed in source/lock but its installed link was missing; direct ESLint reproduced exactly two unresolved imports.

Restored only `.bin/expo → ../expo/bin/cli`, `.bin/eslint → ../eslint/bin/eslint.js`, added owner execute permission to those two installed entries (0600 → 0700), and restored `node_modules/expo-vision-bg → ../modules/expo-vision-bg`. No root install, upgrade, patch, native build, root lockfile change or application-source fix was needed. The evidence contains the reversible link/mode ledger. `CI=1 EXPO_NO_TELEMETRY=1 npm run lint` then passed with **0 errors / 9 existing warnings**. Expo loaded local environment variable names during lint; no values were printed or copied into the canary.

| Check | Result / boundary |
|---|---|
| Canary handler, source allowlist, admission guards, count/durable-fence/stop tests | **37/37 PASS**, including concurrent-controller exclusion, crash reservation, wrong/public IAM, changed target/image/bounds, oversized responses and expiry |
| Existing full-backend packager tests | **3/3 PASS**, retained for regression only; this package is not selected for canary deployment |
| Packaged Node 22 Functions Framework HTTP startup | **1/1 PASS**; local loopback test of GET, unsupported method/path/query and no-store; **not cloud IAM validation** |
| Canary dependency audit | Final pinned package: **0 reported vulnerabilities**; initial uuid finding corrected only in canary |
| Root lint | **PASS**, 0 errors / 9 pre-existing warnings; no automatic fixes |
| Source/lock/native preservation | Baseline hash comparison; only documented preparation files changed, local node_modules links/modes excluded from tracked source |
| Cloud build, real private invocation, controls, cleanup, native app | **NOT RUN** |

Evidence: [canary-readiness-2026-11-05](../../qa-artifacts/canary-readiness-2026-11-05/). No existing full client/backend/emulator test result is represented as rerun; no AURA build or framework migration occurred. Expo SDK 54, Xcode 26.0 pin, UI, Firebase config and unrelated user changes remain unchanged.

## 8. Decision and exact approval request

**NOT READY FOR PHASE 2 EXECUTION.** Locally prepared and reviewable, but no live control/IAM validation exists, the official local CLI is unavailable, and the cloud build/runtime/IAM/cleanup gates remain unexercised. An approval does not waive failed preflight/cap checks or authorize a second attempt.

Requested later approval: use the existing project `aura-rehearsal-20261011` / `1087494190017` under No organization/no folder, as `mirathfan@gmail.com`, for one attended 60-minute run. Link only this project to `01B4D2-62CAD1-5848FD`; install the two target-only budgets/cap and one-day default log retention; enable only the missing APIs listed in §3; create the two named SAs and scoped bindings, one named source bucket, one named artifact repository and at most one reviewed provider-managed staging/log bucket; upload only the four-file canary archive; attempt one private deployment/build with the exact bounds; perform one anonymous denial check plus 20 authenticated synthetic requests; inspect costs; then delete the approved disposable canary resources and unlink project billing after verified teardown. Include later target-budget cleanup after delayed-charge review. No public access, production data, paid AI, Firebase backend, extra deployment, GitHub, EAS or TestFlight action.

**Explicit approval is required before the billing link—the first cloud mutation. No cloud action will follow this preparation without it. External TestFlight: NO-GO.**
