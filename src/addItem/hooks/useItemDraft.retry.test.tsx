import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import { router } from "expo-router";
import { Category } from "../../shared/wardrobeTaxonomy";
import { useItemDraft } from "./useItemDraft";

type Data = Record<string, unknown>;
type Ref = { id: string; path: string };
type Transaction = {
  get: (ref: Ref) => Promise<{ exists: () => boolean; data: () => Data }>;
  set: (ref: Ref, data: Data) => void;
  update: (ref: Ref, data: Data) => void;
};
type Failure = "none" | "before" | "after" | "upload";
const mockStore = new Map<string, Data>();
let mockFailure: Failure = "none";
let mockAllocations = 0;
let mockWrites = 0;
let mockRace: (() => void) | undefined;
const mockSnapshot = (ref: Ref) => {
  const value = mockStore.get(ref.id);
  const copy = value ? JSON.parse(JSON.stringify(value)) as Data : undefined;
  return { exists: () => copy !== undefined, data: () => copy ?? {} };
};
const mockCommit = async (ref: Ref, data: Data, merge = false) => {
  mockWrites++;
  if (mockFailure === "before" && mockWrites === 1) throw new Error("Synthetic pre-commit rejection");
  mockStore.set(ref.id, merge ? { ...mockStore.get(ref.id), ...data } : { ...data });
  // Deliberate ambiguity injection, not a claim about Firebase SDK behavior.
  if (mockFailure === "after" && mockWrites === 1) throw new Error("Synthetic applied-write rejection");
};

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@/src/lib/mediaFirestore", () => ({
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join("/") }),
  doc: (...args: unknown[]) => {
    if (args.length === 1) {
      const id = `generated-${++mockAllocations}`;
      return { id, path: `${(args[0] as Ref).path}/${id}` };
    }
    const parts = args.slice(1) as string[];
    return { id: parts[parts.length - 1], path: parts.join("/") };
  },
  getDoc: async (ref: Ref) => mockSnapshot(ref),
  getDocs: async () => ({ empty: true, docs: [] }),
  query: (value: unknown) => value,
  limit: jest.fn(), orderBy: jest.fn(),
  setDoc: (ref: Ref, data: Data) => mockCommit(ref, data),
  updateDoc: (ref: Ref, data: Data) => mockCommit(ref, data, true),
  runTransaction: async (_db: unknown, callback: (tx: Transaction) => Promise<void>) => {
    let writes: (() => void)[] = [];
    const tx: Transaction = {
      get: async (ref) => mockSnapshot(ref),
      set: (ref, data) => { writes.push(() => mockStore.set(ref.id, { ...data })); },
      update: (ref, data) => { writes.push(() => mockStore.set(ref.id, { ...mockStore.get(ref.id), ...data })); },
    };
    await callback(tx);
    if (mockRace) {
      const mutation = mockRace;
      mockRace = undefined;
      mutation();
      writes = []; // Model optimistic retry; the first callback never committed.
      await callback(tx);
    }
    writes.forEach((write) => write());
  },
}));
jest.mock("../controllerShared", () => ({
  norm: (value: unknown) => String(value ?? "").trim(),
  normColor: (value: unknown) => String(value ?? "").trim(),
}));
jest.mock("../../lib/firebase", () => ({ db: {} }));
jest.mock("../../lib/analytics", () => ({ analyticsErrorProperties: () => ({}), trackLaunchEvent: jest.fn(async () => {}) }));
jest.mock("../../lib/navigation", () => ({ safeGoBack: jest.fn() }));
jest.mock("../../lib/photoPipelineLogger", () => ({ photoPipelineNow: () => 0, photoPipelineDuration: () => 0, safeErrorData: () => ({}) }));
jest.mock("../../lib/toast", () => ({ Toast: { itemAdded: jest.fn(), success: jest.fn() } }));
jest.mock("../../lib/items", () => ({ normalizeCategoryForStorage: (value: unknown) => value }));

