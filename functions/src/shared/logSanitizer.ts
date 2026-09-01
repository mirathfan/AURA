type LogPrimitive = string | number | boolean | null | undefined;
export type SanitizedLogValue =
  | LogPrimitive
  | SanitizedLogValue[]
  | { [key: string]: SanitizedLogValue };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\bhttps?:\/\/[^\s"'<>)}\]]+/gi;
const USER_STORAGE_PATH_RE = /\busers\/[^/\s"'?]+\//gi;
const UID_KEY_RE = /^(uid|userId|user_id|firebaseUid|firebase_uid)$/i;
const SECRET_KEY_RE = /(authorization|cookie|set-cookie|token|idToken|refreshToken|firebaseToken|authToken|apiKey|secret|password)/i;
const USER_CONTENT_KEY_RE = /^(query|prompt|userMessage|chatText|requestText|reply|content)$/i;
const STORAGE_PATH_KEY_RE = /(storagePath|sourceStoragePath|refinedStoragePath)$/i;

const MAX_DEPTH = 6;
const MAX_ARRAY_LENGTH = 100;

function redactUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}/[redacted-path]`;
  } catch {
    return "[redacted-url]";
  }
}

function sanitizeString(value: string) {
  return value
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(USER_STORAGE_PATH_RE, "users/[redacted-id]/")
    .replace(URL_RE, (match) => redactUrl(match));
}

function storagePathSummary(value: unknown): SanitizedLogValue {
  const path = String(value ?? "").trim().replace(/^\/+/, "");
  if (!path) return null;
  const segments = path.split("/").filter(Boolean);
  const filename = segments.at(-1) ?? "";
  const extensionMatch = filename.match(/\.([a-z0-9]{1,10})$/i);
  return {
    scope: segments[0] === "users" ? "user_storage" : "storage",
    category: segments[0] === "users" ? segments[2] ?? null : segments[0] ?? null,
    extension: extensionMatch?.[1]?.toLowerCase() ?? null,
  };
}

export function sanitizeLogValue(
  value: unknown,
  key = "",
  depth = 0,
): SanitizedLogValue {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value as LogPrimitive;
  }
  if (SECRET_KEY_RE.test(key)) return "[redacted-secret]";
  if (UID_KEY_RE.test(key)) return "[redacted-id]";
  if (USER_CONTENT_KEY_RE.test(key)) {
    return {
      redacted: true,
      length: typeof value === "string" ? value.length : null,
    };
  }
  if (STORAGE_PATH_KEY_RE.test(key)) return storagePathSummary(value);
  if (typeof value === "string") return sanitizeString(value);
  if (depth >= MAX_DEPTH) return "[redacted-depth]";
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((entry) => sanitizeLogValue(entry, key, depth + 1));
  }
  if (typeof value === "object") {
    const sanitized: Record<string, SanitizedLogValue> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      sanitized[entryKey] = sanitizeLogValue(entryValue, entryKey, depth + 1);
    }
    return sanitized;
  }
  return sanitizeString(String(value));
}

export function sanitizeLogArgs(args: unknown[]) {
  return args.map((value) => sanitizeLogValue(value));
}
