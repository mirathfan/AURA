import {
  buildOutfitRetrievalPlan,
  excludeLaundryCandidates,
  excludeStaleCandidates,
  queryNamesCandidate,
  normalizeOutfitGenerationInput,
} from "../outfitContext";
import {
  generateValidatedOutfitsFromContext,
  resolveStylistMessage,
  type OutfitOpenAIClient,
} from "../outfitGeneration";
import {
  buildOutfitGenerationDeveloperPrompt,
  buildOutfitGenerationUserPrompt,
  isWornRecently,
} from "../outfitPrompt";
import {
  daysSinceLastWorn,
  laundryStateForItem,
  normalizeOutfitLocalDate,
  normalizeOutfitWeatherContext,
  outfitDateContext,
  pickOutfitUserPreferences,
  summarizeOutfitWeather,
} from "../outfitSignals";
import type {
  OutfitCandidate,
  OutfitCandidateBuckets,
  OutfitGenerationContext,
  OutfitRole,
} from "../outfitTypes";

function candidate(
  itemId: string,
  role: OutfitRole,
  name: string,
  extra: Partial<OutfitCandidate> = {},
): OutfitCandidate {
  return {
    itemId,
    name,
    role,
    canonicalRole: role,
    allowedRole: role,
    sourceRole: role,
    sourceCategory: role,
    sourceAiMetadataCategory: role === "footwear" ? "shoes" : role,
    category: role,
    colors: ["black"],
    score: 0.9,
    vectorScore: 0.9,
    finalScore: 0.9,
    reason: "test candidate",
    imageUrl: null,
    aiMetadata: {
      category: role === "footwear" ? "shoes" : role,
      formality: 3,
      fit: "relaxed",
      material: "wool",
      warmth: 4,
      styleTags: ["smart casual"],
      occasionTags: ["dinner"],
      seasonTags: ["winter"],
      weatherTags: ["cold"],
    },
    embeddingTextPreview: null,
    status: "AVAILABLE",
    laundryState: "clean",
    daysSinceWorn: 12,
    wearCountSinceWash: 0,
    ...extra,
  };
}

function buckets(overrides: Partial<OutfitCandidateBuckets> = {}): OutfitCandidateBuckets {
  return {
    top: [candidate("knit-top-01", "top", "Charcoal knit")],
    bottom: [candidate("denim-bottom-01", "bottom", "Dark denim")],
    footwear: [candidate("boots-shoes-01", "footwear", "Brown boots")],
    outerwear: [candidate("suede-jacket-01", "outerwear", "Suede jacket")],
    accessory: [],
    one_piece: [],
    ...overrides,
  };
}

function context(overrides: Partial<OutfitGenerationContext> = {}): OutfitGenerationContext {
  const input = normalizeOutfitGenerationInput({ query: "dinner tonight, nothing too formal" });
  return {
    retrievalPlan: buildOutfitRetrievalPlan(input),
    candidates: buckets(),
    diagnostics: {
      candidateLimitPerCategory: 8,
      rawLimitPerCategory: 24,
      missingRequiredRoles: [],
      candidateCounts: { top: 1, bottom: 1, footwear: 1, outerwear: 1, accessory: 0, one_piece: 0 },
      categoryQueries: buildOutfitRetrievalPlan(input).categoryQueries,
    },
    ...overrides,
  };
}

function outfitJson(stylistMessage: string, itemIds = ["knit-top-01", "denim-bottom-01", "boots-shoes-01"]) {
  const roles: Record<string, OutfitRole> = {
    "knit-top-01": "top",
    "denim-bottom-01": "bottom",
    "boots-shoes-01": "footwear",
    "suede-jacket-01": "outerwear",
  };
  return JSON.stringify({
    stylistMessage,
    outfits: [{
      title: "Relaxed Dinner",
      vibe: "warm, relaxed",
      occasion: "dinner",
      formality: "smart_casual",
      items: itemIds.map((itemId) => ({ itemId, role: roles[itemId], reason: "fits the request" })),
      explanation: "Warm and relaxed.",
      stylingTips: [],
      missingItems: [],
      confidence: 0.8,
    }],
  });
}

function clientReturning(...payloads: string[]): { client: OutfitOpenAIClient; calls: unknown[] } {
  const calls: unknown[] = [];
  let index = 0;
  return {
    calls,
    client: {
      responses: {
        create: async (args) => {
          calls.push(args);
          const output_text = payloads[Math.min(index, payloads.length - 1)];
          index += 1;
          return { output_text };
        },
      },
    },
  };
}

