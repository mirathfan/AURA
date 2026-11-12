# P1-09 — Production deployment preflight and migration readiness

**NOT READY FOR CONTROLLED DEPLOYMENT. External beta remains NO-GO.** The accumulated fixes pass fresh local integration checks. Production isolation/drain has not been rehearsed, required infrastructure/credentials are missing, the matching client is not distributed, and public disclosures are stale. This report is an approval package, not deployment authorization.

Reviewed October 11, 2026 against `main` / `06ece001c69cb6a84787cebddd521f883ffccb66` plus **129 modified tracked and 96 untracked files** at task start. The 825-file starting hash inventory identifies the actual candidate; HEAD alone does not. Read P1-03 through P1-08 reports, readiness and native-launch/configuration reports; rechecked current source and Build 9's EAS-recorded source. No application, backend, native, dependency, active rules/index configuration, screen, card or flatlay was changed in P1-09.

Evidence: [production-preflight-2026-10-11](../../qa-artifacts/production-preflight-2026-10-11/). This contains sanitized cloud metadata, **read-only count aggregates**, bucket-level metrics, public-page copies, fresh test logs, proposed inventory and source hashes. No user document snapshots, object names/bytes, tester identities, secret payloads or private keys were inspected. No deployment, provisioning, cloud build, submission, GitHub push, live-account test, production mutation, support message or DNS change occurred. Reading aggregate counts can incur small Firestore read charges; it does not enqueue work.

## 1. Findings that change the operational plan

1. **48 old functions remain ACTIVE; the candidate exports 57.** Live rules exactly match HEAD, not the working candidate. Both existing Firestore triggers still have `RETRY_POLICY_DO_NOT_RETRY`; candidate ingestion and indexing triggers explicitly retry. A complete dependency deployment is still required.
2. **No current durable migration jobs were found by count.** At 09:49:20–21 UTC, root `accountDeletionJobs` and groups `wardrobeIndexJobs`, `itemDeletionJobs`, `mediaInventories`, `mediaSweepJobs`, `retiredMedia` each returned **0**. Root `productSearchCache` also returned **0**. This closes the claim that a populated root legacy cache has been established; it does not rule out orphan descendants, other caches, in-flight old work, or jobs created after the read. Repeat before maintenance.
3. **Bucket capacity is small; reference-tree capacity is unknown.** Monitoring reports **469,821,396 bytes (448.06 MiB / 0.43756 GiB), 2,267 objects**, REGIONAL class, latest raw sample 09:40 UTC. Complete two-day daily-max queries agree and have no next page. These are lagged bucket metrics, not an inventory of user objects, shared paths, deletable bytes, soft-deleted copies or per-user document size.
4. **A time delay is insufficient proof of old-worker drain.** All 48 Run services admit all ingress and use IAM invocation checks; 45 grant `allUsers` invoker. The runtime/Eventarc/Scheduler identity has inherited project Editor and Run Invoker. Removing only public bindings does not block that identity. Cloud Run timeout closes a request but need not terminate its code. A reviewed project-wide invocation hold and verified retirement of old revisions are proposed below; neither is executed or certified here.
5. **Build 9 distribution is not verified.** Fresh EAS history confirms production artifact 9; App Store Connect redirected to sign-in (`authResult=FAILED`). EAS `STORE` means build distribution type, not TestFlight upload, review, group assignment or installation. Do not assume there are zero testers or that Build 10 is unreserved.
6. **Public pages respond, but publication correctness fails.** All four canonical pages return 200 and still show the former personal email. Privacy retains August 15 copy, calls a hashed identifier anonymous, and omits explicit new consent/durable-deletion disclosures. MX records cannot verify the support mailbox.
7. **Billing is enabled; spend controls are not verified.** Monitoring returned no project alert policies. Budget API failed twice with HTTP 500; Functions/Run quota API requests also failed with 500. These results are not evidence that there are no budgets or that capacity is available.

## 2. Legacy records and media inventory

### Source-established families, not inspected production content

| Family | Current treatment / migration decision |
|---|---|
| `users/{uid}/items/{id}.jpg`, `.cleaned.png`, nested item images/variants | Legacy paths recognized by lifecycle parser and recursive reference scanner. Keep existing names and URLs. New overwrites/deletes denied to clients; future uploads use fresh UUID paths. No blanket rename, byte copy or URL rewrite is required. |
| Item upload UUIDs and `items/{id}/ingestion/{runId}/…` | Unique attempt/run ownership; live run protected; abandoned outputs reconciled through recovery. |
| Extracted crops/reconstructed layouts, profile/avatar, chat attachments and other `users/{uid}/…` assets | Server UUID extraction namespace; new finalize events create sweep jobs; recursive scans protect persisted snapshots, including descendants under missing parents. |
| Items, saved/planned outfits, saved looks, AURA looks, feedback, messages, profiles, ingestion metadata and caches | Any nested recognized owned Storage reference can pin an object. No refcount backfill is needed: fenced scans read actual current references. Inactive saved-outfit snapshots do not pin forever; restoration must revalidate. |
| Temporary audio under `users/{uid}/tmp/…` | Separate transcription cleanup and account-wide deletion; inadmissible as durable image media. General media inventory skips it. Retention of abandoned historical audio requires separate review. |
| Existing vectors / `embeddingRaw` | Valid 2048-vector fields can be reused. Raw arrays alone do not establish a usable vector index. Consent acceptance resumes eligible work; no fabricated consent or automatic paid global backfill. |
| Historical deleted IDs without item fences | Cannot infer deletion intent from absence. Do not manufacture fences for unknown IDs. Establish the cutover and prevent new unsafe writes; investigate any known historical incidents separately. |
| External retailer/provider URLs, local caches, OS backups | Outside owned Storage erasure. No copying/purging third-party media or offline devices in this migration. |

**Unmeasured:** number of owners, shared paths, orphan bytes, missing ancestors, active old upload sessions, malformed legacy URLs, cross-owner references, cache pins and accounts exceeding 5,000 document positions or a 55-second scan. Whole-bucket metadata cannot establish these. No promise of universal cleanup latency or zero orphaned historical data is justified yet.

### Approved migration would be additive and staged

