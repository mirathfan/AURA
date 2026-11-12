# AURA rehearsal bootstrap — Phase 1C billing unlink completed

**November 11, Phase 2B superseding update:** [Canary execution results](PRIVATE_HEALTH_CANARY_EXECUTION_2026-11-11.md). User-approved billing link, $1 Run cap and early alerts succeeded. Enabling five approved APIs automatically added Container Registry, IAM Credentials and Pub/Sub plus default Compute Editor and other platform bindings; execution stopped before source upload or deployment. Empty workload checks passed and billing unlink completed at **15:10:46.531 UTC**, after a **4m36s** linked window. Project `aura-rehearsal-20261011` / `1087494190017` remains ACTIVE, No organization/no folder, `billingEnabled: false`, account empty. Retained API/IAM state and target budgets are documented; observed cost $0 is delayed. **FAIL / NOT READY to resume; external beta NO-GO.** Phase 1C details below are historical.

**Current state, November 4, 2026: PASS — billing was unlinked from `aura-rehearsal-20261011` / `1087494190017` with one authorized submission. The project billing page confirms no billing account. The project remains ACTIVE under No organization / no folder. No known workload assets appeared before or after the operation. Phase 2 and the private health canary remain NOT APPROVED; external TestFlight remains NO-GO. Cloud work has stopped.**

## Phase 1C — authorization and preflight

The user explicitly authorized unlinking **only** project `aura-rehearsal-20261011`, number `1087494190017`, from account `01B4D2-62CAD1-5848FD`, after a fresh identity/billing/resource check. This did not authorize closing or changing the shared billing account, relinking billing, other infrastructure changes, deployment, paid AI, production data access or Phase 2.

Fresh console reads before execution confirmed:

- Project ID and number exactly matched; name **AURA isolated rehearsal**; `lifecycleState: ACTIVE`; empty parent and only the project itself in ancestors (No organization / no folder).
- ProjectBillingInfo had `billingEnabled: true` and `billingAccountName: billingAccounts/01B4D2-62CAD1-5848FD`.
- Asset Inventory returned the same **25 records**: 23 enabled service/API records, the project and its billing metadata. No workload assets appeared; the service names matched Phase 1B.
- The direct live Storage bucket list again showed **No rows to display**.
- The shared account's linked-project table explicitly included **AURA isolated rehearsal / aura-rehearsal-20261011**. Only that row's action menu was used. Other linked-project names were incidentally visible in the shared table; no other project was opened or modified, and no production user data was accessed.

No material preflight change was found. The inherited inventory limitations remain: supported searchable assets and live-bucket checks do not exhaustively cover every service default, historical resource or delayed inventory update.

## Phase 1C — operation and verification

Used the rehearsal row's **Disable billing** action. The confirmation named **AURA isolated rehearsal** and warned that billable services could stop, resources could be removed and already incurred charges would remain payable. Submitted **Disable billing once**, under the user's exact-target authorization, at **2026-11-04T14:21:15.777Z**. No retry or alternative billing change was attempted.

Google displayed **“Billing for project ‘AURA isolated rehearsal’ was disabled”**, and the rehearsal row disappeared from the linked-project list. No account-level Close, suspend, settings, IAM or payment action was used. The shared billing account itself was not closed or otherwise changed apart from removing this project's association.

| Post-operation check | Verified result |
|---|---|
| Direct project billing page | **This project has no billing account / This project is not linked to a billing account** |
| Project identity | `aura-rehearsal-20261011`, `1087494190017`, AURA isolated rehearsal |
| Lifecycle / parent | **ACTIVE**, No organization / no folder, unchanged |
| Billing metadata | Updated at Nov 4, 2026, 2:21:16 PM in the metadata display; prior `billingAccountName` and `billingEnabled: true` fields no longer present |
| Resource inventory | Same **25 records**, including the same 23 enabled APIs; no known workload assets or unexpected new resources |
| Project IAM metadata | Still only `user:mirathfan@gmail.com` → `roles/owner` |
| Available charges | Project-targeted November 1–4 report: **$0.00**, no SKU rows; final charges remain unverified |