describe("outfit weather and date signals", () => {
  it("normalizes weather and rejects junk", () => {
    expect(normalizeOutfitWeatherContext({ tempF: 38.6, condition: "  Light   rain " }))
      .toEqual({ tempF: 39, condition: "Light rain" });
    expect(normalizeOutfitWeatherContext({ temperatureHigh: 70, temperatureLow: 55 }))
      .toEqual({ highF: 70, lowF: 55 });
    expect(normalizeOutfitWeatherContext({ tempF: "abc", highF: 900 })).toBeUndefined();
    expect(normalizeOutfitWeatherContext(null)).toBeUndefined();
  });

  it("summarizes weather into a band the model can act on", () => {
    expect(summarizeOutfitWeather({ tempF: 39, condition: "Light rain" }))
      .toEqual({ band: "cold", wet: true, text: "cold, about 39°F; Light rain" });
    expect(summarizeOutfitWeather({ highF: 92, lowF: 84 })?.band).toBe("hot");
    expect(summarizeOutfitWeather(undefined)).toBeNull();
  });

  it("accepts only real calendar dates", () => {
    expect(normalizeOutfitLocalDate("2026-11-14")).toBe("2026-11-14");
    expect(normalizeOutfitLocalDate("2026-02-31")).toBeUndefined();
    expect(normalizeOutfitLocalDate("tomorrow")).toBeUndefined();
    expect(outfitDateContext("2026-11-14")).toEqual({ date: "2026-11-14", weekday: "Saturday", month: "November" });
  });

  it("lets live cold weather steer retrieval only when the user did not state weather", () => {
    const cold = buildOutfitRetrievalPlan(normalizeOutfitGenerationInput({
      query: "casual outfit",
      weatherContext: { tempF: 30 },
    }));
    expect(cold.intent.styleHints).toContain("warm layers");
    expect(cold.categoryQueries.outerwear).toContain("coat");

    const typed = buildOutfitRetrievalPlan(normalizeOutfitGenerationInput({
      query: "beach vacation outfit",
      weatherContext: { tempF: 30 },
    }));
    expect(typed.intent.styleHints).not.toContain("warm layers");
    expect(typed.categoryQueries.outerwear).not.toContain("coat");
  });
});

describe("laundry and wear signals", () => {
  it("reads laundry state from new and legacy fields", () => {
    expect(laundryStateForItem({ laundryStatus: "in_laundry", status: "AVAILABLE" })).toBe("in_laundry");
    expect(laundryStateForItem({ status: "IN_LAUNDRY" })).toBe("in_laundry");
    expect(laundryStateForItem({ status: "WORN" })).toBe("needs_wash");
    expect(laundryStateForItem({ status: "AVAILABLE" })).toBe("clean");
    expect(laundryStateForItem(null)).toBe("clean");
  });

  it("computes days since last worn from numbers and timestamps", () => {
    const now = Date.UTC(2026, 10, 14);
    const threeDays = now - 3 * 24 * 60 * 60 * 1000;
    expect(daysSinceLastWorn({ lastWornAt: threeDays }, now)).toBe(3);
    expect(daysSinceLastWorn({ lastWornAt: { toMillis: () => threeDays } }, now)).toBe(3);
    expect(daysSinceLastWorn({ lastWornDate: threeDays }, now)).toBe(3);
    expect(daysSinceLastWorn({}, now)).toBeNull();
  });

  it("drops items in the laundry but keeps ones the user selected", () => {
    const input = buckets({
      top: [
        candidate("knit-top-01", "top", "Charcoal knit"),
        candidate("oxford-top-02", "top", "White oxford", { laundryState: "in_laundry", status: "IN_LAUNDRY" }),
      ],
      footwear: [candidate("boots-shoes-01", "footwear", "Brown boots", { laundryState: "needs_wash", status: "WORN" })],
    });
    const dropped = excludeLaundryCandidates(input);
    expect(dropped.excludedCount).toBe(1);
    expect(dropped.buckets.top.map((entry) => entry.itemId)).toEqual(["knit-top-01"]);
    expect(dropped.buckets.footwear).toHaveLength(1);

    const kept = excludeLaundryCandidates(input, ["oxford-top-02"]);
    expect(kept.excludedCount).toBe(0);
    expect(kept.buckets.top).toHaveLength(2);
  });
});

