import { scrubSentryEvent } from "./sentry";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    nativeBuildVersion: "9",
    expoConfig: {
      version: "1.0.0",
      ios: { buildNumber: "8" },
    },
  },
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  digestStringAsync: jest.fn(async () => "digest"),
}));

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  withScope: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  wrap: jest.fn((component) => component),
}));

describe("scrubSentryEvent", () => {
  it("removes user content, credentials, identifiers, and URLs", () => {
    const event = scrubSentryEvent({
      message: "Please style my private dinner outfit",
      tags: { unsafe: "drop-me" },
      user: { id: "raw-firebase-uid", email: "person@example.com" },
      extra: {
        prompt: "Wear the item from https://example.com/private?token=abc",
        authorization: "Bearer secret",
        uid: "raw-firebase-uid",
        sourceUrl: "https://example.com/private",
      },
      breadcrumbs: [{
        message: "My closet request should stay private",
        data: { cookie: "session=secret" },
      }],
      exception: {
        values: [{ value: "Failed for person@example.com at https://example.com/private" }],
      },
    });

    expect(event.tags).toEqual({
      app_version: "1.0.0",
      build_number: "9",
      platform: "ios",
      environment: "test",
    });
    expect(event.message).toBe("[redacted-user-content]");
    expect(event.user).toBeUndefined();
    expect(event.extra).toEqual({
      prompt: "[redacted-user-content]",
      authorization: "[redacted-secret]",
      uid: "[redacted-id]",
      sourceUrl: "[redacted-url]",
    });
    expect(event.breadcrumbs?.[0]).toMatchObject({
      message: "[redacted-user-content]",
      data: { cookie: "[redacted-secret]" },
    });
    expect(event.exception?.values?.[0]?.value).toBe("[redacted-user-content]");
  });

  it("keeps only an already pseudonymous Sentry user id", () => {
    const event = scrubSentryEvent({ user: { id: "anon_1234567890abcdef", email: "drop@example.com" } });
    expect(event.user).toEqual({ id: "anon_1234567890abcdef" });
  });
});

it("scrubs reset and OAuth material in custom-scheme URLs and structured parameters", () => {
  const event = scrubSentryEvent({
    message: "callback com.googleusercontent.apps.123:/oauthredirect?code=private-code&state=private-state",
    extra: { oobCode: "private-reset", code: "private-code", nonce: "private-nonce", state: "private-state" },
    breadcrumbs: [{ message: "received aura://forgot-password?oobCode=private-reset", data: { code_verifier: "private-verifier" } }],
    exception: { values: [{ value: "Rejected oobCode=private-reset&state=private-state" }] },
  });
  expect(JSON.stringify(event)).not.toContain("private-");
});
