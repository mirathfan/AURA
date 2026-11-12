import { signOut } from "firebase/auth";
import * as Apple from "expo-apple-authentication";
import { handleAppleCredentialRevoked, holdAppleRevocationSignOut } from "./appleRevocation";
let mockUser: any;
jest.mock("../lib/firebase", () => ({ auth: { get currentUser() { return mockUser; } } }));
jest.mock("../lib/storage", () => ({ Storage: { clearUserScopedData: jest.fn(async () => undefined) } }));
jest.mock("firebase/auth", () => ({ signOut: jest.fn(async () => undefined) }));
jest.mock("expo-apple-authentication", () => ({ getCredentialStateAsync: jest.fn(), AppleAuthenticationCredentialState: { REVOKED: 0, AUTHORIZED: 1, NOT_FOUND: 2 } }));
beforeEach(() => { mockUser = { uid: "one", providerData: [{ providerId: "apple.com", uid: "apple-one" }] }; jest.mocked(Apple.getCredentialStateAsync).mockResolvedValue(0); });
it("handles a real native revocation notification by checking the current Apple identity and signing out", async () => {
  await handleAppleCredentialRevoked(mockUser); expect(Apple.getCredentialStateAsync).toHaveBeenCalledWith("apple-one"); expect(signOut).toHaveBeenCalledTimes(1);
});
it("does not interrupt the authorization-revocation/deletion workflow", async () => {
  const release = holdAppleRevocationSignOut(mockUser.uid);
  await handleAppleCredentialRevoked(mockUser); expect(signOut).not.toHaveBeenCalled(); release();
  await handleAppleCredentialRevoked(mockUser); expect(signOut).toHaveBeenCalledTimes(1);
});
it("does not sign out another account or infer revocation from a network/simulator error", async () => {
  const previous = mockUser; mockUser = { ...mockUser, uid: "two" };
  await handleAppleCredentialRevoked(previous); expect(signOut).not.toHaveBeenCalled();
  jest.mocked(Apple.getCredentialStateAsync).mockRejectedValue(new Error("offline"));
  await handleAppleCredentialRevoked(mockUser); expect(signOut).not.toHaveBeenCalled();
});
