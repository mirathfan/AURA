import React from "react";
import { Linking, Text } from "react-native";
import { Stack } from "expo-router";
import { renderRouter } from "expo-router/testing-library";

import { act, waitFor } from "@testing-library/react-native";
import * as ExpoLinking from "expo-linking";
import { onAuthStateChanged } from "firebase/auth";
import { AuthProvider } from "../contexts/AuthContext";
import { useAuthRouting } from "../auth/useAuthRouting";
import { loadUserProfilePreferences } from "../lib/userProfile";
import { redirectSystemPath } from "../../app/+native-intent";

jest.mock("../lib/storage", () => ({ Storage: { clearUserScopedData: jest.fn(async () => undefined) } }));
jest.mock("expo-apple-authentication", () => ({ addRevokeListener: jest.fn(() => ({ remove: jest.fn() })) }));

let authChanged: ((user: { uid: string } | null) => void) | undefined;
let incoming: ((event: { url: string }) => void) | undefined;
jest.mock("firebase/auth", () => ({ onAuthStateChanged: jest.fn() }));
jest.mock("../lib/firebase", () => ({ auth: {}, hasFirebaseServices: () => true }));
jest.mock("../lib/userProfile", () => ({ loadUserProfilePreferences: jest.fn() }));
jest.mock("../lib/localCache", () => ({ getCachedProfilePreferences: async () => null }));
function Gate() {
  const { waiting, profileError } = useAuthRouting();
  return <Stack screenOptions={{ headerShown: false }}
    screenLayout={({ children }) => waiting || profileError ? <Text>Checking session</Text> : children} />;
}
const routes = {
  _layout: () => <AuthProvider><Gate /></AuthProvider>,
  "+native-intent": { redirectSystemPath },
  "(auth)/_layout": () => <Stack screenOptions={{ headerShown: false }} />,
  "(auth)/forgot-password": () => <Text>Reset destination</Text>,
  "(auth)/login": () => <Text>Login destination</Text>,
  "(auth)/reset-password": () => <Text>Reset action destination</Text>,
  "(auth)/welcome": () => <Text>Welcome destination</Text>,
  "(onboarding)/index": () => <Text>Onboarding destination</Text>,
  "(tabs)/index": () => <Text>Home destination</Text>,
};
beforeEach(() => {
  authChanged = undefined;
  incoming = undefined;
  jest.mocked(onAuthStateChanged).mockImplementation(((_auth: unknown, next: NonNullable<typeof authChanged>) => {
    authChanged = next;
    return jest.fn();
  }) as typeof onAuthStateChanged);
  jest.mocked(loadUserProfilePreferences).mockResolvedValue({ onboardingCompleted: true } as never);
  jest.spyOn(Linking, "getInitialURL").mockResolvedValue(null);
  jest.spyOn(ExpoLinking, "addEventListener").mockImplementation((_type, handler) => {
    incoming = handler;
    return { remove() {} } as ReturnType<typeof ExpoLinking.addEventListener>;
  });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it.each([null, { uid: "restored" }])("cold reset link survives delayed Firebase initialization: %s", async (user) => {
  jest.mocked(Linking.getInitialURL).mockResolvedValue("aura://forgot-password");
  const ui = renderRouter(routes, { initialUrl: "/" });
  await waitFor(() => expect(authChanged).toBeDefined());
  expect(ui.queryByText("Reset destination")).toBeNull();
  act(() => authChanged!(user));
  await waitFor(() => expect(ui.getByText("Reset destination")).toBeTruthy());
  expect(ui.getPathname()).toBe("/forgot-password");
  expect(ui.queryByText("Welcome destination")).toBeNull();
});

it.each([null, { uid: "restored" }])("warm reset event resolves through the real Router subscription: %s", async (user) => {
  const ui = renderRouter(routes, { initialUrl: "/login" });
  await waitFor(() => expect(authChanged).toBeDefined());
  act(() => authChanged!(user));
  await waitFor(() => expect(ui.getByText(user ? "Home destination" : "Login destination")).toBeTruthy());
  await act(async () => incoming!({ url: "aura://forgot-password" }));
  await waitFor(() => expect(ui.getByText("Reset destination")).toBeTruthy());
  expect(ui.getPathname()).toBe("/forgot-password");
});

it("unsolicited OAuth events resolve to login without unmatched routes or sensitive params", async () => {
  const ui = renderRouter(routes, { initialUrl: "/welcome" });
  await waitFor(() => expect(authChanged).toBeDefined());
  act(() => authChanged!(null));
  await act(async () => incoming!({ url: "com.googleusercontent.apps.123:/oauthredirect?code=private&state=private" }));
  await waitFor(() => expect(ui.getByText("Login destination")).toBeTruthy());
  expect(ui.getPathname()).toBe("/login");
  expect(ui.getSearchParams()).not.toHaveProperty("code");
  expect(ui.getSearchParams()).not.toHaveProperty("state");
  expect(JSON.stringify(ui.getRouterState())).not.toContain("private");
  expect(ui.queryByText("Unmatched Route")).toBeNull();
});

it("onboarding profile resolution does not overwrite a cold reset destination", async () => {
  jest.mocked(Linking.getInitialURL).mockResolvedValue("aura:///(auth)/forgot-password");
  jest.mocked(loadUserProfilePreferences).mockResolvedValue({ onboardingCompleted: false } as never);
  const ui = renderRouter(routes, { initialUrl: "/" });
  await waitFor(() => expect(authChanged).toBeDefined());
  act(() => authChanged!({ uid: "new-user" }));
  await waitFor(() => expect(ui.getByText("Reset destination")).toBeTruthy());
  expect(ui.getPathname()).toBe("/forgot-password");
});

jest.mock("expo", () => ({ registerRootComponent: jest.fn(), requireOptionalNativeModule: () => null }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { scheme: "aura" } } }));
jest.mock("expo-modules-core", () => ({
  Platform: jest.requireActual("react-native").Platform,
  requireOptionalNativeModule: () => null,
  requireNativeModule: () => ({}),
  EventEmitter: class { addListener() { return { remove() {} }; } },
  NativeModule: class {},
}));
jest.mock("expo-linking", () => ({
  __esModule: true,
  createURL: (path: string) => `aura://${path}`,
  getInitialURL: jest.fn(async () => null),
  getLinkingURL: () => null,
  addEventListener: () => ({ remove() {} }),
}));
jest.mock("react-native-reanimated", () => jest.requireActual("react-native-reanimated/mock"));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

