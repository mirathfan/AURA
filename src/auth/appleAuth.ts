import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { OAuthProvider, getAdditionalUserInfo, signInWithCredential, reauthenticateWithCredential, type User } from "firebase/auth";

import { auth } from "@/src/lib/firebase";
import { saveNewUserProfile } from "@/src/auth/userProfile";
import { trackLaunchEvent } from "@/src/lib/analytics";

function createRawNonce() {
  return Array.from(Crypto.getRandomBytes(32))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function signInWithApple(): Promise<void> {
  const rawNonce = createRawNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!appleCredential.identityToken) {
    throw new Error("Apple sign in failed: no identity token");
  }

  const fullName = appleCredential.fullName;
  const displayName = fullName
    ? [fullName.givenName, fullName.familyName].filter(Boolean).join(" ").trim() || null
    : null;

  const provider = new OAuthProvider("apple.com");
  const firebaseCredential = provider.credential({
    idToken: appleCredential.identityToken,
    rawNonce,
  });

  const result = await signInWithCredential(auth, firebaseCredential);
  const additionalUserInfo = getAdditionalUserInfo(result);
  const isNewUser = Boolean(additionalUserInfo?.isNewUser);

  if (isNewUser) {
    await saveNewUserProfile(result.user.uid, displayName ?? result.user.displayName, result.user.email);
    void trackLaunchEvent({
      userId: result.user.uid,
      eventName: "auth_signed_up",
      properties: {
        provider: "apple",
      },
    });
  }
  void trackLaunchEvent({
    userId: result.user.uid,
    eventName: "auth_sign_in_succeeded",
    properties: {
      provider: "apple",
      isNewUser,
    },
  });
}

// Reauthentication (not sign-in) binds the native Apple result to the current
// Firebase account. A linked account is checked even if login used Google/email.
export async function authorizeAppleAccountDeletion(user: User): Promise<string> {
  const rawNonce = createRawNonce();
  const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const credential = await AppleAuthentication.signInAsync({ requestedScopes: [], nonce });
  if (auth.currentUser?.uid !== user.uid) throw new Error("Account changed. Start again.");
  if (!credential.identityToken || !credential.authorizationCode) throw new Error("Fresh Apple authorization is unavailable.");
  const result = await reauthenticateWithCredential(user, new OAuthProvider("apple.com").credential({ idToken: credential.identityToken, rawNonce }));
  if (result.user.uid !== user.uid || auth.currentUser?.uid !== user.uid) throw new Error("Account changed. Start again.");
  await user.getIdToken(true);
  return credential.authorizationCode;
}