The billing asset's search-table status still displayed `ACTIVE`; this is **not** the billing-enabled boolean. Its full metadata omitted the account and boolean fields after unlinking. Do not misreport an explicitly returned `billingEnabled: false` value: that raw value was not displayed. Disabled/unlinked status is established by the direct project billing page and the successful operation notification, corroborated by the changed billing metadata.

Verified the direct no-account page at **2026-11-04T14:22:26.139Z**. Completed all cloud checks at **2026-11-04T14:22:39.829Z**, then stopped cloud work. No relink, API enablement, IAM change, resource provisioning, deployment or paid AI call followed.

## Phase 1C — charges and remaining risk

Read the existing account's report using the exact rehearsal-project filter URL recorded in Phase 1B. The November 1–4, 2026 view showed **$0.00 subtotal / filtered total**, with **No results to display** in the SKU table. As before, the project filter was present in the URL; this layout did not show a separate selected-project chip or a project-specific charge row. This is available report evidence, not a final reconciled invoice.

The report warns that charges may take **longer than 24 hours** to appear. Unlinking does not cancel charges already incurred. A later read-only charge review remains appropriate; no monitoring or scheduled task was created. No unexpected charges were visible during this operation.

No known workload depended on the removed billing association, and no workload loss was observed. Inventory coverage and reporting latency prevent a universal guarantee about unlisted resources or final liability. Billing-dependent rehearsal work remains blocked pending separately approved Phase 2 billing and safeguards. **Do not relink or create the private health canary under this authorization.**

## Phase 1C — evidence and local validation

Evidence directory: [rehearsal-unlink-2026-11-04](../../qa-artifacts/rehearsal-unlink-2026-11-04/).

- `operation.json`: exact target, one submission, observation timestamps, final `VERIFIED_UNLINKED` state and Phase 2 unapproved.
- `pre-project.txt`, `pre-billing.txt`, `pre-inventory.txt`, `pre-storage.txt`: fresh preflight evidence.
- `unlink-confirmation.txt`, `unlink-result.txt`: project-specific confirmation and successful notification.
- `billing-disabled.txt`, `billing-disabled.png`: direct post-operation no-billing-account page.
- `post-project.txt`, `post-billing.txt`, `post-inventory.txt`, `post-iam.txt`, `post-cost-report.txt`: resulting state and read-only checks.
- `before-hashes.json`, `preservation-check.json`, `validation.json`, `lint.log`: repository preservation and validation.

![Rehearsal project has no billing account after the authorized unlink](../../qa-artifacts/rehearsal-unlink-2026-11-04/billing-disabled.png)

Only this report was edited in the repository. Local checks: `git diff --check` and explicit report whitespace/local-link checks **PASS**; root `npm run lint` is **BLOCKED**, exit 127, `expo: command not found`. No dependency repair or application/backend changes were made. SHA-256 comparison of the 840-file baseline confirms only this report changed, with no missing or new repository files. No new runtime or workload test is claimed.

**Phase 1C: PASS / completed and stopped. Phase 2/private canary: NOT APPROVED. External TestFlight: NO-GO.**

---

## Historical Phase 1B read-only findings

**Current decision, November 4, 2026: recommend UNLINK BILLING for `aura-rehearsal-20261011`, only after separate explicit approval. No billing action was executed. Phase 1B inspection found an ACTIVE project with no organization/folder, one Owner, 23 enabled APIs, and no workload resources in the available inventory. Billing remains enabled. Phase 2 is NOT APPROVED; external TestFlight remains NO-GO.**

The Phase 1B findings below supersede the earlier verification gaps. The original creation/stop record is retained afterward as history.

## Phase 1B — authorization and method

The user separately authorized read-only inspection of this rehearsal project's identity, IAM, services/resources, billing, audit history and unlink consequences. No API enablement, IAM changes, billing changes, resource creation, deployment or production inspection was authorized or performed. Used the authenticated Google Cloud console as `mirathfan@gmail.com`; `gcloud` remains unavailable locally. No credentials were extracted or new permissions requested. All project views targeted `aura-rehearsal-20261011`; the billing report URL explicitly included that project filter.

Cloud Asset Inventory was readable in the console without an enablement or permission prompt, even though its public API was not among the 23 enabled services. No inspection required a cloud change, so the user's permission/change stop condition was not triggered. Read-only search/filter controls and expanded metadata were used; no saved query, export job, sink, budget, service account or cloud artifact was created.

