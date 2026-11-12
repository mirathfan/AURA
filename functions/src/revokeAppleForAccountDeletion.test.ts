import { revokeAppleForAccountDeletion } from "./revokeAppleForAccountDeletion";
import { revokeAppleAuthorization } from "./shared/appleRevocation";
import { setUserDocument } from "./shared/accountLifecycle";
let mockProviders = [{ providerId: "apple.com", uid: "server-apple-subject" }];
jest.mock("firebase-admin/auth", () => ({ getAuth: () => ({ getUser: jest.fn(async () => ({ providerData: mockProviders })) }) }));
jest.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({ doc: (path: string) => ({ path }) }), FieldValue: { serverTimestamp: () => "server-time" } }));
jest.mock("firebase-functions/params", () => ({ defineSecret: () => ({ value: () => "synthetic-key" }), defineString: (name: string) => ({ value: () => name }) }));
jest.mock("./shared/accountLifecycle", () => ({ assertAccountActive: jest.fn(), setUserDocument: jest.fn() }));
jest.mock("./shared/rateLimit", () => ({ assertFunctionRateLimit: jest.fn(), RATE_LIMITS: { appleRevocation: [] } }));
jest.mock("./shared/appleRevocation", () => ({ revokeAppleAuthorization: jest.fn() }));
const request = () => ({ auth: { uid: "owner", token: { auth_time: Date.now() / 1000 } }, data: { authorizationCode: "synthetic-code", uid: "untrusted", appleSubject: "untrusted" } } as never);
beforeEach(() => { mockProviders = [{ providerId: "apple.com", uid: "server-apple-subject" }]; jest.mocked(revokeAppleAuthorization).mockResolvedValue(); });
it("uses the authenticated UID and server-linked Apple identity, never caller-supplied identities", async () => {
  await expect(revokeAppleForAccountDeletion.run(request())).resolves.toEqual({ status: "revoked" });
  expect(revokeAppleAuthorization).toHaveBeenCalledWith("synthetic-code", "server-apple-subject", expect.anything());
  expect(setUserDocument).toHaveBeenCalledWith({ path: "users/owner/private/appleRevocation" }, expect.objectContaining({ revokedAt: "server-time" }));
  expect(JSON.stringify(jest.mocked(setUserDocument).mock.calls)).not.toMatch(/synthetic-code|synthetic-key|server-apple-subject/);
});
it("never marks revocation successful when Apple rejects or the exchange is unavailable", async () => {
  jest.mocked(revokeAppleAuthorization).mockRejectedValue(new Error("provider credentials must not escape"));
  await expect(revokeAppleForAccountDeletion.run(request())).resolves.toEqual({ status: "manual_required" });
  expect(setUserDocument).not.toHaveBeenCalled();
});
it("rejects unauthenticated and stale requests before reading/exchanging credentials", async () => {
  await expect(revokeAppleForAccountDeletion.run({ data: {} } as never)).rejects.toMatchObject({ code: "unauthenticated" });
  await expect(revokeAppleForAccountDeletion.run({ data: {}, auth: { uid: "owner", token: { auth_time: 1 } } } as never)).rejects.toMatchObject({ details: { code: "REQUIRES_RECENT_LOGIN" } });
  expect(revokeAppleAuthorization).not.toHaveBeenCalled();
});
it("requires no Apple grant for an unlinked account", async () => {
  mockProviders = [{ providerId: "google.com", uid: "google-subject" }];
  await expect(revokeAppleForAccountDeletion.run(request())).resolves.toEqual({ status: "not_linked" }); expect(revokeAppleAuthorization).not.toHaveBeenCalled();
});
