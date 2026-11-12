type ResetAction = { id: string; code: string; expiresAt: number };
let pending: ResetAction | null = null;
let sequence = 0;

// Codes never enter Router params, persistent storage, logs, or telemetry.
// This local timeout only bounds availability; Firebase validates actual expiry.
export function rememberPasswordReset(code: string) {
  pending = { id: String(++sequence), code, expiresAt: Date.now() + 10 * 60_000 };
  return pending.id;
}

export function getPasswordResetCode(id: string | undefined) {
  if (pending && pending.expiresAt <= Date.now()) pending = null;
  return id && pending?.id === id ? pending.code : null;
}

export function clearPasswordReset(id?: string) {
  if (!id || pending?.id === id) pending = null;
}
