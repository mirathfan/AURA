# AURA rehearsal — finalized safeguards and creation approval plan

**Latest — Phase 2C read-only review, November 11:** [current findings and recovery plan](PHASE2C_CANARY_RECOVERY_2026-11-11.md), [inert revised configuration](deployment/canary-recovery.proposed.json). The two broad grants were removed with approval and remain absent; five bindings and 31 APIs are unchanged, billing disabled. Cap disappearance is not causally resolved. Preserve the existing alert budget and November 12/14 cost reviews. The revised proposal permits requesting a separate safeguards-only observation/recovery cycle; it does not authorize billing linkage now or full deployment. No new API activation or broad-role restoration is proposed. Older approval-pending IAM and blanket API-enable instructions below are superseded. **Full canary NOT READY; external beta NO-GO.**

**November 11 latest controls — P1-10C read-only:** [Remediation findings](CLOUD_IAM_API_REMEDIATION_2026-11-11.md). Billing remains unlinked; no workloads identified or cloud mutations performed. The $25 alert budget (`5f917c50-235c-4cb5-bb70-076c77aa8ba5`) remains. The $1 Run cap (`062874a3-795e-402e-bec2-6997434fba45`) was Configured during [Phase 2B](PRIVATE_HEALTH_CANARY_EXECUTION_2026-11-11.md), but is now absent from the list and direct lookup returns not found. Its precise deletion event is unverified. Preserve the surviving alert through November 12/14, 15:11 UTC delayed-cost reviews; any future billed run needs a newly verified cap before provisioning. Two broad IAM binding removals are ready for explicit approval; API disablement and preventive policy installation remain blocked. No $25 hard cap, email-delivery proof or cloud invocation result is claimed. Older approval/proposal statements below are historical. **NOT READY to resume canary execution; external beta NO-GO.**

**November 5, 2026 — Phase 2A supersedes the earlier status/proposal below.** Phase 1C verified project `aura-rehearsal-20261011` / `1087494190017` ACTIVE, No organization/no folder, **billing unlinked**, no identified workloads on November 4. No fresh cloud read or mutation was performed in Phase 2A. The separate health-only Cloud Run function, private IAM configuration, bounded request controller, revised controls and cleanup commands are in [Private health canary readiness](PRIVATE_HEALTH_CANARY_2026-11-05.md). Direct Cloud Run replaces the older full-backend/Functions-API canary proposal; the $1 Functions cap is not applicable to this lane. Local lint links are repaired without application or root lockfile changes. **Phase 2 execution remains unapproved / NOT READY; external beta NO-GO.** Older creation and billing-status statements below are historical, not current instructions.

**Phase A execution — November 4: STOPPED ON UNEXPECTED BILLING.** The one authorized creation attempt succeeded: `aura-rehearsal-20261011`, number **1087494190017**, No organization in console. The project is unexpectedly listed as linked to **01B4D2-62CAD1-5848FD** despite no separate billing-link action. Per the user's stop instruction, no unlink/correction or further IAM/resource inspection was performed. Raw lifecycle state and absence of billable resources are not certified. [Bootstrap evidence and remaining requirements](REHEARSAL_BOOTSTRAP_2026-11-04.md). **Phase 2 NOT APPROVED / NOT READY; external beta NO-GO.** This execution result supersedes earlier “project not created/creation pending” status below.

**November 4, 2026. Ready for review/approval of empty, unbilled bootstrap only. NOT READY for billable provisioning or full backend rehearsal. External beta remains NO-GO.** No project, budget, API, IAM binding, service account or other cloud resource was created or changed.

## Authorization now settled

Mir Athfan Ali explicitly confirmed personal billing and on-call responsibility under **`mirathfan@gmail.com`**, **No organization / no folder**, and a **$25 total intended operational budget**, acknowledging that it is not a hard cap. Do not ask for those confirmations again. The user authorized finalizing controls and permissions, but explicitly withheld project creation and billable provisioning until final approval.

