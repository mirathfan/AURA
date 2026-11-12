# P1-05 — Wardrobe indexing reliability and recovery

**Local implementation and automated validation: PASS. Release sign-off: FAIL / pending approved deployment and runtime verification. External beta: NO-GO.**

Reviewed October 10, 2026 against revision `06ece001c69cb6a84787cebddd521f883ffccb66` plus the existing dirty working tree, including P1-02, P1-03 and P1-04. Evidence and the before/after file manifest are in `../../qa-artifacts/indexing-recovery-2026-10-10/`. No live data, deployment, push, EAS build, submission or paid provider call was used. SDK 54, Xcode 26.0, cards, flatlays, disabled Photo Refinement and client UI are unchanged.

## Confirmed failure paths and pipeline

1. Photo ingestion persists structured fields and `ingestionStatus: done`. Manual and retailer changes also write `users/{uid}/items/{itemId}`. The intelligence trigger previously used event snapshots, checked consent/quota, called an embedding helper, and caught/logged all failures. It acknowledged rate-limit/provider failures with no durable retry or reconciliation record. Consent resumption writes up to 50 items per page; an accepted wardrobe could immediately exceed 10/minute indexing capacity.
2. Backfill loops called the embedding helper directly, under only the backfill invocation quota. Per-item indexing quota was absent in those loops. The embedding helper's own retries were layered over the OpenAI SDK's default retries, so a single quota reservation could dispatch several requests.
3. The prior completion transaction already protected account deletion, item existence, eligibility and input hash. It did not serialize the final write with consent revocation, pin the item's creation identity, or atomically record recovery completion. A deleted and recreated same-ID/same-content item needed a creation-time guard.
4. Hash-matched legacy `embeddingRaw` could be treated as indexed even without the Firestore vector field actually used by nearest-neighbor retrieval.
5. Normal role retrieval in `outfitContext.ts`, reached from the styling agent's retrieval node, used only vector candidates. The public retrieval callable did likewise. The existing singular result builder supported structured scoring with `requireEmbedding: false` (used for selected items), but ordinary role retrieval did not supply unindexed candidates. Thus vector delay could become an apparent missing wardrobe role.

The new pipeline is: item write → guarded durable reconciliation → scheduled lease claim → current consent/quota/content checks → one embedding transmission → transactional consent/content/creation/lease check → vector and completed job committed together → vector plus structured styling retrieval.

## Durable lifecycle and reuse of P1-04

P1-04 was inspected first. Its deletion fence, expiring leases, `dueAt` recovery convention and **existing five-minute `recoverAccountDeletions` schedule** are reused. That function now runs bounded deletion and indexing sweeps independently with `Promise.allSettled`; one failure does not prevent the other sweep from starting. Its deployed name is preserved. No second Scheduler job, Cloud Tasks queue, new dependency or generic workflow framework is introduced.

- New per-item records: `users/{uid}/wardrobeIndexJobs/{itemId}`. States: `pending`, `processing`, `completed`, `retryable_failure`, `terminal_failure`.
- Fields contain input hash, consent revision, item creation timestamp, attempt count, recovery-cycle count, status/reason, timestamps and an opaque lease. No prompt, name, image URL, vector, token or raw exception is copied into the job. Owner-only reads permit inspection; client writes and cross-user reads are denied. Normal account recursive deletion removes jobs.
- Every event reconciles the **current** item inside a deletion-fenced transaction. Duplicate/out-of-order events cannot restore stale work. Generated-field-only events do not create a trigger loop. Missing items remove their jobs. The trigger has retry enabled and propagates persistence failures, rather than acknowledging failed enqueue operations. Account-deletion events are intentionally stopped.
- Job identity combines current content/configuration hash, consent revision and item creation timestamp. Unrelated writes and duplicate events preserve attempts. New content, a new consent revision, or a newly created item starts a new budget. Ineligible/consent-denied items have explicit terminal reasons without external work; current acceptance/readiness can resume eligible work.
- A worker atomically claims one job and one of four global slots with a two-minute lease. Slot state lives in the existing `functionRateLimits/wardrobeIndexing` document; it contains only slot numbers, random lease identifiers and expiry, not UIDs. The scheduler also has `maxInstances: 1`, `concurrency: 1`; the worker pool is four. Global leases protect overlapping invocations/test workers. Other AI features are outside this indexing-specific concurrency control; there was no existing shared indexing semaphore to preserve.
- A killed worker leaves a due timestamp. Later sweeps reclaim it; each claim counts against eight maximum attempts. A successful vector and job completion share one transaction. A later redelivery finds the equivalent persisted vector and does not dispatch another embedding. A matching `embeddingRaw` alone is insufficient.
- The schedule reads at most **40 due jobs per invocation**, ordered by due time, and processes four concurrently. Terminal/completed jobs have no `dueAt`, so they are not polled indefinitely. An individual failure leaves recoverable state and does not halt unrelated items. Persistence failure leaves the existing lease/due timestamp for the next sweep and causes a generic scheduler failure for operational visibility.

