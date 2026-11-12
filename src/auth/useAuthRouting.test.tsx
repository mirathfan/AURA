import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { useAuthRouting } from "./useAuthRouting";
import { loadUserProfilePreferences } from "../lib/userProfile";
import { getCachedProfilePreferences } from "../lib/localCache";
import { redirectSystemPath } from "../../app/+native-intent";
import { Linking } from "react-native";

jest.mock("../lib/storage", () => ({ Storage: { clearUserScopedData: jest.fn(async () => undefined) } }));
jest.mock("expo-apple-authentication", () => ({ addRevokeListener: jest.fn(() => ({ remove: jest.fn() })) }));

let mockDeletionStatus: unknown = null;
jest.mock("../account/DeletionProvider", () => ({ useAccountDeletion: () => ({ status: mockDeletionStatus }) }));
let mockSegments: string[] = [];
let mockNavigationReady = false;
let authChanged: (user: { uid: string } | null) => void;
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useSegments: () => mockSegments,
  useRootNavigationState: () => mockNavigationReady ? { key: "root" } : undefined,
}));
jest.mock("firebase/auth", () => ({ onAuthStateChanged: jest.fn() }));
jest.mock("../lib/firebase", () => ({ auth: {}, hasFirebaseServices: () => true }));
jest.mock("../lib/userProfile", () => ({ loadUserProfilePreferences: jest.fn() }));
jest.mock("../lib/localCache", () => ({ getCachedProfilePreferences: jest.fn() }));
const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const useGate = () => ({ ...useAuthRouting(), auth: useAuth() });

beforeEach(() => {
  mockDeletionStatus = null;
  mockSegments = [];
  mockNavigationReady = false;
  jest.mocked(onAuthStateChanged).mockImplementation(((_auth: unknown, next: typeof authChanged) => {
    authChanged = next;
    return jest.fn();
  }) as typeof onAuthStateChanged);
  jest.mocked(getCachedProfilePreferences).mockResolvedValue(null);
  jest.mocked(loadUserProfilePreferences).mockResolvedValue({ onboardingCompleted: true } as never);
  jest.spyOn(Linking, "getInitialURL").mockResolvedValue("aura://forgot-password");
});
afterEach(() => jest.restoreAllMocks());

it.each([true, false])("preserves %s (cold=true) reset navigation through delayed signed-out initialization", async (cold) => {
  const { result, rerender } = renderHook(useGate, { wrapper });
  expect(result.current.waiting).toBe(true);
  const path = await redirectSystemPath({ path: cold ? "aura:///" : "aura://forgot-password", initial: cold });
  mockSegments = path!.split("/").filter(Boolean);
  mockNavigationReady = true;
  rerender({});
  expect(router.replace).not.toHaveBeenCalled();
  act(() => authChanged(null));
  expect(result.current.waiting).toBe(false);
  expect(router.replace).not.toHaveBeenCalled();
});

it.each([true, false])("keeps recovery accessible for restored user with onboarding completed=%s", async (onboarded) => {
  mockSegments = ["(auth)", "forgot-password"];
  mockNavigationReady = true;
  jest.mocked(loadUserProfilePreferences).mockResolvedValue({ onboardingCompleted: onboarded } as never);
  const { result } = renderHook(useGate, { wrapper });
  act(() => authChanged({ uid: "restored" }));
  await waitFor(() => expect(result.current.profileState).toBe(onboarded ? "onboarded" : "needs_onboarding"));
  expect(result.current.waiting).toBe(false);
  expect(router.replace).not.toHaveBeenCalled();
});

it("does not discard a recovery action while profile loading fails", async () => {
  mockSegments = ["(auth)", "reset-password"];
  mockNavigationReady = true;
  jest.mocked(loadUserProfilePreferences).mockRejectedValue(new Error("offline"));
  const { result } = renderHook(useGate, { wrapper });
  act(() => authChanged({ uid: "restored" }));
  await waitFor(() => expect(result.current.profileState).toBe("error"));
  expect(result.current.profileError).toBe(false);
  expect(result.current.waiting).toBe(false);
  expect(router.replace).not.toHaveBeenCalled();
});

it("waits for router readiness even when auth resolves first", () => {
  const { rerender, result } = renderHook(useGate, { wrapper });
  act(() => authChanged(null));
  expect(router.replace).not.toHaveBeenCalled();
  expect(result.current.waiting).toBe(true);
  mockNavigationReady = true;
  mockSegments = ["(auth)", "forgot-password"];
  rerender({});
  expect(router.replace).not.toHaveBeenCalled();
  expect(result.current.waiting).toBe(false);
});

it.each([
  [true, ["(auth)", "login"], "/(tabs)"],
  [false, ["(auth)", "login"], "/(onboarding)"],
  [true, ["(onboarding)", "index"], "/(tabs)"],
  [false, ["(tabs)", "index"], "/(onboarding)"],
] as const)("restored account completed=%s on %s goes to %s", async (complete, segments, target) => {
  mockSegments = [...segments];
  mockNavigationReady = true;
  jest.mocked(loadUserProfilePreferences).mockResolvedValue({ onboardingCompleted: complete } as never);
  const { result } = renderHook(useGate, { wrapper });
  act(() => authChanged({ uid: "restored" }));
  expect(router.replace).not.toHaveBeenCalled();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(target));
  expect(result.current.waiting).toBe(true); // Protected content withheld until redirect lands.
});

