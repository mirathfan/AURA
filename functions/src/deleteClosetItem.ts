import { assertFunctionRateLimit, RATE_LIMITS } from "./shared/rateLimit";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { deleteItemAtomically } from "./shared/itemLifecycle";
import { isAutoDeleteSafeAbandonedDraft } from "./ai/wardrobeIntelligence/draftCleanup";
import type { ClosetItemDocument } from "./ai/wardrobeIntelligence/types";

export const deleteClosetItem = onCall({}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to delete an item.");
  if (request.data?.uid !== uid) throw new HttpsError("permission-denied", "Account changed. Try again.");
  const itemId = request.data?.itemId;
  if (typeof itemId !== "string" || !itemId || itemId.includes("/") || itemId.length > 150) throw new HttpsError("invalid-argument", "Invalid item.");
  await assertFunctionRateLimit(uid, "itemDeletion", RATE_LIMITS.itemDeletion);
  const deleted = await deleteItemAtomically(uid, itemId, request.data?.onlyIfEmptyDraft === true
    ? (snap) => isAutoDeleteSafeAbandonedDraft(snap.data() as ClosetItemDocument, Date.now() + 1) &&
      !["name", "brand", "notes", "material"].some((key) => Boolean(snap.get(key)))
    : undefined);
  return { deleted, cleanup: "queued" };
});