## Quotas, retry limits and cost protections

Existing paid quotas are unchanged: **10 indexing reservations per fixed minute and 50 per fixed UTC day per UID**. No increase is authorized or implemented.

- All actual item embedding work, including backfill/manual recovery, runs through this worker and quota. Reservations are conservative: an attempt that fails after reservation can consume quota without a completed embedding.
- Each indexing dispatch disables both helper retries and SDK retries. Provider timeout is 20 seconds. Transient provider/network/429/storage errors get exponential equal-jitter backoff: initially 30–60 seconds, capped at 30–60 minutes. The five-minute scheduler rounds actual servicing upward. No billed sleeping invocation is used.
- Local quota denial is **not** a provider attempt: it restores that attempt count and schedules directly after the latest exhausted window plus up to ten seconds of jitter. This avoids polling every minute for an exhausted daily budget and permits 100-item wardrobes across daily windows. Provider 429s count as attempted transmissions and use bounded backoff.
- Eight failed/crashed attempts end in an inspectable terminal record. Ordinary events/reconciliation do not reopen exhausted work. An authenticated explicit `force: true` recovery may open **one additional eight-attempt cycle for the same input/revision**; repeated force requests cannot loop forever. Content changes/reacceptance are separately authorized input changes; daily quota still bounds all work.
- The existing `wardrobeBackfill` limit (one/minute, one/day) also protects manual reindex/reconciliation callables. Backfill dry runs remain local previews. Non-dry backfills enqueue and report `queued`/`totalQueued`, not false synchronous indexing success. `force` no longer recomputes an already valid equivalent vector.
- The fast-provider test processes ten items per sweep per user; the hard limits are ten reservations per fixed minute and 40 global jobs per sweep. A sweep spanning a minute boundary can reserve more than ten for one user. Initial service latency is up to five minutes plus processing/backlog. Fifty successful items consume an entire day's quota; failed attempts may require more windows. A 100-item burst requires at least two daily windows. These are limits, not a production latency SLA or a promise of success during a continuing outage.
- Baseline indexing overhead is one bounded collection-group query per five-minute tick (288/day), without creating another scheduler. Enqueue normally reads fence/item/job/consent and writes one changed job. A successful attempt adds claim/preflight/quota/consent/commit/release reads and about eight writes across job, slot, quota and item records; transaction retries/listeners add reads. Up to 40 jobs are considered per tick (11,520/day globally), not an unbounded scan. Backlog can fill that bound. Account churn and unrestricted manual item creation still need the broader app-attestation/abuse gate; this does not set an account-wide project billing cap.

## Consent, deletion and races

The worker creates a fresh AsyncLocalStorage consent scope per trusted path UID; concurrent users cannot share it. Job payloads cannot select another UID, item path, provider key or input text.

- Enqueue and claim read current consent; dispatch pins its revision. Existing P1-03 transport rechecks consent and the deletion fence immediately before transmission, watches revocation/deletion while receiving, and checks completion. No client boolean is used.
- Before starting the network request, the worker rechecks lease, current item existence/readiness/content and creation identity after quota reservation. Final persistence reads the consent document and deletion fence **in the committing transaction**, and requires the captured revision, current input hash, item creation identity and current unexpired lease. Concurrent revocation/fence creation and these writes serialize.
- A queued revoke/decline/outdated decision cannot dispatch. An already-returned embedding cannot be saved after revocation. New acceptance is a different revision, so an old response does not inherit it. Deleted items/accounts cannot be recreated by completion; delete/recreate under the same item ID does not accept the former item's result.
- A deleted account does not write a global lease release through the fence; the anonymous slot expires. User jobs are removed by P1-04 recursive cleanup, and its permanent account tombstone remains authoritative.
- No transaction can atomically encompass Firestore plus OpenAI. Data already transmitted before a revocation/edit cannot be recalled; cancellation is best effort. A process pause immediately after the last check can race a change, but final persistence remains fenced. If a request succeeds and the process loses its response or crashes before the atomic commit, a retry can incur another provider call. The implementation promises idempotent persisted results and bounded attempts, **not exactly-once external billing**. No extra persisted vector cache is introduced to pretend that network ambiguity disappears.
- Global slots bound current valid leases. A previously dispatched request might still execute at the provider after local timeout/lease expiry; four leases are not proof of an absolute provider-side concurrency bound under arbitrary process suspension or ignored cancellation. Verify deployed timeouts, cancellation and overlapping Scheduler delivery.

