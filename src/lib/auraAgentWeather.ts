import { getAuraPlanningWeatherContext } from "@/src/lib/auraPlanningWeather";
import type { AuraAgentWeatherContext } from "@/src/types/auraAgent";

// Weather for outfit requests, for the day the outfit is for. It must never slow a request down much:
// the result is cached, and a slow lookup is skipped for this request while it
// finishes in the background for the next one. Only temperature and condition
// are sent; location never leaves the device through this path.
const CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_WAIT_MS = 1500;

type CacheEntry = {
  fetchedAt: number;
  value: AuraAgentWeatherContext | undefined;
};

// Keyed by the day the weather is for, so asking about tomorrow never returns
// today's reading.
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<AuraAgentWeatherContext | undefined>>();

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localDateKey(date: Date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toFahrenheit(celsius: unknown): number | undefined {
  if (typeof celsius !== "number" || !Number.isFinite(celsius)) return undefined;
  return Math.round((celsius * 9) / 5 + 32);
}

export function toAuraAgentWeatherContext(
  weather: { temperatureHigh?: number; temperatureLow?: number; condition?: string } | undefined | null,
  stamp: { forDate?: string; observedAtMs?: number } = {},
): AuraAgentWeatherContext | undefined {
  if (!weather) return undefined;
  const highF = toFahrenheit(weather.temperatureHigh);
  const lowF = toFahrenheit(weather.temperatureLow);
  const condition = String(weather.condition ?? "").trim().slice(0, 60);
  const context: AuraAgentWeatherContext = {
    ...(highF !== undefined ? { highF } : {}),
    ...(lowF !== undefined ? { lowF } : {}),
    ...(condition ? { condition } : {}),
  };
  if (!Object.keys(context).length) return undefined;
  return {
    ...context,
    ...(stamp.forDate ? { forDate: stamp.forDate } : {}),
    ...(stamp.observedAtMs ? { observedAtMs: stamp.observedAtMs } : {}),
  };
}

async function loadWeather(dateKey: string): Promise<AuraAgentWeatherContext | undefined> {
  try {
    const observedAtMs = Date.now();
    const value = toAuraAgentWeatherContext(
      await getAuraPlanningWeatherContext(dateKey),
      { forDate: dateKey, observedAtMs },
    );
    cache.set(dateKey, { fetchedAt: observedAtMs, value });
    return value;
  } catch {
    return undefined;
  } finally {
    pending.delete(dateKey);
  }
}

export async function getAuraAgentWeatherContext(
  options: { waitMs?: number; now?: Date; dateKey?: string } = {},
): Promise<AuraAgentWeatherContext | undefined> {
  const dateKey = options.dateKey ?? localDateKey(options.now);
  const cached = cache.get(dateKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.value;
  let request = pending.get(dateKey);
  if (!request) {
    request = loadWeather(dateKey);
    pending.set(dateKey, request);
  }
  const waitMs = Math.max(0, options.waitMs ?? DEFAULT_WAIT_MS);
  return Promise.race([
    request,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), waitMs)),
  ]);
}

export function resetAuraAgentWeatherCacheForTests() {
  cache.clear();
  pending.clear();
}
