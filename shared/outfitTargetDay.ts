// Which day an outfit request is for, worked out from the user's own words.
// Shared by the app (to fetch the right day's weather) and the backend (to
// decide whether the weather it was sent applies). Pure: no I/O, no clock.

export type OutfitTargetDay =
  | { kind: "today"; date?: string }
  | { kind: "tomorrow"; date?: string }
  // Some other time (a trip, the weekend, a named weekday). Today's weather
  // says nothing about it.
  | { kind: "other" };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TOMORROW = /\b(tomorrow|tmrw|tmr)\b/;
const OTHER_DAY = new RegExp([
  "\\b(next|this|coming)\\s+(week|weekend|month|year|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)",
  "\\b(on|for)\\s+(mon|tues|wednes|thurs|fri|satur|sun)day\\b",
  "\\b(mon|tues|wednes|thurs|fri|satur|sun)day\\b",
  "\\bin\\s+(a|\\d+|two|three|four|five|six|seven)\\s+(day|days|week|weeks|month|months)\\b",
  "\\b(vacation|holiday|trip|travel|travelling|traveling|getaway|honeymoon|pack|packing|flight|flying)\\b",
  "\\b(weekend|next week|later this week)\\b",
].join("|"));

export function addDaysToDateKey(dateKey: string, days: number): string | undefined {
  if (!DATE_KEY.test(dateKey)) return undefined;
  const parsed = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function resolveOutfitTargetDay(
  userText: string | undefined | null,
  localDate?: string | null,
): OutfitTargetDay {
  const text = String(userText ?? "").toLowerCase();
  const today = localDate && DATE_KEY.test(localDate) ? localDate : undefined;
  if (TOMORROW.test(text)) {
    const date = today ? addDaysToDateKey(today, 1) : undefined;
    return { kind: "tomorrow", ...(date ? { date } : {}) };
  }
  if (OTHER_DAY.test(text)) return { kind: "other" };
  return { kind: "today", ...(today ? { date: today } : {}) };
}
