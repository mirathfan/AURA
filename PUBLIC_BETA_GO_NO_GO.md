# Public Beta Go/No-Go

Decision date: 2026-08-31

Current decision: **NO-GO for inviting external testers**. The code candidate is ready for build 9, but distribution/device/account checks remain release gates.

## Verified Gates

- [x] Onboarding crash fix is included in the build-9 source candidate and covered by automated tests.
- [x] Production logging centrally sanitizes prompts, emails, raw UIDs, URL paths/query strings, secrets, and UID-bearing storage paths.
- [x] Paid AI endpoints use authenticated, transactional per-user server limits with bounded input/fan-out.
- [x] Dependency critical findings are resolved; remaining high `sharp` exposure is assessed and documented.
- [x] Production Sentry DSN accepted a privacy-safe synthetic event tagged `aura@1.0.0+9` / dist `9`.
- [x] Live privacy, terms, support, and delete-account routes return successfully; support contact is no longer a placeholder.
- [x] Expo package patches are aligned and the remaining Expo Doctor warning is expected for the checked-in native project.
- [x] Extraction V2 remains disabled and the current Firebase extraction backend is unchanged.

## Open Release Gates

- [ ] Build 9 is successfully created, uploaded, and processed in TestFlight.
- [ ] A physical-iPhone TestFlight install passes fresh signup, onboarding, Closet, AURA, planning, logout/relogin, and reliability testing.
- [ ] Disposable-account deletion is verified end-to-end against Firebase Auth and associated stored data.
- [ ] The synthetic/build-9 event is inspected in Sentry for stack readability and privacy; source maps and alert delivery are verified.
- [ ] Firebase/GCP budget alerts and recipients, OpenAI spend monitoring, and the SerpApi cap/disabled state are verified in their live accounts.
- [ ] App Store Connect beta metadata, URLs, export compliance, feedback contact, tester instructions, and App Privacy answers are reviewed and completed.

## Accepted Temporary Risks

- `sharp` and `@imgly/background-removal-node` retain high advisories for which the current audit reports no fix. The image path is reachable, but authenticated access, MIME/size validation, timeouts, quotas, per-user rate limits, and isolated Cloud Functions reduce exposure for a small trusted beta.
- App Check is deferred because released clients do not include valid integration. Enforcing it now would break beta clients; add clients first, monitor tokens, then progressively enforce expensive Functions.
- Known retailer extraction limitations remain accepted: Zara cloud-origin blocking, Amazon/StockX variability, intermittent JD Sports extraction, Gymshark currency ambiguity, and H&M title cleanup.

## Decision

- [ ] GO
- [x] NO-GO

Decision notes: Do not invite external testers until every open release gate above is evidenced against build 9.