## Verified project identity, parent and lifecycle

| Field | Phase 1B finding |
|---|---|
| Project ID | `aura-rehearsal-20261011` |
| Project number | `1087494190017` |
| Display name | AURA isolated rehearsal |
| Lifecycle | **`ACTIVE`**, read from `resource.data.lifecycleState` in Cloud Asset Inventory's Full Metadata view |
| Parent | **No organization / no folder**. Full Metadata has an empty parent and only `projects/1087494190017` in ancestors; the settings page also identifies the project as outside an organization |
| Creation audit timestamp | `2026-11-04T12:36:23.175831Z` (`06:36:23.175` CST in Logs Explorer) |
| Billing account | `billingAccounts/01B4D2-62CAD1-5848FD` |
| Billing enabled | **`true`**, read from ProjectBillingInfo Full Metadata; inventory status also `ACTIVE` |

These are console-displayed resource metadata, not a direct `gcloud describe` response. Unlike the original bootstrap observation, the lifecycle enum and billing-enabled boolean are now verified fields.

## IAM and permission findings

The IAM page, with **Include Google-provided role grants** checked, showed one principal: **Mir Athfan Ali / `mirathfan@gmail.com`**, with **Owner (Legacy)**. The project's Asset Inventory IAM Policies view independently showed `user:mirathfan@gmail.com` → **`roles/owner`**. No additional principal or service-agent grant was visible in these project policies. No roles were assigned or removed.

The billing assignment audit event recorded these permission checks as `granted: true` at execution time:

- `billing.resourceAssociations.create` on `billingAccounts/01B4D2-62CAD1-5848FD` (appears twice).
- `resourcemanager.projects.createBillingAssignment` on this project.
- `resourcemanager.projects.deleteBillingAssignment` on this project.

Those historical checks and the current Owner binding are evidence of access, not a full current effective-permission test for deployment, billing unlink or every service. Billing-account IAM was not changed or broadly inventoried. No claim is made that Phase 2's proposed least-privilege service accounts or deployment permissions already exist. Project Owner is broad access; a separately approved Phase 2 should use the scoped identities and resource limits in the safeguards plan.

## Enabled services and existing resources

The APIs dashboard showed **23 of 23** enabled services. Asset Inventory independently listed the same 23 `serviceusage.Service` records:

```text
analyticshub.googleapis.com
apptopology.googleapis.com
bigquery.googleapis.com
bigqueryconnection.googleapis.com
bigquerydatapolicy.googleapis.com
bigquerydatatransfer.googleapis.com
bigquerymigration.googleapis.com
bigqueryreservation.googleapis.com
bigquerystorage.googleapis.com
cloudapis.googleapis.com
cloudtrace.googleapis.com
dataform.googleapis.com
dataplex.googleapis.com
datastore.googleapis.com
logging.googleapis.com
monitoring.googleapis.com
servicemanagement.googleapis.com
serviceusage.googleapis.com
sql-component.googleapis.com
storage-api.googleapis.com
storage-component.googleapis.com
storage.googleapis.com
telemetry.googleapis.com
```

Cloud Asset Inventory's unfiltered project Resource tab returned **25 of 25** records, all global: the 23 service records, one `cloudresourcemanager.Project`, and one `cloudbilling.ProjectBillingInfo`. **No workload resource was listed**: no VM, Cloud Run service/function, database, bucket, BigQuery dataset, worker, queue, scheduler job, service account or repository appeared. The Cloud Storage live-bucket list separately returned **No rows to display**. No object data was opened. No AURA backend, canary or synthetic test workload was deployed.

Cloud Run, Functions, Compute, Firestore, Scheduler, Eventarc, Tasks, Secret Manager, Cloud Build and Artifact Registry APIs were not listed as enabled. API enablement alone is not evidence of a workload or a charge; API absence alone is not proof that a resource cannot exist. The creation-period logs include `EnableService` for `cloudapis.googleapis.com` under the creator identity. No separate Enable action was taken by the agent during bootstrap or Phase 1B; these observed service records must not be confused with an approved rehearsal deployment.

