# P1-03 — Privacy access and explicit AI consent

**Local implementation and automated validation: PASS. Release sign-off: FAIL / pending deployment and device verification. Overall external beta: NO-GO.**

Reviewed October 10, 2026, against the actual working tree at base revision `06ece001c69cb6a84787cebddd521f883ffccb66`. Existing uncommitted authentication, security, website and native release work was preserved. This work did not deploy, push, submit, create an EAS build, use real provider credentials, or change production records. Expo SDK 54 and the pinned Xcode 26.0 configuration were not changed.

## Confirmed findings

Before this change, AI access was controlled by authentication, quotas and some feature flags, with no versioned third-party AI permission. In particular, an ordinary closet write could invoke photo analysis and wardrobe embeddings without an explicit AI action. Optional style-memory embeddings could also run after saving/wearing an outfit. Hiding an AI button would not have covered these paths.

The policy existed as repository/website copy, but was not readily accessible from authentication and Profile. It called a hashed Sentry identifier anonymous, omitted first-party Firebase usage analytics, and described retention/deletion more confidently than the implementation justified. Old power-account flags could enable Polish; photo extraction also had an automatic polishing budget.

## Implemented behavior

- Welcome and the shared login/register/recovery scaffold link to a bundled, readable Privacy Policy. `/privacy` is a public route even during auth initialization and onboarding. Profile has **Privacy & AI**, showing recorded status, disclosure version and timestamp, with review/revocation.
- New/missing and outdated decisions show an explicit disclosure naming **OpenAI**, the content categories and purposes, automatic existing/future closet analysis/indexing, optional **SerpApi** shopping search, and native **Apple/Google speech recognition**. **Accept AI sharing** and **Not Now** are separate actions. No prechecked selection or bundled terms acceptance.
- `users/{uid}/privacy/aiConsent` stores `status`, `policyVersion = 2026-10-10`, a monotonically increasing `revision`, and an Admin SDK server timestamp. Only the authenticated `setAiConsent` callable writes it. Rules permit owner reads and prohibit client writes. Missing, declined, revoked, malformed or outdated records fail closed. Acceptance requires the revision shown to the user; a delayed Accept cannot overwrite a newer revocation.
- The UI requires a server-confirmed snapshot. Each client AI dispatch performs a fresh server read, verifies the current account again after that read, and honors immediate local denial. Cached data does not authorize another account. Failed revocation is described as **not server-confirmed**, with retry; it is not represented as globally complete.
- AI HTTP/callable/trigger handlers bind a UID from verified authentication or a trusted Firestore event path, never a client-supplied consent flag. The common provider transport reads Firestore immediately before **every transmission**, including SDK retries, and pins the revision for the request. It permits only HTTPS OpenAI/SerpApi endpoints and rejects redirects. SDK clients and raw provider fetches share this boundary.
- During a provider response, a Firestore listener attempts cancellation on revocation/revision change/read error. Completion checks the same UID/revision again, including when the response is consumed outside the original async scope. Wrapped SDK consent errors remain recognizable. OpenAI Responses/Chat Completions requests explicitly set `store: false`.
- Declined photo ingestion moves to `consent_required`, leaves the uploaded image/manual details intact, and exposes a useful manual-edit message. It does not leave the UI waiting forever for AI. Saving/wearing/planning and browsing saved looks remain available; optional style-memory learning is skipped when consent is absent.
- Acceptance creates an internal, server-only resumable job. Each idempotent page transaction checks the current revision before marking up to 50 existing items for normal ingestion/indexing. Revocation cancels old continuation pages; normal workers and their provider requests independently recheck consent. No provider calls occur in the dispatcher itself.
- Beta 1 core extraction is available without old privileged-account flags, subject to existing quotas. Optional product/accessory Polish is server-disabled even for previously enabled accounts, and automatic extraction polishing has a zero budget. Existing layout reconstruction remains part of consented extraction. Ordinary uploads and local background removal remain available. No cards, flatlay canvases or styling layouts were redesigned.

## Audited external-data entry points

All names below are source entry points; this is not a claim that the live deployment has been reconciled to these sources.

