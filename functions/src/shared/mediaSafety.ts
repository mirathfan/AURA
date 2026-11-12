import { createHash, randomUUID } from "node:crypto";
import { DocumentData, getFirestore, Timestamp, Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/v2/https";
import { assertActiveInTransaction, deletionRef, accountDeleting } from "./accountLifecycle";

export const MEDIA_LEASE_MS = 60_000;
export const MEDIA_PERMIT_MS = 120_000;
export function mediaLockRef(uid: string) { return getFirestore().doc(`users/${uid}/mediaControl/cleanup`); }
export function retiredMediaRef(uid: string, path: string) {
  return getFirestore().doc(`users/${uid}/retiredMedia/${createHash("sha256").update(path).digest("hex")}`);
}
export function mediaBusy() { return new HttpsError("unavailable", "Photos are being maintained. Please try again shortly.", { code: "MEDIA_BUSY" }); }
export async function assertMediaUnlocked(tx: Transaction, uid: string) {
  const lock = await tx.get(mediaLockRef(uid));
  // Expiry never unlocks writes by itself. Recovery must delete/replace the
  // lock transactionally, which invalidates a stale retiring transaction.
  if (lock.exists) throw mediaBusy();
}
// Recognize raw paths, gs URLs, Firebase download URLs and GCS URLs. Never
// persist a download token in the retirement ledger or operational logs.
export function mediaPaths(value: unknown, paths = new Set<string>(), depth = 0): Set<string> {
  if (depth > 50) throw new HttpsError("invalid-argument", "Photo data is too deeply nested.");
  if (typeof value === "string") {
    if (value.startsWith("users/")) paths.add(value);
    else {
      try {
        const url = new URL(value);
        let path: string | undefined;
        if (url.protocol === "gs:") path = decodeURIComponent(url.pathname.slice(1));
        else if (url.pathname.includes("/o/")) path = decodeURIComponent(url.pathname.split("/o/")[1] ?? "");
        else if (url.hostname.endsWith(".storage.googleapis.com")) path = decodeURIComponent(url.pathname.slice(1));
        else if (["storage.googleapis.com", "storage.cloud.google.com"].includes(url.hostname)) path = decodeURIComponent(url.pathname.split("/").slice(2).join("/"));
        if (path?.startsWith("users/")) paths.add(path);
      } catch { /* ordinary text or an external retailer image */ }
    }
  } else if (Array.isArray(value)) value.forEach((v) => mediaPaths(v, paths, depth + 1));
  else if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) Object.values(value).forEach((v) => mediaPaths(v, paths, depth + 1));
  return paths;
}
export async function assertMediaAttachable(tx: Transaction, uid: string, data: unknown) {
  const paths = [...mediaPaths(data)];
  if (paths.some((path) => !path.startsWith(`users/${uid}/`) || path.startsWith(`users/${uid}/tmp/`))) throw new HttpsError("permission-denied", "Photos must belong to this account.");
  if (paths.length > 100) throw new HttpsError("invalid-argument", "Too many photo references.");
  if (paths.length && (await tx.getAll(...paths.map((path) => retiredMediaRef(uid, path)))).some((snap) => snap.exists)) {
    throw new HttpsError("failed-precondition", "This photo has been removed. Upload it again to continue.", { code: "MEDIA_RETIRED" });
  }
}
// Walk documents AND missing ancestors. Saved outfits, chat snapshots, jobs and
// unknown future collections are included, not only the current wardrobe.
export async function scanUserMedia(uid: string, now = Date.now()) {
  const paths = new Set<string>();
  const db = getFirestore();
  const queue = [db.doc(`users/${uid}`)];
  const internal = new Set(["retiredMedia", "mediaControl", "mediaSweepJobs", "mediaInventories"]);
  const deadline = Date.now() + MEDIA_LEASE_MS - 5000;
  let count = 0;
  while (queue.length) {
    if (Date.now() >= deadline) throw mediaBusy();
    // Bound RPC concurrency and memory while still visiting missing ancestors.
    const refs = queue.splice(0, 20);
    count += refs.length;
    if (count + queue.length > 5000) throw new Error("Media inventory exceeds bounded scan; cleanup deferred.");
    const snapshots = await db.getAll(...refs);
    for (const snap of snapshots) {
      const inactiveSavedOutfit = snap.ref.parent.id === "savedOutfits" && snap.get("active") === false;
      if (!inactiveSavedOutfit && (snap.ref.parent.id !== "mediaPermits" || (snap.get("until")?.toMillis?.() ?? 0) > now)) mediaPaths(snap.data(), paths);
    }
    const collections = (await Promise.all(refs.map((ref) => ref.listCollections()))).flat().filter((col) => !internal.has(col.id));
    for (let start = 0; start < collections.length; start += 20) {
      const descendants = await Promise.all(collections.slice(start, start + 20).map((col) => col.listDocuments()));
      queue.push(...descendants.flat());
      if (count + queue.length > 5000) throw new Error("Media inventory exceeds bounded scan; cleanup deferred.");
    }
  }
  return paths;
}
// Every reference writer reads this lease in its transaction (client rules also
// enforce it). Retiring a path is permanent, so releasing the lease cannot make
// that path attachable again. Storage deletion happens only AFTER retirement.
export async function retireUnreferencedMedia(uid: string, candidates: string[], protectedPaths: string[] = []) {
  if (!candidates.length) return [];
  const db = getFirestore();
  // Destructive rollout is opt-in by an operator, never by a client or version.
  if ((await db.doc("releaseControl/mediaSafety").get()).get("cleanupEnabled") !== true) return [];
  const lock = mediaLockRef(uid);
  const lease = randomUUID();
  await db.runTransaction(async (tx) => {
    await assertActiveInTransaction(tx, uid, false);
    const current = await tx.get(lock);
    if (current.exists && current.get("until").toMillis() > current.readTime.toMillis()) throw mediaBusy();
    tx.set(lock, { lease, until: Timestamp.fromMillis(current.readTime.toMillis() + MEDIA_LEASE_MS) });
  });
  try {
    const locked = await lock.get();
    if (locked.get("lease") !== lease || !locked.updateTime) throw mediaBusy();
    // Firestore commit time, not the function host clock, determines which
    // permits could still have authorized a write before the lock committed.
    const referenced = await scanUserMedia(uid, locked.updateTime.toMillis());
    protectedPaths.forEach((path) => referenced.add(path));
    const retired = candidates.filter((path) => path.startsWith(`users/${uid}/`) && !referenced.has(path));
    await db.runTransaction(async (tx) => {
      // Deliberately check the account fence directly: this worker owns the lock.
      if ((await tx.get(deletionRef(uid))).exists) throw accountDeleting();
      const current = await tx.get(lock);
      if (current.get("lease") !== lease || current.get("until").toMillis() <= current.readTime.toMillis()) throw mediaBusy();
      for (const path of retired) tx.set(retiredMediaRef(uid, path), { path, retiredAt: Timestamp.now(), dueAt: Timestamp.now() });
      tx.delete(lock);
    });
    return retired;
  } finally {
    await db.runTransaction(async (tx) => {
      const current = await tx.get(lock);
      if (current.get("lease") === lease) tx.delete(lock);
    });
  }
}
export async function removeRetiredUpload(bucket: string, path: string, generation: string | number) {
  const [root, uid] = path.split("/");
  if (root !== "users" || !uid || !(await retiredMediaRef(uid, path).get()).exists) return;
  await getStorage().bucket(bucket).file(path, { generation }).delete({ ignoreNotFound: true });
}
export async function recoverRetiredMedia() {
  const jobs = await getFirestore().collectionGroup("retiredMedia").where("dueAt", "<=", Timestamp.now()).orderBy("dueAt").limit(50).get();
  for (const job of jobs.docs) {
    const [root, uid, collection] = job.ref.path.split("/");
    const path = job.get("path");
    if (root !== "users" || collection !== "retiredMedia" || typeof path !== "string" || !path.startsWith(`users/${uid}/`)) continue;
    const file = getStorage().bucket().file(path);
    try {
      const [meta] = await file.getMetadata();
      await file.bucket.file(path, { generation: meta.generation }).delete({ ignoreNotFound: true });
    } catch (error) { if ((error as { code?: number }).code !== 404) throw error; }
    await getFirestore().runTransaction(async (tx) => {
      await assertActiveInTransaction(tx, uid);
      const current = await tx.get(job.ref);
      if (current.exists) tx.update(job.ref, { dueAt: Timestamp.fromMillis(Date.now() + 86400_000) });
    }).catch((error) => { if (error?.details?.code !== "ACCOUNT_DELETING") throw error; });
  }
}
// Kept separate from mutable document payloads; callers read all guards before writes.
export type MediaPatch = { data: DocumentData; mode: "set" | "merge" | "update" };

