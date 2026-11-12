# P1-10C — Cloud IAM and API safety remediation proposal

**Phase 2C read-only follow-up, November 11:** the completed five-binding/unbilled baseline remains intact. Cap absence persists even in the unfiltered account UI; budget-read permissions are granted, the supported API lookup is blocked by disabled Billing Budget API, and accessible audit reads do not establish a deletion cause. [Recovery findings and revised plan](PHASE2C_CANARY_RECOVERY_2026-11-11.md). No cloud changes. Only a separate, bounded safeguards-only approval is ready to request conditionally; full deployment remains NOT READY and beta NO-GO.

## Executed after explicit approval — November 11, 2026

**PASS — both approved IAM binding removals completed and independently read back. Execution stopped after verification. Phase 2B remains NOT READY / not authorized to resume; external TestFlight remains NO-GO.** This execution record supersedes the proposal-only status below. The proposal JSON is preserved unchanged as the approved historical before/after specification; its `approved: false` / `PROPOSED_NOT_EXECUTED` fields are not current execution status.

Evidence: [execution directory](../../qa-artifacts/iam-remediation-execution-2026-11-11/), [preflight verification](../../qa-artifacts/iam-remediation-execution-2026-11-11/preflight-validated.json), [complete final IAM policy](../../qa-artifacts/iam-remediation-execution-2026-11-11/iam-after.json), [postcondition verification](../../qa-artifacts/iam-remediation-execution-2026-11-11/post-verified.json).

### Approved changes and concurrency protection

Fresh CLI preflight at approximately **17:16:19–21 UTC** verified `aura-rehearsal-20261011` / `1087494190017`, ACTIVE, no parent, billing disabled with no linked account, the exact seven unconditional bindings in the proposal, all 31 APIs unchanged, the enabled default Compute SA and no identified dependent workloads. No policy-binding discrepancy was found. ETags are opaque; the CLI's URL-safe representation and REST's standard Base64 representation differ in punctuation, not underlying bytes.

The two changes used the Cloud Resource Manager v1 `projects/aura-rehearsal-20261011:setIamPolicy` endpoint. Before **each** change, a fresh `getIamPolicy` requested policy version 3 and compared complete semantic policy content against the previous verified state. Each request retained that fresh **ETag**, removed only the specified unconditional member/role pair and used **`updateMask: bindings,etag`**. Requests were sequential, had no automatic mutation retry, and were each followed by complete readback comparison. Authentication used the existing `mirathfan@gmail.com` CLI session; tokens were held in process memory, never printed or saved. No historical whole-policy overwrite, role addition or rollback was performed.

| Change | Verified completion (UTC) | Result |
|---|---|---|
| Remove `roles/editor` from `1087494190017-compute@developer.gserviceaccount.com` | **17:16:59.294890** | **PASS**, seven → six bindings; first readback matched exactly |
| Remove `roles/cloudbuild.builds.builder` from `1087494190017@cloudbuild.gserviceaccount.com` | **17:17:06.236216** | **PASS**, six → five bindings; second readback matched exactly |

Recorded ETag sequence: `BwZgAZN7L+s=` → `BwZgA1zVjQA=` → `BwZgA11A+I0=`. Request/response JSON, timestamps, fresh policies and a guarded local execution script are retained in the evidence directory. There were exactly **two successful IAM writes**, no conflicts, retries or discrepancies. A subsequent independent CLI read at **17:17:42 UTC** confirmed the final state.

### Complete remaining project bindings

| Principal | Preserved role |
|---|---|
| `user:mirathfan@gmail.com` | `roles/owner` |
| `serviceAccount:service-1087494190017@gcp-sa-cloudbuild.iam.gserviceaccount.com` | `roles/cloudbuild.serviceAgent` |
| `serviceAccount:service-1087494190017@containerregistry.iam.gserviceaccount.com` | `roles/containerregistry.ServiceAgent` |
| `serviceAccount:service-1087494190017@gcp-sa-pubsub.iam.gserviceaccount.com` | `roles/pubsub.serviceAgent` |
| `serviceAccount:service-1087494190017@serverless-robot-prod.iam.gserviceaccount.com` | `roles/run.serviceAgent` |

The complete binding comparison confirms **all unrelated bindings unchanged**, both target bindings absent, and no audit-configuration change. Both execution identities were preserved; no service account was deleted, disabled or modified. The default Compute SA metadata is identical before/after and its user-managed key list remains empty. Legacy/managed identities not returned by the normal SA list are not treated as deleted.

