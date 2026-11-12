import { Linking } from "react-native";
import * as ExpoLinking from "expo-linking";
import { getInitialURL } from "expo-router/build/link/linking";

jest.mock("expo-linking", () => ({
  getLinkingURL: jest.fn(() => null),
  createURL: jest.fn(() => "aura:///"),
}));
jest.mock("expo-router/build/fork/getStateFromPath", () => ({}));
jest.mock("expo-router/build/fork/getPathFromState", () => ({}));
jest.mock("expo-router/build/fork/useLinking", () => ({}));
jest.mock("expo-router/build/getRoutesRedirects", () => ({}));

it("documents SDK 54 iOS initial URL gap: the Expo registry may be empty while RN has launch options", async () => {
  jest.spyOn(Linking, "getInitialURL").mockResolvedValue("aura://forgot-password");
  expect(ExpoLinking.getLinkingURL()).toBeNull();
  expect(getInitialURL()).toBe("aura:///");
  expect(await Linking.getInitialURL()).toBe("aura://forgot-password");
});