| Entry point / helper | Data actually sent outside AURA | Enforcement / disposition |
|---|---|---|
| `askAura`, `askAuraStream` | Selected messages/history, wardrobe/profile/style context, photo/link attachments, outfit/context details to OpenAI Responses | Auth-bound entry check; guarded SDK transport, including streams and follow-up calls |
| `runAuraStylingAgent`, `generateOutfitRecommendations`, `previewOutfitGenerationContext` | Query/context, selected closet items, preferences and style-memory context to OpenAI; query/memory embeddings | Entry checks and guarded generation/embedding clients; agent logic unchanged |
| `generateAuraSwipeBatch`, `generateOutfitsV1`, `outfitChatV1`, HTTP `parseOutfitIntent` | Outfit/query/closet/context data to OpenAI Chat Completions | Auth-bound entry checks and guarded raw fetch |
| `retrieveWardrobeContext`, `reindexClosetItem`, `backfillWardrobeIntelligence`, `backfillWardrobeIntelligenceAll` | Query or item-description text to OpenAI embeddings | Current-user checks; guarded embeddings. “All” backfills the authenticated user's closet |
| `onClosetItemWriteIndexIntelligence` | Automatic closet-description embeddings | Current consent before quota/indexing; each provider request rechecks; denied events do not transmit |
| `ingestItemFromPhotos` | Uploaded garment images/URLs and relevant extraction context to OpenAI vision | Trusted path UID, entry/transport/completion checks; denied uploads become manually usable |
| `previewProductLink`, `importProductLink`; candidate/photo/URL preview helpers and product extraction pipeline | Retailer URL/page/product details and selected images to OpenAI | Entry guards and guarded injected SDK clients; retailer fetch itself is non-AI and remains SSRF-validated |
| `extractOutfitItems`, `reconstructOutfitLayout` | Uploaded outfit image and extraction/layout context to OpenAI vision/image APIs | Entry and per-transmission guards; existing core layout flow retained; automatic Polish disabled |
| `polishProductImage`, `polishExtractedAccessory` | Would send images/metadata to OpenAI image/quality APIs | Both consent guarded and unavailable under the Beta 1 server feature policy |
| `transcribeAuraAudio` | Temporary voice audio to OpenAI transcription | Entry guard and guarded multipart SDK request |
| `recordOutfitFeedback`, `retrieveStyleMemoryContext`; save/wear/dislike optional learning | Outfit feedback and query/context text to OpenAI embeddings | Direct AI operations gated; optional learning after non-AI actions skipped without consent |
| `searchLiveProducts` / `serpApiProvider` | Shopping query and country/language to SerpApi; search is not itself an AI model call | Included in consent disclosure and guarded transport; non-consenting client uses existing curated fallback |
| Native voice dictation (`useAuraComposerState`) | Audio may go to Apple/Google speech services, depending on OS/device | AI screen gated; fresh server consent read immediately before `voice.start`; listener-driven unmount destroys recognizer. OS permission remains separate |
| Offline optional eval judge | Developer evaluation payloads to OpenAI if a real judge is invoked | Uses guarded SDK; without a verified consent scope it fails closed. Mock/offline evaluation remains available; no live judge executed |
| Scheduled draft cleanup, draft audits/deletion, metrics, local curated shopping/ranking, affiliate URL construction | No external AI calls found | Remain non-AI; normal Firebase ownership/rate controls still apply |
| Image upload and native/IMGly background removal | Uploads go to Firebase Storage; local/native or AURA-backend background removal executes locally to that environment; model assets may be downloaded | No personal image transfer to an external AI provider found in these paths; unchanged |

No additional OpenAI/Anthropic/Gemini/other model-provider transport was found in the reviewed app/functions/scripts. A regression test checks the current source's OpenAI constructors/raw provider fetches remain behind the transport boundary; it is a safeguard, not a general proof against every possible future network implementation.

## Automated test evidence

Evidence directory: `../qa-artifacts/privacy-consent-2026-10-10` relative to the repository's parent workspace. Exact logs are stored at `/Users/athfan/wardrobe-ai/qa-artifacts/privacy-consent-2026-10-10/`.

| Check | Observed result |
|---|---|
| App `npm run typecheck` | PASS |
| App `npm test -- --runInBand` | PASS — 42 suites, 230 tests |
| App `npm run lint` | PASS — 0 errors; 9 existing warnings |
| Functions `npm run build` | PASS |
| Functions `npm test -- --runInBand` | PASS — 32 suites, 346 tests |
| Functions `npm run lint` | PASS — no errors/warnings |
| Local Firebase consent integration script | PASS — 12 checks |
| Existing local Firebase security script | PASS — 19 checks |
| Website `npm run typecheck`, `npm run lint`, `npm run build` | PASS |
| `node scripts/sync-privacy-policy.cjs --check` | PASS — website and Markdown copies match the app disclosure |
| `git diff --check` | PASS |

