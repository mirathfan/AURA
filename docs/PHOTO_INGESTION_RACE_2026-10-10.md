# P1-07 — Photo ingestion race and deletion integrity

**Deleted-item resurrection: PASS in local regression tests. Deployment: NOT READY TO DEPLOY. External beta: NO-GO.** This closes the reproduced ingestion database defect; it is not a claim of native-device or deployed-event validation, or of atomic transactions across Firestore and Storage.

Reviewed/fixed October 10, 2026, on `main`, base `06ece001c69cb6a84787cebddd521f883ffccb66` plus the existing dirty tree. Read the integration, account-deletion, indexing-recovery, AI-consent and readiness reports. No deployment, provisioning, credentials change, real provider request, production data operation, push, EAS build or submission occurred. Expo SDK 54, Xcode 26.0 pin, native files, cards, flatlays, styling and Photo Refinement disablement were preserved.

Evidence: [photo-ingestion-race-2026-10-10](../../qa-artifacts/photo-ingestion-race-2026-10-10/). Before/after hashes and status identify the actual working tree; HEAD alone does not identify this candidate.

## Confirmed root causes and reproduction

Before modifying source, ran the P1-06 `probe-stale-ingestion.cjs` against isolated `demo-aura-beta` Firestore/Storage/Auth emulators. The real exported ingestion handler received a captured item event after the item document had been hard-deleted. Its unsafe-image error branch used `setUserDocument(..., {merge:true})`. The shared writer checked the **account** deletion fence, but not the current item. The merge recreated the deleted item as `failed/unsafe_image_url`. No external HTTP request was sent. `before-reproduction.log` records the confirmation; its exit zero means the old bug was reproduced, not that old behavior passed.

Additional source findings:

- Processing claims were separate reads and merge writes, allowing competing workers. Completion and failure read current state before a later merge transaction, leaving deletion/edit races between check and commit.
- Cropped/thumbnail outputs used fixed names. Server background removal also overwrote the original object, so an older worker could change bytes used by newer metadata.
- Client draft autofill merged after awaiting upload; a missing draft could be recreated. The cancellation check after that merge was too late. Client image paths were reused across upload attempts.
- Product-import success/failure merged into a supplied item ID after asynchronous extraction. Automatic/manual abandoned-draft cleanup read eligibility before a later raw delete/batch.
- Client closet deletion removed the document directly, leaving no durable per-item identity fence. Media cleanup depended on that client staying alive. Account deletion already had a durable fence; item deletion did not.
- Indexing already used current-document existence, creation identity, content hash, consent revision and job lease checks inside its commit. The new paused-embedding/deletion regression confirms that indexing does not recreate the item.

The after-test invokes the real ingestion handler with a stale deleted-item event and asserts **no document and no provider dispatch**. Further deterministic barriers delete the item while the mock provider is pending and immediately before the final guarded commit. Both reject stale results. See `scripts/test-photo-ingestion-race.cjs` and `emulator-final.log`.

## Atomic lifecycle design

1. `deleteClosetItem` derives ownership from authenticated UID, rejects a mismatched expected UID, validates the item ID, and applies a 60/minute, 500/day deletion-call limit. AI consent is not required for manual deletion. An account-fenced transaction creates `users/{uid}/itemDeletionJobs/{itemId}` and deletes the item in the **same commit**. Repeated deletion is idempotent. Empty-draft cleanup rechecks current eligibility on the server.
2. Firestore rules deny direct item deletion and deny creation/update of a fenced ID. Clients cannot edit fences. New random item IDs remain usable. The fence is retained until account deletion; account cleanup removes the nested fence, while the permanent external account fence continues blocking old tokens/work.
3. Ingestion reads the live item, rejects an event from another Firestore creation, and claims using a transaction that compares the exact snapshot update time, current lifecycle, account/item fences and current timestamped consent. Only one claim wins. Each claim has a unique run ID, source fingerprint, consent revision and ten-minute lease, longer than the 240-second function deadline.
4. Before provider dispatch, before/after generated-object uploads, and at completion/failure, the worker checks the live creation identity, run, source, lifecycle, lease, consent revision and account/item fences. Final writes are `transaction.update`, never create-or-merge. The final payload is computed from the transaction's current snapshot, and is recomputed on transaction retry. Fields changed since the claim remain user-owned; category/subcategory are preserved together.
5. Early invalid-image/quota failures use exact-version transactional updates. Product-import success/failure now compare the item captured before extraction; concurrent edits/removal cause those writes to be discarded. Shared privileged item merge/update/batch helpers also check item fences and require an existing record for merge/update.
6. Draft cleanup uses a current version/eligibility transaction and the same deletion fence. An intervening edit prevents deletion. Bulk results count actual accepted deletions.
7. Consent-denied work pauses only if consent is still unapproved in the same transaction. A late rejection cannot overwrite a newly accepted consent decision. Revocation between preflight and claim pauses without dispatch; revoke/reaccept cannot make an old run valid again.
8. The existing five-minute `recoverAccountDeletions` schedule also recovers expired ingestion leases and item-media cleanup. No new queue service, Cloud Tasks API or additional schedule is introduced. Recovery scans ten due items per tick, reclaims crashes through normal ingestion events, and stops automatic processing after eight attempts. Existing ingestion provider quotas still apply. The ingestion trigger remains non-retrying; this recovery covers **persisted claims**, not every possible failure before a claim.

