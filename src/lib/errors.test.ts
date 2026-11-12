import {
  getFriendlyErrorMessage,
  isRateLimitError,
} from "@/src/lib/errors";

describe("client error helpers", () => {
  it("explains how to recover from account deletion requiring a fresh login", () => {
    expect(getFriendlyErrorMessage({
      code: "functions/failed-precondition",
      details: { code: "REQUIRES_RECENT_LOGIN" },
    })).toContain("sign out and sign back in");
  });
  it("returns true for Firebase Functions resource-exhausted errors", () => {
    expect(isRateLimitError({ code: "functions/resource-exhausted" })).toBe(true);
  });

  it("returns false for unprefixed resource-exhausted errors", () => {
    expect(isRateLimitError({ code: "resource-exhausted" })).toBe(false);
  });

  it("returns false for generic errors", () => {
    expect(isRateLimitError(new Error("nope"))).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });

  it("returns the rate-limit message for rate-limit errors", () => {
    expect(getFriendlyErrorMessage({ code: "functions/resource-exhausted" })).toBe(
      "You're going a bit fast — please wait a moment and try again.",
    );
  });

  it("returns the generic message otherwise", () => {
    expect(getFriendlyErrorMessage(new Error("boom"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

it.each(["CLIENT_UPGRADE_REQUIRED", "MEDIA_BUSY", "MEDIA_RETIRED", "AI_MAINTENANCE"])("shows a safe actionable explanation for %s", (code) => {
  const message = getFriendlyErrorMessage({ details: { code }, message: "secret-storage-token" });
  expect(message).not.toContain("secret-storage-token");
  expect(message).not.toBe("Something went wrong. Please try again.");
});
