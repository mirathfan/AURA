/* eslint-disable import/first */
// Business lifecycle assertions use the SDK mock; media adapter has separate coverage.
jest.mock("./mediaFirestore", () => jest.requireMock("firebase/firestore"));
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockSet = jest.fn();
jest.mock("./firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  runTransaction: jest.fn(async (_db, operation) => operation({ get: mockGet, update: mockUpdate, set: mockSet })),
}));
import { commitUploadedDraft, ensureUploadItem } from "./itemUploadLifecycle";
import type { DocumentReference, DocumentSnapshot } from "firebase/firestore";
const ref = {} as DocumentReference;
const snapshot = (data?: Record<string, unknown>) => ({ exists: () => !!data, data: () => data }) as DocumentSnapshot;
const baseline = snapshot({ name: "Old", draftState: "draft", category: "top" });
beforeEach(() => { mockGet.mockResolvedValue(baseline); });
it("creates a rule-compatible empty owner record before new uploads", async () => {
  mockGet.mockResolvedValue(snapshot());
  await ensureUploadItem("owner", "shirt");
  expect(mockSet).toHaveBeenCalledWith(undefined, expect.objectContaining({ status: "AVAILABLE", category: "top", wearCountSinceWash: 0, isDraft: true }));
});
it("never resets an existing item's lifecycle before uploading", async () => {
  await ensureUploadItem("owner", "shirt"); expect(mockSet).not.toHaveBeenCalled();
});
it("does not recreate an item removed during upload", async () => {
  mockGet.mockResolvedValue(snapshot());
  await expect(commitUploadedDraft(ref, baseline, { photoUrl: "uploaded" }, () => true)).resolves.toBe(false);
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled();
});
it("does not finalize a cancelled request or another account/session", async () => {
  await expect(commitUploadedDraft(ref, baseline, { photoUrl: "uploaded" }, () => false)).resolves.toBe(false);
  expect(mockUpdate).not.toHaveBeenCalled();
});
it("preserves edits made during upload including the category pair", async () => {
  mockGet.mockResolvedValue(snapshot({ name: "My edit", draftState: "draft", category: "outerwear", subCategory: "coat" }));
  await commitUploadedDraft(ref, baseline, { name: null, photoUrl: "uploaded", category: "top", subCategory: "tshirt" }, () => true);
  expect(mockUpdate).toHaveBeenCalledWith(ref, { photoUrl: "uploaded" });
});
it("does not replace a newer photo source", async () => {
  mockGet.mockResolvedValue(snapshot({ name: "Old", photos: { primaryUrl: "newer" } }));
  await expect(commitUploadedDraft(ref, baseline, { photos: { primaryUrl: "older" } }, () => true)).resolves.toBe(false);
  expect(mockUpdate).not.toHaveBeenCalled();
});
it("completes an active unchanged upload", async () => {
  const payload = { photoUrl: "uploaded", ingestionStatus: "pending" };
  await expect(commitUploadedDraft(ref, baseline, payload, () => true)).resolves.toBe(true);
  expect(mockUpdate).toHaveBeenCalledWith(ref, payload);
});
