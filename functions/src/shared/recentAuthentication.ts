import { HttpsError } from "firebase-functions/v2/https";

export function assertRecentAuthentication(authTime: unknown, nowMs = Date.now()) {
  const nowSeconds = Math.floor(nowMs / 1000);
  if (
    typeof authTime !== "number" ||
    !Number.isFinite(authTime) ||
    authTime > nowSeconds + 60 ||
    nowSeconds - authTime > 5 * 60
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Sign out and sign back in, then return to Account to delete your account.",
      { code: "REQUIRES_RECENT_LOGIN" },
    );
  }
}
