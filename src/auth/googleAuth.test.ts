import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { signInWithGoogle } from "./googleAuth";
import { isGoogleSignInActive } from "./googleSession";
import { normalizeIncomingLink } from "../navigation/incomingLinks";
import { getAuthErrorMessage } from "./authErrors";

jest.mock("@react-native-google-signin/google-signin", () => ({ GoogleSignin: {
  hasPlayServices: jest.fn(), signIn: jest.fn(), getTokens: jest.fn(), configure: jest.fn(),
} }));
jest.mock("firebase/auth", () => ({
  GoogleAuthProvider: { credential: jest.fn(() => "sdk-credential") },
  signInWithCredential: jest.fn(), getAdditionalUserInfo: jest.fn(() => ({ isNewUser: false })),
}));
jest.mock("./userProfile", () => ({ saveNewUserProfile: jest.fn() }));
jest.mock("../lib/analytics", () => ({ trackLaunchEvent: jest.fn() }));
jest.mock("../lib/firebase", () => ({ auth: {} }));

beforeEach(() => {
  jest.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
  jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: "success", data: {} } as never);
  jest.mocked(GoogleSignin.getTokens).mockResolvedValue({ idToken: "native-sdk-id-token", accessToken: "native-token" });
  jest.mocked(signInWithCredential).mockResolvedValue({ user: { uid: "test" } } as never);
});

it("only authenticates using tokens returned by the native SDK after a successful session", async () => {
  let finish!: (result: never) => void;
  jest.mocked(GoogleSignin.signIn).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const session = signInWithGoogle();
  await Promise.resolve();
  expect(isGoogleSignInActive()).toBe(true);
  expect(normalizeIncomingLink("com.googleusercontent.apps.123:/oauthredirect?code=untrusted&state=untrusted", {
    googleActive: isGoogleSignInActive(),
  })).toBe("");
  expect(signInWithCredential).not.toHaveBeenCalled();
  await expect(signInWithGoogle()).rejects.toMatchObject({ name: "IN_PROGRESS" });
  finish({ type: "success", data: {} } as never);
  await session;
  expect(GoogleAuthProvider.credential).toHaveBeenCalledWith("native-sdk-id-token");
  expect(signInWithCredential).toHaveBeenCalledTimes(1);
  expect(isGoogleSignInActive()).toBe(false);
});
it("cancellation clears the session and never reads/exchanges tokens", async () => {
  jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: "cancelled", data: null });
  await expect(signInWithGoogle()).rejects.toMatchObject({ name: "SIGN_IN_CANCELLED" });
  expect(GoogleSignin.getTokens).not.toHaveBeenCalled();
  expect(signInWithCredential).not.toHaveBeenCalled();
  expect(isGoogleSignInActive()).toBe(false);
  expect(getAuthErrorMessage({ name: "SIGN_IN_CANCELLED" })).toBe("Sign in cancelled");
});
it.each(["SIGN_IN_CANCELLED", "state_mismatch", "expired_callback", "network_error"])("preserves the SDK rejection %s without exchanging tokens", async (code) => {
  const error = { code, message: "private authorization response" };
  jest.mocked(GoogleSignin.signIn).mockRejectedValue(error);
  await expect(signInWithGoogle()).rejects.toBe(error);
  expect(GoogleSignin.getTokens).not.toHaveBeenCalled();
  expect(signInWithCredential).not.toHaveBeenCalled();
  expect(getAuthErrorMessage(error)).not.toContain("private");
  expect(isGoogleSignInActive()).toBe(false);
});
it("does not authenticate if the SDK has no ID token", async () => {
  jest.mocked(GoogleSignin.getTokens).mockResolvedValue({ idToken: "", accessToken: "ignored" });
  await expect(signInWithGoogle()).rejects.toThrow("no idToken");
  expect(signInWithCredential).not.toHaveBeenCalled();
  expect(isGoogleSignInActive()).toBe(false);
});
it("unsolicited callbacks cannot start or finish sign-in", () => {
  const result = normalizeIncomingLink("com.googleusercontent.apps.123:/oauthredirect?id_token=untrusted&state=expired", {});
  expect(result).toBe("/(auth)/login");
  expect(GoogleSignin.signIn).not.toHaveBeenCalled();
  expect(GoogleSignin.getTokens).not.toHaveBeenCalled();
  expect(signInWithCredential).not.toHaveBeenCalled();
});