The older [authorization preflight](REHEARSAL_AUTHORIZATION_PREFLIGHT_2026-10-11.md) remains historical evidence; this document supersedes its outstanding ownership confirmation and initial 57-function/120-build spending proposal. [Exact proposed configuration](deployment/rehearsal.safeguards.proposed.json) is inert JSON: not a deployed policy, controller, billing cap, or authorization. `parent: null` means No organization/no folder; `projectNumber: null` means not yet observed.

## Fresh read-only evidence

Authenticated Google Cloud console inspection on November 4 confirmed:

- Account **01B4D2-62CAD1-5848FD**, “My Billing Account,” **Direct** account type. **Billing Account Administrator (1)** expands to **mirathfan@gmail.com**. This refreshes role evidence; the detailed effective-permission API test remains the October 11 result.
- Only the existing **$5/month production budget** was listed. Project scope AURA, all services (1781 now displayed), savings included, actual alerts **$2.50/$4.50/$5**, **Alerts only / Not applicable** cap status. Billing-admin/user email checked; project-owner, Monitoring-channel and Pub/Sub options unchecked. Displayed November spend $0.00 is delayed account UI evidence, not a cap or a rehearsal estimate. Edit view was read and cancelled without changes.
- Billing-linked projects list showed production and “My First Project”; no rehearsal project. This is not a global existence search.
- New Project form displayed **No organization** for both organization/parent, **10 projects remaining**, and an enabled Create control. No creation submitted. ID availability/reservation still requires an authorized creation attempt; do not silently pick another ID.
- No payment details, production Firebase resources, live user content or secret values were inspected. No alert email was sent. Mailbox receipt is still unverified.

`gcloud` and global `firebase` were unavailable on the current PATH; a bounded check of usual SDK locations did not find gcloud. No SDK was installed, CLI configuration changed, credential file inspected or token extracted to work around this. The browser supplied the current metadata above. Restore an approved official CLI locally and verify `mirathfan@gmail.com` before any future command execution, or use the console for the explicitly approved empty-project action. No fresh CLI `testIamPermissions` success is claimed.

Evidence notes and repository preservation hashes: [rehearsal-safeguards-2026-11-04](../../qa-artifacts/rehearsal-safeguards-2026-11-04/). Google documentation was refreshed separately; source was inspected locally. Current `health` is at `functions/src/index.ts:138`: a timestamp/ok response through the existing tracing wrapper. This is a candidate for a later restricted canary, not proof that its full module initialization/dependency closure makes no network calls.

## Lowest-risk configuration

### A. Empty unbilled project — only approval requested now

Create exactly **`aura-rehearsal-20261011`**, display name **AURA isolated rehearsal**, under **No organization / no folder**, as the confirmed operator. Keep it **unlinked from billing**, without Firebase registration, manually enabled APIs, new role grants, service accounts, budgets, workloads, test users or data. Inspect platform-created defaults; do not assume creation adds no metadata/default services.

No billable workloads are requested in this stage. The only expected charge exposure from this planned stage is none because billing stays unlinked; verify that postcondition and stop if the provider returns unexpected billing/configuration. Do not auto-correct an unexpected project by linking, unlinking, deleting or changing IAM without approval.

Approval authorizes one creation attempt, not a retry under a different ID. If the ID is unavailable or a creation result is ambiguous, inspect read-only and report. An already-existing project must not be adopted on its name alone. Global name availability and creator effective IAM cannot be certified before this step.

### B. One private health canary — future separate approval

Replace the earlier first deployment of 57 functions/two passes with **one** `aura-rehearsal-health` HTTP function, Node 22, entry point `health`, **us-central1**, **one deployment attempt**, using the reviewed candidate dependency lock. This aims to measure build time, image size, native dependency startup and authenticated invocation. It does **not** validate consent, data deletion, indexing, Scheduler, Eventarc or Firebase client authentication.

No Firestore database, default Firebase bucket, Firebase registration, test web app, Auth users, media objects, indexes, secrets (even placeholders), schedules, events, task queues, AI requests, real OAuth, VPC/NAT, analytics/export sinks or production endpoints in this stage. Build source buckets, artifact storage and Google-managed service agents are unavoidable dependencies and must be included in its approval.

