import { indexingRetryDelay, indexingFailure, INDEXING_MAX_ATTEMPTS } from "../indexingPolicy";
import { mergeStructuredCandidates } from "../hybridRetrieval";
import { buildClosetItemIntelligenceInput } from "../indexClosetItem";
import { buildWardrobeRetrievalResults, normalizeWardrobeRetrievalInput } from "../retrieval";

it("bounded jitter does not collapse to instant retry or exceed an hour", () => {
  for (let attempt = 1; attempt <= INDEXING_MAX_ATTEMPTS + 10; attempt++) {
    expect(indexingRetryDelay(attempt, 0)).toBeGreaterThanOrEqual(30_000);
    expect(indexingRetryDelay(attempt, 1)).toBeLessThanOrEqual(3_600_000);
    expect(indexingRetryDelay(attempt, 0)).toBeLessThan(indexingRetryDelay(attempt, 1));
  }
});
it.each([
  [{ status: 503, message: "private text" }, false],
  [{ code: "resource-exhausted" }, false],
  [{ code: "invalid-argument" }, true],
  [{ details: { code: "EMBEDDING_CONFIGURATION" } }, true],
  [{ details: { code: "AI_CONSENT_REQUIRED" } }, true],
])("classifies failures without copying exception content", (error, terminal) => {
  expect(indexingFailure(error).terminal).toBe(terminal);
  expect(JSON.stringify(indexingFailure(error))).not.toContain("private text");
});
it("unindexed ready items remain in structured retrieval, drafts do not", () => {
  const items = [{ itemId: "shirt", item: { name: "Blue shirt", category: "top", status: "AVAILABLE", itemLifecycleStatus: "ready", draftState: "ready", ingestionStatus: "done" } },
    { itemId: "draft", item: { name: "Blue shirt", category: "top", isDraft: true } }];
  const candidates = mergeStructuredCandidates([], items);
  const results = buildWardrobeRetrievalResults(normalizeWardrobeRetrievalInput({ query: "shirt" }), candidates, { requireEmbedding: false });
  expect(results.map((item) => item.itemId)).toEqual(["shirt"]);
  expect(results[0].vectorScore).toBeNull();
});
it("preserves valid vector distances and removes stale metadata after edits", () => {
  const base = { name: "Blue shirt", category: "top", status: "AVAILABLE", itemLifecycleStatus: "ready", draftState: "ready", ingestionStatus: "done", colors: ["blue"] };
  const item = { ...base, embeddingVector: [1], embeddingHash: buildClosetItemIntelligenceInput(base).embeddingHash };
  const vectors = [{ itemId: "shirt", item, distance: 0.12 }];
  expect(mergeStructuredCandidates(vectors, vectors)[0].distance).toBe(0.12);
  const edited = [{ itemId: "shirt", item: { ...item, name: "Red trousers", category: "bottom", colors: ["red"], aiMetadata: { category: "top" } } }];
  const result = mergeStructuredCandidates(vectors, edited)[0];
  expect(result.distance).toBeNull();
  expect(result.item.aiMetadata).toBeUndefined();
  expect(result.item.category).toBe("bottom");
  expect(mergeStructuredCandidates(vectors, [])).toEqual([]); // never add a foreign/stale vector hit
});
