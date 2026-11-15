// Pure helpers that turn what the app already knows about the user and their
// closet (weather, date, laundry state, wear history, onboarding preferences)
// into compact signals for outfit generation. No I/O in this file.

export type OutfitWeatherBand = "freezing" | "cold" | "cool" | "mild" | "warm" | "hot";

export type OutfitWeatherContext = {
  tempF?: number;
  highF?: number;
  lowF?: number;
  condition?: string;
};

export type OutfitWeatherSummary = {
  band: OutfitWeatherBand | null;
  wet: boolean;
  text: string;
};

export type OutfitLaundryState = "clean" | "needs_wash" | "in_laundry";

export type OutfitUserPreferences = {
  wardrobeMode?: string;
  styleAesthetics?: string[];
  favoriteColors?: string[];
  avoidedColors?: string[];
  preferredFit?: string;
  fitPreferences?: Record<string, string>;
  occasionPriority?: string[];
  accessoryPreferences?: string[];
  preferredBrands?: string[];
  prioritizeUnderused?: boolean;
};

export type OutfitDateContext = {
  date: string;
  weekday: string;
  month: string;
};

const MIN_TEMP_F = -80;
const MAX_TEMP_F = 140;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_MS = 24 * 60 * 60 * 1000;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function temperature(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < MIN_TEMP_F || parsed > MAX_TEMP_F) return undefined;
  return Math.round(parsed);
}

function shortText(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    const text = shortText(entry, 60);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

export function normalizeOutfitWeatherContext(value: unknown): OutfitWeatherContext | undefined {
  const data = record(value);
  const tempF = temperature(data.tempF);
  const highF = temperature(data.highF ?? data.temperatureHigh);
  const lowF = temperature(data.lowF ?? data.temperatureLow);
  const condition = shortText(data.condition, 60);
  const context: OutfitWeatherContext = {
    ...(tempF !== undefined ? { tempF } : {}),
    ...(highF !== undefined ? { highF } : {}),
    ...(lowF !== undefined ? { lowF } : {}),
    ...(condition ? { condition } : {}),
  };
  return Object.keys(context).length ? context : undefined;
}

export function weatherBandForTempF(tempF: number): OutfitWeatherBand {
  if (tempF <= 32) return "freezing";
  if (tempF <= 48) return "cold";
  if (tempF <= 62) return "cool";
  if (tempF <= 74) return "mild";
  if (tempF <= 85) return "warm";
  return "hot";
}

export function summarizeOutfitWeather(context: OutfitWeatherContext | undefined | null): OutfitWeatherSummary | null {
  if (!context) return null;
  const reference = context.tempF ?? (
    context.highF !== undefined && context.lowF !== undefined
      ? Math.round((context.highF + context.lowF) / 2)
      : context.highF ?? context.lowF
  );
  const band = reference === undefined ? null : weatherBandForTempF(reference);
  const condition = (context.condition ?? "").toLowerCase();
  const wet = /\b(rain|rainy|drizzle|shower|showers|storm|thunder|snow|sleet|wet)\b/.test(condition);
  const parts: string[] = [];
  if (band && reference !== undefined) parts.push(`${band}, about ${reference}°F`);
  if (context.highF !== undefined && context.lowF !== undefined) {
    parts.push(`high ${context.highF}°F / low ${context.lowF}°F`);
  }
  if (context.condition) parts.push(context.condition);
  if (!parts.length) return null;
  return { band, wet, text: parts.join("; ") };
}

export function normalizeOutfitLocalDate(value: unknown): string | undefined {
  const text = shortText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const parsed = new Date(`${text}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10) === text ? text : undefined;
}

export function outfitDateContext(localDate: string | undefined | null): OutfitDateContext | null {
  const date = normalizeOutfitLocalDate(localDate);
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  return {
    date,
    weekday: WEEKDAYS[parsed.getUTCDay()],
    month: MONTHS[parsed.getUTCMonth()],
  };
}

export function laundryStateForItem(item: Record<string, unknown> | null | undefined): OutfitLaundryState {
  const data = record(item);
  const raw = String(data.laundryStatus ?? "").trim().toLowerCase();
  if (raw === "clean" || raw === "needs_wash" || raw === "in_laundry") return raw;
  const legacy = String(data.status ?? "").trim().toUpperCase();
  if (legacy === "IN_LAUNDRY" || data.inLaundry === true) return "in_laundry";
  if (legacy === "WORN") return "needs_wash";
  return "clean";
}

function millisFromUnknown(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  const candidate = value as { toMillis?: () => number; seconds?: unknown; _seconds?: unknown };
  if (typeof candidate.toMillis === "function") {
    const millis = candidate.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  const seconds = Number(candidate.seconds ?? candidate._seconds);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

export function daysSinceLastWorn(
  item: Record<string, unknown> | null | undefined,
  now: number = Date.now(),
): number | null {
  const data = record(item);
  const lastWorn = millisFromUnknown(data.lastWornAt) ?? millisFromUnknown(data.lastWornDate);
  if (lastWorn === null || lastWorn > now) return null;
  return Math.floor((now - lastWorn) / DAY_MS);
}

export function wearCountSinceWash(item: Record<string, unknown> | null | undefined): number | null {
  const count = Number(record(item).wearCountSinceWash);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
}

// Only styling-relevant preferences are forwarded to the model. Name, sizes,
// budget and region stay out of the outfit prompt on purpose.
export function pickOutfitUserPreferences(profile: unknown): OutfitUserPreferences | null {
  const data = record(profile);
  const stylePreferences = record(data.stylePreferences);
  const closetPreferences = record(data.closetPreferences);
  const fitPreferencesRaw = record(data.fitPreferences);
  const fitPreferences: Record<string, string> = {};
  for (const key of ["tops", "outerwear", "bottomsRise", "bottomsLeg"]) {
    const text = shortText(fitPreferencesRaw[key], 30);
    if (text) fitPreferences[key] = text;
  }
  const styleAesthetics = stringList(data.styleAesthetics, 6);
  const preferredStyles = stringList(stylePreferences.preferredStyles, 6);
  const favoriteColors = stringList(data.favoriteColors, 8);
  const avoidedColors = stringList(data.avoidedColors, 8);
  const occasionPriority = stringList(data.occasionPriority, 6);
  const accessoryPreferences = stringList(data.accessoryPreferences, 6);
  const preferredBrands = stringList(stylePreferences.preferredBrands, 6);
  const wardrobeMode = shortText(data.wardrobeMode, 20);
  const preferredFit = shortText(data.preferredFit, 20);
  const preferences: OutfitUserPreferences = {
    ...(wardrobeMode ? { wardrobeMode } : {}),
    ...(styleAesthetics.length || preferredStyles.length
      ? { styleAesthetics: styleAesthetics.length ? styleAesthetics : preferredStyles }
      : {}),
    ...(favoriteColors.length ? { favoriteColors } : {}),
    ...(avoidedColors.length ? { avoidedColors } : {}),
    ...(preferredFit ? { preferredFit } : {}),
    ...(Object.keys(fitPreferences).length ? { fitPreferences } : {}),
    ...(occasionPriority.length ? { occasionPriority } : {}),
    ...(accessoryPreferences.length ? { accessoryPreferences } : {}),
    ...(preferredBrands.length ? { preferredBrands } : {}),
    ...(closetPreferences.prioritizeUnderused === true ? { prioritizeUnderused: true } : {}),
  };
  return Object.keys(preferences).length ? preferences : null;
}
