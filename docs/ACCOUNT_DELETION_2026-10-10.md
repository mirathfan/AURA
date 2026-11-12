# P1-04 — Apple authorization and durable account deletion

**Local implementation and automated validation: PASS. Release sign-off: FAIL / pending configuration, deployment and physical-device validation. External TestFlight: NO-GO.**

Reviewed against the actual working tree at `06ece001c69cb6a84787cebddd521f883ffccb66`, October 10, 2026. The starting tree already contained substantial P1-02/P1-03, release, native, website and user changes. Before/after hashes and this task's changed-file inventory are in `/Users/athfan/wardrobe-ai/qa-artifacts/account-deletion-2026-10-10/`. No push, deployment, production mutation, real provider login, EAS build or TestFlight submission was performed. Expo SDK 54, Xcode 26.0, native project files, cards, flatlays and disabled Beta 1 Photo Refinement configuration are unchanged by P1-04.

## Verified root causes

1. `appleAuth.ts` used the Apple identity token and nonce for Firebase sign-in, but discarded the authorization code. Firebase account deletion did not revoke the Apple grant.
2. `deleteAccountData` ran sequential destructive operations in one invocation. It had no persistent progress, recovery worker, or account-wide fence; failures depended on the client remaining signed in and submitting again.
3. Security rules allowed owner writes until Auth expired. Privileged ingestion, import error handling, chat, generated outfit, memory, metrics, consent resumption, usage and rate-limit writers could commit after deletion began. Checking existence or consent before a long operation was insufficient.
4. Shared `productSearchCache` stored user-derived search queries without an owner, so a user's entries could not be identified for deletion. New entries now reside under `users/{uid}/productSearchCache`; legacy shared entries require an approved purge/retention decision.
5. The client awaited one callable response, then signed out without a persisted status/recovery surface. A timeout did not distinguish rejection from accepted, continuing cleanup.

## Apple implementation

Installed Firebase JS exposes `revokeAccessToken`, which requires an **Apple access token**. Expo Apple Authentication returns an **authorization code** and identity token, not that access token. Passing the code into the JS token method would be incorrect. The native Firebase iOS authorization-code method is not exposed by this app's installed JS Firebase integration. No native SDK migration was introduced.

The new flow is:

1. Detect Apple in `providerData`, including accounts signed in through Google/email with Apple linked.
2. Request fresh native Apple authorization with a random nonce and SHA-256 nonce digest. Use `reauthenticateWithCredential` on the captured Firebase user, never switch users through `signInWithCredential`. Check the current account before and after asynchronous boundaries and refresh the ID token.
3. Send the short-lived code to `revokeAppleForAccountDeletion`. It requires authenticated recent login, an active account, and a dedicated rate limit. It loads the Apple subject from Admin Auth, ignoring caller-supplied UID/subject claims.
4. The server signs a five-minute ES256 client secret, exchanges the code at Apple's token endpoint, verifies the returned ID token's RS256 signature against Apple's keys and checks issuer, audience, expiry and the server-linked subject. Only then revoke the refresh token at Apple's revocation endpoint.
5. Persist only a server timestamp and hash of the verified subject under a client-inaccessible account subcollection. Deletion accepts this proof only for the current linked subject and within five minutes. No code, private key, identity token, access token or refresh token is persisted or logged by this implementation. Raw provider errors are neither returned nor stored.
6. Failure/cancellation never silently confirms revocation. The UI offers an explicit second confirmation to delete AURA data with manual Apple revocation instructions. The server records `manual_required`, not `revoked`. A stale Firebase session still requires reauthentication: Apple fallback is not an identity-check bypass.
7. Native revocation notifications verify the current Apple credential state before signing out and clearing that account's cache. Network/simulator errors do not imply revocation. While the deletion screen is active, notification-driven sign-out is deferred so programmatic revocation cannot interrupt acceptance of the deletion job.

