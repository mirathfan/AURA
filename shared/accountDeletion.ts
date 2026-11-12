export type AppleDeletionStatus = "not_linked" | "revoked" | "manual_required";
export type DeletionStage = "firestore" | "storage" | "rate_limits" | "settle" | "auth" | "verify";
export type DeletionStatus = {
  state: "deleting" | "retry" | "completed";
  stage: DeletionStage;
  apple: AppleDeletionStatus;
};
export function deletionStatusMessage(status: DeletionStatus | null) {
  if (!status) return "Permanently delete your account, closet photos, saved outfits, chats, preferences, and other AURA account data. This cannot be undone.";
  if (status.state === "completed") return "Your AURA account has been deleted.";
  if (status.state === "retry") return "Cleanup was interrupted. Your account is locked against new data. AURA will retry automatically; you can also check again here.";
  return "Your deletion request was accepted. Your account is locked while AURA removes your data. You can close the app; cleanup continues on the server. It normally takes about 10–15 minutes while earlier activity finishes.";
}
export const APPLE_MANUAL_REVOCATION = "Apple authorization could not be confirmed as revoked. You can still delete your AURA account. Remove AURA under Settings → your name → Sign in with Apple, or at account.apple.com. This does not delay deletion of your AURA data.";
