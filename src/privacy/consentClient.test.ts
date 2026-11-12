import { getDocFromServer } from "firebase/firestore";
import { AI_CONSENT_VERSION } from "../../shared/aiConsent";
import { allowAiLocally, blockAiLocally, requireClientAiConsent, saveAiConsent } from "./consentClient";

const mockAuth = { currentUser: { uid: "one" } as { uid: string } | null };
const mockUpdate = jest.fn(async () => ({}));
jest.mock("../lib/firebase", () => ({ app: {}, db: {}, get auth() { return mockAuth; } }));
jest.mock("firebase/firestore", () => ({ doc: jest.fn((...args) => args), getDocFromServer: jest.fn() }));
jest.mock("firebase/functions", () => ({ getFunctions: jest.fn(), httpsCallable: () => mockUpdate }));
const accepted = { status: "accepted", policyVersion: AI_CONSENT_VERSION, revision: 1, updatedAt: new Date() };
const snapshot = (record: unknown) => ({ data: () => record }) as never;
beforeEach(() => { mockAuth.currentUser = { uid: "one" }; allowAiLocally("one"); allowAiLocally("two"); });

it.each([undefined, { ...accepted, status: "declined" }, { ...accepted, status: "revoked" }, { ...accepted, policyVersion: "old" }])("denies missing or unapproved records", async (record) => {
  jest.mocked(getDocFromServer).mockResolvedValue(snapshot(record));
  await expect(requireClientAiConsent()).rejects.toMatchObject({ code: "AI_CONSENT_REQUIRED" });
});

it("requires a fresh server read on every request", async () => {
  jest.mocked(getDocFromServer).mockResolvedValueOnce(snapshot(accepted)).mockResolvedValueOnce(snapshot({ ...accepted, status: "revoked" }));
  await expect(requireClientAiConsent()).resolves.toBeUndefined();
  await expect(requireClientAiConsent()).rejects.toThrow();
  expect(getDocFromServer).toHaveBeenCalledTimes(2);
});

it("rejects an old account's delayed answer after account switching", async () => {
  jest.mocked(getDocFromServer).mockImplementationOnce(async () => {
    mockAuth.currentUser = { uid: "two" };
    return snapshot(accepted);
  });
  await expect(requireClientAiConsent()).rejects.toThrow();
});

it("keeps failed revocation blocked locally per account", async () => {
  jest.mocked(getDocFromServer).mockResolvedValue(snapshot(accepted));
  blockAiLocally("one");
  await expect(requireClientAiConsent()).rejects.toThrow();
  mockAuth.currentUser = { uid: "two" };
  await expect(requireClientAiConsent()).resolves.toBeUndefined();
  mockAuth.currentUser = { uid: "one" };
  await expect(requireClientAiConsent()).rejects.toThrow();
});

it("sends only a choice and current version/revision, never a user-supplied UID or timestamp", async () => {
  await saveAiConsent("accepted", 2);
  expect(mockUpdate).toHaveBeenCalledWith({ status: "accepted", expectedRevision: 2, policyVersion: AI_CONSENT_VERSION });
});