## Styling behavior

`hybridRetrieval.ts` reads the authenticated owner's structured item collection and merges vector results by item ID. Current valid vector distances retain existing scoring. Unindexed/outdated items use the existing deterministic metadata normalizer, readiness/availability filters, category/color/style filters and scoring function, with `vectorScore: null`. Stale AI metadata is not overlaid onto edited structured inputs. A vector hit absent from the current owned snapshot is discarded.

Provider/query-vector or vector-index unavailability falls back to structured candidates; consent/deletion errors are propagated. Ownership remains `users/{authenticated uid}/items`, with selected-item validation and outfit scoring unchanged. No outfit UI, card or flatlay code changed.

The structured scan is capped at **500 documents per retrieval** (501 read for overflow detection). Overflow fails explicitly rather than inferring absence from a truncated wardrobe. Each requested outfit role currently performs its own bounded scan, so multi-role generation adds Firestore reads; production latency/read costs and wardrobes above this bound remain limitations. A wider paging/cache design is intentionally not included in this small recovery change.

## Changed files

The task-specific hash comparison (not the much larger existing Git diff) identifies these files:

- Recovery and provider path: `functions/src/ai/wardrobeIntelligence/indexingPolicy.ts`, `indexingRecovery.ts`, `triggers.ts`, `indexClosetItem.ts`, `embeddings.ts`, `callables.ts`.
- Shared scheduling/quota: `functions/src/deleteAccountData.ts`, `functions/src/shared/rateLimit.ts`.
- Retrieval: `functions/src/ai/wardrobeIntelligence/hybridRetrieval.ts`, `outfitContext.ts`, `retrieval.ts`, `retrievalCallables.ts`.
- Security/index configuration: `firestore.rules`, `firestore.indexes.json`.
- Regression coverage: `functions/src/ai/wardrobeIntelligence/__tests__/indexingRecovery.test.ts`, `indexClosetItem.test.ts`, `scripts/test-indexing-recovery.cjs`.
- Reports: this file and `docs/TESTFLIGHT_READINESS_2026-10-09.md`.

All original files remain. Package/lockfiles, app/native/EAS configuration, authentication/privacy/deletion UI, website, styling decision algorithms and visual components match the starting snapshot. Existing P1-04 fences are preserved while its scheduler is extended. No user changes were reset.

## Recovery and operational inspection

No global historical migration runs on deployment. Existing items are recovered through consent resumption, a new normal edit, or authenticated existing backfill callables:

- `backfillWardrobeIntelligence({limit: 100, cursor, dryRun: true})` previews a page. Non-dry calls enqueue the current eligible items, return `queued`, `hasMore`, `nextCursor`, and never exceed that user's existing daily backfill invocation budget.
- `backfillWardrobeIntelligenceAll({dryRun: false})` reconciles at most 300 items. Its `capped` result signals larger wardrobes; use the paginated callable with retained cursors on later quota windows. It is not a whole-project scanner.
- `reindexClosetItem({itemId, force: true})` can reopen a terminal item once per input/revision after the cause is fixed. It uses the same backfill quota and reports durable state. Existing in-repo app code has no synchronous reindex/backfill response consumer; any external admin tooling must adapt to queued responses.
- Authorized operators may inspect state/reason/attempts/dueAt/recoveryCycles using owner-scoped job reads. Do not export item data, embedding text or private provider logs for diagnostics. A `terminal_failure` has no automatic further provider spend; after the extra cycle is exhausted, investigate configuration/input rather than deleting counters/jobs blindly. No production replay occurred.
- Monitor old due jobs, terminal counts, Scheduler/trigger failures, quota waits and transaction contention. Missing enqueue events beyond Eventarc retention require the bounded reconciliation callable. Persistent cloud/IAM outage can prevent progress; durable state is a recovery mechanism, not a substitute for operational alerting.

