import { generateKeyPairSync, sign, verify, createPublicKey } from "node:crypto";
import { appleClientSecret, revokeAppleAuthorization } from "./appleRevocation";
const signing = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const apple = generateKeyPairSync("rsa", { modulusLength: 2048 });
const config = { clientId: "com.example.test", teamId: "TEAM", keyId: "KEY", privateKey: signing.privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
function token(claims: Record<string, unknown> = {}, invalidSignature = false) {
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const input = `${encode({ alg: "RS256", kid: "apple-key" })}.${encode({ iss: "https://appleid.apple.com", aud: config.clientId, sub: "apple-owner", exp: Date.now() / 1000 + 600, ...claims })}`;
  return `${input}.${invalidSignature ? "invalid" : sign("RSA-SHA256", Buffer.from(input), apple.privateKey).toString("base64url")}`;
}
function transport(claims = {}, invalidSignature = false) {
  return jest.fn(async (url) => {
    if (String(url).endsWith("/token")) return new Response(JSON.stringify({ id_token: token(claims, invalidSignature), refresh_token: "synthetic-refresh" }));
    if (String(url).endsWith("/keys")) return new Response(JSON.stringify({ keys: [{ ...apple.publicKey.export({ format: "jwk" }), kid: "apple-key", alg: "RS256" }] }));
    return new Response("{}");
  }) as jest.MockedFunction<typeof fetch>;
}
it("creates a short-lived ES256 client secret only on the server", () => {
  const parts = appleClientSecret(config, 100).split(".");
  expect(JSON.parse(Buffer.from(parts[1], "base64url").toString())).toMatchObject({ iat: 100, exp: 400, sub: config.clientId });
  expect(verify("sha256", Buffer.from(parts.slice(0, 2).join(".")), { key: createPublicKey(signing.privateKey), dsaEncoding: "ieee-p1363" }, Buffer.from(parts[2], "base64url"))).toBe(true);
});
it("exchanges a fresh code, validates Apple identity, then revokes the refresh token", async () => {
  const fetcher = transport();
  await revokeAppleAuthorization("synthetic-code", "apple-owner", config, fetcher);
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual(["https://appleid.apple.com/auth/token", "https://appleid.apple.com/auth/keys", "https://appleid.apple.com/auth/revoke"]);
  expect(new URLSearchParams(fetcher.mock.calls[2][1]?.body as string).get("token")).toBe("synthetic-refresh");
  expect(fetcher.mock.calls.every((call) => call[1]?.redirect === "error")).toBe(true);
});
it.each([{ sub: "someone-else" }, { aud: "other-app" }, { iss: "attacker" }, { exp: 1 }])("does not revoke mismatched/expired identity %j", async (claims) => {
  const fetcher = transport(claims);
  await expect(revokeAppleAuthorization("code", "apple-owner", config, fetcher)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("rejects invalid signatures and expired/reused code exchanges", async () => {
  await expect(revokeAppleAuthorization("code", "apple-owner", config, transport({}, true))).rejects.toThrow();
  const fetcher = jest.fn(async () => new Response(JSON.stringify({ error: "sensitive-provider-error" }), { status: 400 }));
  await expect(revokeAppleAuthorization("expired-code", "apple-owner", config, fetcher)).rejects.toThrow("Apple authorization could not be revoked.");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("does not claim success for network failures or revocation rejection", async () => {
  const fetcher = transport();
  fetcher.mockImplementationOnce(async () => { throw new Error("offline"); });
  await expect(revokeAppleAuthorization("code", "apple-owner", config, fetcher)).rejects.toThrow();
  const rejected = transport(); const original = rejected.getMockImplementation();
  if (!original) throw new Error("Missing fixture");
  rejected.mockImplementation(async (input, init) => String(input).endsWith("/revoke") ? new Response("{}", { status: 503 }) : original(input, init));
  await expect(revokeAppleAuthorization("code", "apple-owner", config, rejected)).rejects.toThrow();
});
