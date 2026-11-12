export const INDEXING_MAX_ATTEMPTS = 8;
export const INDEXING_LEASE_MS = 2 * 60_000;
export const INDEXING_CONCURRENCY = 4;
export const INDEXING_SWEEP_LIMIT = 40;
export type IndexingState = "pending" | "processing" | "completed" | "retryable_failure" | "terminal_failure";

// Equal jitter: 30–60s initially, capped at 30–60m. Never save raw errors.
export function indexingRetryDelay(attempt: number, random = Math.random()): number {
  const cap = Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, attempt - 1));
  return Math.floor(cap * (0.5 + Math.max(0, Math.min(1, random)) / 2));
}
export function indexingFailure(error: unknown): { code: string; terminal: boolean } {
  const e = error as { code?: string; details?: { code?: string }; status?: number };
  if (e?.details?.code === "AI_CONSENT_REQUIRED") return { code: "consent_required", terminal: true };
  if (e?.code === "invalid-argument" || e?.details?.code === "EMBEDDING_CONFIGURATION") return { code: "invalid_input_or_configuration", terminal: true };
  if (e?.code === "resource-exhausted") return { code: "quota", terminal: false };
  return { code: "provider_or_storage_unavailable", terminal: false };
}