### Final read-only resource, billing and spending checks

- **PASS:** identity/lifecycle/parent unchanged; `billingEnabled: false`, empty `billingAccountName`. No billing linkage or shared-account change.
- **PASS:** all **31 enabled APIs** match the preflight set exactly. No API, organization-policy, service-account or budget mutation.
- Direct inventory reads returned no Run services, no us-central1 Run jobs/worker pools, no us-central1/global builds, no Storage buckets and no Pub/Sub topics/subscriptions. No source upload, build, deployment, invocation or workload creation occurred. Coverage is limited to these reads; this is not a universal all-services inventory claim.
- **Known inventory limitation unchanged:** Artifact Registry direct listing returned `BILLING_DISABLED`. No enablement/relink was attempted. Therefore no fresh authoritative repository/artifact absence assertion is made; earlier empty direct inventory and the preceding P1-10C asset inventory remain historical evidence.
- Fresh Console cost report for the rehearsal-project URL shows **$0.00 for November 1–11**, no SKU rows and insufficient history for a forecast. Project scope is encoded in the URL; no separate selected-project chip is present in this layout. The explicitly project-number-scoped budget row independently shows **$0.00 / $25.00**. Reporting delays mean these are not final charges or proof of zero financial exposure.
- **PASS:** surviving alert budget **`5f917c50-235c-4cb5-bb70-076c77aa8ba5`** remains, scoped to **1087494190017**, monthly $25, no credits, displayed thresholds **2%, 4%, 8%, 20%, 8%**; no budget edit/delete was performed. The existing production budget was incidentally visible in the shared account list; it was not opened or modified, and no production resources/data were accessed.
- **OPEN:** the missing $1 Run cap remains absent from the budget list. No replacement was created. The **November 12 and 14 at approximately 15:11 UTC / 09:11 CST** cost reviews remain outstanding and not yet due. Preserve the alert budget through both reviews; no automation was installed.

### Local validation and stop boundary

Only this repository report was edited during the authorized execution; local evidence files were added outside the repository. The inert proposal, application/backend/native files and unrelated user changes were preserved. JSON policy comparisons before/after each write, independent CLI readback, full API and SA metadata comparisons, repository preservation hashes and `git diff --check` all **PASS**. Root `npm run lint` **PASS: 0 errors, 9 existing warnings**. Results are recorded with the execution evidence. No application runtime or canary test is claimed.

**No further cloud operations are authorized by this execution.** Missing cap, delayed-cost reviews, API dependency evidence and automatic-grant prevention remain open gates. The two removals reduce current permissions; they do not enforce future automatic-grant prevention. Existing rollback guidance below remains contingency documentation only: restoring either broad role requires separate approval. Phase 2B was not resumed.

---

## Historical read-only proposal (superseded by execution above)

**November 11, 2026, read-only review. PASS / READY for the two binding removals below, pending explicit approval. FAIL / NOT READY for API disablement, policy installation or canary execution.** No cloud mutation, billing linkage, source upload or deployment occurred. External TestFlight remains **NO-GO**.

This narrows the next action to removing unused broad execution permissions. It preserves Google-managed service agents, service accounts, APIs, the surviving budget and unlinked billing. [Exact before/after configuration](deployment/iam-remediation.proposed.json). [Read-only evidence](../../qa-artifacts/iam-remediation-2026-11-11/).

## 1. Refreshed project and resource state

Target: `aura-rehearsal-20261011` / **1087494190017**, **ACTIVE**, no parent (No organization/no folder). Billing API returns `billingEnabled: false`, `billingAccountName: ""`. Current human Owner remains `mirathfan@gmail.com`. No inherited organization/folder grants exist in this observed parentless hierarchy.

Direct reads returned:

- **31 enabled APIs**, compared with the pre-canary 23; no baseline API removed.
- **Seven project IAM bindings**, unchanged from the Phase 2B stop. All are unconditional; no public principals.
- Default Compute account enabled; its resource-level IAM policy has no bindings, and its **user-managed key list is empty**. No key material was accessed. Service-account list returns this one account; Google-managed service agents and the legacy Cloud Build identity are not assumed absent merely because they do not appear in that list.
- No Run services; no us-central1 jobs/worker pools; no builds or build triggers in us-central1 or global; no live Storage buckets; no Pub/Sub topics/subscriptions.
- Asset Inventory now shows **38 records**: 31 APIs, project, billing metadata, default Compute account, two Logging buckets and two Logging sinks. No repository, image, canary workload or other artifact appears.
- **Artifact Registry direct listing is blocked by disabled billing.** Its error requests billing enablement; billing was not enabled. The last successful direct inventory during Phase 2B was empty. Current Asset Inventory also shows none, but inventory latency/coverage means this is not a fresh authoritative Artifact Registry empty result.

