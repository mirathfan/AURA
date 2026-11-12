// Only validated status/favorite fields and numeric/timestamp counters/dates may change without a media permit. Unknown
// fields are protected by default; adding an image-bearing field is fail-closed.
export const MEDIA_SAFE_FIELDS = ["status", "laundryStatus", "isFavorite", "wearCountSinceWash", "laundryUpdatedAt", "lastWornAt", "lastWornDate", "lastWashedAt", "lastWashedDate", "createdAt", "updatedAt", "deletedAt", "savedAt", "messageCount"] as const;
const safe = new Set<string>(MEDIA_SAFE_FIELDS);
export function mediaProjection(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !safe.has(key)));
}
export function needsMediaPermit(data: Record<string, unknown>) {
  return Object.keys(data).some((key) => !safe.has(key.split('.')[0]));
}
