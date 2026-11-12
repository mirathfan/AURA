import * as AppleAuthentication from "expo-apple-authentication";
import { signOut, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Storage } from "../lib/storage";

const deletionSessions = new Map<string, number>();
// Apple can notify immediately during programmatic revocation. Keep that
// notification from signing out before the durable deletion request is accepted.
export function holdAppleRevocationSignOut(uid: string) {
  deletionSessions.set(uid, (deletionSessions.get(uid) ?? 0) + 1);
  return () => {
    const count = (deletionSessions.get(uid) ?? 1) - 1;
    if (count) deletionSessions.set(uid, count); else deletionSessions.delete(uid);
  };
}
export async function handleAppleCredentialRevoked(user: User) {
  const apple = user.providerData?.find((provider) => provider.providerId === "apple.com");
  if (!apple || auth.currentUser?.uid !== user.uid || deletionSessions.has(user.uid)) return;
  try {
    const state = await AppleAuthentication.getCredentialStateAsync(apple.uid);
    if (auth.currentUser?.uid !== user.uid || deletionSessions.has(user.uid)) return;
    if (state !== AppleAuthentication.AppleAuthenticationCredentialState.REVOKED && state !== AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND) return;
    await Storage.clearUserScopedData(user.uid);
    if (auth.currentUser?.uid === user.uid && !deletionSessions.has(user.uid)) await signOut(auth);
  } catch {
    // Offline/simulator failure is not evidence of revocation. Never log native
    // identity details or force sign-out merely because verification failed.
  }
}
