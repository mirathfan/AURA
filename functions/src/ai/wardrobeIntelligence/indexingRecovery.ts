import { randomUUID } from "node:crypto";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { assertActiveInTransaction, isAccountDeleting } from "../../shared/accountLifecycle";
import { aiConsentRef, runWithAiConsentScope, setAiConsentUser } from "../../shared/aiConsent";
import { isCurrentAiConsent } from "../../../../shared/aiConsent";
import { assertFunctionRateLimit, RATE_LIMITS } from "../../shared/rateLimit";
import { buildClosetItemIntelligenceInput, indexClosetItemIntelligence } from "./indexClosetItem";
import { isIndexableClosetItemState } from "./skip";
import { INDEXING_CONCURRENCY, INDEXING_LEASE_MS, INDEXING_MAX_ATTEMPTS, INDEXING_SWEEP_LIMIT, indexingFailure, indexingRetryDelay } from "./indexingPolicy";
import type { ClosetItemDocument } from "./types";

export const INDEXING_JOBS = "wardrobeIndexJobs";
function references(uid: string, itemId: string) {
  if (!uid || !itemId || uid.includes("/") || itemId.includes("/")) throw new HttpsError("invalid-argument", "Invalid item.");
  const db = getFirestore();
  return { db, item: db.doc(`users/${uid}/items/${itemId}`), job: db.doc(`users/${uid}/${INDEXING_JOBS}/${itemId}`),
    slots: db.doc("functionRateLimits/wardrobeIndexing") };
}
function complete(item: ClosetItemDocument, hash: string) {
  return item.embeddingHash === hash && Boolean(item.embeddingVector);
}
const cleared = { dueAt: FieldValue.delete(), lease: FieldValue.delete() };

// Always read the current item: event payloads may be duplicated or out of order.
// Jobs contain hashes/status only, never embedding inputs, vectors or provider errors.
export async function enqueueIndexing(uid: string, itemId: string, options: { retryTerminal?: boolean; now?: number } = {}) {
  const { db, item, job } = references(uid, itemId);
  const now = options.now ?? Date.now();
  return db.runTransaction(async (tx) => {
    await assertActiveInTransaction(tx, uid);
    const [source, previous, consent] = await tx.getAll(item, job, aiConsentRef(uid));
    if (!source.exists) { if (previous.exists) tx.delete(job); return "missing"; }
    const current = source.data() as ClosetItemDocument;
    const hash = buildClosetItemIntelligenceInput(current).embeddingHash;
    const approved = isCurrentAiConsent(consent.data()) && consent.get("updatedAt") instanceof Timestamp;
    const revision = Number(consent.get("revision") ?? 0);
    const same = previous.get("hash") === hash && previous.get("revision") === revision &&
      source.createTime?.isEqual(previous.get("itemCreatedAt"));
    const eligible = isIndexableClosetItemState(current);
    const done = eligible && approved && complete(current, hash);
    const blocked = !eligible || !approved;
    const reason = !eligible ? "item_ineligible" : !approved ? "consent_required" : null;
    if (done || blocked) {
      const state = done ? "completed" : "terminal_failure";
      if (same && previous.get("state") === state && previous.get("reason") === reason) return state;
      tx.set(job, { hash, revision, itemCreatedAt: source.createTime, state, reason, attempts: same ? previous.get("attempts") : 0,
        updatedAt: Timestamp.fromMillis(now), recoveryCycles: same ? previous.get("recoveryCycles") ?? 0 : 0 });
      return state;
    }
    if (same) {
      // Duplicate events, unrelated edits and reconciliation never reset attempts.
      if (!["terminal_failure", "completed"].includes(previous.get("state"))) return String(previous.get("state"));
      if (previous.get("state") === "terminal_failure" && previous.get("reason") !== "item_ineligible" &&
        (!options.retryTerminal || Number(previous.get("recoveryCycles") ?? 0) >= 1)) return "terminal_failure";
    }
    tx.set(job, { state: "pending", hash, revision, itemCreatedAt: source.createTime, attempts: 0,
      recoveryCycles: same ? Number(previous.get("recoveryCycles") ?? 0) +
        (previous.get("state") === "terminal_failure" && previous.get("reason") !== "item_ineligible" ? 1 : 0) : 0,
      dueAt: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now), reason: null });
    return "pending";
  });
}

