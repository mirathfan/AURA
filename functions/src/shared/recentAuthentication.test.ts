import { assertRecentAuthentication } from "./recentAuthentication";

describe("destructive account authentication", () => {
  const now = 1_800_000_000_000;
  it("allows a login within five minutes", () => {
    expect(() => assertRecentAuthentication(now / 1000 - 299, now)).not.toThrow();
  });
  it.each([undefined, null, "1800000000", NaN, Infinity, 1_799_999_699, 1_800_000_061])(
    "rejects stale or invalid auth_time %s",
    (authTime) => {
      expect(() => assertRecentAuthentication(authTime, now)).toThrow(
        expect.objectContaining({ code: "failed-precondition", details: { code: "REQUIRES_RECENT_LOGIN" } }),
      );
    },
  );
});
