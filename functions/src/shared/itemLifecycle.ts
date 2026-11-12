import { scanUserMedia, retireUnreferencedMedia, removeRetiredUpload } from "./mediaSafety";
import { DocumentSnapshot, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/v2/https";
import { assertActiveInTransaction, isAccountDeleting } from "./accountLifecycle";

export function itemDeletionRef(uid: string, itemId: string) {
  if (!uid || !itemId || uid.includes("/") || itemId.includes("/")) throw new HttpsError("invalid-argument", "Invalid item.");
  return getFirestore().doc(`users/${uid}/itemDeletionJobs/${itemId}`);
}
// The deletion fence and deletion of the current record share one commit. IDs
// are never reused. The fence contains no photo URLs, attributes or provider data.
export async function deleteItemAtomically(uid: string, itemId: string, allow?: (current: DocumentSnapshot) => boolean) {
  const job = itemDeletionRef(uid, itemId);
  const ref = getFirestore().doc(`users/${uid}/items/${itemId}`);
  return getFirestore().runTransaction(async (tx) => {
    await assertActiveInTransaction(tx, uid);
    const [current, fence] = await tx.getAll(ref, job);
    if (fence.exists) return true;
    if (allow && (!current.exists || !allow(current))) return false;
    tx.create(job, { createdAt: Timestamp.now(), dueAt: Timestamp.now() });
    if (current.exists) tx.delete(ref);
    return true;
  });
}
export function itemFromStoragePath(path: string): { uid: string; itemId: string } | null {
  const [root, uid, collection, filename] = path.split("/");
  if (root !== "users" || !uid || collection !== "items" || !filename) return null;
  // Legacy flat originals are itemId.jpg; image variants use itemId/… .
  const itemId = path.split("/").length === 4 ? filename.split(".")[0] : filename;
  return { uid, itemId };
}
export function ownedItemPath(path: string, uid: string, itemId: string) {
  const owner = itemFromStoragePath(path);
  return owner?.uid === uid && owner.itemId === itemId;
}
export async function survivingMediaPaths(uid: string) { return scanUserMedia(uid); }
// Generation-scoped deletion never removes a newer overwrite. Page cursors
// bound cleanup work; deletion jobs continue sweeping while the account exists.
export async function cleanItemMedia(uid: string, itemId: string, generatedOnly = false, activeRun?: string, pageToken?: string): Promise<{ next: string | null; retained: boolean }> {
  const prefix = `users/${uid}/items/${itemId}${generatedOnly ? "/ingestion/" : ""}`;
  const [files, next] = await getStorage().bucket().getFiles({ prefix, maxResults: 100, autoPaginate: false, ...(pageToken ? { pageToken } : {}) });
  // List first, then read the current run. A newly claimed run cannot have
  // uploaded an object in that list before its claim was visible here.
  const current = await getFirestore().doc(`users/${uid}/items/${itemId}`).get();
  const startedAt = current.get("ingestion.startedAt");
  const startedMs = startedAt?.toMillis?.() ?? (typeof startedAt === "number" ? startedAt : 0);
  const liveRun = current.get("ingestion.status") === "processing" && startedMs > Date.now() - 10 * 60_000 &&
    current.get("draftState") !== "cancelled" ? current.get("ingestion.runId") : undefined;
  const protectedPaths = files.filter((file) => [activeRun, liveRun].some((run) => run && file.name.startsWith(`users/${uid}/items/${itemId}/ingestion/${run}/`))).map((file) => file.name);
  const retired = new Set(await retireUnreferencedMedia(uid, files.filter((file) => ownedItemPath(file.name, uid, itemId)).map((file) => file.name), protectedPaths));
  let retained = false;
  for (const file of files) {
    if (!ownedItemPath(file.name, uid, itemId)) continue;
    if (!retired.has(file.name)) {
      // Referenced generated output is expected and needs no future cleanup.
      if (!generatedOnly) retained = true;
      continue;
    }
    await file.bucket.file(file.name, { generation: file.metadata.generation }).delete({ ignoreNotFound: true });
  }
  return { next: next?.pageToken ?? null, retained };
}
export async function recoverItemMedia() {
  const due = await getFirestore().collectionGroup("itemDeletionJobs").where("dueAt", "<=", Timestamp.now()).orderBy("dueAt").limit(10).get();
  for (const job of due.docs) {
    const [root, uid, collection, itemId] = job.ref.path.split("/");
    if (root !== "users" || collection !== "itemDeletionJobs") continue;
    const page = await cleanItemMedia(uid, itemId, false, undefined, job.get("mediaCursor"));
    await getFirestore().runTransaction(async (tx) => {
      await assertActiveInTransaction(tx, uid);
      const current = await tx.get(job.ref);
      if (!current.exists) return;
      tx.update(job.ref, {
        // A low-frequency sweep also catches a lost finalization event. Shared
        // source files stay retained until their last surviving reference ends.
        dueAt: Timestamp.fromMillis(Date.now() + (page.next ? 60_000 : 24 * 60 * 60_000)),
        mediaCursor: page.next ?? FieldValue.delete(),
      });
    }).catch((error) => { if (!isAccountDeleting(error)) throw error; });
  }
}
// Storage finalization is retry-enabled by the caller. Covers resumable uploads
// authorized before deletion, including after the initial sweep completed.
export async function removeDeletedItemUpload(bucket: string, path: string, generation: string | number) {
  const owner = itemFromStoragePath(path);
  if (!owner || !(await itemDeletionRef(owner.uid, owner.itemId).get()).exists) return;
  await retireUnreferencedMedia(owner.uid, [path]);
  await removeRetiredUpload(bucket, path, generation);
}
