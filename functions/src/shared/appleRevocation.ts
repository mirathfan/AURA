import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

export type AppleRevocationConfig = { clientId: string; teamId: string; keyId: string; privateKey: string };
function encoded(value: unknown) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
export function appleClientSecret(config: AppleRevocationConfig, now = Math.floor(Date.now() / 1000)) {
  const header = encoded({ alg: "ES256", kid: config.keyId });
  const payload = encoded({ iss: config.teamId, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: config.clientId });
  const input = `${header}.${payload}`;
  return `${input}.${sign("sha256", Buffer.from(input), { key: createPrivateKey(config.privateKey), dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
export async function revokeAppleAuthorization(
  code: string, expectedSubject: string, config: AppleRevocationConfig, transport: typeof fetch = fetch,
) {
  const clientSecret = appleClientSecret(config);
  const post = async (path: "token" | "revoke", values: Record<string, string>) => {
    const response = await transport(`https://appleid.apple.com/auth/${path}`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: clientSecret, ...values }).toString(),
    });
    if (!response.ok) throw new Error("Apple authorization could not be revoked.");
    return response;
  };
  const result = await (await post("token", { code, grant_type: "authorization_code" })).json() as Record<string, unknown>;
  if (typeof result.id_token !== "string" || typeof result.refresh_token !== "string") throw new Error("Invalid Apple response.");
  const parts = result.id_token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Apple identity.");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  const response = await transport("https://appleid.apple.com/auth/keys", { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Apple identity verification unavailable.");
  const keys = (await response.json() as { keys: Array<{ kid: string; kty: string; alg: string; n: string; e: string }> }).keys;
  const key = keys.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA" && candidate.alg === "RS256");
  if (header.alg !== "RS256" || !key || !verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: "jwk" }), Buffer.from(parts[2], "base64url")) ||
      payload.iss !== "https://appleid.apple.com" || payload.aud !== config.clientId || payload.sub !== expectedSubject ||
      typeof payload.exp !== "number" || payload.exp <= Date.now() / 1000) throw new Error("Apple identity does not match this account.");
  await post("revoke", { token: result.refresh_token, token_type_hint: "refresh_token" });
}
