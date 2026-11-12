import { normalizeIncomingLink } from "./incomingLinks";
import { clearPasswordReset, getPasswordResetCode } from "../auth/passwordResetAction";

const config = { apiKey: "test-project-key", authDomain: "test-project.firebaseapp.com" };
const action = "mode=resetPassword&oobCode=test-reset-code&apiKey=test-project-key";
const callback = "com.googleusercontent.apps.123-example:/oauthredirect?code=private-code&state=private-state";
beforeEach(() => clearPasswordReset());

describe("incoming native URLs", () => {
  it.each(["aura://forgot-password", "aura:///(auth)/forgot-password", "/(auth)/forgot-password"])("normalizes reset navigation %s", (url) => {
    expect(normalizeIncomingLink(url, config)).toBe("/(auth)/forgot-password");
  });
  it.each(["aura://forgot-password", "aura://reset-password", "https://test-project.firebaseapp.com/__/auth/action"])("keeps reset actions out of navigation parameters: %s", (base) => {
    const route = normalizeIncomingLink(`${base}?${action}&continueUrl=https://evil.example&lang=fr`, config)!;
    expect(route).toMatch(/^\/\(auth\)\/reset-password\?request=\d+$/);
    expect(route).not.toContain("test-reset-code");
    expect(getPasswordResetCode(route.split("=")[1])).toBe("test-reset-code");
  });
  it.each([
    "https://evil.example/__/auth/action?" + action,
    "https://test-project.firebaseapp.com.evil.example/__/auth/action?" + action,
    "https://test-project.firebaseapp.com@evil.example/__/auth/action?" + action,
    "aura://forgot-password?" + action.replace("test-project-key", "wrong-project"),
    "aura://forgot-password?" + action.replace("resetPassword", "verifyEmail"),
    "aura://forgot-password?" + action + "&oobCode=second",
    "aura://forgot-password?" + action + "&mode=resetPassword",
    "aura://forgot-password?mode=resetPassword&oobCode=",
    "aura://forgot-password?" + action.replace("test-reset-code", "%0Asecret"),
    "aura://forgot-password?" + action + "#access_token=secret",
    "aura://%ZZ", "javascript:alert(1)", "//evil.example", "aura://unsupported",
    "aura://login\\evil", "aura://reset-password?request=123",
  ])("rejects malformed or unsupported input without reflecting it", (url) => {
    expect(normalizeIncomingLink(url, config)).toBe("/(auth)/login");
  });
  it("removes external query data from ordinary app navigation", () => {
    expect(normalizeIncomingLink("aura://login?code=secret&state=secret", config)).toBe("/(auth)/login");
    expect(normalizeIncomingLink("aura://closet", config)).toBe("/closet");
    expect(normalizeIncomingLink("aura:///", config)).toBe("/");
  });
  it.each([callback, "aura://oauthredirect?error=access_denied&state=expired", "com.googleusercontent.apps.123-example:/anything?token=secret"])("routes unsolicited callbacks to a clean login URL", (url) => {
    expect(normalizeIncomingLink(url, config)).toBe("/(auth)/login");
    expect(getPasswordResetCode("1")).toBeNull();
  });
  it("does not navigate away from an active native OAuth session or process its response", () => {
    expect(normalizeIncomingLink(callback, { ...config, googleActive: true })).toBe("");
  });
  it("replaces previous action codes and bounds memory retention", () => {
    const first = normalizeIncomingLink(`aura://reset-password?${action}`, config)!.split("=")[1];
    const second = normalizeIncomingLink(`aura://reset-password?${action.replace("test-reset-code", "next-code")}`, config)!.split("=")[1];
    expect(getPasswordResetCode(first)).toBeNull();
    expect(getPasswordResetCode(second)).toBe("next-code");
    const now = Date.now();
    const clock = jest.spyOn(Date, "now").mockReturnValue(now + 11 * 60_000);
    expect(getPasswordResetCode(second)).toBeNull();
    clock.mockRestore();
  });
});
