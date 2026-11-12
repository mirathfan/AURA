import { assertMediaUnlocked, assertMediaAttachable } from "./mediaSafety";
import { getFirestore, type DocumentReference, type DocumentData, type SetOptions, type Transaction, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

export const DELETION_COLLECTION = "accountDeletionJobs";
export function deletionRef(uid: string) {
  if (!uid || uid.includes("/")) throw new HttpsError("invalid-argument", "Invalid account.");
  return getFirestore().collection(DELETION_COLLECTION).doc(uid);
}
export function accountDeleting() {
  return new HttpsError("failed-precondition", "Account deletion is in progress. Open Account deletion for status or contact support@getaura.app.", { code: "ACCOUNT_DELETING" });
}
export function isAccountDeleting(error: unknown): boolean {
  return (error as { details?: { code?: string } })?.details?.code === "ACCOUNT_DELETING";
}
export async function assertAccountActive(uid: string) {
  if ((await deletionRef(uid).get()).exists) throw accountDeleting();
}
// Reading the fence inside the SAME transaction as writes serializes them with
// deletion acceptance. A separate preflight read cannot close this race.
export async function assertActiveInTransaction(transaction: Transaction, uid: string, mediaWrite = true) {
  if ((await transaction.get(deletionRef(uid))).exists) throw accountDeleting();
  if (mediaWrite) await assertMediaUnlocked(transaction, uid);
}
export function userIdFromPath(path: string) {
  const [root, uid] = path.split("/");
  if (root !== "users" || !uid) throw new Error("Expected a user-owned path.");
  return uid;
}
// All privileged item writes honor the durable per-item fence. Merge writes
// mean update-existing; asynchronous callers must not resurrect a missing item.
async function assertItemWrite(transaction: Transaction, ref: DocumentReference, existing: boolean) {
  const parts = ref.path.split("/");
  if (parts.length !== 4 || parts[0] !== "users" || parts[2] !== "items") return;
  const [item, fence] = await transaction.getAll(ref, ref.firestore.doc(`users/${parts[1]}/itemDeletionJobs/${parts[3]}`));
  if (fence.exists || (existing && !item.exists)) throw new HttpsError("failed-precondition", "Item no longer exists.");
}
export async function setUserDocument(ref: DocumentReference, data: DocumentData, options?: SetOptions) {
  return ref.firestore.runTransaction(async (transaction) => {
    await assertActiveInTransaction(transaction, userIdFromPath(ref.path));
    await assertItemWrite(transaction, ref, !!options);
    await assertMediaAttachable(transaction, userIdFromPath(ref.path), data);
    if (options) transaction.set(ref, data, options);
    else transaction.set(ref, data);
  });
}
export async function updateUserDocument(ref: DocumentReference, data: DocumentData) {
  return ref.firestore.runTransaction(async (transaction) => {
    await assertActiveInTransaction(transaction, userIdFromPath(ref.path));
    await assertItemWrite(transaction, ref, true);
    await assertMediaAttachable(transaction, userIdFromPath(ref.path), data);
    transaction.update(ref, data);
  });
}
export async function addUserDocument(collection: FirebaseFirestore.CollectionReference, data: DocumentData) {
  const ref = collection.doc();
  await setUserDocument(ref, data);
  return ref;
}
// A small explicit batch adapter: no SDK monkey-patching. All queued mutations
// are replayed only after a transactional fence read, including delayed commits.
export function userWriteBatch(db: Firestore, uid: string) {
  const checks: { ref: DocumentReference; existing: boolean; data: DocumentData }[] = [];
  const operations: ((transaction: Transaction) => void)[] = [];
  return {
    set(ref: DocumentReference, data: DocumentData, options?: SetOptions) {
      if (userIdFromPath(ref.path) !== uid) throw new Error("Cross-account batch.");
      checks.push({ ref, existing: !!options, data });
      operations.push((tx) => { if (options) tx.set(ref, data, options); else tx.set(ref, data); });
    },
    update(ref: DocumentReference, data: DocumentData) {
      if (userIdFromPath(ref.path) !== uid) throw new Error("Cross-account batch.");
      checks.push({ ref, existing: true, data });
      operations.push((tx) => { tx.update(ref, data); });
    },
    async commit() {
      await db.runTransaction(async (tx) => {
        await assertActiveInTransaction(tx, uid);
        for (const check of checks) {
          await assertItemWrite(tx, check.ref, check.existing);
          await assertMediaAttachable(tx, uid, check.data);
        }
        operations.forEach((operation) => operation(tx));
      });
    },
  };
}