New regression coverage exercises missing/new/existing users, accept/decline/revoke/outdated records, server timestamps, forged writes, cross-user access, concurrent choices, account switching/stale listeners, cached decisions, failed revocation, policy visibility, auth/onboarding delays, SDK retries, in-flight response cancellation, reacceptance after revocation, queued/redelivered ingestion/indexing, idempotent resume pagination, revoked continuation pages, non-AI manual edits/saved looks, and disabled Polish. Saved-outfit tests verify that optional embedding refusal does not fail the save. Provider SDK errors retain the consent-specific reason.

The Firebase tests use **real local Firestore transactions, security rules and snapshot listeners**, plus Storage rules in the existing security suite. Cloud Function handlers are invoked directly against emulator snapshots; this does **not** validate production Eventarc delivery/retry behavior or a deployed Functions runtime. All provider HTTP is replaced with synthetic responses; no paid/provider request or real credential was used. Tests refuse to run without the specified loopback emulator host and a `demo-aura-beta` project.

Reproduction from `closet/` after `npm --prefix functions run build`:

```sh
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" firebase emulators:exec --project demo-aura-beta --config firebase.beta-test.json --only firestore,storage 'node scripts/test-ai-consent.cjs && node scripts/test-beta-security.cjs'
```

## Runtime evidence and limits

The production-mode **local website** was opened in a browser at `http://localhost:3103/privacy`. Its accessibility tree included the new provider disclosure, analytics, retention/deletion and owner-contact placeholder. Screenshot: `/Users/athfan/wardrobe-ai/qa-artifacts/privacy-consent-2026-10-10/privacy-website.png`. This is a local policy-rendering check, not publication.

**No modified native app was built or run for this task.** The previously authorized Xcode 26.0 EAS simulator artifact `adc8a66b-74df-4174-8862-118b7684c45b` predates these privacy/auth changes. Its successful iOS 26.5/27.0 launch is not runtime evidence for P1-03. Physical iPhone, native speech and live OpenAI/SerpApi flows remain unverified.

## Privacy policy and App Store corrections

`shared/privacyPolicy.ts` is the app's disclosure source. `scripts/sync-privacy-policy.cjs` generates `PRIVACY_POLICY.md` and a standalone website copy so the website's independent deployment root does not depend on parent-directory imports. The public page preserves its existing design. A `--check` mode detects drift.

Corrected disclosures cover Firebase account/content storage and operational logs; first-party account-linked analytics; pseudonymous Sentry association; OpenAI prompts, images, audio and embeddings; automatic processing; optional SerpApi; native speech; weather coordinates and calendar-derived context; tokenized media URL access; revocation versus deletion; and unverified processor/cache/log/backup retention. The new policy explicitly states that an older live backend is not proven to enforce these local changes.

`APP_STORE_PRIVACY_ANSWERS.md` now calls out the needed User Content, Audio, Usage Data/Product Interaction, User ID/Diagnostics, precise-location and calendar-context review, plus body/fit-data classification and shopping/affiliate tracking verification. Consent is not an exemption from Apple's data-collection disclosures. **No App Store Connect answers were submitted.**