- Start with **cleanup disabled**. Install the admission protocol and immutable-write rules as a complete release. Existing images remain readable for active owners; admission checks apply when a document is written, not retroactively to every existing document.
- Obtain a separate **scoped read approval** naming UIDs/cohort, allowed media fields, missing-parent traversal, maximum documents/objects/time, secure output location and retention. Keep URLs/download tokens, text, images and embeddings out of logs. Produce only counts, path-shape classes, shared-reference multiplicities, scan time/overflow and aggregate bytes; keep any reconciliation mapping access-controlled.
- Use synthetic staging accounts first, then a small approved legacy cohort. A dry-run inventory has no stable deletion authority: any eventual delete must re-scan under the protocol lock. Cross-owner/unknown shapes are exceptions to investigate, never cleanup candidates inferred from an incomplete scan.
- With separate **write/backfill approval**, register `users/{uid}/mediaInventories/default` or call the existing bounded `inventoryUserMedia(uid, cursor)` helper (100 objects/page). The helper **writes sweep jobs**; its name is not a dry-run guarantee. Require current account fence checks, an explicit UID allowlist, cursor checkpoint, request/operation budget, and no cleanup activation in that command. There is no production-safe batch CLI yet; its reviewed wrapper/rehearsal is a prerequisite, not an invented ready command.
- New permits register users automatically; historical dormant users do not. Approve that finite inventory backlog before activation so dormant orphans are eventually considered. Existing cached references intentionally pin media; approving cache retention is separate from enabling cleanup.
- Reconcile indexing only through current-consent/current-item paths. Owner callables `backfillWardrobeIntelligence({limit:100,cursor,dryRun:true})`, non-dry enqueue, and `reindexClosetItem({itemId,force:true})` retain 1/day backfill and 10/minute, 50/day indexing quotas. Admin impersonation, quota resets and consent rewriting are not migration tools.
- Account deletion takes precedence. Preserve external tombstones even when nested ledgers are erased. Never resume an inventory/backfill for a fenced account.

Actual root legacy `productSearchCache` count is zero now; no purge is warranted from this evidence. Inspect only if a later approved inventory establishes retained records or missing-parent descendants. Consent jobs, per-user caches, rate counters, waitlist and temporary uploads still have separate retention questions.

### Cross-service and historical-upload limits

Firestore retirement commits before generation-specific Storage deletion. Failed removal leaves retired-but-present bytes and durable retry work; it never reopens admission. New cleanup requires an explicit operator flag; accepted retirements and account deletion keep recovering when the flag is disabled.