export async function queueMediaSweep(uid: string, path: string) {
  if (!path.startsWith(`users/${uid}/`) || path.startsWith(`users/${uid}/tmp/`)) return;
  const db = getFirestore();
  const id = createHash("sha256").update(path).digest("hex");
  await db.runTransaction(async (tx) => {
    await assertActiveInTransaction(tx, uid);
    const ref = db.doc(`users/${uid}/mediaSweepJobs/${id}`);
    const current = await tx.get(ref);
    if (!current.exists) tx.create(ref, { path, dueAt: Timestamp.fromMillis(Date.now() + 86400_000) });
  });
}
// Bounded historical backfill entry point for an approved operator migration.
// Also used when an updated client first obtains a permit. No user-data reads
// outside the specified owner; no deletion in the inventory step.
export async function inventoryUserMedia(uid: string, pageToken?: string) {
  const [files, next] = await getStorage().bucket().getFiles({ prefix: `users/${uid}/`, maxResults: 100, autoPaginate: false, ...(pageToken ? { pageToken } : {}) });
  for (const file of files) await queueMediaSweep(uid, file.name);
  return next?.pageToken ?? null;
}
export async function recoverMediaSweeps() {
  const db = getFirestore();
  const due = await db.collectionGroup("mediaSweepJobs").where("dueAt", "<=", Timestamp.now()).orderBy("dueAt").limit(20).get();
  const owners = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  for (const job of due.docs) {
    const [root, uid, collection] = job.ref.path.split("/");
    if (root !== "users" || collection !== "mediaSweepJobs") continue;
    owners.set(uid, [...(owners.get(uid) ?? []), job]);
  }
  for (const [uid, jobs] of owners) {
    try {
      await retireUnreferencedMedia(uid, jobs.map((job) => job.get("path")));
      await db.runTransaction(async (tx) => {
        await assertActiveInTransaction(tx, uid);
        const current = await tx.getAll(...jobs.map((job) => job.ref));
        current.filter((job) => job.exists).forEach((job) => tx.update(job.ref, { dueAt: Timestamp.fromMillis(Date.now() + 86400_000) }));
      });
    } catch (error) { if (!["ACCOUNT_DELETING", "MEDIA_BUSY"].includes((error as { details?: { code?: string } })?.details?.code ?? "")) throw error; }
  }
  // Expired permits must not retain snapshots of deleted/private content.
  const expired = await db.collectionGroup("mediaPermits").where("until", "<=", Timestamp.now()).orderBy("until").limit(100).get();
  for (const permit of expired.docs) {
    await db.runTransaction(async (tx) => {
      const current = await tx.get(permit.ref);
      if ((current.get("until")?.toMillis?.() ?? Infinity) <= Date.now()) tx.delete(permit.ref);
    });
  }
}
export async function recoverMediaInventories() {
  const db = getFirestore();
  const jobs = await db.collectionGroup("mediaInventories").where("dueAt", "<=", Timestamp.now()).orderBy("dueAt").limit(5).get();
  for (const job of jobs.docs) {
    const [root, uid, collection, id] = job.ref.path.split("/");
    if (root !== "users" || collection !== "mediaInventories" || id !== "default") continue;
    try {
      const cursor = await inventoryUserMedia(uid, job.get("cursor"));
      await db.runTransaction(async (tx) => {
        await assertActiveInTransaction(tx, uid);
        const current = await tx.get(job.ref);
        if (current.exists && current.updateTime?.isEqual(job.updateTime)) tx.update(job.ref, {
          cursor, dueAt: Timestamp.fromMillis(Date.now() + (cursor ? 60_000 : 86400_000)),
        });
      });
    } catch (error) { if (!["ACCOUNT_DELETING", "MEDIA_BUSY"].includes((error as { details?: { code?: string } })?.details?.code ?? "")) throw error; }
  }
}
// Recovery changes the lock document, rather than allowing reference writes
// based on a clock check. A stale scanner must then fail its token/version check.
export async function recoverExpiredMediaLocks() {
  const due = await getFirestore().collectionGroup("mediaControl").where("until", "<=", Timestamp.now()).orderBy("until").limit(20).get();
  for (const lock of due.docs) {
    if (lock.id !== "cleanup" || lock.ref.path.split("/")[0] !== "users") continue;
    await getFirestore().runTransaction(async (tx) => {
      const current = await tx.get(lock.ref);
      if (current.exists && current.get("until").toMillis() <= current.readTime.toMillis()) tx.delete(lock.ref);
    });
  }
}
