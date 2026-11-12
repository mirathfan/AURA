import { ingestionItemActive, ingestionSourceIdentity } from "./ingestionLifecycle";
import { itemFromStoragePath, ownedItemPath } from "./itemLifecycle";
it("distinguishes source replacement while allowing metadata-only edits", () => {
  const data = { photoUrl: "source", photos: { originalUrl: "source" }, name: "old" };
  expect(ingestionSourceIdentity({ ...data, name: "new" })).toBe(ingestionSourceIdentity(data));
  expect(ingestionSourceIdentity({ ...data, photos: { originalUrl: "new" } })).not.toBe(ingestionSourceIdentity(data));
});
it.each([{ itemLifecycleStatus: "deleted" }, { itemLifecycleStatus: "candidate" }, { draftState: "cancelled" }, { draftState: "awaiting_confirmation" }])("does not promote inactive lifecycle %j", (data) => {
  expect(ingestionItemActive(data)).toBe(false);
});
it("recognizes both nested and legacy flat image ownership without prefix collisions", () => {
  expect(itemFromStoragePath("users/owner/items/shirt.jpg")).toEqual({ uid: "owner", itemId: "shirt" });
  expect(ownedItemPath("users/owner/items/shirt/ingestion/run/thumb.jpg", "owner", "shirt")).toBe(true);
  expect(ownedItemPath("users/owner/items/shirt2.jpg", "owner", "shirt")).toBe(false);
  expect(ownedItemPath("users/other/items/shirt.jpg", "owner", "shirt")).toBe(false);
  expect(itemFromStoragePath("users/owner/tmp/recording.m4a")).toBeNull();
});
