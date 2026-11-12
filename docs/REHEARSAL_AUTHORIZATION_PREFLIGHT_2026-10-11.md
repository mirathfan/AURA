# Current authorization — November 4, 2026

**Phase A execution — November 4: STOPPED ON UNEXPECTED BILLING.** The one authorized creation attempt succeeded: `aura-rehearsal-20261011`, number **1087494190017**, No organization in console. The project is unexpectedly listed as linked to **01B4D2-62CAD1-5848FD** despite no separate billing-link action. Per the user's stop instruction, no unlink/correction or further IAM/resource inspection was performed. Raw lifecycle state and absence of billable resources are not certified. [Bootstrap evidence and remaining requirements](REHEARSAL_BOOTSTRAP_2026-11-04.md). **Phase 2 NOT APPROVED / NOT READY; external beta NO-GO.** This execution result supersedes earlier “project not created/creation pending” status below.

**Billing/on-call ownership and No organization/no folder are now explicitly CONFIRMED by Mir Athfan Ali under `mirathfan@gmail.com`.** The $25 intended total budget is confirmed with residual overage risk acknowledged. Do not request those confirmations again. **Project creation, billing linkage and provisioning remain unapproved.**

**November 4 local validation:** packaging tests 3/3 and proposal consistency/whitespace checks pass. Standard lint is blocked by absent local executable links; direct source-scope ESLint reports two unresolved `expo-vision-bg` imports plus nine warnings (local package directory exists, installed link missing). Application/dependency files were not modified. Historical passing lint below is not a fresh November 4 result. See [current safeguards report](REHEARSAL_SAFEGUARDS_2026-11-04.md#local-validation-and-preserved-state).

[Final safeguards and exact creation plan](REHEARSAL_SAFEGUARDS_2026-11-04.md) supersede the October 11 ownership blocker and first-stage spending scope below. Current console inspection reconfirmed Billing Administrator, the production-only $5 alerts budget, and 10 No-organization project slots. Lowest-risk recommendation: approve one empty **unbilled** project and read-only identity/IAM/billing checks, then stop. A later separately approved **one-function, one-build private health canary** replaces the full backend as the first paid workload; no DB, Auth, media, AI, triggers or schedules. Proposed limits are in [the inert configuration](deployment/rehearsal.safeguards.proposed.json).

**Ready for review/approval of empty unbilled bootstrap only; NOT READY for billable provisioning. External beta NO-GO.** Cloud caps/IAM cannot be certified on a nonexistent target; notification delivery and restricted artifact/controller checks remain prerequisites for the paid stage. No cloud changes made.

---

## Historical October 11 preflight (superseded where noted above)

# P1-10B — Final spending and permission verification

**NOT READY FOR PROVISIONING. External AURA beta: NO-GO.** Read-only checks close the existing-budget inspection gap and establish the intended **No organization / no folder** hierarchy. They do not establish an enforced $25 total ceiling. No rehearsal spending controls exist yet; the bounded workload controller and deployment overrides are not implemented or verified. Mir Athfan Ali's final billing/on-call responsibility confirmation and explicit resource-creation approval are still required.

This October 11, 2026 follow-up supersedes the earlier authorization findings in this file, particularly “budget details unknown” and the unconditional Deny Admin prerequisite. The user approved rehearsal in principle only and expressly prohibited creation, API activation, budget/billing/IAM changes and deployment during this task. All cloud interactions remained reads, including `testIamPermissions`. No private user content, payment instrument, secret value or provider credential was accessed. Local changes are documentation only.

Evidence: [P1-10B metadata, IAM role definitions and console observations](../../qa-artifacts/cloud-rehearsal-2026-10-11/p110b/); [preceding authorization evidence](../../qa-artifacts/cloud-rehearsal-2026-10-11/authorization-preflight/). Fresh API permission reads begin at 21:28 UTC; console inspection used a dedicated Chrome window, read an existing budget without saving, and discarded the unsubmitted project form. Source HEAD remains `06ece001c69cb6a84787cebddd521f883ffccb66` plus the preserved working tree.

## 1. Confirmed billing controls

Billing account **`01B4D2-62CAD1-5848FD`**, “My Billing Account,” is open, USD. Operator **`mirathfan@gmail.com`** has unconditional `roles/billing.admin`; effective permissions include `billing.resourceAssociations.create`, budget list/get/create/update/delete and `billing.budgets.configureSpendCap`. This establishes administrative authority, not personal acceptance of charges.

The authenticated billing console showed one budget row. Its details are now verified:

| Setting | Observed value |
|---|---|
| Name / ID | `Firebase Project closet-app-57146` / `5a998cbc-87a9-41bf-a557-db7e3f49586c` |
| Period / amount | Monthly / **USD $5.00**, specified amount |
| Project scope | **AURA (`closet-app-57146`) only**; not the proposed rehearsal |
| Services / savings | All services (1778 displayed); savings programs and other savings included |
| Enforcement | **Alerts only**; spend-cap status **Not applicable** |
| Thresholds | **Actual spend** 50% / 90% / 100% = **$2.50 / $4.50 / $5.00**; no forecast threshold |
| Recipients | Billing administrators and users checked; project owners unchecked |
| Other delivery | Monitoring email channels unchecked; Pub/Sub topic unchecked |
| Known recipient | Billing IAM identifies `mirathfan@gmail.com` as administrator; role-based destination, not a tested mailbox receipt |
| Snapshot | $0.00 of $5.00, including -$0.01 savings; delayed display, not a live spend guarantee |

The production Monitoring notification-channel list returned `{}`. This does not negate billing-role email delivery. No alert, verification email or mailbox test was sent. `support@getaura.app` is not established as a budget recipient.

Budget REST listing still returns **403 SERVICE_DISABLED**. Service Usage confirms `billingbudgets.googleapis.com` is disabled in the existing production consumer project. This is not missing budget IAM and no longer prevents inspection: the authenticated console exposed the settings. The disabled spend-cap option in the existing alerts-only budget editor is not proof that the account cannot create a separate eligible cap. No API was enabled; the production budget was not changed.

## 2. Spend-cap coverage and remaining gaps

Google currently documents caps for Cloud Run and Cloud Run functions, each restricted to **one project, one eligible service, monthly**. They pause new service usage, but delayed enforcement and in-flight work can produce overages; persistent resource costs continue. Caps reset monthly. Existing alerts-only budgets cannot be converted in place. Cap notifications go to billing administrators/project owners at 50%, 80%, 100%. Actual creation/Configured status on the proposed target remains untested. [Google spend-cap documentation](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps).

| Rehearsal charge | Coverage finding |
|---|---|
| Cloud Run | Eligible service `152E-C115-5142`; proposal: separate **$5/month** target-project cap |
| Cloud Run functions | Eligible service `29E7-DA93-CA13`; proposal: separate **$5/month** target-project cap; inspect gen2 SKU attribution so runtime cost is not double-counted in estimates |
| Cloud Build / Artifact Registry | Not on the documented eligible-service list; build time, image storage and transfer require separate bounds |
| Firestore / Cloud Storage | Not covered by the above caps; reads, index reads, retries, writes/deletes, storage, soft-deleted generations and transfers remain chargeable |
| Scheduler / Eventarc / Pub/Sub | Separate delivery, job and retention charges are not covered by those runtime caps |
| Logging / Secret Manager / other network SKUs | Separate charges are not covered; runtime-service cap does not imply a VPC or whole-project egress cap |
| Paid AI | Prohibited entirely. No OpenAI, Gemini, Vertex, retailer/search subscription or production provider credentials/resources |

The uncovered-service conclusion follows from comparing the rehearsal inventory with the documented eligible-service list. No account-wide, multi-service $25 hard stop was found. Standard budget alerts do not stop consumption. [Budget alert behavior](https://docs.cloud.google.com/billing/docs/how-to/budgets).

**Required proposal, not installed:** new rehearsal-only **$25 all-services monthly alert budget**, excluding credits for conservative tracking, actual alerts at $5/$10/$20 (20%/40%/80%) and a forecast alert at $10 (40%). Keep billing-role recipients and explicitly verify the on-call owner can receive/monitor them. Add the two separate $5 service caps above without touching the production budget. Use the console or, only with separate approval, enable the Budget API in the new project. No production API activation is needed.

**Financial conclusion:** these protections reduce exposure but do not enforce a $25 total bill. Full 57-function/two-deployment rehearsal is not yet adequately bounded: managed build durations/image sizes, retry amplification, charge latency and cleanup overhead are unmeasured. Do not call the prior $5–$15 estimate a verified upper bound. If an absolute non-exceedable $25 ceiling is required, this pay-as-you-go design does not meet it.

## 3. Project identity, availability and creation eligibility

| Check | Result and limit |
|---|---|
| Production parent | Resource Manager v1/v3 and earlier ancestor listing contain no organization/folder; fresh v3 still has no `parent` |
| Proposed parent | **No organization / no folder**. Creation form independently displayed both Organization and Parent resource as **No organization**. Production `closet-app-57146` is not a parent |
| Other organization | Accessible `mirathfan-org` (`92728903569`) is not production's ancestor and must not be selected |
| Account quota | New Project form reports **10 projects remaining**; create control enabled. This supports present eligibility, not successful creation certification |
| ID lookup | Prior `projects describe` returned permission denied “or may not exist”; fresh exact-ID project list returned `[]`. Neither excludes an inaccessible or formerly used global ID |
| Form validation | Entered `aura-rehearsal-20261011`, left the field, observed no syntax error; no explicit “available”/uniqueness confirmation. Closed the dedicated window without pressing Create |
| Billing association | Account-side `billing.resourceAssociations.create` verified. Target-side `resourcemanager.projects.createBillingAssignment` must be checked after authorized creation; it is only verified on existing production today |
| Final checks | Global ID reservation, creation-time quota/policy validation, actual creator bindings and new-project effective IAM cannot be certified without an authorized creation attempt |

Project IDs are global and previously used IDs cannot be reused; No-organization creation uses the individual's project quota. A production Owner grant does not confer ownership of a nonexistent target. Do not test creation by making a temporary project. [Project creation and ID constraints](https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects).

The smallest future creation command would omit both parent flags and stop before billing association:

```sh
# PROPOSAL ONLY — NOT EXECUTED OR AUTHORIZED
# Run only after explicit Phase A approval below.
gcloud projects create aura-rehearsal-20261011 --name='AURA isolated rehearsal'
# Then read identity, parent, IAM and billing state; stop. No automatic fallback ID.
```

A failure or name conflict requires reporting it; do not silently reuse another project. New-target permission uncertainty is a staged bootstrap verification point, not a demand to obtain permissions on a nonexistent project.

## 4. Minimum scoped IAM plan

Read 24 predefined role definitions through IAM GET requests; saved them in the evidence directory. The table lists operational capabilities and role mappings, **not a request to grant every broad role**. Prefer a reviewed custom subset or temporary bootstrap grant where a predefined role includes unnecessary privileges. No role or service account was created. Ordinary deployment does not require IAM Deny Admin.

| Phase / principal | Required permission surface | Narrow scope / mapping |
|---|---|---|
| Project creator | Project creation eligibility; `resourcemanager.projects.create` where parent IAM applies | No-organization user quota, not a grant on production; Project Creator is an organization/folder mapping when such a parent exists |
| Billing linker / owner | `billing.resourceAssociations.create`; target `resourcemanager.projects.createBillingAssignment` | Billing Account User + target Project Billing Manager suffice for association; current human already Billing Admin. Never grant billing roles to runtime |
| Bootstrap configurator | `serviceusage.services.get/list/enable/use`, Firebase project get/update and client create/get, Auth config get/update; project get/getIamPolicy/setIamPolicy | Only new project, temporary bootstrap. Service Usage Admin and selected Firebase/project-IAM capabilities; no need for Auth `getSecret/getHashConfig`, inherited Editor or production grants |
| Functions deployer | Functions get/list/create/update/delete, sourceCodeSet, operation/build reads, `cloudfunctions.functions.setIamPolicy`, `run.services.setIamPolicy`; `iam.serviceAccounts.actAs` | Functions Developer plus missing policy permissions, or temporary Functions Admin; actAs only named build/runtime/event SAs. Do not set public invokers |
| Firestore bootstrap/index/rules | `datastore.databases.create/getMetadata/update`, index get/list/create/update/delete; `firebaserules.rulesets.create/get/list`, releases get/list/create/update/delete | Database bootstrap subset; Datastore Index Admin; Rules Admin on new project. Index deletion only disposable rehearsal teardown, never an implicit deploy deletion |
| Storage bootstrap | Bucket create/get/update, get/set IAM; `firebasestorage.defaultBucket.create/get` and `firebasestorage.buckets.addFirebase/get`; object get/list/create/delete for approved cleanup | Project permission needed for initial bucket creation; then bucket-scoped lifecycle/object access. Do not leave Storage Admin on runtime |
| Scheduler / Eventarc setup | Scheduler job create/get/list/update/pause/resume/run/delete; Eventarc trigger create/get/list/update/delete and operations reads | Scheduler Admin/Eventarc Admin or subsets on target; event receiver only on event identity; Run Invoker on corresponding target services |
| SA bootstrap | `iam.serviceAccounts.create/get/list/getIamPolicy/setIamPolicy/delete`, project IAM for bindings | Service Account Admin + target project policy capability; no SA key create/download. Token impersonation, if selected, only named rehearsal identities, never all SAs |
| Runtime identity | Firestore transaction/entity read/write; `firebaseauth.users.get/delete`; Storage objects get/list/create/delete; `secretmanager.versions.access` | Dedicated runtime SA: Datastore User on target, custom Auth get/delete, Object Admin on exact bucket, Secret Accessor on named inert secrets only. No project Owner/Editor, IAM or billing rights |
| Test controller | Synthetic Auth create/get/delete; own-project fixture/control-document reads/writes and object operations; logs/metrics read | Dedicated identity and run/UID allowlist; short-lived credentials; no token/payload logging, no email sending or real provider access |
| Build/artifact/secret bootstrap | `cloudbuild.builds.create/get/list/update`, `artifactregistry.repositories.create/get/update/setIamPolicy`, `secretmanager.secrets.create/get/setIamPolicy`, `secretmanager.versions.add` | Target-only source/artifact repositories and two named inert secrets; no secret-value reads from production, no optional scanning. Use subset bootstrap permissions; ordinary runtime cannot create secrets or images |
| Build identity | Build source read, image push, log write; builder permissions | Inspect actual build SA; source-bucket reader, target Artifact Registry writer and log writer. Do not assume Compute SA has Editor |
| Google-managed agents | Cloud Functions/Run/Build/Eventarc/PubSub/Scheduler service-agent roles on their real agents; GCS event publishing; Storage rules Firestore access | Target only. GCS SA needs Pub/Sub Publisher for Storage events where absent; Firebase Storage SA needs `roles/firebaserules.firestoreServiceAgent`. No service-agent role for humans/runtime |
| Budget / monitoring owner | Budget create/get/list/update/configureSpendCap; cost reads; monitoring alert/channel create/get/update; logging bucket retention update | Human at approved billing account; alerts scoped only new project. Logging Config Writer subset; no production budget change |
| Cleanup operator | Functions/Run/Scheduler/Eventarc delete/update, source/images/bucket objects delete, Auth user delete, database delete, secret versions/secrets delete, SA delete; project delete; optional billing-assignment delete | Target resources only; `resourcemanager.projects.delete` (Project Deleter), `resourcemanager.projects.deleteBillingAssignment` if needed. Deletion/recovery authority remains separate from workload runtime |

Use `[get/list/operations.get]` companions required by each API/CLI alongside mutations above. This is a capability inventory, not a tested custom-role JSON. Fresh production permission tests confirm many human administrative capabilities, but do not prove target deployment will succeed. After an approved unbilled bootstrap, inspect/test the exact target bindings and the resolved deployment/service-agent identities before workloads.

**Deny-policy correction:** `iam.denypolicies.create` was absent from the production permission result; it is **not a blocker for ordinary isolated provisioning**. Initial design uses private Run invocation, named Eventarc/Scheduler invokers and a separate test controller; no `allUsers`/`allAuthenticatedUsers`. For controlled old-worker replacement, stop producers/triggers, withdraw only named test invocation bindings, wait for in-flight completion and replace revisions. This tests a limited private-invoker lifecycle. It does **not** certify P1-09's production deny-policy drain or legacy resumable-upload safety. Retain that separate gate; if the owner later chooses the deny-policy experiment, separately approve and verify target-only Deny Admin. Do not silently claim equivalent coverage.

Runtime identity overrides/private-invoker configuration are still proposed. Inspect all 57 resolved exports and actual IAM after deployment, including service-agent grants. [Functions deployment IAM](https://docs.cloud.google.com/functions/docs/reference/iam/roles), [Storage rules service agent](https://firebase.google.com/docs/rules/manage-deploy).

## 5. Exact proposed cost and workload limits

All values below are **proposed**, not installed controls. “Controller” means an authenticated, run-scoped harness that still needs implementation/review; it must count before dispatch, terminate at the first bound and reject the wrong project ID/number/bucket. Operator observation alone is not that controller. No quota increases, free-tier assumptions, commitments or paid AI are included.

| Resource / activity | Proposed bound | Enforcement classification / gap |
|---|---|---|
| Window | At most **48 hours** from billing link to cleanup; **6 attended active hours** total; owner checks every **5 minutes** while active | Operator/controller deadline; no cloud TTL installed; retain teardown reservation |
| Functions / Run | All **57** exports: minInstances **0**, maxInstances **1**, concurrency **1**, **1 vCPU**, existing memory <=**1 GiB**, timeouts <=**540s**; no new timeout increases | Source/runtime configuration, not project-dollar cap. Inspect explicit overrides. Max instances can briefly exceed during platform events/rollouts |
| Admission / events | At most **500** controller calls, **2** controller requests concurrently, **2,000** total observed function executions incl. event/retry workers; stop on **3 repeats** without progress for one job | Controller hard bound for its own dispatch only; service metric lag and automatic event deliveries prevent hard total invocation bound |
| Scheduler | Exactly **2** jobs; recovery retains 5-minute cadence, at most **72** scheduled recovery ticks during 6 active hours; **2** draft-cleanup executions; **4** controlled manual recovery retries | Pause outside attended windows; include retries in 2,000 execution ceiling. Scheduler pause does not cancel running work or queued Eventarc events |
| Build | First canary at most **3 function builds**; full ceiling **120 builds**, **600 cumulative build-minutes**, at most **2** concurrent submissions; stop/cancel a build at **10 minutes** | Submission counter and operator build monitoring; Firebase-managed build timeout/parallelism not certified. Reconcile canary time/image size before approving full deploy |
| Artifacts / sources | <=**20 GiB** Artifact Registry images and <=**2 GiB** source archives; retained <=**7 days**, delete after evidence/teardown; no optional image scanning | Controller/metadata checks, not byte quota. Include all retained revisions, soft-deleted source objects and image layers; measure canary before extrapolation |
| Test users / items | **5** synthetic accounts; **20** items/account; **300** total created solid-color objects, each <=**1 MiB**; no real mailbox, photos or retailer imports | Seed generator and UID/run allowlist; account operations in memory, no outbound emails |
| Test bucket | <=**100 MiB** live objects; <=**300 MiB** including retired/soft-deleted generations | Generator/metadata bound; bucket has no configured aggregate-dollar/byte hard stop. Do not change production soft-delete policy |
| Firestore | <=**100,000** document reads, **10,000** additional billed index-entry reads, **20,000** writes, **20,000** deletes; <=**20 MiB** stored incl. indexes | Controller budgets + metrics/estimates; Admin workers, rule reads and transaction retries also count. Not a project-wide hard daily operation quota |
| Logging | `_Default` **7 days**; <=**100 MiB** ingest target, no extra export sink; retain minimal redacted evidence locally | Retention is enforceable once configured, ingestion target is not a hard cap. `_Required` remains fixed **400 days**, no added charge |
| Network | <=**1 GiB** runtime/test-data outbound; no VPC/NAT, cross-region copy, exports or external-provider requests | Harness payload accounting + metrics; not a network firewall or total billing quota. Managed build/artifact transfer must be measured separately |
| AI / secrets | **0 paid/external AI calls**, **0 valid provider credentials**, exactly **2 inert placeholder secrets**, no secret rotation | AI pause persisted before workers; no AI-positive cloud test. Placeholder credentials alone do not prevent an outbound request; exercise fail-closed paths only |

Source options should remain in a **rehearsal-only package overlay**, preserving production source and Beta 1 behavior. Current package does not have these global bounds. Verify manifest and configuration before deployment. [Firebase runtime options](https://firebase.google.com/docs/functions/manage-functions). Cloud Run maximums are not strict total-spend limits and may be exceeded temporarily. [Cloud Run maximum instances](https://docs.cloud.google.com/run/docs/configuring/max-instances).

Logging retention cannot be shortened for `_Required`; this corrects the earlier blanket “logs seven days” proposal. Shorter retention also does not avoid ingestion costs. [Logging quotas/retention](https://docs.cloud.google.com/logging/quotas), [Logging pricing](https://cloud.google.com/products/observability/pricing).

### Budget allocation and stop procedure

Reserve **$10** for the two runtime cap targets combined, **$4** for builds, **$1** for artifacts/source storage, **$1** for DB/Storage/events/Scheduler/secrets/logs/network, leaving **$9** contingency/teardown within the intended $25. These are planning allocations, not per-service enforced allowances. At the documented e2-standard-2 rate of $0.006/minute, 600 build-minutes would be $3.60; this estimate is valid only if that machine/rate is actually used. [Cloud Build pricing](https://cloud.google.com/build/pricing). Two Scheduler jobs cost $0.20/month before shared free allowances. [Scheduler pricing](https://cloud.google.com/scheduler/pricing). Neither estimate validates the full workload's cost.

Before a later full-deployment approval, canary measurements must show the remaining build count, retained image bytes and data/event demand fit those allocations including teardown and rate uncertainty. If not, reduce the approved scope or stop; do not consume the contingency as an implicit budget increase. Do not assume credits shared with production are available.

Proposed **manual stop** at the earliest of: $10 actual or forecast aggregate cost, any service cap enforcement, any workload bound, 3 repeated no-progress retries, unknown resource/region, cross-project reference, missing AI pause, unexpected public invoker or missing operator. While active, check meters every 5 minutes; compare controller counts with cloud request/build metrics and cost reports, recognizing reporting latency.

Stop controller submissions and builds, pause both schedules, prevent new fixture writes/uploads and disable test admission. Inspect/drain or remove offending rehearsal triggers to stop automatic retry loops. Preserve evidence and accepted synthetic deletion jobs; finish bounded cleanup using the isolated cleanup operator if runtime caps block workers. Do not lift a cap or disable billing just to make tests pass. Remove unused images/archives and all approved test resources; get the required final confirmation before irreversible project deletion. Confirm no schedules, queued deliveries, active services or retained chargeable objects remain and review delayed billing. Project deletion is not instant proof of zero future charges. If safety or spending bounds cannot be maintained, stop and escalate instead of continuing tests.

**No production connections:** package scan plus target assertions must reject `closet-app-57146` / `1043970871162`, production bucket/Auth/queue/secret/telemetry endpoints, and environment fallbacks. Use new dedicated identities with no production grants, synthetic fixtures only, no copied credentials. Private invocation needs a cloud harness capable of both Cloud Run IAM authorization and Firebase test-user authentication; the existing emulator runner must not be redirected to cloud.

## 6. Exact proposed approval and staged boundaries

**No action below is approved or executed.** This task ends before creation. To avoid asking for unlimited provisioning against unmeasured costs, split the next authorization:

### Phase A — identity-only bootstrap (smallest next request)

> I, Mir Athfan Ali, confirm billing/on-call responsibility under `mirathfan@gmail.com` for the intended $25 rehearsal budget and confirm the verified parent **No organization / no folder**. I authorize creation of exactly one empty, unbilled project, `aura-rehearsal-20261011`, and read-only verification of its ID, number, parent, creator IAM and billing state. Do not link billing, enable APIs, grant roles, add Firebase, create a budget, deploy or run workloads. Stop on an unavailable ID or unexpected configuration and report the result.

This is a proposed authorization text, not a claim that the owner accepted financial responsibility. ID reservation/creator IAM can then be verified without starting the billable rehearsal. No replacement project name is preapproved.

### Phase B — separate controls/canary approval, only after Phase A evidence

Request exact authorization for billing linkage to **01B4D2-62CAD1-5848FD**, the new-project-only service/IAM controls, the **three budgets** in §2, and the bounded **three-build canary** in §5. Require no production changes and no paid AI. List actual new project number and service-account/resource names before requesting grants. Specify whether Budget API activation **in rehearsal only** is included; console-only budget setup avoids needing it merely for reads. Do not bundle budget-cap lifts or Deny Admin into this approval.

Rehearsal resource ceiling for the later full approval remains: default Firestore **nam5**, one default Storage bucket **us-central1**, Functions/Run/build/artifacts **us-central1**, five Eventarc handlers in corresponding Firestore/bucket locations, two Scheduler jobs, eight index specs/nine field overrides, isolated email/password Auth/web app, two inert secrets, Logging/Monitoring and dedicated identities. Service allowlist is in [P1-10 §3](CLOUD_REHEARSAL_2026-10-11.md#3-concrete-rehearsal-creation-request): Firebase/Rules/Storage/Auth/API Keys, Firestore, Functions, Run, Build, Artifact Registry, Eventarc, Pub/Sub, Scheduler, Secret Manager, IAM/Credentials, Resource Manager, Service Usage, Logging/Monitoring; Budgets only as separately selected. No Tasks, paid AI, production OAuth apps, VPC/NAT or data exports.

Before any paid canary: inspect target IAM, establish owner monitoring and budget/cap Configured state, install/review package limits and controller, persist AI pause/maintenance/cleanup-off, assert private invokers and target-only resources. If supported cap setup cannot be verified, stop before deployment. The broader 57-function/two-deployment scope requires measured cost reconciliation and a separate continuation approval; it is not implied by Phase A or the approval in principle.

## 7. Remaining uncertainty and decision

| Gate | Status |
|---|---|
| No-organization hierarchy / billing administrative authority | **PASS read-only** |
| Existing budget amount, scope, alerts and delivery configuration | **PASS read-only**; alert receipt still unverified |
| Proposed ID global availability / completed creation | **UNKNOWN**; quota and syntax observed, no create attempt |
| Deny Admin for ordinary isolated rehearsal | **NOT REQUIRED**; separate production-drain experiment remains open |
| Scoped IAM design | **DOCUMENTED**; target effective bindings and CLI/service-agent sufficiency need staged verification |
| $25 total ceiling | **NOT ENFORCED / NOT YET ADEQUATELY BOUNDED** for full rehearsal |
| Rehearsal controls and authenticated workload harness | **NOT INSTALLED / NOT VERIFIED** |
| Final financial responsibility / creation approval | **NOT RECEIVED** |
| Deployment, cloud runtime, provider tests | **NOT RUN** |

Validation: metadata GET/list/IAM tests, authenticated console inspection and 24 IAM role-definition reads completed; Budget API's disabled-service response recorded without activation. `npm run lint` **PASS** (0 errors, 9 existing warnings); `git diff --check` **PASS**. SHA-256 comparison of **837** baseline files found only the four listed documentation changes, no missing or added repository files; all other source hashes match. Logs and the preservation result are in the evidence directory. No application/backend code changed, so prior application/emulator results were not rerun or represented as new cloud evidence.

Changed files: this report and status/consistency updates in the cloud-rehearsal, release-integration and TestFlight-readiness reports. No application, rules, deployment manifest, toolchain or UI changes.

**Decision: NOT READY FOR PROVISIONING.** The next concrete authorization is the empty, unbilled Phase A project only; subsequent controls/canary approval must account for remaining cost uncertainty. If the user requires an absolute $25 maximum, continue locally instead of representing alert budgets and eventual service pauses as that guarantee. **External beta remains NO-GO.**
