import { ACCOUNT_DELETION_CONTRACT } from "../../shared/releaseContract";
import { getFunctions, httpsCallable } from "firebase/functions";
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, type User } from "firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { auth, app } from "../lib/firebase";
import { authorizeAppleAccountDeletion } from "../auth/appleAuth";
import { withGoogleSignInSession } from "../auth/googleSession";
import type { AppleDeletionStatus, DeletionStatus } from "../../shared/accountDeletion";

export function assertSameAccount(user: User) {
  if (auth.currentUser?.uid !== user.uid) throw new Error("Account changed. Start again.");
}
export function isDeletionCancellation(error: unknown) {
  const candidate = error as { code?: string; name?: string };
  return candidate?.code === "ERR_REQUEST_CANCELED" || candidate?.code === "SIGN_IN_CANCELLED" || candidate?.name === "SIGN_IN_CANCELLED";
}
export async function reauthenticateForDeletion(user: User, password?: string) {
  assertSameAccount(user);
  if (password && user.email) {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else if (user.providerData.some((provider) => provider.providerId === "google.com")) {
    await withGoogleSignInSession(async () => {
      const result = await GoogleSignin.signIn();
      if (result.type === "cancelled") throw Object.assign(new Error("Cancelled"), { name: "SIGN_IN_CANCELLED" });
      const tokens = await GoogleSignin.getTokens();
      assertSameAccount(user);
      if (!tokens.idToken) throw new Error("Sign-in could not be verified.");
      await reauthenticateWithCredential(user, GoogleAuthProvider.credential(tokens.idToken));
    });
  } else {
    throw new Error("Enter your password, or sign out and sign back in before deleting.");
  }
  assertSameAccount(user);
  await user.getIdToken(true);
}
export async function prepareAppleDeletion(user: User): Promise<AppleDeletionStatus> {
  assertSameAccount(user);
  if (!user.providerData.some((provider) => provider.providerId === "apple.com")) return "not_linked";
  try {
    const authorizationCode = await authorizeAppleAccountDeletion(user);
    assertSameAccount(user);
    const result = await httpsCallable<{ authorizationCode: string }, { status: AppleDeletionStatus }>(getFunctions(app), "revokeAppleForAccountDeletion")({ authorizationCode });
    assertSameAccount(user);
    return result.data.status === "revoked" ? "revoked" : "manual_required";
  } catch (error) {
    assertSameAccount(user);
    if (isDeletionCancellation(error)) throw error;
    return "manual_required";
  }
}
export async function requestAccountDeletion(user: User, allowAppleFallback = false): Promise<DeletionStatus> {
  assertSameAccount(user);
  const result = await httpsCallable<{ uid: string; allowAppleFallback: boolean; deletionContract: string }, DeletionStatus>(
    getFunctions(app), "deleteAccountData", { timeout: 600_000 },
  )({ uid: user.uid, allowAppleFallback, deletionContract: ACCOUNT_DELETION_CONTRACT });
  assertSameAccount(user);
  if (!["deleting", "retry", "completed"].includes(result.data?.state)) throw new Error("Deletion could not be confirmed.");
  return result.data;
}
export async function readAccountDeletionStatus(user: User) {
  assertSameAccount(user);
  const result = await httpsCallable<void, DeletionStatus | null>(getFunctions(app), "getAccountDeletionStatus")();
  assertSameAccount(user);
  return result.data;
}
