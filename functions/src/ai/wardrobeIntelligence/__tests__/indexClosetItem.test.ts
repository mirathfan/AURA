import { Timestamp } from "firebase-admin/firestore";
import { AI_CONSENT_VERSION } from "../../../../../shared/aiConsent";
import type { DocumentReference } from "firebase-admin/firestore";
import { createTextEmbedding } from "../embeddings";
import { indexClosetItemIntelligence } from "../indexClosetItem";

jest.mock("../../../shared/aiConsent", () => ({
  ...jest.requireActual("../../../shared/aiConsent"),
  assertAiConsent: jest.fn(async () => ({ revision: 1 })),
  aiConsentRef: () => ({ path: "users/owner/privacy/aiConsent" }),
}));

jest.mock("../embeddings", () => ({ createTextEmbedding: jest.fn(async () => [0.1, 0.2]) }));

jest.mock("firebase-admin/firestore", () => ({ ...jest.requireActual("firebase-admin/firestore"), getFirestore: () => ({ doc: (path: string) => ({ path }), collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }) }) }));

const item = { name: "Blue shirt", category: "top", status: "AVAILABLE", colors: ["blue"] };

function document(current: Record<string, unknown> | undefined, deleting = false) {
  const transaction = { get: jest.fn(async (r: {path: string}) => ({ exists: r.path.startsWith("accountDeletionJobs/") && deleting, get: (key: string) => key === "revision" ? 1 : undefined, data: () => r.path.includes("privacy/aiConsent") ? { status: "accepted", policyVersion: AI_CONSENT_VERSION, revision: 1, updatedAt: Timestamp.now() } : r.path.startsWith("users/") ? current : undefined })), set: jest.fn() };
  const ref = {
    path: "users/owner/items/shirt",
    firestore: { runTransaction: jest.fn(async (fn) => fn(transaction)) },
  } as unknown as DocumentReference;
  return { ref, transaction };
}

describe("index completion during closet changes", () => {
  it.each([
    ["deleted", undefined],
    ["edited", { ...item, name: "Red sweater", colors: ["red"] }],
    ["cancelled", { ...item, draftState: "cancelled" }],
  ])("does not overwrite or recreate a %s item after embedding completes", async (_name, current) => {
    const { ref, transaction } = document(current);
    const result = await indexClosetItemIntelligence({ itemId: "shirt", item, ref });
    expect(createTextEmbedding).toHaveBeenCalled();
    expect(result.status).toBe("skipped");
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("persists intelligence only for the current item version", async () => {
    const { ref, transaction } = document(item);
    const result = await indexClosetItemIntelligence({ itemId: "shirt", item, ref });
    expect(result.status).toBe("indexed");
    expect(transaction.set).toHaveBeenCalledWith(ref, expect.objectContaining({
      embeddingHash: result.embeddingHash,
    }), { merge: true });
  });
});

it("discards a delayed embedding completion after account deletion starts", async () => {
  const { ref, transaction } = document(item, true);
  await expect(indexClosetItemIntelligence({ itemId: "shirt", item, ref })).rejects.toMatchObject({ details: { code: "ACCOUNT_DELETING" } });
  expect(transaction.set).not.toHaveBeenCalled();
});
