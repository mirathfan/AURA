import { loadWardrobeForRetrieval, retrieveHybridCandidates } from "./hybridRetrieval";
import {
  hasHardRotationRequest,
  isWorkOccasion,
  isNotFreshForRole,
  isWornTooRecently,
  laundryStateForItem,
  normalizeOutfitLocalDate,
  normalizeOutfitWeatherContext,
  resolveOutfitWeather,
  summarizeOutfitWeather,
} from "./outfitSignals";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { outfitGenerationConfig } from "./config";
import {
  buildWardrobeRetrievalResult,
  buildWardrobeRetrievalResults,
  rawVectorLimit,
  type WardrobeVectorCandidate,
} from "./retrieval";
import type { WardrobeRetrievalFormality } from "./retrievalTypes";
import { canonicalizeOutfitRole } from "./outfitRole";
import {
  OUTFIT_ROLES,
  type NormalizedOutfitGenerationInput,
  type OutfitCandidate,
  type OutfitCandidateBuckets,
  type OutfitGenerationContext,
  type OutfitGenerationInput,
  type OutfitLaundryNotices,
  type OutfitRetrievalPlan,
  type OutfitRole,
} from "./outfitTypes";

const MAX_OUTFIT_COUNT = 5;
const DEFAULT_OUTFIT_COUNT = 3;
const ROLE_CATEGORY: Record<OutfitRole, string> = {
  top: "top",
  bottom: "bottom",
  footwear: "footwear",
  outerwear: "outerwear",
  accessory: "accessory",
  one_piece: "one_piece",
};

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizedText(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(cleanText).filter(Boolean);
  return [];
}

function uniqueNormalized(value: unknown, limit = 12): string[] {
  return [...new Set(asStringArray(value).map(normalizedText).filter(Boolean))].slice(0, limit);
}

