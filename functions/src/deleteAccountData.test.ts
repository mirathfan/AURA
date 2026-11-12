jest.mock("firebase-functions/v2/storage", () => ({ onObjectFinalized: (_opts: unknown, fn: unknown) => fn }));
import { deleteAccountData } from "./deleteAccountData";
import { beginAccountDeletion, processAccountDeletion } from "./shared/accountDeletionJob";
const mockGet = jest.fn();
jest.mock("./shared/accountLifecycle", () => ({ DELETION_COLLECTION: "accountDeletionJobs", deletionRef: () => ({ get: mockGet }) }));
jest.mock("./shared/accountDeletionJob", () => ({ beginAccountDeletion: jest.fn(), processAccountDeletion: jest.fn(), publicDeletionStatus: (data: unknown) => data }));
const status = { state: "retry", stage: "firestore", apple: "not_linked" };
beforeEach(() => { jest.clearAllMocks(); mockGet.mockResolvedValue({ exists: false, data: () => status }); });
const request = (authTime = Date.now() / 1000) => ({ data: { deletionContract: "durable-deletion-v1" }, auth: { uid: "owner", token: { auth_time: authTime } } } as never);
it("rejects unauthenticated and cross-user calls without side effects", async () => {
  await expect(deleteAccountData.run({ data: {} } as never)).rejects.toMatchObject({ code: "unauthenticated" });
  await expect(deleteAccountData.run({ data: { uid: "other" }, auth: { uid: "owner", token: {} } } as never)).rejects.toMatchObject({ code: "permission-denied" });
  expect(beginAccountDeletion).not.toHaveBeenCalled();
});
it("checks recent authentication before accepting any new deletion", async () => {
  await expect(deleteAccountData.run(request(1))).rejects.toMatchObject({ details: { code: "REQUIRES_RECENT_LOGIN" } });
  expect(beginAccountDeletion).not.toHaveBeenCalled(); expect(processAccountDeletion).not.toHaveBeenCalled();
});
it("returns retry status, not success, when cleanup is incomplete", async () => {
  await expect(deleteAccountData.run(request())).resolves.toEqual({ ...status, ok: false });
  expect(beginAccountDeletion).toHaveBeenCalledWith("owner", false);
  expect(processAccountDeletion).toHaveBeenCalledWith("owner");
});
it("resumes an already accepted job even after authentication ages out", async () => {
  mockGet.mockResolvedValue({ exists: true, data: () => ({ ...status, state: "completed" }) });
  await expect(deleteAccountData.run(request(1))).resolves.toMatchObject({ state: "completed", ok: true });
  expect(beginAccountDeletion).not.toHaveBeenCalled();
});

it("Build 9 missing contract cannot accept a destructive request or receive misleading success", async () => {
  await expect(deleteAccountData.run({ data: {}, auth: { uid: "owner", token: { auth_time: Date.now() / 1000 } } } as never)).rejects.toMatchObject({ details: { code: "CLIENT_UPGRADE_REQUIRED" } });
  expect(beginAccountDeletion).not.toHaveBeenCalled(); expect(processAccountDeletion).not.toHaveBeenCalled();
  mockGet.mockResolvedValue({ exists: true });
  await expect(deleteAccountData.run({ data: {}, auth: { uid: "owner", token: {} } } as never)).rejects.toMatchObject({ details: { code: "CLIENT_UPGRADE_REQUIRED" } });
});