it("fresh ordinary launch sends a signed-out user to Welcome", async () => {
  const ui = renderRouter(routes, { initialUrl: "/" });
  await waitFor(() => expect(authChanged).toBeDefined());
  act(() => authChanged!(null));
  await waitFor(() => expect(ui.getByText("Welcome destination")).toBeTruthy());
});
it.each([null, { uid: "restored" }])("cold unsolicited OAuth safely resolves restored state: %s", async (user) => {
  jest.mocked(Linking.getInitialURL).mockResolvedValue("com.googleusercontent.apps.123:/oauthredirect?error=access_denied&state=private");
  const ui = renderRouter(routes, { initialUrl: "/" });
  await waitFor(() => expect(authChanged).toBeDefined());
  act(() => authChanged!(user));
  await waitFor(() => expect(ui.getByText(user ? "Home destination" : "Login destination")).toBeTruthy());
  expect(JSON.stringify(ui.getRouterState())).not.toContain("private");
});
it("cold Firebase action preserves the code outside the actual Router state", async () => {
  const previousKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY = "test-key";
  try {
    jest.mocked(Linking.getInitialURL).mockResolvedValue("aura://forgot-password?mode=resetPassword&oobCode=private-reset&apiKey=test-key");
    const ui = renderRouter(routes, { initialUrl: "/" });
    await waitFor(() => expect(authChanged).toBeDefined());
    act(() => authChanged!(null));
    await waitFor(() => expect(ui.getByText("Reset action destination")).toBeTruthy());
    expect(ui.getPathname()).toBe("/reset-password");
    expect(ui.getSearchParams()).toHaveProperty("request");
    expect(JSON.stringify(ui.getRouterState())).not.toContain("private-reset");
  } finally {
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    else process.env.EXPO_PUBLIC_FIREBASE_API_KEY = previousKey;
  }
});