type WorkerOptions = { now?: () => number; random?: () => number; createEmbedding?: (text: string) => Promise<number[]> };
export async function processIndexingJob(uid: string, itemId: string, options: WorkerOptions = {}) {
  return runWithAiConsentScope(async () => {
    setAiConsentUser(uid);
    const clock = options.now ?? Date.now;
    const random = options.random ?? Math.random;
    const { db, item, job, slots } = references(uid, itemId);
    const lease = randomUUID();
    let slot: string | undefined;
    try {
      await enqueueIndexing(uid, itemId, { now: clock() });
      const claim = await db.runTransaction(async (tx) => {
        await assertActiveInTransaction(tx, uid);
        const [task, source, consent, capacity] = await tx.getAll(job, item, aiConsentRef(uid), slots);
        const now = clock();
        const data = task.data();
        if (!data?.dueAt || data.dueAt.toMillis() > now || !source.exists) return null;
        if (!isCurrentAiConsent(consent.data()) || consent.get("revision") !== data.revision) return null;
        const current = source.data() as ClosetItemDocument;
        if (!isIndexableClosetItemState(current) || buildClosetItemIntelligenceInput(current).embeddingHash !== data.hash ||
          !source.createTime?.isEqual(data.itemCreatedAt)) return null;
        if (data.attempts >= INDEXING_MAX_ATTEMPTS) {
          tx.update(job, { state: "terminal_failure", reason: "attempts_exhausted", ...cleared });
          return null;
        }
        const leases = capacity.get("leases") ?? {};
        const available = Array.from({ length: INDEXING_CONCURRENCY }, (_, i) => String(i))
          .find((key) => !leases[key] || leases[key].until.toMillis() <= now);
        if (available === undefined) return null;
        const until = Timestamp.fromMillis(now + INDEXING_LEASE_MS);
        tx.set(slots, { leases: { [available]: { lease, until } } }, { merge: true });
        tx.update(job, { state: "processing", lease, attempts: data.attempts + 1, dueAt: until, updatedAt: Timestamp.fromMillis(now) });
        return { slot: available, source: current, createdAt: source.createTime, revision: data.revision as number, attempts: data.attempts + 1 };
      });
      if (!claim) return;
      slot = claim.slot;
      try {
        // Every dispatch consumes the existing quota. Local quota waits are not
        // provider attempts and are deferred directly to the exhausted window.
        await assertFunctionRateLimit(uid, "wardrobeIndexing", RATE_LIMITS.wardrobeIndexing, clock());
        const validLease = async (tx: FirebaseFirestore.Transaction) => {
          const [task, capacity] = await tx.getAll(job, slots);
          return task.get("lease") === lease && task.get("dueAt")?.toMillis() > clock() &&
            capacity.get(`leases.${slot}.lease`) === lease;
        };
        // Check again after quota/contention before starting the network request.
        const valid = await db.runTransaction(async (tx) => {
          await assertActiveInTransaction(tx, uid);
          const latest = await tx.get(item);
          return latest.exists && latest.createTime?.isEqual(claim.createdAt) &&
            isIndexableClosetItemState(latest.data() ?? {}) &&
            buildClosetItemIntelligenceInput(latest.data() ?? {}).embeddingHash === buildClosetItemIntelligenceInput(claim.source).embeddingHash &&
            await validLease(tx);
        });
        if (!valid) return;
        const result = await indexClosetItemIntelligence({ itemId, item: claim.source, ref: item,
          itemCreatedAt: claim.createdAt, consentRevision: claim.revision, createEmbedding: options.createEmbedding,
          commitGuard: validLease,
          onCommitted: (tx) => tx.update(job, { state: "completed", reason: null, updatedAt: Timestamp.fromMillis(clock()), ...cleared }),
        });
        if (result.status === "skipped") await enqueueIndexing(uid, itemId, { now: clock() });
      } catch (error) {
        if (isAccountDeleting(error)) return;
        const failure = indexingFailure(error);
        const quotaAt = Number((error as { details?: { retryAt?: number } })?.details?.retryAt);
        const quota = failure.code === "quota" && Number.isFinite(quotaAt);
        await db.runTransaction(async (tx) => {
          await assertActiveInTransaction(tx, uid);
          const task = await tx.get(job);
          if (task.get("lease") !== lease) return;
          const terminal = failure.terminal || (!quota && claim.attempts >= INDEXING_MAX_ATTEMPTS);
          tx.update(job, { state: terminal ? "terminal_failure" : "retryable_failure",
            reason: terminal && !failure.terminal ? "attempts_exhausted" : failure.code,
            attempts: claim.attempts - (quota ? 1 : 0), lease: FieldValue.delete(), updatedAt: Timestamp.fromMillis(clock()),
            dueAt: terminal ? FieldValue.delete() : Timestamp.fromMillis(quota ? Math.max(clock(), quotaAt) + Math.floor(random() * 10_000) : clock() + indexingRetryDelay(claim.attempts, random())),
          });
        });
      }
    } catch (error) {
      if (!isAccountDeleting(error)) throw error; // delivery/recovery retries failures to persist work
    } finally {
      if (slot !== undefined) {
        // A deleted account must not recreate data to release a slot. Its opaque
        // global lease expires naturally; no UID is retained in this document.
        await db.runTransaction(async (tx) => {
          await assertActiveInTransaction(tx, uid);
          const capacity = await tx.get(slots);
          if (capacity.get(`leases.${slot}.lease`) === lease) tx.update(slots, { [`leases.${slot}`]: FieldValue.delete() });
        }).catch((error) => { if (!isAccountDeleting(error)) throw error; });
      }
    }
  });
}

// Invoked by the existing P1-04 five-minute scheduler. No sleeping retries,
// second scheduler, Cloud Tasks service, or per-item event-triggered AI fan-out.
export async function recoverWardrobeIndexing(options: WorkerOptions = {}) {
  const now = (options.now ?? Date.now)();
  const due = await getFirestore().collectionGroup(INDEXING_JOBS)
    .where("dueAt", "<=", Timestamp.fromMillis(now)).orderBy("dueAt").limit(INDEXING_SWEEP_LIMIT).get();
  const tasks = [...due.docs];
  let failures = 0;
  await Promise.all(Array.from({ length: INDEXING_CONCURRENCY }, async () => {
    let next;
    while ((next = tasks.shift())) {
      const parts = next.ref.path.split("/");
      if (parts.length !== 4 || parts[0] !== "users" || parts[2] !== INDEXING_JOBS) continue;
      try { await processIndexingJob(parts[1], parts[3], options); } catch { failures += 1; }
    }
  }));
  if (failures) throw new Error("Indexing recovery persistence failed; due jobs remain recoverable.");
  return due.size;
}
