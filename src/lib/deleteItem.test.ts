/* eslint-disable import/first */
const mockCall = jest.fn();
jest.mock("./firebase", () => ({ app: {}, storage: {} }));
jest.mock("firebase/functions", () => ({ getFunctions: jest.fn(), httpsCallable: jest.fn(() => mockCall) }));
jest.mock("firebase/storage", () => ({ ref: jest.fn((_storage, path) => path), deleteObject: jest.fn() }));
jest.mock("./localCache", () => ({ invalidateClosetItemDeletionCaches: jest.fn() }));
import { deleteObject } from "firebase/storage";
import { invalidateClosetItemDeletionCaches } from "./localCache";
import { deleteWardrobeItem, requestItemDeletion } from "./deleteItem";
beforeEach(() => {
  mockCall.mockResolvedValue({ data: { deleted: true, cleanup: "queued" } });
  jest.mocked(invalidateClosetItemDeletionCaches).mockResolvedValue(undefined);
});
it("uses the authenticated durable deletion callable with the expected account", async () => {
  await deleteWardrobeItem("owner", "shirt", {});
  expect(mockCall).toHaveBeenCalledWith({ uid: "owner", itemId: "shirt", onlyIfEmptyDraft: false });
  expect(deleteObject).not.toHaveBeenCalled();
});
it("preserves caches if the server rejects deletion", async () => {
  mockCall.mockRejectedValueOnce(new Error("permission-denied"));
  await expect(deleteWardrobeItem("owner", "shirt", {})).rejects.toThrow("permission-denied");
  expect(invalidateClosetItemDeletionCaches).not.toHaveBeenCalled();
});
it("waits for confirmation before invalidating caches", async () => {
  let confirm!: (value: unknown) => void;
  mockCall.mockReturnValueOnce(new Promise((resolve) => { confirm = resolve; }));
  const deletion = deleteWardrobeItem("owner", "shirt", {});
  expect(invalidateClosetItemDeletionCaches).not.toHaveBeenCalled();
  confirm({ data: { deleted: true } });
  await deletion;
  expect(invalidateClosetItemDeletionCaches).toHaveBeenCalledWith("owner", "shirt");
});
it("does not abandon durable cleanup when local cache invalidation fails", async () => {
  jest.mocked(invalidateClosetItemDeletionCaches).mockRejectedValueOnce(new Error("cache unavailable"));
  await expect(deleteWardrobeItem("owner", "shirt", {})).resolves.toEqual({ attempted: 0, failed: 0 });
});
it("requests server-side current eligibility for empty draft cleanup", async () => {
  await requestItemDeletion("owner", "draft", true);
  expect(mockCall).toHaveBeenCalledWith({ uid: "owner", itemId: "draft", onlyIfEmptyDraft: true });
});
