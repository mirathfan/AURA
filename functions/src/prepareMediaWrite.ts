import { assertFunctionRateLimit, RATE_LIMITS } from "./shared/rateLimit";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { assertActiveInTransaction } from "./shared/accountLifecycle";
import { assertMediaAttachable, MEDIA_PERMIT_MS, MediaPatch } from "./shared/mediaSafety";
import { mediaProjection } from "../../shared/mediaSafety";

function plain(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function merge(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  const result = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new HttpsError("invalid-argument", "Invalid field.");
    result[key] = plain(value) && Object.keys(value).length > 0 && plain(result[key]) ? merge(result[key] as Record<string, unknown>, value) : value;
  }
  return result;
}
export function applyMediaPatch(current: Record<string, unknown>, patch: MediaPatch) {
  if (patch.mode === "set") return patch.data;
  if (patch.mode === "merge") return merge(current, patch.data);
  const next = { ...current };
  for (const [key, value] of Object.entries(patch.data)) {
    const parts = key.split(".");
    let cursor = next;
    for (const part of parts.slice(0, -1)) {
      if (["__proto__", "constructor", "prototype"].includes(part)) throw new HttpsError("invalid-argument", "Invalid field.");
      cursor[part] = { ...(plain(cursor[part]) ? cursor[part] as Record<string, unknown> : {}) };
      cursor = cursor[part] as Record<string, unknown>;
    }
    const last = parts[parts.length - 1];
    if (["__proto__", "constructor", "prototype"].includes(last)) throw new HttpsError("invalid-argument", "Invalid field.");
    cursor[last] = value;
  }
  return next;
}
// A permit authorizes only the media projection. The subsequent CLIENT write
// must still pass all normal Firestore ownership/schema/entitlement rules.
export async function prepareMediaWriteForUser(uid: string, target: string, patches: MediaPatch[]) {
  if (typeof target !== "string") throw new HttpsError("invalid-argument", "Invalid destination.");
  const parts = target ? target.split("/") : [];
  const allowed = ["items", "outfits", "threads", "ai", "assistantProfile", "profile", "aiChats", "styleEvents", "savedLooks", "auraLooks", "savedOutfits", "outfitFeedback", "commerceEvents", "shoppingRecommendationFeedback", "launchEvents"];
  if (target && (parts.some((part) => !part || part.length > 150) || ![2, 4].includes(parts.length) || !allowed.includes(parts[0]) ||
    (parts.length === 4 && (!["aiChats", "threads"].includes(parts[0]) || !["messages", "sessionContext"].includes(parts[2]))))) throw new HttpsError("invalid-argument", "Invalid photo destination.");
  if (!Array.isArray(patches) || !patches.length || patches.length > 20 || JSON.stringify(patches).length > 500_000 || patches.some((p) => !["set", "merge", "update"].includes(p.mode) || !plain(p.data))) throw new HttpsError("invalid-argument", "Invalid photo write.");
  const db = getFirestore();
  const ref = db.doc(target ? `users/${uid}/${target}` : `users/${uid}`);
  await db.runTransaction(async (tx) => {
    await assertActiveInTransaction(tx, uid);
    const inventory = db.doc(`users/${uid}/mediaInventories/default`);
    const inventoryState = await tx.get(inventory);
    const current = await tx.get(ref);
    if (parts[0] === "items" && (await tx.get(db.doc(`users/${uid}/itemDeletionJobs/${parts[1]}`))).exists) throw new HttpsError("failed-precondition", "Item no longer exists.");
    let data = mediaProjection(current.data() ?? {});
    for (const patch of patches) data = applyMediaPatch(data, patch);
    await assertMediaAttachable(tx, uid, data);
    if (!inventoryState.exists) tx.create(inventory, { dueAt: Timestamp.now() });
    tx.set(ref.collection("mediaPermits").doc("latest"), { target, projection: data, until: Timestamp.fromMillis(Date.now() + MEDIA_PERMIT_MS) });
  });
  return { prepared: true };
}
export const prepareMediaWrite = onCall({ region: "us-central1", timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  if (request.data?.uid !== request.auth.uid) throw new HttpsError("permission-denied", "Account changed. Try again.");
  await assertFunctionRateLimit(request.auth.uid, "prepareMediaWrite", RATE_LIMITS.prepareMediaWrite);
  return prepareMediaWriteForUser(request.auth.uid, request.data.target, request.data.patches);
});
