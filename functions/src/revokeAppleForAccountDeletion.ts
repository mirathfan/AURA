import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { assertRecentAuthentication } from "./shared/recentAuthentication";
import { assertAccountActive, setUserDocument } from "./shared/accountLifecycle";
import { assertFunctionRateLimit, RATE_LIMITS } from "./shared/rateLimit";
import { revokeAppleAuthorization } from "./shared/appleRevocation";

const privateKey = defineSecret("APPLE_REVOCATION_PRIVATE_KEY");
const teamId = defineString("APPLE_REVOCATION_TEAM_ID", { default: "" });
const keyId = defineString("APPLE_REVOCATION_KEY_ID", { default: "" });
const clientId = defineString("APPLE_REVOCATION_CLIENT_ID", { default: "com.kasat.aura" });
export const revokeAppleForAccountDeletion = onCall({ secrets: [privateKey], timeoutSeconds: 60 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to manage Apple authorization.");
  assertRecentAuthentication(request.auth?.token.auth_time);
  await assertAccountActive(uid);
  const account = await getAuth().getUser(uid);
  const apple = account.providerData.find((provider) => provider.providerId === "apple.com");
  if (!apple) return { status: "not_linked" };
  const code = request.data?.authorizationCode;
  if (typeof code !== "string" || !code || code.length > 4096) throw new HttpsError("invalid-argument", "Fresh Apple authorization is required.");
  await assertFunctionRateLimit(uid, "appleRevocation", RATE_LIMITS.appleRevocation);
  try {
    const config = { privateKey: privateKey.value(), teamId: teamId.value(), keyId: keyId.value(), clientId: clientId.value() };
    if (!config.privateKey || !config.teamId || !config.keyId) return { status: "manual_required" };
    // The exchanged, signed ID token must match the SERVER's linked Apple sub.
    // Codes and resulting tokens remain ephemeral; no request/error-body logs.
    await revokeAppleAuthorization(code, apple.uid, config);
    await setUserDocument(getFirestore().doc(`users/${uid}/private/appleRevocation`), { revokedAt: FieldValue.serverTimestamp(), subjectHash: createHash("sha256").update(apple.uid).digest("hex") });
    return { status: "revoked" };
  } catch {
    return { status: "manual_required" };
  }
});
