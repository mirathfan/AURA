import { retiredMediaRef, removeRetiredUpload } from "./mediaSafety";
import { HttpsError } from "firebase-functions/v2/https";
import { itemFromStoragePath, itemDeletionRef, removeDeletedItemUpload } from "./itemLifecycle";
import type { File, SaveOptions } from "@google-cloud/storage";
import { assertAccountActive, userIdFromPath, isAccountDeleting } from "./accountLifecycle";

async function assertUploadActive(path: string) {
  await assertAccountActive(userIdFromPath(path));
  if ((await retiredMediaRef(userIdFromPath(path), path).get()).exists) throw new HttpsError("failed-precondition", "Photo retired.");
  const item = itemFromStoragePath(path);
  if (item && (await itemDeletionRef(item.uid, item.itemId).get()).exists) throw new HttpsError("failed-precondition", "Item no longer exists.");
}
// Storage and Firestore do not share a transaction. Check both sides of the
// upload, and pair this with the durable onObjectFinalized deletion handler.
export async function saveUserFile(file: File, bytes: Buffer, options: SaveOptions) {
  await assertUploadActive(file.name);
  await file.save(bytes, { ...options, preconditionOpts: { ifGenerationMatch: 0 } });
  try { await assertUploadActive(file.name); } catch (error) {
    if (isAccountDeleting(error)) {
      await file.bucket.file(file.name, { generation: file.metadata.generation }).delete({ ignoreNotFound: true });
    } else if (file.metadata.generation) {
      await removeRetiredUpload(file.bucket.name, file.name, file.metadata.generation);
      await removeDeletedItemUpload(file.bucket.name, file.name, file.metadata.generation);
    }
    throw error;
  }
}
