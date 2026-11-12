# P1-08 — Shared media safety and legacy-client compatibility

**Shared-media safety: PASS in the local regression matrix. Deployment: NOT READY TO DEPLOY. External beta: NO-GO.** Local passing tests do not establish deployed rules, IAM, event delivery, a complete legacy inventory, or native-device compatibility.

Reviewed October 10, 2026, against `main` at `06ece001c69cb6a84787cebddd521f883ffccb66` plus the existing dirty tree. The P1-03/P1-04/P1-06/P1-07 and TestFlight reports were read; older findings were checked against source and local behavior. Evidence and before/after hashes are in [media-legacy-compatibility-2026-10-10](../../qa-artifacts/media-legacy-compatibility-2026-10-10/). No deployment, provisioning, production-data operation, GitHub push, EAS build, submission, or real provider request occurred.

## Verified problems

1. P1-07 listed Storage generations, scanned surviving **items**, then deleted unreferenced objects. A second item could attach the same path between that scan and deletion. Generation-specific deletion prevents deleting a newer generation; it does not prevent deleting the generation a concurrent reference needs.
2. Saved outfits/looks, chat attachments and nested outfit snapshots, profile images, extraction results and caches can also reference images. Item-only scans did not protect these references. Descendants under missing Firestore parents matter.
3. Storage rules still allowed owner deletes and overwrites. Build 9 starts its image deletions **before** awaiting the Firestore item deletion. A Firestore deletion fence alone cannot stop that Storage operation.
4. Outfit extraction reused caller-supplied trace namespaces. Repeated requests could overwrite existing crops/layout assets independently of item ingestion.
5. Build 9 has no consent editor, media-write protocol, durable-deletion status handling, or remote minimum-contract reader. Its generic error handler discards most callable error text. A new server error cannot retroactively install a graceful upgrade screen in that binary.
6. The new media-permit quota and P1-07 item-deletion quota must belong to the central rate-limit inventory so account deletion removes their counters. Both now do; limits were not increased.

The original shared-reference race is established by source ordering, not a newly captured run of the old binary/backend. Deterministic barriers now exercise attachment before cleanup, during inventory, after retirement before Storage deletion, and after an expired lease is reclaimed.

## Implemented protocol

### Admission of references

- `prepareMediaWrite` derives the owner from callable Auth and checks the expected UID. It accepts only supported user document destinations, bounded patches (20 operations / 500 KB), and at most 100 distinct Storage references. It uses a 60/minute, 2,000/day per-UID limit. This is a Firebase operation; it requires no AI consent and calls no AI provider.
- It reads the account fence, cleanup lock, current destination, applicable item fence, and permanent media-retirement records **in its transaction**. It rejects cross-user paths, temporary audio paths as durable media, retired paths, and deleted item IDs.
- The permit resides at `{destination}/mediaPermits/latest`. Thus identical IDs in different collections/chats do not collide. It contains the proposed protected projection, destination and a two-minute authorization expiry. Expiry is not immediate physical erasure: the bounded recovery sweep removes expired snapshots, so backlog must be monitored. It does not mutate the destination or grant schema/entitlement privileges.
- Firestore rules require the actual resulting protected document projection to equal that permit. All existing owner, schema, access-field and deletion rules still apply. The only exceptions are a short, shared list of validated clothing/laundry status values, the favorite boolean, numeric/timestamp counters and dates; rules validate their types, with ISO wear-date compatibility. Other text/booleans, media, nested maps, arrays and **unknown future fields** require admission. A client cannot hide an image map in a timestamp field, forge a permit, or use an expired permit.
- `mediaFirestore.ts` is an explicit SDK write adapter, used by all current client mutation modules. Reads/listeners retain Firebase behavior. Sets, object updates, adds, batches and transactions prepare their protected projections before the original SDK commit. Transactions retain their original read/version checks; batches remain atomic at the destination writes. Account identity is checked before/after preparation. Existing callers do not use converters, variadic field updates, `mergeFields`, or transforms outside the exempt counters/date fields; expanding that supported surface requires tests.
- Privileged set/update/batch helpers and ingestion transactions check path retirement inside their existing account/item transaction. Other direct transactions write derived non-media indexing/counter/consent/job state; they retain the common cleanup-lock fence. Consent decisions explicitly bypass the media lock, while retaining the account fence, so revocation remains available during cleanup.

