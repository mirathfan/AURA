import { warmLayerItemIds } from "./outfitValidation";
import type {
  NormalizedOutfitGenerationInput,
  OutfitCandidate,
  OutfitGenerationContext,
  OutfitRole,
} from "./outfitTypes";
import {
  isNotFreshForRole,
  isWornTooRecently,
  outfitDateContext,
  summarizeOutfitWeather,
} from "./outfitSignals";

function metadataText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text && text.toLowerCase() !== "unknown" ? text : null;
}

function metadataList(value: unknown, limit = 4): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean).slice(0, limit)
    : [];
}

function metadataNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function candidateForPrompt(candidate: OutfitCandidate) {
  return {
    itemId: candidate.itemId,
    name: candidate.name,
    allowedRole: candidate.allowedRole,
    category: candidate.category,
    subcategory: candidate.subcategory ?? null,
    brand: candidate.brand ?? null,
    colors: candidate.colors,
    styleTags: Array.isArray(candidate.aiMetadata.styleTags) ? candidate.aiMetadata.styleTags : [],
    occasionTags: Array.isArray(candidate.aiMetadata.occasionTags) ? candidate.aiMetadata.occasionTags : [],
    formality: candidate.aiMetadata.formality ?? null,
    fit: metadataText(candidate.aiMetadata.fit),
    material: metadataText(candidate.aiMetadata.material),
    pattern: metadataText(candidate.pattern),
    warmth: metadataNumber(candidate.aiMetadata.warmth),
    seasonTags: metadataList(candidate.aiMetadata.seasonTags),
    weatherTags: metadataList(candidate.aiMetadata.weatherTags),
    daysSinceWorn: candidate.daysSinceWorn ?? null,
    // Flags follow the per-garment rules: a jacket worn yesterday, or boots
    // that have never been "washed", are not marked.
    ...(isWornTooRecently(candidate.allowedRole, candidate.daysSinceWorn) ? { wornRecently: true } : {}),
    ...(isNotFreshForRole(candidate.allowedRole, candidate.laundryState, candidate.wearCountSinceWash)
      ? { wornSinceWash: candidate.wearCountSinceWash ?? true }
      : {}),
    ...(candidate.laundryState === "in_laundry" ? { inLaundry: true } : {}),
    score: candidate.score,
    reason: candidate.reason,
  };
}

export function flattenOutfitCandidates(context: OutfitGenerationContext): OutfitCandidate[] {
  return [
    ...context.candidates.top,
    ...context.candidates.bottom,
    ...context.candidates.footwear,
    ...context.candidates.outerwear,
    ...context.candidates.accessory,
    ...context.candidates.one_piece,
  ];
}

export function buildOutfitGenerationDeveloperPrompt(): string {
  return [
    "You generate complete outfit recommendations using only the user's real closet candidates.",
    "Return JSON only. No markdown. No prose outside JSON.",
    "Only use itemIds from the provided candidates.",
    "If hardConstraints.requiredItemIds is non-empty, every returned outfit must include every exact required itemId unless no valid outfit is possible.",
    "For a cold outdoor request, include one of hardConstraints.warmLayerItemIds when supplied. Preserve the specified occasion when editing a look.",
    "Never use hardConstraints.avoidItemIds or items matching hardConstraints.avoidTerms.",
    "You must use each item only with its allowedRole. If an item has allowedRole top, use role top. If allowedRole footwear, use role footwear.",
    "Each outfit must be wearable and internally coherent.",
    "Prefer category balance: top + bottom + footwear; optional outerwear/accessory.",
    "A one_piece can replace top + bottom, but footwear is still required.",
    "If an item the user needs is not in candidates, put it in missingItems, not in items.",
    "Do not hallucinate item IDs, names, brands, or colors.",
    "Use style memory as personalization guidance, but never violate the user's current request.",
    "userPreferences are what the user told us directly (style, fit, favorite and avoided colors). Treat them as stronger than learned style memory and weaker than the current request. Skip avoided colors when a reasonable alternative exists.",
    "When weatherNow is present, dress for it: use each item's warmth (1 light to 5 very warm), material, seasonTags and weatherTags. In cold weather include a warm layer or outerwear when one exists; in hot weather avoid heavy layers; in wet weather avoid delicate footwear when an alternative exists. If the user states different weather in their request, the request wins. wearingOn, when present, is the day the outfit is for: weatherNow is then that day's forecast, and when weatherNow is null do not assume today's conditions.",
    "Build a real outfit, not a list: balance proportions using fit (for example relaxed with slimmer, or one oversized piece), keep to a coherent palette, and avoid stacking several loud patterns.",
    "userPreferences.preferredFit and fitPreferences are how the user likes clothes to fit. For tops and bottoms, choose a piece whose fit matches when one suits the occasion; only use a clearly opposite fit (for example slim for someone who prefers relaxed) when nothing matching works, and never just because it is the more obvious pick.",
    "When the request names no occasion or dress level (for example 'what should I wear today'), dress for an ordinary day in the user's own styleAesthetics rather than dressing up.",
    "Wear rotation applies to each role separately. Only flagged items count: coats, jackets and accessories are worn repeatedly and are never flagged. daysSinceWorn null means never logged as worn. An item marked wornRecently was worn today or yesterday: do not use it when another candidate in the same role suits the request, even if it is the more obvious choice. An item marked wornSinceWash is not fresh: do not use it when a clean candidate in the same role suits the request. Use a wornRecently or wornSinceWash item only when the user asked for it or every alternative in that role is clearly wrong for the request. Items marked inLaundry appear only because the user selected them.",
    "stylistMessage is the short chat reply shown above the outfit card. Write it as a confident personal stylist speaking to the user: 1 to 2 sentences, under 40 words, naming the key pieces in plain words and the one reason that matters most (weather, occasion or their taste). Vary how it opens and do not begin with 'Go with' or 'I found'. Describe each piece with its own listed color in ordinary lowercase words (for example 'the black pleated trousers'), and mention only pieces that are in the first outfit. Refer to the occasion only in the user's words; do not add plans they did not mention, such as a dinner or a date. No item IDs, no lists, no mention of data, scores, memory or preferences as such.",
    "Do not use tank tops, graphic tees, sandals, or athletic/gym shoes for office unless explicitly requested or no alternative exists.",
    "Keep stylingTips actionable and short.",
  ].join(" ");
}

