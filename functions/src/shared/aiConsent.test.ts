import { Timestamp } from "firebase-admin/firestore";
import { AI_CONSENT_VERSION } from "../../../shared/aiConsent";
import { assertAiConsent, consentedProviderFetch, isAiConsentError, runWithAiConsentScope, setAiConsentUser, updateAiConsent } from "./aiConsent";
import OpenAI from "./consentedOpenAI";

const records = new Map<string, Record<string, unknown>>();
const listeners = new Map<string, (value: { data: () => unknown }) => void>();
const writes = jest.fn();
const ref = (path: string) => ({ path,
  get: async () => ({ exists: records.has(path), data: () => records.get(path) }),
  onSnapshot: (next: (value: { data: () => unknown }) => void) => {
    listeners.set(path, next);
    return () => listeners.delete(path);
  },
});
jest.mock("firebase-admin/firestore", () => ({
  ...jest.requireActual("firebase-admin/firestore"),
  getFirestore: () => ({ doc: ref, collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }), runTransaction: async (fn: (tx: unknown) => unknown) => fn({
    get: async (r: { path: string }) => ({ exists: records.has(r.path), get: (field: string) => records.get(r.path)?.[field] }),
    set: writes, create: writes,
  }) }),
}));
const path = (uid = "one") => `users/${uid}/privacy/aiConsent`;
function seed(status = "accepted", revision = 1, uid = "one", policyVersion = AI_CONSENT_VERSION) {
  records.set(path(uid), { status, revision, policyVersion, updatedAt: Timestamp.now() });
  listeners.get(path(uid))?.({ data: () => records.get(path(uid)) });
}
function scoped<T>(fn: () => T, uid = "one") {
  return runWithAiConsentScope(() => { setAiConsentUser(uid); return fn(); });
}
const providerUrl = "https://api.openai.com/v1/responses";
const originalFetch = global.fetch;
beforeEach(() => { records.clear(); listeners.clear(); global.fetch = jest.fn(async () => new Response("{}")); });
afterEach(() => { global.fetch = originalFetch; });

it.each(["missing", "declined", "revoked", "outdated"])("blocks %s consent without sending data", async (state) => {
  if (state !== "missing") seed(state === "outdated" ? "accepted" : state, 1, "one", state === "outdated" ? "old" : AI_CONSENT_VERSION);
  await expect(scoped(() => consentedProviderFetch(providerUrl))).rejects.toMatchObject({ details: { code: "AI_CONSENT_REQUIRED" } });
  expect(fetch).not.toHaveBeenCalled();
});

it("fails closed outside a verified user scope and for invalid timestamps", async () => {
  seed();
  await expect(consentedProviderFetch(providerUrl)).rejects.toThrow();
  records.set(path(), { ...records.get(path()), updatedAt: "client timestamp" });
  await expect(scoped(() => assertAiConsent())).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

it("sends accepted data with response storage off and cleans up the listener", async () => {
  seed();
  const response = await scoped(() => consentedProviderFetch(providerUrl, { method: "POST", body: JSON.stringify({ input: "synthetic", store: true }) }));
  // Consume outside the originating async scope, as SDK streams may do.
  expect(await response.json()).toEqual({});
  expect(JSON.parse((jest.mocked(fetch).mock.calls[0][1]?.body as string))).toEqual({ input: "synthetic", store: false });
  expect(listeners.size).toBe(0);
});

it("does not let a concurrent user's acceptance authorize another account", async () => {
  seed();
  const results = await Promise.allSettled([
    scoped(async () => (await consentedProviderFetch(providerUrl)).text()),
    scoped(() => consentedProviderFetch(providerUrl), "two"),
  ]);
  expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("aborts an active response and rejects its body when consent is revoked", async () => {
  seed();
  const response = await scoped(() => consentedProviderFetch(providerUrl));
  seed("revoked", 2);
  await expect(response.text()).rejects.toThrow();
  expect(jest.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(listeners.size).toBe(0);
});

it("rejects old work even if revocation is followed by reacceptance", async () => {
  seed();
  await scoped(async () => {
    await assertAiConsent();
    seed("revoked", 2); seed("accepted", 3);
    await expect(consentedProviderFetch(providerUrl)).rejects.toThrow();
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("the real OpenAI SDK retries through the guard without another paid transmission", async () => {
  seed();
  jest.mocked(fetch).mockImplementationOnce(async () => {
    seed("revoked", 2);
    return new Response("{}", { status: 500 });
  });
  await expect(scoped(() => new OpenAI({ apiKey: "synthetic-not-a-key", maxRetries: 1 }).responses.create({ model: "fixture", input: "synthetic" })))
    .rejects.toBeDefined();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("rejects non-provider endpoints without sending data", async () => {
  seed();
  await expect(scoped(() => consentedProviderFetch("https://example.org"))).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

it("acceptance needs the current revision and policy; unauthenticated and forged choices fail", async () => {
  seed("revoked", 2);
  await expect(updateAiConsent("one", { status: "accepted", expectedRevision: 1, policyVersion: AI_CONSENT_VERSION })).rejects.toThrow();
  await expect(updateAiConsent("one", { status: "accepted", expectedRevision: 2, policyVersion: "old" })).rejects.toThrow();
  await expect(updateAiConsent("", { status: "accepted" })).rejects.toThrow();
  expect(writes).not.toHaveBeenCalled();
  expect(isAiConsentError({ cause: { details: { code: "AI_CONSENT_REQUIRED" } } })).toBe(true);
});

it("account deletion blocks provider retries and aborts an in-flight response", async () => {
  seed();
  const response = await scoped(() => consentedProviderFetch(providerUrl));
  records.set("accountDeletionJobs/one", { state: "deleting" });
  (listeners.get("accountDeletionJobs/one") as ((value: unknown) => void) | undefined)?.({ exists: true });
  await expect(response.text()).rejects.toThrow();
  await expect(scoped(() => consentedProviderFetch(providerUrl))).rejects.toMatchObject({ details: { code: "ACCOUNT_DELETING" } });
  expect(fetch).toHaveBeenCalledTimes(1);
});
