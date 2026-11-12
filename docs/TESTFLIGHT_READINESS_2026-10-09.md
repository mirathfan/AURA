# AURA external TestFlight readiness — 2026-10-09

**November 11 canary result:** [Phase 2B stopped at API/IAM gates](PRIVATE_HEALTH_CANARY_EXECUTION_2026-11-11.md). Authentication and installed $1 Run cap/early alerts passed, but approved API activation automatically enabled three additional APIs and assigned Editor to the default Compute SA. No upload/build/deployment/invocation occurred. Empty workload checks and billing unlink passed; rehearsal remains ACTIVE, No organization/no folder, unbilled. Automatic IAM/API state and two budgets remain for review/delayed-cost cleanup; reports display $0, not final liability. **NOT READY to resume cloud execution; external beta NO-GO.**

**Current handoff — November 5:** [Fresh local QA and remaining beta gates](BETA_HANDOFF_2026-11-05.md). Root lint and client/backend tests now pass; the missing local links were repaired in the prior canary-preparation task. The latest recorded cloud state is November 4 Phase 1C: rehearsal billing unlinked, project ACTIVE. [Today's canary preparation](PRIVATE_HEALTH_CANARY_2026-11-05.md) is local only; Phase 2 execution and external TestFlight remain **NO-GO**. The dated banners below are historical and do not override these later findings.

**Phase A execution — November 4: STOPPED ON UNEXPECTED BILLING.** The one authorized creation attempt succeeded: `aura-rehearsal-20261011`, number **1087494190017**, No organization in console. The project is unexpectedly listed as linked to **01B4D2-62CAD1-5848FD** despite no separate billing-link action. Per the user's stop instruction, no unlink/correction or further IAM/resource inspection was performed. Raw lifecycle state and absence of billable resources are not certified. [Bootstrap evidence and remaining requirements](REHEARSAL_BOOTSTRAP_2026-11-04.md). **Phase 2 NOT APPROVED / NOT READY; external beta NO-GO.** This execution result supersedes earlier “project not created/creation pending” status below.

**November 4 safeguards update:** Mir Athfan Ali has explicitly confirmed billing/on-call ownership, `mirathfan@gmail.com`, No organization/no folder and the $25 intended budget. [Final safeguards and creation plan](REHEARSAL_SAFEGUARDS_2026-11-04.md) supersede the unresolved ownership requirement and initial large rehearsal below. Current console metadata reconfirmed the production-only $5 alert budget and Billing Admin; no new project/control exists. **Empty unbilled bootstrap is ready for final approval only; billable provisioning remains NOT READY.** Later paid scope is reduced to one private health function/one build with no data, AI or scheduled workers. No creation, cloud mutation or production Firebase access occurred; external beta **NO-GO**.

**November 4 local validation:** packaging tests 3/3 and proposal consistency/whitespace checks pass. Standard lint is blocked by absent local executable links; direct source-scope ESLint reports two unresolved `expo-vision-bg` imports plus nine warnings (local package directory exists, installed link missing). Application/dependency files were not modified. Historical passing lint below is not a fresh November 4 result. See [current safeguards report](REHEARSAL_SAFEGUARDS_2026-11-04.md#local-validation-and-preserved-state).

**P1-10B final read-only preflight (October 11): NOT READY FOR PROVISIONING.** [Spending/permission findings and staged approval request](REHEARSAL_AUTHORIZATION_PREFLIGHT_2026-10-11.md) confirm **No organization/no folder**, billing-association authority, and an existing **$5/month production-only alerts budget** (actual $2.50/$4.50/$5; billing-role email, no cap). The creation form shows 10 projects remaining; global ID availability is not confirmed. Run/Functions service caps do not enforce a $25 whole-project bill; rehearsal controls/harness remain uninstalled. Deny Admin is **not required for ordinary isolated rehearsal**; the production deny/drain experiment remains separate. Final billing responsibility and resource-creation approval are still pending. No cloud mutation; external beta **NO-GO**.

**Recommendation: NO-GO for external beta.** The fixes below improve security and data integrity, but privacy/consent, Apple account deletion, routing and lifecycle reliability still need release gates. No production deployment, submission, or live user-data mutation was performed. The initial audit created no EAS build; the explicitly authorized follow-up created exactly one simulator build.

**Latest P1-10 decision (October 11): NOT READY FOR CONTROLLED DEPLOYMENT; external beta NO-GO.** [Cloud rehearsal execution/approval package](CLOUD_REHEARSAL_2026-10-11.md) adds generation-pinned source comparison for all 48 live functions (9 additions, no removals/renames, 40 changed handler definitions and changed shared closures for all 48), a tested isolated backend packager, exact IAM/services/cost and 57-export inventory, and bounded no-provider rehearsal steps. Only production is Firebase-enabled in the accessible account; no nonproduction environment is approved. Proposed `aura-rehearsal-20261011` has not been created. Vercel target/production alias are verified; local project label is stale but its ID matches. Public Privacy/Terms still contain stale contact/copy; ASC redirects to login and mailbox delivery remains unverified. No cloud mutation, publication, message, native/EAS build or distribution change. Existing app/backend/native source and unrelated changes preserved.

**Latest P1-09 decision (October 11): NOT READY FOR CONTROLLED DEPLOYMENT; external beta NO-GO.** [Fresh production preflight and controlled deployment runbook](PRODUCTION_DEPLOYMENT_PREFLIGHT_2026-10-11.md) supersedes historical rollout instructions/cloud counts below. Read-only metadata confirms 48 old functions versus 57 candidate exports, absent recovery scheduler/Apple secret/group indexes, and active old rules. Zero current deletion/index/media job counts and a 2,267-object/448MiB bucket do not establish per-account media safety/capacity. Build 9 distribution and the support mailbox remain unverified; public policies still serve stale copy. No production/staging change or new native artifact.

Launch follow-up: [iOS 27 investigation](IOS27_LAUNCH_INVESTIGATION_2026-10-09.md) validates the Xcode 26.0 image pin using the exact authorized EAS simulator build `adc8a66b-74df-4174-8862-118b7684c45b`. Startup and basic lifecycle/navigation pass on iOS 27 and 26.5 without an Expo upgrade. The original UIScene startup blocker is cleared for this pinned toolchain; P1-02 now has local fixes and passing automated routing coverage; validation of those changes in a newly built native artifact and authenticated OAuth/device checks remain open.

Latest decision (P1-08, October 10): **shared-media safety PASS locally; NOT READY TO DEPLOY; external beta NO-GO.** Transactional write permits and permanent path retirement replace scan-then-delete cleanup; saved/chat/profile references and late uploads are covered. Build 9 cannot bypass the new contracts, but most protected writes require an update and its generic errors cannot provide the new upgrade screen. New cleanup remains off pending explicit operator activation, legacy inventory/capacity and staged/cloud/device acceptance. [P1-08 results and rollout requirements](MEDIA_LEGACY_COMPATIBILITY_2026-10-10.md) and [the integration plan](RELEASE_INTEGRATION_2026-10-10.md) take precedence over historical summaries below.

Audit base: commit `06ece00`, plus the existing working tree. Existing package/lockfile, website, `.agents`, `.maestro`, and skill changes were preserved. AURA cards, flatlays, and unrelated screen designs were not changed.

## Confirmed local fixes

| Problem established from current code | Fix | Evidence |
| --- | --- | --- |
| Account deletion enumerated existing documents, missing descendants under absent parents | Use Firestore SDK recursive deletion with completion/error propagation | Emulator creates an orphaned private message, deletes the account subtree, verifies the message is gone and a second user's subtree survives |
| Admin account deletion accepted an arbitrarily old signed-in session | Require an `auth_time` within five minutes before the first deletion is accepted; allow status/recovery of already accepted jobs and offer reauthentication | Unit tests cover missing auth, foreign UID, stale/malformed/future timestamps, and cleanup failure preserving Auth for retry |
| Client account deletion used the callable SDK's shorter default timeout against a 540-second backend | Set client timeout to 600 seconds | Source inspection and TypeScript validation; large-account/device test remains required |
| Closet deletion started removing photos before Firestore confirmed deletion | Delete the item first; then clean owned media, including when cache invalidation fails | Regression tests cover pending/rejected document deletion, cleanup failure, cache failure, and foreign/external image exclusion |
| Saving a soft-deleted outfit returned “Already saved” and kept it invisible | Treat only active records as duplicates; restore `active`, remove `deletedAt`, refresh save time | Regression test plus existing duplicate-save coverage |
| An indexing request could finish after item deletion/edit and merge stale data back into Firestore | Transactionally check the current item's lifecycle and embedding input hash before persisting | Four regression cases: deleted, edited, cancelled, and unchanged items |
| “Use my black cargos” with a selected item was classified as unknown | Route anchored styling commands to generation/refinement while retaining explanation handling | Regression tests and rerun of the previously failing hard eval case |
| Xcode 27 rejected dependency resource/privacy targets with obsolete iOS deployment targets | Clamp pod deployment targets to the app's configured iOS 17 minimum | Initial Release build reproduced the failure; native validation result recorded below |
| Local build baseline 8 would increment to already-built production version 9 | Synchronize baseline 9 across Expo/plist/Xcode; enable auto-increment for both store build profiles | Read-only EAS history shows finished builds 8 and 9; next approved build should be 10, subject to a fresh release-number check |

`pod install` also reconciled the previously stale native lockfile to already-installed Expo 54.0.37, Constants 18.0.14, and FileSystem 19.0.24. No JavaScript package versions were changed by this audit.

## Current backend and release evidence

- Firebase project: `closet-app-57146`. Read-only `firebase functions:list` returned **48 ACTIVE functions**, all Node.js 22 in `us-central1`. Missing backend deployment is not a current finding.
- Downloaded source archives for `deleteAccountData`, `ingestItemFromPhotos`, and `runAuraStylingAgent` match their corresponding pre-audit local implementations. Their older archive copies differ only in the separate `askAura`/`askAuraStream` source files. The `askAuraStream` archive matched all 113 compared non-test TypeScript source files before these edits. This establishes sampled source parity, not that every deployed artifact or service configuration was exhaustively compared.
- Active Firestore and Storage rules were fetched with Firebase CLI credentials and matched local files exactly. A separate gcloud Rules API attempt returned 403; the authenticated Firebase CLI check succeeded.
- Eight deployed Firestore indexes were READY, including two 2048-dimensional vector indexes. The repository documents vector indexes separately; its JSON contains only the six ordinary composite indexes. Preserve/verify vector indexes on future deployments.
- Live health returned HTTP 200. Unauthenticated POSTs to `runAuraStylingAgent`, `deleteAccountData`, `extractProductFromUrl`, and `saveAuraAgentOutfit` returned HTTP 401. No authenticated production requests or user-data reads were used as smoke tests.
- EAS production lists the required Firebase and Google sign-in variables, the enabled agent flag, and a Sentry DSN. Project, bucket, sender ID, iOS OAuth client, and agent flag match native/expected configuration. Root/native Firebase plists match. Values were not printed.
- Native configuration contains Apple sign-in entitlement, Google URL scheme, iOS 17 target, permission descriptions, privacy manifest, bundle `com.kasat.aura`, and version 1.0.0. Local environment validation passes. This does not validate provisioning, App Store Connect metadata, or the final signed binary.

## Journey review

| Area | Current source evidence and validation boundary |
| --- | --- |
| Authentication/onboarding | Apple uses a random nonce and SHA-256 hash; Firebase Auth persists through AsyncStorage. Auth timeout/retry and user-scoped onboarding draft restoration have regression coverage. The root gate falls back to a completed cached profile on read failure and otherwise shows a retry state. Final onboarding waits for profile persistence before refreshing the gate. Native OAuth and interrupted fresh registration still need device tests. |
| Closet intake | Source checks draft/lifecycle state, preserves user-edited fields before completion, rejects foreign owned-storage paths, and writes a retryable rate-limit failure. Photo-step regression tests pass. AI/provider behavior and native cutout/camera were not exercised against live user data. The indexing completion race is fixed; broader deletion and retry concerns remain below. |
| Outfit generation | Active agent route is enabled in EAS; backend rate limits and owned closet retrieval are present. Deterministic retrieval/generation/agent fixtures were run. No new live-provider quality or latency claim is made. |
| Saved outfits | User-scoped records, inactive filtering, and duplicate handling are present. Remove/re-save was broken and is fixed. Offline/partial multi-write recovery and a long history still need additional verification. |
| Account deletion | P1-04 adds server-side Apple code exchange/revocation, explicit manual fallback, a durable external job/tombstone, transactional write fences, Storage safeguards and recovery UI. Local automated/emulator checks pass; deployment, Apple credential configuration, operational recovery and physical-device sign-off remain open. See the P1-04 follow-up. |
| Release configuration | Native and Expo identities now agree; checked EAS environment and build history. Final signed provisioning, review metadata, device permissions, and source-map delivery remain unverified. |

## Test and runtime results

| Check | Result |
| --- | --- |
| Client Jest (after P1-02) | 40 suites, 217 tests passed; 74 added regression cases |
| Functions Jest | 30 suites, 332 tests passed |
| Firestore/Storage emulator security checks | 19 passed, isolated `demo-aura-beta` project only |
| Outfit eval gate | PASS: 30/30 cases after the selected-item intent fix; no critical failures, hallucination or vector leakage (initial baseline was 29/30) |
| Root TypeScript | Passed |
| Root lint | Passed with 9 pre-existing warnings, 0 errors |
| Functions lint/build | Passed |
| Local public environment check | Passed |
| Native Release simulator build | Passed — unsigned arm64 Release build on Xcode 27/iOS 27 Simulator; bundled app version 1.0.0 (9). Dependency warnings remain; no archive/signing claim. |
| Fresh simulator launch | iOS 27: FAIL, UIKit requires UIScene. The same binary on iOS 26.5: welcome, login via deep link, and navigation to password reset passed; no account creation, credentials, or reset email was submitted. |

Emulator checks exercised owner onboarding/item/save writes; anonymous/cross-user reads and writes; top-level/nested entitlement escalation; rate-counter and paid-usage tampering; direct root deletion; image MIME/size controls; concurrent transaction capacity; and orphan-safe deletion. The harness refuses to run unless both emulator hosts equal its loopback endpoints. Java 21 from Android Studio was used: the default Java 17 is too old for Firebase CLI 15, and the installed OpenJ9 Java 25 cannot run this Firestore emulator correctly.

No authenticated end-to-end claim is made for current live AI generation, intake, account deletion, or saved-outfit actions. Existing QA screenshots were not treated as fresh validation.

Fresh runtime evidence is saved in [`qa-artifacts/beta-readiness-2026-10-09`](../../qa-artifacts/beta-readiness-2026-10-09/): iOS 27 launch-failure screenshot and UIKit log, plus iOS 26.5 welcome, login, and password-reset screenshots. Maestro verified the login fields and navigated to the reset form. The two temporary audit simulators were shut down after testing.

## Remaining blockers, in priority order

1. **P1-02 — Auth/deep-link fixes require native release validation.** Local source fixes and 74 added regression cases now pass, including tests with real Expo Router navigation and mocked native/provider boundaries. The previously built Xcode 26 artifact still exhibits cold reset-link loss and unsolicited callback “Unmatched Route”; it predates these fixes. Do not mark native behavior fixed until a newly approved artifact passes the iOS 26.5/27 matrix and approved provider/device checks. No additional EAS build was created. See the P1-02 findings below. Xcode 27 remains unsupported with the current Expo 54 lifecycle.
2. **P1-03 — Privacy/AI consent implemented locally; deployment and runtime gates remain.** Public in-app policy access, explicit Accept/Not Now, per-account versioned consent/revocation, per-transmission server enforcement, and guarded automatic ingestion/indexing/resume work are implemented with passing unit/emulator coverage. No matching backend/app has been deployed or built for device verification. Public-page accessibility/email deliverability, retention/App Store answer review, live endpoint parity and physical-device validation remain open. See [the P1-03 report](AI_PRIVACY_CONSENT_2026-10-10.md). Overall beta remains NO-GO.
3. **P1-04 — Apple deletion release validation remains open.** The missing code path is implemented locally using fresh native authorization, Firebase same-user reauthentication, and a server-side Apple token exchange/revocation with identity verification. Explicit manual revocation fallback preserves account deletion. Configure the server-only Apple key/team/key ID and validate real Apple/revoked/linked-account flows on a physical iPhone before release. See [P1-04 report](ACCOUNT_DELETION_2026-10-10.md).
4. **P1-04 — Coordinated deletion is implemented and locally verified, but not deployed.** A persistent fence, transactional privileged writes, rules enforcement, leased cleanup stages, settling period, scheduled recovery, and late-upload cleanup now cover current source paths. Emulator concurrency/failure/retry checks pass. Deployment order, Storage cross-service IAM/Eventarc/Scheduler operation, old worker drain, large-account behavior and retained external/legacy records remain release gates; no live data was changed.
5. **P1-05 — Durable indexing recovery is implemented locally; deployment/runtime gates remain.** Per-item jobs, bounded backoff, expiring global leases and the reused P1-04 recovery scheduler replace acknowledged/lost indexing failures. Existing 10/minute and 50/day quotas now cover all queued/backfill item embeddings; normal retrieval includes unindexed ready items through structured metadata. Local burst and consent/deletion failure tests pass. Deploy and verify the collection-group index, coordinated workers/rules, secret binding, historical reconciliation and actual provider/device behavior before closing this release gate. See [P1-05 report](INDEXING_RECOVERY_2026-10-10.md).
6. **P1 — Final signed build and core journeys lack current device validation.** Local tests and a simulator build cannot approve native Apple/Google authentication, hardware camera/cutout, permission behavior, OS interruption, or the production-environment signed binary. New backend fixes also remain undeployed pending approval.

Additional reliability risks: saved-outfit listing limits to the newest 80 documents before filtering inactive records, which can hide older active looks; multi-document save/wear/plan actions have partial-failure and concurrent-duplicate risks; app attestation is not enforced in the current callable/client configuration, so per-UID limits alone do not address account-churn abuse. These are source findings, not demonstrated production incidents.

## Physical iPhone release gate

Use dedicated test accounts and the approved signed candidate, on the minimum supported iOS and a current iOS version. Include at least one device with limited memory.

- Fresh email registration, password reset, Apple sign-in (including Hide My Email), Google sign-in, cancellation, sign-out/account switching, and cold restored sessions. Interrupt onboarding on every step, relaunch, finish once, and confirm completed users never re-enter onboarding. Test offline profile loading/retry.
- Camera and photo-library access: denied, limited, and granted permissions; large/HEIC photos, cutout fallback, cancellation, retries, network loss, background/foreground, and force quit. Confirm no duplicate final items, lost user edits, stranded drafts, or photos missing from surviving items.
- Empty/sparse closet, complete outfit generation, outfit mutation, provider timeout, and rate-limit recovery. Confirm cards contain valid owned closet items. Check authenticated runtime with AI consent accepted and declined.
- Save, remove, re-save, relaunch, open detail, delete a referenced closet item, wear, and calendar plan/unplan. Double-tap and interrupt requests; confirm durable records and counters remain consistent.
- Delete accounts created through each provider with fresh and stale sessions. For Apple, verify revocation and subsequent sign-in behavior. Using approved isolated test data, verify all Firestore descendants and Storage objects disappear, other accounts survive, retries recover, and in-flight work cannot recreate data.
- Verify final signed build number, icon/splash, privacy/support links, microphone/speech/location/calendar permission descriptions and denial recovery, Sentry crash delivery/symbolication without personal data, and background/relaunch stability.

## Commands and reproducibility

Run from the repository root unless specified:

```sh
npm test -- --runInBand
npm run typecheck
npm run lint
npm run check:eas-env
npm --prefix functions test -- --runInBand
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix functions run eval:aura:gate
PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin':$PATH firebase emulators:exec --only firestore,storage --project demo-aura-beta --config firebase.beta-test.json 'node scripts/test-beta-security.cjs'
(cd ios && pod install)
```

`pod install --deployment` initially failed because the native lockfile predated installed Expo patch versions; normal `pod install` reconciled that specific drift. Native build command (unsigned, arm64 simulator only):

```sh
xcodebuild -workspace ios/AURA.xcworkspace -scheme AURA -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/aura-beta-release-build -jobs 4 ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO build
```

Earlier compilation attempts were interrupted to narrow architecture/concurrency; only the final completed run determines the result above. This is not an IPA/archive or physical-device signing check. Read-only remote checks used `firebase functions:list`, Rules API through authenticated Firebase CLI libraries, Firestore index metadata, deployed source archives, EAS environment/build history, and unauthenticated HTTP probes.

Files changed by this audit: `functions/src/deleteAccountData.ts` and its new tests; new shared deletion/recent-auth helpers and tests; `functions/src/ai/wardrobeIntelligence/{agentActionCallables,agentIntent,indexClosetItem}.ts` and regression tests; `src/lib/{deleteItem,errors}.ts` and tests; the account callable timeout in `src/profile/screens.tsx`; `app.json`, `eas.json`, native plist/project/Podfile/lockfile; `firebase.beta-test.json`; `scripts/test-beta-security.cjs`; and release documentation. Package and website changes shown in git status predate this audit.

Approval is required before deploying the reviewed backend, starting/submitting release builds, or running tests that modify live accounts. Resolve the blockers and complete the device matrix before changing this recommendation to GO.


## P1-02 — Authentication and deep-link reliability follow-up

**Implementation/automated verdict: PASS for both reported routing issues. Native release sign-off: NOT YET PASSED. Overall external beta: NO-GO.** Existing UI, cards, flatlays, styling/closet intelligence, disabled Photo Refinement, Firebase configuration, Expo SDK 54, and the Xcode 26.0 EAS pin were preserved. This follow-up made no cloud build, deployment, submission, Git push, real-provider sign-in, or production data mutation.

### Root causes and evidence

1. **Initial iOS URL source mismatch.** Installed Expo Router 6.0.21's `build/link/linking.js` uses synchronous Expo Linking `getLinkingURL()` on iOS. Expo Linking's `LinkingAppDelegateSubscriber.swift` populates its registry in URL/user-activity callbacks, without reading launch options. React Native's `RCTLinkingManager.mm:getInitialURL` reads those launch options, which AURA's existing AppDelegate passes to the React Native factory. A regression test against the installed Router implementation demonstrates that an empty Expo registry returns `aura:///` even when React Native retains `aura://forgot-password`. The legacy native lifecycle's precise event ordering was not instrumented in a newly built app; the source-level gap and controlled reproduction explain the prior cold/warm difference without claiming new device evidence.
2. **AuthGate discarded routing intent.** The old gate withheld its navigator while auth/profile checks ran, redirected signed-out users based on `useSegments()` without navigation readiness, and redirected every signed-in auth route to onboarding/tabs. In real Router integration tests, async initial linking leaves `useSegments()` empty until nested navigators hydrate. An empty cached segment list is therefore not evidence that no auth deep link exists. The old signed-in rules also explicitly displaced password recovery.
3. **Unsolicited callback was treated as an app page.** The registered reversed Google scheme reached Expo Router, but there was no native-intent boundary or `oauthredirect` route. Router consequently rendered its unmatched page with callback parameters. This synthetic result does not establish a failure of legitimate Google sign-in. The installed native AppAuth source uses `ASWebAuthenticationSession` completion to resume its own session, compares returned state to the request, and validates the ID-token nonce. Those native paths were not modified.
4. **Recovery navigation was not a Firebase reset action handler.** `forgot-password.tsx` only requests an email with `sendPasswordResetEmail`; it did not read, verify, or apply an action code. Treating an app navigation link as proof of actual password reset completion would have been incorrect.

### Changes and security boundaries

- `app/+native-intent.tsx` recovers the initial iOS URL from React Native before Router constructs its initial state, falling back to Expo's supplied URL if unavailable. Warm URLs never replay launch options. This uses the SDK 54 native-intent API, with no AppDelegate/scene patch.
- `src/navigation/incomingLinks.ts` validates schemes, hosts, paths, duplicate action fields, action mode, the configured Firebase API key, and bounded code syntax. Unsupported/malformed inputs become a clean login route. Ordinary `aura://forgot-password` links open the email-request screen. Valid reset actions delivered to the app open the separate reset-action screen. No arbitrary `continueUrl` is followed; optional language data does not control navigation. Only the configured Firebase auth-domain HTTPS action path is accepted; dynamic-link wrappers and arbitrary custom hosts are intentionally unsupported.
- `src/auth/passwordResetAction.ts` retains one action code in memory with a ten-minute local availability limit; replacement invalidates the previous request. Only a non-secret request identifier enters Router state. Firebase remains authoritative for code ownership, expiry, and one-time use. `app/(auth)/reset-password.tsx` verifies the code before enabling the existing auth primitives, confirms the new password with Firebase, handles errors without provider text, and clears the code on success or explicit exit. It does not automatically sign in a user.
- The default reset-email send configuration and Firebase-hosted web handler are unchanged. Native parsing does **not** establish universal-link provisioning or cause existing reset emails to open AURA. The action screen applies only when an action URL is actually delivered to the native app. Web reload/process restart does not restore in-memory action state; reopening the original valid link or requesting another email is required.
- `src/auth/useAuthRouting.ts` waits for auth and root navigation readiness, reads the pending root-state destination while nested navigation is hydrating, exempts recovery screens from onboarding/profile redirects, and scopes profile decisions to UID and profile revision. Profile results from an old account are ignored. Signing out/rechecking auth invalidates the previous profile decision. `app/_layout.tsx` retains its navigator and uses its screen layout to withhold protected content while checks or redirects are pending; existing loading/error UI is reused.
- `src/auth/googleSession.ts` / `googleAuth.ts` track only whether the native SDK call is active, reject concurrent calls, and clear that flag on every completion/error/cancellation. An unsolicited callback routes to login (then the ordinary authenticated gate applies if a session already exists). An active-session duplicate JS callback returns an empty path, which the installed Router subscriber ignores. The JS handler never exchanges URL codes/tokens or pretends to validate OAuth state/nonce. Credential creation still uses only the native SDK's returned ID token after successful native sign-in. Real state/nonce behavior remains the SDK's responsibility and needs device testing.
- `src/lib/sentry.ts` now scrubs custom-scheme URLs, reset codes, OAuth code/state/nonce and PKCE fields in telemetry. `src/contexts/AuthContext.tsx` and `googleAuth.ts` no longer print raw provider/session error objects. Existing safe user-facing auth error mapping remains in place.

### Regression tests and commands

New suites: `src/navigation/initialUrl.baseline.test.ts`, `nativeIntent.test.ts`, `incomingLinks.test.ts`, `routerIntegration.test.tsx`; `src/auth/useAuthRouting.test.tsx`, `googleAuth.test.ts`, `passwordResetScreen.test.tsx`. Extended `src/lib/sentry.test.ts`. `jest.config.cjs` now transforms installed React Navigation/native support modules so integration tests run the actual Router; no new package or framework migration was needed.

Coverage includes cold and warm reset navigation, signed-out and restored signed-in users, delayed auth/URL/profile initialization, navigation readiness, incomplete onboarding, ordinary Welcome/login/home transitions, account switching, same-account reauthentication, profile refresh, malformed/unsupported URLs, wrong-host/project/mode and duplicate parameters, expired/invalid actions, stale async action results, cancellation/provider errors, unsolicited and active-session callbacks, and telemetry redaction. Native/Firebase/provider boundaries are mocked; Router itself runs in the integration suite.

| Check | Observed result |
| --- | --- |
| `npm test -- --runInBand` | PASS — 40 suites / 217 tests, 74 more than the prior 143; existing unrelated Animated `act`/missing-config diagnostics can appear |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — 0 errors; 9 pre-existing warnings |
| `git diff --check` | PASS |
| `EXPO_NO_TELEMETRY=1 SENTRY_DISABLE_AUTO_UPLOAD=true npx --no-install expo export --platform ios --output-dir …/ios-js-export` | PASS — local production JS/Hermes export; **not** an Xcode build, signed artifact, or runtime launch |
| New native simulator/device validation | NOT RUN — no further EAS build authorized/created; no modified native artifact launched |
| Authenticated Google/Apple and real reset-email completion | UNVERIFIED — no real credentials or production mutations used |

A SHA-256 comparison against the prior build snapshot found no missing files and no changes outside the auth/routing, telemetry, Jest, and report files listed here. Existing native/toolchain, package/lockfile, Firebase, UI, and unrelated user edits match that snapshot.

Local logs and JS export: [`qa-artifacts/auth-links-2026-10-09`](../../qa-artifacts/auth-links-2026-10-09/). The prior native evidence remains exclusively build `adc8a66b-74df-4174-8862-118b7684c45b` in the [launch investigation](IOS27_LAUNCH_INVESTIGATION_2026-10-09.md); its successful iOS 26.5/27 launch does not validate these edits.

### Required native/physical-device follow-up

Use a newly approved Xcode 26.0 candidate on iOS 26.5 and 27 (and a physical iPhone at the supported minimum/current OS as available). Verify terminated/cold and warm app navigation links; actual delivered Firebase action links, expired/reused codes, wrong-project/malformed inputs and safe exits; delayed/offline auth and profiles; signed-in/out and interrupted onboarding; background/foreground and restored sessions. With approved dedicated accounts, complete Google and Apple sign-in, cancellation, callback success/error/replay, account switching, email reset and subsequent login. Check screenshots and app/system/telemetry logs for parameter leakage. Include Google's external-browser fallback if supported by the target device's accessibility/browser settings. A local mocked SDK success proves the JS boundary is preserved, not that a real provider exchange works.

| Issue | Automated/source verdict | Release runtime verdict |
| --- | --- | --- |
| Cold/warm password-reset destination | PASS | Pending new native artifact; gate remains open |
| Unsolicited Google callback safety/routing | PASS | Pending new native artifact; gate remains open |
| Legitimate OAuth session preservation | PASS for unchanged native flow and mocked JS completion/cancel/error boundary | Real authenticated provider flow UNVERIFIED |
| Existing login/onboarding routing | PASS | Physical interrupted/onboarding/session matrix pending |
| External beta | **NO-GO** | Other privacy/deletion/indexing/device gates above remain open |


## P1-03 — Privacy and third-party AI consent follow-up (October 10, 2026)

**Implementation/automated: PASS. Release sign-off: FAIL pending deployment/publication/device gates. External beta: NO-GO.**

The [P1-03 report](AI_PRIVACY_CONSENT_2026-10-10.md) contains the audited provider-path matrix, files, tests, policy corrections and remaining risks. It supersedes the earlier finding that the local app has no privacy access/consent mechanism; it does not assert that the live backend now enforces consent.

- Privacy is readable before login and from Profile; explicit optional consent names OpenAI, data/purposes, automatic processing, optional SerpApi and native speech services. Server-confirmed per-user status/version/revision/timestamp replaces any assumed client approval. Missing/outdated/revoked decisions deny AI, including retries and queued triggers.
- Uploads/manual editing and saved-look access remain available. Optional save/wear feedback learning skips AI without consent. Acceptance can resume older items through guarded idempotent pages. Existing indexing quota/recovery limitations remain an independent blocker.
- Old flags can no longer enable Beta 1 Polish; automatic polishing is off. Core extraction remains available with consent under existing quotas. UI cards/flatlays, Expo 54, Xcode 26.0 pin and unrelated changes are preserved.
- Final checks: app **42 suites / 230 tests**, TypeScript PASS, lint PASS with 9 existing warnings; functions **32 suites / 346 tests**, build/lint PASS; **12 consent + 19 existing security emulator checks PASS**; website typecheck/lint/build and policy-copy check PASS. Providers were mocked; no real credentials or paid AI requests used.
- Local browser policy rendering was inspected. **No new native artifact was built/run**; iOS 26.5/27 privacy behavior and real speech/provider/device flows remain unverified. No Firebase deployment, EAS build, push, submission or production mutation occurred.
- Canonical public privacy URL/contact values are selected; their accessibility/deliverability and provider/project retention remain unverified. Policy and App Store privacy-answer drafts were corrected for first-party usage analytics, pseudonymous identifiers, images/audio/embeddings, location/calendar context and nonzero-retention/deletion limits. Nothing was published or submitted.


### P1-03 contact configuration follow-up

The owner selected the Beta 1 canonical Privacy Policy URL `https://aura-kasatlabs.vercel.app/privacy`, Terms URL `https://aura-kasatlabs.vercel.app/terms`, and support/privacy email `support@getaura.app`. These replace pending-contact placeholders and use the newer Vercel website. Shared disclosure/contact values feed the bundled app policy and standalone website copy; onboarding and account-deletion settings link to the same in-app policy/support information.

**Configuration is complete; verification is not.** The policy remains readable inside AURA when the external site is unavailable. Public-page accessibility and email deliverability remain open release gates. No test email was sent, public page verification claimed, website published, or App Store metadata submitted. P1-03 release sign-off remains pending and overall external beta remains **NO-GO**.

Contact follow-up checks: app TypeScript and 21 focused privacy/auth tests PASS; lint PASS with 9 existing warnings; website typecheck/lint/production build PASS; policy-copy and diff checks PASS. An automated offline-link test confirms bundled policy availability. These results do not verify public-page accessibility, email delivery or native-device behavior.


## P1-04 — Apple revocation and durable deletion follow-up (October 10, 2026)

**Local implementation/automated verification: PASS. Release sign-off: FAIL pending configuration/deployment/device gates. Overall external beta: NO-GO.** Full design, retention inventory, deployment costs/configuration, changed files and test evidence: [P1-04 report](ACCOUNT_DELETION_2026-10-10.md).

- Apple-linked users now request fresh native authorization and same-user Firebase reauthentication. A server-only Apple code exchange validates the signed subject/audience/issuer/expiry before revocation. Failure/cancellation permits an explicitly acknowledged manual Apple revocation fallback; Firebase deletion is never represented as proof of Apple revocation. Native revocation notifications are handled without interrupting an active deletion workflow.
- A server-only `accountDeletionJobs/{uid}` fence persists outside the removed tree. Cleanup is leased and resumable across Firestore, Storage, rate counters, a ten-minute settling period, final sweep and Auth removal. A creation trigger plus five-minute scheduled recovery handles errors/lost invocations. A minimal permanent tombstone prevents old tokens/events from recreating data.
- Rules and privileged writers enforce the fence; Firestore writes read it in their committing transaction. AI provider dispatch/retries and delayed embeddings are blocked. Storage has before/after-upload checks and retryable generation-specific finalization cleanup. Storage erasure is eventual across services, not instant atomic deletion.
- Profile deletion now has confirmation/cancel, recent-identity recovery, pending/retry/status handling, manual Apple fallback, account-switch protection and completion-only sign-out. The 600-second callable timeout and recursive orphan deletion are preserved.
- New product-search cache entries are user-scoped and deletable. Legacy shared-cache entries, separate website waitlist records, provider logs/backups and Storage recovery/version history require separate verified retention/cleanup procedures. No live cleanup occurred.
- Final checks: app **47 suites / 256 tests PASS**; functions **35 suites / 361 tests PASS**; **18 deletion + 12 consent + 19 beta-security emulator checks PASS**; app TypeScript/lint PASS (nine existing warnings), functions build/lint PASS; local iOS JS/Hermes export PASS; website typecheck/lint/build and policy-sync/diff checks PASS; deterministic intelligence **84/84** and standard/hard eval gate PASS. No real Apple/Google/AI credentials were exercised.
- **No new native build or launch was performed.** Earlier Xcode 26.0 simulator launch evidence does not validate these changes. Apple secret/team/key/audience configuration, coordinated backend/rules deployment, Storage cross-service IAM/Eventarc/Scheduler operation, old-worker drain, large-account testing, retained-data decisions and physical iPhone/iOS 26.5/27 validation remain required. Public URLs and `support@getaura.app` delivery remain unverified. No EAS build, push, deployment, production mutation or submission occurred.

| P1-04 area | Local automated | Release sign-off |
|---|---|---|
| Apple authorization revocation | PASS | FAIL / pending configuration and real Apple/device validation |
| Concurrent write protection | PASS | FAIL / pending coordinated deployment and actual Storage/device validation |
| Durable cleanup/recovery | PASS | FAIL / pending deployed delivery, operations and large-account validation |
| Account deletion UI | PASS | FAIL / pending physical-device/provider UX validation |
| Overall beta | **FAIL — NO-GO** | Other release gates remain open |


## P1-05 — Wardrobe indexing recovery follow-up (October 10, 2026)

**Local implementation/automated: PASS. Release sign-off: FAIL / pending deployment and runtime checks. Overall external beta: NO-GO.** Full design, changed files, costs, replay procedure and limitations: [P1-05 report](INDEXING_RECOVERY_2026-10-10.md).

- The old item trigger acknowledged provider/quota failures with no recovery record; inline backfill bypassed per-item quota, nested retries amplified calls, and normal styling retrieval required vectors. These source findings were rechecked rather than carried forward solely from the earlier audit.
- New owner-scoped jobs track pending, processing, completed, retryable-failure and terminal-failure states. The existing P1-04 five-minute scheduler services up to 40 due indexing jobs with four global expiring slots. Eight attempts, exponential jitter, direct quota-window deferral and one explicit bounded recovery cycle prevent indefinite automatic paid retries. The 10/minute and 50/day paid limits are unchanged.
- Current item content/creation identity, consent revision, deletion fence and lease are checked before committing the vector and completed status together. Duplicate/out-of-order events read current documents. Queued/retried work cannot inherit another user's consent or recreate removed data. Already-transmitted provider requests cannot be recalled, and crash-before-commit billing cannot be exactly once.
- Existing reindex/backfill callables now report queued work honestly; they provide bounded recovery for historical items and terminal failures. Owner-only job status exposes safe failure codes without prompts, vectors, URLs or raw exceptions. No historical production replay occurred.
- Normal vector retrieval now includes ready structured items with missing/outdated embeddings and preserves existing scoring and selected-item/ownership checks. Structured scans are capped at 500 documents; larger wardrobes fail explicitly rather than silently infer absence. The 30-case deterministic styling gate passes unchanged.
- No app/native design, dependency, SDK 54/Xcode 26.0 configuration, disabled Polish flag or prior P1-02/03/04 safeguards were removed. No deployment, push, EAS build, paid AI call, TestFlight submission or live data change occurred. A local iOS JS export is not native/device verification.
- Release gates: deploy the collection-group index and coordinated workers/rules; bind the existing OpenAI secret to the reused scheduler; drain older workers; validate Scheduler/Eventarc delivery, IAM, real provider timeouts, sustained multi-user load and alerting; approve historical reconciliation; then validate intake/styling/consent/deletion on a new approved candidate and physical iPhones. Other privacy/contact, authentication, deletion, retention and release gates remain open.

Final P1-05 checks: client **47 suites / 256 tests**, backend **36 suites / 369 tests**, and **71 emulator checks** (22 indexing, 18 deletion, 12 consent, 19 security) PASS. TypeScript, backend build, app/backend lint (nine existing app warnings), local iOS JS/Hermes export, policy synchronization and whitespace checks PASS. Deterministic intelligence **84/84** and styling evaluation **30/30** PASS. One initial client Jest process exited 139; the full unchanged-client rerun passed with exit 0.

Mocked-provider bursts completed with exactly 10/25/50/100 successful embedding calls in 1/3/5/11 logical sweeps. The 100-item case crossed two daily quota windows (24h 19m from its first sweep); no quota increase or production latency claim is implied. Two simultaneous 25-item wardrobes also completed with isolated consent/quota records and four concurrent calls observed. All timing/provider claims here are emulator or mocked behavior, not new native or deployed-runtime certification.

## P1-06 — Integrated release review (October 10, 2026)

**NOT READY TO DEPLOY. Overall external beta remains NO-GO.** See [the integrated report and ordered deployment/recovery plan](RELEASE_INTEGRATION_2026-10-10.md). This is a fresh source/configuration/test audit; no deployment, provisioning, secret payload access/change, EAS build, push, submission or live-user-data mutation occurred. App/backend/native/UI sources and all existing user changes were preserved.

New verified findings that take precedence over earlier readiness summaries:

- **Ingestion data integrity remains a blocker.** An additional real-handler/emulator probe replayed an old photo-ingestion event after hard deletion; its unsafe-image failure merge recreated the item. No external/provider request occurred. Account-deletion fences and the indexing creation-identity guard do not protect this ordinary item-deletion path. Ingestion needs transactional current-item/run/source/creation checks on every write, with deletion/edit/replay regressions. This was reproduced and documented, not changed during the deployment-planning task.
- **Live backend remains the old 48-function deployment; candidate has 55 exports.** Seven new endpoints/workers and the recovery schedule are absent. Live rules still exactly match HEAD, not the new working rules. No unexplained extra endpoint names were found; this is not fresh source-archive parity for all functions.
- **Provisioning/configuration gates are concrete:** Apple revocation secret absent, only OpenAI secret versions 1/2 present; required explicit Storage cross-service IAM grant absent in project policy; new indexing group index absent. Eight existing indexes, including two 2048-vector indexes, are READY; both vectors are omitted from the repo JSON and must be preserved in the reviewed deployment manifest. No Cloud Tasks resource is needed.
- **Build 9 is not a compatible consent/deletion client.** Its EAS-recorded source ignores deletion response data and signs out on a fulfilled pending response; it has no new consent/status UI. Backend-first fails closed for unapproved AI but disrupts existing journeys. No verified maintenance/minimum-version control exists; rules cannot fence old Admin writers during a partial rollout. Approve and rehearse isolation, old-worker drain and upgrade sequencing before deployment.
- **Public URL reachability now passes from this machine; publication correctness fails.** Privacy/terms/support/deletion return HTTP 200 but serve older disclosures and the old personal contact. Canonical support@getaura.app has Google MX records, but mailbox receipt/deliverability remains unverified. Publish reviewed current copy and complete contact/retention/App Store answer review; this does not close the privacy gate.
- **Retention metadata:** app bucket soft delete is 7 days; Firestore PITR disabled, no backup schedules returned; global Cloud Logging defaults retain 30/400 days. Other exports/sinks, Sentry/provider/waitlist retention and legacy cache purge remain owner decisions. Product cache expiry is not physical deletion; permanent deletion tombstones must remain.
- **Feature claims must distinguish source from live:** candidate hard-disables Polish and keeps ordinary uploads/local background removal/manual planning and consented styling/extraction. Live search is unconfigured (SerpApi key/flag absent); curated shopping remains. Extraction retains its existing two-per-month allowance. Current resolved Router is 6.0.24, within manifest ~6.0.21; SDK 54/RN 0.81.5/Xcode 26.0 pin unchanged.

Fresh validation: client **47 suites/256 tests**, backend **36 suites/369 tests**, **71 emulator checks**, intelligence **84/84**, styling **30/30**, app TypeScript/lint (9 existing warnings), functions lint/build, website typecheck/lint/build, local iOS JS/Hermes export, policy sync and whitespace checks PASS. Client/backend suites also pass on Node 22.23.3 from their proper working directories. Additional stale-ingestion probe **FAILS release behavior** despite the existing suite being green. Exit 139 did not recur; saved macOS crash metadata shows a prior Node/V8 GC SIGSEGV, without a proven cause. One ad-hoc Node 22 backend run from the wrong cwd failed a package.json assertion; the correct functions-directory rerun passed.

Evidence and full per-file/dependency/cloud inventory: `../../qa-artifacts/release-integration-2026-10-10/`. The existing Xcode 26 simulator build is still the newest EAS artifact and predates P1-02–P1-05; this task creates no modified native runtime evidence. Next store number is expected to be 10 under local ownership, subject to ASC reservation verification. Fix ingestion, reconcile the release snapshot/configuration, rehearse approved isolated deployment and authenticated recovery tests, then validate a newly approved signed artifact on physical iPhones before either deployment or beta sign-off changes.


## P1-07 — Photo ingestion race and data resurrection (October 10 follow-up)

**Local database-resurrection/concurrency verdict: PASS. Deployment: NOT READY TO DEPLOY. External beta: NO-GO.** [Full report, changed files, commands and evidence](PHOTO_INGESTION_RACE_2026-10-10.md).

Before editing, the original P1-06 real-handler/emulator probe recreated a hard-deleted item through the unsafe-image error merge. Current regressions confirm no recreation after provider wait, immediately before final commit, on replay or during indexing. Atomic claim/current item creation/run/source/consent checks preserve intervening user edits. Product imports and draft cleanup now use current-record transactions. Client autofill finalization cannot merge-create a missing item; uploads use unique names and an empty owner draft. Original image bytes are not overwritten by older server workers.

Item deletion now atomically creates a minimal durable fence and deletes the document through `deleteClosetItem`. Rules reject direct client deletes, fenced-ID recreation and late completed Storage writes. The existing finalizer/recovery schedule handles item media as well as account deletion; failed cleanup remains recoverable. Build 9 requires an upgrade for item deletion. New source count is 56 exports; two additional recovery field indexes and the previously identified IAM/vector-index work are required. No production or staging change occurred.

Verification: client **48 suites / 263 tests**, backend **37 suites / 375 tests**, both on Node 24 and Node 22; **93 emulator checks** including 22 new ingestion checks; intelligence **84/84**, styling **30/30**, TypeScript, lint, backend build, policy synchronization and whitespace checks PASS. Client lint retains nine pre-existing warnings. Earlier exit 139 did not recur. Real providers were mocked; no paid calls or real credentials were used.

Storage remains eventually consistent: finalization can occur after a fence, with generation cleanup afterwards. Existing surviving references/current processing outputs are protected by cleanup reads, but new cross-item references committed after that read are not atomically coordinated with Storage deletion. Unique names do not cancel old already-authorized legacy overwrite sessions. This documented media-reference limitation, actual cloud delivery/backlog behavior, retention of minimal item fences and old-client maintenance/drain require closure before release.

No new native artifact was built or tested. Physical-iPhone upload/cancel/retry/background/termination/account-switch/deletion, shared-media and real OAuth validation remain pending alongside all prior Apple, privacy publication/mailbox, cloud configuration and release-number gates. Preserve SDK 54, Xcode 26.0, existing UI/cards/flatlays and server-disabled Photo Refinement.


## P1-08 — Shared media and legacy compatibility follow-up

Implemented server-validated reference permits, a recoverable per-user cleanup lease, permanent path retirement before Storage deletion, immutable uploads/extraction assets, cross-user rejection and generation-specific retry cleanup. Recursive inventory protects items, saved looks, profiles, nested chat snapshots and pending permits. New finalizations and updated users enter bounded sweep/inventory recovery; no production inventory or purge ran. Consent revocation and accepted account-deletion recovery remain available. The ingestion trigger explicitly retries pre-claim maintenance contention; existing leases/current-source checks prevent duplicate committed results.

The matching client adapter, all privileged writers, `prepareMediaWrite`, rules, new field indexes, updated finalizer/scheduler and deletion acknowledgement must be deployed as one dependency closure. No client version assertion bypasses security. A non-destructive upgrade notice exists in the updated app, but Build 9 lacks its reader and hides server messages; approve a real distribution/communication transition before reopening. Missing legacy deletion acknowledgement now fails before new deletion acceptance.

Shared-media concurrency and local recovery **PASS**; historical inventory, large-account/batch capacity, old Admin drain, deployed IAM/index/event behavior, Apple credentials, public policy/support verification, retention and exact-artifact physical-device testing remain open. See P1-08 for final unit/emulator/evaluation counts and commands. No newly modified native artifact was launched on iOS 27. The older Xcode 26.0 simulator success cannot certify these changes. **NOT READY TO DEPLOY / external beta NO-GO.**

P1-08 final local validation: client **50 suites / 281 tests**, backend **38 suites / 385 tests** (both Node 24 and 22), **116 distinct emulator checks**, intelligence **84/84**, styling **30/30**, TypeScript/build/lint and local iOS JS/Hermes export PASS. Client lint retains nine pre-existing warnings. This remains separate from deployed/native-device validation.


## P1-09 — Controlled deployment preflight (October 11)

**NOT READY FOR CONTROLLED DEPLOYMENT. External beta remains NO-GO.** The new report provides a migration inventory,57-function/configuration inventory, additive vector/group-index proposal, proposed independent invocation hold and tested local maintenance-rule preparation, backup/drain/cutover/forward-recovery sequence and dedicated authenticated smoke plan. All proposals remain inactive.

Fresh validation: **281 client tests,385 backend tests** on Node 24/22; **116 emulator checks in one complete run**; intelligence 84/84, styling 30/30, TypeScript/lint/backend build, website checks/build, privacy sync and local iOS JS/Hermes export PASS. Nine prior client lint warnings persist; exit139 did not recur. Modified code still lacks newly built native/iOS 27/physical-iPhone/provider certification.

Hard gates: approved/rehearsed all-endpoint maintenance and old-revision termination (timeout alone is insufficient); actual legacy upload/reference capacity and dormant inventory; Apple credentials, Storage IAM, READY indexes and real recovery delivery; budget/quotas/alerts and recovery backups; correct public policy/contact/retention/App Store answers; ASC Build 9 availability/expiration and an immediately installable matching replacement. A new client must not operate against the old backend; an old client cannot be made graceful by a server error it hides. Do not roll back consent, account/item/media fences or immutable Storage rules to preserve old-client writes.

Only reports and inert proposed deployment files changed. SDK 54, Xcode 26.0, UI/cards/flatlays, server-disabled Polish and unrelated user changes were preserved. No deployment, provisioning, secret creation/rotation, production mutation, GitHub push, EAS cloud build or TestFlight submission occurred.