Sources used to check these disclosures: [Apple App Review Guidelines, privacy/third-party AI permission](https://developer.apple.com/app-store/review/guidelines/uk/), [OpenAI API data controls and retention](https://developers.openai.com/api/docs/guides/your-data?popup=false), and [Firebase privacy and security](https://firebase.google.com/support/privacy/). `store: false` does not establish Zero Data Retention; dashboard/provider settings and project retention still need owner verification.

## Remaining risks and release gates

1. **Deployment/publication:** approve and deploy the matching functions, rules, consent workers and app together; inventory all actually deployed legacy AI endpoints/triggers and ensure none retain an unguarded old implementation. No production inventory parity or deployed enforcement is claimed here. The owner has selected `https://aura-kasatlabs.vercel.app/privacy`, `https://aura-kasatlabs.vercel.app/terms`, and `support@getaura.app` for both support/privacy. Publish the approved policy and verify public-page accessibility and mailbox deliverability; those checks remain open.
2. **In-flight boundary:** Firestore and a third-party HTTP service cannot share an atomic transaction. A request can cross the network in the gap between the final consent read and revocation, and already received content cannot be recalled. Cancellation is best effort. Stream chunks or provider results already consumed may have influenced a response/write before revocation is observed. New transmissions/retries use fresh checks; do not promise retroactive deletion or instantaneous global cancellation.
3. **Native speech:** the OS recognizer's transport cannot be proxied through the server-side AI fetch guard. The app checks server consent immediately before starting, destroys it when the AI screen loses approval, and relies on OS permissions/cancellation. Verify this behavior on physical devices, including loss of connectivity and cross-device revocation. Already transmitted speech cannot be recalled.
4. **Indexing recovery remains a separate P1 gate:** the resume dispatcher is bounded/idempotent, but the existing indexing trigger still acknowledges rate-limit/provider failures without a durable eventual-retry queue. Large acceptance backfills can exceed the existing 10/minute, 50/day indexing limits. This work prevents unauthorized calls; it does not certify eventual indexing completeness. Use existing manual reindex/backfill after limits reset until that gate is fixed.
5. **Retention/deletion:** exact OpenAI/Firebase/Sentry/SerpApi retention and shared-cache behavior need verification. New consent/job records live under the account tree and are removed by account-tree deletion, but P1-04 now implements and tests the coordinated deletion fence/retry and Apple grant-revocation paths locally; production configuration/deployment and real-device verification remain open (see `ACCOUNT_DELETION_2026-10-10.md`). Consent revocation itself does not delete stored app/provider data.
6. **Device acceptance matrix:** on a newly approved SDK 54/Xcode 26.0 artifact, test iOS 26.5 and 27.0 fresh install/existing account; Accept/Not Now/revoke/outdated version; restart, offline/server failure, account switching and second-device revoke; VoiceOver/Dynamic Type and privacy access before login/onboarding; manual upload/local cutout/edit/save/browse/delete while declined; consented chat, extraction/layout, generation, voice, retailer import and optional live search. Confirm no provider requests while declined/revoked using controlled test accounts and approved observability. Real Apple/Google sign-in and deletion need separate approval/physical-device checks.

| Requirement | Verdict |
|---|---|
| Accessible in-app privacy and explicit optional consent | **PASS locally**; device accessibility and public publication pending |
| Account-scoped versioned consent, outdated/revoked denial, account switching | **PASS automated** |
| Covered server AI paths, queued work, retries and concurrent revocation | **PASS source/unit/emulator**; live deployment parity and provider/native runtime pending |
| Non-AI functionality after decline | **PASS tested manual/edit/save/read paths**; full native journey matrix pending |
| Beta 1 feature boundary | **PASS source/tests**; Polish disabled, extraction available within existing quotas |
| Policy and privacy-answer corrections | **PASS draft/source**; owner/contact/retention review and publication pending |
| P1-03 release sign-off / overall beta | **FAIL pending release gates / NO-GO** |

## Files changed in P1-03

The exact task-specific file list is below, derived from the pre-task SHA-256 manifest (not the entire pre-existing dirty tree). Generated emulator logs were moved to the evidence directory. Native/EAS/Firebase project configuration, package dependencies, cards and flatlay designs were unchanged.

- `APP_STORE_PRIVACY_ANSWERS.md`
- `PRIVACY_POLICY.md`
- `app/(auth)/welcome.tsx`
- `app/(tabs)/ai.tsx`
- `app/(tabs)/profile.tsx`
- `app/_layout.tsx`
- `app/aura/swipe.tsx`
- `app/privacy.tsx`
- `docs/AI_PRIVACY_CONSENT_2026-10-10.md`
- `docs/TESTFLIGHT_READINESS_2026-10-09.md`
- `firestore.rules`
- `functions/src/ai/wardrobeIntelligence/__tests__/agentActionCallables.test.ts`
- `functions/src/ai/wardrobeIntelligence/__tests__/embeddings.test.ts`
- `functions/src/ai/wardrobeIntelligence/agentActionCallables.ts`
- `functions/src/ai/wardrobeIntelligence/agentCallables.ts`
- `functions/src/ai/wardrobeIntelligence/callables.ts`
- `functions/src/ai/wardrobeIntelligence/embeddings.ts`
- `functions/src/ai/wardrobeIntelligence/evals/evalJudge.ts`
- `functions/src/ai/wardrobeIntelligence/outfitCallables.ts`
- `functions/src/ai/wardrobeIntelligence/outfitGeneration.ts`
- `functions/src/ai/wardrobeIntelligence/retrievalCallables.ts`
- `functions/src/ai/wardrobeIntelligence/styleMemoryCallables.ts`
- `functions/src/ai/wardrobeIntelligence/triggers.ts`
- `functions/src/aiConsent.ts`
- `functions/src/askAura.ts`
- `functions/src/askAuraStream.ts`
- `functions/src/extractOutfitItems.ts`
- `functions/src/generateAuraSwipeBatch.ts`
- `functions/src/generateOutfitsV1.ts`
- `functions/src/importProductLink.ts`
- `functions/src/index.ts`
- `functions/src/ingestItemFromPhotos.ts`
- `functions/src/outfitChatV1.ts`
- `functions/src/parseOutfitIntent.ts`
- `functions/src/polishProductImage.ts`
- `functions/src/previewProductLink.ts`
- `functions/src/products/searchLiveProducts.ts`
- `functions/src/products/serpApiProvider.ts`
- `functions/src/shared/aiConsent.test.ts`
- `functions/src/shared/aiConsent.ts`
- `functions/src/shared/consentedOpenAI.ts`
- `functions/src/shared/earlyAccess.test.ts`
- `functions/src/shared/earlyAccess.ts`
- `functions/src/shared/logger.ts`
- `functions/src/shared/pausedIngestion.ts`
- `functions/src/shared/providerBoundary.test.ts`
- `functions/src/shared/resumeAiConsent.ts`
- `functions/src/transcribeAuraAudio.ts`
- `scripts/sync-privacy-policy.cjs`
- `scripts/test-ai-consent.cjs`
- `shared/aiConsent.ts`
- `shared/privacyPolicy.ts`
- `src/addItem/components/OutfitExtractionEntry.tsx`
- `src/addItem/controllerShared.ts`
- `src/addItem/hooks/useItemDraft.ts`
- `src/addItem/hooks/useItemExtraction.ts`
- `src/addItem/useAddItemController.ts`
- `src/auth/useAuthRouting.test.tsx`
- `src/auth/useAuthRouting.ts`
- `src/components/auth/AuthScaffold.test.tsx`
- `src/components/auth/AuthScaffold.tsx`
- `src/hooks/aura/useAuraComposerState.ts`
- `src/lib/aura.ts`
- `src/lib/auraStylingAgent.test.ts`
- `src/lib/auraStylingAgent.ts`
- `src/lib/auraSwipe.ts`
- `src/lib/earlyAccess.ts`
- `src/lib/errors.ts`
- `src/lib/items.ts`
- `src/lib/outfitExtraction.ts`
- `src/lib/productLinkClosetImport.ts`
- `src/lib/productPolish.ts`
- `src/lib/productRecommendations.ts`
- `src/navigation/incomingLinks.ts`
- `src/privacy/AiConsentProvider.test.tsx`
- `src/privacy/AiConsentProvider.tsx`
- `src/privacy/consentClient.test.ts`
- `src/privacy/consentClient.ts`
- `website/app/privacy/page.tsx`
- `website/lib/privacyPolicy.ts`


## Canonical contact follow-up

Owner-selected Beta 1 values are now configured in `AURA_PUBLIC_DETAILS` in `shared/privacyPolicy.ts` and its generated website copy:

- Privacy: https://aura-kasatlabs.vercel.app/privacy
- Terms: https://aura-kasatlabs.vercel.app/terms
- Support and privacy email: support@getaura.app

Privacy remains bundled in AURA, with optional public-policy, terms and email links. Onboarding and account-deletion settings expose the same privacy/support route; existing Welcome, auth, consent and Profile access is preserved. Website policy/support/terms/deletion pages use the canonical email rather than an environment override. Release metadata, support instructions and privacy-answer drafts use the supplied values.

The earlier local-browser screenshot shows the pre-contact-update page; it is not verification of these public URLs. Public accessibility and mailbox receipt remain **unverified**. No publication, email transmission, native build or production mutation occurred. This configuration does not close the privacy release gate; overall beta remains **NO-GO**.


Contact follow-up validation: app `npm run typecheck` PASS; `npm test -- --runInBand src/privacy/AiConsentProvider.test.tsx src/auth/useAuthRouting.test.tsx` PASS (2 suites, 21 tests); app `npm run lint` PASS with the same 9 existing warnings. Website `npm run typecheck`, `npm run lint`, `npm run build` PASS. Policy-copy synchronization and `git diff --check` PASS. The additional regression verifies the bundled policy remains visible when opening the canonical public URL fails. No new native runtime or public-service verification is claimed.

Contact follow-up files: `shared/privacyPolicy.ts`, generated `PRIVACY_POLICY.md` and `website/lib/privacyPolicy.ts`; `src/privacy/AiConsentProvider.tsx` and its test; `app/(onboarding)/index.tsx`; `src/profile/screens.tsx`; `website/lib/site.ts`, `website/app/privacy/page.tsx`, `website/.env.example`, `website/DEPLOYMENT.md`; `APP_STORE_PRIVACY_ANSWERS.md`, `APP_STORE_CONNECT_BETA_METADATA.md`, `TESTFLIGHT_BETA_REVIEW_NOTES.md`, `TERMS_OF_USE.md`, `SUPPORT_AND_FEEDBACK.md`, and both readiness/implementation reports. Contact-only edits do not change the AI consent scope/version.