Client uploads now create a rule-compatible empty draft if necessary, upload into a unique `items/{itemId}/uploads/{UUID}/…` namespace and finalize existing autofill drafts transactionally. Cancellation/account-session checks run before finalization. Changed source photos reject the older upload; unrelated user edits survive. Existing-item deletion during upload is denied by the item fence. Empty abandoned upload drafts remain eligible for existing seven-day cleanup. A user intentionally saving a manual item still uses the existing Save flow; this does not change screen design.

## Storage behavior and limits

- Generated outputs use `items/{itemId}/ingestion/{runId}/…`. Server image processing no longer overwrites original source bytes. Client/local background removal and ordinary uploads remain available without AI consent; server AI remains consent-gated and Photo Refinement remains disabled.
- Storage rules check both account and item deletion fences, including legacy flat `itemId.jpg` / `itemId.cleaned.png` paths and nested paths. The recursive rule requires a real segment after the item ID, avoiding a zero-segment wildcard bypass of the flat-file fence.
- The existing retry-enabled `removeDeletedAccountUpload` finalizer also handles deleted items. It deletes the exact finalized generation, not a newer overwrite. Account-fenced uploads are removed regardless of references in that deleted account. Item cleanup preserves paths referenced by surviving items in the same account.
- Durable deletion jobs sweep at most 100 objects per page and persist continuation. The first sweep is eligible immediately and normally runs on the next five-minute scheduler tick. Partial Storage failure leaves the due work intact. After a full sweep, a daily sweep catches missed finalization events and revisits retained shared media. No hard latency SLA is claimed; backlog/outages delay cleanup.
- Generated media from abandoned/failed runs is reconciled through the ingestion recovery marker. Cleanup lists objects before checking the current processing run, protects that run and current item references, and removes unreferenced older outputs. A worker killed after upload is recoverable without another user edit.
- Firestore and Storage **are not atomic**. An already authorized upload can finish after deletion acceptance; the finalizer and sweep remove it afterwards. In the emulator, starting a resumable upload did not itself establish that a completed object write would be permitted: complete multipart writes and delayed finalization were tested separately.
- The shared-reference scan protects references already present when inspected. A new cross-item reference committed after that scan is not transactionally coordinated with Storage deletion. Existing/new legacy clients can also have already authorized overwrites of shared legacy paths. Unique paths prevent new updated-client overwrites, but do not retroactively cancel those sessions. Strict reference-lifetime guarantees need coordinated reference registration or copying shared media. **This remains an explicit media-integrity limitation and staging/rollout gate, not a proven atomic guarantee.**
- Failed uploads on an existing item remain owned by that item until its deletion/account deletion; this is not a general purge of all historical unused media. Existing draft-cleanup scan caps can delay cleanup of empty abandoned drafts. Storage soft-delete/recovery copies retain the separately reported cloud retention window.

## Build 9 / rollout compatibility

| Build 9 operation against proposed backend/rules | Result |
|---|---|
| Create/update/upload after account deletion acceptance | Denied by account fences; delayed accepted uploads are cleaned |
| Trigger AI without current consent | Denied/paused; no grandfathering. Acceptance on another updated device is account-wide |
| Direct closet-item deletion | **Denied. Build 9 cannot perform this journey with the new rules** |
| Merge/recreate a deleted, fenced item ID | Denied by rules; new privileged writers also reject it |
| New manual item under a fresh ID, active account | Allowed under existing validation; old client still lacks new consent/deletion UX |
| Old Admin worker during a mixed deployment | Rules cannot constrain Admin; old revision drain/maintenance remains mandatory |
| Resurrect a pre-rollout deleted ID with no historical fence | Cannot be distinguished from a fresh client create. No historical item-fence backfill is invented |