Before that separate approval, finish the restricted source archive and verify locally that only the health entry point is admitted, imports have no external-provider dispatch, no environment file/credential/production config is included, and no Firebase deployment discovers/creates all 57 exports. Use the Functions v2 single-entry deployment path with explicit options, not an unqualified `firebase deploy`. The existing packager prepares the **full candidate** and is **not** itself this restricted canary artifact. Do not upload it until that additional review succeeds.

The local request controller is also a pre-canary prerequisite: one fixed target verified from deployed metadata, at most 20 requests, concurrency 1, retries off, 15-second client timeout, one-hour deadline, no tokens in logs. It must reserve request count before dispatch, persist counts across restart, and reject a changed project/URL. It is not implemented by the proposal JSON. Fail closed if the artifact/controller or live settings cannot be verified; do not treat documentation as enforcement.

### C. Actual AURA integration — not approved by A or B

Only after the canary's measured costs and teardown are reconciled should the owner approve the actual database, guarded Storage, consent/deletion/indexing functions, identities, triggers and scheduled recovery. Keep the P1-10 resource/IAM inventory as an upper inventory, not an initial provisioning instruction. The full authenticated harness and no-provider failure-path tests remain required. Do not infer readiness for the full 57-function release from a health canary. No Expo, Xcode or application changes are part of these stages.

## Exact limits and who enforces them

All cloud settings below are proposed for B. None has been installed. “Operator/controller” is distinct from platform enforcement.

| Area | Final first-canary limit | Mechanism and limitation |
|---|---|---|
| Intended total / first-stage allocation | $25 total intended; **$5 planning allocation** for B, leaving $20 unallocated | Financial plan, not an enforced ceiling or authorization to spend the remainder |
| Runtime | 1 service; min 0, max 1, concurrency 1, 1 vCPU, **1024 MiB**, **15s** timeout; no public invoker | Explicit deployment settings, verified from resolved Functions and Run metadata. Max instances is not an absolute billing cap and may briefly exceed |
| Active workload | **20** total HTTP attempts including any failed/retried attempts; concurrency **1**, retries disabled | Persistent controller bound; no additional load or unauthenticated stress tests |
| Window | **60 attended minutes**; stop immediately if operator leaves; complete resource cleanup within **24 hours of billing link** | Operator deadline; no automatic resource-expiry guarantee |
| Builds | **1 attempt**, **1 concurrent build**; cancel at **15 minutes**; no automatic redeploy | Operator cancellation, not a certified Functions managed-build timeout. Capture actual machine type and billed duration |
| Scheduler/workers/queues | **0** schedules, event triggers and task queues | No unattended loops or automatic event retries exist in this stage |
| DB/Auth/app Storage | **0** databases, users and app-media objects | No data-plane grants or app storage to generate data charges |
| Build storage | At most **2** managed upload/source buckets, **1 GiB aggregate**; **1** regional artifact repository, **5 GiB** target | Audit actual build-created resources, include layers/versions/soft-deleted bytes. Byte targets are observed thresholds, not bucket hard quotas |
| Logs | `_Default` **1 day**, <=**50 MiB** ingestion target; `_Required` fixed **400 days** | Retention is configurable/enforced after setup; ingestion bound is not. No extra sink/paid export |
| Data transfer | Test payload/response bytes <=**1 MiB total**; all project network egress target <=**100 MiB** | Controller can bound its data, not managed build/container transfers; record those separately and stop on unexpected traffic |
| AI / secrets | **0 requests / 0 secret versions / 0 usable credentials** | No AI endpoint deployed, reviewed initialization; runtime has no secret or database access. No-provider claim still needs restricted artifact review |
| Owner checks | Every **5 minutes** during build/test and after teardown | Count builds/requests/resources first; billing is delayed and cannot be the only meter |

The `health` canary has deliberately retained AURA's potentially heavy dependency lock; actual build/memory requirements are not measured. If it fails, reaches a bound, needs a different machine or requests broader APIs/IAM, **stop**. A second attempt or larger resource setting is a new approval decision, not an automatic fix.

## Spending controls and residual exposure