beforeEach(() => {
  mockStore.clear(); mockFailure = "none"; mockAllocations = 0; mockWrites = 0; mockRace = undefined;
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function mount(options: { failure?: Failure; draft?: boolean; edit?: boolean } = {}) {
  mockFailure = options.failure ?? "none";
  const existingId = "existing-item";
  if (options.draft || options.edit) mockStore.set(existingId, { name: "Draft", category: "top", isDraft: !!options.draft });
  let uploadAttempts = 0;
  const targets: string[] = [];
  const photoRef = { current: {
    state: { selectedPhotos: [{ id: "photo-1" }], pendingPhotoUri: "file://synthetic.jpg", pendingPhotoHash: "synthetic-hash" },
    refs: { syncedPreviewUriRef: { current: null } },
    actions: {
      setUploadingPhoto: jest.fn(),
      resolvePhotoFields: async (uid: string, id: string) => {
        targets.push(id);
        if (mockFailure === "upload" && ++uploadAttempts === 1) throw new Error("Synthetic upload rejection");
        const original = `users/${uid}/items/${id}/uploads/synthetic/original.jpg`;
        const cleaned = `users/${uid}/items/${id}/uploads/synthetic/cutout.png`;
        return { originalUrl: original, photoUrl: original, photoUri: null, cleanedUrl: cleaned, refinedUrl: null,
          imageQuality: null, productPolish: null, imageSource: "original", cutoutSourceKind: "original",
          imageUrls: [original], images: [{ originalUrl: original, cleanedUrl: cleaned, isPrimary: true }] };
      },
    },
  } };
  const extractionRef = { current: { state: { draftItemId: options.draft ? existingId : null, ingestionStatus: "consent_required" }, refs: { isFinalizingRef: { current: false } }, actions: {} } };
  const resetCreateFlowRef = { current: jest.fn(async () => {}) };
  const props = { uid: "synthetic-user", session: "session-1" };
  const hook = renderHook(({ uid, session }: typeof props) => useItemDraft({ uid, mode: options.edit ? "edit" : "create", isEdit: !!options.edit,
    editItemId: options.edit ? existingId : null, initialCategory: Category.TOP, formSessionKey: session,
    photoRef, extractionRef, resetCreateFlowRef }), { initialProps: props });
  const edit = (name: string) => act(() => { hook.result.current.actions.setName(name); });
  act(() => {
    hook.result.current.actions.setName("User shirt"); hook.result.current.actions.setBrand("Unbranded");
    hook.result.current.actions.setNotes("Keep notes"); hook.result.current.actions.setSelectedColors(["blue"]);
  });
  return { ...hook, targets, edit, save: async () => { await act(async () => { await hook.result.current.actions.saveItem(); }); } };
}

it.each<Failure>(["after", "before", "upload"])("reuses identity after %s while applying current edits", async (failure) => {
  const h = mount({ failure }); await h.save(); expect(router.replace).not.toHaveBeenCalled();
  h.edit("Revised name"); await h.save();
  expect(mockStore.size).toBe(1); expect(mockAllocations).toBe(1); expect(new Set(h.targets).size).toBe(1);
  expect(mockStore.get("generated-1")).toMatchObject({ name: "Revised name", notes: "Keep notes" });
  expect(mockStore.get("generated-1")?.ingestion).toBeUndefined();
});
it("preserves lifecycle, creation time, unrelated fields and original/cutout references", async () => {
  const h = mount({ failure: "after" }); await h.save(); const first = mockStore.get("generated-1")!;
  mockStore.set("generated-1", { ...first, status: "WORN", wearCountSinceWash: 3, lastWornDate: "2026-11-10", lastWashedAt: 1234, notes: "Remote note", serverReview: { version: 7 } });
  h.edit("Revised name"); await h.save();
  expect(mockStore.get("generated-1")).toMatchObject({ name: "Revised name", createdAt: first.createdAt, status: "WORN", wearCountSinceWash: 3, lastWornDate: "2026-11-10", lastWashedAt: 1234, notes: "Remote note", serverReview: { version: 7 }, photos: first.photos });
  expect(mockWrites).toBe(1);
});
it.each([false, true])("refuses a same-field conflict (concurrent retry=%s)", async (race) => {
  const h = mount({ failure: "after" }); await h.save();
  const mutation = () => mockStore.set("generated-1", { ...mockStore.get("generated-1"), name: "Other session" });
  if (race) mockRace = mutation; else mutation();
  h.edit("My retry"); await h.save(); expect(mockStore.get("generated-1")?.name).toBe("Other session");
  expect(router.replace).not.toHaveBeenCalled(); expect(Alert.alert).toHaveBeenLastCalledWith("Item changed", expect.stringContaining("may have completed"));
  expect(h.result.current.state.loading).toBe(false);
});
it("preserves a concurrent lifecycle change while applying intended edits", async () => {
  const h = mount({ failure: "after" }); await h.save(); h.edit("My retry");
  mockRace = () => mockStore.set("generated-1", { ...mockStore.get("generated-1"), status: "IN_LAUNDRY", wearCountSinceWash: 8 });
  await h.save(); expect(mockStore.get("generated-1")).toMatchObject({ name: "My retry", status: "IN_LAUNDRY", wearCountSinceWash: 8 });
});
it.each<Data>([
  { isDraft: true, draftState: "draft" },
  { isDraft: false, draftState: "cancelled" },
  { isDraft: false, draftState: "ready", itemLifecycleStatus: "deleted" },
])("refuses an unsafe existing draft: %j", async (state) => {
  const h = mount({ failure: "before" }); await h.save();
  const persisted = { ...state, name: "Changed draft" };
  mockStore.set("generated-1", persisted);
  await h.save(); expect(mockStore.get("generated-1")).toEqual(persisted);
  expect(router.replace).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenLastCalledWith("Item changed", expect.any(String));
});
it.each(["uid", "session"] as const)("isolates pending identity on %s change", async (key) => {
  const h = mount({ failure: "before" }); await h.save();
  h.rerender({ uid: key === "uid" ? "second-user" : "synthetic-user", session: key === "session" ? "session-2" : "session-1" });
  h.edit("Fresh form"); await h.save(); expect(mockAllocations).toBe(2);
});
it("guards rapid/repeated success and clears pending identity for a fresh form", async () => {
  const h = mount(); await act(async () => { await Promise.all([h.result.current.actions.saveItem(), h.result.current.actions.saveItem()]); });
  await h.save(); expect(mockWrites).toBe(1);
  h.rerender({ uid: "synthetic-user", session: "session-2" }); h.edit("Next item"); await h.save(); expect(mockStore.size).toBe(2);
});
it.each(["draft", "edit"] as const)("keeps the existing ID in the %s branch", async (branch) => {
  const h = mount({ [branch]: true, failure: "after" }); await act(async () => {});
  h.edit("Saved item"); await h.save(); h.edit("Retry edit"); await h.save();
  expect(mockAllocations).toBe(0); expect(mockStore.size).toBe(1); expect(mockStore.get("existing-item")?.name).toBe("Retry edit");
});
