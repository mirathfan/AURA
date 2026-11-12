import { assertActiveInTransaction } from "./accountLifecycle";
import { aiConsentRef } from "./aiConsent";
import { isCurrentAiConsent } from "../../../shared/aiConsent";
import { getFirestore } from "firebase-admin/firestore";
import { AI_CONSENT_MESSAGE, AI_CONSENT_REQUIRED } from "../../../shared/aiConsent";

export async function pauseIngestionForConsent(uid: string, itemId: string) {
  const db = getFirestore();
  const ref = db.doc(`users/${uid}/items/${itemId}`);
  await db.runTransaction(async (transaction) => {
    await assertActiveInTransaction(transaction, uid);
    const [current, consent] = await transaction.getAll(ref, aiConsentRef(uid));
    if (isCurrentAiConsent(consent.data())) return;
    if (!current.exists) return;
    const data = current.data() ?? {};
    const status = data.ingestion?.status ?? data.ingestionStatus;
    // Only pause actual ingestion work. Never promote an unconfirmed candidate,
    // an empty draft, or a completed/manual item into a different lifecycle.
    if (!["pending", "processing", "failed"].includes(status) ||
      ["deleted", "candidate"].includes(data.itemLifecycleStatus) ||
      ["cancelled", "awaiting_confirmation"].includes(data.draftState)) return;
    transaction.update(ref, {
      ingestionStatus: "consent_required",
      "ingestion.status": "consent_required",
      "ingestion.canRetry": true,
      "ingestion.errorCode": AI_CONSENT_REQUIRED,
      "ingestion.errorMessage": AI_CONSENT_MESSAGE,
      itemLifecycleStatus: data.isDraft ? "needs_review" : "ready",
      ...(data.isDraft ? { draftState: "photo_uploaded" } : {}),
    });
  });
}