The matching client, `deleteClosetItem`, every protected writer, finalizer, scheduler, rules and indexes must ship as a dependency closure under the P1-06 maintenance plan. A mandatory updated-client/maintenance strategy is required before enabling item deletion. No minimum-version gate was deployed or invented here. Do not open acceptance while old Admin revisions remain able to merge stale data. Do not temporarily re-enable direct client deletes as a compatibility workaround.

New source export count: **56** (P1-06 had 55), with one new callable and expanded existing finalizer/scheduler behavior. Add collection-group ascending indexes for `itemDeletionJobs.dueAt` and `items.ingestion.recoverAt`, preserving P1-05's `wardrobeIndexJobs.dueAt`. The pre-existing omission of the two live vector indexes still must be reconciled before any index deployment. No Cloud Tasks resources or new secrets are required by P1-07. The previously missing Storage-to-Firestore rules IAM grant and deployed delivery validation still apply.

Future approved preflight: rerun the commands below; reconcile the additive index manifest; verify indexes READY, cross-service IAM, new callable, exact function revisions, retry-enabled finalizer and five-minute schedule in isolated staging. Test interrupted uploads, same-user shared photos, old clients, scheduler backlog and failed Storage deletes there. Only then rehearse maintenance/drain and request production approval. No deployment command was executed in this task.

Rollback must retain item/account fences, consent gates, the callable deletion contract, recovery fields/indexes and media finalizer. Returning to direct client deletion or old merge-writing workers is unsafe after fences exist. Use a tested forward fix; keep accepted cleanup work running during maintenance.

Cost/retention: deletion adds a transaction, quota counters and a minimal item-ID/timestamp/cursor fence. Sweeps read the owner's current wardrobe to preserve shared media and list/delete object generations. Ten deletion jobs per five-minute tick is at most 2,880 job pages/day; daily revisits of retained fences consume that capacity. This is appropriate only with measured beta volume/backlog monitoring, not an unbounded scaling promise. Account deletion removes item fences. Approve retention/disclosure of these minimal item fences alongside the existing account tombstone policy before release. No paid provider calls are added by deletion or media cleanup; reclaimed ingestion uses existing quotas.

## Regression evidence

All emulator scripts reject non-local emulator addresses and use synthetic owners only. Providers are mocks. Trigger `.run` exercises the exported function with real Admin transactions and Storage, **not deployed Eventarc/Cloud Scheduler delivery**.

| Requested case | Evidence / result |
|---|---|
| Delete during provider wait | Real ingestion handler, explicit provider barrier; no item after late response/replay — PASS |
| Delete immediately before final Firestore write | Final guarded-write barrier; no recreation; media sweep clears generated files — PASS |
| Account deletion during active upload | Actual Storage save crossed the account fence; post-upload guard removed generation — PASS |
| Delayed resumable upload after account deletion begins | Emulator session begun before fence; completion denied or late generation removed — PASS |
| Edit during older ingestion | Name/brand/material/notes/category preserved, category pair guarded — PASS |
| Retry after deletion | Replayed handler and privileged late merge rejected — PASS |
| Duplicate/out-of-order events | Completed replay skips; replaced Firestore creation ignored — PASS |
| Consent revoke / rapid reaccept / revoke before claim | No stale result; no dispatch when claim loses consent — PASS |
| Two workers | Duplicate handler dispatch count one; simultaneous claim transaction winner count one — PASS |
| Valid upload | Actual image decoding/crop/thumbnail writes finish; original bytes unchanged — PASS |
| Cross-user isolation | Forged expected owner rejected; other account's document/media preserved — PASS |
| Crash / partial Storage failure | Lease reclaim rejects old owner; due cleanup remains retryable; orphan output cleanup preserves current references — PASS |
| Existing indexing pending at deletion | Paused mock embedding cannot recreate item — PASS |
| Client cancellation / edit / newer source | Seven client helper tests cover transactional finalization and owner-record creation — PASS |
| Old-client rule bypass | Direct delete, fenced merge, fence forgery, flat/nested completed uploads denied — PASS |

Test totals:

- Client: **48 suites / 263 tests PASS**, on Node 24.12.0 and Node 22.23.3.
- Backend: **37 suites / 375 tests PASS**, on both runtimes, including privileged-write/consent boundary tests.
- Photo ingestion: **22 emulator checks PASS**, nine mock provider calls, zero external transmissions.
- Existing emulator suites: **22 indexing + 18 account deletion + 12 consent + 19 security = 71 PASS**. Indexing includes 10/25/50/100-item bursts, 209 mocked embedding calls and quota-preserving recovery. Combined current coverage: **93 emulator checks**.
- Intelligence: **84/84 PASS**. Styling evaluation gate: **30/30 PASS**.
- Client TypeScript, backend build, backend lint, client lint, privacy-copy synchronization and `git diff --check`: PASS. Backend lint has no warnings; client lint retains nine pre-existing warnings.
- Exit 139 did not recur in these full Node 24/22 test runs. The pre-existing macOS duplicate-libvips warning still appears when loading ingestion. These tests do not validate every optional native/background-removal model path.

