# AURA TestFlight Submission Checklist

Repository audit date: 2026-08-31

Candidate: iOS `1.0.0` build `9` (pending EAS build/upload)

## Repository And Configuration Status

| Item | Status | Evidence | Required action |
|---|---|---|---|
| App name and bundle ID | PASS | Expo and native configuration use `AURA` / `com.kasat.aura` | Confirm listing name in App Store Connect |
| Candidate version/build | READY TO BUILD | App version is `1.0.0`; production EAS profile auto-increments checked-in build `8` to `9` | Record the resulting EAS build ID |
| Onboarding crash fix | PASS IN SOURCE | Root is wrapped in `GestureHandlerRootView`; auth/onboarding routing and persisted onboarding draft are covered by tests | Verify the distributed build on a physical iPhone |
| Production environment | PASS | EAS production has Firebase, Google client IDs, AURA agent flag, and Sentry DSN | Keep Extraction V2 disabled |
| Sentry transport/privacy | PARTIAL PASS | Production DSN accepted safe event `7d0b68deac77d94c8a7e108024c165f0`; scrubber tests pass; release uses native build number | Verify event UI, readable source maps, and alert destination in Sentry |
| Sentry source maps | MANUAL REQUIRED | No `SENTRY_ORG`, `SENTRY_PROJECT`, or `SENTRY_AUTH_TOKEN` is configured in the available EAS environment | Configure/verify before inviting external testers |
| Backend cost controls | PASS IN SOURCE | Auth, transactional per-user limits, input caps, bounded retries/fan-out, and a 300-item backfill ceiling are present | Deploy reviewed Functions before testing |
| Dependency critical/high risk | PARTIAL PASS | Critical findings reduced from 2 to 0; remaining high findings are `sharp` and its `@imgly` parent with no available fix | Accept documented temporary risk for trusted beta |
| Public legal/support routes | PASS LIVE | `/privacy`, `/terms`, `/support`, and `/delete-account` return 200; support shows `mirathfan@gmail.com` | Owner/legal approval remains required |
| App Store metadata/privacy | OWNER REVIEW | Repository drafts exist | Verify and publish accurate answers in App Store Connect |
| Budget/error alerts | MANUAL REQUIRED | Current account cannot inspect the GCP project; Sentry account is not available | Verify thresholds and recipients before external invitations |
| App Check | DEFERRED RISK | Current clients have no App Check integration; immediate enforcement would break them | Stage client integration, monitor tokens, then enforce expensive Functions after beta |
| Expo Doctor | PASS WITH EXPECTED WARNING | 17/18 checks pass; only native-project/app-config synchronization warning remains | Native iOS settings were inspected; do not prebuild speculatively |

## Before Creating Build 9

- [x] Commit the onboarding fix and beta hardening without unrelated website/tooling changes.
- [x] Run mobile, Functions, website, Expo Doctor, dependency-audit, and whitespace validation.
- [x] Confirm `com.kasat.aura`, version `1.0.0`, production environment, Firebase project `aura-app-25fc9`, and Sentry DSN.
- [x] Confirm Extraction V2 remains disabled.
- [ ] Deploy the reviewed Firebase Functions.
- [ ] Create and upload EAS production build 9.

## Before External TestFlight

- [ ] Confirm build 9 finished processing and complete export-compliance prompts.
- [ ] Install build 9 from TestFlight on a physical iPhone.
- [ ] Complete every required path in `PUBLIC_BETA_QA_CHECKLIST.md`, including fresh signup/onboarding, Closet, AURA, and planner/saved looks.
- [ ] Delete a disposable account and verify Auth/data cleanup end-to-end.
- [ ] Verify the safe Sentry event in the project UI, readable build-9 stack traces/source maps, and a working alert destination.
- [ ] Verify GCP/Firebase budget thresholds and alert recipients; verify OpenAI spend monitoring and SerpApi cap/disabled state.
- [ ] Complete TestFlight beta description, tester instructions, known limitations, feedback contact, support/privacy URLs, and export compliance in App Store Connect.
- [ ] Owner/legal review and publish App Privacy answers; do not copy the draft without validation.
- [ ] Record explicit acceptance of deferred App Check and the temporary `sharp` risk for this trusted beta cohort.
