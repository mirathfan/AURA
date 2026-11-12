export const AI_CONSENT_VERSION = "2026-10-10";
export const AI_CONSENT_DOCUMENT = "privacy/aiConsent";
export const AI_CONSENT_REQUIRED = "AI_CONSENT_REQUIRED";
export const AI_CONSENT_MESSAGE = "AI sharing is off. Review Privacy & AI in Profile to enable it. You can still upload photos and manage your closet manually.";

export type AiConsentStatus = "accepted" | "declined" | "revoked";
export type AiConsentRecord = {
  status: AiConsentStatus;
  policyVersion: string;
  revision: number;
  updatedAt: unknown;
};

export function isCurrentAiConsent(value: Partial<AiConsentRecord> | null | undefined): boolean {
  return value?.status === "accepted" && value.policyVersion === AI_CONSENT_VERSION &&
    Number.isSafeInteger(value.revision) && Number(value.revision) > 0 && value.updatedAt != null;
}

// Beta 1: consent does not enable the excluded refinement feature.
export const BETA_AI_FEATURES = { outfitExtraction: true, aiPolish: false } as const;