Before B source upload, after separately approved billing linkage, create **three new budgets scoped only to the newly verified rehearsal project number**:

1. **aura-rehearsal-all-services**: monthly $25, all services, credits excluded. Actual alerts **$0.50/$1/$2/$5** (2%/4%/8%/20%), forecast alert **$2** (8%). Billing-admin/user and project-owner email enabled. No Pub/Sub automation or Monitoring channel required for this first attended stage.
2. **aura-rehearsal-run-cap**: monthly **$1**, service **152E-C115-5142** only.
3. **aura-rehearsal-functions-cap**: monthly **$1**, service **29E7-DA93-CA13** only. Reconcile gen2 SKUs so estimates do not double-count runtime charges.

Use the billing console; **Budget API enablement is excluded**. Do not modify the existing production budget. Verify cap status **Configured**, project/service scope and owner notification configuration before deploying. If $1 is rejected by the current service/account or cap setup is unavailable, stop and report; no silent increase, alert-only substitution or cap lift. Notification delivery remains unverified until an owner-observed authorized delivery; console monitoring is mandatory and unattended execution is prohibited.

Current Google documentation supports one-project/one-service monthly caps for Run and Functions. They can pause new usage after a threshold but do not guarantee a dollar ceiling: enforcement is delayed, in-flight charges continue and persistent costs remain. Caps reset each month. Build, Artifact Registry, Storage, database, event, logging and separate network SKUs are outside those two caps. [Spend-cap scope and limitations](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps).

**Residual financial exposure has no verified finite maximum of $25.** Late charges, managed build behavior, image/source retention, request amplification during compromise/misconfiguration and incomplete cleanup can exceed the intended budget. Private invocation and a runtime with no data roles reduce exposure; they do not make billing mathematically bounded. A leaked human/bootstrap credential could also bypass the plan. Do not leave that credential in a controller or give the runtime Owner/Editor.

The operational **stop threshold is $2 actual or forecast aggregate cost**, any cap activation, any count/byte/time bound, unexpected resource/API/region, any provider request or unknown principal. This leaves headroom within the $5 canary allocation and $25 intended total, but it is not a guarantee that late charges fit that headroom.

