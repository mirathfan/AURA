import { doc, runTransaction, type DocumentReference, type DocumentSnapshot } from "@/src/lib/mediaFirestore";
import { db } from "./firebase";

// A partial/cancelled new upload leaves an empty draft eligible for the existing
// abandoned-draft cleanup, rather than media with no durable owner record.
export async function ensureUploadItem(uid: string, itemId: string) {
  const ref = doc(db, "users", uid, "items", itemId);
  await runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists()) tx.set(ref, {
      isDraft: true, draftState: "draft", itemLifecycleStatus: "draft",
      status: "AVAILABLE", category: "top", wearCountSinceWash: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    });
  });
}
export async function commitUploadedDraft(
  ref: DocumentReference, baseline: DocumentSnapshot, payload: Record<string, unknown>, isCurrent: () => boolean,
) {
  return runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists() || !isCurrent() || current.data().draftState === "cancelled" || current.data().itemLifecycleStatus === "deleted") return false;
    const changed = (key: string) => JSON.stringify(current.data()[key]) !== JSON.stringify(baseline.data()?.[key]);
    if (["photos", "ingestionSource", "photoUrl", "images"].some(changed)) return false;
    const patch = { ...payload };
    for (const key of Object.keys(patch)) if (changed(key)) delete patch[key];
    if (["category", "subCategory"].some(changed)) { delete patch.category; delete patch.subCategory; }
    tx.update(ref, patch); // Rules read the item/account deletion fence at commit.
    return true;
  });
}