No Scheduler, Eventarc, Cloud Functions, Firebase, Secret Manager or Compute API was enabled. No attempt was made to query a disabled API by accepting an enablement prompt. Absence checks are scoped as listed, not a universal all-services guarantee.

## 2. Exact IAM before and proposed after

All addresses below belong to the rehearsal project or its Google-managed identities. **No service account is deleted, disabled, recreated or granted a replacement role in this remediation.**

| Principal | Current role | Proposed result |
|---|---|---|
| `user:mirathfan@gmail.com` | `roles/owner` | Keep unchanged |
| `serviceAccount:1087494190017-compute@developer.gserviceaccount.com` | `roles/editor` | **Remove this binding only** |
| `serviceAccount:1087494190017@cloudbuild.gserviceaccount.com` | `roles/cloudbuild.builds.builder` | **Remove this binding only** |
| `serviceAccount:service-1087494190017@gcp-sa-cloudbuild.iam.gserviceaccount.com` | `roles/cloudbuild.serviceAgent` | Keep unchanged |
| `serviceAccount:service-1087494190017@serverless-robot-prod.iam.gserviceaccount.com` | `roles/run.serviceAgent` | Keep unchanged |
| `serviceAccount:service-1087494190017@containerregistry.iam.gserviceaccount.com` | `roles/containerregistry.ServiceAgent` | Keep unchanged pending dependency review |
| `serviceAccount:service-1087494190017@gcp-sa-pubsub.iam.gserviceaccount.com` | `roles/pubsub.serviceAgent` | Keep unchanged pending dependency review |