export function buildOutfitGenerationUserPrompt(
  input: NormalizedOutfitGenerationInput,
  context: OutfitGenerationContext,
): string {
  const candidatesByRole: Record<OutfitRole, ReturnType<typeof candidateForPrompt>[]> = {
    top: context.candidates.top.map(candidateForPrompt),
    bottom: context.candidates.bottom.map(candidateForPrompt),
    footwear: context.candidates.footwear.map(candidateForPrompt),
    outerwear: context.candidates.outerwear.map(candidateForPrompt),
    accessory: context.candidates.accessory.map(candidateForPrompt),
    one_piece: context.candidates.one_piece.map(candidateForPrompt),
  };
  const warmLayers = warmLayerItemIds(input, context);
  return JSON.stringify({
    task: "Generate closet-only outfit recommendations.",
    requestedOutfitCount: input.count,
    userQuery: input.query,
    occasion: input.occasion ?? context.retrievalPlan.intent.occasion ?? null,
    formality: input.formality,
    inferredFormality: context.retrievalPlan.intent.formality,
    weather: input.weather ?? context.retrievalPlan.intent.weather ?? null,
    weatherNow: summarizeOutfitWeather(input.weatherContext)?.text ?? null,
    today: outfitDateContext(input.localDate),
    wearingOn: input.targetDay.kind === "tomorrow"
      ? { when: "tomorrow", ...(outfitDateContext(input.targetDay.date) ?? {}) }
      : input.targetDay.kind === "other"
        ? { when: "another day named in the request" }
        : null,
    userPreferences: context.userPreferences ?? null,
    retrievalPlan: context.retrievalPlan,
    styleMemory: context.styleMemory
      ? {
        profileSummary: context.styleMemory.profileSummary,
        positiveMemories: context.styleMemory.positiveMemories.map((memory) => `User tends to like: ${memory.text}`),
        negativeMemories: context.styleMemory.negativeMemories.map((memory) => `Avoid: ${memory.text}`),
        profileSignals: context.styleMemory.profileSignals,
      }
      : null,
    hardConstraints: {
      requiredItemIds: input.requiredItemIds,
      ...(input.replacementFootwear ? { replacementFootwear: input.replacementFootwear } : {}),
      ...(warmLayers ? { warmLayerItemIds: warmLayers } : {}),
      avoidItemIds: input.avoidItemIds,
      avoidTerms: input.avoidTerms,
    },
    candidatesByRole,
    outputSchema: {
      stylistMessage: "string, the short chat reply for the first outfit",
      outfits: [
        {
          title: "string",
          vibe: "string",
          occasion: "string",
          formality: "casual | smart_casual | formal",
          items: [
            {
              itemId: "provided candidate itemId only",
              role: "must exactly match the candidate allowedRole",
              reason: "string",
            },
          ],
          explanation: "string",
          stylingTips: ["string"],
          missingItems: ["string"],
          confidence: "number between 0 and 1",
        },
      ],
    },
  }, null, 2);
}
