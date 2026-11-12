# P1-10 Phase 2B — stopped safely, billing unlinked

**Latest — Phase 2C read-only recovery review, November 11:** both approved broad IAM removals have since completed and the five-binding baseline is freshly confirmed; billing remains disabled. Earlier seven-binding/approval-pending statements below describe the historical Phase 2B stop. The cap remains unavailable in the unfiltered billing UI, with backend existence/deletion cause unresolved; no API activation or billing relink was used to investigate. [Phase 2C findings, staged approval scope and revised canary plan](PHASE2C_CANARY_RECOVERY_2026-11-11.md). Preserve the surviving alert and November 12/14 reviews. Full canary execution NOT READY; external beta NO-GO.

**P1-10C read-only update, November 11:** exact project identity and disabled billing reconfirmed; 31 APIs and seven IAM bindings remain. Audit logs identify Google's service-agent manager as the actor adding Compute Editor and the legacy builder role. **PASS / READY for approval of only those two binding removals; NOT READY for API disablement, preventive policy installation or canary resumption.** No cloud mutations occurred during this review. The alert budget remains, but the former Run cap is no longer listed and its direct resource URL returns not found. Historical installation success below is not proof of a currently installed cap. Full findings, minimum permissions, exact commands, rollback and remaining dependencies: [P1-10C remediation report](CLOUD_IAM_API_REMEDIATION_2026-11-11.md), [exact inert before/after proposal](deployment/iam-remediation.proposed.json).

**November 11, 2026: FAIL — API allowlist and automatic IAM-grant gates. NOT READY to resume execution.** Authentication and spending safeguards passed. Enabling the five approved APIs automatically enabled three additional APIs and granted Editor to the default Compute service account. The run stopped before source upload, build, deployment or invocation. Workload checks were empty and billing was unlinked successfully. External TestFlight remains **NO-GO**.

## Authorization, target and preflight