function uniqueCleanStrings(value: unknown, limit = 24): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of asStringArray(value)) {
    const text = cleanText(entry);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeFormality(value: unknown): WardrobeRetrievalFormality {
  const text = normalizedText(value || "any");
  if (!text || text === "any") return "any";
  if (text === "smart casual" || text === "smart_casual") return "smart_casual";
  if (text === "business casual" || text === "business_casual") return "smart_casual";
  if (text === "athletic" || text === "lounge") return "casual";
  if (text === "casual" || text === "formal") return text;
  throw new HttpsError("invalid-argument", "formality must be casual, smart_casual, formal, or any.");
}

function normalizeRole(value: string): OutfitRole | null {
  const text = normalizedText(value);
  if (text === "shoe" || text === "shoes") return "footwear";
  if ((OUTFIT_ROLES as string[]).includes(text)) return text as OutfitRole;
  return null;
}

function normalizeRoles(value: unknown): OutfitRole[] {
  return [...new Set(asStringArray(value).map(normalizeRole).filter((role): role is OutfitRole => Boolean(role)))];
}

export function normalizeOutfitGenerationInput(value: unknown): NormalizedOutfitGenerationInput {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const query = cleanText(data.query).slice(0, 2000);
  if (!query) throw new HttpsError("invalid-argument", "A non-empty outfit query is required.");
  const count = Number(data.count ?? DEFAULT_OUTFIT_COUNT);
  const occasion = cleanText(data.occasion).slice(0, 200);
  const weather = cleanText(data.weather).slice(0, 200);
  const localDate = normalizeOutfitLocalDate(data.localDate);
  const userText = cleanText(data.userText).slice(0, 2000) || query;
  // Weather is kept only when it applies to the day the outfit is for. Older
  // app versions send neither weather nor a date, which is a valid request.
  const resolvedWeather = resolveOutfitWeather({
    userText,
    localDate,
    weatherContext: normalizeOutfitWeatherContext(data.weatherContext),
  });
  const weatherContext = resolvedWeather.weatherContext;
  return {
    query,
    userText,
    targetDay: resolvedWeather.targetDay,
    ...(resolvedWeather.ignoredReason ? { weatherIgnoredReason: resolvedWeather.ignoredReason } : {}),
    count: Math.max(1, Math.min(MAX_OUTFIT_COUNT, Number.isFinite(count) ? Math.floor(count) : DEFAULT_OUTFIT_COUNT)),
    ...(occasion ? { occasion } : {}),
    ...(weather ? { weather } : {}),
    ...(weatherContext ? { weatherContext } : {}),
    ...(localDate ? { localDate } : {}),
    formality: normalizeFormality(data.formality),
    preferredColors: uniqueNormalized(data.preferredColors),
    requiredColors: uniqueNormalized(data.requiredColors),
    requiredCategories: normalizeRoles(data.requiredCategories),
    requiredItemIds: uniqueCleanStrings(data.requiredItemIds ?? data.selectedItemIds, 24),
    avoidItemIds: uniqueCleanStrings(data.avoidItemIds, 24),
    avoidTerms: uniqueNormalized(data.avoidTerms, 16),
    includeDiagnostics: data.includeDiagnostics === true,
    useStyleMemory: data.useStyleMemory !== false,
  };
}

function intentFlags(input: NormalizedOutfitGenerationInput) {
  const text = normalizedText([input.userText ?? input.query, input.occasion, input.weather, input.formality].filter(Boolean).join(" "));
  const live = summarizeOutfitWeather(input.weatherContext);
  const typedWeather = /\b(summer|hot|beach|vacation|resort|warm|pool|rain|rainy|storm|wet|drizzle|cold|winter|snow|freezing|chilly)\b/.test(text);
  const liveBand = typedWeather ? null : live?.band ?? null;
  return {
    cold: /\b(cold|winter|snow|freezing|chilly)\b/.test(text) || liveBand === "freezing" || liveBand === "cold",
    liveHot: liveBand === "hot",
    liveWet: !typedWeather && live?.wet === true,
    office: isWorkOccasion(input.occasion || text),
    date: /\b(date|dinner|night out|evening|restaurant)\b/.test(text),
    streetwear: /\b(streetwear|street|sneaker|hoodie|cargo|graphic)\b/.test(text),
    summer: /\b(summer|hot|beach|vacation|resort|warm|pool)\b/.test(text),
    rain: /\b(rain|rainy|storm|wet|drizzle)\b/.test(text),
  };
}

function inferredOccasion(input: NormalizedOutfitGenerationInput): string | undefined {
  if (input.occasion) return input.occasion;
  const flags = intentFlags(input);
  if (flags.office) return "office";
  if (flags.date) return "dinner";
  if (flags.streetwear) return "streetwear";
  if (flags.summer) return "vacation";
  return undefined;
}

function inferredWeather(input: NormalizedOutfitGenerationInput): string | undefined {
  if (input.weather) return input.weather;
  const flags = intentFlags(input);
  if (flags.rain) return "rain";
  if (flags.summer) return "hot";
  return undefined;
}

function inferredFormality(input: NormalizedOutfitGenerationInput): WardrobeRetrievalFormality {
  if (input.formality !== "any") return input.formality;
  const flags = intentFlags(input);
  if (flags.office || flags.date) return "smart_casual";
  if (flags.streetwear || flags.summer) return "casual";
  return "any";
}

function categoryColorConstraints(input: NormalizedOutfitGenerationInput): Partial<Record<OutfitRole, string[]>> {
  const text = normalizedText(input.userText ?? input.query);
  const constraints: Partial<Record<OutfitRole, string[]>> = {};
  const colorNames = ["black", "white", "blue", "navy", "gray", "grey", "brown", "tan", "beige", "cream", "green", "red"];
  const normalizedColor = (color: string) => color === "grey" ? "gray" : color;
  for (const color of colorNames) {
    const c = normalizedColor(color);
    if (new RegExp(`\\b${color}\\b.{0,18}\\b(shoe|shoes|footwear|loafer|loafers|sneaker|sneakers|boot|boots|derby|derbies)\\b`).test(text) ||
        new RegExp(`\\b(shoe|shoes|footwear|loafer|loafers|sneaker|sneakers|boot|boots|derby|derbies)\\b.{0,18}\\b${color}\\b`).test(text)) {
      constraints.footwear = [...new Set([...(constraints.footwear ?? []), c])];
    }
    if (new RegExp(`\\b${color}\\b.{0,18}\\b(shirt|top|tee|polo|blouse)\\b`).test(text) ||
        new RegExp(`\\b(shirt|top|tee|polo|blouse)\\b.{0,18}\\b${color}\\b`).test(text)) {
      constraints.top = [...new Set([...(constraints.top ?? []), c])];
    }
  }
  return constraints;
}

function queryParts(base: string, extras: string[], colors: string[] = []): string {
  return [...new Set([base, ...extras, ...(colors.length ? [`colors ${colors.join(", ")}`] : [])])]
    .filter(Boolean)
    .join(", ");
}

export function buildOutfitRetrievalPlan(input: NormalizedOutfitGenerationInput | OutfitGenerationInput): OutfitRetrievalPlan {
  const normalized = "preferredColors" in input && Array.isArray(input.preferredColors)
    ? input as NormalizedOutfitGenerationInput
    : normalizeOutfitGenerationInput(input);
  const flags = intentFlags(normalized);
  const occasion = inferredOccasion(normalized);
  const weather = inferredWeather(normalized);
  const formality = inferredFormality(normalized);
  const constraints = categoryColorConstraints(normalized);
  const styleHints: string[] = [];
  const colorHints = [...new Set([...normalized.preferredColors, ...normalized.requiredColors])];

  if (flags.office) styleHints.push("office", "clean", "polished", "professional", "smart casual");
  if (flags.date) styleHints.push(
    "elevated",
    "date night",
    "dinner",
    "night out",
    "sleek",
    "polished",
    "romantic",
    "refined",
    "textured",
    "dark tones",
    "leather",
    "subtle statement",
  );
  if (flags.streetwear) styleHints.push("streetwear", "relaxed", "sneaker-friendly");
  if (flags.summer) styleHints.push("warm weather", "breathable", "relaxed");
  if (flags.rain || flags.liveWet) styleHints.push("rain-ready", "practical layer");
  if (flags.cold) styleHints.push("cold weather", "warm layers", "knitwear");
  if (flags.liveHot) styleHints.push("hot weather", "lightweight", "breathable");
  const coldTopExtras = flags.cold ? ["sweater", "knit", "long sleeve", "warm layer"] : [];
  const coldOuterwearExtras = flags.cold ? ["coat", "puffer", "insulated jacket", "warm outerwear"] : [];
  const coldFootwearExtras = flags.cold ? ["boots", "closed shoes"] : [];
  const wetOuterwearExtras = flags.rain || flags.liveWet ? ["rain jacket", "water resistant layer"] : [];

  const dateTopExtras = ["elevated shirt", "polo", "knit polo", "linen shirt", "button shirt", "textured top", "sleek night-out top"];
  const dateBottomExtras = ["trousers", "dark jeans", "clean relaxed trousers", "tailored pants", "textured trousers"];
  const dateFootwearExtras = ["loafers", "dress shoes", "derbies", "clean leather sneakers", "sleek shoes"];
  const dateOuterwearExtras = ["leather jacket", "racer jacket", "clean jacket", "overshirt", "structured layer", "subtle statement layer"];
  const dateAccessoryExtras = ["watch", "belt", "minimal accessory", "refined accessory"];

  const topExtras = flags.office
    ? ["button shirt", "oxford shirt", "polo", "knit polo", "overshirt", "clean professional shirt", ...(flags.date ? dateTopExtras : [])]
    : flags.date
      ? dateTopExtras
      : flags.streetwear
      ? ["hoodie", "graphic tee", "oversized tee", "layered streetwear top"]
      : flags.summer
        ? ["breathable shirt", "linen shirt", "cotton top", "relaxed summer top"]
        : ["versatile top", "shirt", "tee", "polo"];
  const bottomExtras = flags.office
    ? ["trousers", "chinos", "tailored pants", "clean dark jeans", ...(flags.date ? dateBottomExtras : [])]
    : flags.date
      ? dateBottomExtras
      : flags.streetwear
      ? ["cargos", "relaxed jeans", "streetwear pants"]
      : flags.summer
        ? ["shorts", "linen pants", "light trousers"]
        : ["pants", "jeans", "shorts"];
  const footwearExtras = flags.office
    ? ["black office shoes", "black loafers", "black dress shoes", "black derbies", "clean black leather sneakers", ...(flags.date ? dateFootwearExtras : [])]
    : flags.date
      ? dateFootwearExtras
      : flags.streetwear
      ? ["sneakers", "streetwear shoes", "statement sneakers"]
      : flags.summer
        ? ["sandals", "light sneakers", "summer footwear"]
        : ["shoes", "sneakers", "boots"];

  return {
    intent: {
      ...(occasion ? { occasion } : {}),
      formality,
      ...(weather ? { weather } : {}),
      styleHints,
      colorHints,
      categorySpecificConstraints: constraints,
    },
    categoryQueries: {
      top: queryParts(`${occasion ?? "outfit"} ${formality} top`, [...topExtras, ...coldTopExtras], constraints.top),
      bottom: queryParts(`${occasion ?? "outfit"} ${formality} bottom`, bottomExtras, constraints.bottom),
      footwear: queryParts(`${occasion ?? "outfit"} ${formality} footwear`, [...footwearExtras, ...coldFootwearExtras], constraints.footwear),
      outerwear: queryParts(`${occasion ?? "outfit"} ${formality} outerwear`, [
        ...(flags.office ? ["overshirt", "blazer", "clean jacket", "structured layer"] : ["jacket", "outerwear", "layer"]),
        ...(flags.date ? dateOuterwearExtras : []), ...coldOuterwearExtras, ...wetOuterwearExtras,
      ], constraints.outerwear),
      accessory: queryParts(`${occasion ?? "outfit"} ${formality} accessory`, flags.office
        ? ["watch", "belt", "minimal accessory", ...(flags.date ? dateAccessoryExtras : [])]
        : flags.date
          ? dateAccessoryExtras
          : ["accessory", "watch", "belt", "bag"], constraints.accessory),
      one_piece: queryParts(`${occasion ?? "outfit"} ${formality} one piece`, ["dress", "jumpsuit", "one piece outfit"], constraints.one_piece),
    },
  };
}

export type RetrieveOutfitContextDeps = {
  retrieveRoleCandidates?: (args: {
    uid: string;
    input: NormalizedOutfitGenerationInput;
    plan: OutfitRetrievalPlan;
    role: OutfitRole;
    query: string;
    limit: number;
    wardrobe?: WardrobeVectorCandidate[];
  }) => Promise<OutfitCandidate[]>;
  // Reads the closet once per request for the default role retriever.
  loadWardrobe?: (uid: string) => Promise<WardrobeVectorCandidate[]>;
  retrieveRequiredItemCandidates?: (args: {
    uid: string;
    input: NormalizedOutfitGenerationInput;
    plan: OutfitRetrievalPlan;
    itemIds: string[];
  }) => Promise<RequiredItemCandidateResult>;
};

export type RequiredItemCandidateResult = {
  candidates: OutfitCandidate[];
  missingItemIds?: string[];
  unavailableItemIds?: string[];
  incompatibleItemIds?: string[];
};

function emptyCandidateBuckets(): OutfitCandidateBuckets {
  return {
    top: [],
    bottom: [],
    footwear: [],
    outerwear: [],
    accessory: [],
    one_piece: [],
  };
}

function scoreValue(candidate: OutfitCandidate): number {
  return Number(candidate.score ?? candidate.finalScore ?? candidate.vectorScore ?? 0);
}

function sourceAiMetadataCategory(candidate: OutfitCandidate): string | null {
  const category = candidate.aiMetadata.category;
  return typeof category === "string" && category.trim() ? category.trim() : null;
}

function annotateCandidate(candidate: OutfitCandidate, sourceRole: OutfitRole): OutfitCandidate {
  const canonical = canonicalizeOutfitRole(candidate, candidate.role);
  const canonicalRole = canonical === "unknown" ? sourceRole : canonical;
  return {
    ...candidate,
    sourceRole: candidate.sourceRole ?? sourceRole,
    sourceCategory: candidate.sourceCategory ?? candidate.category,
    sourceAiMetadataCategory: candidate.sourceAiMetadataCategory ?? sourceAiMetadataCategory(candidate),
    role: canonicalRole,
    canonicalRole,
    allowedRole: canonicalRole,
  };
}

function retrievalResultToOutfitCandidate(result: ReturnType<typeof buildWardrobeRetrievalResults>[number], sourceRole?: OutfitRole): OutfitCandidate | null {
  if (result.category === "unknown") return null;
  const role = result.category as OutfitRole;
  const effectiveRole = sourceRole ?? role;
  return {
    itemId: result.itemId,
    name: result.name,
    category: result.category,
    role,
    canonicalRole: role,
    allowedRole: role,
    sourceRole: effectiveRole,
    sourceCategory: result.category,
    sourceAiMetadataCategory: typeof result.aiMetadata.category === "string" ? result.aiMetadata.category : null,
    ...(result.subcategory ? { subcategory: result.subcategory } : {}),
    ...(result.brand ? { brand: result.brand } : {}),
    colors: result.colors,
    score: result.score,
    vectorScore: result.vectorScore,
    finalScore: result.finalScore,
    reason: result.reason,
    imageUrl: result.imageUrl,
    aiMetadata: result.aiMetadata,
    embeddingTextPreview: result.embeddingTextPreview,
    status: result.status,
    ...(result.laundryState ? { laundryState: result.laundryState } : {}),
    ...(result.daysSinceWorn !== undefined ? { daysSinceWorn: result.daysSinceWorn } : {}),
    ...(result.wearCountSinceWash !== undefined ? { wearCountSinceWash: result.wearCountSinceWash } : {}),
    ...(result.pattern ? { pattern: result.pattern } : {}),
  };
}

function isInLaundry(candidate: OutfitCandidate): boolean {
  return candidate.laundryState === "in_laundry" || String(candidate.status ?? "").toUpperCase() === "IN_LAUNDRY";
}

// Items sitting in the laundry are not wearable right now. They are removed
// unless the user explicitly selected them, in which case the request wins
// and the reply says so (see laundryNotices).
export function excludeLaundryCandidates(
  buckets: OutfitCandidateBuckets,
  keepItemIds: string[] = [],
): { buckets: OutfitCandidateBuckets; excludedCount: number; excluded: OutfitCandidate[] } {
  const keep = new Set(keepItemIds);
  const filtered = emptyCandidateBuckets();
  const excluded: OutfitCandidate[] = [];
  for (const role of OUTFIT_ROLES) {
    for (const candidate of buckets[role]) {
      if (isInLaundry(candidate) && !keep.has(candidate.itemId)) {
        excluded.push(candidate);
        continue;
      }
      filtered[role].push(candidate);
    }
  }
  return { buckets: filtered, excludedCount: excluded.length, excluded };
}

// Wear rotation. A live eval showed the model keeps picking a piece worn that
// day, or one that needs a wash, even when told not to, so the preference is
// applied here by ranking. It is a preference, not a rule: a recently worn
// piece stays available when the closet is small or when it is clearly the
// best match, and it always stays when the user selected or named it. It
// becomes a rule only when the user asks for it outright.
export const ROTATION_MIN_FRESH_PER_ROLE = 3;
// A stale piece survives when its retrieval score beats the best fresh piece
// in its role by at least this much.
export const ROTATION_CLEARLY_BETTER_MARGIN = 0.15;

export function isStaleForRotation(candidate: OutfitCandidate): boolean {
  const role = candidate.allowedRole ?? candidate.role;
  return isWornTooRecently(role, candidate.daysSinceWorn) ||
    isNotFreshForRole(role, candidate.laundryState, candidate.wearCountSinceWash);
}

function rotationWords(text: unknown): string[] {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .map((word) => word.replace(/s$/, ""));
}

function wordsNamedIn(userText: string, target: unknown): boolean {
  const queryWords = new Set(rotationWords(userText));
  const words = rotationWords(target);
  return queryWords.size > 0 && words.length > 0 && words.every((word) => queryWords.has(word));
}

// "style my white sneakers" must keep the sneakers even if worn yesterday.
// Pass the user's own words, not the query with chat context appended.
export function queryNamesCandidate(
  userText: string,
  candidate: Pick<OutfitCandidate, "name" | "subcategory">,
): boolean {
  return wordsNamedIn(userText, candidate.subcategory) || wordsNamedIn(userText, candidate.name);
}

export function applyWearRotation(
  buckets: OutfitCandidateBuckets,
  options: {
    keepItemIds?: string[];
    userText?: string;
    minFreshPerRole?: number;
    mode?: "soft" | "hard";
  } = {},
): { buckets: OutfitCandidateBuckets; excludedCount: number; mode: "soft" | "hard" } {
  const keep = new Set(options.keepItemIds ?? []);
  const minFresh = Math.max(1, options.minFreshPerRole ?? ROTATION_MIN_FRESH_PER_ROLE);
  const mode = options.mode ?? (hasHardRotationRequest(options.userText) ? "hard" : "soft");
  const ranked = emptyCandidateBuckets();
  let excludedCount = 0;
  for (const role of OUTFIT_ROLES) {
    const all = buckets[role];
    const isProtected = (candidate: OutfitCandidate) =>
      keep.has(candidate.itemId) ||
      Boolean(options.userText && queryNamesCandidate(options.userText, candidate));
    const fresh = all.filter((candidate) => !isStaleForRotation(candidate) || isProtected(candidate));
    const stale = all.filter((candidate) => isStaleForRotation(candidate) && !isProtected(candidate));
    if (!stale.length) {
      ranked[role] = [...all];
      continue;
    }
    let keptStale: OutfitCandidate[];
    if (mode === "hard") {
      // A stated constraint: drop stale pieces whenever anything else exists.
      keptStale = fresh.length ? [] : stale;
    } else if (fresh.length < minFresh) {
      // Small closet: keep everything, fresh pieces first.
      keptStale = stale;
    } else {
      const bestFresh = Math.max(...fresh.map(scoreValue));
      keptStale = stale.filter((candidate) => scoreValue(candidate) >= bestFresh + ROTATION_CLEARLY_BETTER_MARGIN);
    }
    ranked[role] = [...fresh, ...keptStale];
    excludedCount += stale.length - keptStale.length;
  }
  return { buckets: ranked, excludedCount, mode };
}

// Laundry items the user asked for must never vanish silently. A selected
// item is kept and flagged; a named item is left out and explained.
export function findLaundryNotices(args: {
  userText: string;
  requiredItemIds: string[];
  // Every laundry item we know about for this request.
  laundryItems: { itemId: string; name: string; subcategory?: string }[];
  // Subcategories that still have a wearable piece.
  availableSubcategories: string[];
}): OutfitLaundryNotices {
  const required = new Set(args.requiredItemIds);
  const available = new Set(args.availableSubcategories.map((entry) => rotationWords(entry).join(" ")).filter(Boolean));
  const selectedInLaundry: string[] = [];
  const namedInLaundry: string[] = [];
  const seen = new Set<string>();
  for (const item of args.laundryItems) {
    if (seen.has(item.itemId)) continue;
    seen.add(item.itemId);
    const name = String(item.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!name) continue;
    if (required.has(item.itemId)) {
      selectedInLaundry.push(name);
      continue;
    }
    const namedExactly = wordsNamedIn(args.userText, item.name);
    // "something with jeans" only needs explaining when no clean jeans exist.
    const namedByKind = wordsNamedIn(args.userText, item.subcategory) &&
      !available.has(rotationWords(item.subcategory).join(" "));
    if (namedExactly || namedByKind) namedInLaundry.push(name);
  }
  return { selectedInLaundry: selectedInLaundry.slice(0, 4), namedInLaundry: namedInLaundry.slice(0, 4) };
}

export function canonicalizeOutfitCandidateBuckets(
  buckets: OutfitCandidateBuckets,
): OutfitCandidateBuckets {
  const byId = new Map<string, OutfitCandidate>();
  for (const sourceRole of OUTFIT_ROLES) {
    for (const candidate of buckets[sourceRole]) {
      const annotated = annotateCandidate(candidate, sourceRole);
      const existing = byId.get(annotated.itemId);
      if (!existing || scoreValue(annotated) > scoreValue(existing)) {
        byId.set(annotated.itemId, annotated);
      }
    }
  }

  const normalized = emptyCandidateBuckets();
  for (const candidate of byId.values()) {
    normalized[candidate.allowedRole].push(candidate);
  }
  for (const role of OUTFIT_ROLES) {
    normalized[role].sort((left, right) => scoreValue(right) - scoreValue(left));
  }
  return normalized;
}

async function defaultRetrieveRoleCandidates(args: {
  uid: string;
  input: NormalizedOutfitGenerationInput;
  plan: OutfitRetrievalPlan;
  role: OutfitRole;
  query: string;
  limit: number;
  wardrobe?: WardrobeVectorCandidate[];
}): Promise<OutfitCandidate[]> {
  const colors = args.plan.intent.categorySpecificConstraints[args.role] ?? [];
  const { candidates: allCandidates } = await retrieveHybridCandidates(
    args.uid,
    args.query,
    rawVectorLimit(args.limit),
    args.wardrobe ? { wardrobe: args.wardrobe } : {},
  );
  const required = new Set(args.input.requiredItemIds);
  const candidates = allCandidates.filter((candidate) =>
    required.has(candidate.itemId) || laundryStateForItem(candidate.item) !== "in_laundry");
  const results = buildWardrobeRetrievalResults({
    query: args.query,
    limit: args.limit,
    ...(args.plan.intent.occasion ? { occasion: args.plan.intent.occasion } : {}),
    ...(args.plan.intent.weather ? { weather: args.plan.intent.weather } : {}),
    formality: args.plan.intent.formality,
    categories: [ROLE_CATEGORY[args.role]],
    styleTags: [],
    colors,
    includeDiagnostics: false,
  }, candidates, { requireEmbedding: false });

  return results.flatMap((result) => retrievalResultToOutfitCandidate(result, args.role) ?? []);
}

async function defaultRetrieveRequiredItemCandidates(args: {
  uid: string;
  input: NormalizedOutfitGenerationInput;
  plan: OutfitRetrievalPlan;
  itemIds: string[];
}): Promise<RequiredItemCandidateResult> {
  if (!args.itemIds.length) return { candidates: [] };
  const firestore = getFirestore();
  const refs = args.itemIds.map((itemId) =>
    firestore.collection("users").doc(args.uid).collection("items").doc(itemId)
  );
  const snapshots = await firestore.getAll(...refs);
  const missingItemIds: string[] = [];
  const unavailableItemIds: string[] = [];
  const incompatibleItemIds: string[] = [];
  const candidates: OutfitCandidate[] = [];
  snapshots.forEach((snapshot, index) => {
    const itemId = args.itemIds[index];
    if (!snapshot.exists) {
      missingItemIds.push(itemId);
      return;
    }
    const result = buildWardrobeRetrievalResult({
      query: args.input.query,
      limit: 1,
      ...(args.input.occasion ? { occasion: args.input.occasion } : {}),
      categories: [],
      styleTags: [],
      colors: [],
      ...(args.input.weather ? { weather: args.input.weather } : {}),
      formality: args.input.formality,
      includeDiagnostics: false,
    }, {
      itemId,
      item: { id: itemId, ...(snapshot.data() ?? {}) },
      distance: 0,
    }, {
      requireEmbedding: false,
      applyFilters: false,
      forceScore: 1,
      reasonPrefix: "required selected closet item",
    });
    if (!result) {
      unavailableItemIds.push(itemId);
      return;
    }
    const candidate = retrievalResultToOutfitCandidate(result);
    if (!candidate) {
      incompatibleItemIds.push(itemId);
      return;
    }
    candidates.push(candidate);
  });
  return { candidates, missingItemIds, unavailableItemIds, incompatibleItemIds };
}

function missingRequiredRoles(candidates: OutfitCandidateBuckets): OutfitRole[] {
  const hasOnePiece = candidates.one_piece.length > 0;
  const missing: OutfitRole[] = [];
  if (!hasOnePiece && !candidates.top.length) missing.push("top");
  if (!hasOnePiece && !candidates.bottom.length) missing.push("bottom");
  if (!candidates.footwear.length) missing.push("footwear");
  return missing;
}

function mergeRequiredCandidates(
  candidates: OutfitCandidateBuckets,
  requiredCandidates: OutfitCandidate[],
): OutfitCandidateBuckets {
  const merged = emptyCandidateBuckets();
  for (const role of OUTFIT_ROLES) {
    merged[role] = [...candidates[role]];
  }
  for (const candidate of requiredCandidates) {
    const role = candidate.allowedRole ?? candidate.canonicalRole ?? candidate.role;
    if (!role) continue;
    const bucket = merged[role];
    const existingIndex = bucket.findIndex((entry) => entry.itemId === candidate.itemId);
    if (existingIndex >= 0) {
      bucket[existingIndex] = {
        ...bucket[existingIndex],
        score: Math.max(Number(bucket[existingIndex].score ?? 0), Number(candidate.score ?? 1)),
        finalScore: Math.max(Number(bucket[existingIndex].finalScore ?? 0), Number(candidate.finalScore ?? 1)),
        reason: [candidate.reason, bucket[existingIndex].reason].filter(Boolean).join("; "),
      };
    } else {
      bucket.unshift(candidate);
    }
  }
  return merged;
}

function assertRequiredItemCandidates(input: NormalizedOutfitGenerationInput, result: RequiredItemCandidateResult) {
  const missingItemIds = result.missingItemIds ?? [];
  const unavailableItemIds = result.unavailableItemIds ?? [];
  const incompatibleItemIds = result.incompatibleItemIds ?? [];
  if (!missingItemIds.length && !unavailableItemIds.length && !incompatibleItemIds.length) return;
  const itemIds = [...missingItemIds, ...unavailableItemIds, ...incompatibleItemIds];
  throw new HttpsError(
    "failed-precondition",
    "I can't use one of those selected closet items because it is missing, deleted, still processing, or missing category data.",
    {
      requiredItemIds: input.requiredItemIds,
      failedRequiredItemIds: itemIds,
      missingRequiredItemIds: missingItemIds,
      unavailableRequiredItemIds: unavailableItemIds,
      incompatibleRequiredItemIds: incompatibleItemIds,
    },
  );
}

export async function retrieveOutfitGenerationContext(
  uid: string,
  input: NormalizedOutfitGenerationInput | OutfitGenerationInput,
  deps: RetrieveOutfitContextDeps = {},
): Promise<OutfitGenerationContext> {
  const normalized = "preferredColors" in input && Array.isArray(input.preferredColors)
    ? input as NormalizedOutfitGenerationInput
    : normalizeOutfitGenerationInput(input);
  const config = outfitGenerationConfig();
  const plan = buildOutfitRetrievalPlan(normalized);
  const limit = config.maxCandidatesPerCategory;
  const retrieveRoleCandidates = deps.retrieveRoleCandidates ?? defaultRetrieveRoleCandidates;
  const retrieveRequiredItemCandidates = deps.retrieveRequiredItemCandidates ?? defaultRetrieveRequiredItemCandidates;
  const candidates = emptyCandidateBuckets();

  // The closet is read once and shared, and the role lookups run together.
  // Doing both per role in sequence cost up to six closet reads per request.
  const wardrobe = deps.retrieveRoleCandidates
    ? undefined
    : await (deps.loadWardrobe ?? loadWardrobeForRetrieval)(uid);
  await Promise.all(OUTFIT_ROLES.map(async (role) => {
    const query = plan.categoryQueries[role];
    if (!query) return;
    candidates[role] = await retrieveRoleCandidates({
      uid,
      input: normalized,
      plan,
      role,
      query,
      limit,
      ...(wardrobe ? { wardrobe } : {}),
    });
  }));
  const requiredResult = normalized.requiredItemIds.length
    ? await retrieveRequiredItemCandidates({
      uid,
      input: normalized,
      plan,
      itemIds: normalized.requiredItemIds,
    })
    : { candidates: [] };
  assertRequiredItemCandidates(normalized, requiredResult);
  const withRequiredCandidates = mergeRequiredCandidates(candidates, requiredResult.candidates);
  const canonicalWithRequired = canonicalizeOutfitCandidateBuckets(withRequiredCandidates);
  const laundryFiltered = excludeLaundryCandidates(canonicalWithRequired, normalized.requiredItemIds);
  const rotationFiltered = applyWearRotation(laundryFiltered.buckets, {
    keepItemIds: normalized.requiredItemIds,
    userText: normalized.userText,
  });
  const allCandidates = OUTFIT_ROLES.flatMap((role) => canonicalWithRequired[role]);
  const wardrobeLaundry = (wardrobe ?? [])
    .filter((entry) => laundryStateForItem(entry.item) === "in_laundry")
    .map((entry) => ({
      itemId: entry.itemId,
      name: String(entry.item.name ?? ""),
      ...(entry.item.subcategory ? { subcategory: String(entry.item.subcategory) } : {}),
    }));
  const laundryNotices = findLaundryNotices({
    userText: normalized.userText,
    requiredItemIds: normalized.requiredItemIds,
    laundryItems: [...allCandidates.filter(isInLaundry), ...laundryFiltered.excluded, ...wardrobeLaundry],
    availableSubcategories: wardrobe
      ? wardrobe.filter((entry) => laundryStateForItem(entry.item) !== "in_laundry")
        .map((entry) => String(entry.item.subcategory ?? ""))
      : OUTFIT_ROLES.flatMap((role) => laundryFiltered.buckets[role].map((entry) => entry.subcategory ?? "")),
  });
  const canonicalCandidates = rotationFiltered.buckets;

  return {
    retrievalPlan: plan,
    candidates: canonicalCandidates,
    diagnostics: {
      ...(laundryFiltered.excludedCount ? { laundryExcludedCount: laundryFiltered.excludedCount } : {}),
      ...(rotationFiltered.excludedCount ? { rotationExcludedCount: rotationFiltered.excludedCount } : {}),
      ...(rotationFiltered.excludedCount ? { rotationMode: rotationFiltered.mode } : {}),
      ...(laundryNotices.selectedInLaundry.length || laundryNotices.namedInLaundry.length ? { laundryNotices } : {}),
      ...(normalized.weatherIgnoredReason ? { weatherIgnoredReason: normalized.weatherIgnoredReason } : {}),
      candidateLimitPerCategory: limit,
      rawLimitPerCategory: rawVectorLimit(limit),
      missingRequiredRoles: missingRequiredRoles(canonicalCandidates),
      ...(requiredResult.missingItemIds?.length ? { missingRequiredItemIds: requiredResult.missingItemIds } : {}),
      ...(requiredResult.unavailableItemIds?.length ? { unavailableRequiredItemIds: requiredResult.unavailableItemIds } : {}),
      ...(requiredResult.incompatibleItemIds?.length ? { incompatibleRequiredItemIds: requiredResult.incompatibleItemIds } : {}),
      candidateCounts: {
        top: canonicalCandidates.top.length,
        bottom: canonicalCandidates.bottom.length,
        footwear: canonicalCandidates.footwear.length,
        outerwear: canonicalCandidates.outerwear.length,
        accessory: canonicalCandidates.accessory.length,
        one_piece: canonicalCandidates.one_piece.length,
      },
      categoryQueries: plan.categoryQueries,
    },
  };
}
