import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";
import { invalidateClosetItemDeletionCaches } from "./localCache";

export async function requestItemDeletion(uid: string, itemId: string, onlyIfEmptyDraft = false) {
  const call = httpsCallable<{ uid: string; itemId: string; onlyIfEmptyDraft: boolean }, { deleted: boolean; cleanup: string }>(getFunctions(app), "deleteClosetItem");
  return (await call({ uid, itemId, onlyIfEmptyDraft })).data;
}

export async function deleteWardrobeItem(uid: string, itemId: string, _item: unknown) {
  await requestItemDeletion(uid, itemId);
  await invalidateClosetItemDeletionCaches(uid, itemId).catch(() => undefined);
  // Media deletion is durable server work. A client must not remove an image
  // referenced by another surviving item or abandon cleanup on disconnect.
  return { attempted: 0, failed: 0 };
}