Old already-authorized upload sessions remain a migration gate. GCS resumable sessions can remain usable for a week; that documentation does **not** establish the behavior of every Firebase upload path. Test actual Firebase sessions begun before rule replacement in isolated cloud staging. Prove completion is denied, or approve cancellation/settlement or a separately reviewed immutable-copy strategy for affected legacy paths. Do not assume ten minutes, TestFlight expiration or new rules cancels every session. A late overwrite of an *active* legacy shared path is different from removal of a retired path. Keep new retirement off until this is resolved. [GCS resumable-upload behavior](https://docs.cloud.google.com/storage/docs/performing-resumable-uploads).

## 3. Fresh infrastructure readiness matrix

Project `closet-app-57146`, number `1043970871162`; default Firestore `nam5`; app bucket `closet-app-57146.firebasestorage.app` in `us-central1`. Configuration observations below are October 11, not copied forward from P1-06.

| Area | Confirmed metadata / source | Gate |
|---|---|---|
| Functions / Run | 48 ACTIVE Node 22 gen-2 functions; 48 corresponding Run services, no additional Run service returned. All 48 live names remain in candidate's **57 exports: 47 callable, 3 HTTP, 5 event, 2 scheduled** | Deploy whole dependency closure. Current source parity with every old binary was not re-downloaded. |
| New exports | `setAiConsent`, `resumeClosetAfterAiConsent`, `revokeAppleForAccountDeletion`, `getAccountDeletionStatus`, `continueAccountDeletion`, `recoverAccountDeletions`, `removeDeletedAccountUpload`, `deleteClosetItem`, `prepareMediaWrite` absent live | Nine additions plus updates to all retained names; do not deploy just these nine. |
| Rules | Active Firestore/Storage source matches HEAD and differs from candidate | Candidate denies forged consent/fences/permits, unsafe direct deletion and mutable Storage; deploy both under maintenance after guarded workers are ready. |
| Composite/vector indexes | Eight READY: six ordinary item indexes plus `items.embeddingVector` and `styleMemories.embeddingVector`, flat dimension 2048 | Active repo manifest lists only six. Proposed additive manifest preserves both vectors and all nine candidate field overrides. No deletion/force prompts accepted. |
| Recovery field indexes | Live explicit field list contains only default indexing; no candidate collection-group overrides | Eight group fields needed: wardrobeIndexJobs.dueAt, itemDeletionJobs.dueAt, items.ingestion.recoverAt, retiredMedia.dueAt, mediaSweepJobs.dueAt, mediaInventories.dueAt, mediaPermits.until, mediaControl.until. Ninth override exempts mediaPermits.projection from indexing. Wait for READY. Root accountDeletionJobs.dueAt uses default single-field indexing. |
| Scheduler | Only `firebase-schedule-cleanupAbandonedDraftClosetItems-us-central1`, enabled daily 03:15 America/Chicago; OIDC Compute SA and matching function audience | New five-minute recovery job absent. Candidate recovery maxInstances=1/concurrency=1, 540s/512MiB; verify actual two consecutive deliveries and overlap recovery. |
| Eventarc | Two existing item-write triggers in nam5; no us-central1 triggers. Both Functions retry policies off | Candidate adds two Firestore-create handlers and one Storage-finalize handler, retries enabled. Existing ingestion/indexing must also have retry on. Validate bucket/event location/identity. |
| Transport queues | Existing Eventarc subscriptions: 600s ack deadline, 24h retention, 10–600s backoff, no dead-letter policy returned | Functions retry-off still matters; transport retry config does not prove application redelivery. Do not purge/delete/seek managed queues. Keep outage below retention and reconcile missed work with approval. |
| Cloud Tasks | Service explicitly DISABLED; queue request 403 | No source Tasks dependency. Do not enable/provision it for this release. |
| Runtime IAM | Shared Compute SA has Editor, Event Receiver, Run Invoker; 45 service policies permit allUsers; all services ingress ALL and IAM checks enabled | Callable application Auth remains required. Broad inherited IAM complicates drain and least privilege. Review scoped runtime/deployer identities before changing roles. |
| Storage cross-service rules | Project policy has Storage service-agent role, but **no explicit** Firestore-service-agent grant for Firebase Storage SA | Approve `roles/firebaserules.firestoreServiceAgent`; verify effective inherited IAM and real rules behavior. Bucket policy is legacy project owner/editor/reader; object ACLs not inspected, uniform access disabled. |
| Storage events IAM | No explicit project Pub/Sub Publisher grant for GCS service agent found | Verify effective permissions; add only if required/approved. Retain necessary Google service-agent roles. |
| Secrets | Only OPENAI_API_KEY exists; enabled versions 1 and 2; live bindings use version 2 | Apple secret missing; do not rotate/delete OpenAI versions. Recovery startup requires working OpenAI binding even for its non-AI cleanup branches. |
| Apple provider | Enabled; returned appleSignInConfig empty; revocation function absent | Does not establish Developer Portal revocation key or audience configuration. Checklist below. |
| Release controls | `releaseControl/client`, `/ai`, `/mediaSafety`: all 404 | None activated. Missing cleanup flag disables new retirement in candidate only; absence of AI flag does not pause old code. |
| Backup / retention | PITR disabled; 1h database version retention; delete protection disabled; no backup schedules or managed backups returned; no TTL policies. Bucket soft delete 7 days; no enabled app-bucket versioning returned. Log buckets 30/400 days | Approved backup/export/restore rehearsal and retention ownership missing. Other exports/sinks/provider backups not excluded. |
| Billing / budgets / alerts / quotas | Billing enabled; project alert-policy list empty; budgets failed twice HTTP 500; Functions/Run quota reads HTTP 500 | Budget recipient/thresholds and capacity remain **unverified**, not absent. No new alert or budget created. |
| Live worker limits | All 48 deployed functions maxInstances20/concurrency80; source recovery explicitly 1/1, indexing pool4 with global leases | Most candidate exports leave options default; review resolved deployment options. Four indexing leases do not cap chat/image calls or project spend. |

Complete sanitized per-function options and current revisions: `local-endpoints.json`, `functions.json`, `run-*.json`, `run-iam-*.json` in evidence. Local endpoint discovery used a **demo bucket**; it is metadata inspection, not production deployment configuration. Production finalizer must resolve the actual app bucket above. `function-inventory.tsv` provides the complete joined list.

### Apple, permissions and configuration checklist

- [ ] Owner provides a Sign in with Apple **ES256** key; confirm Apple Team ID, Key ID, `com.kasat.aura` audience/App ID grouping, entitlement/provisioning and key lifecycle. An ASC API key or distribution certificate is not interchangeable.
- [ ] Create `APPLE_REVOCATION_PRIVATE_KEY` only after specific approval. Verify enabled version metadata and grant exact runtime Secret Accessor; never print the PEM or token. Team/Key parameters currently default empty; configure `APPLE_REVOCATION_TEAM_ID`, `APPLE_REVOCATION_KEY_ID`, `APPLE_REVOCATION_CLIENT_ID` in protected deployment configuration.
- [ ] Verify provider configuration, real native exchange/revoke/re-registration, same-subject/linked accounts, cancel/expiry/manual fallback, Apple notification sign-out, and private-relay delivery if used. Portal access and real grants unverified.
- [ ] Deployer can deploy Functions/Run, use Build/Artifact Registry, update indexes/rules, create Eventarc/Scheduler, act as selected SAs; separate approver/operator for IAM deny and secret changes. Read access here does not prove deployment permissions.
- [ ] Runtime can transact/read/list/delete Firestore, administer required Auth deletion/provider reads, and read/create/delete/list owned Storage; exact secret versions mount successfully. Prefer scoped identities; do not blindly remove shared Editor or change service-agent roles.
- [ ] Storage-to-Firestore and Storage-to-Pub/Sub permissions; Eventarc receiver/target invoker; Scheduler OIDC target/audience; billing/project quotas; authenticated diagnostic access and alert recipients verified.
- [ ] Approve budgets, extraction's existing 2/month allowance, indexing/ingestion limits, legacy inventory, deletion support and retention. SerpApi live search remains disabled/unconfigured; curated shopping works. Do not enable affiliate UID tags or live search without privacy/provider configuration review.

## 4. Build 9 transition and release-number ownership

Fresh EAS records: production build **9** `f99e432e-1d39-464b-b73d-7aef91cc212b`, source `541157db46bb5289b2e1459a38ef7b2f2deeb3d4`; simulator build **9** `adc8a66b-74df-4174-8862-118b7684c45b`, base current HEAD plus historical dirty source. Neither certifies P1-02–P1-08 in a signed artifact. No later build appears in the five most recent records.

| Question | Verified answer / required action |
|---|---|
| Internal/external Build 9 availability | **Unknown:** ASC sign-in barrier. Owner must inspect app 6768546665 → TestFlight → iOS 1.0.0 (9): expiration, processing/beta-review state, internal/external group assignments and automatic distribution. Record counts/settings without tester identities. |
| Can an installed old binary call the backend? | Yes, distribution controls alone are not backend authorization. Valid Firebase sessions may call public callable endpoints, and Auth restoration is not disabled by a build number. Network/runtime behavior of an expired installed artifact is untested. |
| Consent-dependent generation/import/indexing | Missing/outdated/revoked consent fails closed. Approval granted through an updated client is account-wide; old callers may then use AI. This is not a consent bypass, but the old app cannot manage approval. |
| Closet delete | Old source starts Storage deletion before direct Firestore deletion. Both unsafe operations are denied under candidate rules; updated callable required. |
| Upload / normal edits | New create-only upload may succeed; protected document attach/edit/save lacks a media permit and is denied. Potential orphans recover. Counter/date/laundry/favorite operations may remain compatible. |
| Account delete | Old source ignores fulfilled response payload. Candidate rejects missing durable-deletion contract before new acceptance, so it cannot falsely clear the session for pending success. Already accepted deletion recovers independently. Old UI displays generic error. |
| Auth and reading data | Generally retained for active owners; existing account/item fences still apply. Do not delete accounts, reset passwords or reuse UIDs as an upgrade strategy. |
| Upgrade notice | Build 9 has no reader and genericizes server errors. Updated app's contract=1 notice is advisory; missing/offline policy cannot grant backend rights. minimumContract=1 does **not** install a notice in Build 9; setting 10 would incorrectly block the new contract-1 app. |

**Build 10 must be ready for immediate distribution before enforcement cutover, but must not be broadly usable against the old backend.** Prepare/upload/process it under separately approved build/submission steps with automatic distribution off, rehearse on an isolated environment, then hold it from ordinary testers until complete backend enforcement passes. Do not ship a new client first with unsupported consent/deletion endpoints. Do not deploy the backend days before a replacement can be obtained.

Before scheduling downtime, verify the replacement is installable by the affected cohort and communicate the window, TestFlight update instructions, preserved account/data, and monitored support/deletion route. After safe backend cutover, release the replacement promptly; only then expire Build 9 with approval. Apple says removing testers leaves existing builds accessible until expiration, so removal is not the security control. Validate an installed/offline old binary and pending writes in staging. [Apple tester-removal behavior](https://developer.apple.com/help/app-store-connect/test-a-beta-version/delete-testers-from-testflight).

There is **no zero-downtime/graceful in-app transition for unmodified Build 9** established here. If its cohort cannot update, reschedule cutover or approve a separately tested bridge client; do not weaken consent, permit or deletion enforcement. Temporarily rejected operations preserve server data but require honest maintenance/support communication. This operational approval is a deployment blocker.

Version ownership remains local: Expo/Info.plist/Xcode baseline **1.0.0 (9)**; both store profiles auto-increment, simulator does not. Next expected number **10**, pending fresh ASC reservation check by a single release owner. Preserve SDK **54.0.37**, RN **0.81.5**, Router resolution **6.0.24**, pinned **macos-sequoia-15.6-xcode-26.0**. No migration/prebuild/native regeneration authorized.

## 5. Privacy publication and retention

Anonymous HTTP GETs on October 11 returned **200** for [Privacy](https://aura-kasatlabs.vercel.app/privacy), [Terms](https://aura-kasatlabs.vercel.app/terms), `/support`, `/delete-account`. The web fetch tool could not retrieve the first two; direct HTTPS from this machine did. Response hashes/extracted text are retained. Public reachability is observed from one connection; policy correctness is **FAIL**.

Local `shared/privacyPolicy.ts` / generated `PRIVACY_POLICY.md` / `website/lib/privacyPolicy.ts` agree by the sync check and contain current optional consent, providers/data categories, pseudonymous diagnostics, async deletion/fences and canonical support. Live privacy lacks these. Local Terms and website Terms still require owner approval; their substantive beta language remains largely similar to live, but live contact is stale. Do not silently reinterpret broad Terms processing permission as AI consent. Local policy still explicitly distinguishes unverified live enforcement; approve publication timing/copy at cutover rather than publishing an inaccurate claim early.

`support@getaura.app`: Google MX and SPF records observed. No DMARC TXT answer returned in this check. This is not a mailbox existence, inbox access, receipt, reply, spam-filter or monitoring check. No SMTP probing/message sent. Owner must approve a benign receipt/reply test and identify the support operator, including account-deletion requests during maintenance and Apple private-relay handling where applicable. Contact gate remains open.

App Store answers remain drafts, not submitted: reconcile linked UID/contact, photos/audio/chat/embeddings, Firebase interaction analytics, Sentry diagnostics, precise weather location, calendar context, consent/deletion identifiers. Resolve the draft's blanket “Health and Fitness not collected” versus body/fit measurement caveat. Verify affiliate UID tagging/provider behavior before claiming No Tracking. Consent is not an exemption from disclosure. Legal/owner approval is required for final copy/age/terms; this audit does not supply legal sign-off.

Retention decisions: 7-day Storage soft delete versus removal of live bytes; permanent account tombstones and item/media fences; recurring media/sweep jobs; expired permits removed by bounded recovery rather than instant erasure; long-lived caches/consent jobs/counters; temporary audio; mobile caches/OS backups; 30/400-day cloud logs plus other sinks; Sentry/OpenAI/optional SerpApi controls. `store:false` does not establish zero provider retention. The website Sheets/Apps Script waitlist is separate from Firebase deletion: approve access, duration, duplicate/abuse handling and verified removal procedures. No waitlist rows read. Restores must reapply deletion/retirement fences before data access resumes.

## 6. Controlled deployment runbook — NOT EXECUTED

All mutations below require approval for the exact environment, frozen source hash, resource list, maintenance window, dedicated test identities and provider budget. Run in a **separate reviewed release checkout**, never by overwriting the user's dirty workspace. Commands with variables require recorded, reviewed values; missing values are a stop condition. Do not use `--force`, accept index-deletion prompts, provision Tasks, or log credential values. The proposed maintenance configuration is under `docs/deployment/`; the normal firebase.json does not reference it.

### Phase A — freeze, approvals, isolated rehearsal

1. Freeze the full dependency closure including untracked files; review mixed website/tooling/native changes separately. Record source/lock/tool hashes, endpoint manifest and future upload archive secret scan. Pin tested tooling: this audit used Firebase CLI 15.13.0, gcloud 563.0.0, Node 24.12.0 and Node 22 test runtime. EAS metadata used installed18.11.0; choose/rehearse an explicit supported EAS version for the later build, not an unreviewed `latest` change during cutover.
2. Approvals: cloud resource/IAM/Apple secret; isolated project and synthetic provider spend; scoped historical inventory/backfill; backup/export retention; public policy publication and support test; maintenance/Build 9 communication/expiration; native build/upload/TestFlight cohort. These are distinct from “approve deployment.” Obtain on-call owner and forward-recovery decision maker.
3. Use an approved isolated Firebase project with no production bucket/credentials/data. Configure same regions/rules/indexes/secret bindings; initially set AI off, cleanup off. Deploy full candidate, run the authenticated matrix in §7, then rehearse the maintenance hold/drain/restore against an old-revision fixture. No staging project was provisioned here.
4. Reconcile indexes using [the additive proposal](deployment/firestore.indexes.p109.proposed.json): eight composites/vectors and nine field overrides. Compare against a fresh live snapshot before adopting; keep existing root `firestore.indexes.json` untouched until review. Proposed file is not referenced by active firebase.json.

```sh
# READ ONLY, explicit approved project; capture in protected release evidence.
firebase functions:list --project "$AURA_PROJECT" --json
gcloud run services list --project "$AURA_PROJECT" --region us-central1 --format=json
gcloud firestore indexes composite list --project "$AURA_PROJECT" --database='(default)'
gcloud firestore indexes fields list --project "$AURA_PROJECT" --database='(default)'
gcloud scheduler jobs list --project "$AURA_PROJECT" --location us-central1
gcloud eventarc triggers list --project "$AURA_PROJECT" --location nam5
gcloud eventarc triggers list --project "$AURA_PROJECT" --location us-central1
gcloud iam policies list --attachment-point="cloudresourcemanager.googleapis.com/projects/$AURA_PROJECT_NUMBER" --kind=denypolicies
```

### Phase B — recovery preparation and additive infrastructure

5. Capture current function source/image digests, all revision/traffic/tag metadata, ruleset IDs/source, index specs, IAM policies, Eventarc/Scheduler/subscription configs and secret **version IDs**. Approve a restricted backup bucket/location/retention, Firestore export and Storage recovery-copy strategy. Bucket soft delete is not a tested backup. Rehearse restore in isolation, retaining/reapplying latest deletion/retirement ledgers; never restore old data directly into serving production. Final consistent data snapshot follows write freeze and drain, not just an arbitrary timestamp while old workers write.
6. After specific approvals, configure Apple parameters/secret and scoped runtime/service-agent IAM. Never echo keys or use public Expo variables. Existing OpenAI key/version remains unchanged.

```sh
# FUTURE MUTATIONS — separate secret/IAM approval required.
firebase functions:secrets:set APPLE_REVOCATION_PRIVATE_KEY --project "$AURA_PROJECT" --data-file "$AURA_APPLE_KEY_FILE"
gcloud secrets add-iam-policy-binding APPLE_REVOCATION_PRIVATE_KEY --project "$AURA_PROJECT" --member="serviceAccount:$AURA_REVOCATION_RUNTIME_SA" --role=roles/secretmanager.secretAccessor
gcloud projects add-iam-policy-binding "$AURA_PROJECT" --member="serviceAccount:service-${AURA_PROJECT_NUMBER}@gcp-sa-firebasestorage.iam.gserviceaccount.com" --role=roles/firebaserules.firestoreServiceAgent
# If effective IAM/rehearsal proves it is needed:
gcloud projects add-iam-policy-binding "$AURA_PROJECT" --member="serviceAccount:service-${AURA_PROJECT_NUMBER}@gs-project-accounts.iam.gserviceaccount.com" --role=roles/pubsub.publisher
# In the reviewed release checkout only, after comparing live index inventory:
cp docs/deployment/firestore.indexes.p109.proposed.json firestore.indexes.json
firebase deploy --project "$AURA_PROJECT" --only firestore:indexes
# READ ONLY: wait for both preserved vectors and new query indexes READY.
gcloud firestore indexes composite list --project "$AURA_PROJECT" --database='(default)'
gcloud firestore indexes fields list --project "$AURA_PROJECT" --database='(default)'
```

Do not assume non-interactive rules deployment grants cross-service IAM. Validate the actual resolved runtime SA: a secret binding on one function does not isolate that secret from other functions using the same SA with Secret Accessor.

### Phase C — legacy-worker drain, with stop conditions

7. Confirm replacement artifact availability and support/communication readiness. Repeat count-only deletion/job checks immediately before the window. Current counts are zero, not a promise about that future moment. If accepted deletion exists, do **not** apply a blanket hold without a reviewed exception/continuity plan for trusted deletion recovery. Notify testers using separately approved communication; never imply their wardrobe will be deleted.
8. Pause the old daily scheduler and install an **independent invocation hold**. Proposed [IAM deny policy](deployment/run-invocation-deny.p109.proposed.json) denies `run.googleapis.com/routes.invoke` to all principals at the project attachment point; this permission is documented as deny-supported. It overrides inherited allow grants while preserving deployment control-plane permissions. Its blast radius is **all Run invocation in the project**, currently 48 services, including event/scheduled calls and health. Re-inventory and obtain explicit approval; confirm IAM checks stay enabled and the deny survives every deploy. If organization policy/CLI/rehearsal cannot enforce it, STOP; a flag or removing allUsers alone is not a substitute. [Deny permission support](https://docs.cloud.google.com/iam/docs/deny-permissions-support), [policy commands](https://docs.cloud.google.com/iam/docs/deny-access).

```sh
# FUTURE MUTATIONS, approved maintenance window only.
gcloud scheduler jobs pause firebase-schedule-cleanupAbandonedDraftClosetItems-us-central1 --project "$AURA_PROJECT" --location us-central1
gcloud iam policies create aura-p109-invocation-hold \
  --attachment-point="cloudresourcemanager.googleapis.com/projects/$AURA_PROJECT_NUMBER" \
  --kind=denypolicies --policy-file=docs/deployment/run-invocation-deny.p109.proposed.json
```

9. Freeze client Firestore/Storage writes using separately reviewed temporary rules. Concrete conservative option: temporary **deny-all reads and writes**, for both databases' recursive match and bucket recursive match, in [the proposed maintenance config](deployment/firebase.maintenance.p109.json). This creates declared downtime, not deletion; in-app profile/status and policy-document reads also fail during this initial freeze, so the external support/deletion channel must be staffed. The bundled policy remains available. Keep public website/support available. Local emulator checks are recorded below; repeat in staging first; a `deny` added beside existing `allow` rules does not override them. Deploy from that reviewed config, not a sed rewrite of candidate rules:

```sh
# The proposed config contains ONLY deny-all rules, with local emulator ports.
# Never deploy this as the normal steady-state configuration.
firebase deploy --project "$AURA_PROJECT" --config docs/deployment/firebase.maintenance.p109.json --only firestore:rules,storage
```

Verify real synthetic owner writes denied, anonymous/normal callable/Run/revision-tag URLs denied, and Eventarc/Scheduler identities unable to invoke old handlers. Record metadata/status only. No live account destructive probes. Already accepted writes/provider requests/uploads can finish; freeze is not atomic across these services.

10. Observe old revision in-flight requests/instances, request completion, background activity and managed subscription age without retrieving application payload logs. A wait of 540s plus margin is a **minimum observation window, not proof of termination**. Cloud Run explicitly permits code to continue after timeout. Remove traffic tags/routes to old revisions, retain artifact/source metadata, and retire/delete only the reviewed old revision list after candidate replacement is ready. Deleting a serving revision or the whole Function/trigger is not the plan. Require zero old traffic and verified old-instance termination before reopening; absence of recent request logs alone is insufficient. [Cloud Run timeout behavior](https://docs.cloud.google.com/run/docs/configuring/request-timeout).

```sh
# READ ONLY, per recorded service; do not dump environment/secret values.
gcloud run revisions list --project "$AURA_PROJECT" --region us-central1 --service "$AURA_SERVICE" --format='table(metadata.name,status.conditions[0].status)'
gcloud run services describe "$AURA_SERVICE" --project "$AURA_PROJECT" --region us-central1 --format='json(status.traffic,status.latestReadyRevisionName)'
# FUTURE MUTATION: only a reviewed NON-serving old revision, under the hold,
# after artifact/config preservation and candidate readiness; one at a time.
gcloud run revisions delete "$AURA_OLD_REVISION" --project "$AURA_PROJECT" --region us-central1
```

The hold blocks new invocation but does not cancel requests already dispatched, cached provider keys or Storage sessions. Old revisions must be absent/terminated, and legacy upload settlement must pass §2. Do not delete Eventarc triggers/subscriptions to “drain” them: current 24h retention/retry-off requires a short measured window and approved current-state reconciliation for lost work. No actual drain proof exists yet; this is a hard production gate.

### Phase D — cutover under isolation

11. Prepare the approved final recovery snapshot and scoped read inventory; execute them only after the candidate has replaced the old revisions under the hold in step 12 and old-instance termination has been verified. This ordering avoids trying to delete the sole serving revision before its replacement exists. Snapshot/export itself copies private data and needs separate approval. There is no mandatory destructive transformation; do not purge/rename historical images or manufacture consent.

```sh
# FUTURE DATA COPY: approved restricted bucket and retention only.
gcloud firestore export "$AURA_APPROVED_BACKUP_URI" --project "$AURA_PROJECT" --database='(default)'
```

12. Deploy the full **57-export** candidate while the invocation hold and temporary rules remain. This replacement is still isolated: after it is ready, complete step 10’s old-revision retirement/termination checks, then step 11’s final snapshot/inventory, before installing final rules or allowing any handler invocation. Deploying all Functions is non-atomic; the independent hold must remain effective across old/new service URLs. If any deployment step drops it or exposes a legacy revision, stop. Do not open consent/deletion acceptance midway. A separate “acceptance-last” function split is unnecessary under a proven full hold and does not replace that hold.

```sh
npm --prefix functions run lint
npm --prefix functions run build
firebase deploy --project "$AURA_PROJECT" --only functions
# Verify 57 names, Node 22, exact revisions/traffic, finalizer bucket,
# retry policies, secret VERSION bindings and recovery 1/1 limits.
# Keep invocation hold; install final protected rules, replacing temporary ones.
firebase deploy --project "$AURA_PROJECT" --only firestore:rules,storage
```

13. Write reviewed control documents through an approved operator using Admin SDK with explicit target and no emulator environment: `releaseControl/ai = {enabled:false}`, `/mediaSafety = {cleanupEnabled:false}`, `/client = {minimumContract:1,maintenance:true}`. These are **configuration mutations requiring approval**, not this task's actions. Use update masks/merge and record before/after fields; never overwrite unrelated settings. `setAiConsent` remains the only user-decision path; do not insert accepted consent as operator. Full privacy/ownership/deletion enforcement is always on in candidate; no compatibility bypass.
14. Verify no old serving/tagged revisions or instances, indexes READY, rules version hashes and effective IAM. Explicitly retain/restart new recovery after exposure; if mounting OpenAI fails, forward-fix a deletion-capable recovery deployment rather than leaving accepted deletions without service. A five-minute scheduler is not considered verified merely because deployment reports success.
15. For controlled authenticated HTTP smoke under isolation, prepare a reviewed deny-policy exception for an operator/test invoker plus the exact new event/recovery identities **only after old revisions are eliminated**. Current shared SA cannot distinguish old versus new revisions. Preserve policy etag when updating. A test harness can send Firebase ID token in `Authorization` and Cloud Run invoker token in `X-Serverless-Authorization`; never log either. A GCP invocation permission does not bypass callable Firebase ownership/consent. Current native app has no such harness header; do not claim native production smoke while this hold remains. [Cloud Run service authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service).
16. Run §7 on dedicated accounts under an agreed small provider budget. Temporarily allowing AI in this phase is an explicit controlled configuration step; missing/revoked consent must still deny. Keep cleanup off until isolated cleanup tests and approved legacy capacity/upload inventory pass. New cleanup flag is project-wide, **not cohort scoped**; do not call enabling it a one-user canary if other jobs are eligible.

### Phase E — matched app, acceptance, monitoring

17. Separately approved signed SDK 54/Xcode 26 candidate: verify archive upload inputs; reserve number10 (or actual next ASC number), environment/bundle/provisioning/Apple entitlement, actual image/Xcode and artifact hashes. Future build command `npx eas-cli@<approved-version> build --platform ios --profile production --wait` is **not run or authorized here**. Future submission `npx eas-cli@<approved-version> submit --platform ios --id <approved-build-id>` likewise requires approval; disable automatic tester distribution. No native artifact was generated by P1-09.
18. With backend/smoke/legacy gates passed and update ready, remove the **specific** invocation hold, restore reviewed normal IAM (never blanket old project policy), resume daily cleanup and verify the new recovery schedule. Approve AI enabled and clear the updated-client maintenance notice. Then distribute to the internal/dedicated cohort promptly and expire Build 9 through ASC with approval. Rules continue to reject old unsafe writes even if old installations call directly. Native exact-artifact tests must run on iOS 26.5/27 and physical iPhone before external invitations. If the distribution handoff cannot happen, hold the release; do not deliberately strand testers on generic errors.

```sh
# FUTURE MUTATIONS, reopening sign-off only. Verify current etag first.
gcloud iam policies delete aura-p109-invocation-hold \
  --attachment-point="cloudresourcemanager.googleapis.com/projects/$AURA_PROJECT_NUMBER" \
  --kind=denypolicies --etag="$AURA_HOLD_ETAG"
gcloud scheduler jobs resume firebase-schedule-cleanupAbandonedDraftClosetItems-us-central1 --project "$AURA_PROJECT" --location us-central1
# New recovery job normally deploys enabled. If intentionally paused during
# rehearsal, resume its verified name only after safe recovery is available:
gcloud scheduler jobs resume firebase-schedule-recoverAccountDeletions-us-central1 --project "$AURA_PROJECT" --location us-central1
```

19. New retirement activation is a separate destructive-operation sign-off. Capacity exceptions, lingering sessions, dormant inventory coverage and monitoring must be accepted first; otherwise the system remains NOT READY for complete Beta 1 erasure guarantees. Continue already accepted account/retirement recovery. Observe 24–48h of controlled operation, oldest job ages and actual quota/cost before expanding external groups. External beta has its own GO decision.

## 7. Dedicated authenticated smoke matrix — approval required

Use empty isolated staging first, synthetic images/outfits, two email accounts plus separately approved Apple/Google test identities. Assert environment/project/bucket and UID allowlist at harness startup. Existing production users and arbitrary UIDs are prohibited. No real provider credentials used in this task.

| Journey / fault | Required observed evidence |
|---|---|
| Create/login/onboard/restore/reset | Cold/warm routes, delayed Auth, signed-in recovery, stale/invalid reset actions, unsolicited callbacks safe; native real-provider success separate from mocks. |
| Missing/declined/outdated consent | Manual upload/local cutout/edit/save/browse/settings/deletion usable; no provider transmission. Account A approval never applies to B. |
| Accept then AI | Current version/server timestamp/revision; one small generation, intake/indexing, import, extraction/layout and shopping fallback; structured outfit/card preserved. Both Polish endpoints denied even for legacy flags. |
| Revoke with queued/in-flight/retried jobs | No subsequent authorized dispatch; no stale commits after revision change; manual actions still work; document unavoidable already-sent data. |
| Shared/legacy image and delayed upload | Two references/delete-one/last-reference, duplicate worker, late finalization, failed Storage removal/retry, new-reference vs retirement barrier; actual pre-cutover resumable session/rule replacement. |
| Indexing load/recovery | 10/25/50/100 synthetic cases with fault-controlled provider in staging; actual Scheduler/Eventarc redelivery, quotas/global leases, current-content/creation guard and large-account overflow without deletion. Real provider sample separately bounded. |
| Durable deletion | Fresh/stale/linked Apple proof/fallback, two sessions, upload pending, interrupted worker, status after relaunch, Auth-last, final tombstone and unrelated account preserved. Do not reset fences to retry. |
| Build 9 / transition | Installed known artifact plus old contract harness: denied protected writes/direct deletes/no-ack account delete; no data loss on error; update installs/retains account; offline queue cannot bypass fences; support and privacy remain accessible. |
| Operations | Two real five-minute deliveries; trigger errors recover; expired lock does not authorize attachment until invalidated; secret/IAM failure alerts; approved staging-only worker interruption; scoped forward recovery. |

Record source/artifact/config hashes, secret version IDs, safe status/reason/counters, latency and redacted screenshots. Never log reset codes, tokens, URL query parameters, image URLs or private content. Cleanup only synthetic accounts through the tested deletion flow, retaining required tombstones. Production destructive fault injection is excluded.

## 8. Capacity and cost worksheet

No bill forecast can be closed without per-account document/reference counts, arrival rate, provider token/image volumes and verified billing rates/alerts. The available metadata supports these bounds and scenarios:

| Work | Source bound / calculated planning estimate |
|---|---|
| Stored media | 0.43756 GiB observed bucket gauge; not guaranteed reclaimable. Gross storage cost = 0.43756 × applicable regional GiB-month rate, plus soft-delete/recovery storage, egress and operations. No full-data duplication required by default migration. |
| Scheduler | Two jobs after rollout, 288 recovery ticks/day. Published $0.10/job/31 days gives **$0.20 gross per 31 days**, before shared billing-account three-job free allowance; compute/DB/provider charges additional. |
| Empty recovery | Nine bounded queries/tick in successful empty path (account, index, locks, item, retired, sweeps, expired permits, inventories, ingestion): **2,592 queries/day**, before daily cleanup, listeners, transaction retries or rule reads. Not the earlier two-query estimate. |
| Inventory | Up to 5 due owners ×100 objects/tick = at most144,000 considered objects/day under ideal service. Required pages = sum over owners ceil(objects/100); 2,267 objects have an absolute minimum 23 pages if all eligible, but owner partitioning/other prefixes increase it. Sequential per-object transactions and runtime bounds reduce actual throughput. |
| General sweep |20 object jobs/tick =5,760 visits/day. If all 2,267 objects entered once, at least 114 ticks (~9h30m service slots), **after 24h grace**, with no competing work/scan failures. Not an erasure SLA. Daily revisits consume capacity again. |
| Retired retry / item cleanup |50 retired records/tick=14,400/day;10 item pages/tick=2,880 pages/day, up to100 objects/page. Retired tombstones revisit even after missing-object404, so long-term totals matter. |
| Permit expiry / locks |100 expired permits/tick=28,800/day;20 expired locks/tick=5,760/day. A permit expires in2min for authorization, not retention. Twenty users each creating 2,000 distinct permits/day could exceed expiry throughput; unchanged-destination refreshes differ. Measure actual arrival rate, not only current Storage bytes. |
| Reference scans | Up to 5,000 positions/55s each. Sweep grouping reduces duplicate owner scans within a batch; item cleanup can scan again. Worst-case20 distinct near-limit owners/tick implies ~100,000 document reads/tick (~28.8m/day) plus traversal/list RPCs. Actual slow scans may time out first. This is a cost stress bound, not expected beta workload. |
| Indexing |40 considered jobs/tick=11,520/day globally;4 leases,10/min and50/day per UID;8 attempts+one explicit extra cycle. If all 2,267 objects were distinct eligible items (not established), first indexing needs at least 57 global ticks and each owner's ceil(items/50) quota days. Objects are not an item count. Roughly8 writes/success plus reads/provider tokens/vector storage. |

Price references: [Scheduler](https://cloud.google.com/scheduler/pricing), [regional Storage](https://cloud.google.com/storage/pricing), [Firestore](https://cloud.google.com/firestore/pricing). Use actual SKU/free-tier/region/contract rates in the approved budget; no invented provider pricing or total-dollar cap is asserted. Recovery media operations do not themselves invoke paid AI; indexing/ingestion retries can. Build/Artifact Registry/Eventarc/PubSub/Secret Manager/logging/backup operations also cost money.

Approval thresholds must include operator/recipient and response: no recovery success for 15min; eligible non-quota index job >15min; deletion past settle overdue >30min; repeated media scan overflow; expired-permit backlog; retired bytes/age not falling; Function errors and spend acceleration. Proposed thresholds are not installed alerts. Any cross-user access, unconsented provider dispatch, deleted-item resurrection or removal of an actively referenced image is a stop-and-isolate event. Budget alerts are notifications, not hard spend caps. Leave cleanup disabled until measured scans/backlog fit the cohort and over-limit accounts have an approved forward-recovery plan.

## 9. Rollback and forward recovery

| Failure point | Safe response |
|---|---|
| Index/IAM/staging preparation fails before production cutover | Stop; preserve old operation until a complete rollout is approved. Keep additive indexes; do not accept remote index deletion. No need to mutate data to undo an unused proposal. |
| Partial function/rule deployment under hold | Keep invocation hold and temporary/final restrictive rules. Fix and redeploy the **same complete safe closure**, validate revision matrix. Do not reopen a mixed fleet or deploy old writers as a shortcut. |
| New candidate after consent/deletion/media acceptance | Pause new AI and new retirement as appropriate; preserve consent revisions, account/item/media fences, quotas, leases and accepted cleanup. Use a tested safe checkpoint or forward fix. Build 9 is not a compatible app rollback. |
| Media removed or data exported/restored | Restore only approved active data into isolation, apply **current** fences before serving, and re-upload affected active media under new immutable paths with guarded reference updates. Never clear retirement to reuse a path or restore a deleted account. Storage bytes, Apple revocation and accepted erasure cannot be undone by git rollback. |
| Scheduler/secret incident | Keep deletion recovery available; do not stop the whole recovery function to stop AI. Repair IAM/mount/config or forward-deploy a deletion-capable variant. Preserve due work; never TTL/delete queues to silence alarms. |
| App/distribution failure | Keep data intact, communicate support path and maintain bounded downtime. Repair matching app; never weaken server contracts to accommodate old UI. |

After acceptance, do not broadly restore old IAM/rules/source snapshots, reset consent, delete tombstones or replay historical payloads directly. Backups are disaster-recovery material with deletion obligations, not an authorization to resurrect state. No rollback/restore executed.

## 10. Fresh local verification

| Check | October11 result |
|---|---|
| Client Jest, Node 24 and Node 22 | **50 suites /281 tests PASS** each |
| Backend Jest, Node 24 and Node 22, functions cwd | **38 suites /385 tests PASS** each |
| Complete isolated Auth/Firestore/Storage chain | **116 checks PASS in one run:**22 media+23 ingestion+22 indexing+18 account deletion+12 consent+19 security |
| Intelligence / styling | **84/84 and30/30 PASS**, no paid judge |
| App TypeScript / lint | PASS;9 pre-existing lint warnings,0 errors |
| Backend lint / TypeScript build | PASS |
| Privacy sync / whitespace | PASS |
| Local production iOS JS/Hermes export | PASS; JavaScript bundle only, not a native build/launch |
| Website TypeScript / lint / production build | PASS |
| Proposed maintenance rules, separate emulator run | **12 checks PASS**: owner/anonymous Firestore read/write/delete and Storage read/upload/delete denied; seeded data unchanged |
| New native artifact / real providers / deployed triggers, IAM, drain | **NOT RUN** |

The indexing emulator recorded209 mocked embedding calls, maximum observed concurrency2 in this run (asserted bound4); logical quota/lease tests are not real cloud throughput. Full chain validates shared-media barriers, account fences, revoked/queued/retried work, old-client denials and manual allowed journeys. Handler `.run` does not exercise Eventarc/Scheduler delivery. Exit139 did not recur on either runtime. Existing duplicate-libvips warning remains; no proven root cause or package change is claimed. The first maintenance harness run stopped on an absolute-path module-resolution error before assertions; using Node createRequire from the functions package fixed the harness, and all 12 checks passed without changing the proposed rules. Both logs are retained.

Commands run from `closet/` unless noted:

```sh
npm test -- --runInBand
npm run typecheck
npm run lint
npm --prefix functions test -- --runInBand
npm --prefix functions run lint
npm --prefix functions run build
# Repeat from both closet/ and closet/functions/:
npx --yes --package=node@22 node node_modules/jest/bin/jest.js --runInBand
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" firebase emulators:exec --project demo-aura-beta --config firebase.beta-test.json --only auth,firestore,storage 'node scripts/test-media-safety.cjs && node scripts/test-photo-ingestion-race.cjs && node scripts/test-indexing-recovery.cjs && node scripts/test-account-deletion.cjs && node scripts/test-ai-consent.cjs && node scripts/test-beta-security.cjs'
node scripts/aura-intelligence-eval.cjs
# From the evidence directory:
node /Users/athfan/wardrobe-ai/closet/functions/scripts/runAuraEvalGate.cjs
node scripts/sync-privacy-policy.cjs --check
git diff --check
npx expo export --platform ios --output-dir ../qa-artifacts/production-preflight-2026-10-11/ios-js-export
npm --prefix website run typecheck
npm --prefix website run lint
npm --prefix website run build
# Read-only build history; no source upload:
eas build:list --platform ios --limit 5 --json --non-interactive
```

## 11. Approval package and decision

Required sign-offs before production authorization:

1. **Release/security:** frozen complete source/config; fresh metadata and 57-export manifest; isolated rollout/drain rehearsal, IAM deny permission/blast-radius review, temporary-rules validation, old-revision termination and pre-cutover upload proof.
2. **Cloud/privacy:** Apple key/config, Storage IAM/events, READY additive indexes, recovery deliveries, backup/restore retention, budget/quotas/alerts and monitored support.
3. **Data owner:** scoped legacy reference/capacity inventory, dormant-user recovery coverage, exception strategy for over-limit accounts, any marker/backfill/cache operation, and separate project-wide cleanup activation.
4. **Product/release:** ASC distribution/build-number verification, ready replacement and approved downtime/communication/expiration; real providers/physical device and exact-artifact matrix; correct published disclosures/App Store answers.

**Decision: NOT READY FOR CONTROLLED DEPLOYMENT.** An isolated rehearsal and narrowly scoped inventory can be proposed for separate approval using this package; production is not approved by a green local suite. **External beta: NO-GO.**

P1-09 repository changes are this report, integration/readiness updates, and five inert proposed configuration/rules files under `docs/deployment/`. Active indexes/rules, app/backend/native code, SDK 54/Xcode 26 pin and all unrelated changes are preserved. Exact task-specific hashes and final changed-file list are retained with the evidence. Supplementary maintenance test command: `PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" firebase emulators:exec --project demo-aura-beta --config docs/deployment/firebase.maintenance.p109.json --only auth,firestore,storage 'node /Users/athfan/wardrobe-ai/qa-artifacts/production-preflight-2026-10-11/test-maintenance.cjs'`. This used only loopback emulators; it does not validate the IAM proposal.