it("redirects signed-out private links and retains signed-in private links", async () => {
  mockNavigationReady = true;
  mockSegments = ["(tabs)", "closet"];
  const { result } = renderHook(useGate, { wrapper });
  act(() => authChanged(null));
  expect(router.replace).toHaveBeenCalledWith("/(auth)/welcome");
  jest.mocked(router.replace).mockClear();
  act(() => authChanged({ uid: "restored" }));
  await waitFor(() => expect(result.current.waiting).toBe(false));
  expect(router.replace).not.toHaveBeenCalled();
});

it("preserves a warm recovery link through late onboarding resolution", async () => {
  mockNavigationReady = true;
  mockSegments = ["(auth)", "login"];
  let resolve!: (profile: never) => void;
  jest.mocked(loadUserProfilePreferences).mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result, rerender } = renderHook(useGate, { wrapper });
  act(() => authChanged({ uid: "new-user" }));
  await waitFor(() => expect(loadUserProfilePreferences).toHaveBeenCalled());
  mockSegments = ["(auth)", "forgot-password"];
  rerender({});
  await act(async () => resolve({ onboardingCompleted: false } as never));
  expect(result.current.waiting).toBe(false);
  expect(router.replace).not.toHaveBeenCalled();
});

it("does not reuse onboarding status across account switches and ignores stale reads", async () => {
  mockNavigationReady = true;
  mockSegments = ["(tabs)", "index"];
  let resolveFirst!: (value: never) => void;
  jest.mocked(loadUserProfilePreferences)
    .mockImplementationOnce(() => new Promise((done) => { resolveFirst = done; }))
    .mockResolvedValueOnce({ onboardingCompleted: false } as never);
  const { result } = renderHook(useGate, { wrapper });
  act(() => authChanged({ uid: "first" }));
  await waitFor(() => expect(loadUserProfilePreferences).toHaveBeenCalledTimes(1));
  act(() => authChanged({ uid: "second" }));
  expect(result.current.waiting).toBe(true);
  await waitFor(() => expect(result.current.profileState).toBe("needs_onboarding"));
  await act(async () => resolveFirst({ onboardingCompleted: true } as never));
  expect(result.current.profileState).toBe("needs_onboarding");
  expect(router.replace).not.toHaveBeenCalledWith("/(tabs)");
});

it("refreshes the completed onboarding revision before redirecting to tabs", async () => {
  mockNavigationReady = true;
  mockSegments = ["(onboarding)", "index"];
  jest.mocked(loadUserProfilePreferences).mockResolvedValueOnce({ onboardingCompleted: false } as never);
  const { result } = renderHook(useGate, { wrapper });
  act(() => authChanged({ uid: "new-user" }));
  await waitFor(() => expect(result.current.profileState).toBe("needs_onboarding"));
  expect(router.replace).not.toHaveBeenCalled();
  act(() => result.current.auth.refreshProfile());
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)"));
});

it("rechecks the same account after sign-out instead of reusing its old profile", async () => {
  mockNavigationReady = true;
  mockSegments = ["(tabs)", "index"];
  const { result, rerender } = renderHook(useGate, { wrapper });
  act(() => authChanged({ uid: "same-account" }));
  await waitFor(() => expect(result.current.profileState).toBe("onboarded"));
  act(() => authChanged(null));
  mockSegments = ["(auth)", "login"];
  rerender({});
  jest.mocked(router.replace).mockClear();
  jest.mocked(loadUserProfilePreferences).mockReturnValue(new Promise(() => {}));
  act(() => authChanged({ uid: "same-account" }));
  expect(result.current.waiting).toBe(true);
  expect(router.replace).not.toHaveBeenCalled();
});

it("keeps privacy readable before auth initialization and through onboarding redirects", async () => {
  mockSegments = ["privacy"];
  mockNavigationReady = true;
  jest.mocked(loadUserProfilePreferences).mockResolvedValue({ onboardingCompleted: false } as never);
  const { result } = renderHook(useGate, { wrapper });
  expect(result.current.waiting).toBe(false);
  act(() => authChanged({ uid: "not-onboarded" }));
  await waitFor(() => expect(result.current.profileState).toBe("needs_onboarding"));
  expect(result.current.waiting).toBe(false);
  expect(router.replace).not.toHaveBeenCalled();
});

it("does not redirect a restored deleting account into onboarding after its profile is removed", async () => {
  mockSegments = ["(tabs)"]; mockNavigationReady = true;
  mockDeletionStatus = { state: "deleting" };
  jest.mocked(loadUserProfilePreferences).mockRejectedValue(new Error("profile removed"));
  const { result } = renderHook(useGate, { wrapper });
  await act(async () => authChanged({ uid: "owner" }));
  await waitFor(() => expect(result.current.waiting).toBe(false));
  expect(result.current.profileError).toBe(false); expect(router.replace).not.toHaveBeenCalled();
});
