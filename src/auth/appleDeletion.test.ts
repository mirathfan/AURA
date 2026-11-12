import * as Apple from "expo-apple-authentication";
import { reauthenticateWithCredential, OAuthProvider } from "firebase/auth";
import { authorizeAppleAccountDeletion } from "./appleAuth";
let mockUser: any;
jest.mock("../lib/firebase", () => ({ auth: { get currentUser() { return mockUser; } } }));
jest.mock("./userProfile", () => ({ saveNewUserProfile: jest.fn() }));
jest.mock("../lib/analytics", () => ({ trackLaunchEvent: jest.fn() }));
jest.mock("expo-crypto", () => ({ getRandomBytes: () => new Uint8Array(32).fill(1), digestStringAsync: jest.fn(async () => "hashed-nonce"), CryptoDigestAlgorithm: { SHA256: "SHA256" } }));
jest.mock("expo-apple-authentication", () => ({ signInAsync: jest.fn() }));
const mockCredential = jest.fn(() => "verified-sdk-credential");
jest.mock("firebase/auth", () => ({ OAuthProvider: jest.fn(() => ({ credential: mockCredential })), reauthenticateWithCredential: jest.fn() }));
beforeEach(() => {
  mockUser = { uid: "owner", getIdToken: jest.fn(async () => "token") };
  jest.mocked(Apple.signInAsync).mockResolvedValue({ identityToken: "synthetic-identity", authorizationCode: "synthetic-code" } as never);
  jest.mocked(reauthenticateWithCredential).mockResolvedValue({ user: mockUser } as never);
});
it("uses a fresh hashed nonce and reauthenticates the same user before releasing the code", async () => {
  expect(await authorizeAppleAccountDeletion(mockUser)).toBe("synthetic-code");
  expect(Apple.signInAsync).toHaveBeenCalledWith({ nonce: "hashed-nonce", requestedScopes: [] });
  expect(OAuthProvider).toHaveBeenCalledWith("apple.com");
  expect(mockCredential).toHaveBeenCalledWith({ idToken: "synthetic-identity", rawNonce: "01".repeat(32) });
  expect(reauthenticateWithCredential).toHaveBeenCalledWith(mockUser, "verified-sdk-credential");
  expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
});
it.each(["ERR_REQUEST_CANCELED", "auth/user-mismatch", "auth/invalid-credential"])("does not release a code on %s", async (code) => {
  jest.mocked(reauthenticateWithCredential).mockRejectedValue({ code });
  await expect(authorizeAppleAccountDeletion(mockUser)).rejects.toEqual({ code });
  expect(mockUser.getIdToken).not.toHaveBeenCalled();
});
it("rejects an account switch while the native authorization sheet was open", async () => {
  const original = mockUser;
  jest.mocked(Apple.signInAsync).mockImplementation(async () => { mockUser = { uid: "other" }; return { identityToken: "id", authorizationCode: "code" } as never; });
  await expect(authorizeAppleAccountDeletion(original)).rejects.toThrow("Account changed");
  expect(reauthenticateWithCredential).not.toHaveBeenCalled();
});