The first Storage regression incorrectly expected a resumable *start* to enforce completed-object rules; it was corrected to assert actual writes plus a separate in-flight finalization test. An existing account-deletion fixture modeled only `file.delete`; it was updated to wrap a real Storage File so generation-scoped cleanup is exercised. Neither change weakens the deletion assertions. Earlier failed logs are retained.

Commands run (repository root unless noted):

```sh
npm test -- --runInBand
npm run typecheck
npm run lint
npm --prefix functions test -- --runInBand
npm --prefix functions run lint
npm --prefix functions run build
# Matching Node 22 unit reruns; backend command executed from functions/.
npx --yes --package=node@22 node node_modules/jest/bin/jest.js --runInBand
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" firebase emulators:exec --project demo-aura-beta --config firebase.beta-test.json --only auth,firestore,storage 'node scripts/test-photo-ingestion-race.cjs && node scripts/test-indexing-recovery.cjs && node scripts/test-account-deletion.cjs && node scripts/test-ai-consent.cjs && node scripts/test-beta-security.cjs'
# Final targeted rerun after fixture/claim corrections omitted the already-passed unchanged indexing suite.
node scripts/aura-intelligence-eval.cjs
# Executed from the evidence directory to keep generated reports out of source:
node /Users/athfan/wardrobe-ai/closet/functions/scripts/runAuraEvalGate.cjs
node scripts/sync-privacy-policy.cjs --check
git diff --check
```

## Files changed in P1-07

| Files | Change |
|---|---|
| `functions/src/shared/ingestionLifecycle.ts`, `.test.ts`; `functions/src/ingestItemFromPhotos.ts` | Atomic claim/commit, current edits/consent/source, lease recovery, immutable generated output |
| `functions/src/shared/itemLifecycle.ts`; `functions/src/deleteClosetItem.ts`; `functions/src/index.ts` | Atomic item deletion/fence, authenticated callable, media cleanup |
| `functions/src/shared/accountLifecycle.ts`, `accountStorage.ts`, `pausedIngestion.ts` | Privileged item write/upload fences; consent pause race |
| `functions/src/deleteAccountData.ts` | Reuse existing recovery scheduler and Storage finalizer |
| `functions/src/importProductLink.ts`, `shared/productLinkExtractor.ts` | Version-checked asynchronous import writes |
| `functions/src/ai/wardrobeIntelligence/callables.ts`, `scheduledDraftCleanup.ts` | Current eligibility/version and durable item deletion; no styling/intelligence algorithm changes |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json` | Item fence enforcement and recovery query indexes |
| `src/lib/deleteItem.ts`, `.test.ts` | Callable-based deletion; remove client-only media cleanup |
| `src/lib/itemUploadLifecycle.ts`, `.test.ts`; `src/lib/uploadImage.ts`; `src/addItem/hooks/useItemExtraction.ts` | Empty upload owner, unique object names, transactional/current-session autofill finalization |
| `scripts/test-photo-ingestion-race.cjs`; `scripts/test-account-deletion.cjs` | Deterministic emulator regressions; real File fixture for generation cleanup |
| This report; `docs/RELEASE_INTEGRATION_2026-10-10.md`; `docs/TESTFLIGHT_READINESS_2026-10-09.md` | Current evidence, rollout contract and verdict |

## Remaining release gates

No new native artifact was built or run. Validate the final candidate on physical iPhone and iOS 26.5/27: ordinary/manual and AI uploads, local cutout, rapid cancel/retry/source replacement, app termination mid-upload, background/foreground, offline/reconnect, duplicate/shared photos, account switching and simultaneous deletion on another device. Exercise real Apple/Google only with approval.

Staging must establish actual Eventarc/finalizer/Scheduler delivery and retry, index readiness, Storage cross-service rules IAM, provider cancel behavior, and maintenance/old-client drain. Shared-media reference lifetime remains a specific consistency limitation above. Historical deleted IDs have no reconstructible fence history. Pre-existing privacy publication/mailbox, Apple credentials/configuration, retention, vector-index manifest, release-number ownership and native/runtime gates remain open in P1-06.

**PASS: the reproduced deleted-item database resurrection and tested associated concurrency regressions. NOT READY TO DEPLOY: configuration, rollout, media-reference and deployed validation gates remain. External beta remains NO-GO.**