Expected result: **seven bindings → five**, with no other IAM changes. The default Compute account is an automatically provisioned default execution identity whose permissions/lifecycle can be managed by the project owner; it is **not** the Run service agent. The legacy `NUMBER@cloudbuild.gserviceaccount.com` is Google's legacy build executor, distinct from `service-NUMBER@gcp-sa-cloudbuild.iam.gserviceaccount.com`, the control-plane agent. Do not remove the latter's service-agent role to restrict build code. [Cloud Build identity guidance](https://docs.cloud.google.com/build/docs/cloud-build-service-account-updates)

Cloud Build's current default-service-account endpoint explicitly selects the **default Compute account**. Removing Editor makes accidental use fail for privileged build work; it does not select the future dedicated builder. A future deployment must set both `--build-service-account` and `--service-account` explicitly.

## 3. Root causes and evidence limits

Fresh audit reads establish:

- At **15:09:00.890413 UTC**, the operator requested exactly `run.googleapis.com`, `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `iam.googleapis.com`, `cloudresourcemanager.googleapis.com`. No Pub/Sub/IAM Credentials/Container Registry enable was explicitly requested.
- `service-agent-manager@system.gserviceaccount.com` added default Compute **Editor** at **15:09:02.335886**, and legacy **Cloud Build Service Account** at **15:09:04.957424**. The four service-agent grants were added by the same Google principal. These were automatic platform changes, not operator role-binding commands.
- Effective `iam.automaticIamGrantsForDefaultServiceAccounts` returns an empty boolean policy (default false, not enforced). This is consistent with the observed Editor assignment. The constraint governs automatic grants on default account creation, not removal of existing privileges. Google documents that legacy Cloud Build's separate builder role is not prevented by this Editor constraint. [Default grant behavior](https://docs.cloud.google.com/build/docs/cloud-build-service-account-updates#guidelines_for_iam_roles)
- Effective `cloudbuild.disableCreateDefaultServiceAccount`, `cloudbuild.useBuildServiceAccount` and `cloudbuild.useComputeServiceAccount` each return `enforced: true`. No explicit project policies are listed. These effective defaults do not disprove the observed legacy IAM binding or establish that it is needed; the actual selected build identity is Compute.

API expansion is verified by audit-request versus before/after lists. Attribution of each extra API to a specific requested API is **unresolved**. CLI 593.0.0 provides read-only `services list-dependents` and `services groups list-members ... dependencies`, but their server calls returned **NOT_FOUND: Method not found** for all investigated targets. This is not an empty dependency graph. No disable call, `--force`, cascade, bypass flag or temporary enable/disable experiment was used.

## 4. Exact API configuration and minimum future lane

**Proposed remediation API delta: zero. All 31 currently enabled APIs stay enabled.** The machine-readable proposal enumerates all 23 baseline and 31 current/proposed names; no baseline cleanup is bundled into this task.

| Added during Phase 2B | Role in the intended lane | Immediate treatment |
|---|---|---|
| `run.googleapis.com` | Private HTTP serving/admin | Retain |
| `cloudbuild.googleapis.com` | Managed source build in the selected plan | Retain; no build runs |
| `artifactregistry.googleapis.com` | Store built image | Retain; no repository created |
| `iam.googleapis.com` | Manage dedicated identities and scoped access | Retain |
| `cloudresourcemanager.googleapis.com` | Project/IAM administration | Retain |
| `iamcredentials.googleapis.com` | Potential platform token-minting dependency; static handler does not call it | Retain pending verified dependency graph; not yet approved for future execution |
| `pubsub.googleapis.com` | No application trigger needed; Cloud Build has a documented notification integration | Retain pending dependency proof; no topics/subscriptions/triggers authorized |
| `containerregistry.googleapis.com` | No selected GCR image path; selected repository is Artifact Registry | Retain pending dependency proof; no GCR resource authorized |

Direct prerequisites remain Run/Build/Artifact Registry/IAM/Resource Manager plus existing Service Usage, Storage and Logging. Monitoring supports observation, not the static handler. None of the handler's business logic requires Firebase, a database, secrets, AI, Pub/Sub, Eventarc, scheduling or outbound network access. Application non-use of an API is not proof it can be disabled under a managed build/control plane. Cloud Build documents Pub/Sub build notifications; this does not prove the selected first build will create no topic. That resource risk must be resolved before a future execution approval. [Source deployment](https://docs.cloud.google.com/run/docs/deploying-source-code), [build notifications](https://docs.cloud.google.com/build/docs/subscribe-build-notifications)

Do not disable any of the three extra APIs until a supported dependency read, Google support confirmation, or separately authorized isolated test establishes consequences. Re-enabling an API can recreate service identities/grants; disabling a dependency can break retained services. The current plan contains **no API-disable command** because the prerequisite evidence is missing.

### Minimum permissions for a later canary (not created now)

- **Runtime:** dedicated `aura-canary-runtime@aura-rehearsal-20261011.iam.gserviceaccount.com`, **zero project/data/secret roles**, no keys. A static response requires no Google API permissions. A dedicated identity is safer than reusing the default Compute account because it avoids accumulated grants and separates runtime from builds.
- **Builder:** dedicated `aura-canary-build@aura-rehearsal-20261011.iam.gserviceaccount.com`. The supported `roles/run.builder` currently contains only six permissions: Artifact Registry upload/download/deleteArtifacts, `storage.objects.get`, `logging.logEntries.create`, `source.repos.get`. It has no Pub/Sub creation, build submission, bucket creation, IAM or billing permission. The legacy builder role has **78 permissions**, including topic create/publish, bucket/object writes and build operations. Live predefined-role definitions are retained in evidence. [Run Builder role](https://docs.cloud.google.com/iam/docs/roles-permissions/run)
- For this isolated, short-lived project, the supported project-scoped Run Builder role is the maintainable baseline. A custom role omitting unused `source.repos.get`, or repository/bucket-specific alternatives, could be narrower but is not yet validated with Google's managed buildpack path. Do not invent new permissions or claim that alternative passed a cloud build.
- **Deployer:** source-developer/service-usage permissions plus actAs on the two named SAs, service IAM-management and setup/cleanup permissions. Existing human Owner is preserved; no new Owner/Editor grant is proposed. Existing Owner is broader than a future CI identity should receive.
- **Invoker:** human `roles/run.invoker` only on the eventual service. No allUsers/allAuthenticatedUsers, token-creator grant, downloaded key, cross-project identity or invoker SA needed.
- **Platform agents:** preserve their service-agent roles. Neither runtime nor builder receives a service-agent role.

## 5. Preventing recurrence — capability and permission boundary

The operator's read-only `testIamPermissions` verifies project `getIamPolicy` and `setIamPolicy`, but **does not grant** `orgpolicy.policy.set` or `orgpolicy.policies.create/update/delete`. No extra role was granted, and no policy mutation was attempted. `iam.managed.preventPrivilegedBasicRolesForDefaultServiceAccounts` also reads as unenforced through the legacy policy endpoint; effective default reads are not proof that this operator can install a policy.

Desired future project policy, where supported and separately authorized:

1. Enforce `iam.automaticIamGrantsForDefaultServiceAccounts: true` before any service-account creation/API activation. This is not retroactive and does not prevent the legacy builder grant.
2. Keep `cloudbuild.disableCreateDefaultServiceAccount: true`.
3. Set `cloudbuild.useBuildServiceAccount: false` and `cloudbuild.useComputeServiceAccount: false` to require explicit user-specified builds rather than falling back to defaults, after eligibility and policy-write access are established.

Google supports project-level application of these constraints in an appropriate hierarchy, but **write eligibility for this No-organization project is not established**. Do not move the project, create an organization, enable Org Policy API, grant a policy-administrator role or attempt a policy write to discover eligibility. The currently missing write permission is sufficient to exclude policy installation from this approval request. [Cloud Build policy choices](https://docs.cloud.google.com/build/docs/cloud-build-service-account-updates#configure_the_default_service_account_for_an_organization)

Candidate command syntax for that **deferred, separately authorized** policy phase is `gcloud resource-manager org-policies enable-enforce iam.automaticIamGrantsForDefaultServiceAccounts --project=aura-rehearsal-20261011 --account=mirathfan@gmail.com`, followed by effective-policy verification. Likewise, `disable-enforce cloudbuild.useBuildServiceAccount` and `disable-enforce cloudbuild.useComputeServiceAccount` are future proposals only. Do not run these with the two-removal authorization.

Until policy enforcement is available, the enforceable controls are the removed bindings and explicit dedicated identities. Pre/post-activation IAM comparison and refusing to build on unexpected grants are operator checks, **not prevention of automatic platform changes**. Avoid API churn and repeat the audit immediately before any later build. A claim of guaranteed non-recurrence would be unsupported.

## 6. Exact proposed execution and verification

**NOT EXECUTED. This is the complete mutation scope requested for approval: two unconditional member/role removals on this project only.** No replacement grants, account deletion, API/policy/budget change, billing linkage or workload follows.

Before execution, capture fresh project/billing/IAM and default-SA metadata; verify exact ID/number/no parent/ACTIVE/unbilled, same expected member-role pairs, and no newly dependent workload. Stop for material changes. Store a fresh full IAM snapshot locally; do not restore an old whole policy over concurrent changes.

```sh
# Explicit target/operator on every command; no default-project change.
gcloud projects get-iam-policy aura-rehearsal-20261011 --account=mirathfan@gmail.com --format=json > /absolute/evidence/iam-before-removal.json

gcloud projects remove-iam-policy-binding aura-rehearsal-20261011 --member=serviceAccount:1087494190017-compute@developer.gserviceaccount.com --role=roles/editor --condition=None --account=mirathfan@gmail.com
# Inspect returned policy and a fresh read before the second mutation.
gcloud projects get-iam-policy aura-rehearsal-20261011 --account=mirathfan@gmail.com --format=json

gcloud projects remove-iam-policy-binding aura-rehearsal-20261011 --member=serviceAccount:1087494190017@cloudbuild.gserviceaccount.com --role=roles/cloudbuild.builds.builder --condition=None --account=mirathfan@gmail.com

gcloud projects get-iam-policy aura-rehearsal-20261011 --account=mirathfan@gmail.com --format=json
gcloud billing projects describe aura-rehearsal-20261011 --account=mirathfan@gmail.com --format=json
gcloud projects describe aura-rehearsal-20261011 --account=mirathfan@gmail.com --format=json
gcloud services list --enabled --project=aura-rehearsal-20261011 --account=mirathfan@gmail.com --format='json(config.name,state)'
gcloud iam service-accounts describe 1087494190017-compute@developer.gserviceaccount.com --project=aura-rehearsal-20261011 --account=mirathfan@gmail.com --format=json
```

Use the installed official CLI by absolute path, or a process-local PATH containing `/Users/athfan/.local/aura-tools/google-cloud-sdk/bin`; no profile/global default changes. `remove-iam-policy-binding` performs a targeted IAM read-modify-write. Stop on concurrency/permission errors, re-read and reassess; do not use an old full-policy replacement or retry a mutation blindly.

Postconditions: exactly two members removed from their specified roles; remaining five bindings and any unrelated concurrently reviewed state preserved; Compute SA still exists/enabled; no new keys; APIs equal the 31-name before set; billing still disabled; budgets untouched; no workloads created. Metadata verification does not exercise denied API calls as the default SA; no impersonation or paid test is required for this remediation.

### Safe rollback / partial failure

There is no observed workload needing these grants. If the first removal succeeds and the second fails, retain the safer partial result, stop and report. Keep billing disabled. Do not restore Editor automatically merely to make the operation look atomic.

If a real dependency is discovered later, prefer the exact missing least-privilege permission on a dedicated identity. Only with separately approved emergency restoration, re-add the specific removed binding to the current policy; never apply the old full snapshot over current IAM:

```sh
# NOT part of the two-removal approval; privileged restoration requires separate approval.
gcloud projects add-iam-policy-binding aura-rehearsal-20261011 --member=serviceAccount:1087494190017-compute@developer.gserviceaccount.com --role=roles/editor --condition=None --account=mirathfan@gmail.com
gcloud projects add-iam-policy-binding aura-rehearsal-20261011 --member=serviceAccount:1087494190017@cloudbuild.gserviceaccount.com --role=roles/cloudbuild.builds.builder --condition=None --account=mirathfan@gmail.com
```

No API rollback is needed because this proposal changes no APIs. Future dependency changes need their own forward-recovery plan and authorization, including checking whether re-enablement recreates grants.

## 7. Spending safeguards and outstanding reviews

Fresh Console observation on November 11:

- Alert budget **5f917c50-235c-4cb5-bb70-076c77aa8ba5**, `aura-rehearsal-all-services`, remains: monthly $25, project **1087494190017**, no credits, displayed actual thresholds 2/4/8/20% and forecast 8%, reported $0. No budget was edited or deleted.
- Run cap **062874a3-795e-402e-bec2-6997434fba45** is **no longer listed**. Its previously verified direct URL returns **“Unable to find the resource you requested.”** Therefore the earlier report's claim that both budgets remained must not be relied on.
- Google documents deletion of old-account spend caps when a project moves billing accounts. Disappearance following this project's unlink is consistent with billing-association lifecycle behavior, but the precise deletion actor/event has not been verified; it is an inference, not an audited causal claim. Any future billed run must recreate/verify a $1 cap under its new approved execution plan before provisioning. Do not relink billing to investigate this now. [Spend-cap lifecycle](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)
- Rehearsal-filtered November 1–11 cost report remains **$0.00**, no SKU rows, insufficient data for provider forecast. Scope is encoded in its URL; this layout has no separate selected-project chip. This is delayed report evidence, not final liability or a hard cap.
- The 24-/72-hour reviews are **not yet due/completed**: November **12 and 14 at approximately 15:11 UTC / 09:11 CST**. Preserve the surviving alert budget until both reviews finish; record the missing cap rather than trying to delete it. No reminders/automations were installed.

No workloads or build artifacts are identified; no paid execution ran. Billing remains unlinked. Retained audit/default Logging data and any delayed charges from the prior linked window remain possible exposure. No $25 enforceable hard total limit exists. IAM-only removals introduce no workload resource, but this is not a promise of a finalized zero invoice.

## 8. Verdict, validation and approval request

| Gate | Result |
|---|---|
| Exact target / billing disabled / broad bindings identified | **PASS** |
| Human permissions for two targeted IAM removals | **PASS** |
| No dependent workloads identified / defaults distinguished from agents | **PASS**, bounded by documented inventory coverage |
| Exact two-removal proposal and expected after-state | **PASS — READY FOR APPROVAL** |
| Safe API disablement dependencies | **FAIL / BLOCKED** — read methods unavailable; no disablement proposed |
| Automatic-grant policy installation | **FAIL / BLOCKED** — missing policy-write access/eligibility |
| Surviving alert-budget preservation | **PASS** |
| Old Run cap still installed | **FAIL** — no longer listed, direct lookup not found |
| 24-/72-hour cost reviews complete | **PENDING** — not yet due |
| Canary resumption / external beta | **NOT READY / NO-GO** |

Fresh root lint: **PASS, 0 errors / 9 existing warnings**. Proposal JSON parses and the two removals preserve the remaining bindings; source preservation and `git diff --check` are recorded. No application/native/backend tests or cloud runtime tests are claimed here because this task changes documentation and inert configuration only.

**Approval requested:** remove only `roles/editor` from `1087494190017-compute@developer.gserviceaccount.com` and `roles/cloudbuild.builds.builder` from `1087494190017@cloudbuild.gserviceaccount.com`, on `aura-rehearsal-20261011`; verify the postconditions and stop. This excludes all role additions, policy/API changes, budget changes, SA deletion/creation, billing linkage and canary deployment. Explicit approval is required by the user's P1-10C restriction before either removal.