A permit is a short-lived reservation protecting an upcoming reference. It is not a client-claimed version, user consent, ownership proof by itself, or a replacement for Firestore rules.

### Retirement and Storage deletion

1. Cleanup is **off by default**. Only the operator-owned `releaseControl/mediaSafety.cleanupEnabled === true` permits new retirement. No such production document was written.
2. Cleanup transactionally acquires `users/{uid}/mediaControl/cleanup`. Client rules and privileged reference writers reject writes while that document exists. Lease expiry **does not** reopen writes automatically. Recovery must transactionally delete/replace the lock, invalidating the old scanner's lease/version.
3. Under the lease, scan the complete user tree, including missing ancestors and unexpired permits. Protect current ingestion-run objects and all persisted references, including legacy flat paths. Soft-deleted `savedOutfits` do not pin media forever; restoring their protected snapshot requires a new permit. Internal retirement/sweep/inventory records do not count as references to themselves.
4. Use the lock's **Firestore commit timestamp** to decide which permits could still have authorized a preceding write. Retirement uses the current Firestore read time and verifies the same lease. It does not rely on a function-host clock opening the lock at the right instant.
5. In one Firestore transaction, create permanent `users/{uid}/retiredMedia/{sha256(path)}` records and release the lock. Only then delete the exact listed Storage generations. A path can never be admitted again once retired. A new upload must use a new path.
6. Failed Storage deletion leaves durable due work. Duplicate/replayed cleanup is idempotent. Retired paths are revisited daily; the retry-enabled finalizer also deletes the exact generation of late uploads. Disabling new retirement does not cancel already accepted cleanup.
7. Client Storage overwrites and direct deletes are denied. Server writes use `ifGenerationMatch: 0`. Updated item uploads already use UUID namespaces; extraction crops/layout outputs now add a server UUID even when a trace ID repeats. No image bytes are copied or redesigned.

Firestore and Storage **do not share a transaction**. This protocol turns the cross-service gap into a recoverable retired-but-not-yet-erased state: the object may remain temporarily, but no new supported reference can attach. Account deletion deliberately overrides per-item sharing: after the account fence, all of that account's objects must be erased. Its external fence remains after the nested media records are removed.

