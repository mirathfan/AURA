import { assertActiveInTransaction, assertAccountActive, deletionRef } from "./accountLifecycle";
import { AsyncLocalStorage } from "node:async_hooks";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { AI_CONSENT_DOCUMENT, AI_CONSENT_MESSAGE, AI_CONSENT_REQUIRED, AI_CONSENT_VERSION, isCurrentAiConsent, type AiConsentRecord, type AiConsentStatus } from "../../../shared/aiConsent";

type ConsentScope = { uid?: string; revision?: number };
const scope = new AsyncLocalStorage<ConsentScope>();

export function runWithAiConsentScope<T>(operation: () => T): T {
  return scope.run({}, operation);
}

// Called only with a verified callable/HTTP UID or a trusted Firestore path UID.
export function setAiConsentUser(uid: string) {
  const current = scope.getStore();
  if (!current) return; // Transport still fails closed without a request scope.
  if (!uid || (current.uid && current.uid !== uid)) throw consentRequired();
  current.uid = uid;
}

export function consentRequired() {
  return new HttpsError("failed-precondition", AI_CONSENT_MESSAGE, { code: AI_CONSENT_REQUIRED });
}

export function isAiConsentError(error: unknown): boolean {
  const candidate = error as { details?: { code?: string }; cause?: unknown } | null;
  return candidate?.details?.code === AI_CONSENT_REQUIRED ||
    (!!candidate?.cause && candidate.cause !== error && isAiConsentError(candidate.cause));
}

export function aiConsentRef(uid: string) {
  return getFirestore().doc(`users/${uid}/${AI_CONSENT_DOCUMENT}`);
}

export async function assertAiConsent(uid?: string): Promise<AiConsentRecord> {
  const context = scope.getStore();
  const owner = uid ?? context?.uid;
  if (!owner || (context?.uid && context.uid !== owner)) throw consentRequired();
  await assertAccountActive(owner);
  if ((await getFirestore().doc("releaseControl/ai").get()).data()?.enabled === false) {
    throw new HttpsError("unavailable", "AURA AI is temporarily unavailable. Your manual wardrobe and account settings remain available.", { code: "AI_MAINTENANCE" });
  }
  const snapshot = await aiConsentRef(owner).get();
  const record = snapshot.data() as AiConsentRecord | undefined;
  if (!isCurrentAiConsent(record) || !(record?.updatedAt instanceof Timestamp)) throw consentRequired();
  if (context) {
    if (context.revision !== undefined && context.revision !== record.revision) throw consentRequired();
    context.revision = record.revision;
  }
  return record;
}

export async function updateAiConsent(uid: string, input: {
  status?: unknown; policyVersion?: unknown; expectedRevision?: unknown;
}) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to manage privacy.");
  const { status, policyVersion, expectedRevision } = input;
  if (!["accepted", "declined", "revoked"].includes(String(status)) || policyVersion !== AI_CONSENT_VERSION) {
    throw new HttpsError("invalid-argument", "Review the current privacy disclosure before choosing.");
  }
  const ref = aiConsentRef(uid);
  return getFirestore().runTransaction(async (transaction) => {
    // Privacy decisions contain no media and must remain available during cleanup.
    await assertActiveInTransaction(transaction, uid, false);
    const previous = await transaction.get(ref);
    const revision = Number(previous.get("revision") ?? 0);
    // A delayed Accept must not undo a newer revocation from another device.
    if (status === "accepted" && expectedRevision !== revision) {
      throw new HttpsError("failed-precondition", "Your privacy choice changed. Review it again.");
    }
    transaction.set(ref, {
      status: status as AiConsentStatus, policyVersion: AI_CONSENT_VERSION,
      revision: revision + 1, updatedAt: FieldValue.serverTimestamp(),
    });
    if (status === "accepted") {
      transaction.create(getFirestore().doc(`users/${uid}/aiConsentJobs/${revision + 1}-start`), {
        revision: revision + 1, cursor: null, completed: false,
      });
    }
    return { status: status as AiConsentStatus, policyVersion: AI_CONSENT_VERSION, revision: revision + 1 };
  });
}

// All external AI/search transmissions, including SDK retries, enter here.
// Watch consent until the response body is consumed; discard/abort on revocation.
export const consentedProviderFetch: typeof fetch = async (input, init) => {
  const context = scope.getStore();
  if (!context?.uid) throw consentRequired();
  const owner = context.uid;
  const record = await assertAiConsent(owner);
  const recheck = async () => {
    const latest = await assertAiConsent(owner);
    if (latest.revision !== record.revision) throw consentRequired();
  };
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.protocol !== "https:" || !["api.openai.com", "serpapi.com"].includes(url.hostname)) {
    throw new HttpsError("failed-precondition", "Unapproved AI provider endpoint.");
  }
  const controller = new AbortController();
  const sourceSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort();
  if (sourceSignal?.aborted) controller.abort();
  sourceSignal?.addEventListener("abort", abort, { once: true });
  let denied = false;
  const unsubscribe = aiConsentRef(context.uid).onSnapshot((snapshot) => {
    const current = snapshot.data() as AiConsentRecord | undefined;
    if (!isCurrentAiConsent(current) || !(current?.updatedAt instanceof Timestamp) || current?.revision !== record.revision) {
      denied = true;
      controller.abort();
    }
  }, () => { denied = true; controller.abort(); });
  const unsubscribeDeletion = deletionRef(owner).onSnapshot((snapshot) => {
    if (snapshot.exists) { denied = true; controller.abort(); }
  }, () => { denied = true; controller.abort(); });
  const cleanup = () => {
    unsubscribeDeletion();
    unsubscribe();
    sourceSignal?.removeEventListener("abort", abort);
  };
  try {
    let body = init?.body;
    // Responses must not retain application state at OpenAI by default.
    if (url.hostname === "api.openai.com" && /\/v1\/(responses|chat\/completions)$/.test(url.pathname) && typeof body === "string") {
      body = JSON.stringify({ ...JSON.parse(body), store: false });
    }
    if (denied) throw consentRequired();
    const response = await fetch(input, { ...init, body, signal: controller.signal, redirect: "error" });
    if (denied) throw consentRequired();
    if (!response.body) { await recheck(); cleanup(); return response; }
    const reader = response.body.getReader();
    const guardedBody = new ReadableStream<Uint8Array>({
      async pull(stream) {
        try {
          const next = await reader.read();
          if (denied) throw consentRequired();
          if (next.done) {
            await recheck();
            cleanup();
            stream.close();
          } else stream.enqueue(next.value);
        } catch (error) {
          cleanup();
          controller.abort();
          void reader.cancel().catch(() => undefined);
          stream.error(denied ? consentRequired() : error);
        }
      },
      async cancel() { cleanup(); controller.abort(); await reader.cancel(); },
    });
    return new Response(guardedBody, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) {
    cleanup();
    controller.abort();
    throw denied ? consentRequired() : error;
  }
};
