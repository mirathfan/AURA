import { getAuraPlanningWeatherContext } from "@/src/lib/auraPlanningWeather";
import type { AuraAgentWeatherContext } from "@/src/types/auraAgent";

// Today's weather for outfit requests. It must never slow a request down much:
// the result is cached, and a slow lookup is skipped for this request while it
// finishes in the background for the next one. Only temperature and condition
// are sent; location never leaves the device through this path.
const CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_WAIT_MS = 1500;

type CacheEntry = {
  dateKey: string;
  fetchedAt: number;
  value: AuraAgentWeatherContext | undefined;
};

let cache: CacheEntry | null = null;
let pending: { dateKey: string; promise: Promise<AuraAgentWeatherContext | undefined> } | null = null;

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
  return Object.keys(context).length ? context : undefined;
}

async function loadWeather(dateKey: string): Promise<AuraAgentWeatherContext | undefined> {
  try {
    const value = toAuraAgentWeatherContext(await getAuraPlanningWeatherContext(dateKey));
    cache = { dateKey, fetchedAt: Date.now(), value };
    return value;
  } catch {
    return undefined;
  } finally {
    if (pending?.dateKey === dateKey) pending = null;
  }
}

export async function getAuraAgentWeatherContext(
  options: { waitMs?: number; now?: Date } = {},
): Promise<AuraAgentWeatherContext | undefined> {
  const dateKey = localDateKey(options.now);
  if (cache && cache.dateKey === dateKey && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.value;
  }
  if (!pending || pending.dateKey !== dateKey) {
    pending = { dateKey, promise: loadWeather(dateKey) };
  }
  const waitMs = Math.max(0, options.waitMs ?? DEFAULT_WAIT_MS);
  return Promise.race([
    pending.promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), waitMs)),
  ]);
}

export function resetAuraAgentWeatherCacheForTests() {
  cache = null;
  pending = null;
}
