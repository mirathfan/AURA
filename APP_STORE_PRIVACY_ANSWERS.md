# App Store Privacy Answers Draft

Draft only. Do not submit without owner/legal review and confirmation of Apple, Firebase, OpenAI, Sentry, SerpApi, and affiliate settings.

## Tracking Recommendation

Recommended answer: **No tracking**, only if the owner confirms no advertising SDKs, no cross-app tracking, and no affiliate provider behavior that qualifies as tracking under Apple's rules. If Skimlinks or another affiliate provider tracks users across apps or websites, the answer may need to change.

## Data Linked To The User

| Category | Draft answer | Purpose | Owner confirmation needed |
|---|---|---|---|
| Contact Info - Email Address | Collected, linked to user | Account creation, sign in, account management | Confirm Firebase Auth provider settings |
| Contact Info - Name | Collected if provided, linked to user | Personalization and account display | Confirm onboarding/profile collection |
| User Content - Photos or Videos | Collected, linked to user | Closet photos, profile photo, AURA image attachments, polished/cutout images | Confirm photo retention and deletion behavior |
| User Content - Other User Content | Collected, linked to user | AURA chat, closet metadata, product links, outfit plans, saved looks, wear history | Confirm all beta features enabled |
| Identifiers - User ID | Collected, linked to user | Firebase UID, security, rate limits, data scoping | Confirm whether any device identifiers are used outside Firebase |
| Diagnostics | Collected, linked or pseudonymously linked | Sentry crash/error diagnostics and Firebase/GCP operational logs | Confirm Sentry project settings and Apple/TestFlight diagnostics |
| Location | Collected if weather/location is enabled | Weather-aware outfit planning | Confirm whether precise lat/lon is used in production |
| Calendars | Collected if calendar access is enabled | Event-aware outfit planning | Confirm calendar event storage is not persisted remotely |
| Audio Data | Collected if voice dictation/transcription is enabled | Speech-to-text for chat | Confirm whether backend transcription is enabled in beta |
| Product Interaction / Other Data | Collected if shopping/search is tracked | Product import, live search, affiliate links, commerce events | Confirm SerpApi and affiliate settings |

## Data Not Linked To The User

Potentially non-user-linked operational metrics may exist through Apple, Firebase, Sentry, or provider dashboards. Owner must confirm dashboard settings before submission.

## Data Used For Tracking

Draft answer: **None**, pending owner confirmation that affiliate links and shopping providers are not used for cross-app/site tracking.

## Not Collected Based On Repo Evidence

- Contacts.
- Health and Fitness.
- Payment Info.
- In-app purchases.
- Advertising identifiers.

## Purposes To Select

Likely purposes:

- App Functionality.
- Account Management.
- Product Personalization.
- Analytics for first-party Firebase launch, feature-use, feedback and commerce events; App Functionality for crash/error diagnostics, using Apple’s current category/purpose choices.

## Items Owner Must Confirm

- Public accessibility of the owner-selected Beta 1 URLs: https://aura-kasatlabs.vercel.app/privacy and https://aura-kasatlabs.vercel.app/terms (support: https://aura-kasatlabs.vercel.app/support); receipt of support/privacy mail at support@getaura.app. Values are selected, not verified.
- Whether live product search is enabled for beta.
- Whether affiliate links are enabled for beta.
- Whether voice dictation uses only on-device/native speech or backend OpenAI transcription.
- Whether calendar events are sent to backend or remain on device.
- Confirm Sentry retention and user association; the hashed Firebase UID is pseudonymous and must not be represented as anonymous.
- Whether TestFlight/Apple diagnostics are enabled outside repo code.

## P1-03 source review — October 10, 2026 (not submitted)

- **Explicit AI consent is optional, but does not make collected data exempt from disclosure.** New and existing accounts default to no AI sharing. Acceptance/revocation records contain an account-scoped status, disclosure version, server timestamp and revision. Include these under Other Data/User ID as appropriate.
- **Usage Data → Product Interaction / Analytics:** Firebase receives first-party launch, authentication, onboarding, feature-use, feedback and commerce events linked to Firebase UID. This is not limited to crash diagnostics and is not proof of Google Analytics SDK collection.
- **User ID / Diagnostics:** Sentry, when configured, receives app/build/device diagnostics and a hashed UID. Treat the identifier as pseudonymous/linked unless the actual project settings and Apple's criteria establish otherwise. `sendDefaultPii=false` is not an anonymity guarantee.
- **User Content:** disclose closet/outfit photos, messages, submitted links, preferences, saved/planned/worn outfits, feedback, and audio when those features are offered. Selected content goes to OpenAI after consent; native speech may use Apple/Google. Wardrobe/style-memory embeddings also contain information derived from user content. Beta 1 Polish is disabled; extraction and layout generation still process images with permission.
- **Location:** the current weather code sends latitude/longitude to Open-Meteo. Review Precise Location, not an assumption of coarse-only data. Weather/context can enter AI prompts after consent.
- **Calendar:** event-derived context may enter styling requests. Do not claim all calendar information remains on-device. Map the actual event content to Apple's available User Content/Other Data categories; the table's “Calendars” row is a data-flow label, not necessarily an App Store Connect category.
- **Shopping/search:** curated ranking is local/deterministic. Optional SerpApi live queries and country/language settings are covered by the disclosure/consent boundary; retailer imports and affiliate navigation also share information with those sites. Confirm production flags, shared search-cache retention and affiliate tracking before answering No Tracking.
- **Body/fit/size:** collected for apparel personalization. Verify precisely which measurements are stored and Apple's applicable Other Data/Health & Fitness definitions; do not rely on the earlier blanket “Health and Fitness not collected” without that review.
- **Retention/deletion:** OpenAI response storage is explicitly disabled in the new transport, but abuse-monitoring retention may still apply. Firebase/Sentry retention settings and deletion recovery remain unverified release gates. Do not claim zero retention or immediate complete provider deletion.

Owner must reconcile these findings against the exact build and deployed backend before changing App Store Connect. No privacy answers were submitted. See [the implementation report](docs/AI_PRIVACY_CONSENT_2026-10-10.md).
