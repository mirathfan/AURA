# AURA Build 9 Beta Hardening Report

Audit date: 2026-08-31; production deployment and live verification updated 2026-09-15

Scope: external TestFlight beta safety only. Extraction V2 remains disabled; no unrelated product or website redesign is included.

## Release Blockers Addressed

- Build-8 onboarding crash fix is included in source: the app root uses `GestureHandlerRootView`, auth routing is centralized, and onboarding state is persisted/restored safely.
- Firebase Functions logging now passes through a recursive privacy sanitizer. Known raw styling queries are logged only by length; product-polish logs no longer contain UID-bearing storage paths.
- Paid-AI endpoints use the existing Firestore transaction limiter with pseudonymous UID keys and a client-safe `resource-exhausted` error.
- Expensive request text/URLs are bounded; retry/fan-out paths were reviewed; all-user wardrobe backfill is capped at 300 items per run.
- Production website support contact is `mirathfan@gmail.com`; privacy, terms, support, and delete-account routes return HTTP 200.
- Safe Expo SDK patch upgrades reduced Expo Doctor from 16/18 to 17/18 checks.

## Server Rate Limits

Limits are per authenticated user. Minute and daily counters are consumed atomically in one Firestore transaction.

| Limit key / protected work | Per minute | Per day |
|---|---:|---:|
| AURA chat and stream (`auraChat`) | 6 | 40 |
| Product-link extraction/import | 5 | 30 |
| Image ingestion | 3 | 25 |
| Product image polish | 3 | 20 |
| Outfit extraction | 2 | 15 |
| Outfit layout reconstruction | 2 | 15 |
| Accessory polish | 3 | 20 |
| Affiliate links | 30 | 300 |
| Outfit-intent parsing | 20 | 200 |
| Product search | 3 | 20 |
| Outfit chat | 10 | 100 |
| Outfit generation | 4 | 30 |
| Wardrobe retrieval | 8 | 60 |
| Style-memory AI work | 8 | 60 |
| Wardrobe indexing | 10 | 50 |
| Wardrobe backfill | 1 | 1 |
| Voice transcription | 6 | 60 |
| Account deletion | — | 3 |

## Logging And Privacy

The centralized logger now recursively:

- replaces prompt/query/content fields with redacted length metadata;
- redacts emails, tokens, cookies, authorization values, and secret-like keys;
- removes URL paths and query strings while retaining safe host-level diagnostics;
- redacts raw UID fields and hashes the rate-limit user key;
- converts user storage paths to a safe path category.

Emulator diagnostics that bypass the central logger are strictly gated to the Firebase emulator and do not include prompts or UIDs. Unit tests exercise prompts, emails, UIDs, secrets, product URLs, and storage paths.

## Cost Protection

- Paid endpoints require Firebase authentication before paid work.
- User limits are enforced server-side and transactionally, preventing parallel requests from trivially bypassing counters.
- Natural-language inputs are capped at 2,000 characters and product URLs at 2,048 characters in the reviewed endpoints.
- Image paths retain existing byte/MIME validation, timeouts, early-access quotas, and rate limits.
- Generation/retrieval loops and retries are bounded; all-user backfill has a hard 300-item ceiling per invocation.

## Dependency Audit

Before: 23 findings — 2 critical, 7 high, 13 moderate, 1 low.

After safe non-major remediation (clean `npm ci` audit on 2026-08-31): 13 findings — 0 critical, 2 high, 11 moderate, 0 low.

Resolved critical/high packages include `@grpc/grpc-js`, `adm-zip`, `form-data`, `onnxruntime-node`, `tar`, `undici`, and `websocket-driver`. Firebase Admin/Functions and Expo patch releases were upgraded without force/major dependency churn.

Remaining high findings:

- `sharp` `<0.35.0`: GHSA-f88m-g3jw-g9cj covering inherited libvips CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, and CVE-2026-35591; audit reports no fix.
- `@imgly/background-removal-node`: high through its nested `sharp`; audit reports no fix.