## Deployment prerequisites — approval still required

1. Deploy the `wardrobeIndexJobs.dueAt` ascending **collection-group index** in `firestore.indexes.json`, preserving existing ordinary/vector indexes. Deploy rules for owner-only job reads and denied client writes. The emulator does not certify production index readiness.
2. Deploy the changed indexing trigger, reindex/backfill/retrieval/outfit/agent code and the updated existing `recoverAccountDeletions` scheduler together with the prior consent/deletion safeguards. Drain old trigger/callable revisions so inline old workers cannot bypass queue quota/global slots. Do not treat this as a production rollout plan already executed.
3. Grant the scheduled function access to the existing `OPENAI_API_KEY` Secret Manager secret, plus its current Firestore permissions. No new provider key, Cloud Tasks service, queue IAM role or Scheduler resource is needed. Existing Scheduler invocation/Eventarc permissions and P1-04 Storage cross-service IAM remain required. Confirm the scheduled function's region, max instance/concurrency settings and five-minute delivery in a deployed nonproduction project.
4. Costs are existing Scheduler/function/Eventarc/Secret Manager charges plus new Firestore job/lease/index reads, writes and retained job storage, and quota-limited provider work. Jobs remain one per live item; item deletion removes them, account deletion recursively removes them. The global four-slot map is overwritten/released and retains no UID. Avoid TTL-deleting live recovery records; do not change P1-04 permanent tombstone retention.
5. Obtain approval for any historical replay and production deployment. Validate provider quota/latency, transaction contention, simultaneous-user fairness, real Scheduler retries and operational alerts in staging before external beta. Large or sustained backlogs increase wait times even with per-user quotas intact.

