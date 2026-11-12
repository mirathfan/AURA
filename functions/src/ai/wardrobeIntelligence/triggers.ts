import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { isAccountDeleting } from "../../shared/accountLifecycle";
import { CLOSET_ITEM_DOCUMENT_PATH } from "./config";
import { enqueueIndexing } from "./indexingRecovery";
import { shouldSkipIntelligenceIndexing } from "./skip";

export const onClosetItemWriteIndexIntelligence = onDocumentWritten(
  { document: CLOSET_ITEM_DOCUMENT_PATH, retry: true, timeoutSeconds: 60 },
  async (event) => {
    // Generated writes cannot create an event loop. Other events reconcile the
    // live document, never embed the stale event snapshot.
    if (event.data?.after.exists && shouldSkipIntelligenceIndexing(event.data.before.data(), event.data.after.data())) return;
    try { await enqueueIndexing(event.params.uid, event.params.itemId); }
    catch (error) { if (!isAccountDeleting(error)) throw error; }
  },
);
