import { AI_CONSENT_MESSAGE, AI_CONSENT_REQUIRED } from "../../shared/aiConsent";
import { FunctionsError } from "firebase/functions";

import { earlyAccessErrorMessage, isEarlyAccessError } from "@/src/lib/earlyAccess";

const RATE_LIMIT_ERROR_CODE = "functions/resource-exhausted";

export function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as FunctionsError).code === RATE_LIMIT_ERROR_CODE
  );
}

export function getFriendlyErrorMessage(error: unknown): string {
  const consentError = error as { code?: string; details?: { code?: string } };
  const releaseMessages: Record<string, string> = {
    CLIENT_UPGRADE_REQUIRED: "Update AURA in TestFlight to continue. Your account and wardrobe are kept. Contact support@getaura.app if you need help.",
    MEDIA_BUSY: "Photos are being maintained. Please try saving again shortly.",
    MEDIA_RETIRED: "This photo has been removed. Upload it again to continue.",
    AI_MAINTENANCE: "AURA AI is temporarily unavailable. You can still manage your wardrobe and account settings.",
  };
  const releaseMessage = releaseMessages[consentError?.details?.code ?? ""];
  if (releaseMessage) return releaseMessage;
  if (consentError?.code === AI_CONSENT_REQUIRED || consentError?.details?.code === AI_CONSENT_REQUIRED) return AI_CONSENT_MESSAGE;
  if (
    (error as { code?: string })?.code === "functions/failed-precondition" &&
    (error as { details?: { code?: string } })?.details?.code === "REQUIRES_RECENT_LOGIN"
  ) {
    return "For your security, sign out and sign back in, then return to Account to delete your account.";
  }
  if (isEarlyAccessError(error)) {
    return earlyAccessErrorMessage(error);
  }
  if (isRateLimitError(error)) {
    return "You're going a bit fast — please wait a moment and try again.";
  }
  return "Something went wrong. Please try again.";
}