The user conditionally approved the exact [Section 8 plan](PRIVATE_HEALTH_CANARY_2026-11-05.md#8-decision-and-exact-approval-request), then completed Google passkey verification and explicitly requested resumption. No repeat approval was requested. The earlier authentication handoff is resolved.

Verified via CLI and Console:

- Project `aura-rehearsal-20261011`, number `1087494190017`, **ACTIVE**, No organization/no folder. Operator `mirathfan@gmail.com` is the active CLI account. No impersonation or automatic prompt acceptance configured.
- Before mutation: billing disabled, empty billing account, only human `roles/owner`, 23 enabled APIs, no Storage buckets. Console inventory: 29 records (23 APIs, project, billing metadata, two default Logging buckets and two default sinks). The four Logging records were absent from the November 4 inventory; direct reads confirmed `_Default` global/30 days and `_Required` global/400 days/locked.
- Billing account `01B4D2-62CAD1-5848FD` is open. Read-only `testIamPermissions` returned all 11 requested billing permissions, including association create/delete, budget CRUD and `billing.budgets.configureSpendCap`.
- Project permission test returned all requested bootstrap/Run/build/repository/logging permissions, except object create/delete at project scope. This is consistent with Owner's documented Storage convenience bindings: a newly created UBLA bucket grants project Owners legacy bucket/object ownership. Bucket-level permissions would have required verification before upload; no bucket was created and no additional grant was made. [Storage basic-role behavior](https://docs.cloud.google.com/storage/docs/access-control/iam-roles#modifiable-behavior)
- The project permission API initially returned a shared Google CLI consumer quota 429; one later read-only retry succeeded without quota/API changes. CLI billing `get-iam-policy` returned INVALID_ARGUMENT; the supported permission-test API provided the required access evidence. Neither error was treated as proof of missing permissions or resource absence.
- Project-filtered November 1–11 report showed **$0.00**, no SKU rows, and insufficient history for a provider forecast. The project scope was carried in the report URL; this layout did not expose a separate selected-project chip. Final charges remain subject to reporting delay. The planning estimate remained below the $2 stop threshold; no provider forecast was invented.

## Actual execution

All times UTC; local evidence in [canary-execution-2026-11-11](../../qa-artifacts/canary-execution-2026-11-11/).

| Operation | Observed result |
|---|---|
| Billing-link window started | **15:06:10.685** |
| Link completed | **15:06:12.652**, exact approved account, `billingEnabled: true` |
| Install Run cap | `aura-rehearsal-run-cap`, ID **062874a3-795e-402e-bec2-6997434fba45**, monthly **$1**, only rehearsal project / Cloud Run; **Configured**, estimated $0 |
| Install all-service alerts | `aura-rehearsal-all-services`, ID **5f917c50-235c-4cb5-bb70-076c77aa8ba5**, monthly **$25**, only rehearsal project, all services, savings/credits excluded |
| Verify saved alert rules | Actual **$0.50/$1/$2/$5**, forecast **$2**; billing-admin/user and project-owner email enabled; Monitoring channels and Pub/Sub notifications disabled |
| Enable approved APIs | Requested only Run, Cloud Build, Artifact Registry, IAM and Resource Manager; operation `operations/acf.p2-1087494190017-e7e97f0b-8acc-49b7-a260-780df865577b`, completed **15:09:07.620** |
| Mandatory stop | Direct API/IAM reads found unapproved automatic dependencies and Editor grant; no next provisioning step executed |
| Workload check | Empty Run services, us-central1 jobs, us-central1/global builds, all-location repositories, Storage buckets, Pub/Sub topics/subscriptions; no canary artifacts to delete |
| Billing unlink | Completed **15:10:46.531**, empty account and `billingEnabled: false`; independently verified by CLI and Console |
| Total linked window | **4 minutes 36 seconds**, within 60-minute limit |

No source upload, dedicated SA creation, explicit IAM binding change, repository/bucket creation, log-retention change, build, deployment, health request, paid AI, production access, GitHub push, EAS build or TestFlight action occurred. No build ID, image digest, service URI or revision exists to report. Deployment attempts **0**, anonymous requests **0/1**, authenticated requests **0/20**. The persistent invocation ledger was not consumed.

## Stop evidence and retained IAM/API state

The exact five-API enable command resulted in **31 enabled APIs**, an increase of eight. In addition to the approved five, Google enabled:

- `containerregistry.googleapis.com`
- `iamcredentials.googleapis.com` — explicitly excluded by the approved plan
- `pubsub.googleapis.com`

The combined request and before/after evidence establish automatic additions during enablement, but do not establish which individual requested API introduced each dependency. No dependency was silently added to the approved allowlist.

Final project IAM contains the original Owner plus these six automatic bindings:

| Principal (all within the rehearsal project) | Role |
|---|---|
| `1087494190017-compute@developer.gserviceaccount.com` | **roles/editor — stop condition** |
| `1087494190017@cloudbuild.gserviceaccount.com` | roles/cloudbuild.builds.builder — unplanned legacy builder |
| `service-1087494190017@gcp-sa-cloudbuild.iam.gserviceaccount.com` | roles/cloudbuild.serviceAgent |
| `service-1087494190017@containerregistry.iam.gserviceaccount.com` | roles/containerregistry.ServiceAgent |
| `service-1087494190017@gcp-sa-pubsub.iam.gserviceaccount.com` | roles/pubsub.serviceAgent |
| `service-1087494190017@serverless-robot-prod.iam.gserviceaccount.com` | roles/run.serviceAgent |

Audit evidence attributes the Editor ADD at **15:09:02.335886Z** and legacy builder ADD at **15:09:04.957424Z** to `service-agent-manager@system.gserviceaccount.com`. Operator audit records show the approved BatchEnableServices request. No operator `add-iam-policy-binding` command ran. Provider audit entries also contain transient missing-agent/concurrent-policy errors; final IAM reads, rather than those intermediate failures, establish the retained bindings.

The default Compute SA exists and is enabled. No VM or application workload was identified. Its Editor grant remains a security concern even while billing is disabled: unlinking billing is not IAM revocation. No default identity/role/API was deleted or modified outside the authorized cleanup scope.

## Safeguards, costs and cleanup boundary

The $1 cap and early alerts were installed and verified **before any source upload/deployment**. The cap's operational pause was not tested by spending $1. Alert delivery to mailboxes was not tested. The cap can overrun, excludes other services, and is not a $25 hard limit. [Google spend-cap behavior](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)

Post-stop and post-unlink reports still displayed **$0.00**, no SKU rows, no usable forecast. This is available delayed billing evidence, not a final invoice or guarantee of zero liability. No compute build or serving workload ran. Any delayed control-plane/logging charges must still be checked.

Cleanup verified no canary workload or artifact required deletion. Direct live bucket listing was empty; the Storage API soft-deleted bucket listing returned `{"kind":"storage#buckets"}` with no items. Console inventory briefly showed only 33 records and omitted some enabled APIs visible in the direct Service Usage result, demonstrating inventory lag; direct reads take precedence.

The prepared cleanup command `gcloud storage buckets list --soft-deleted` is unsupported in CLI 593.0.0. `gcloud storage ls --soft-deleted --json --project=...` is supported but reports no matches as an error; the read-only Storage API confirmed no retained buckets. The plan's command is corrected; this does not authorize a new mutation.

Retained, intentionally not presented as a full baseline rollback:

- 31 enabled APIs and the automatic identities/roles above; no disablement or IAM repair authorized after the stop.
- Default Logging buckets/sinks; `_Default` remains **30 days**, because the one-day change was not reached. `_Required` stays locked/400 days.
- **Corrected by P1-10C:** the target-only alert budget remains for delayed-charge review; the old Run cap can no longer be found after unlinking. Do not assume both budgets survived. Check at approximately **November 12 and November 14, 15:11 UTC / 09:11 CST** (24/72 hours). Do not remove the surviving alert before both reviews finish. No automation was created; reviews and final budget cleanup are not claimed complete. Any future billed execution requires a newly verified cap before provisioning.
- Local CLI authentication established by the user; no credential revocation, account-default project change or ADC setup performed.

Project remains **ACTIVE / No organization / no folder / billing disabled**. Shared billing account was not closed or modified beyond this project's association and the two approved rehearsal budgets.

## Gate verdicts

| Gate | Verdict |
|---|---|
| CLI authentication, target and baseline | **PASS** |
| Required billing permissions | **PASS** |
| Installed Run cap / early alerts | **PASS at installation**; enforcement/delivery not exercised. **P1-10C: old cap now missing; alert retained** |
| Exact API scope | **FAIL** — three automatic additions |
| Scoped IAM / no automatic Editor | **FAIL** — Editor and unplanned legacy build role |
| Dedicated runtime/build identities and one-day logging | **NOT RUN** — stopped before setup |
| Build/deployment/runtime/real private IAM/21 requests | **NOT RUN** |
| Workload absence / no artifacts to remove | **PASS** for direct checks and observed inventory |
| Authorized billing unlink / final identity | **PASS** |
| Complete baseline rollback / all cleanup finished | **NOT COMPLETE** — retained API/IAM metadata, budgets and delayed-cost review |
| Cost threshold | **PASS for observed spend** ($0); final liability unverified |
| Overall Phase 2B execution | **FAIL / NOT READY TO RESUME** |
| External beta | **NO-GO** |

Earlier today, local verification passed **40/40** regression tests, **1/1** packaged loopback HTTP test, dependency audit **0 vulnerabilities**, and lint **0 errors / 9 existing warnings**. Those results are not cloud runtime or IAM evidence. No application test suite, native build or backend deployment is represented as rerun during this continuation.

## Source preservation and next scope review

Repository HEAD remains `06ece001c69cb6a84787cebddd521f883ffccb66` plus the existing dirty tree. The unuploaded four-file package totals **59,031 bytes**; lock SHA-256 `13e0f1cdf2ac69abcd0144830f994bd444a470b4c975451f4276339d496a9110`; archive SHA-256 `d5c15f8faa203fafaaabd3f4c560e4503463e0e885c7a7b3a1670786c4e850b3`. Application/backend/native/UI files, Expo SDK 54, Xcode 26.0 and unrelated user changes remain preserved. The proposal JSON is historical/inert; this report and execution ledger record actual authorization and state. Final baseline comparison also detected a concurrent change to `src/addItem/hooks/useItemDraft.ts` after the earlier preservation check. This task did not edit or revert that file; current contents were preserved and its hash/mtime recorded. The raw all-files-unchanged assertion therefore did not pass; task-owned changes are documentation only.

Resumption requires a **material scope revision**, not another request for the same canary approval: review the three automatic API dependencies, authorize removal of the default Compute Editor binding and unused legacy builder binding (or an equally narrow reviewed alternative), and define how automatic grants will be prevented or detected before future builds. Proposed remediation commands, **NOT EXECUTED**:

```sh
gcloud projects remove-iam-policy-binding aura-rehearsal-20261011 --member=serviceAccount:1087494190017-compute@developer.gserviceaccount.com --role=roles/editor --condition=None --account=mirathfan@gmail.com
gcloud projects remove-iam-policy-binding aura-rehearsal-20261011 --member=serviceAccount:1087494190017@cloudbuild.gserviceaccount.com --role=roles/cloudbuild.builds.builder --condition=None --account=mirathfan@gmail.com
```

Do not disable dependency APIs without checking their relationships. Do not relink billing or resume setup until that changed scope is approved and fresh preflight passes. No second cloud deployment is implicitly authorized; none was attempted in this run.