describe("wear rotation filter", () => {
  const closet = () => buckets({
    top: [
      candidate("tee-top-01", "top", "White tee", { daysSinceWorn: 1 }),
      candidate("knit-top-02", "top", "Charcoal knit", { daysSinceWorn: 9 }),
      candidate("oxford-top-03", "top", "White oxford", { laundryState: "needs_wash", daysSinceWorn: 6 }),
      candidate("polo-top-04", "top", "Navy polo"),
      candidate("shirt-top-05", "top", "Linen shirt", { daysSinceWorn: 2 }),
    ],
    footwear: [
      candidate("sneakers-shoes-01", "footwear", "White sneakers", { daysSinceWorn: 0, subcategory: "sneakers" }),
      candidate("boots-shoes-02", "footwear", "Brown boots"),
      candidate("loafers-shoes-03", "footwear", "Tan loafers"),
    ],
    accessory: [candidate("watch-acc-01", "accessory", "Steel watch", { daysSinceWorn: 0 })],
  });

  it("drops recently worn and unwashed items when enough fresh ones remain", () => {
    const result = excludeStaleCandidates(closet());
    expect(result.buckets.top.map((entry) => entry.itemId)).toEqual(["knit-top-02", "polo-top-04", "shirt-top-05"]);
    expect(result.excludedCount).toBe(2);
  });

  it("leaves a role alone when too few fresh items remain, and never touches accessories", () => {
    const result = excludeStaleCandidates(closet());
    // Only two fresh pairs of shoes: keep the sneakers as an option.
    expect(result.buckets.footwear).toHaveLength(3);
    expect(result.buckets.accessory).toHaveLength(1);
    const relaxed = excludeStaleCandidates(closet(), { minFreshPerRole: 2 });
    expect(relaxed.buckets.footwear.map((entry) => entry.itemId)).toEqual(["boots-shoes-02", "loafers-shoes-03"]);
  });

  it("keeps items the user selected or named", () => {
    const selected = excludeStaleCandidates(closet(), { keepItemIds: ["tee-top-01"] });
    expect(selected.buckets.top.map((entry) => entry.itemId)).toContain("tee-top-01");
    const named = excludeStaleCandidates(closet(), { query: "outfit with my white sneakers", minFreshPerRole: 2 });
    expect(named.buckets.footwear.map((entry) => entry.itemId)).toContain("sneakers-shoes-01");
    const [sneakers] = closet().footwear;
    expect(queryNamesCandidate("casual outfit for today", sneakers)).toBe(false);
    expect(queryNamesCandidate("something with sneakers", sneakers)).toBe(true);
  });
});

describe("stated user preferences", () => {
  it("forwards only styling-relevant fields", () => {
    const picked = pickOutfitUserPreferences({
      displayName: "Private Name",
      region: "US",
      budgetPreference: "premium",
      defaultSizes: { tops: "M" },
      wardrobeMode: "masculine",
      styleAesthetics: ["Streetwear", "streetwear", "Casual"],
      avoidedColors: ["orange"],
      preferredFit: "relaxed",
      fitPreferences: { tops: "relaxed", shoes: "half_up" },
      closetPreferences: { prioritizeUnderused: true },
    });
    expect(picked).toEqual({
      wardrobeMode: "masculine",
      styleAesthetics: ["Streetwear", "Casual"],
      avoidedColors: ["orange"],
      preferredFit: "relaxed",
      fitPreferences: { tops: "relaxed" },
      prioritizeUnderused: true,
    });
    expect(JSON.stringify(picked)).not.toMatch(/Private Name|premium|"M"|US/);
    expect(pickOutfitUserPreferences({})).toBeNull();
  });
});

