/* eslint-disable import/first */
jest.mock("@/src/lib/firebase", () => ({
  db: {},
}));

jest.mock("@/src/lib/localCache", () => ({
  setCachedChatList: jest.fn(),
  setCachedRecentMessages: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  increment: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  setDoc: jest.fn(),
  writeBatch: jest.fn(),
}));

jest.mock("@/src/lib/mediaFirestore", () => jest.requireMock("firebase/firestore"));

import { doc, getDoc, increment, writeBatch } from "firebase/firestore";
import { appendMessageToChat, sanitizeAgentResponseForStorage } from "@/src/lib/aiChats";

describe("AURA chat persistence hardening", () => {
  it("removes private fields from persisted agent responses", () => {
    const persisted = sanitizeAgentResponseForStorage({
      mode: "generate_outfit",
      message: "Here is an outfit.",
      suggestedActions: [],
      diagnostics: { langGraph: "private" },
      outfits: [
        {
          outfitId: "outfit-1",
          title: "Office fit",
          scoreBreakdown: { total: 1 },
          items: [
            {
              itemId: "shoe-1",
              name: "Loafers",
              aiMetadata: { rawVector: [1, 2, 3] },
              embeddingVector: [4, 5, 6],
            },
          ],
        },
      ],
    });

    const serialized = JSON.stringify(persisted);
    expect(serialized).not.toContain("diagnostics");
    expect(serialized).not.toContain("scoreBreakdown");
    expect(serialized).not.toContain("aiMetadata");
    expect(serialized).not.toContain("embeddingVector");
    expect(serialized).not.toContain("rawVector");
    expect(persisted).toMatchObject({
      mode: "generate_outfit",
      message: "Here is an outfit.",
      outfits: [
        {
          outfitId: "outfit-1",
          items: [{ itemId: "shoe-1", name: "Loafers" }],
        },
      ],
    });
  });
});


it("restores a missing user prompt on retry and keeps an already saved prompt untouched", async () => {
  const input = { id: "original-prompt", type: "user" as const, text: "Style me today", createdAt: 1 };
  const batch = { set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  jest.mocked(writeBatch).mockReturnValue(batch as unknown as ReturnType<typeof writeBatch>);
  const opts = { skipIfExists: true, titleFromUserText: input.text };
  for (const alreadySaved of [false, true]) {
    jest.mocked(getDoc)
      .mockResolvedValueOnce({ exists: () => false } as Awaited<ReturnType<typeof getDoc>>)
      .mockResolvedValueOnce({ exists: () => alreadySaved } as Awaited<ReturnType<typeof getDoc>>);
    await appendMessageToChat("owner", "chat", input, opts);
  }
  expect(doc).toHaveBeenCalledWith(expect.anything(), "users", "owner", "aiChats", "chat");
  expect(jest.mocked(doc).mock.calls.filter((args) => args.at(-1) === input.id)).toHaveLength(2);
  expect(increment).toHaveBeenCalledTimes(1);
  expect(increment).toHaveBeenCalledWith(1);
  expect(batch.commit).toHaveBeenCalledTimes(1);
});