Firebase documents that event ordering is not guaranteed and events can be delivered more than once, which motivates current-state reconciliation and transactional claims ([Firestore triggers](https://firebase.google.com/docs/functions/firestore-events)). Scheduled functions use Cloud Scheduler and carry billing/configuration requirements ([scheduled functions](https://firebase.google.com/docs/functions/schedule-functions)); collection-group query indexes must be deployed and ready ([index management](https://firebase.google.com/docs/firestore/query-data/indexing)). Local emulator success does not verify those deployed services.

## Validation results

All emulator records are synthetic in `demo-aura-beta`, with loopback endpoint guards. Provider HTTP is blocked or replaced by synthetic responses. Burst tests advance a logical clock through real emulator transactions and quotas; they are not real-time/day-long production load tests. Trigger handlers and scheduled recovery helpers are invoked directly, not through deployed Eventarc/Scheduler.

| Check | Observed result |
|---|---|
| Client Jest | PASS — 47 suites / 256 tests |
| Backend Jest | PASS — 36 suites / 369 tests, including eight new policy/structured-retrieval cases |
| Firebase emulators | PASS — **22 indexing + 18 deletion + 12 consent + 19 beta-security = 71 checks** |
| App TypeScript / lint | PASS; nine pre-existing lint warnings, no errors |
| Backend TypeScript/build / lint | PASS; no lint warnings/errors |
| Deterministic intelligence checks | PASS — 84/84 |
| Established styling evaluation gate | PASS — 30/30, standard 8 and hard 22; no critical failures, hallucination or vector leakage; no LLM judge |
| Local production iOS JS/Hermes export | PASS; not an Xcode/native build or launch |
| Policy-copy synchronization / diff whitespace | PASS |
| Newly built native / deployed cloud runtime | NOT RUN; not approved by this task |

| Isolated burst | Successful mocked embedding calls | Recovery sweeps | Logical time from first sweep | Result |
|---|---:|---:|---:|---|
| 10 | 10 | 1 | 0 minutes | PASS |
| 25 | 25 | 3 | 10 minutes | PASS |
| 50 | 50 | 5 | 20 minutes | PASS |
| 100 | 100 | 11 | 1,459 minutes (24h 19m) | PASS; two daily quota windows |

Each sweep read at most 40 jobs. Tests inspect real quota documents and assert at most ten reservations in every minute bucket and 50 in every day bucket. Duplicate completion/reconciliation did not dispatch extra embeddings. An additional **two simultaneous 25-item wardrobes** completed with 25 calls each, separate consent revisions and quota records; a controlled provider barrier observed **four simultaneous calls**, never more. Another eight-user concurrent claim test passed. The final log's baseline mock counter/peak excludes the separate controlled multi-user and SDK-transport counters; the `multiUserBurst` record contains the four-call result.

The 22 indexing checks cover missing/declined/revoked/outdated consent and acceptance; temporary 503 outage; 429 and network timeout; duplicate/out-of-order events; killed/expired leases; failure after provider completion before persistence; concurrent edits; item deletion and same-ID recreation; revocation after response before commit; account deletion during work; exhausted attempts and bounded explicit recovery; changed draft eligibility; owner/client/cross-user rules; historical backfill; multi-user claims/bursts; actual installed OpenAI SDK with mocked HTTP proving one dispatch per queued attempt; all four burst sizes; and structured fallback on provider/index unavailability. Existing deletion, provider-boundary, mutation-boundary, authentication and consent suites also pass.

An initial client Jest process exited with code 139 before a suite summary; a complete rerun of the unchanged client passed all 256 tests with exit 0. No native runtime conclusion is drawn from that process failure or rerun. Early emulator runs exposed transaction contention (related reads were consolidated into transactional `getAll`) and a test-bootstrap mismatch: production initializes `ignoreUndefinedProperties`, while the initial standalone harness did not. The final harness matches production initialization; no global production setting or metadata policy was changed to make tests pass. Final raw output is `emulator.log`; intermediate diagnostic output remains separately available. Existing image-library/React test warnings are not treated as new functional failures.

Commands run from the repository unless noted:

```sh
npm test -- --runInBand
npm run typecheck
npm run lint
npm --prefix functions test -- --runInBand
npm --prefix functions run lint
npm --prefix functions run build
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" firebase emulators:exec --project demo-aura-beta --config firebase.beta-test.json --only auth,firestore,storage 'node scripts/test-indexing-recovery.cjs && node scripts/test-account-deletion.cjs && node scripts/test-ai-consent.cjs && node scripts/test-beta-security.cjs'
node scripts/aura-intelligence-eval.cjs
node /Users/athfan/wardrobe-ai/closet/functions/scripts/runAuraEvalGate.cjs
EXPO_NO_TELEMETRY=1 SENTRY_DISABLE_AUTO_UPLOAD=true npx --no-install expo export --platform ios --output-dir /Users/athfan/wardrobe-ai/qa-artifacts/indexing-recovery-2026-10-10/ios-js-export
node scripts/sync-privacy-policy.cjs --check
git diff --check
```

The eval gate's working directory was the evidence folder, to avoid rewriting existing reports. No optional LLM judge was enabled. Website files were unchanged and their build was not rerun for this backend-only follow-up. The evidence folder includes command logs, simulator-targeted JS export, evaluation JSON/Markdown, source revision, task-specific changed-file list and before/after SHA-256 manifests.

## Remaining runtime gates and verdict

No newly built native artifact or physical device was run for P1-05. The local iOS JavaScript export is not a native launch test. Previously successful Xcode 26.0/iOS 26.5/27 evidence predates these changes.

After approved coordinated deployment and a new approved native candidate, test 10/25/50/100-item intake with manual metadata and successful photo ingestion, background/foreground, force quit/relaunch, offline reconnect, quota-reset visibility, provider outage recovery, consent decline/revoke/reaccept on another device, account switching, item edit/delete during work and account deletion during a queue. Confirm unindexed ready items appear in styling and that drafts/unowned/deleted items do not. Real provider/device flows, latency, cloud delivery and all existing release gates remain open. Photo ingestion's separate own quota/retry lifecycle is not replaced by this **eligible-item indexing** queue; pending/failed photo analysis must first reach a ready/indexable state.

| Area | Local automated verdict | Release verdict |
|---|---|---|
| Durable lifecycle, bounded retry and historical recovery | PASS | FAIL / pending deployed delivery, indexes and operational verification |
| Consent, deletion, isolation and stale-result protection | PASS | FAIL / pending coordinated rollout and device/provider races |
| 10/25/50/100 bursts and simultaneous users | PASS with mocked providers/logical time | FAIL / real latency, sustained load and provider quotas unverified |
| Structured fallback and deterministic styling quality | PASS | FAIL / actual provider/device journey remains unverified |
| Overall external beta | **NO-GO** | All outstanding release gates still apply |

**Overall external beta remains NO-GO.**
