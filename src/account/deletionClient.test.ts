import { httpsCallable } from "firebase/functions";
import type { User } from "firebase/auth";
import { reauthenticateWithCredential } from "firebase/auth";
import { authorizeAppleAccountDeletion } from "../auth/appleAuth";
import { prepareAppleDeletion, requestAccountDeletion, reauthenticateForDeletion } from "./deletionClient";
const mockCall = jest.fn();
let mockUser: User;
jest.mock("../lib/firebase", () => ({ auth: { get currentUser() { return mockUser; } }, app: {} }));
jest.mock("../auth/appleAuth", () => ({ authorizeAppleAccountDeletion: jest.fn(async () => "short-lived-code") }));
jest.mock("firebase/functions", () => ({ getFunctions: () => ({}), httpsCallable: jest.fn(() => mockCall) }));
jest.mock("firebase/auth", () => ({ reauthenticateWithCredential: jest.fn(async () => ({})), EmailAuthProvider: { credential: jest.fn() }, GoogleAuthProvider: { credential: jest.fn() } }));
jest.mock("@react-native-google-signin/google-signin", () => ({ GoogleSignin: { signIn: jest.fn(async () => ({ type: "success" })), getTokens: jest.fn(async () => ({ idToken: "synthetic" })) } }));
function user(providers = ["password"]) { return { uid: "one", email: "fixture@example.invalid", providerData: providers.map((providerId) => ({ providerId })), getIdToken: jest.fn(async () => "fixture") } as unknown as User; }
beforeEach(() => { jest.clearAllMocks(); mockUser = user(); mockCall.mockResolvedValue({ data: { status: "revoked", state: "completed" } }); });
it.each([["password"], ["google.com"]])("does not request Apple authorization for %s", async (provider) => {
  mockUser = user([provider]); expect(await prepareAppleDeletion(mockUser)).toBe("not_linked"); expect(authorizeAppleAccountDeletion).not.toHaveBeenCalled();
});
it.each([["apple.com"], ["google.com", "apple.com"]])("revokes Apple even when linked to %j", async (...providers) => {
  mockUser = user(providers); expect(await prepareAppleDeletion(mockUser)).toBe("revoked"); expect(mockCall).toHaveBeenCalledWith({ authorizationCode: "short-lived-code" });
});
it("offers explicit fallback on failure but preserves cancellation", async () => {
  mockUser = user(["apple.com"]);
  mockCall.mockRejectedValueOnce(new Error("network")); expect(await prepareAppleDeletion(mockUser)).toBe("manual_required");
  jest.mocked(authorizeAppleAccountDeletion).mockRejectedValueOnce({ code: "ERR_REQUEST_CANCELED" });
  await expect(prepareAppleDeletion(mockUser)).rejects.toEqual({ code: "ERR_REQUEST_CANCELED" });
});
it("cannot delete a captured account after an account switch", async () => {
  const original = mockUser; mockUser = { ...mockUser, uid: "two" };
  await expect(requestAccountDeletion(original)).rejects.toThrow("Account changed"); expect(mockCall).not.toHaveBeenCalled();
});
it("rejects legacy success responses without verified completion state", async () => {
  mockCall.mockResolvedValue({ data: { ok: true } }); await expect(requestAccountDeletion(mockUser)).rejects.toThrow("could not be confirmed");
});
it("reauthenticates email and Google without replacing the account", async () => {
  await reauthenticateForDeletion(mockUser, "fixture-password"); expect(reauthenticateWithCredential).toHaveBeenCalledWith(mockUser, undefined);
  mockUser = user(["google.com"]); await reauthenticateForDeletion(mockUser); expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
});

it("keeps the 600-second deletion timeout and acknowledges the durable contract with the captured UID and explicit fallback", async () => {
  await requestAccountDeletion(mockUser, true);
  expect(httpsCallable).toHaveBeenCalledWith({}, "deleteAccountData", { timeout: 600_000 });
  expect(mockCall).toHaveBeenCalledWith({ uid: "one", allowAppleFallback: true, deletionContract: "durable-deletion-v1" });
});
