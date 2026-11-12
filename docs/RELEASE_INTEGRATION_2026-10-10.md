# P1-06 — Integrated release readiness and safe deployment plan

**November 11 infrastructure gate:** [Phase 2B canary results](PRIVATE_HEALTH_CANARY_EXECUTION_2026-11-11.md) supersede the older bootstrap banners. Spending cap/alerts installed successfully, but API activation produced unapproved dependencies and automatic Editor, so execution stopped before deployment. No cloud application behavior was validated. Billing is disabled again; residual IAM/API state needs a scoped remediation review. **NOT READY TO DEPLOY; external beta NO-GO.**

**Phase A execution — November 4: STOPPED ON UNEXPECTED BILLING.** The one authorized creation attempt succeeded: `aura-rehearsal-20261011`, number **1087494190017**, No organization in console. The project is unexpectedly listed as linked to **01B4D2-62CAD1-5848FD** despite no separate billing-link action. Per the user's stop instruction, no unlink/correction or further IAM/resource inspection was performed. Raw lifecycle state and absence of billable resources are not certified. [Bootstrap evidence and remaining requirements](REHEARSAL_BOOTSTRAP_2026-11-04.md). **Phase 2 NOT APPROVED / NOT READY; external beta NO-GO.** This execution result supersedes earlier “project not created/creation pending” status below.

**November 4 safeguards update:** Mir Athfan Ali has explicitly confirmed billing/on-call ownership, `mirathfan@gmail.com`, No organization/no folder and the $25 intended budget. [Final safeguards and creation plan](REHEARSAL_SAFEGUARDS_2026-11-04.md) supersede the unresolved ownership requirement and initial large rehearsal below. Current console metadata reconfirmed the production-only $5 alert budget and Billing Admin; no new project/control exists. **Empty unbilled bootstrap is ready for final approval only; billable provisioning remains NOT READY.** Later paid scope is reduced to one private health function/one build with no data, AI or scheduled workers. No creation, cloud mutation or production Firebase access occurred; external beta **NO-GO**.

