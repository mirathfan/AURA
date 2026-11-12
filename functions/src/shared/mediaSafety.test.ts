import { mediaPaths } from "./mediaSafety";
import { applyMediaPatch } from "../prepareMediaWrite";
import { MEDIA_SAFE_FIELDS, mediaProjection } from "../../../shared/mediaSafety";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
it.each([
  "users/u/items/a/p.jpg", "gs://bucket/users/u/items/a/p.jpg",
  "https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Fu%2Fitems%2Fa%2Fp.jpg?token=secret",
  "https://storage.googleapis.com/bucket/users/u/items/a/p.jpg?signature=secret",
  "https://bucket.storage.googleapis.com/users/u/items/a/p.jpg?signature=secret",
])("normalizes a storage reference without recording tokens", (url) => expect([...mediaPaths({ nested: [{ url }] })]).toEqual(["users/u/items/a/p.jpg"]));
it("ignores ordinary retailer URLs and covers arbitrary future nested media", () => expect([...mediaPaths({ future: { image: "users/u/items/a/p.jpg" }, retailer: "https://store.example/image.jpg" })]).toEqual(["users/u/items/a/p.jpg"]));
it("matches Firestore safe fields exactly and protects unknown fields", () => {
  const rules = readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8");
  const match = rules.match(/function mediaSafeFields\(\) \{ return (\[[^;]+\]);/);
  if (!match) throw new Error("Missing media field policy.");
  const fields = JSON.parse(match[1]);
  expect(fields).toEqual([...MEDIA_SAFE_FIELDS]);
  expect(mediaProjection({ updatedAt: 1, newPhoto: { url: "users/u/photo" } })).toEqual({ newPhoto: { url: "users/u/photo" } });
});
it("merges maps but replaces arrays, and handles dotted update paths", () => {
  const original = { photos: { primaryUrl: "a", thumbUrl: "b" }, images: ["a"] };
  expect(applyMediaPatch(original, { mode: "merge", data: { photos: { primaryUrl: "c" }, images: ["c"] } })).toEqual({ photos: { primaryUrl: "c", thumbUrl: "b" }, images: ["c"] });
  expect(applyMediaPatch(original, { mode: "update", data: { "photos.primaryUrl": "c" } })).toEqual({ photos: { primaryUrl: "c", thumbUrl: "b" }, images: ["a"] });
  expect(original.photos.primaryUrl).toBe("a");
});
it("rejects prototype mutation paths", () => expect(() => applyMediaPatch({}, { mode: "update", data: { "__proto__.polluted": true } })).toThrow());