References: [Firestore transaction semantics](https://firebase.google.com/docs/firestore/manage-data/transactions), [rules evaluation/access-call limits](https://firebase.google.com/docs/rules/rules-behavior), [Storage generation preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions). These references explain the primitives; the local tests establish the candidate's observed behavior.

## Covered media owners and compatibility

| Reference / object family | Admission / lifetime |
|---|---|
| Closet photos, raw paths, Firebase/gs/GCS URLs, images/variants/ingestion source, duplicate items | Client permits or guarded Admin transaction; item fence remains; sharing survives until last reference |
| Saved outfits/looks, AURA looks, calendar/planning snapshots and feedback | Existing persistence uses adapter/guarded helpers; nested snapshots scanned; inactive saved-outfit restore revalidates media |
| Chat attachments, outfit cards and nested messages under missing chat parents | Adapter/guarded helpers; recursive inventory protects them until the containing records are removed |
| Root profile image and other user-scoped metadata | Root permit plus original profile rules; owned Firebase image paths included |
| Generated extraction/layout/crop assets and uploads outside `items/` | Immutable paths; finalizer queues general orphan sweeps; subsequent persisted references receive permits |
| Ingestion jobs, extraction/early-access caches and other user documents | Conservatively scanned for persisted references; these can keep media alive until their records are removed |
| Temporary transcription audio | Separate short-lived server transcription cleanup, never admissible as durable image media; account cleanup still covers it |
| External retailer/Google profile URLs, copies outside AURA, local device caches | Not objects owned by this Storage cleanup. This does not promise to erase or preserve external copies/redirects |

Legacy images are **not renamed or purged on deployment**. Their existing references are read directly during a fenced scan; a blind refcount backfill is unnecessary. Mutable legacy object names become create-only under the new rules and are permanently inadmissible after retirement. Already-authorized pre-rollout upload sessions and old Admin revisions require controlled staging/drain validation; this task does not claim to cancel them remotely.

Every new owned image finalization creates a `mediaSweepJobs` record with a 24-hour grace period. New permits register a recurring per-user `mediaInventories/default` marker. The existing scheduler inventories up to 100 objects/page for five due users, sweeps up to 20 object jobs grouped by UID, retries 50 retired objects, clears 20 expired locks, and removes 100 expired permits per tick. Inventory repeats daily and catches lost finalization events. These workers run independently of account-deletion recovery failures; no new scheduler or Cloud Tasks service is introduced.

For dormant pre-upgrade users, an **approved, scoped** inventory-marker backfill is still needed. `inventoryUserMedia(uid, cursor)` is the bounded code entry point; do not run a production-wide scan or purge without approval. Failed jobs stay due. Registered references intentionally pin media, including legacy cache records; expired/shared-cache retention remains a separate approval gate. This is not an unconditional purge of all historical media.

Inventory is bounded to 5,000 user-tree document positions and a 55-second scan budget, with batched reads and at most 20 concurrent traversal RPCs. Exceeding either bound **defers cleanup without deleting media**. Representative large-account throughput and a scoped recovery strategy for over-limit accounts must pass before activation; indefinite backlog is not an acceptable operational sign-off. No universal erasure latency is claimed.

## Build 9 audit and migration decision

Source reviewed at EAS-recorded production Build 9 commit `541157db46bb5289b2e1459a38ef7b2f2deeb3d4`, associated with build `f99e432e-1d39-464b-b73d-7aef91cc212b`. Its uploaded dirty-source state was not reconstructed, and no authenticated run of that artifact occurred here. The historical simulator artifact `adc8a66b-74df-4174-8862-118b7684c45b` is not evidence for these changes.

| Build 9 journey against complete candidate | Result |
|---|---|
| Consent-dependent chat, generation, imports, indexing | Missing/outdated/revoked consent denied. Consent accepted on another updated device remains account-wide; version is not an authorization boundary. Operator AI pause denies even consented provider dispatch |
| Closet deletion | Direct Firestore and Storage deletes denied; cannot damage a surviving shared reference. Journey requires the updated callable-based client |
| Upload/intake and normal text/profile/save writes | New immutable object creation may succeed; subsequent protected document write lacks a permit and is denied. Overwrites denied. Uploaded orphans are queued/recovered. This is safe but disruptive |
| Counter/date/laundry/favorite edits, reading existing closet/saved data | Compatible where existing rules and active-account fence permit; most other writes need upgrade |
| Account deletion | Missing `durable-deletion-v1` acknowledgement rejected **before new acceptance**. Old client cannot receive a fulfilled pending response and mistake it for completion. Already accepted deletion continues through workers |
| Authentication/restoration | Firebase sign-in is not disabled by a version claim. Existing account data remains; subsequent legacy writes may fail. Account-deleting users remain fenced; use updated status UI/support |
| Upgrade display | Build 9 does not read a remote version policy, and `getFriendlyErrorMessage` replaces the new server message with generic text. A graceful in-binary Build 9 upgrade gate cannot be added by deploying this backend |

### Implemented controls

- `releaseControl/client`: optional `{minimumContract: number, maintenance: boolean}`. Updated app contract is **1**. `ReleaseGate` displays a non-destructive notice, TestFlight/support actions, sign-out, and access to in-app privacy/account deletion. Public auth/reset routes and accepted-deletion status remain accessible. No policy was activated remotely.
- `releaseControl/ai`: optional `{enabled: false}` pauses new AI dispatch in the server consent boundary, including provider retries. Manual persistence, consent choices and deletion workers remain available. Already dispatched provider work cannot be recalled; existing consent cancellation limits still apply.
- `releaseControl/mediaSafety`: `{cleanupEnabled: true}` is an **explicit destructive-cleanup activation**, not automatic on deploy. Missing/false means no new retirement.
- `deletionContract: 'durable-deletion-v1'` acknowledges asynchronous deletion semantics. A forged acknowledgement grants no identity, recent-auth, Apple-proof, consent or fence bypass. Updated deletion client sends it; old requests fail without initiating deletion.
- Safe client errors for upgrade, retired media, busy cleanup and AI maintenance contain fixed copy, never raw tokens/URLs/provider errors.

**No build number or contract supplied by a client is a security boundary.** The server validates references, consent, ownership and lifecycle, and rules reject unsafe operations even if the client ignores every notice.

A mandatory Build 9 transition is required. Keep the candidate distribution closed until it is paired with the complete backend. Obtain approval for tester communication and an App Store Connect/TestFlight expiration/removal strategy for Build 9; verify its actual effect on installed devices and offline queues. Do not assume expiration instantly blocks every backend request. Rules and backend authorization provide that protection. Do not grandfather AI consent or temporarily restore direct deletes to improve old-client UX.

## Automated evidence

Final observed results are recorded below. Earlier failed logs are retained: the initial broad scalar exemption exceeded Firestore's 1,000-expression evaluation limit; the final narrow validated status/counter/date policy resolved it. A first nested-permit rules path used string interpolation with slashes; emulator validation rejected it, and it was replaced with explicit path expressions at each match. Neither failure was bypassed by weakening assertions.

| Check | Observed result |
|---|---|
| Client Jest, Node 24.12.0 and 22.23.3 | **50 suites / 281 tests PASS** on each runtime |
| Backend Jest, Node 24.12.0 and 22.23.3 | **38 suites / 385 tests PASS** on each runtime |
| New shared-media emulator suite | **22 checks PASS**, including actual six-item batch and vector-bearing item edits |
| Ingestion emulator suite | **23 checks PASS**, including the added pre-claim lock/redelivery regression; ten mocked provider calls |
| Existing indexing / account deletion / consent / security | **22 + 18 + 12 + 19 checks PASS** |
| Combined distinct emulator coverage | **116 checks PASS**; complete chain plus targeted reruns after the final rules/retry refinements |
| Intelligence / styling eval gate | **84/84 and 30/30 PASS**, no paid judge |
| Client TypeScript / backend build | **PASS** |
| Client / backend lint | **PASS**; nine pre-existing client warnings, zero backend warnings/errors |
| Local production iOS JS/Hermes export | **PASS**; no native launch claim |
| Website TypeScript / lint / production build | **PASS** |
| Privacy-copy synchronization / `git diff --check` | **PASS** |
| Deployed runtime, signed native candidate, physical iPhone/OAuth | **NOT RUN** |

Primary evidence logs: `emulator-release-candidate.log` (complete chain), `emulator-media-release.log` (final 22 media + 19 rules + 12 consent checks), `emulator-ingestion-release.log` (final 23 ingestion checks), `client-tests-final.log`, `backend-tests-final.log`, both `*-node22-final.log`, `intelligence.log`, `styling.log`, and the build/lint/export logs. The earlier test-process exit 139 did not recur. The pre-existing duplicate-libvips warning remains; its cause is not established by these passing runs.

Commands run from `closet/` unless specified:

```sh
npm test -- --runInBand
npm run typecheck
npm run lint
npm --prefix functions test -- --runInBand
npm --prefix functions run build
npm --prefix functions run lint
# Run in both closet/ and closet/functions/:
npx --yes --package=node@22 node node_modules/jest/bin/jest.js --runInBand
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" firebase emulators:exec --project demo-aura-beta --config firebase.beta-test.json --only auth,firestore,storage 'node scripts/test-media-safety.cjs && node scripts/test-photo-ingestion-race.cjs && node scripts/test-indexing-recovery.cjs && node scripts/test-account-deletion.cjs && node scripts/test-ai-consent.cjs && node scripts/test-beta-security.cjs'
# Final targeted reruns used media + security + consent, then ingestion.
node scripts/aura-intelligence-eval.cjs
# From the evidence directory:
node /Users/athfan/wardrobe-ai/closet/functions/scripts/runAuraEvalGate.cjs
npx expo export --platform ios --output-dir ../qa-artifacts/media-legacy-compatibility-2026-10-10/ios-js-export-candidate
npm --prefix website run typecheck
npm --prefix website run lint
npm --prefix website run build
node scripts/sync-privacy-policy.cjs --check
git diff --check
```


New coverage includes shared/last references; saved/chat/legacy references; pending and expired permits; concurrent attach/retire barriers; same-ID independent destinations; stale lease recovery; duplicate cleanup; partial Storage failure; delayed uploads; cross-user/grant forgery; old-client contracts; inactive outfit recovery; date compatibility; and AI maintenance with revocation still available. Client tests cover permission-before-commit, batches, transaction reads, retired denial, account switching, safe messages and upgrade-policy decisions. Existing consent-revocation-during-ingestion, deletion/indexing, authentication/deep-link and provider-cancellation regressions are retained.

All emulator fixtures are synthetic and enforce loopback `demo-aura-beta` configuration. Providers are mocked; trigger handlers are invoked directly. This tests real emulator Firestore transactions, rules and Storage, **not deployed Eventarc/Scheduler/IAM**. Client Jest is separate from runtime evidence. A local production iOS JS/Hermes export is a bundle check, not a new native artifact or iOS 27 launch result. No physical device, real Apple/Google, native camera/background removal, or real AI was exercised.

## Deployment dependency inventory and ordered plan

All commands/configuration below are for a **future separately approved rehearsal**, not authorization to execute them now.

1. Freeze the full candidate and its hash inventory, including untracked files and all P1-02–P1-08 dependencies. Preserve SDK 54, Xcode 26.0 and the existing release-number owner. Confirm the next App Store build number before any future build; no number was advanced here.
2. Reconcile deployed metadata, old function revisions, rules, vector indexes, secrets/IAM and legacy client distribution. The older P1-06 cloud snapshot was not refreshed by this local task. Resolve Apple revocation credentials, Storage-to-Firestore rules IAM, privacy/terms publication, support mailbox delivery, retention and cost ownership.
3. Prepare an approved isolated project with synthetic accounts and its own credentials. Reconcile the **additive** index manifest: preserve both live 2,048-dimensional vector indexes missing from the current checked-in composite list. Do not blindly deploy the local index JSON over that inventory.
4. Deploy the complete candidate there: **57 exported functions** ([complete source export inventory](../../qa-artifacts/media-legacy-compatibility-2026-10-10/function-exports.json)), including `prepareMediaWrite`; updated consent/ingestion/generic writer/deletion boundaries; matching client mutation adapter and deletion contract; both rulesets; finalizer; and the existing expanded five-minute recovery scheduler. No new secret, Cloud Tasks queue, Eventarc trigger or schedule is introduced by P1-08. The existing photo-ingestion trigger now explicitly enables redelivery: cleanup contention before a processing claim must not silently lose the ingestion event. Its current-document/lease/consent checks still deduplicate work; a local contention/redelivery test verifies no duplicate provider dispatch. Validate actual cloud retry/backoff behavior. New group indexes: `retiredMedia.dueAt`, `mediaSweepJobs.dueAt`, `mediaInventories.dueAt`, `mediaPermits.until`, `mediaControl.until`, in addition to P1-05/P1-07 fields. Exempt `mediaPermits.projection` from indexing; it is compared by rules, never queried.
5. Keep cleanup absent/false while inspecting inventories. Rehearse operator AI pause and the advisory client gate. Validate actual rules access-call/expression limits for large batches, missing parents, rejected entitlement grants, duplicate job delivery, resumable upload completion and real Storage generation preconditions.
6. Run a controlled authenticated smoke with two synthetic UIDs: create/restore accounts; decline/manual upload; accept/generate/index; revoke during work; share one image across two items plus a saved/chat snapshot; delete each reference; pause/recover failed erasure; delete the account with an upload pending. Validate a genuine Build 9 artifact and the matching updated artifact. Rehearse stale locks, object failures, blocked grant creation, permit expiry and a dropped finalization event. Verify logs do not expose download/auth tokens.
7. Prove cleanup traversal/cost at representative wardrobe and chat sizes, including the scan limit and large-batch rules access-call limits. The actual maximum six-item extraction batch and a twelve-item laundry/favorite batch pass locally; arbitrary larger selections are not certified. Do not split incrementing/wear transactions blindly, because retries could double-count. Seed bounded inventory markers for approved legacy UIDs without deleting records. Reconcile historical caches and orphan retention. Approve the new minimal object-path retirement ledger, short-lived permit snapshots and persistent inventory markers; account deletion removes all of them.
8. Prepare the production maintenance/drain window and matching app before reopening. Existing old Admin workers ignore new rules and flags. Use the P1-06 rehearsed external invocation/write controls; stop old scheduled/event work and verify quiescence beyond maximum request deadlines. These controls are **still a release gate**, not certified by local tests. Preserve accepted deletion recovery throughout.
9. Only after separate production approval, deploy the entire closure under maintenance, verify exact revisions/rules/index readiness, confirm no old writers remain, and run the approved dedicated-account smoke. Activate any client requirement/AI pause explicitly; enable new cleanup only after the reference protocol, full inventory strategy and recovery monitors pass. Then reopen the matching beta client. Do not activate a production upgrade requirement in this task.

Example approved-staging commands after prerequisites:

```sh
# AURA_STAGING_PROJECT must name the separately approved isolated project.
firebase deploy --project "$AURA_STAGING_PROJECT" --only functions,firestore:rules,storage
# Deploy indexes only AFTER reconciling the additive manifest and then wait for READY.
firebase deploy --project "$AURA_STAGING_PROJECT" --only firestore:indexes
```

Budget for one callable/transaction and permit write per protected client mutation, additional rule reads, inventory list/read calls, object operations, retirement/sweep/permit storage and retries. The 60/minute permit limit counts failed/retried calls too; test realistic rapid intake and batched chat/save workloads. The 2,000/day limit is per account, not a project cost cap. Grace periods and queues are persisted scheduling, not sleeping functions. Polling old item fences plus new queues increases work; measure backlog before broad activation. Retired paths are revisited daily; account cleanup removes those markers. Storage soft-delete/backups/log retention remain the previously documented separate gates.

## Rollback and recovery

- Before activation, keep cleanup disabled and distribution closed while repairing the candidate. No automatic migration/purge runs merely because the new code is deployed.
- After any path is retired, never remove its record to make a write succeed. Upload to a new immutable path or provide a reviewed forward fix. Never restore owner Storage deletes/overwrites or old unguarded Admin writers.
- Disable **new retirement** to stop expansion during a cleanup incident; preserve accepted retirement and account/item deletion recovery. AI pause is separate and must not disable those workers.
- An expired cleanup lock is recoverable by transactional replacement/removal; never clear it without invalidating the worker lease. Do not delete account/item fences, reset consent revisions or clear quota/lease state blindly.
- Restores must preserve/reapply account/item/media retirement ledgers before reopening service. Database rollback cannot resurrect erased Storage bytes, revoke an accepted deletion, or restore an Apple grant.
- Build 9 is not a compatible client rollback. Pause distribution and forward-fix the matching app. Do not represent its generic failures as an implemented upgrade experience.

## Remaining gates and decisions

| Gate | Decision |
|---|---|
| Shared active-reference protection, retirement races and local failure recovery | **PASS**, for the tested candidate protocol |
| Complete historical inventory, over-limit/slow-account recovery, cache retention and cloud throughput | **FAIL / pending operational acceptance**; cleanup must stay off |
| Build 9 cannot bypass reference/consent/deletion safeguards in the candidate contracts | **PASS source/unit/emulator**; real artifact transition/UX still required |
| Graceful upgrade for already-installed Build 9 | **FAIL without distribution/communication transition**; binary lacks the reader and hides server copy |
| Full native candidate on iOS 26.5 / 27 and physical iPhone | **NOT RUN**; exact new artifact required |
| Ready to deploy the integrated release | **NOT READY TO DEPLOY** |
| External TestFlight beta | **NO-GO** |

Physical checks: cold/warm reset/deep links and OAuth callbacks; restored sessions/onboarding; update notice and offline retry; privacy/deletion escape routes; two-device consent and sign-out; camera/HEIC/local cutout; intake/cancel/edit/duplicate/save; styling cards/flatlays/shopping/planning; saved looks after source-item deletion; real Apple/Google and Apple revocation; interrupted upload and account-deletion status/retry. Verify the exact newly built SDK 54/Xcode 26.0 artifact. The prior successful simulator build proves only the earlier toolchain launch finding.

## Files changed

The list below is the P1-08 delta against the initial hash inventory, not the entire pre-existing dirty tree. Most client persistence files only change their Firestore import to the explicit adapter. No screen styling, cards, flatlays, styling algorithms, Expo/native/package/EAS configuration or unrelated website files were changed.

- `app/(tabs)/closet.tsx`
- `app/_layout.tsx`
- `app/dev/intelligence-debug.tsx`
- `docs/MEDIA_LEGACY_COMPATIBILITY_2026-10-10.md`
- `docs/RELEASE_INTEGRATION_2026-10-10.md`
- `docs/TESTFLIGHT_READINESS_2026-10-09.md`
- `firestore.indexes.json`
- `firestore.rules`
- `functions/src/ai/wardrobeIntelligence/__tests__/indexClosetItem.test.ts`
- `functions/src/deleteAccountData.test.ts`
- `functions/src/deleteAccountData.ts`
- `functions/src/deleteClosetItem.ts`
- `functions/src/extractOutfitItems.ts`
- `functions/src/index.ts`
- `functions/src/ingestItemFromPhotos.ts`
- `functions/src/prepareMediaWrite.ts`
- `functions/src/shared/accountLifecycle.ts`
- `functions/src/shared/accountStorage.ts`
- `functions/src/shared/accountWriteBoundary.test.ts`
- `functions/src/shared/aiConsent.ts`
- `functions/src/shared/earlyAccess.test.ts`
- `functions/src/shared/ingestionLifecycle.ts`
- `functions/src/shared/itemLifecycle.ts`
- `functions/src/shared/mediaSafety.test.ts`
- `functions/src/shared/mediaSafety.ts`
- `functions/src/shared/rateLimit.test.ts`
- `functions/src/shared/rateLimit.ts`
- `scripts/test-ai-consent.cjs`
- `scripts/test-beta-security.cjs`
- `scripts/test-media-safety.cjs`
- `scripts/test-photo-ingestion-race.cjs`
- `shared/mediaSafety.ts`
- `shared/releaseContract.ts`
- `src/account/deletionClient.test.ts`
- `src/account/deletionClient.ts`
- `src/addItem/hooks/useItemDraft.ts`
- `src/addItem/hooks/useItemExtraction.ts`
- `src/addItem/hooks/usePhotoStep.ts`
- `src/lib/aiChats.ts`
- `src/lib/analytics.ts`
- `src/lib/assistantMemory.ts`
- `src/lib/auraAttachments.ts`
- `src/lib/auraLooks.ts`
- `src/lib/auraMemory.ts`
- `src/lib/auraOutfitFeedback.ts`
- `src/lib/errors.test.ts`
- `src/lib/errors.ts`
- `src/lib/itemUploadLifecycle.test.ts`
- `src/lib/itemUploadLifecycle.ts`
- `src/lib/items.ts`
- `src/lib/mediaFirestore.test.ts`
- `src/lib/mediaFirestore.ts`
- `src/lib/outfitExtraction.ts`
- `src/lib/profileLooks.ts`
- `src/lib/releasePolicy.test.ts`
- `src/lib/releasePolicy.ts`
- `src/lib/savedOutfits.ts`
- `src/lib/shoppingRecommendationFeedback.ts`
- `src/lib/suggestionAnalytics.ts`
- `src/lib/userProfile.ts`
- `src/lib/wearOutfit.ts`
- `src/release/ReleaseGate.tsx`
- `src/utils/dailyOutfits.ts`
- `storage.rules`