Planning arithmetic only: a 15-minute e2-standard-2 build at $0.006/minute is $0.09; 20 x 15-second requests represent at most 300 requested handler-seconds under nominal timeouts, excluding startup/platform overhead. Neither bounds total billing. Native packages may exceed those assumptions; stop on canary evidence rather than extrapolating the previous $5–$15 full-rehearsal estimate. [Build pricing](https://cloud.google.com/build/pricing). Run maximum-instance settings may be briefly exceeded. [Run instance-limit behavior](https://docs.cloud.google.com/run/docs/configuring/max-instances). Retention does not bound log ingestion; `_Required` has fixed retention. [Logging quotas](https://docs.cloud.google.com/logging/quotas).

### Stop, cleanup and follow-up

Stop the controller, cancel the single build if active, withdraw the named invoker binding and delete the approved canary function/service under B cleanup authority. Confirm no active instances, tasks, schedules or events. Delete only the approved rehearsal images/source objects and empty repositories/buckets, including retained generations as permitted by their actual policy. Function deletion does not remove all source storage. Record byte counts and resource inventory before and after; keep redacted logs locally. [Managed build/source resources](https://docs.cloud.google.com/functions/docs/building).

If a service cap blocks worker execution there are no accepted user jobs in B, so there is no reason to lift it for tests. Use the approved cleanup administrator for teardown; report any cap-related control-plane failure. No automatic billing unlink or cap lift. Confirm irreversible project deletion separately when applicable. Recheck delayed costs at **24 and 72 hours**; monthly resets must not revive leftover resources. These are owner follow-up requirements, **not an installed monitor or scheduled automation**. Report inability to complete cleanup immediately; the owner remains on call until the chargeable-resource inventory is clear.

## Scoped permissions — exact first-stage boundaries

**A:** creator is the confirmed human, under No organization. No additional role grants requested. Read project identity/IAM/billing; inspect the creator binding generated by Google. `resourcemanager.projects.create` at a parent is relevant where a real organization/folder exists; do not grant Project Creator on production or invent an organization for this project.

**B:** provision only after separate approval of named resources and bindings:

| Principal | Binding / resource scope | Excluded privileges |
|---|---|---|
| Human billing owner | Existing Billing Admin on 01B4D2-62CAD1-5848FD; target-side billing assignment needed after creation; three target budgets only | No modification of other budgets/accounts |
| Human bootstrap/deployer | New-project API activation, SA create/get/setIamPolicy; Functions create/get/list/update/delete + source upload/operation reads; Run service get/getIamPolicy/setIamPolicy/delete; source bucket and repository bootstrap, build get/list/cancel, log settings | No new production or organization grants, Deny Admin or blanket automation Owner/Editor. Use initial creator authority interactively only; do not add a second blanket grant |
| `aura-canary-runtime@aura-rehearsal-20261011.iam.gserviceaccount.com` | **No project/data/secret/billing roles**; attach as the one function's runtime identity. Stdout logs are platform collected | No Firestore, Storage, Auth, OpenAI/Apple secret access, invoker or actAs |
| `aura-canary-build@aura-rehearsal-20261011.iam.gserviceaccount.com` | `roles/logging.logWriter` on rehearsal project; `roles/storage.objectViewer` on the actual two source/upload buckets; `roles/artifactregistry.writer` on the single repository; required service usage on rehearsal only | No runtime data, secret, billing or project-IAM access; no downloaded keys |
| Human deployer acting as SAs | `roles/iam.serviceAccountUser` **only on the two named canary SAs** when needed | No project-wide actAs or arbitrary service-account impersonation |
| Invoker | `user:mirathfan@gmail.com`, `roles/run.invoker` **on the one resolved Run service** | No `allUsers` or `allAuthenticatedUsers`; no extra invoker SA/key necessary |
| Google-managed agents | Correct Functions/Run/Build service-agent roles on their actual target-generated identities, inspect effective bindings | No event/Scheduler/Storage-Firebase agents needed by the requested health workload; stop on unexpected provisioning dependency |
| Cleanup operator | Same human on target only; function/service deletion, build cancellation, source/object/repository deletion, selected SA cleanup; project deletion only with required final confirmation | Never use runtime identity for administrative cleanup |

After A, inspect actual creator permissions and formulate target-scoped grants against the **observed** number and resource names. After B setup, verify effective policies and denied anonymous invocation before any admitted test requests. The principal/role specification is verified as a design; there is no new target on which to certify effective IAM now. The reviewed build-service-account permissions may need adjustment for actual managed-build behavior; **stop instead of granting broad Editor** if the narrow mapping fails. [Build identity requirements](https://docs.cloud.google.com/functions/docs/building), [runtime identity selection](https://docs.cloud.google.com/functions/docs/securing/function-identity).

No Scheduler, Eventarc or IAM Deny permissions are requested for B. Those remain future integration-stage permissions from the previous inventory; removal from the first stage is not a claim that real recovery/drain tests have passed.

## Exact creation plan for final approval

**Only A is ready for approval now.** The existing ownership/budget confirmation is recorded; this request concerns the still-withheld creation action.

> Approve one attempt to create `aura-rehearsal-20261011` (“AURA isolated rehearsal”) as `mirathfan@gmail.com`, under No organization/no folder, with billing unlinked. Then perform read-only verification of project ID, number, parent, creator IAM and billing state, and stop. No billing link, API activation, role grant, Firebase registration, service account, budget, deployment, test account or paid workload is included. Stop on an unavailable ID, ambiguous result or unexpected configuration; do not select a replacement automatically.

The exact proposed commands, **not run**, after the official CLI/account are available:

```sh
# Read identity; require exactly the confirmed active account before proceeding.
gcloud auth list --filter=status:ACTIVE --format='value(account)'
# MUTATION — only after approval of A; no organization/folder flags.
gcloud projects create aura-rehearsal-20261011 --name='AURA isolated rehearsal' --account=mirathfan@gmail.com
# Read-only postconditions; no linking or provisioning follows.
gcloud projects describe aura-rehearsal-20261011 --account=mirathfan@gmail.com --format='json(projectId,projectNumber,parent,lifecycleState)'
gcloud projects get-ancestors aura-rehearsal-20261011 --account=mirathfan@gmail.com --format=json
gcloud projects get-iam-policy aura-rehearsal-20261011 --account=mirathfan@gmail.com --format=json
gcloud billing projects describe aura-rehearsal-20261011 --account=mirathfan@gmail.com --format=json
```

Expected: exact ID, ACTIVE, number recorded, no parent, creator binding reviewed, billing disabled/unlinked. Save only sanitized metadata. Do not change gcloud/Firebase defaults or print tokens. Failure/unknown billing state means **stop**, not permission to continue.

The subsequent B approval must explicitly list: billing link to the confirmed account; the three budgets; Functions/Run/Build/Artifact Registry/Storage/IAM/Service Usage/Resource Manager/Logging/Monitoring APIs and unavoidable managed dependencies; two named SAs and exact bindings; at most two managed source buckets/one repository; one private function with the limits above; one source upload/build attempt and 20 bounded invocations; cleanup of those disposable resources. Do not enable Firebase, Firestore, Auth, Scheduler, Eventarc, Tasks, Secrets or Budget API as a convenience. Any provider-required extra API/resource is a scope-change stop. B is not an approved executable block today.

## Local validation and preserved state

- `node --test scripts/test-cloud-rehearsal-preparation.cjs`: **3/3 PASS**. Covers the existing packager's target rejection, overwrite rejection and environment/native-data exclusions; not a cloud harness or new restricted canary validation.
- Proposed JSON parsed and fixed-target, unapproved/unbilled Phase A, one-build/function, zero data/AI/background resources, empty runtime-role set and budget-allocation invariants passed. This is proposal consistency only.
- `npm run lint`: **could not launch Expo (exit 127)** because `node_modules/.bin` is absent. Direct Expo invocation reached ESLint but its executable link was also absent. No installation was performed.
- Direct ESLint over Expo's source-defined default scope (`src app components`, JS/JSX/TS/TSX, no fixes/cache) completed with **2 unresolved-import errors and 9 warnings**. Both errors are `expo-vision-bg` in `src/bg/removeBackground.ts:11` and `src/lib/detectBrandLogo.ts:5`. `package.json` declares `file:modules/expo-vision-bg`; that module directory exists but its `node_modules` link is missing. The affected source/package hashes match the task baseline. Restore local dependency/bin links before claiming client lint is green; do not infer an application regression or change background-removal implementation from this environment failure.
- An initial broader direct ESLint `.` run was stopped when the Expo CLI source established its narrower default scope; it is not counted as validation.
- `git diff --check`: **PASS**. Baseline SHA-256 check of **837 files**: four existing documentation files changed, two documentation/configuration files added, no files removed; all application/backend/native/source and unrelated file hashes preserved. No backend code changed, so backend/client/emulator suites were not rerun.

Files changed: this new report; `docs/deployment/rehearsal.safeguards.proposed.json`; authorization-preflight, cloud-rehearsal, release-integration and TestFlight-readiness status updates. No cloud deployment, runtime evidence, EAS build, push, submission or production-data operation.

## Verification and decision

- **PASS:** ownership/parent confirmation recorded; current billing administrator, budget settings, No-organization form and 10 remaining projects observed; no cloud mutation.
- **PASS as design only:** minimal resource/IAM boundaries, exact budgets, early stop thresholds, cleanup, residual financial exposure and staged approval text finalized.
- **PENDING:** actual target ID availability and effective IAM; configured budget caps and notification receipt; canary artifact/dispatch controller; measured build/egress costs and resource cleanup.
- **NOT RUN:** cloud deploy, paid workload, authenticated provider flow, real AURA integration or native validation.

The safest next action is **approval of A only**, with post-creation inspection before the billable stage. Do not repeat the resolved ownership confirmation or describe hypothetical cloud controls as active. **NOT READY for billable provisioning; full release deployment remains blocked; external beta NO-GO.**