References: [Firebase JS Apple revocation](https://firebase.google.com/docs/auth/web/apple), [Firebase native iOS Apple revocation](https://firebase.google.com/docs/auth/ios/apple), [Apple token exchange](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens), [Apple token revocation](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens), [Apple TN3194 manual fallback and credential notifications](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple).

## Persistent lifecycle and ordering

No job means active. `accountDeletionJobs/{uid}` is outside the recursively removed user subtree and is client read-only for that owner.

`active → deleting → firestore → storage → rate_limits → settle → verify → auth → completed`

A stage failure records `retry`, keeps the current stage and schedules another attempt. Deletion is permanent once accepted; the fence is never rolled back to active.

- First acceptance requires the existing five-minute recent-auth rule. Repeated requests only resume/read an existing job, so stale auth cannot create a new destructive request but does not strand an already accepted request.
- Transactional create gives simultaneous requests one job. Workers claim a ten-minute lease with an opaque random identifier. Updates verify lease ownership. Destructive stages are idempotent and always derive UID from authenticated identity or the trusted job document ID, never payload prefixes or arbitrary job fields.
- A killed worker's persisted `dueAt` becomes eligible again. Stage failures use bounded exponential retry delay (one minute up to one hour), without storing raw exceptions or personal content. There is no retry-count ceiling that abandons a deletion permanently.
- Initial cleanup removes the Firestore tree using the preserved SDK recursive-delete/BulkWriter helper, including descendants below missing parents. Storage is removed in bounded pages; known endpoint counters and the legacy parse-intent counter are recursively removed.
- Completion waits at least ten minutes after acceptance for earlier work to settle, exceeding the currently configured maximum 540-second worker request deadline. This is persisted scheduling, not a sleeping/billed invocation. A final Storage/Firestore sweep follows. A request deadline is not a cross-service atomicity guarantee; the upload safeguards below remain necessary.
- Firebase Auth is removed **last**, after the final data sweep, so ordinary interrupted cleanup retains an authentication path for status/retry. Missing Auth is treated as already removed. A crash after Auth removal but before final status is safe to retry.
- Only then is the job replaced with `{state, stage, apple, completedAt}`. Its document ID remains the UID. This minimal permanent tombstone is intentionally retained to reject old tokens and delayed events. Do not TTL/delete it or manually reuse the same Firebase UID.
- The existing 600-second client timeout is retained. A pending result is not reported as completion. Typical small-account completion is approximately 10–15 minutes with the scheduled sweep; outages, contention or large accounts may take longer.

## Concurrent-write and AI protection

- Firestore owner rules and Storage rules reject access once the fence exists. Job status remains owner-readable independently of the deleted profile; clients cannot create/alter the fence.
- Every current privileged Firestore create/update path uses a helper or transaction that reads the same fence in the **same transaction** as writes. Deletion acceptance and these commits serialize; a preflight read alone is not relied upon. Generated-outfit/action/memory batches use an explicit guarded batch adapter, not SDK monkey-patching. Existing delete-only maintenance batches cannot resurrect data and remain unchanged.
- Covered writers: photo ingestion (including failure writes), retailer import and import failures, outfit chat/messages/threads, generated outfits, manual save/wear/plan/dislike persistence, wear metadata, style memories/profile, wardrobe summaries/metrics, item indexing, early-access usage/cache, per-user product cache, consent records/resumption/paused-ingestion state, and rate-limit counters. Styling decisions and visual rendering were not changed.
- AI transport checks the fence alongside current consent before provider transmissions/retries. A fence listener aborts active responses; already transmitted data cannot be recalled. Existing consent revision/version enforcement stays intact. An old embedding result cannot commit after the fence.
- Privileged image saves check before and after upload; a crossed fence removes the file. A retry-enabled Storage finalization handler deletes the **specific object generation** for a fenced UID. The settling period and final sweep cover ordinary earlier uploads. Client Storage rules also rejected an emulator resumable upload initialized before deletion and finalized after the fence.
- Firestore and Storage are separate services. A very late privileged upload can transiently exist until finalization cleanup; this is eventual cleanup, not a claim of instantaneous atomic erasure across services. Existing tokenized download URLs can remain usable until the object is removed. Event delivery/IAM outages need operational monitoring and recovery. No claim is made about arbitrary privileged writers outside this repository or old deployed function revisions.
- A TypeScript-aware boundary regression test scans source for raw privileged mutations/uploads and transactions missing the fence. It complements, rather than replaces, runtime emulator tests.

## Data inventory and retention boundaries

| Location / category | Disposition |
|---|---|
| `users/{uid}` and all descendants | Recursive deletion includes root account/preferences, items and embeddings/index metadata, usage/earlyAccessCache, privacy consent, aiConsentJobs, threads/messages, aiChats/sessionContext, assistant/profile/styleProfile/styleMemories, metrics, outfits/plans/events/wear records, savedLooks/savedOutfits/auraLooks, feedback/disliked records, launch/commerce/style events, and new productSearchCache. Traversal does not require parent documents to exist. |
| `users/{uid}/private/appleRevocation` | Short-lived non-token proof; deleted with the user tree. |
| Storage `users/{uid}/**` | Includes avatar, originals, crops, thumbnails, extracted/reconstructed/generated images, historical Polish outputs, chat attachments and temporary transcription audio. Prefix cleanup covers all descendants. No new Polish access is enabled. |
| `functionRateLimits/{endpoint}/users/{uidHash}/**` and legacy parse-intent UID path | Deleted for every current configured endpoint, including Apple revocation and existing accountDelete records. Counter transactions are fenced against delayed recreation. |
| Firebase Auth | Removed last; email/Google/Apple/linked ownership remains bound to the authenticated UID. Google provider authorization is not equivalent to Firebase deletion; existing client Google sign-out/revoke behavior remains. |
| `accountDeletionJobs/{uid}` | Minimal permanent completion/fence record retained as disclosed, without name, email, content, credentials or detailed exceptions. |
| Client local caches | Existing UID-scoped clear runs when returning to Welcome; native confirmed Apple revocation also clears the same account. Offline devices/OS backups are not remotely erased. Server access is fenced. |
| Old global `productSearchCache` | No reliable UID association. New writes no longer use it. Inventory and an approved legacy purge/retention decision remain required; no live records were touched. |
| Website beta waitlist | Separate Google Sheets / Apps Script flow identified in `website/app/api/beta/route.ts`, outside the Firebase UID tree. Handle verified support requests separately; not falsely described as automatic app-account cleanup. |
| OpenAI, SerpApi, Firebase/Google Cloud/Sentry logs; backups/PITR; Storage soft-delete/object versions | Not synchronously erased by this job. Verify actual project/provider retention and legal/operational requirements. No immediate or zero-retention promise. |

The bundled policy, generated public-policy copy and website deletion page now describe asynchronous retry, retained tombstones, Apple fallback, and these retention limits. Existing canonical URLs and `support@getaura.app` are retained. Accessibility of public pages and email deliverability remain **unverified release gates**. No publication or App Store privacy submission was made. App Store privacy answers must continue disclosing identifiers/diagnostics and be reviewed against retained deletion identifiers and actual provider retention; no new tracking purpose was introduced.

## Deployment/configuration requirements — not performed

1. Configure `APPLE_REVOCATION_PRIVATE_KEY` as a Firebase Secret Manager secret containing the Sign in with Apple ES256 PEM key; bind it only to the revocation callable. Set `APPLE_REVOCATION_TEAM_ID`, `APPLE_REVOCATION_KEY_ID`, and verify `APPLE_REVOCATION_CLIENT_ID` (`com.kasat.aura` default) matches the native grant's audience. Validate Apple key/app grouping and private relay configuration. Do not put the key/client secret in Expo public variables. Key rotation and restricted IAM need an owner.
2. Approve and deploy **all** changed backend writers and rules together with new/updated functions: `revokeAppleForAccountDeletion`, `deleteAccountData`, `getAccountDeletionStatus`, `continueAccountDeletion`, `recoverAccountDeletions`, and `removeDeletedAccountUpload`. Do not enable the new client against the old deletion backend. Drain older function revisions and verify no unmanaged Admin writer can bypass the fence.
3. Firestore status/jobs require the normal `dueAt` single-field index. No custom composite/vector-index change is introduced. Do not remove existing vector indexes.
4. Storage's cross-service `firestore.exists` rule requires the Storage service agent's Firestore access permission. Verify that deployment enables this permission and that the configured bucket/region and Eventarc finalization trigger match. Exercise actual resumable uploads in a nonproduction deployed environment; emulator behavior is not production certification.
5. New infrastructure is one scheduled Cloud Function/Cloud Scheduler job (every five minutes), a Firestore creation trigger, a Storage finalization trigger, the status/revocation callables, and a Secret Manager secret. Charges include Scheduler, function/Eventarc execution, secret access/storage, Firestore status/fence reads and cleanup operations, and Storage operations. Idle recovery performs 288 bounded queries/day; only ten due jobs are claimed per sweep. Each guarded write adds a fence read, as do Storage rules and provider checks. There is no extra always-on service and no billed settling sleep. Confirm billing/quotas before approval; no price estimate is asserted.
6. Monitor old `dueAt` jobs, retry backlog, Eventarc/Scheduler failures and secret/IAM failures without logging credentials or personal content. Test recovery after a disabled scheduler/trigger, an IAM outage, and very large accounts before beta. Stuck work must retain its fence. If an owner loses their Auth session after final Auth removal, server recovery continues; the UI may require support to establish final status and must not infer success from a missing session.
7. Approve any legacy shared-cache purge and verify backup/soft-delete/log/waitlist retention separately. Support email delivery is still unverified.

## Validation

All tests use synthetic data and mocks or the explicitly isolated `demo-aura-beta` Auth/Firestore/Storage emulators. The emulator script refuses nonlocal endpoints. Cloud trigger handlers are invoked directly where needed; actual deployed Eventarc/Scheduler delivery is **not** tested.

- App Jest: **47 suites / 256 tests PASS**.
- Functions Jest: **35 suites / 361 tests PASS**.
- Emulator: **18 deletion + 12 AI-consent + 19 existing beta-security checks PASS**.
- App TypeScript and lint: PASS; lint retains the nine pre-existing warnings.
- Functions TypeScript/build and lint: PASS.
- Local Expo iOS JavaScript/Hermes export: PASS. This is **not a native build or launch**.
- Website typecheck, lint and production build: PASS; bundled/generated policy synchronization and `git diff --check`: PASS.
- Deterministic intelligence checks: **84/84 PASS**; standard/hard retrieval/generation/agent eval gate PASS with no LLM judge/provider calls.

New unit coverage includes native nonce/same-user reauthentication, cancellation/mismatch/expired credentials, account switching, signed Apple token validation, exchange/revoke failure, server-subject selection, recent-auth boundaries, preserved timeout, double-tap confirmation, interrupted/status/retry UI, delayed indexing/provider completion, restored deletion routing, native revocation notification handling, and mutation-boundary scanning.

The 18 deletion emulator checks exercise concurrent acceptance; two-session access rejection; resumable upload across a fence; privileged delayed writes/batches/uploads; queued consent resumption; partial Firestore/Storage cleanup failure; persisted crashed-worker lease and expiry; idempotent orphan/consent cleanup; generation-specific late upload removal; other-user isolation and permanent tombstones; writes racing acceptance; email/Google/Apple/linked-account branches; current-subject/fresh Apple proof; stale acceptance and crash after Auth removal; and a privileged upload crossing the fence. Apple network responses are mocked in unit tests, not sent to Apple.

Reproduce from the repo:

```sh
npm test -- --runInBand
npm run typecheck
npm run lint
npm --prefix functions test -- --runInBand
npm --prefix functions run lint
npm --prefix functions run build
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" firebase emulators:exec --project demo-aura-beta --config firebase.beta-test.json --only auth,firestore,storage 'node scripts/test-account-deletion.cjs && node scripts/test-ai-consent.cjs && node scripts/test-beta-security.cjs'
npx expo export --platform ios --output-dir /tmp/aura-p104-ios-js-export
npm --prefix website run typecheck
npm --prefix website run lint
npm --prefix website run build
node scripts/sync-privacy-policy.cjs --check
npm run aura:eval
node functions/scripts/runAuraEvalGate.cjs
git diff --check
```

The eval gate was run with its working directory in the evidence folder to keep generated reports out of user changes. Raw command output, local export identity and hash manifest are preserved there. Emulator logs include a pre-existing duplicate libvips native-class warning from the installed image-processing dependencies; the checks completed successfully.

## Runtime / physical-device gates and verdicts

No new native app was built or launched. The earlier Xcode 26 simulator artifact predates these changes and is **not evidence for P1-04**. On physical iPhone with an approved newly built artifact and isolated test accounts, verify Apple code exchange/revocation and re-registration, linked Google/Apple identity selection, cancelled/revoked/expired/offline Apple grants, native revocation notifications, email/Google reauthentication, fresh/stale sessions, two-device deletion, app termination/offline/relaunch, real resumable uploads, large data sets, final sign-out and cache clearance. Repeat navigation/lifecycle on supported iOS 26.5 and 27; keep the Xcode pin.

| Area | Local automated result | Release sign-off |
|---|---|---|
| Apple authorization revocation | **PASS** — supported server exchange/revoke, signature/subject checks, explicit fallback, credential/cancellation mocks | **FAIL / pending** Apple secret/configuration and real physical-device grant validation |
| Concurrent write protection | **PASS** — transactional Firestore guards, client rules, provider boundary and Storage emulator/in-flight checks | **FAIL / pending** coordinated deployment, production IAM/Eventarc checks and actual upload/device validation; Storage cleanup is eventual across services |
| Durable cleanup and recovery | **PASS** — persisted stages, lease expiry, retries, settling/final sweep, Auth-last and post-Auth-crash recovery | **FAIL / pending** deployed scheduler/event delivery, backlog/large-account/retention validation |
| Account deletion UI | **PASS** — confirmation/cancel, double tap, reauth, pending/retry/status, account switching and confirmed completion tests | **FAIL / pending** physical-device UX, native provider, interruption and accessibility checks |
| Overall external beta | **FAIL — NO-GO** | Other privacy/publication/indexing/rate-limit/release-device gates are still open |

## Changed files

Exact per-file inventory: `/Users/athfan/wardrobe-ai/qa-artifacts/account-deletion-2026-10-10/changed-files.txt`. It compares this task's before/after hashes, rather than attributing the entire already-dirty Git diff to P1-04.

- **Lifecycle/backend:** `functions/src/deleteAccountData.ts`, `revokeAppleForAccountDeletion.ts`, `index.ts`; new `shared/{accountDeletionJob,accountLifecycle,accountStorage,appleRevocation}.ts`; Firestore/Storage rules and isolated emulator Auth configuration.
- **Privileged write integration:** `outfitChatV1`, `ingestItemFromPhotos`, `importProductLink`, `extractOutfitItems`, `polishProductImage`, `products/{productCache,searchLiveProducts}`, `ai/wardrobeIntelligence/{agentActionCallables,indexClosetItem,metrics,styleMemory}`, `shared/{aiConsent,earlyAccess,laundryIntent,outfitEngine,pausedIngestion,productLinkExtractor,rateLimit,resumeAiConsent,wardrobeSummary}` and `aiConsent.ts`. These are fence/persistence changes, not styling or layout changes.
- **Client:** new `app/account-deletion.tsx`, `src/account/{AccountDeletionScreen,DeletionProvider,deletionClient}`, `shared/accountDeletion.ts`, `src/auth/appleRevocation.ts`; updates to `appleAuth`, `AuthContext`, auth routing, root layout, privacy-modal suppression and the existing Profile deletion button.
- **Regression tests:** new Apple server/client, deletion client/UI/provider and write-boundary suites; updated deletion, consent, early-access, delayed-indexing, AuthContext and routing suites; `scripts/test-account-deletion.cjs`.
- **Disclosures/reports:** shared/bundled/generated privacy policy, website deletion page, P1-03 report, readiness report and this P1-04 report. The public site was not published.

Before/after hashes confirm unchanged `app.json`, `eas.json`, package manifest/lockfile, native Podfile/lockfile, native plist and Xcode project **relative to the start of P1-04**. Their pre-existing Git modifications remain intact. No previously present file was removed.
