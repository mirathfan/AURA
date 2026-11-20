import { db } from "@/src/lib/firebase";
import { doc, writeBatch } from "@/src/lib/mediaFirestore";
import { saveSelectedOutfitExtractionItems } from "./outfitExtraction";
import type { ExtractedGarmentPreview } from "@/src/types/OutfitExtraction";

jest.mock("@/src/lib/firebase", () => ({ db: {}, app: {}, storage: {} }));
jest.mock("@/src/lib/mediaFirestore", () => ({ doc: jest.fn((_db, ...segments: string[]) => ({ path: segments.join("/") })), writeBatch: jest.fn() }));
jest.mock("../privacy/consentClient", () => ({}));
jest.mock("@/src/lib/earlyAccess", () => ({}));
jest.mock("@/src/lib/imageOptimization", () => ({}));
jest.mock("@/src/lib/uploadImage", () => ({}));

it("commits a selected extraction as a ready owned closet item with its exact crop and ID", async () => {
  const batch = { set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  jest.mocked(writeBatch).mockReturnValue(batch as unknown as ReturnType<typeof writeBatch>);
  const uid = "owner";
  const traceId = "outfit-42";
  const cropPath = "users/owner/outfitExtraction/trousers.jpg";
  const trousers: ExtractedGarmentPreview = {
    tempId: "piece-2", category: "bottom", subcategory: "trousers", confidence: 0.99,
    boundingBox: { x: 0.368, y: 0.319, w: 0.238, h: 0.618 },
    cropImageUrl: "https://example.test/trousers.jpg", imageQuality: null,
    suggestedName: "white straight-leg trousers", suggestedColors: ["white"],
    extractionWarnings: [], selected: true,
    extractionMetadata: {
      source: "outfit_photo", cropStoragePath: cropPath, polishApplied: false,
      polishWarnings: [], backgroundRemovalApplied: false,
    },
  };
  const draft = {
    traceId, sourceImageUrl: "https://example.test/outfit.jpg",
    sourceStoragePath: "users/owner/outfitExtraction/outfit.jpg",
    detectedItems: [trousers], summary: { totalDetected: 1, extractableCount: 1, failedCount: 0 },
  };
  const result = await saveSelectedOutfitExtractionItems({ uid, draft, items: draft.detectedItems });
  expect(result).toEqual([{ itemId: "outfit-outfit-42-piece-2", tempId: "piece-2" }]);
  expect(doc).toHaveBeenCalledWith(db, "users", uid, "items", result[0].itemId);
  expect(batch.set).toHaveBeenCalledWith({ path: "users/owner/items/outfit-outfit-42-piece-2" }, expect.objectContaining({
    isDraft: false, draftState: "ready", itemLifecycleStatus: "ready", ingestionStatus: "done",
    photoUrl: trousers.cropImageUrl, category: "bottom",
    outfitExtraction: expect.objectContaining({ traceId, tempId: "piece-2" }),
  }));
  expect(batch.commit).toHaveBeenCalledTimes(1);
});
