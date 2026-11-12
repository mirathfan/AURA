import { assertMediaAttachable } from "./mediaSafety";
import { createHash, randomUUID } from "node:crypto";
import { DocumentSnapshot, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { assertActiveInTransaction } from "./accountLifecycle";
import { aiConsentRef, consentRequired } from "./aiConsent";
import { cleanItemMedia } from "./itemLifecycle";
import { isCurrentAiConsent } from "../../../shared/aiConsent";

export const INGESTION_LEASE_MS = 10 * 60_000; // longer than the 240s worker deadline
export class IngestionStopped extends Error {
  constructor() { super("Ingestion no longer owns this item."); }
}
export function ingestionSourceIdentity(data: FirebaseFirestore.DocumentData) {
  const photos = data.photos ?? {};
  return createHash("sha256").update(JSON.stringify([
    data.ingestionSource ?? null, data.images ?? null, data.photoUrl ?? null,
    data.originalImageUrl ?? null, data.cleanedImageUrl ?? null, data.photoUri ?? null,
    ...["images", "urls", "aiUrl", "cleanedUrl", "cleanedPhotoUrl", "normalizedUrl", "originalUrl", "primaryUrl"].map((key) => photos[key] ?? null),
  ])).digest("hex");
}
export function ingestionItemActive(data: FirebaseFirestore.DocumentData) {
  return !["deleted", "candidate"].includes(data.itemLifecycleStatus) &&
    !["cancelled", "awaiting_confirmation"].includes(data.draftState);
}
export type IngestionLease = {
  uid: string; itemId: string; createdAt: Timestamp; runId: string;
  revision: number; expiresAt: number; source: string; baseline: FirebaseFirestore.DocumentData;
};
function itemFence(uid: string, itemId: string) {
  return getFirestore().doc(`users/${uid}/itemDeletionJobs/${itemId}`);
}
// Early failures and claim compare the snapshot INSIDE the committing transaction.
// They cannot create a missing record or operate on another creation/update.
export async function mutateCurrentIngestionItem(snapshot: DocumentSnapshot, patch: FirebaseFirestore.DocumentData) {
  const uid = snapshot.ref.path.split("/")[1];
  return snapshot.ref.firestore.runTransaction(async (tx) => {
    await assertActiveInTransaction(tx, uid);
    const [current, fence] = await tx.getAll(snapshot.ref, itemFence(uid, snapshot.id));
    if (!current.exists || !current.createTime || fence.exists || (!snapshot.updateTime || !current.updateTime?.isEqual(snapshot.updateTime)) || !ingestionItemActive((current.data() ?? {}))) return false;
    await assertMediaAttachable(tx, uid, patch);
    tx.update(snapshot.ref, patch);
    return true;
  });
}
export async function claimIngestion(snapshot: DocumentSnapshot, patch: FirebaseFirestore.DocumentData): Promise<IngestionLease | null> {
  const uid = snapshot.ref.path.split("/")[1];
  const runId = randomUUID();
  return snapshot.ref.firestore.runTransaction(async (tx) => {
    await assertActiveInTransaction(tx, uid);
    const [current, fence, consent] = await tx.getAll(snapshot.ref, itemFence(uid, snapshot.id), aiConsentRef(uid));
    if (!current.exists || !current.createTime || fence.exists || (!snapshot.updateTime || !current.updateTime?.isEqual(snapshot.updateTime)) || !ingestionItemActive((current.data() ?? {}))) return null;
    if (!isCurrentAiConsent(consent.data()) || !(consent.get("updatedAt") instanceof Timestamp)) throw consentRequired();
    const data = (current.data() ?? {});
    const status = data.ingestion?.status ?? data.ingestionStatus;
    if (status === "done" || (status === "processing" && (data.ingestion?.startedAt?.toMillis?.() ?? data.ingestion?.startedAt ?? 0) > Date.now() - INGESTION_LEASE_MS)) return null;
    await assertMediaAttachable(tx, uid, patch);
    tx.update(snapshot.ref, { ...patch, ingestion: { ...patch.ingestion, runId,
      recoverAt: Timestamp.fromMillis(Date.now() + INGESTION_LEASE_MS) } });
    return { uid, itemId: snapshot.id, createdAt: current.createTime, runId,
      revision: consent.get("revision"), expiresAt: Date.now() + INGESTION_LEASE_MS, source: ingestionSourceIdentity(data), baseline: { ...data, ...patch } };
  });
}
// The callback is pure: it executes again if a concurrent edit retries the transaction.
export async function withIngestionItem(lease: IngestionLease, build?: (current: DocumentSnapshot) => FirebaseFirestore.DocumentData | undefined) {
  const db = getFirestore();
  const ref = db.doc(`users/${lease.uid}/items/${lease.itemId}`);
  return db.runTransaction(async (tx) => {
    await assertActiveInTransaction(tx, lease.uid);
    const [current, fence, consent] = await tx.getAll(ref, itemFence(lease.uid, lease.itemId), aiConsentRef(lease.uid));
    const data = current.data();
    if (!data || Date.now() >= lease.expiresAt || fence.exists || !current.createTime?.isEqual(lease.createdAt) ||
      data.ingestion?.runId !== lease.runId || data.ingestion?.status !== "processing" ||
      !ingestionItemActive(data) || ingestionSourceIdentity(data) !== lease.source) throw new IngestionStopped();
    if (!isCurrentAiConsent(consent.data()) || !(consent.get("updatedAt") instanceof Timestamp) || consent.get("revision") !== lease.revision) throw consentRequired();
    const patch = build?.(current);
    if (patch) {
      // Keep ANY field changed since the claim, not only a hand-maintained set
      // of the most common user edits. Worker state still transitions atomically.
      for (const key of Object.keys(patch)) {
        if (["ingestion", "ingestionStatus", "updatedAt"].includes(key)) continue;
        if (JSON.stringify(data[key]) !== JSON.stringify(lease.baseline[key]) ||
          (Array.isArray(data.userEditedFields) && data.userEditedFields.includes(key))) delete patch[key];
      }
      if (["category", "subCategory"].some((key) => JSON.stringify(data[key]) !== JSON.stringify(lease.baseline[key]))) {
        delete patch.category;
        delete patch.subCategory;
      }
      // Keep cleanup/recovery scheduled until generated media has been reconciled.
      if (patch.ingestion) patch.ingestion.recoverAt = Timestamp.fromMillis(Date.now() + INGESTION_LEASE_MS);
      await assertMediaAttachable(tx, lease.uid, patch);
      tx.update(ref, patch);
    }
    return true;
  });
}
export async function recoverStalledIngestion() {
  const db = getFirestore();
  const due = await db.collectionGroup("items").where("ingestion.recoverAt", "<=", Timestamp.now()).orderBy("ingestion.recoverAt").limit(10).get();
  for (const entry of due.docs) {
    const parts = entry.ref.path.split("/");
    if (parts.length !== 4 || parts[0] !== "users") continue;
    const processingRun = entry.get("ingestion.status") === "processing" && ingestionItemActive(entry.data()) && Number(entry.get("ingestion.attempt") ?? 0) < 8 ? entry.get("ingestion.runId") : undefined;
    const cleaned = await cleanItemMedia(parts[1], entry.id, true, processingRun, entry.get("ingestion.mediaCursor"));
    await db.runTransaction(async (tx) => {
      await assertActiveInTransaction(tx, parts[1]);
      const current = await tx.get(entry.ref);
      if (!current.exists || (!entry.updateTime || !current.updateTime?.isEqual(entry.updateTime))) return;
      const processing = current.get("ingestion.status") === "processing" && ingestionItemActive((current.data() ?? {}));
      const exhausted = Number(current.get("ingestion.attempt") ?? 0) >= 8;
      tx.update(entry.ref, processing && !exhausted ? {
        // A normal item event reclaims this expired run; the old run loses its
        // lease when that claim commits. No provider call in this scheduler.
        "ingestion.mediaCursor": cleaned.next ?? FieldValue.delete(),
        "ingestion.startedAt": Timestamp.fromMillis(0),
        "ingestion.recoverAt": Timestamp.fromMillis(Date.now() + INGESTION_LEASE_MS),
        updatedAt: Date.now(),
      } : {
        "ingestion.mediaCursor": cleaned.next ?? FieldValue.delete(),
        "ingestion.recoverAt": !cleaned.next ? FieldValue.delete() : Timestamp.fromMillis(Date.now() + INGESTION_LEASE_MS),
        ...(processing ? { "ingestion.status": "failed", ingestionStatus: "failed", "ingestion.canRetry": true, "ingestion.errorCode": "attempts_exhausted" } : {}),
      });
    }).catch((error) => { if (error?.details?.code !== "ACCOUNT_DELETING") throw error; });
  }
}
