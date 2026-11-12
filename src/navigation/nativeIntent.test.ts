import { Linking } from "react-native";
import { redirectSystemPath } from "../../app/+native-intent";

beforeEach(() => jest.spyOn(Linking, "getInitialURL").mockResolvedValue(null));
afterEach(() => jest.restoreAllMocks());

it("recovers cold launch options when Expo's iOS registry supplied only root", async () => {
  jest.mocked(Linking.getInitialURL).mockResolvedValue("aura://forgot-password");
  expect(await redirectSystemPath({ path: "aura:///", initial: true })).toBe("/(auth)/forgot-password");
});
it("waits for an asynchronous initial URL before selecting a route", async () => {
  let resolve!: (url: string) => void;
  jest.mocked(Linking.getInitialURL).mockReturnValue(new Promise((done) => { resolve = done; }));
  const result = redirectSystemPath({ path: "aura:///", initial: true });
  resolve("aura:///(auth)/forgot-password");
  expect(await result).toBe("/(auth)/forgot-password");
});
it("uses the current warm link, never stale launch options", async () => {
  jest.mocked(Linking.getInitialURL).mockResolvedValue("aura://login");
  expect(await redirectSystemPath({ path: "aura://forgot-password", initial: false })).toBe("/(auth)/forgot-password");
  expect(Linking.getInitialURL).not.toHaveBeenCalled();
});
it("preserves Expo's URL if the fallback fails without logging the exception", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(Linking.getInitialURL).mockRejectedValue(new Error("private callback parameters"));
  expect(await redirectSystemPath({ path: "aura://forgot-password", initial: true })).toBe("/(auth)/forgot-password");
  expect(log).not.toHaveBeenCalled();
});