describe("outfit prompt context", () => {
  it("gives the model garment details, weather, date and preferences", () => {
    const input = normalizeOutfitGenerationInput({
      query: "dinner tonight",
      weatherContext: { tempF: 39, condition: "Clear" },
      localDate: "2026-11-14",
    });
    const prompt = JSON.parse(buildOutfitGenerationUserPrompt(input, context({
      candidates: buckets({
        top: [candidate("knit-top-01", "top", "Charcoal knit", { pattern: "solid", laundryState: "needs_wash", wearCountSinceWash: 2 })],
      }),
      userPreferences: { preferredFit: "relaxed", avoidedColors: ["orange"] },
    })));
    expect(prompt.weatherNow).toBe("cold, about 39°F; Clear");
    expect(prompt.today).toEqual({ date: "2026-11-14", weekday: "Saturday", month: "November" });
    expect(prompt.userPreferences).toEqual({ preferredFit: "relaxed", avoidedColors: ["orange"] });
    expect(prompt.candidatesByRole.top[0]).toMatchObject({
      fit: "relaxed",
      material: "wool",
      pattern: "solid",
      warmth: 4,
      seasonTags: ["winter"],
      weatherTags: ["cold"],
      daysSinceWorn: 12,
      wornSinceWash: 2,
    });
    expect(prompt.candidatesByRole.bottom[0].wornSinceWash).toBeUndefined();
    expect(prompt.candidatesByRole.top[0].wornRecently).toBeUndefined();
    expect(isWornRecently(0)).toBe(true);
    expect(isWornRecently(2)).toBe(true);
    expect(isWornRecently(3)).toBe(false);
    expect(isWornRecently(null)).toBe(false);
    expect(buildOutfitGenerationDeveloperPrompt()).toMatch(/wornRecently/);
    expect(buildOutfitGenerationDeveloperPrompt()).toMatch(/weatherNow/);
    expect(buildOutfitGenerationDeveloperPrompt()).toMatch(/stylistMessage/);
  });

  it("stays valid when no extra context is available", () => {
    const prompt = JSON.parse(buildOutfitGenerationUserPrompt(
      normalizeOutfitGenerationInput({ query: "casual outfit" }),
      context(),
    ));
    expect(prompt.weatherNow).toBeNull();
    expect(prompt.today).toBeNull();
    expect(prompt.userPreferences).toBeNull();
  });
});

describe("stylist message", () => {
  const first = {
    title: "Relaxed Dinner",
    vibe: "warm",
    occasion: "dinner",
    formality: "smart_casual" as const,
    items: [
      { itemId: "knit-top-01", role: "top" as const, reason: "" },
      { itemId: "denim-bottom-01", role: "bottom" as const, reason: "" },
    ],
    explanation: "",
    stylingTips: [],
    missingItems: [],
    confidence: 0.8,
  };
  const returned = { items: [{ itemId: "denim-bottom-01" }, { itemId: "knit-top-01" }] };
  const ids = ["knit-top-01", "denim-bottom-01"];

  it("is used when it still describes the first outfit shown", () => {
    expect(resolveStylistMessage({
      message: "  Charcoal knit with dark denim.   Warm enough for tonight. ",
      firstGenerated: first,
      firstReturned: returned,
      candidateItemIds: ids,
    })).toBe("Charcoal knit with dark denim. Warm enough for tonight.");
  });

  it("is dropped when the first outfit changed, leaks an id, or is too long", () => {
    const base = { firstGenerated: first, firstReturned: returned, candidateItemIds: ids };
    expect(resolveStylistMessage({ ...base, message: "Nice", firstReturned: { items: [{ itemId: "other" }] } })).toBeUndefined();
    expect(resolveStylistMessage({ ...base, message: "Wear knit-top-01 tonight." })).toBeUndefined();
    expect(resolveStylistMessage({ ...base, message: "x".repeat(400) })).toBeUndefined();
    expect(resolveStylistMessage({ ...base, message: "See https://example.com" })).toBeUndefined();
    expect(resolveStylistMessage({ ...base, message: "" })).toBeUndefined();
  });

  it("is returned from generation only when the first pass was valid", async () => {
    const input = normalizeOutfitGenerationInput({ query: "dinner tonight, nothing too formal", count: 1 });
    const good = clientReturning(outfitJson("Charcoal knit, dark denim and the brown boots. Warm and relaxed."));
    const result = await generateValidatedOutfitsFromContext(input, context(), { client: good.client });
    expect(result.stylistMessage).toBe("Charcoal knit, dark denim and the brown boots. Warm and relaxed.");

    const repaired = clientReturning(
      outfitJson("First try.", ["knit-top-01", "denim-bottom-01", "made-up-item"]),
      outfitJson("Second try."),
    );
    const repairedResult = await generateValidatedOutfitsFromContext(input, context(), { client: repaired.client });
    expect(repairedResult.repaired).toBe(true);
    expect(repairedResult.outfits).toHaveLength(1);
    expect(repairedResult.stylistMessage).toBeUndefined();
  });
});
