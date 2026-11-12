import { doc, getDocFromServer } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth, db } from "../lib/firebase";
import { AI_CONSENT_DOCUMENT, AI_CONSENT_MESSAGE, AI_CONSENT_REQUIRED, AI_CONSENT_VERSION, isCurrentAiConsent, type AiConsentRecord, type AiConsentStatus } from "../../shared/aiConsent";

const locallyBlocked = new Set<string>();
export function isAiLocallyBlocked(uid: string) { return locallyBlocked.has(uid); }
export function blockAiLocally(uid: string) { locallyBlocked.add(uid); }
export function allowAiLocally(uid: string) { locallyBlocked.delete(uid); }

export async function requireClientAiConsent() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in first.");
  const snapshot = await getDocFromServer(doc(db, "users", uid, ...AI_CONSENT_DOCUMENT.split("/")));
  if (locallyBlocked.has(uid) || auth.currentUser?.uid !== uid || !isCurrentAiConsent(snapshot.data() as AiConsentRecord)) {
    throw Object.assign(new Error(AI_CONSENT_MESSAGE), { code: AI_CONSENT_REQUIRED });
  }
}

export async function saveAiConsent(status: AiConsentStatus, expectedRevision: number) {
  const update = httpsCallable(getFunctions(app, "us-central1"), "setAiConsent");
  return update({ status, expectedRevision, policyVersion: AI_CONSENT_VERSION });
}
