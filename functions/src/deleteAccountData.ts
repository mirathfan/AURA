import { ACCOUNT_DELETION_CONTRACT } from "../../shared/releaseContract";
import { recoverRetiredMedia, removeRetiredUpload, queueMediaSweep, recoverMediaSweeps, recoverMediaInventories, recoverExpiredMediaLocks } from "./shared/mediaSafety";
import { recoverStalledIngestion } from "./shared/ingestionLifecycle";
import { recoverItemMedia, removeDeletedItemUpload } from "./shared/itemLifecycle";
import { recoverWardrobeIndexing } from "./ai/wardrobeIntelligence/indexingRecovery";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { tracedHandler } from "./shared/logger";
import { assertRecentAuthentication } from "./shared/recentAuthentication";
import { DELETION_COLLECTION, deletionRef } from "./shared/accountLifecycle";
import { beginAccountDeletion, processAccountDeletion, publicDeletionStatus } from "./shared/accountDeletionJob";

export const deleteAccountData = onCall(
  { timeoutSeconds: 540, memory: "512MiB" },
  tracedHandler(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to delete your account.");
    if (request.data?.uid !== undefined && request.data.uid !== uid) {
      throw new HttpsError("permission-denied", "You can only delete your own account.");
    }
    // Existing accepted requests can be checked/retried even after auth_time
    // ages out. Only the FIRST, destructive acceptance needs recent login.
    if (!(await deletionRef(uid).get()).exists) {
      assertRecentAuthentication(request.auth.token.auth_time);
      if (request.data?.deletionContract !== ACCOUNT_DELETION_CONTRACT) throw new HttpsError("failed-precondition", "Update AURA in TestFlight to manage account deletion. Your account has not been changed. Contact support@getaura.app for help.", { code: "CLIENT_UPGRADE_REQUIRED" });
      await beginAccountDeletion(uid, request.data?.allowAppleFallback === true);
    }
    if (request.data?.deletionContract !== ACCOUNT_DELETION_CONTRACT) throw new HttpsError("failed-precondition", "Update AURA to view deletion progress. Any previously accepted deletion will continue.", { code: "CLIENT_UPGRADE_REQUIRED" });
    await processAccountDeletion(uid);
    const status = publicDeletionStatus((await deletionRef(uid).get()).data());
    return { ...status, ok: status.state === "completed" };
  }),
);
export const getAccountDeletionStatus = onCall({}, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to check deletion.");
  const snap = await deletionRef(request.auth.uid).get();
  return snap.exists ? publicDeletionStatus(snap.data()) : null;
});
export const continueAccountDeletion = onDocumentCreated({
  document: `${DELETION_COLLECTION}/{uid}`, retry: true, timeoutSeconds: 540, memory: "512MiB",
}, async (event) => { await processAccountDeletion(event.params.uid); });
// A persisted dueAt recovers lost events AND a worker killed before its catch.
// Order by the single dueAt field; completed tombstones have no dueAt.
export const recoverAccountDeletions = onSchedule({
  schedule: "every 5 minutes", timeoutSeconds: 540, memory: "512MiB",
  secrets: ["OPENAI_API_KEY"], maxInstances: 1, concurrency: 1,
}, async () => {
  const due = await getFirestore().collection(DELETION_COLLECTION)
    .where("dueAt", "<=", Timestamp.now()).orderBy("dueAt").limit(10).get();
  const results = await Promise.allSettled([
    Promise.all(due.docs.map((doc) => processAccountDeletion(doc.id))),
    recoverWardrobeIndexing(),
    recoverExpiredMediaLocks(), recoverItemMedia(), recoverRetiredMedia(), recoverMediaSweeps(), recoverMediaInventories(),
    recoverStalledIngestion(),
  ]);
  if (results.some((result) => result.status === "rejected")) throw new Error("Background recovery incomplete; durable work remains queued.");
});
// Cross-service writes cannot be atomic. Retry deletion of the EXACT generation
// of any upload that finalized after the fence, including old resumable uploads.
export const removeDeletedAccountUpload = onObjectFinalized({ retry: true }, async (event) => {
  const [root, uid] = event.data.name.split("/");
  if (root !== "users" || !uid) return;
  if (!(await deletionRef(uid).get()).exists) {
    await removeRetiredUpload(event.data.bucket, event.data.name, event.data.generation);
    await removeDeletedItemUpload(event.data.bucket, event.data.name, event.data.generation);
    await queueMediaSweep(uid, event.data.name);
    return;
  }
  await getStorage().bucket(event.data.bucket).file(event.data.name, { generation: event.data.generation })
    .delete({ ignoreNotFound: true });
});
