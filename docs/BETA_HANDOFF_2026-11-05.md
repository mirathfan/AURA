# AURA beta handoff — November 5, 2026

Local candidate checks pass. **External beta remains NO-GO.** This handoff records fresh repository QA, not deployed behavior or approval to spend, provision, build in EAS, or distribute through TestFlight.

## Candidate and scope

Inspected `main` at `06ece001c69cb6a84787cebddd521f883ffccb66`. The local branch is 13 commits ahead of the locally recorded `origin/main`; no fetch was performed. At entry there were 129 modified tracked paths and 98 untracked entries (some entries are whole directories). These existing changes were preserved. HEAD alone does not represent this candidate.

Existing local work includes consent/privacy, account deletion and recovery, indexing recovery, immutable media/write permits, auth/deep-link handling, and beta release preparation. This pass adds one hook regression test and this handoff, and places a current-status pointer above the historical TestFlight report. No application behavior, cloud configuration, billing or distribution was changed.

## Beta photo contract

- `shared/aiConsent.ts` sets `BETA_AI_FEATURES.aiPolish` to `false` and leaves outfit extraction enabled. Client and server early-access helpers both use this shared switch; a power role or stored feature flag does not override it.
- `functions/src/polishProductImage.ts` rejects unavailable polishing before reading the submitted image or calling the polishing provider.
- The new `usePhotoStep.test.tsx` regression covers photo selection and native-background-removal mocks while polishing is disabled, an explicit blocked polish action, and preservation of the original cutout preview.
- Existing upload lifecycle tests pass, including successful active upload completion, cancellation, deletion races and preservation of user edits. These are mocked local tests; real camera, Storage upload and hardware cutout still require device/cloud verification. Ordinary photo upload and background removal must remain available for beta.

## Fresh validation

Executed with Node **22.23.4**:

| Command | Result |
| --- | --- |
| `CI=1 EXPO_NO_TELEMETRY=1 npm run lint -- --no-cache` | PASS, 0 errors / 9 existing warnings |
| `node node_modules/jest/bin/jest.js --runInBand --watchman=false` (root, before new test) | PASS, 50 suites / 281 tests |
| `node node_modules/jest/bin/jest.js src/addItem/hooks/usePhotoStep.test.tsx --runInBand --watchman=false` | PASS, all 5 cases including the new beta regression |
| `node node_modules/typescript/bin/tsc --noEmit` (root) | PASS |
| `node node_modules/jest/bin/jest.js --runInBand --watchman=false` (`functions/`) | PASS, 38 suites / 385 tests |
| `ESLINT_USE_FLAT_CONFIG=false node node_modules/eslint/bin/eslint.js --ext .js,.ts .` (`functions/`) | PASS |
| `node node_modules/typescript/bin/tsc --noEmit` (`functions/`) | PASS |
| `git diff --check` | PASS |

Direct installed Node entry points were used where executable links are absent. No dependency installation or repair was required in this pass. No backend source changed; an emitting backend build was not run. The previous canary task repaired the root Expo/ESLint and local native-module links; the November 4 lint-blocked banner is historical. Unit output includes React animation `act` warnings and missing-environment diagnostics in mocked tests; these did not fail the suites and do not establish a device incident.

Emulators, native builds, physical-device flows, real providers, cloud deployment and live billing were not exercised by this pass. The prior full integration/emulator results remain historical evidence, not fresh results here.

## Cloud evidence and remaining work

The newest [canary preparation report](PRIVATE_HEALTH_CANARY_2026-11-05.md) supersedes the earlier full-backend canary proposal. It records 37 canary tests, 3 packager tests, 1 local HTTP test and passing lint. Its isolated four-file Cloud Run health function does not validate AURA's Firebase workflows. Phase 2 execution is still not approved or ready.

The latest recorded cloud observation is [Phase 1C](REHEARSAL_BOOTSTRAP_2026-11-04.md): at **2026-11-04T14:22:39.829Z**, the rehearsal project `aura-rehearsal-20261011` / `1087494190017` was ACTIVE with billing unlinked and no known workload assets. This pass did not refresh cloud state. `gcloud` is not on the local PATH. Do not interpret older bootstrap/billing banners as newer evidence.

Next gates, in order:

1. Restore authorized conversation access before attempting the requested Codex AURA ↔ ChatGPT Closet relay. Confirm exact conversation identities before sending anything. Native Codex app/session access was previously denied; it was not retried or bypassed here. No relay, messages or ongoing automation were created. Process enumeration also returned `operation not permitted`; concurrent project work could not be verified. Keep follow-up edits narrow and coordinate before changing shared application files.
2. If proceeding with the private canary, obtain its separately scoped Phase 2 authorization, an authenticated supported CLI, and fresh target/IAM/budget checks. The [exact reviewed scope](PRIVATE_HEALTH_CANARY_2026-11-05.md#8-decision-and-exact-approval-request) includes billing linkage, controls, one build, bounded requests and cleanup. Current development authorization does not authorize these actions.
3. Separately approve and execute the actual Firebase integration rehearsal: consent enforcement, deletion/Apple prerequisites, indexes, worker/event/scheduler delivery, late uploads, immutable-media compatibility and maintenance/old-worker drain. A health-only canary cannot close these gates. See [production preflight](PRODUCTION_DEPLOYMENT_PREFLIGHT_2026-10-11.md) and [integration plan](RELEASE_INTEGRATION_2026-10-10.md); their cloud inventories need refreshing before action.
4. Prepare the matching signed candidate after backend compatibility is established. Obtain approval before a cloud/native release build or external submission. Verify real Apple/Google authentication, reset links, consent decline/revoke, ordinary upload, camera/cutout, outfit cards and account deletion on physical iPhones. Existing source tests and the older simulator artifact do not certify this candidate.
5. Verify current public privacy/terms/support copy, mailbox delivery, App Store privacy/review metadata and exact build distribution state. Publication and person-directed messages require the appropriate authority. Obtain final owner sign-off before external TestFlight.

The handoff is reviewable locally. It is not a release approval, a claim that the app was launched, or a claim that work will continue unattended after this task ends.
