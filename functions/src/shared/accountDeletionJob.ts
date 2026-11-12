import { createHash, randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/v2/https";
import { deletionRef } from "./accountLifecycle";
import { deleteDocumentTree } from "./deleteDocumentTree";
import { RATE_LIMITS, redactUid } from "./rateLimit";
import type { AppleDeletionStatus, DeletionStage, DeletionStatus } from "../../../shared/accountDeletion";

export const SETTLE_MS = 10 * 60_000;
const LEASE_MS = 10 * 60_000; // Longer than every worker's 540s execution deadline.
export function publicDeletionStatus(data: FirebaseFirestore.DocumentData | undefined): DeletionStatus {
  if (!data || !["deleting", "retry", "completed"].includes(data.state)) throw new HttpsError("unavailable", "Deletion status is unavailable. Try again.");
  return { state: data.state, stage: data.stage, apple: data.apple };
}
export async function beginAccountDeletion(uid: string, allowAppleFallback: boolean) {
  const ref = deletionRef(uid);
  const existing = await ref.get();
  if (existing.exists) return publicDeletionStatus(existing.data());
  const user = await getAuth().getUser(uid);
  const linkedApple = user.providerData.find((provider) => provider.providerId === "apple.com");
  return getFirestore().runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (current.exists) return publicDeletionStatus(current.data());
    const revocation = await tx.get(getFirestore().doc(`users/${uid}/private/appleRevocation`));
    const revokedAt = revocation.get("revokedAt");
    const revoked = linkedApple && revocation.get("subjectHash") === createHash("sha256").update(linkedApple.uid).digest("hex") && revokedAt instanceof Timestamp && Date.now() - revokedAt.toMillis() < 5 * 60_000;
    const apple: AppleDeletionStatus = !linkedApple ? "not_linked" : revoked ? "revoked" : "manual_required";
    if (apple === "manual_required" && !allowAppleFallback) {
      throw new HttpsError("failed-precondition", "Apple authorization needs attention. You may continue with manual Apple revocation.", { code: "APPLE_REVOCATION_REQUIRED" });
    }
    const status: DeletionStatus = { state: "deleting", stage: "firestore", apple };
    tx.create(ref, { ...status, createdAt: Timestamp.now(), dueAt: Timestamp.now(), attempts: 0 });
    return status;
  });
}
export async function deleteUserStorageFiles(uid: string) {
  const bucket = getStorage().bucket();
  // Bound memory and delete each page before listing again. No cursor over a
  // mutating listing, which could skip objects after a partial failure.
  for (;;) {
    const [files] = await bucket.getFiles({ prefix: `users/${uid}/`, maxResults: 100, autoPaginate: false });
    if (!files.length) return;
    await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
  }
}
async function deleteRateLimits(uid: string) {
  for (const endpoint of Object.keys(RATE_LIMITS)) {
    await deleteDocumentTree(getFirestore().doc(`functionRateLimits/${endpoint}/users/${redactUid(uid)}`));
  }
  await deleteDocumentTree(getFirestore().doc(`functionRateLimits/parseOutfitIntent/users/${uid}`));
}
export type CleanupOperations = Record<DeletionStage, (uid: string) => Promise<unknown>>;
export const cleanupOperations: CleanupOperations = {
  firestore: (uid) => deleteDocumentTree(getFirestore().doc(`users/${uid}`)),
  storage: deleteUserStorageFiles,
  rate_limits: deleteRateLimits,
  settle: async () => undefined,
  auth: async (uid) => {
    try { await getAuth().deleteUser(uid); } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }
  },
  verify: async (uid) => {
    // Final sweep also covers an object completing during the earlier pass.
    await deleteUserStorageFiles(uid);
    await deleteDocumentTree(getFirestore().doc(`users/${uid}`));
  },
};
const stages: DeletionStage[] = ["firestore", "storage", "rate_limits", "settle", "verify", "auth"];
// No caller-supplied stage, prefix or UID in the job payload is ever trusted.
// Trusted callers derive UID from an authenticated principal or document ID.
export async function processAccountDeletion(uid: string, operations = cleanupOperations) {
  const ref = deletionRef(uid);
  const lease = randomUUID();
  const claimed = await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data || data.state === "completed" || data.dueAt.toMillis() > Date.now()) return null;
    tx.update(ref, { state: "deleting", lease, dueAt: Timestamp.fromMillis(Date.now() + LEASE_MS), attempts: FieldValue.increment(1) });
    return data as { stage: DeletionStage; attempts: number; createdAt: Timestamp };
  });
  if (!claimed) return;
  try {
    for (let index = stages.indexOf(claimed.stage); index < stages.length; index++) {
      if (index < 0) throw new Error("Invalid cleanup stage");
      if (stages[index] === "settle" && Date.now() < claimed.createdAt.toMillis() + SETTLE_MS) {
        await getFirestore().runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (snap.get("lease") === lease) tx.update(ref, { lease: FieldValue.delete(), dueAt: Timestamp.fromMillis(claimed.createdAt.toMillis() + SETTLE_MS) });
        });
        return; // No billed sleep; scheduled recovery performs the final sweep.
      }
      await operations[stages[index]](uid);
      const owned = await getFirestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.get("lease") !== lease || snap.get("state") === "completed") return false;
        if (index === stages.length - 1) {
          // Keep a minimal permanent tombstone: old tokens/events must never
          // regain write access. No credentials or user content retained.
          tx.set(ref, { state: "completed", stage: "auth", apple: snap.get("apple"), completedAt: Timestamp.now() });
        } else {
          tx.update(ref, { stage: stages[index + 1] });
        }
        return true;
      });
      if (!owned) return;
    }
  } catch {
    // Never persist raw exceptions: storage errors can contain tokenized URLs.
    await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.get("lease") !== lease || snap.get("state") === "completed") return;
      tx.update(ref, { state: "retry", lease: FieldValue.delete(), dueAt: Timestamp.fromMillis(Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** Math.min(claimed.attempts, 6))) });
    });
  }
}