**November 4 local validation:** packaging tests 3/3 and proposal consistency/whitespace checks pass. Standard lint is blocked by absent local executable links; direct source-scope ESLint reports two unresolved `expo-vision-bg` imports plus nine warnings (local package directory exists, installed link missing). Application/dependency files were not modified. Historical passing lint below is not a fresh November 4 result. See [current safeguards report](REHEARSAL_SAFEGUARDS_2026-11-04.md#local-validation-and-preserved-state).

**P1-10B final read-only preflight (October 11): NOT READY FOR PROVISIONING.** [Spending/permission findings and staged approval request](REHEARSAL_AUTHORIZATION_PREFLIGHT_2026-10-11.md) confirm **No organization/no folder**, billing-association authority, and an existing **$5/month production-only alerts budget** (actual $2.50/$4.50/$5; billing-role email, no cap). The creation form shows 10 projects remaining; global ID availability is not confirmed. Run/Functions service caps do not enforce a $25 whole-project bill; rehearsal controls/harness remain uninstalled. Deny Admin is **not required for ordinary isolated rehearsal**; the production deny/drain experiment remains separate. Final billing responsibility and resource-creation approval are still pending. No cloud mutation; external beta **NO-GO**.

**P1-10 operational handoff (October 11):** [Cloud rehearsal package](CLOUD_REHEARSAL_2026-10-11.md) supplies the exact 48-live/57-candidate source/dependency inventory, isolated local packager and approval-scoped creation/deploy/drain/publication steps. No approved rehearsal project exists in the inspected account. **NOT READY FOR CONTROLLED DEPLOYMENT; external beta NO-GO.** No deployment or app/backend implementation change occurred.

**Decision: NOT READY TO DEPLOY. External TestFlight beta: NO-GO.**

**P1-09 preflight (October 11) supersedes earlier deployment commands, phase/export counts and cloud-state claims:** [Production preflight and controlled runbook](PRODUCTION_DEPLOYMENT_PREFLIGHT_2026-10-11.md). Fresh metadata: 48 old functions versus 57 candidate exports; active rules remain HEAD; recovery schedule and Apple secret absent; candidate group indexes absent; eight existing indexes READY. Aggregate counts found zero durable deletion/index/media jobs and zero root legacy product-cache documents. Bucket metrics report 2,267 objects / 469,821,396 bytes; per-user references/capacity remain uninspected. Public copy remains stale, mailbox and ASC distribution unverified. Proposed additive index, independent invocation hold and maintenance-rule files are inert and require isolated rehearsal/approval. **NOT READY FOR CONTROLLED DEPLOYMENT / external beta NO-GO.**

**Latest P1-08 update:** shared-media retirement/admission passes local concurrency and recovery tests. [MEDIA_LEGACY_COMPATIBILITY_2026-10-10.md](MEDIA_LEGACY_COMPATIBILITY_2026-10-10.md) supersedes the shared-reference limitation and Build 9 behavior described below. New cleanup is operator-gated off by default. Build 9 protected writes require upgrade, and its account-deletion requests are rejected before new acceptance. Legacy inventory/capacity, distribution transition, old-Admin drain, cloud configuration, publication and physical-device gates keep deployment blocked. The latest candidate has 57 exports; no cloud change or fresh production inspection was made in P1-08.

**P1-07 update (October 10): the reproduced ingestion database resurrection is fixed and passes local regression coverage.** Current evidence and limitations are in [PHOTO_INGESTION_RACE_2026-10-10.md](PHOTO_INGESTION_RACE_2026-10-10.md). The matching client now requires callable-based item deletion, and source exports increase from 55 to 56. Configuration, mixed-version rollout control, shared-media reference lifetime, public disclosures and deployed/device verification still prevent deployment approval. P1-06 cloud metadata below is historical read-only evidence; P1-07 made no cloud changes or fresh cloud inspection.

Reviewed October 10, 2026 on `main`, base `06ece001c69cb6a84787cebddd521f883ffccb66`, plus the entire existing working tree. Read all six requested reports and checked current source, installed/locked dependencies, tests, exported function metadata, and read-only cloud configuration. This report supersedes earlier reports where they describe current deployment or unresolved indexing behavior. Earlier test/runtime results remain historical evidence.

**Actions taken:** local checks and synthetic emulator probes; read-only Firebase/Google Cloud/EAS metadata and public website/DNS requests; documentation. **No** deployment, provisioning, secret access/change, Git push, EAS build, submission, authenticated production request, support email, or live user-document/object read/write. Secret Manager version metadata was read, never secret payloads. No application, native, rules, dependency, UI, styling, or Photo Refinement source was changed in this task.

Evidence: [release-integration-2026-10-10](../../qa-artifacts/release-integration-2026-10-10/). Logs, sanitized metadata, original file hashes, complete per-file and dependency inventories, proposed additive index configuration, and the ingestion reproducer are retained there. Audit metadata is operational material, not intended for public distribution.

## 1. Deployment blockers and required decisions

| Priority | Finding verified now | Required closure / owner |
|---|---|---|
| Closed locally / P1-07 | **Delayed ingestion database resurrection fixed.** Original stale-event bug reproduced before editing; current handler passes provider-wait, pre-commit deletion, edits, cancellation, duplicate/current-creation, consent and recovery tests. | Atomic item deletion/fences, guarded ingestion/import writes, immutable output paths and expanded recovery must deploy with the matching client. Actual cloud delivery and the documented shared-media reference consistency limit remain gates. |
| P1 | **No verified maintenance/upgrade control for mixed revisions.** P1-08 adds an updated-client minimum-contract notice, server AI pause and cleanup activation controls. Build 9 cannot read the new notice; these controls cannot stop an old Admin revision. New rules cannot constrain old Admin SDK workers. Function updates are not atomic. | Release/security: implement or rehearse an effective maintenance procedure across public invocations, direct client writes, scheduled work and event delivery; drain/verify old revisions before enabling consent acceptance and new deletion acceptance. Do not approve a blind combined deploy. |
| P1 | **Required cloud setup is absent in the P1-06 snapshot.** Seven then-new functions absent; P1-07 adds `deleteClosetItem` to the required deployment; recovery schedule absent; `wardrobeIndexJobs.dueAt` group index absent; Apple revocation secret absent. Project IAM lacks the explicit Storage cross-service Firestore rules role. | Cloud owner: approve configuration/provisioning, validate scoped IAM, index READY state and actual delivery in an isolated environment. See inventory/checklist. |
| P1 | **The repo index manifest omits two live vector indexes.** Live has eight READY composites; source lists six plus the new field override. | Backend/cloud: merge the two vector specifications before any indexes deployment; review the prepared additive proposal. Never accept deletion prompts or use force to remove remote indexes. |
| P1 | **Build 9 cannot manage consent or asynchronous deletion, and new item rules deny its direct item deletes.** Backend-first deployment safely denies missing consent, but disrupts AI and Apple deletion; P1-08 now rejects missing durable-deletion acknowledgements before new acceptance. Build 9 hides the explanatory server message and still requires a controlled distribution transition. | Product/release: approve a mandatory upgrade/maintenance communication and recovery plan; validate old and new client contracts. Do not grandfather consent or weaken deletion fences. |
| P1 | **Public disclosures are stale.** Privacy, terms, support and deletion pages return 200, but still use the older contact address. Privacy is dated August 15 and lacks the new consent/tombstone disclosures. | Owner/web: publish reviewed policy/contact/deletion copy without accidentally shipping unrelated website work; verify support@getaura.app receipt/reply and App Store answers. |
| P1 | **No current native or deployed end-to-end proof.** Existing simulator artifact predates P1-02–P1-05. | QA/release: approved isolated cloud smoke, newly approved Xcode 26 candidate, iOS 26.5/27 and physical Apple/Google/device matrix. No build is authorized by this report. |
| Decision | Live SerpApi search is unconfigured; extraction has its existing two-per-month early-access allowance; >500 wardrobe documents fail structured retrieval explicitly. | Product: agree Beta 1 scope and quotas. Curated shopping is available; live search must not be described as operational. |
| Decision | Retention: app bucket soft delete 7 days; Firestore PITR off; no backup schedules returned; logs 30/400 days; cache/job cleanup gaps. | Privacy/operations: approve retention, recovery and support procedures; never restore deleted-account data without reapplying permanent fences and deletion requests. |

The ingestion probe is an **expected reproduction of a bug**, not a passing release behavior test. It uses the real exported trigger against local Firestore. It does not demonstrate account-fence bypass or a production incident. `probe-stale-ingestion.cjs` and its log preserve the exact sequence and clean only its synthetic UID. P1-07 implemented and retested the transactional guards; the original probe/log remain historical failing-behavior evidence.

P1-07 adds scheduled recovery for persisted ingestion claims and generated-media cleanup, and transactionally rechecks draft-cleanup eligibility/version before deletion. The trigger still has no delivery retry; failures before a persisted claim need a later source event/manual retry. Indexing starts once the item is eligible. Daily draft cleanup still scans at most 500 users/100 drafts each/1,000 deletions and can starve later users. Save/wear/plan partial multi-write behavior and listing inactive records before filtering remain prior release risks. These should not be hidden by the green indexing tests.

## 2. Working-tree reconciliation and dependency closure

At start: **109 modified tracked files + 75 untracked files = 184 changed files** when directory entries are expanded. No staged conflicts, unmerged paths, or conflict markers found. All 804 initially inventoried source files survived unchanged until the report edits. Exact file/status/classification/start SHA-256: [working-tree-inventory.tsv](../../qa-artifacts/release-integration-2026-10-10/working-tree-inventory.tsv). Do not equate HEAD with the tested artifact.

| Change group | Release treatment |
|---|---|
| P1-02 routes, auth helpers, root gate, Router/Jest transform coverage and Sentry URL scrubbing | Include together; untracked `app/+native-intent.tsx`, reset route and `src/navigation`/auth helpers are required imports. |
| P1-03 privacy routes/provider/client, `shared/aiConsent.ts`, bundled/generated policy, backend transport/consent/resume helpers | Include together; client consent without matching callable/rules is unusable; backend gate without upgraded app is disruptive. |
| P1-04 lifecycle/storage/Apple/deletion helpers, deletion UI/provider, all guarded writers and rules | Include as a dependency closure; do not cherry-pick only the deletion callable. |
| P1-05 queue/policy/retrieval helpers, tests, trigger, scheduler, quotas, rules and group index | Include as a dependency closure; helper is invoked by the P1-04 scheduler, which now needs OpenAI secret access. |
| Native app/plist/project version 9, Podfile minimum-target/lock reconciliation, EAS Xcode pin | Prior release prerequisites; retained. No prebuild/Pod regeneration here. |
| `package.json`/lock: pre-existing `expo-mcp` tooling addition and resolved dependency changes | Preserve; not introduced by P1-06 and not required by the four fixes. Review separately when selecting a clean release snapshot; never discard lockfile wholesale. |
| `.agents`, `skills-lock.json`, `.maestro`, website AGENTS/CLAUDE files | Pre-existing tooling/test assets; preserve, independently review packaging. |
| Website landing/reel/CSS/layout/logo/favicon and waitlist API changes | Pre-existing separate product work; not prerequisites for backend rollout. Website contact/config files contain mixed changes and require hunk review. Publishing all of `website/` would also publish these changes. |
| Root release/privacy/terms/metadata documentation, new emulator scripts and reports | Required release evidence/disclosures; include necessary untracked files in any future reviewed commit. |

No missing imports were found by app TypeScript, functions build, website build or the local iOS JS export. `functions/tsconfig.json` includes `../shared`; the build emits `functions/lib/shared` and `functions/lib/functions/src`, and `scripts/write-main.cjs` supplies the deployment entry. Deploy from the full repository after predeploy build; copying only `functions/src` without shared inputs is not reproducible.

Complete direct dependency inventory (requested, locked, installed versions; manifest and lock hashes): [dependencies.json](../../qa-artifacts/release-integration-2026-10-10/dependencies.json). App has 53 runtime/13 development dependencies, functions 9/10, website 7/8. Installed direct versions match their respective lockfiles; no dependency installation/migration was made in the repository.

Important resolved versions: Expo **54.0.37**, RN **0.81.5**, React **19.1.0**, Router **6.0.24**, Firebase JS **12.9.0**; Admin **13.10.0**, Functions **7.3.2**, OpenAI **5.23.2**, LangChain core **1.1.48** / LangGraph **1.4.13**. Earlier prose says Router 6.0.21: that is the manifest range's minimum, not today's installed resolution. Today's Router integration tests exercise 6.0.24. Website Next **16.3.1**/React **19.2.7** is a separate dependency tree, not an app React migration.

EAS has no `.easignore`; `.gitignore` exclusions apply, with native tracked files included. Filename/content heuristics found no local credential input in the tracked/nonignored source inventory; the sole private-key signature match was a literal placeholder in `website/.env.example`. Local `.env*`, signing files and `credentials.json` are ignored; no functions `.env*` files were found. This is a local input review, not a new EAS archive/upload audit or a comprehensive secret scanner. Recheck the exact future archive, generated files and source maps before authorizing upload. Build products include source maps; prevent credentials from entering source in the first place.

## 3. Current cloud state and deployment dependency inventory

Project `closet-app-57146` / number `1043970871162`; default Firestore `nam5`; functions `us-central1`, Node **22**, gen 2. Current read-only `functions:list` returned **48 ACTIVE** functions; P1-06 compiled export discovery returned **55**; P1-07 now returns **56**: 46 callable, 3 HTTP, 5 event and 2 scheduled. All 48 names remain exported; **no unexplained retired/orphan endpoint names**. This is name/configuration parity, not a fresh comparison of every deployed source archive. Earlier audit source sampling established the old baseline; current live rules exactly match HEAD and differ from the working rules.

| Resource | Current remote observation | Candidate dependency / action |
|---|---|---|
| Firestore rules | Old rules match HEAD | Deploy consent read-only, owner-only index status, permanent deletion-fence checks, server-only internal jobs together with all privileged writer changes. Rules do not restrict Admin SDK. |
| Storage rules | Old rules match HEAD | New `firestore.exists(accountDeletionJobs/uid)` requires cross-service IAM. Validate authenticated image/audio upload/read/delete before/after fence; token download URLs persist until removal. |
| Composite/vector indexes | 8 READY: six ordinary item composites, `items.embeddingVector` and `styleMemories.embeddingVector`, both 2048 | Preserve all eight. Prepared [firestore.indexes.proposed.json](../../qa-artifacts/release-integration-2026-10-10/firestore.indexes.proposed.json) adds existing vector definitions to current source's group-field change; review before copying into the release manifest. |
| Single-field indexes / TTL | Only default ancestor configuration returned; no explicit field overrides; separate TTL-filtered query returned zero policies | Add `wardrobeIndexJobs.dueAt` ascending COLLECTION_GROUP and COLLECTION. `accountDeletionJobs.dueAt` uses ordinary automatic collection indexing. No TTL cleanup is configured. Any future counter/cache TTL requires separate review; never TTL deletion tombstones. |
| Firestore event delivery | Two existing triggers in **nam5**: ingestion and indexing, currently no retry | Candidate indexing retry true; add creation triggers for `users/{uid}/aiConsentJobs/{jobId}` and `accountDeletionJobs/{uid}`, retry true. Ingestion remains retry false. |
| Scheduler | One enabled daily draft-cleanup job, 03:15 America/Chicago | Add `recoverAccountDeletions` every 5 minutes: 512 MiB, 540 seconds, maxInstances 1/concurrency 1, OpenAI binding. It services BOTH deletion (10 due accounts) and indexing (40 due items, pool/leases 4). It is new to live, although reused by P1-05 in local P1-04 code. |
| Storage Eventarc | No existing finalization trigger in us-central1 | Add `removeDeletedAccountUpload`, retry true, **actual** bucket `closet-app-57146.firebasestorage.app`, exact-generation deletion. Verify location/service-agent publishing and event delivery. Local discovery with a demo project infers a demo bucket; it is not the deploy manifest. |
| Secret Manager | Only `OPENAI_API_KEY`, versions 1 and 2 ENABLED; deployed AI uses 2 | Preserve existing key; scheduler needs binding/access. `APPLE_REVOCATION_PRIVATE_KEY` absent. No secret payload read. SerpApi secret absent and code has no binding for it. |
| Cloud Tasks | API query returned SERVICE_DISABLED/403 | No queue, Cloud Tasks code path or provisioning required by candidate. Do not enable Tasks to implement this plan. |
| Enabled APIs | Functions, Run, Build, Artifact Registry, Eventarc, Pub/Sub, Scheduler and Secret Manager present | New deployment still creates functions/triggers/schedule and may update IAM; existing APIs alone do not mean permission/configuration complete. |
| Runtime identity | Current functions use default compute service account; project grants Editor, Eventarc eventReceiver and Run invoker | Broad trust remains a risk. Review least privilege and all other Admin writers; don't combine an untested service-account migration with rollout. |
| HTTP/Run IAM | Read all 48 service policies; 45 have `allUsers` Run invoker | Public transport is expected for Firebase callable SDK; app-level token checks still required. It is also a surface that maintenance must actually close. Existing project-level invoker/Editor permissions mean removing a service binding alone need not stop event workers. |
| Storage cross-service IAM | No explicit `roles/firebaserules.firestoreServiceAgent` project binding for Firebase Storage service agent | Grant after approval; permission is `datastore.entities.get`. Current CLI skips interactive IAM setup under `--non-interactive`; never assume automated rules deployment grants it. Inherited/effective organization permissions not fully audited. |
| Storage retention | App bucket in us-central1; soft-delete retention **604800 seconds (7 days)**; no enabled versioning returned for that bucket | Normal account deletion removes live objects, not immediate purge of recovery copies. Source bucket separately has versioning and lifecycle; do not confuse it with the app bucket. |
| Database/log retention | PITR disabled, versionRetentionPeriod 3600s, no backup schedules; global `_Default` log bucket 30 days / `_Required` 400 days | These are configuration observations, not absence of every export/backup/log sink. Provider/Sentry/waitlist retention still requires owner confirmation. |

All export names/options are in the final appendix and [local-endpoints.json](../../qa-artifacts/release-integration-2026-10-10/local-endpoints.json). Cloud metadata uses names/settings only; no user collections or object listings were inspected.

### IAM and credentials checklist

- [ ] Release operator: reviewed access to Functions/Run deployment, Build/Artifact Registry, Firestore rules/indexes, Eventarc/Scheduler, and `iam.serviceAccounts.actAs` for the selected identities. IAM/secret changes require separate explicit approval; avoid using an Owner account as a permanent deployment solution.
- [ ] Runtime: scoped Firestore get/list/transaction/create/update/delete; Firebase Auth get/delete for deletion and provider lookup; Storage object read/write/delete/list for existing processing and prefix cleanup; Secret Accessor on exact bound secrets. A roles/datastore.user + appropriate Auth/Storage role design must be validated rather than removing existing Editor blindly.
- [ ] Firebase Storage service agent `service-1043970871162@gcp-sa-firebasestorage.iam.gserviceaccount.com`: `roles/firebaserules.firestoreServiceAgent` on project, with propagation and real rules tests.
- [ ] Eventarc identity: eventReceiver and target Run invoker; Google Cloud Storage service agent's Pub/Sub publisher for direct Storage events; retain service-agent roles. Explicit Storage publisher grant is not present in the project snapshot; confirm effective IAM before provisioning. Existing Pub/Sub service agent has Token Creator. Do not grant service-agent roles to humans.
- [ ] Scheduler: existing service-agent role and OIDC invocation identity/target audience; selected invoker can reach new recovery function. Verify schedule, region, concurrency, errors and two consecutive actual deliveries.
- [ ] Apple: create/provide the **Sign in with Apple ES256 key** as `APPLE_REVOCATION_PRIVATE_KEY`, with an enabled version and access only to the revocation runtime as far as the chosen shared identity permits. Team ID and key ID parameters currently have empty defaults; client ID defaults to `com.kasat.aura`. Configure all three explicitly for the chosen environment. A shared runtime SA's secret access is not true per-function isolation; secret binding limits exposure in environment, not IAM rights of that identity.
- [ ] Apple Developer owner: confirm key capability, team/bundle/App ID grouping/audience, entitlement in new provisioning, key validity/rotation owner and private-relay email domains/senders if used. Firebase Apple provider is **enabled**, but returned `appleSignInConfig` is empty; this does not prove the required revocation credentials exist. Apple portal key/app configuration and operator permission were not verified.
- [ ] Do not reuse App Store Connect API keys, distribution certificates or Firebase service-account keys as Apple revocation credentials. Do not put Apple/OpenAI/SerpApi secrets in EXPO_PUBLIC variables, git, logs, test fixtures or a public website.
- [ ] Real Apple exchange/revoke, cancellation, expiry, wrong/linked subject and fallback: physical device and approved dedicated account required. Explicit manual fallback remains an availability path, not evidence of successful revocation.
- [ ] Optional live shopping: approve SerpApi account/budget and a **server-only secret binding change** before enabling `PRODUCT_SEARCH_ENABLED=true`. Current code reads `SERPAPI_API_KEY` from environment with no Secret Manager binding; do not provision it as a public/plain committed value. Review Skimlinks separately; `SKIMLINKS_ID` is unset in live metadata. When enabled, affiliate wrapping can place UID in `xcust`; require minimization/tracking review before enabling.
- [ ] Sentry organization/project/source-map credentials and retention owner; controlled diagnostic delivery without action codes, tokens or private content. Never turn on context/candidate debug flags for a public beta.
- [ ] Budget/quotas/alerts, permanent tombstone retention, legacy-cache purge decision, backups/restore procedure, mailbox owner and support recovery workflow approved.

## 4. Consent, deletion, indexing and feature behavior

Provider entry paths reviewed include chat/stream/agent/generation, query/item/style-memory embeddings, photo ingestion, product previews/imports, outfit extraction/layout, audio transcription, feedback learning and SerpApi search. Constructors/raw HTTP use the shared transport; request UID comes from authenticated callable/HTTP or trusted event paths. Fresh consent version/revision and deletion checks occur at transmission, retries and response completion; listeners attempt cancellation. Streams already consumed and data already sent cannot be recalled; there is no distributed transaction with the provider.

`users/{uid}/privacy/aiConsent` is server-written/versioned; missing/outdated/declined/revoked decisions fail closed. Accept creates resumable pages of up to 50 item writes. Client cache approval cannot cross accounts. Deletion acceptance creates an external permanent fence, then leased Firestore/Storage/rate-limit cleanup, a ten-minute settling interval, final sweep, Auth-last and minimal tombstone. New privileged writes serialize with account deletion. Storage cleanup is eventual across services, including delayed finalize events. No other administrator's scripts or old function versions are covered by source guards.

Index jobs read current documents, pin item creation/hash and consent revision, lease one of four slots, reserve unchanged 10/minute and 50/day quota, and commit vector plus job completion atomically. Eight attempts plus one explicit bounded extra cycle; quota waits do not burn attempts. No exact-once provider billing guarantee. A crash after response/before commit can repeat paid work. Missing enqueue events after the event retry window require approved reconciliation. Consent resumption has no scheduled rescue scanner; failed/missed create events past the delivery window need a controlled revision-aware page replay. Never rewrite acceptance on behalf of a user to repair a queue.

The shared scheduler couples deletion availability to its OpenAI secret being mountable at startup; an invalid binding can prevent even non-AI deletion recovery. Deletion and indexing helpers start independently once the initial deletion due query succeeds; an error in that initial query prevents both. Keep the OpenAI binding healthy or forward-deploy a deletion-capable recovery variant during provider-secret incidents. Do not pause this entire scheduler just to pause AI after deletion requests exist.

| Feature | Current local implementation under intended rules |
|---|---|
| Ordinary upload, manual closet edit/delete, local/native background removal, saved browsing, profile/settings | Not dependent on AI consent for active accounts. Automatic ingestion pauses without consent; account deletion intentionally denies access. Server image-processing inside AI ingestion is not promised as a separate no-consent service. |
| Styling/chat/generation/extraction/layout/embeddings/voice | Available with valid consent and existing quotas, subject to provider configuration and current ingestion blocker. Extraction's existing early-access allowance is 2/month; no quota increase was made. |
| Save/wear/plan/dislike and manual planning | Core persistence remains available without consent; optional style learning is skipped. Existing multi-write/idempotency limitations still need journey tests. |
| Shopping | Curated deterministic fallback available; imports require consent for AI extraction. Live SerpApi search presently disabled/unconfigured remotely. |
| AI Photo Refinement / Polish | **Disabled in candidate server source** by `BETA_AI_FEATURES.aiPolish=false`, including old power-account flags. Both Polish endpoints remain exported but deny use; automatic extraction Polish budget is 0. Existing layout generation is separate and enabled. Do not claim old deployed code now has this hard disable. |

### Data/schema migration inventory

Additive schemas: privacy consent; consent continuation jobs; private Apple proof; external deletion job/tombstone; per-item indexing jobs; anonymous global slot map; per-user product cache. No destructive database migration or global historical backfill runs on deploy. Existing users are unapproved until explicit consent. Acceptance may enqueue all eligible historical items. Legacy embeddings remain usable if valid; missing/stale vectors get structured fallback. Backfill/reindex APIs now return queued state instead of synchronous `indexed` success; no in-repo consumer was found, but external tooling must adapt. More than 300 items needs paginated backfill (100/page, existing 1/day invocation quota), not repeated forced whole-account jobs.

Do not TTL/delete completed tombstones or reset leases/quota counters blindly. `expiresAt` in product caches is a numeric lookup expiry, not automatic Firestore deletion. Rate counters use Timestamp expiries, but expiry fields alone do not enable TTL; the separate remote TTL query confirmed zero policies. Old global product cache cannot be attributed reliably to a UID and needs an approved global retention/purge decision. Consent continuation records persist until account deletion; repeated decisions accumulate records/operations and are not rate-limited by a dedicated consent quota. App attestation is not enforced; per-UID paid limits do not cap project spend from account churn.

## 5. Build 9 compatibility and release-number ownership

Read-only EAS history still shows production build 9 `f99e432e-1d39-464b-b73d-7aef91cc212b`, source `541157db46bb5289b2e1459a38ef7b2f2deeb3d4`, and simulator build 9 `adc8a66b-74df-4174-8862-118b7684c45b`, base `06ece00` plus its archived dirty source. Build-9 deletion source was checked at its EAS-recorded commit: it ignores returned data and signs out after any fulfilled callable. This is source-based compatibility evidence, not an authenticated run of the store artifact; its full uploaded dirty state is not reconstructed here.

| Pairing | Expected behavior and risk |
|---|---|
| Old app + new backend, no current consent | AI calls fail closed; old app cannot accept. Chat/import/generation fail; photo upload can pause in a state old UI does not explain. Manual operations and reads remain subject to normal active-account rules. |
| Old app + new backend, consent granted on new app | Consent is account-wide: old app may use approved AI. It still cannot revoke/manage it or show new deletion progress. Do not mistake consent for a minimum-build gate. |
| Old app requests deletion | Fresh email/Google request may return pending/`ok:false`; old client still signs out. Old timeout may occur after acceptance. Stale auth fails; Apple-linked account lacks fresh proof/fallback parameter and fails. Server recovery can finish accepted jobs, but UX/support are inadequate. |
| New app + old backend | `setAiConsent`/status/revocation endpoints missing. AI checks fail closed, but old deletion callable lacks the new guarantees. **Do not expose the new client to that backend.** |
| Partial backend rollout | Old Admin writers can bypass new fences, old AI transport can bypass consent, and absent/misconfigured workers strand work. Rules alone cannot fix this. |

No zero-disruption backend-first rollout is approved. Notify existing testers of required upgrade and maintenance; stopping a TestFlight group alone is not proof already installed clients cannot make requests. No automatic consent migration, bypass flag or old-client exception is acceptable. Keep a support path for pending deletion if a legacy client signs out.

`eas.json` retains `appVersionSource: local`; app.json, native Info.plist and both Xcode configurations are baseline **9**, marketing **1.0.0**, bundle `com.kasat.aura`. Both store profiles auto-increment; simulator does not. `beta-simulator` inherits `macos-sequoia-15.6-xcode-26.0`, Release/simulator=true. Next store build is expected to be **10**, but a release owner must reserve/check App Store Connect immediately before authorization; read-only EAS history is not an ASC reservation check. Do not launch two local-version builds concurrently.

Installed local Xcode is **27.0 (27A266a)** only. It is not the pinned EAS toolchain. Keep SDK 54 and the hand-maintained project; no `expo prebuild --clean`, scene patch or Expo migration. The previous exact Xcode 26 simulator artifact passed launch/lifecycle on 26.5/27, but predates all four fixes. Local JS/Hermes export here is not native compilation, signing, launch or OAuth evidence.

## 6. Privacy publication and retention decisions

On October 10, anonymous HTTPS GETs returned **200** for canonical `/privacy`, `/terms`, `/support`, `/delete-account`; response hashes and extracted text are in `publication-check.json` / `public-*.txt`. The web search fetcher could not retrieve the pages; direct HTTP checks did. Availability is therefore observed from this machine, but **correct publication fails**: contact remains the old personal address and policy retains the inaccurate “anonymous hashed identifier” language, omits explicit new AI permission, and deletion describes the old synchronous behavior. Terms are still owner-approval draft copy. Publish approved current content and verify from a second unauthenticated connection/device.

`support@getaura.app`: Google MX records exist. This proves routing configuration only, not that the mailbox exists, receives messages, or has a monitored owner. Owner must authorize a benign receipt/reply test (including spam filtering and Apple private-relay flow if applicable). No message was sent. Keep canonical URLs and email unchanged in source; bundled in-app policy remains available offline.

App Store Connect answers remain draft/not submitted. Reconcile linked contact/UID, photos/audio/other user content and derived embeddings, first-party interaction analytics, pseudonymous Sentry diagnostics, consent/deletion identifiers, precise weather location, calendar-derived context and body/fit data. The existing draft's blanket Health & Fitness exclusion conflicts with its later measurement-review caveat; owner must resolve classification. Consent is not an exemption from disclosure. No-tracking requires actual affiliate/provider settings review; review UID affiliate tags before enabling them. Confirm final minimum age/rating and legal owner approval.

Retention decisions required: approve the observed 7-day Storage soft-delete interval and corresponding disclosure; distinguish live-object deletion from recovery-copy expiry. Firestore PITR is disabled and no backup schedule was returned, but managed exports/other copies are not excluded. Review 30/400-day Cloud Logging buckets and sinks, Sentry retention, OpenAI account data controls (`store:false` is not zero retention), SerpApi retention if enabled, mobile offline caches/OS backups, permanent UID tombstones and stale per-user caches/jobs/counters. Restore procedure must preserve/reapply deletions rather than resurrect data.

Website waitlist writes name/email through Apps Script or Sheets credentials; it is independent of Firebase UID cleanup. No waitlist rows were read. Define owner, access, deduplication, retention period, removal request verification and deletion/backups in Sheets/Apps Script. The current API has a honeypot but no demonstrated robust rate limit and can append duplicates under concurrent read-then-append; those pre-existing website changes need a separate privacy/abuse review before publication. Do not invent a retention period or claim app deletion clears waitlist data.

## 7. Tests run and limitations

| Check | Fresh observed result |
|---|---|
| Client Jest, Node 24.12.0 | **47 suites / 256 tests PASS**, exit 0 |
| Functions Jest, Node 24.12.0 | **36 suites / 369 tests PASS**, exit 0 |
| Client Jest, Node 22.23.3 | **47 / 256 PASS**, exit 0 |
| Functions Jest, Node 22.23.3, correct functions working directory | **36 / 369 PASS**, exit 0 |
| Auth/Firestore/Storage emulators, Java 21 | **71 established checks PASS:** 22 indexing + 18 deletion + 12 consent + 19 rules/security |
| Additional stale-ingestion audit probe | **FAIL for release behavior** — reproduced deleted-item recreation; zero external requests |
| Root TypeScript / lint | PASS; 9 existing lint warnings, 0 errors |
| Functions lint / TypeScript build | PASS |
| Website TypeScript / lint / production build | PASS |
| Offline intelligence / styling gate | **84/84** and **30/30** PASS, standard 8/hard 22; no paid judge |
| Production-mode local iOS JS/Hermes export | PASS; no native build or runtime claim |
| Policy-copy sync / whitespace/conflict checks | PASS |
| Deployed Scheduler/Eventarc, real provider, signed native journeys | **NOT RUN**; approval/environment/artifact required |

Fresh emulator checks include concurrent consent changes, account switching/isolation, queued/retried work across revocation and deletion, same-ID item recreation during indexing, response-before-crash, lease expiry, actual SDK retry suppression with mocked transport, global concurrency, quotas, resumable uploads crossing deletion, orphan cleanup, Auth-last retries, and two concurrent 25-item wardrobes. Bursts 10/25/50/100 consumed exactly 10/25/50/100 mocked embedding calls in 1/3/5/11 sweeps; 100 items took 1,459 logical minutes across two daily windows. This is not real-time cloud throughput or a photo-ingestion reliability claim. Handlers are invoked directly; emulators do not certify Eventarc/Scheduler/IAM or production index readiness.

Exit 139 investigation: no recurrence in this task's completed client runs. macOS crash reports at 2026-10-10 15:41:38 show Node SIGSEGV / EXC_BAD_ACCESS with a V8 GC root/mark-compact stack; a companion Node process relayed SIGSEGV. Sanitized frame/time/hash evidence is in `node-crash-summary.json`. This supports a process/runtime failure, but does not prove its trigger or a dependency cause. The duplicate libvips class warning from two sharp distributions also exists when loading backend modules; do not assert it caused the client crash. Node 22 client/backend reruns pass. An initial ad-hoc Node 22 backend invocation from repository root failed one test that reads package.json relative to cwd; rerunning from `functions/` passed. Preserve both logs; use the documented working directory in CI. No packages were changed to conceal either result.

Reproduce the primary checks from `closet/`:

```sh
npm test -- --runInBand
npm run typecheck
npm run lint
npm --prefix functions test -- --runInBand
npm --prefix functions run lint
npm --prefix functions run build
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" firebase emulators:exec --project demo-aura-beta --config firebase.beta-test.json --only auth,firestore,storage 'node scripts/test-indexing-recovery.cjs && node scripts/test-account-deletion.cjs && node scripts/test-ai-consent.cjs && node scripts/test-beta-security.cjs'
node scripts/aura-intelligence-eval.cjs
# Run functions/scripts/runAuraEvalGate.cjs by absolute path from an evidence directory.
npm --prefix website run typecheck
npm --prefix website run lint
npm --prefix website run build
node scripts/sync-privacy-policy.cjs --check
git diff --check
```

Native/provider regression is still required after all source fixes. Test newly built exact-artifact cold/warm reset/action URLs, OAuth cancellation/unsolicited callbacks, restored auth/onboarding, offline privacy, accept/decline/revoke from two accounts/devices, native speech, camera/HEIC/local cutout, styling/cards/saved/planning, real Apple/Google and deletion with interrupted uploads on physical iPhone. Include supported minimum OS, 26.5 and 27, not only high-memory simulators.

## 8. Ordered rollout plan — future approval only

**The following is a gated plan, not an executable authorization. Do not substitute production for a placeholder and run it while the above blockers remain.**

1. **Freeze and repair a reviewable candidate.** Retain/retest the P1-07 ingestion fix, resolve its shared-media consistency gate, decide live-shopping/quotas/retention, reconcile vector manifest and dependencies, and implement/test maintenance controls. Preserve the current dirty tree; prepare a separately reviewed release snapshot containing all required untracked files and mixed-file hunks. Record SHA-256 manifest, revision, locked tooling, endpoint manifest and deployment config. A clean release commit does not authorize a push.
2. **Preflight identities and old-client strategy.** Refresh read-only functions/rules/indexes/IAM/secret-version/scheduler/Eventarc/EAS metadata. Record previous artifacts/rules and service IAM for recovery. Select a dedicated approved staging project; confirm no production credential/bucket/database in its client/build config. Verify billing, cost alerts, runtime quotas, Apple capability and support ownership. Recheck full source upload input and function package (compiled shared code included). Obtain separate explicit approval for credentials/IAM/resources.
3. **Prepare infrastructure additively in staging.** Use the reconciled eight-composite-plus-field index manifest. Wait for READY; do not delete remote indexes. Configure only approved Apple secret/parameters and OpenAI binding; verify least necessary service identities, cross-service Storage rules and Storage publisher. Do not enable Cloud Tasks. Candidate functions resolve Storage bucket from target Firebase config; inspect target resolution before deploy.
4. **Deploy complete candidate into isolated staging.** On an empty controlled project there are no legacy users to expose. Deploy intended rules, all 56 functions and two schedules; confirm correct `nam5` Firestore versus `us-central1` Storage/function placement. Verify eight new exports relative to the P1-06 live snapshot, both retry-enabled creation triggers, indexing retry, four-slot/one-instance recovery settings and exact secret versions. Then execute the smoke plan below with approved synthetic accounts/provider budget. Measure actual delivery, duplicates, failure recovery and scale before production approval.
5. **Prepare production maintenance rehearsal and candidate app.** No current server-wide kill switch exists. A deploy job is not a substitute for it. Rehearse restricting callable/HTTP invocation, normal client Firestore/Storage writes, daily cleanup and legacy event-worker activity, while retaining operator read/status access. Account for inherited Run IAM and already cached provider keys; removing Secret Accessor does not invalidate a loaded key. A provider pause that disables shared deletion recovery is unacceptable. Require observable quiescence and old-revision drain, not just a fixed sleep. Until this control is proven, production rollout stays blocked. Have the matching, approved native candidate ready for controlled testing before reopening; don't distribute it against the old backend.
6. **Production preflight after approval.** Refresh resource and old-client inventory immediately before the window. Announce upgrade/downtime to testers using an approved communication process. Apply the rehearsed maintenance control. Keep new consent acceptance and new deletion acceptance closed until all protected writers are updated. Preserve any already accepted deletion jobs/status/recovery; never cancel their fences. Wait beyond the maximum 540-second old request deadline AND verify no old traffic/worker activity or unsafe retries remain. Time alone does not prove drain.
7. **Production deploy in dependency order while isolated.** Add/wait for indexes and approved IAM/secret config first. Install intended rules/fences while maintenance still prevents ordinary writes. Deploy all guarded data writers, provider transports, new resume/cleanup workers and recovery scheduler before exposing `setAiConsent`, `revokeAppleForAccountDeletion` and new `deleteAccountData`. Deploy those acceptance endpoints last. Keep maintenance restrictions in effect across each revision change; Firebase deployments may update IAM. Name-by-name parity must end at 55 exports; do not remove old named AI endpoints, leave them running old implementations, or delete indexes. Validate unauthenticated denial and configuration before allowing approved dedicated test accounts.
8. **Controlled production smoke only if separately approved.** Prefer staging for destructive/fault tests. If production acceptance is required, restrict authenticated operations and inspections to explicitly created release-test UIDs and `users/{testUid}` paths. No global purge, whole-project scan or arbitrary Auth enumeration. Check support/privacy publication, paired app behavior and observed job recovery. Stop on any unexpected transmission, resurrection, other-user access or delivery outage.
9. **Reopen to upgraded testers gradually.** Restore reviewed IAM/client access only after gates pass; enable consent acceptance without seeding consent. Verify declined users retain manual use, Polish remains denied, deletion completes, and backlog/costs are bounded. Monitor at least a full daily indexing quota rollover and repeated scheduler intervals before expanding. Source/device/report sign-offs, correct public disclosures, App Store privacy review and explicit owner beta approval are required before external GO.

### Command templates for the approved operator

Read-only preflight (safe when independently rerun; never print secret values):

```sh
firebase functions:list --project "$AURA_PROJECT" --json
gcloud firestore indexes composite list --project "$AURA_PROJECT" --database='(default)'
gcloud firestore indexes fields list --project "$AURA_PROJECT" --database='(default)'
gcloud scheduler jobs list --project "$AURA_PROJECT" --location=us-central1
gcloud eventarc triggers list --project "$AURA_PROJECT" --location=nam5
gcloud eventarc triggers list --project "$AURA_PROJECT" --location=us-central1
gcloud secrets list --project "$AURA_PROJECT"
gcloud secrets versions list APPLE_REVOCATION_PRIVATE_KEY --project "$AURA_PROJECT"
gcloud projects get-iam-policy "$AURA_PROJECT"
npx eas-cli@latest build:list --platform ios --limit 10 --json --non-interactive
```

Use the approved target project explicitly; do not rely on `.firebaserc` defaulting to production. Pin CLI versions for the actual run after rehearsal. APIs may require Firebase CLI credentials instead of gcloud identity; this audit used the authenticated Firebase CLI API client for metadata without exposing tokens.

**Mutating commands below were not executed.** They require approved target, reviewed configuration and passed preceding gates. Apple key file must be an owner-provided protected server-side file, never echoed or committed. Non-secret Team/Key/Client parameters belong in protected deployment configuration, with presence checked before deploy; empty defaults are not acceptable for the approved release.

```sh
# Only after separate secrets/IAM approval:
firebase functions:secrets:set APPLE_REVOCATION_PRIVATE_KEY --project "$AURA_PROJECT" --data-file "$AURA_APPLE_KEY_FILE"
gcloud projects add-iam-policy-binding "$AURA_PROJECT" \
  --member="serviceAccount:service-${AURA_PROJECT_NUMBER}@gcp-sa-firebasestorage.iam.gserviceaccount.com" \
  --role=roles/firebaserules.firestoreServiceAgent
# Grant secretAccessor, Eventarc/Run/Scheduler and Storage-PubSub permissions
# only to the exact reviewed identities in the environment-specific IAM plan.

# Only after merging/reviewing the additive vector + group index configuration:
firebase deploy --project "$AURA_PROJECT" --only firestore:indexes
# Wait for remote READY, then approved staged rules/function deployment:
firebase deploy --project "$AURA_PROJECT" --only firestore:rules,storage
# STAGING, empty/isolated approved project only:
firebase deploy --project "$AURA_PROJECT" --only functions
```

For production, split the last command using the manifest: first all exports **except** `setAiConsent,revokeAppleForAccountDeletion,deleteAccountData`, then those three; maintain the independently verified invocation/write restrictions throughout. Generate the first `--only` list from the 55-name appendix and review it, not a hand-picked subset of AI names. Both phases use the exact same compiled/reviewed source. If maintenance enforcement would be removed by deploy, stop and correct the procedure before any exposure. No command in this report authorizes `--force`, secret rotation, legacy data purge, EAS build or TestFlight submission.

## 9. Rollback and forward recovery

- **Before acceptance/data migration:** failed staging can be repaired/reset using only its synthetic data. If a production phase fails while isolated, keep maintenance in place, diagnose and redeploy the same complete safe candidate; do not reopen a mixed fleet.
- **After consent/deletion/index jobs exist:** returning all functions/rules to pre-P1-03/P1-04 code is unsafe. Old code bypasses consent and can resurrect fenced users; old deletion has no durable recovery. Preserve consent versions/revisions, tombstones, queues, indexes and quota records. Use forward fixes or a tested safe checkpoint that retains those contracts.
- **AI outage:** keep AI closed with a reviewed control, preserve manual functionality, status and deletion workers. Do not revoke OpenAI access indiscriminately while the shared recovery scheduler depends on it; deploy a tested deletion-only recovery variant if that dependency fails. Keep indexing jobs intact for later bounded recovery, not counter/job resets or unbounded paid replay.
- **Rules/IAM outage:** correct narrowly forward, preserving fence/consent denial. Never restore permissive rules to make a smoke test pass. Stored download tokens and separate services require eventual-object cleanup; audit approved synthetic paths after recovery.
- **Lost worker/event:** recover deletion via persisted dueAt/lease; recover item indexing via due jobs or approved user-scoped paginated reconciliation. Inspect and resume consent continuation jobs with the original revision only. Do not reaccept on behalf of the user or clear permanent deletion records.
- **Index issue:** leave existing vectors intact and repair/add indexes. Structured fallback reduces dependency on vector availability but cannot service >500-document closets or repair ineligible photo ingestion. No index rollback deletion is necessary.
- **Client issue:** pause distribution; previous build 9 is not a compatible rollback for consent/deletion UX. Retain backend privacy/fences and provide support/status while delivering a forward-fixed app. Do not claim rollback restores erased accounts or revoked Apple grants.
- **Backups/recovery:** data deletion and Apple revocation are irreversible business actions. Restoring an old database snapshot requires applying the independent deletion ledger/tombstones before service reopens and resweeping Storage/Auth. Never automatically replay content from deleted users.

## 10. Isolated authenticated smoke plan

Approval unit: dedicated nonproduction Firebase project/bucket + provider credentials/budget + Apple/Google test identities + controlled app configuration. Create two synthetic accounts A/B and a separate deletion account; no production exports/copying and no personal garment photos. Store test IDs in a local restricted run manifest, never provider tokens. Fail setup if any configured project/bucket/audience equals production unintentionally. A native test artifact would need its own later authorization; none is created here.

| Step | Action / asserted evidence |
|---|---|
| 1 | Create email accounts; delay/restart Auth, interrupt onboarding and restore session. Verify A cannot read/write B and no provider call occurs before consent. Test cold/warm password-reset app links and valid/invalid Firebase actions without logging codes. |
| 2 | Decline: upload a synthetic image, use native/local cutout, manually edit/delete, browse saved items/settings. Assert no provider dispatch and helpful paused state. Test anonymous privacy and offline bundled policy. |
| 3 | Accept current version through actual callable; verify timestamp/revision, owner read-only rules and idempotent resume pages. Use one approved generation/import/transcription/extraction each within a small agreed cost cap, record only status/model/count/latency and synthetic content IDs. Confirm layout remains enabled and both Polish paths deny even with legacy power flags. |
| 4 | Upload/index 10 synthetic eligible items; observe actual Eventarc enqueue, actual five-minute Scheduler claims, READY vector query and structured fallback. First use mocked/fault-controlled staging provider transport for 25/50/100 tests; do not incur 100 real-provider calls by default. Measure paid quota counters, no duplicate stored results and bounded retry count. |
| 5 | Revoke on second session/device while queued, during a delayed response and before retry. Assert no new authorized provider requests, old result cannot commit, manual actions still work. Switch A→B and verify approval not inherited. Reaccept new revision; old jobs must not inherit permission. |
| 6 | Fix-then-test item edit/delete/cancel/recreate during ingestion and indexing; replay duplicate/out-of-order events. Assert no deleted item returns, edits win, and each new input can recover without stale results. Include the newly reproduced early-error path. |
| 7 | In isolated staging only, exercise worker termination/lease expiry, synthetic provider 429/timeout, scheduler pause/resume and scoped permission fault/recovery under approved fault-injection plan. Restore settings; inspect due/terminal counts. Existing accepted deletion must recover even during AI incidents. |
| 8 | Fresh/stale email/Google/Apple/linked account deletion, wrong Apple subject/cancel/manual fallback, two sessions and an unfinished upload. Observe single accepted fence, denied subsequent writes, orphan/Storage cleanup, settle/final verification, Auth-last and permanent minimal tombstone; account B remains unchanged. Test real native revoke/re-registration on a physical phone only with approval. |
| 9 | Retry after partial cleanup and crash after Auth removal. Verify completed tombstone remains, no privileged late upload survives finalization recovery, and UI never equates timeout/pending with completion. Do not test by removing fences. |
| 10 | Record exact source/artifact hashes, environment/config/secret version IDs, time windows, safe aggregate metrics and redacted screenshots. Clear only synthetic accounts via the tested deletion process, inspect their exact owned paths, retain allowed minimal tombstones and release evidence. No broad collection deletion script. |

Unauthenticated health/401 probes alone cannot close these gates. A controlled production smoke, if later necessary, uses a separately approved tiny set of dedicated UIDs; destructive fault injection and whole-project scans remain prohibited there.

## 11. Costs, capacity and operational acceptance

One additional scheduled job produces 288 ticks/day; with daily draft cleanup there are two jobs. Each recovery tick performs deletion and indexing due queries (at least 576 query executions/day, including empty-result minimum charges), plus actual jobs/listeners/transactions. Google lists Scheduler at $0.10/job/month with three free jobs per billing account; allowance availability is unknown, and function/database/provider charges are separate ([Scheduler pricing](https://cloud.google.com/scheduler/pricing)). No project dollar estimate can be reliable without active-user/closet/token/image volume.

Indexing is at most 40 considered jobs/tick (11,520/day globally), four valid leases and 10/minute/50/day reservations per UID. Each successful item adds roughly eight writes plus reads/listeners/transaction retries, stored 2048-vector and index/job storage. Fifty successful items consume a daily user budget; a 100-item closet spans at least two daily quota windows. Failed attempts consume quota. Provider/model charges and ambiguous-response retries remain bounded per job but not exactly once. Other AI calls are outside this indexing semaphore. Full RATE_LIMITS remain in source and evidence; no increase authorized.

Generation's structured fallback scans up to 501 documents **per role**, multiplying reads and latency; >500 is an explicit failure. Consent acceptance touches historical items in pages of 50 and triggers processing; photo ingestion has a separate 3/minute/25/day limit and no equivalent durable sweep. Deletion recursive operations, object list/delete, two sweeps, Storage soft-delete retention, Eventarc/Pub/Sub, secret storage/access, build artifacts and egress all add cost. The settle period has no sleeping billed invocation. Per-account quotas, four leases, default instance settings and billing alerts are not hard project spend caps.

Before approval, define monitored thresholds/owners: oldest due deletion/index job, retry/terminal counts, scheduler delivery failures, Eventarc dead/lost work, consent-resume backlog, fence denials, upload-finalize cleanup errors, provider requests/cost, quota throttling, function instance/latency and deletion completion. Suggested initial staging alerts: no successful scheduler tick for 15 minutes; eligible non-quota indexing overdue >15 minutes; deletion past settle and overdue >30 minutes; any unexpected provider call without current consent or item resurrection is an immediate stop. These are proposed operational thresholds, not implemented alerts or service guarantees. Approve workload/cost budgets before broad acceptance/backfill.

References for operational behavior: [Firestore event ordering/redelivery](https://firebase.google.com/docs/functions/firestore-events), [function update management](https://firebase.google.com/docs/functions/manage-functions), [scheduled functions](https://firebase.google.com/docs/functions/schedule-functions), [Storage cross-service rules](https://firebase.google.com/docs/storage/security/rules-conditions#enhance_with_firestore), [Apple account-deletion/revocation guidance](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple). Runtime/IAM facts above come from this project's metadata, not assumptions from those documents.

## 12. Final sign-off

| Area | Local/source result | Deployment/release decision |
|---|---|---|
| P1-02 routing | Existing automated tests PASS on current Router resolution | Native/real OAuth pending |
| P1-03 consent/privacy | Source/unit/emulator PASS | Live enforcement, publication/mailbox/provider review pending |
| P1-04 deletion | Account fences/durable recovery/Apple mocks PASS | Missing Apple/IAM/delivery/device proof; build-9 incompatibility |
| P1-05 indexing | Queue/isolation/quota/fallback tests PASS | Index/worker delivery/real load pending; does not fix ingestion |
| Integrated ingestion safety | P1-07 original reproduction and concurrency regressions **PASS locally** | Cloud delivery, shared-media consistency and old-client rollout remain gates |
| Deployment approval | **NOT READY TO DEPLOY** | Complete configuration/maintenance rehearsal, media-reference decision and isolated smoke |
| External beta | **NO-GO** | Requires separate deployed + exact-artifact physical-device and owner sign-off |

## Appendix A — Complete exported function deployment manifest

Generated from the successfully compiled local entrypoint. All are gen 2 / Node 22, intended `us-central1` function location. “Default” means source does not specify the value: resolve and review before deployment; do not assume the currently deployed 20-instance/80-concurrency setting survives an option reset. Local demo bucket inference is deliberately replaced below with the target-bucket requirement. Secret abbreviations: **O** = OPENAI_API_KEY, **A** = APPLE_REVOCATION_PRIVATE_KEY; “—” = no secret binding. A binding does not imply the handler always calls a provider (e.g. backfills now enqueue; action learning is optional).

| Export | Kind / trigger | Live name | Timeout / memory in source | Secret |
|---|---|---|---|---|
| `askAura` | Callable | Existing | 120s / default | O |
| `askAuraStream` | HTTP | Existing | 120s / default | O |
| `auditClosetDraftItems` | Callable | Existing | 120s / default | — |
| `backfillWardrobeIntelligence` | Callable | Existing | 540s / default | O |
| `backfillWardrobeIntelligenceAll` | Callable | Existing | 540s / default | O |
| `bulkDeleteAbandonedDrafts` | Callable | Existing | 120s / default | — |
| `cleanupAbandonedDraftClosetItems` | Schedule: every day 03:15 | Existing | 540s / 512MiB | — |
| `continueAccountDeletion` | Firestore create: `accountDeletionJobs/{uid}`; retry true | **NEW** | 540s / 512MiB | — |
| `deleteAccountData` | Callable | Existing | 540s / 512MiB | — |
| `deleteClosetItem` | Callable | **NEW P1-07** | default / default | — |
| `deleteDraftClosetItem` | Callable | Existing | 60s / default | — |
| `deleteStyleMemory` | Callable | Existing | 60s / default | — |
| `dislikeAuraAgentOutfit` | Callable | Existing | 120s / default | O |
| `extractOutfitItems` | Callable | Existing | 540s / 1024MiB | O |
| `extractProductFromUrl` | Callable | Existing | default / default | O |
| `generateAuraSwipeBatch` | Callable | Existing | default / default | O |
| `generateOutfitRecommendations` | Callable | Existing | 240s / default | O |
| `generateOutfitsV1` | Callable | Existing | default / default | O |
| `getAccountDeletionStatus` | Callable | **NEW** | default / default | — |
| `getAuraMetrics` | Callable | Existing | 60s / default | — |
| `getAuraResumeMetrics` | Callable | Existing | 60s / default | — |
| `getStyleProfile` | Callable | Existing | 60s / default | — |
| `health` | HTTP | Existing | default / default | — |
| `importProductLink` | Callable | Existing | default / default | O |
| `ingestItemFromPhotos` | Firestore write: `users/{uid}/items/{itemId}`; retry false | Existing | 240s / 1024MiB | O |
| `listStyleMemories` | Callable | Existing | 60s / default | — |
| `logAuraAgentOutfitWear` | Callable | Existing | 120s / default | O |
| `onClosetItemWriteIndexIntelligence` | Firestore write: `users/{uid}/items/{itemId}`; retry true | Existing | 60s / default | — |
| `outfitChatV1` | Callable | Existing | default / default | O |
| `parseOutfitIntent` | HTTP | Existing | default / default | O |
| `planAuraAgentOutfit` | Callable | Existing | 120s / default | O |
| `polishExtractedAccessory` | Callable | Existing | 240s / 1024MiB | O |
| `polishProductImage` | Callable | Existing | 120s / 1024MiB | O |
| `previewAbandonedDraftCleanup` | Callable | Existing | 120s / default | — |
| `previewClosetItemIntelligence` | Callable | Existing | 60s / default | — |
| `previewOutfitGenerationContext` | Callable | Existing | 120s / default | O |
| `previewProductLink` | Callable | Existing | default / default | O |
| `rebuildStyleProfileFromMemories` | Callable | Existing | 120s / default | — |
| `reconstructOutfitLayout` | Callable | Existing | 540s / 1024MiB | O |
| `recordOutfitFeedback` | Callable | Existing | 120s / default | O |
| `recoverAccountDeletions` | Schedule: every 5 minutes | **NEW** | 540s / 512MiB | O |
| `refreshAuraMetricsSnapshot` | Callable | Existing | 120s / default | — |
| `reindexClosetItem` | Callable | Existing | 120s / default | O |
| `removeDeletedAccountUpload` | Storage finalize (target bucket); retry true | **NEW** | default / default | — |
| `resetAuraMetrics` | Callable | Existing | 60s / default | — |
| `resumeClosetAfterAiConsent` | Firestore create: `users/{uid}/aiConsentJobs/{jobId}`; retry true | **NEW** | default / default | — |
| `retrieveStyleMemoryContext` | Callable | Existing | 120s / default | O |
| `retrieveWardrobeContext` | Callable | Existing | 120s / default | O |
| `revokeAppleForAccountDeletion` | Callable | **NEW** | 60s / default | A |
| `runAuraStylingAgent` | Callable | Existing | 240s / default | O |
| `saveAuraAgentOutfit` | Callable | Existing | 120s / default | O |
| `searchLiveProducts` | Callable | Existing | default / default | — |
| `setAiConsent` | Callable | **NEW** | default / default | — |
| `softDeleteAllStyleMemories` | Callable | Existing | 120s / default | — |
| `transcribeAuraAudio` | Callable | Existing | default / default | O |
| `wrapAffiliateLinks` | Callable | Existing | default / default | — |

Deployment order alone does not isolate traffic. Once approved maintenance is proven, the acceptance phase consists of `setAiConsent`, `revokeAppleForAccountDeletion`, `deleteAccountData`, and `deleteClosetItem`; all other 52 exports are the preceding phase. All existing aliases/HTTP endpoints must receive the guarded code. `previewProductLink` and `extractProductFromUrl` are separately deployed exports of the shared preview implementation.


## P1-07 dependency and rollout addendum

The above P1-06 test/cloud inventories remain dated evidence. P1-07 adds one callable, `deleteClosetItem`, and modifies the existing recovery scheduler and Storage finalizer. It adds server-only `users/{uid}/itemDeletionJobs/{itemId}` fences, `ingestion.recoverAt`/run/lease recovery metadata, and ascending collection-group indexes on `itemDeletionJobs.dueAt` and `items.ingestion.recoverAt`. No new secrets, Tasks service or schedule are required. Preserve the vector-index reconciliation gate and existing cross-service Storage IAM requirements.

Deploy the entire P1-07 dependency closure listed in its report, including generic item writers, product imports, both draft-cleanup paths, client upload/deletion helpers, rules and indexes. **Do not reopen item deletion for build 9.** First prove maintenance/old-Admin drain, prepare the updated client, install/verify the callable and all guarded writers, and then enable the rules/acceptance under the approved maintenance plan. Keep accepted deletion recovery active. Do not roll back to client direct deletion or delete fences. A historical deleted ID without a fence cannot be distinguished from a new client-created item; no unsafe historical backfill was attempted.

Storage cleanup is generation-scoped and durable, preserves observed surviving references and active run outputs, and revisits deleted-item fences daily. New uploads are immutable per attempt. Cross-service completion and a concurrently newly added shared-media reference remain non-atomic; explicitly resolve/rehearse this before release. Deleted-item cleanup is bounded at ten due pages per scheduler tick, 100 objects/page, and scans the owner's current items for references. Daily fence revisits, wardrobe-size-dependent reads and the 2,880 page/day maximum require measured beta cost/backlog monitoring. Minimal item fences persist until account deletion; add them to the retention/public-disclosure review.

Current local validation: **263 client tests, 375 backend tests**, both on Node 24.12.0 and 22.23.3; **22 ingestion + 22 indexing + 18 deletion + 12 consent + 19 security = 93 emulator checks**; intelligence **84/84**, styling **30/30**, client TypeScript/lint, backend lint/build, privacy synchronization and whitespace checks PASS. Client lint retains nine prior warnings. No exit 139 recurred. The prior macOS duplicate-libvips warning persists; optional native/model paths are not fully exercised.

The shared-media limitation, actual event/scheduler delivery, IAM/index/Apple prerequisites, published disclosures/mailbox, maintenance and new exact-artifact physical-device matrix remain open. **NOT READY TO DEPLOY; external beta NO-GO.** No P1-07 build or deployment was performed.


## P1-08 integration delta — October 10

Shared-reference safety is **PASS locally**, with a permanent path-retirement ledger, transactional cleanup lease, short-lived Firestore write permits, immutable Storage objects and scheduled recovery. All current client persistence modules use the explicit adapter; normal security/schema checks still run on the original Firebase SDK commit. Reference scans include saved looks, profiles, chat descendants, jobs and caches. Account deletion retains precedence. See the P1-08 report for exact evidence and bounded-recovery limitations.

The new callable is `prepareMediaWrite` (57 total source exports). Add group ascending indexes for `retiredMedia.dueAt`, `mediaSweepJobs.dueAt`, `mediaInventories.dueAt`, `mediaPermits.until`, `mediaControl.until`; retain P1-05/P1-07 indexes and reconcile both missing vector indexes. Extend the existing finalizer/scheduler; enable retry on the existing ingestion trigger so pre-claim media-lock contention is redelivered. No new Cloud Tasks service, trigger, schedule or secret is required. New media-permit and existing item-deletion quotas are now both in the account-cleanup inventory.

Operator settings are not activated: `releaseControl/mediaSafety.cleanupEnabled` must explicitly be true before new retirement; `releaseControl/ai.enabled=false` pauses new AI requests; `releaseControl/client` supplies the advisory minimum contract/maintenance notice. Consent and deletion security do not depend on these client notices or claimed versions. Updated account deletion acknowledges `durable-deletion-v1`; missing acknowledgements cannot initiate deletion or receive misleading pending success. Already accepted recovery continues.

Mandatory ordering: freeze the complete dirty-tree candidate; reconcile additive indexes/configuration; isolated deployment and authenticated smoke; prove historical inventory/capacity and real event/retry delivery; prepare the matching native client and approved Build 9 communication/expiration transition; rehearse maintenance and drain old Admin work; obtain production approval; deploy the full closure; validate dedicated accounts; only then explicitly enable retirement/reopen distribution. Keep deletion recovery available. A partial backend-first production rollout is not approved.

Do not roll back to mutable/directly deletable Storage objects, unguarded writers, missing media/item/account fences, or Build 9 as the supported client. Stop new retirement during an incident, preserve accepted cleanup, and forward-fix. Existing references and expired caches can deliberately retain legacy media; dormant users need scoped inventory backfill. Scans beyond 5,000 document positions/55 seconds defer safely and require operational closure. Batch limits and real-world throughput must be measured before activation.

Latest test results and the task-specific changed-file inventory are in the P1-08 report and `../qa-artifacts/media-legacy-compatibility-2026-10-10/`. SDK 54, Xcode 26.0, version ownership, UI/cards/flatlays and Photo Refinement disablement remain intact. **NOT READY TO DEPLOY; external beta NO-GO.**

P1-08 final local validation: client **50 suites / 281 tests**, backend **38 suites / 385 tests** (both Node 24 and 22), **116 distinct emulator checks**, intelligence **84/84**, styling **30/30**, TypeScript/build/lint and local iOS JS/Hermes export PASS. Client lint retains nine pre-existing warnings. This remains separate from deployed/native-device validation.


## P1-09 production preflight — October 11

Fresh client **281** and backend **385** tests pass on Node 24/22; complete isolated emulator chain **116 checks**, intelligence **84/84**, styling **30/30**, client TypeScript/lint, backend build/lint, website TypeScript/lint/build and iOS JS/Hermes export pass. Nine prior client lint warnings remain; exit139 did not recur. Runtime IAM, real provider/native and old-worker drain are not certified by these checks.

The current candidate has **57 exports (47 callable,3 HTTP,5 event,2 scheduled)**. Both ingestion and indexing now request retries; the deployed two item triggers do not. All 48 live Run services have ingress ALL, IAM checks enabled, and maxInstances20/concurrency80;45 allow allUsers invocation. Shared inherited runtime invoker/Editor permissions make public-binding removal insufficient for isolation. A proposed project-wide deny on Run invocation plus temporary deny-all client rules requires a rehearsal, explicit downtime approval, verified old-instance termination and late-upload checks. Waiting 540s alone does not terminate timed-out code. Do not use the historical acceptance-phase lists above as the current runbook.

No data rewrite/refcount backfill is required to preserve existing media. New retirement must remain off until approved scoped reference inventory, legacy session settlement, dormant-owner coverage, 5,000-position/55-second overflow handling and cost/backlog acceptance. Read-only aggregate job/cache counts were zero at 09:49 UTC; they are not proof there is no old in-flight activity or missing-parent cache content. Complete bucket metrics are small, but recursive reference scans can dominate costs. Empty current recovery has nine bounded queries/tick, not the earlier two-query estimate.

Billing is enabled; project alert policies returned empty; budgets and Functions/Run quota reads failedHTTP 500 and remain unverified. CloudTasks is explicitly disabled and unnecessary. Existing vector specs are preserved in a separate additive proposal; active indexes.json was not changed. Apple key/config and cross-service IAM remain prerequisites. Public pages return 200 but old privacy/contact content; support mailbox receipt/reply and ASC Build 9 group/expiration status remain unverified.

Build 10 must be prepared/available for immediate matched handoff, held from ordinary use against the old backend, then distributed promptly after verified complete cutover. Build 9 has no remote upgrade reader; contract 1 is not build 10, and minimumContract=1 cannot make Build 9 display a notice. Security remains server/rules based. Explicit maintenance/communication/expiration and an installable replacement are required.

See P1-09 for exact approval scopes, configuration/credential checklist, synthetic smoke matrix, commands, backup/restore restrictions, rollout/forward-recovery plan and proposed artifacts. No production/staging mutation, secret payload access, EAS build, submission, push or live-account test occurred. Application/backend/native/UI and unrelated source changes were preserved.