The path is reachable because Functions process authenticated user images. For a small trusted beta, this is an accepted temporary risk with authentication, input size/MIME checks, isolated Functions, timeouts, early-access quotas, and per-user limits. Reassess immediately when upstream publishes patched packages. Moderate findings either require major downgrades/upgrades or are test/transitive paths and are not external-beta blockers.

## Sentry

- Production DSN exists in the EAS production environment.
- Root app wrapping and SDK initialization are present.
- Event scrubbing tests pass, anonymous users are hashed, and build metadata prefers the actual native build number.
- A privacy-safe production-DSN synthetic event was accepted with event ID `7d0b68deac77d94c8a7e108024c165f0`, release `aura@1.0.0+9`, dist `9`, environment `production`.
- Sentry UI receipt, readable symbolicated stack, source maps, and alert delivery are not verified because no signed-in Sentry project access or source-map credentials were available.
- Missing EAS values: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

## Expo / Native Configuration

- Expo Doctor before: 16/18.
- Expo Doctor after: 17/18.
- Remaining warning: app-config fields are not automatically synchronized when native `ios/` and `android/` directories are checked in. This is expected for this project.
- Inspected native bundle ID is `com.kasat.aura`; app version is `1.0.0`; production EAS uses auto-increment and should produce build `9` from checked-in build `8`.

## App Check

App Check remains unenforced. The current mobile clients do not include a valid App Check integration, so immediate enforcement would break build 8 and build 9. For a trusted beta, authentication plus server rate limits is acceptable. Staged rollout: add iOS/Android client integration, release it, monitor valid token traffic, then progressively enforce expensive callables first.

## Production Functions Deployment

- The build-9 mobile configuration and live Functions both use Firebase project `closet-app-57146` in `us-central1`. The earlier `aura-app-25fc9` HTTP 403 was caused by explicitly targeting a stale/wrong project ID, not by missing access to production.
- The authorized Firebase CLI identity deployed all 48 production Functions containing shared logging/rate-limit code. All 48 are ACTIVE; `askAura` is on source hash `aa7077a124a0ff254b031f8f71046a45d4ea14c8`, and `askAuraStream` is on `ddbdea02014bb2dc78bda6b0b83733d0d4f68d52` after the strict-schema and clean unauthenticated-response fixes.
- Live authenticated tests passed for AURA callable/stream, the transactional 6/minute AURA boundary, the 20/minute intent-parser boundary, H&M fallback, compatibility V1 extraction, and the legacy preview alias.
- Production log searches found the pseudonymous UID hash and safe metadata but no synthetic raw prompt marker, raw UID, email, auth token, full H&M path, or URL query string.
- The disposable verification account and its limiter documents were removed; Firebase Auth returned `USER_NOT_FOUND` afterward.

## External Account And Device Gates

- Firebase Functions deployment: complete on `closet-app-57146`; commit `7517314` hardening and the two follow-up Aura fixes are live and verified.
- GCP/Firebase budget alert state and recipients: manual required; they were not verified in this Functions deployment task.
- Sentry alert destination/source maps: manual required; no project session/credentials were available.
- App Store Connect metadata/privacy/export compliance: manual required; no signed-in session was available.
- Physical-iPhone TestFlight QA: required after build 9 is processed. Disposable-account deletion has been verified against production Firebase Auth and backend cleanup.

## Build 9 And Submission

- EAS build: `f99e432e-1d39-464b-b73d-7aef91cc212b`
- Version/build: `1.0.0` (`9`)
- EAS status: `FINISHED` at 2026-09-01 00:50:01 UTC
- App Store Connect submission: `0f1c110a-ce5b-4b00-8786-8f7387738b75`
- Upload status: accepted by App Store Connect; Apple processing pending at last verification.
- Build page: `https://expo.dev/accounts/mirathfan/projects/aura-ai-personal-stylist/builds/f99e432e-1d39-464b-b73d-7aef91cc212b`

Current verdict: **NO-GO for external tester invitations until the account and physical-device gates in `PUBLIC_BETA_GO_NO_GO.md` are complete.**
