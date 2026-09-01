/* eslint-disable import/first */
jest.mock("@/src/lib/storage", () => ({
  Storage: {
    getAllKeys: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock("@/src/lib/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

import {
  clearCachedOnboardingDraft,
  getCachedOnboardingDraft,
  LOCAL_CACHE_MAX_AGE_MS,
  ONBOARDING_DRAFT_SCHEMA_VERSION,
  setCachedOnboardingDraft,
} from "@/src/lib/localCache";
import { Storage } from "@/src/lib/storage";
import {
  EMPTY_USER_PROFILE_PREFERENCES,
  normalizeUserProfilePreferences,
} from "@/src/lib/userProfile";
import { restoreOnboardingDraft } from "@/src/onboarding/onboardingDraft";

const UID_A = "user-a";
const UID_B = "user-b";
const KEY_A = "aura:user-a:local-cache:v1:onboarding-draft";
const KEY_B = "aura:user-b:local-cache:v1:onboarding-draft";

function profile(overrides: Record<string, unknown> = {}) {
  return normalizeUserProfilePreferences({
    ...EMPTY_USER_PROFILE_PREFERENCES,
    wardrobeMode: "mixed",
    styleAesthetics: ["casual", "minimal", "vintage"],
    occasionPriority: ["daily", "travel"],
    selectedCategories: ["tops", "bottoms", "shoes"],
    firstName: "Draft Tester",
    body: { height: 71 },
    height: { value: 71, unit: "ft_in" },
    defaultSizes: { shoes: "EU 44" },
    preferredFit: "relaxed",
    budgetPreference: "mid",
    unitsPreference: "imperial",
    ...overrides,
  });
}

describe("onboarding draft persistence", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    jest.mocked(Storage.getItem).mockImplementation(async (key) => values.get(key) ?? null);
    jest.mocked(Storage.setItem).mockImplementation(async (key, value) => {
      values.set(key, value);
    });
    jest.mocked(Storage.removeItem).mockImplementation(async (key) => {
      values.delete(key);
    });
    jest.mocked(Storage.getAllKeys).mockImplementation(async () => [...values.keys()]);
  });

  it("saves and restores every onboarding field with the current step", async () => {
    await setCachedOnboardingDraft(UID_A, { stepIndex: 3, profile: profile() });

    const cached = await getCachedOnboardingDraft(UID_A);
    const restored = restoreOnboardingDraft(
      EMPTY_USER_PROFILE_PREFERENCES,
      cached?.data ?? null,
      4,
    );

    expect(Storage.setItem).toHaveBeenCalledWith(KEY_A, expect.any(String));
    expect(restored).toMatchObject({
      stepIndex: 3,
      profile: {
        wardrobeMode: "mixed",
        styleAesthetics: ["casual", "minimal", "vintage"],
        occasionPriority: ["daily", "travel"],
        selectedCategories: ["tops", "bottoms", "shoes"],
        firstName: "Draft Tester",
        body: { height: 71 },
        height: { value: 71, unit: "ft_in" },
        defaultSizes: expect.objectContaining({ shoes: "EU 44" }),
        preferredFit: "relaxed",
        budgetPreference: "mid",
      },
    });
  });

  it("isolates drafts by both cache key and embedded Firebase UID", async () => {
    await setCachedOnboardingDraft(UID_A, { stepIndex: 2, profile: profile() });

    expect(await getCachedOnboardingDraft(UID_B)).toBeNull();

    values.set(
      KEY_B,
      JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        data: {
          schemaVersion: ONBOARDING_DRAFT_SCHEMA_VERSION,
          uid: UID_A,
          stepIndex: 2,
          profile: profile(),
        },
      }),
    );
    expect(await getCachedOnboardingDraft(UID_B)).toBeNull();
  });

  it("lets a completed canonical profile win over a stale draft", async () => {
    await setCachedOnboardingDraft(UID_A, { stepIndex: 3, profile: profile() });
    const cached = await getCachedOnboardingDraft(UID_A);

    expect(
      restoreOnboardingDraft(
        profile({ onboardingCompleted: true, firstName: "Canonical" }),
        cached?.data ?? null,
        4,
      ),
    ).toBeNull();
  });

  it("clears the draft after successful completion persistence", async () => {
    await setCachedOnboardingDraft(UID_A, { stepIndex: 3, profile: profile() });
    await clearCachedOnboardingDraft(UID_A);

    expect(Storage.removeItem).toHaveBeenCalledWith(KEY_A);
    expect(await getCachedOnboardingDraft(UID_A)).toBeNull();
  });

  it("ignores malformed, wrong-version, and expired drafts", async () => {
    values.set(KEY_A, "not-json");
    expect(await getCachedOnboardingDraft(UID_A)).toBeNull();

    values.set(
      KEY_A,
      JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        data: { schemaVersion: 0, uid: UID_A, stepIndex: 2, profile: profile() },
      }),
    );
    expect(await getCachedOnboardingDraft(UID_A)).toBeNull();

    values.set(
      KEY_A,
      JSON.stringify({
        version: 1,
        updatedAt: Date.now() - LOCAL_CACHE_MAX_AGE_MS.onboardingDraft - 1,
        data: {
          schemaVersion: ONBOARDING_DRAFT_SCHEMA_VERSION,
          uid: UID_A,
          stepIndex: 2,
          profile: profile(),
        },
      }),
    );
    expect(await getCachedOnboardingDraft(UID_A)).toBeNull();
  });

  it("clamps an old out-of-range step to the current flow", () => {
    const restored = restoreOnboardingDraft(
      EMPTY_USER_PROFILE_PREFERENCES,
      {
        schemaVersion: ONBOARDING_DRAFT_SCHEMA_VERSION,
        uid: UID_A,
        stepIndex: 99,
        profile: profile(),
      },
      4,
    );

    expect(restored?.stepIndex).toBe(3);
  });
});
