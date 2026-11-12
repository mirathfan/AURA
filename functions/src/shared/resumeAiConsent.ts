import { assertActiveInTransaction } from "./accountLifecycle";
import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { isCurrentAiConsent } from "../../../shared/aiConsent";

// Queue only item writes. The existing ingestion/indexing workers independently
// re-check consent at execution and again at the provider transport boundary.
export async function resumeAiConsentPage(uid: string, jobId: string) {
  const db = getFirestore();
  const jobRef = db.doc(`users/${uid}/aiConsentJobs/${jobId}`);
  await db.runTransaction(async (transaction) => {
    await assertActiveInTransaction(transaction, uid);
    const job = await transaction.get(jobRef);
    if (!job.exists || job.get("completed")) return;
    const consent = await transaction.get(db.doc(`users/${uid}/privacy/aiConsent`));
    const revision = job.get("revision");
    if (!isCurrentAiConsent(consent.data()) || consent.get("revision") !== revision) {
      transaction.update(jobRef, { completed: true, cancelled: true });
      return;
    }
    let query = db.collection(`users/${uid}/items`).orderBy(FieldPath.documentId()).limit(50);
    if (job.get("cursor")) query = query.startAfter(job.get("cursor"));
    const items = await transaction.get(query);
    for (const item of items.docs) {
      const data = item.data();
      if (["deleted", "candidate"].includes(data.itemLifecycleStatus) || ["cancelled", "awaiting_confirmation"].includes(data.draftState)) continue;
      const paused = (data.ingestion?.status ?? data.ingestionStatus) === "consent_required";
      transaction.update(item.ref, {
        aiConsentRevision: revision,
        ...(paused ? { ingestionStatus: "pending", "ingestion.status": "pending", "ingestion.errorCode": null, "ingestion.errorMessage": null } : {}),
      });
    }
    if (items.size === 50) {
      const cursor = items.docs[items.size - 1].id;
      // A deterministic ID and completed marker make event redelivery harmless.
      transaction.set(db.collection(`users/${uid}/aiConsentJobs`).doc(`page-${revision}-${cursor}`), { revision, cursor, completed: false });
    }
    transaction.update(jobRef, { completed: true });
  });
}
