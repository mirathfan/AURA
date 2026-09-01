import type { OnboardingDraftCache } from "@/src/lib/localCache";
import { normalizeUserProfilePreferences } from "@/src/lib/userProfile";
import type { UserProfilePreferences } from "@/src/types/UserProfilePreferences";

export type RestoredOnboardingDraft = {
  stepIndex: number;
  profile: UserProfilePreferences;
};

export function restoreOnboardingDraft(
  canonicalProfile: UserProfilePreferences,
  cachedDraft: OnboardingDraftCache | null,
  stepCount: number,
): RestoredOnboardingDraft | null {
  if (canonicalProfile.onboardingCompleted || !cachedDraft || stepCount <= 0) return null;

  const cachedProfile = cachedDraft.profile;
  const profile = normalizeUserProfilePreferences({
    ...canonicalProfile,
    ...cachedProfile,
    onboardingCompleted: false,
    units: {
      ...canonicalProfile.units,
      ...cachedProfile.units,
    },
    body: {
      ...canonicalProfile.body,
      ...cachedProfile.body,
    },
    height: {
      ...canonicalProfile.height,
      ...cachedProfile.height,
    },
    weight: {
      ...canonicalProfile.weight,
      ...cachedProfile.weight,
    },
    defaultSizes: {
      ...canonicalProfile.defaultSizes,
      ...cachedProfile.defaultSizes,
    },
    advancedFit: {
      ...canonicalProfile.advancedFit,
      ...cachedProfile.advancedFit,
    },
    fitPreferences: {
      ...canonicalProfile.fitPreferences,
      ...cachedProfile.fitPreferences,
    },
    stylePreferences: {
      ...canonicalProfile.stylePreferences,
      ...cachedProfile.stylePreferences,
    },
    materialPreferences: {
      ...canonicalProfile.materialPreferences,
      ...cachedProfile.materialPreferences,
    },
    closetPreferences: {
      ...canonicalProfile.closetPreferences,
      ...cachedProfile.closetPreferences,
    },
    notifications: {
      ...canonicalProfile.notifications,
      ...cachedProfile.notifications,
    },
  });

  return {
    stepIndex: Math.min(cachedDraft.stepIndex, stepCount - 1),
    profile,
  };
}