**Inventory limitation:** this is the set of supported searchable assets visible at inspection time, not a universal proof that every service-specific/default resource is absent. Default logging configuration, historical/deleted resources and unsupported asset types were not exhaustively enumerated. Cloud Asset Inventory is eventually consistent and can lag or omit updates. The direct live-bucket check and creation audit complement it. [Google Cloud Asset Inventory limitations](https://docs.cloud.google.com/asset-inventory/docs/asset-inventory-overview)

## Billing and attachment audit evidence

The project-filtered billing report URL was:

`https://console.cloud.google.com/billing/01B4D2-62CAD1-5848FD/reports;grouping=GROUP_BY_SKU;projects=aura-rehearsal-20261011?project=aura-rehearsal-20261011`

For **November 1–4, 2026**, it displayed **$0.00 subtotal / $0.00 filtered total**, **$0.00 savings**, and **No results to display** in the SKU table. The project filter was present in the targeted report URL; this layout did not expose a separate selected-project chip or any project-specific charge row. Therefore this establishes the available report result, not an independently reconciled final project invoice. The console warns that usage costs can take **longer than 24 hours** to appear. No unexpected charge was visible, but zero final liability is **not verified**. No billing export or cost query job was created.

Logs Explorer, scoped to this project's logs with the **Today** time range, returned eight entries: project creation, service bootstrap activity and billing assignment. The decisive entries were:

| Event | UTC timestamp | Principal | Evidence |
|---|---|---|---|
| `CreateProject` | `2026-11-04T12:36:23.175831Z` | `mirathfan@gmail.com` | Resource Manager; target `projects/aura-rehearsal-20261011`; status `{}`; insert ID `-f7frkxd8g70` |
| `AssignResourceToBillingAccount` | `2026-11-04T12:36:25.926229Z` | `mirathfan@gmail.com` | `cloudbilling.googleapis.com`; request names `projects/1087494190017` and `billingAccounts/01B4D2-62CAD1-5848FD`; status `{}`; insert ID `-m5kmyoev2tgk` |

Both were in `projects/aura-rehearsal-20261011/logs/cloudaudit.googleapis.com%2Factivity`. Billing was assigned approximately **2.75 seconds after** the creation event, under the same signed-in identity. No distinct human actor appears in these entries. The event records a backend billing assignment, even though no separate billing-link UI action was submitted by the agent.

Google documents that console project creation automatically links billing when only one billing account is available. The observed timing and UI sequence are consistent with that mechanism; the audit log does not itself name the UI auto-link decision or prove how many accounts were available. **The earlier assumption that a console form without a billing selector would create an unbilled project was incorrect. That behavior should have been checked before the Create click.** [Google's project billing documentation](https://docs.cloud.google.com/billing/docs/how-to/modify-project)

## Recommendation and consequences

**UNLINK BILLING — recommendation only; separate approval required.** This returns the idle rehearsal project toward the originally authorized unbilled state and reduces exposure before Phase 2 controls are approved. The available inventory shows no deployed workload that needs uninterrupted billing, so no existing AURA workload disruption is expected. This is an evidence-based expectation, not a guarantee covering inventory lag or unsupported resources.

The proposed future action is **only** to detach `aura-rehearsal-20261011` / `1087494190017` from `01B4D2-62CAD1-5848FD`; it is not to close the billing account, alter another linked project, delete this project or recreate it. **No such action was executed.**

Consequences and residual risks:

- Billing-dependent services would stop or become unavailable; any overlooked resource could be affected or irrecoverably removed. Outstanding/delayed charges remain payable. Re-enabling billing later is not a guaranteed restoration of deleted resources. [Billing disablement effects](https://docs.cloud.google.com/billing/docs/how-to/modify-project)
- No Shared VPC, commitment or workload appeared in this project's available inventory; a service-specific commitments/dependency audit was not performed. Immediately before any approved unlink, refresh this project's inventory and billing relationship and stop if unexpected resources or dependencies appear.
- Phase 2's canary/deployment would remain blocked until separately approved billing linkage and safeguards. Do not use the currently attached billing account as permission to start Phase 2.
- Until an approved unlink occurs, billing remains enabled with **no enforceable $25 total hard cap**. No rehearsal-specific budget, cap, IAM restriction or shutdown mechanism was installed in this read-only phase. Manual restraint and no observed workload reduce expected spend but do not guarantee it.
- Recheck project-specific charges after reporting latency, including after any approved unlink. An empty current report cannot settle final liability.

## Phase 1B evidence, validation and remaining gates

Evidence directory: [rehearsal-inspection-2026-11-04](../../qa-artifacts/rehearsal-inspection-2026-11-04/).

- `project-metadata.txt`, `billing-metadata.txt`: lifecycle, ancestry, number and billing boolean/account.
- `iam.txt`, `iam-policy-metadata.txt`: visible role grants and exact Owner role ID.
- `enabled-apis.txt`, `asset-inventory.txt`, `asset-inventory.png`, `storage-inventory.txt`: enabled services, 25-record inventory and empty live-bucket list.
- `creation-audit.txt`, `billing-audit.txt`: creation/attachment records and historical permission checks; caller IP and other request metadata were left collapsed.
- `cost-report.txt`: dated available billing result and latency warning.
- `before-hashes.json`, `preservation-check.json`, `validation.json`, `lint.log`: local preservation and validation results.

Only this report changed in the repository during Phase 1B; the baseline SHA-256 comparison found no other changed or missing files. `git diff --check`: **PASS**; this report is currently untracked, so a separate report whitespace/local-link check also covers it. Root `npm run lint`: **BLOCKED**, exit **127**, `expo: command not found` (existing missing local executable); no dependencies were installed or repaired. No application/runtime tests, authenticated user flows or cloud workload tests are claimed by this infrastructure inspection.

Remaining gates: separate exact-target billing-action approval; a fresh pre-action inventory check; delayed-charge review; and separate Phase 2 approval for resource scope, intentional billing, scoped identities, cost controls, deployment, bounded testing and cleanup. Existing release/device/privacy gates remain open. **NOT READY FOR PHASE 2. External TestFlight: NO-GO.**

---

## Historical Phase A creation and stop record

**November 4, 2026. Project creation succeeded on the single authorized attempt. The required unbilled postcondition FAILED. Cloud work stopped immediately after the billing association was confirmed. Phase 2 is NOT APPROVED; external TestFlight remains NO-GO.**

## Authorization and execution

The user approved exactly one attempt to create `aura-rehearsal-20261011` under No organization/no folder, without billing, followed by read-only verification. The instruction explicitly required stopping if billing was unexpectedly attached or an unexpected resource appeared, without corrective changes.

`gcloud` was unavailable, as in the preceding review. Used the authenticated Google Cloud console as **Mir Athfan Ali (`mirathfan@gmail.com`)**. The New Project form displayed:

- Name: **AURA isolated rehearsal**.
- Project ID: **aura-rehearsal-20261011**.
- Organization: **No organization**.
- Parent resource: **No organization**.
- No billing selector or billing-link confirmation was visible in the inspected creation form.

Reserved the single attempt in a local evidence record, then clicked **Create exactly once**. Google displayed **“Create Project: AURA isolated rehearsal”** with **“This task has finished.”** No retry or alternate ID was attempted. The console initially returned to its previously selected AURA dashboard; the new-project notification was used immediately to select the rehearsal project. No production action or production user-data inspection was performed; this incidental console redirect is not claimed as absence of production UI exposure.

The new-project dashboard showed the identity below. Its billing link unexpectedly pointed to the existing billing account. A read-only visit to the rehearsal billing-association route redirected to that account; its **Projects linked to this billing account** table then explicitly listed **AURA isolated rehearsal / aura-rehearsal-20261011**. At that point all further cloud inspection stopped. No unlink, budget, IAM, API, resource or corrective action followed; only a screenshot of the already loaded result and local documentation were saved.

## Verified identity and limits

| Field | Observed result |
|---|---|
| Project ID | **aura-rehearsal-20261011** |
| Project number | **1087494190017** |
| Display name | **AURA isolated rehearsal** |
| Parent | **No organization**, both in submitted form and post-creation “Now viewing project” notification; no folder selected |
| Creation outcome | Completed task notification; project dashboard accessible |
| Lifecycle enum | **Not independently read from Resource Manager**; do not label `ACTIVE` as API-verified solely from dashboard accessibility |
| Billing association | **Unexpectedly linked to 01B4D2-62CAD1-5848FD (“My Billing Account”)**; explicit linked-project table evidence |
| Raw billingEnabled flag | Not fetched; attached billing relationship is sufficient to trigger the user's stop condition |
| New-project IAM | **Not inspected**, because billing stop condition occurred first. Creator Owner/service-agent bindings must not be assumed verified |
| Resource inventory | **Incomplete / not inspected after stop**; no resource-creation action beyond the project was submitted by the agent |
| Charges | Dashboard displayed **estimated $0.00**, which is delayed UI data, not proof of a final zero charge or absence of resources |

**Unexpected finding: the billing association itself.** It appeared after the console project-creation action, without a separate billing-link action by the agent. The precise mechanism—console behavior, account setting or another actor—has not been established. No audit-log investigation was continued after the stop condition, and no cause should be invented.

I cannot certify “no billable resources exist” from the incomplete inventory. I can confirm that I did **not** enable APIs, create service accounts, change IAM, deploy functions/databases/Storage/workers, create the health canary, upload source, run paid AI, push to GitHub, create EAS builds or submit to TestFlight. No live user data was accessed or changed. Platform-created defaults remain unverified.

## Evidence

Local evidence directory: [rehearsal-bootstrap-2026-11-04](../../qa-artifacts/rehearsal-bootstrap-2026-11-04/).

- `creation-attempt.json`: one reserved/submitted attempt and final stop status, exact target, no billing-link authorization and no Phase 2 authorization.
- `observations.json`: sanitized identity, billing, verification limits and action ledger.
- `unexpected-billing.png`: visible billing-account ID and explicit linked-project row.
- `before-hashes.json` / `preservation-check.json`: repository preservation evidence.

![Rehearsal project unexpectedly listed under the billing account](../../qa-artifacts/rehearsal-bootstrap-2026-11-04/unexpected-billing.png)

## Remaining requirements before Phase 2

1. **Separate explicit direction on the unexpected billing attachment.** No correction has been made. If the owner wants billing detached, authorize that exact target/account action separately; do not treat earlier approval of an unbilled creation as permission to modify billing now. Do not delete/recreate the project or consume another creation attempt.
2. Authorize resumption of read-only verification: Resource Manager state/parent, current project IAM, enabled-service metadata, service-account/resource inventory and project-specific billing evidence. Determine whether any default resources or charges exist. Investigating creation/billing audit metadata is also separate follow-up after this stop.
3. Confirm the project's actual effective scoped permissions and proposed resource names; do not infer new-project IAM from historical production or account roles.
4. Complete local restricted canary packaging and the bounded persistent request controller; resolve the earlier local dependency/lint environment issues before using the package as a release gate.
5. Obtain **separate Phase 2 approval** for any intentional billing state, APIs, scoped IAM/service accounts, three budgets/service caps, one private canary, its bounded test and cleanup. The attached account does not grant this permission. Verify actual configured controls before workloads. The $25 remains an intended operational budget, not a guaranteed hard cap.

The [November 4 safeguards plan](REHEARSAL_SAFEGUARDS_2026-11-04.md) remains the proposed Phase 2 boundary. No action in that plan was executed here.

## Validation and decision

Creation: **one attempt, succeeded**. Required unbilled condition: **FAIL**. Remaining cloud verification: **STOPPED / incomplete as instructed**. No retries or remedial cloud changes.

Only reports and the inert proposal's approval/observed-state metadata changed locally. `git diff --check`: **PASS**. SHA-256 preservation check of **839** baseline files found only six report/proposal metadata changes and this one new report, no missing files; all application/backend/native and unrelated hashes match. Inert proposal checks confirm one submitted attempt and Phase 2 still unapproved. Results are recorded with the evidence. Root `npm run lint` was attempted; the known missing `node_modules/.bin/expo` blocks it (exit 127). No dependency installation or application change was made. Prior passing tests are not presented as new cloud validation.

**STOPPED — unexpected billing attached. NOT READY FOR PHASE 2. External TestFlight: NO-GO.**
