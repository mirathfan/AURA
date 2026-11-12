import { isAccountDeleting } from "./shared/accountLifecycle";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { resumeAiConsentPage } from "./shared/resumeAiConsent";
import { onCall } from "firebase-functions/v2/https";
import { tracedHandler } from "./shared/logger";
import { updateAiConsent } from "./shared/aiConsent";

export const setAiConsent = onCall({}, tracedHandler(async (request) => {
  return updateAiConsent(request.auth?.uid ?? "", request.data ?? {});
}));

// Each page has its own bounded invocation and is cancelled on revision change.
export const resumeClosetAfterAiConsent = onDocumentCreated({
  document: "users/{uid}/aiConsentJobs/{jobId}", retry: true,
}, tracedHandler(async (event) => {
  try { await resumeAiConsentPage(event.params.uid, event.params.jobId); } catch (error) {
    if (!isAccountDeleting(error)) throw error;
  }
}));
