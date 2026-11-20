import { addDaysToDateKey, resolveOutfitTargetDay } from "../../../../../shared/outfitTargetDay";
import { handleRunAuraStylingAgent } from "../agentCallables";
import { laundryNoticeText } from "../agentResponse";
import {
  applyWearRotation,
  buildOutfitRetrievalPlan,
  findLaundryNotices,
  isStaleForRotation,
  normalizeOutfitGenerationInput,
  retrieveOutfitGenerationContext,
} from "../outfitContext";
import {
  generateValidatedOutfitsWithRetry,
  OUTFIT_MAX_MODEL_CALLS_PER_REQUEST,
  type OutfitOpenAIClient,
} from "../outfitGeneration";
import { buildOutfitGenerationUserPrompt } from "../outfitPrompt";
import {
  hasHardRotationRequest,
  isNotFreshForRole,
  isWornTooRecently,
  normalizeOutfitWeatherContext,
  resolveOutfitWeather,
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
    category: role,
    colors: ["black"],
    score: 0.6,
    vectorScore: 0.6,
    finalScore: 0.6,
    reason: "test candidate",
    imageUrl: null,
    aiMetadata: { category: role === "footwear" ? "shoes" : role, formality: 3 },
    embeddingTextPreview: null,
    status: "AVAILABLE",
    laundryState: "clean",
    daysSinceWorn: 12,
    ...extra,
  };
}

function buckets(overrides: Partial<OutfitCandidateBuckets> = {}): OutfitCandidateBuckets {
  return {
    top: [candidate("knit-top-01", "top", "Charcoal knit")],
    bottom: [candidate("denim-bottom-01", "bottom", "Dark denim")],
    footwear: [candidate("boots-shoes-01", "footwear", "Brown boots")],
    outerwear: [],
    accessory: [],
    one_piece: [],
    ...overrides,
  };
}

function contextFor(query: string, candidates = buckets()): OutfitGenerationContext {
  const input = normalizeOutfitGenerationInput({ query });
  return {
    retrievalPlan: buildOutfitRetrievalPlan(input),
    candidates,
    diagnostics: {
      candidateLimitPerCategory: 8,
      rawLimitPerCategory: 24,
      missingRequiredRoles: [],
      candidateCounts: { top: 1, bottom: 1, footwear: 1, outerwear: 0, accessory: 0, one_piece: 0 },
      categoryQueries: buildOutfitRetrievalPlan(input).categoryQueries,
    },
  };
}

function outfitJson(itemIds: string[]) {
  const roles: Record<string, OutfitRole> = {
    "knit-top-01": "top",
    "denim-bottom-01": "bottom",
    "boots-shoes-01": "footwear",
  };
  return JSON.stringify({
    stylistMessage: "A relaxed look.",
    outfits: [{
      title: "Look",
      vibe: "relaxed",
      occasion: "dinner",
      formality: "smart_casual",
      items: itemIds.map((itemId) => ({ itemId, role: roles[itemId] ?? "top", reason: "fits" })),
      explanation: "Works.",
      stylingTips: [],
      missingItems: [],
      confidence: 0.8,
    }],
  });
}

const GOOD = outfitJson(["knit-top-01", "denim-bottom-01", "boots-shoes-01"]);
const BAD = outfitJson(["ghost-top-99", "denim-bottom-01", "boots-shoes-01"]);

function clientReturning(...payloads: string[]) {
  const prompts: Record<string, unknown>[] = [];
  let index = 0;
  const client: OutfitOpenAIClient = {
    responses: {
      create: async (args) => {
        const input = args.input as { content: unknown }[];
        const text = (input[1].content as { text: string }[])[0].text;
        prompts.push(JSON.parse(text.split("\n\nRepair instruction:")[0]) as Record<string, unknown>);
        const output_text = payloads[Math.min(index, payloads.length - 1)];
        index += 1;
        return { output_text };
      },
    },
  };
  return { client, prompts };
}

describe("1. selected, named and laundry items", () => {
  it("lets a selected or named item override rotation", () => {
    const closet = buckets({
      footwear: [
        candidate("sneakers-shoes-01", "footwear", "White sneakers", { daysSinceWorn: 0, subcategory: "sneakers" }),
        candidate("boots-shoes-02", "footwear", "Brown boots"),
        candidate("loafers-shoes-03", "footwear", "Tan loafers"),
        candidate("derbies-shoes-04", "footwear", "Black derbies"),
      ],
    });
    const ids = (result: ReturnType<typeof applyWearRotation>) => result.buckets.footwear.map((entry) => entry.itemId);
    expect(ids(applyWearRotation(closet))).not.toContain("sneakers-shoes-01");
    expect(ids(applyWearRotation(closet, { keepItemIds: ["sneakers-shoes-01"] }))).toContain("sneakers-shoes-01");
    expect(ids(applyWearRotation(closet, { userText: "style my white sneakers" }))).toContain("sneakers-shoes-01");
  });

  it("explains a named laundry item instead of dropping it silently", () => {
    const notices = findLaundryNotices({
      userText: "outfit with my camel coat",
      requiredItemIds: [],
      laundryItems: [
        { itemId: "coat-1", name: "Camel Coat", subcategory: "coat" },
        { itemId: "tee-1", name: "White Tee", subcategory: "t-shirt" },
      ],
      availableSubcategories: ["jacket"],
    });
    expect(notices).toEqual({ selectedInLaundry: [], namedInLaundry: ["Camel Coat"] });
    expect(laundryNoticeText(notices)).toBe(
      "Your Camel Coat is in the laundry, so I left it out. Tell me if it's clean and I'll use it.",
    );
  });

  it("resolves named laundry coats before considering a shared garment kind", () => {
    const wardrobe = {
      requiredItemIds: [], availableSubcategories: [],
      laundryItems: [
        { itemId: "camel", name: "Camel Wool Overcoat", subcategory: "overcoat" },
        { itemId: "navy", name: "Navy Long Wool Coat", subcategory: "overcoat" },
      ],
    };
    const named = (userText: string) => findLaundryNotices({ ...wardrobe, userText }).namedInLaundry;
    expect(named("dinner outfit with my Camel Wool Overcoat")).toEqual(["Camel Wool Overcoat"]);
    expect(named("Camel Wool Overcoat or Navy Long Wool Coat")).toEqual(["Camel Wool Overcoat", "Navy Long Wool Coat"]);
    expect(named("outfit with an overcoat")).toEqual(["Camel Wool Overcoat", "Navy Long Wool Coat"]);
  });

  it("only explains a kind of garment when no clean one exists", () => {
    const base = {
      userText: "something with jeans",
      requiredItemIds: [],
      laundryItems: [{ itemId: "jeans-1", name: "Dark Indigo Straight Leg", subcategory: "jeans" }],
    };
    expect(findLaundryNotices({ ...base, availableSubcategories: ["jeans"] }).namedInLaundry).toEqual([]);
    expect(findLaundryNotices({ ...base, availableSubcategories: ["trousers"] }).namedInLaundry)
      .toEqual(["Dark Indigo Straight Leg"]);
  });

  it("keeps a selected laundry item but says it is marked in the laundry", async () => {
    const coat = candidate("coat-1", "outerwear", "Camel Coat", { laundryState: "in_laundry", status: "IN_LAUNDRY" });
    const context = await retrieveOutfitGenerationContext("uid", {
      query: "style this coat",
      selectedItemIds: ["coat-1"],
    }, {
      retrieveRoleCandidates: async ({ role }) => buckets()[role],
      retrieveRequiredItemCandidates: async () => ({ candidates: [coat] }),
    });
    expect(context.candidates.outerwear.map((entry) => entry.itemId)).toEqual(["coat-1"]);
    expect(context.diagnostics.laundryNotices).toEqual({ selectedInLaundry: ["Camel Coat"], namedInLaundry: [] });
    expect(laundryNoticeText(context.diagnostics.laundryNotices)).toMatch(/marked as in the laundry.*because you picked it/);
  });

  it("reports a named laundry item found among retrieved candidates", async () => {
    const context = await retrieveOutfitGenerationContext("uid", { query: "wear my camel coat tonight" }, {
      retrieveRoleCandidates: async ({ role }) => role === "outerwear"
        ? [candidate("coat-1", "outerwear", "Camel Coat", { laundryState: "in_laundry", subcategory: "coat" })]
        : buckets()[role],
    });
    expect(context.candidates.outerwear).toEqual([]);
    expect(context.diagnostics.laundryNotices?.namedInLaundry).toEqual(["Camel Coat"]);
  });

  it("says nothing when no laundry item was asked for", () => {
    expect(laundryNoticeText(undefined)).toBe("");
    expect(laundryNoticeText({ selectedInLaundry: [], namedInLaundry: [] })).toBe("");
  });
});

describe("2. rotation is a ranking preference with per-garment rules", () => {
  it("never treats coats, shoes or accessories as unwashed, and lets trousers go a few wears", () => {
    expect(isNotFreshForRole("top", "needs_wash", 1)).toBe(true);
    expect(isNotFreshForRole("top", "needs_wash", null)).toBe(true);
    expect(isNotFreshForRole("bottom", "needs_wash", 1)).toBe(false);
    expect(isNotFreshForRole("bottom", "needs_wash", 3)).toBe(true);
    expect(isNotFreshForRole("outerwear", "needs_wash", 9)).toBe(false);
    expect(isNotFreshForRole("footwear", "needs_wash", 9)).toBe(false);
    expect(isNotFreshForRole("accessory", "needs_wash", 9)).toBe(false);
    expect(isNotFreshForRole("top", "clean", 5)).toBe(false);
  });

  it("does not rotate outerwear for being worn yesterday", () => {
    expect(isWornTooRecently("outerwear", 0)).toBe(false);
    expect(isWornTooRecently("footwear", 1)).toBe(true);
    const coat = candidate("coat-1", "outerwear", "Camel Coat", { daysSinceWorn: 0, laundryState: "needs_wash" });
    expect(isStaleForRotation(coat)).toBe(false);
    const closet = buckets({
      outerwear: [
        coat,
        candidate("shell-2", "outerwear", "Rain shell"),
        candidate("puffer-3", "outerwear", "Puffer"),
        candidate("trucker-4", "outerwear", "Trucker"),
      ],
    });
    expect(applyWearRotation(closet).buckets.outerwear.map((entry) => entry.itemId)).toContain("coat-1");
  });

  it("keeps a recently worn piece that is clearly the best match", () => {
    const closet = buckets({
      top: [
        candidate("tee-1", "top", "White tee", { daysSinceWorn: 1, score: 0.95 }),
        candidate("knit-2", "top", "Knit", { score: 0.6 }),
        candidate("polo-3", "top", "Polo", { score: 0.55 }),
        candidate("shirt-4", "top", "Shirt", { score: 0.5 }),
        candidate("hoodie-5", "top", "Hoodie", { daysSinceWorn: 0, score: 0.62 }),
      ],
    });
    const result = applyWearRotation(closet);
    // Fresh pieces first; the strong match survives at the end; the marginal one goes.
    expect(result.buckets.top.map((entry) => entry.itemId)).toEqual(["knit-2", "polo-3", "shirt-4", "tee-1"]);
    expect(result.excludedCount).toBe(1);
    expect(result.mode).toBe("soft");
  });

  it("in a small closet keeps everything and only reorders", () => {
    const closet = buckets({
      top: [
        candidate("tee-1", "top", "White tee", { daysSinceWorn: 0 }),
        candidate("knit-2", "top", "Knit"),
      ],
    });
    const result = applyWearRotation(closet);
    expect(result.buckets.top.map((entry) => entry.itemId)).toEqual(["knit-2", "tee-1"]);
    expect(result.excludedCount).toBe(0);
  });

  it("becomes a hard rule only when the user asks for it", () => {
    expect(hasHardRotationRequest("something I haven't worn lately")).toBe(true);
    expect(hasHardRotationRequest("no repeats this week please")).toBe(true);
    expect(hasHardRotationRequest("casual outfit for today")).toBe(false);
    const closet = buckets({
      top: [
        candidate("tee-1", "top", "White tee", { daysSinceWorn: 0, score: 0.99 }),
        candidate("knit-2", "top", "Knit"),
      ],
    });
    const hard = applyWearRotation(closet, { userText: "something I haven't worn" });
    expect(hard.mode).toBe("hard");
    expect(hard.buckets.top.map((entry) => entry.itemId)).toEqual(["knit-2"]);
    // Even a hard rule never empties a role.
    const only = applyWearRotation(buckets({ top: [candidate("tee-1", "top", "White tee", { daysSinceWorn: 0 })] }), { mode: "hard" });
    expect(only.buckets.top).toHaveLength(1);
  });

  it("only flags garments the rules apply to in the prompt", () => {
    const context = contextFor("casual outfit", buckets({
      top: [candidate("tee-1", "top", "Tee", { daysSinceWorn: 0, laundryState: "needs_wash", wearCountSinceWash: 1 })],
      outerwear: [candidate("coat-1", "outerwear", "Coat", { daysSinceWorn: 0, laundryState: "needs_wash", wearCountSinceWash: 4 })],
    }));
    const prompt = JSON.parse(buildOutfitGenerationUserPrompt(normalizeOutfitGenerationInput({ query: "casual outfit" }), context));
    expect(prompt.candidatesByRole.top[0]).toMatchObject({ wornRecently: true, wornSinceWash: 1 });
    expect(prompt.candidatesByRole.outerwear[0].wornRecently).toBeUndefined();
    expect(prompt.candidatesByRole.outerwear[0].wornSinceWash).toBeUndefined();
  });
});

describe("3. retries are bounded and keep the user's constraints", () => {
  const input = normalizeOutfitGenerationInput({
    query: "dinner tonight",
    avoidItemIds: ["loafers-shoes-09"],
    avoidTerms: ["orange"],
  });

  it("never exceeds the per-request model call budget, repair included", async () => {
    const { client, prompts } = clientReturning(BAD);
    const failures: { willRetry: boolean; modelCalls: number }[] = [];
    await expect(generateValidatedOutfitsWithRetry(input, contextFor("dinner tonight"), {
      client,
      maxAttempts: 3,
      onValidationFailure: (info) => failures.push(info),
    })).rejects.toThrow(/failed validation/);
    expect(prompts.length).toBe(OUTFIT_MAX_MODEL_CALLS_PER_REQUEST);
    expect(failures[failures.length - 1].willRetry).toBe(false);
  });

  it("does not start a retry after the deadline", async () => {
    const { client, prompts } = clientReturning(BAD, BAD, GOOD);
    let clock = 0;
    await expect(generateValidatedOutfitsWithRetry(input, contextFor("dinner tonight"), {
      client,
      retryDeadlineMs: 1000,
      now: () => { clock += 1200; return clock; },
    })).rejects.toThrow(/failed validation/);
    expect(prompts.length).toBe(2);
  });

  it("sends the same constraints on every attempt", async () => {
    const { client, prompts } = clientReturning(BAD, BAD, GOOD);
    const result = await generateValidatedOutfitsWithRetry(input, contextFor("dinner tonight"), { client });
    expect(result.outfits).toHaveLength(1);
    expect(prompts).toHaveLength(3);
    for (const prompt of prompts) {
      expect(prompt.hardConstraints).toEqual({
        requiredItemIds: [],
        avoidItemIds: ["loafers-shoes-09"],
        avoidTerms: ["orange"],
      });
      expect(prompt.userQuery).toBe("dinner tonight");
    }
  });

  it("makes one call when the first outfit is valid", async () => {
    const { client, prompts } = clientReturning(GOOD);
    await generateValidatedOutfitsWithRetry(input, contextFor("dinner tonight"), { client });
    expect(prompts).toHaveLength(1);
  });
});

describe("5. older apps, weather freshness and target day", () => {
  const now = Date.UTC(2026, 10, 15, 18);

  it("accepts a request with no weather and no date", () => {
    const input = normalizeOutfitGenerationInput({ query: "casual outfit" });
    expect(input.weatherContext).toBeUndefined();
    expect(input.localDate).toBeUndefined();
    expect(input.targetDay).toEqual({ kind: "today" });
    expect(input.weatherIgnoredReason).toBeUndefined();
    const prompt = JSON.parse(buildOutfitGenerationUserPrompt(input, contextFor("casual outfit")));
    expect(prompt.weatherNow).toBeNull();
    expect(prompt.today).toBeNull();
    expect(prompt.wearingOn).toBeNull();
  });

  it("runs the whole agent for an older app payload", async () => {
    const response = await handleRunAuraStylingAgent("uid", { query: "casual outfit for today", mode: "generate_outfit" }, {
      runner: "sequential",
      retrieveStyleMemory: async () => null,
      loadUserPreferences: async () => null,
      retrieveOutfitContext: async () => contextFor("casual outfit for today"),
      generateOutfits: async ({ input }) => {
        expect(input.weatherContext).toBeUndefined();
        expect(input.localDate).toBeUndefined();
        return { outfits: [], validationErrors: [], validationWarnings: [], repaired: false };
      },
    } as never);
    expect(response.mode).toBe("generate_outfit");
    expect(typeof response.message).toBe("string");
  });

  it("works out which day the request is for", () => {
    expect(resolveOutfitTargetDay("what should I wear today", "2026-11-15")).toEqual({ kind: "today", date: "2026-11-15" });
    expect(resolveOutfitTargetDay("outfit for tomorrow's interview", "2026-11-30")).toEqual({ kind: "tomorrow", date: "2026-12-01" });
    expect(resolveOutfitTargetDay("pack for my beach trip", "2026-11-15")).toEqual({ kind: "other" });
    expect(resolveOutfitTargetDay("something for Friday", "2026-11-15")).toEqual({ kind: "other" });
    expect(resolveOutfitTargetDay("dinner tonight", undefined)).toEqual({ kind: "today" });
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("uses today's weather for today and ignores it for tomorrow or another day", () => {
    const weather = normalizeOutfitWeatherContext({ tempF: 30, condition: "Snow", forDate: "2026-11-15", observedAtMs: now - 60_000 });
    expect(resolveOutfitWeather({ userText: "outfit for today", localDate: "2026-11-15", weatherContext: weather, now }).weatherContext)
      .toEqual(weather);
    expect(resolveOutfitWeather({ userText: "outfit for tomorrow", localDate: "2026-11-15", weatherContext: weather, now }))
      .toMatchObject({ ignoredReason: "wrong_date", targetDay: { kind: "tomorrow", date: "2026-11-16" } });
    expect(resolveOutfitWeather({ userText: "pack for my trip next week", localDate: "2026-11-15", weatherContext: weather, now }).ignoredReason)
      .toBe("other_day");
    // Weather with no date stamp is today's: it must not be used for tomorrow.
    const undated = normalizeOutfitWeatherContext({ tempF: 30 });
    expect(resolveOutfitWeather({ userText: "tomorrow", localDate: "2026-11-15", weatherContext: undated, now }).weatherContext)
      .toBeUndefined();
    expect(resolveOutfitWeather({ userText: "today", localDate: "2026-11-15", weatherContext: undated, now }).weatherContext)
      .toEqual(undated);
  });

  it("uses tomorrow's forecast for a tomorrow request", () => {
    const forecast = normalizeOutfitWeatherContext({ highF: 40, lowF: 28, forDate: "2026-11-16", observedAtMs: Date.now() - 60_000 });
    const input = normalizeOutfitGenerationInput({
      query: "what should I wear tomorrow",
      localDate: "2026-11-15",
      weatherContext: forecast,
    });
    expect(input.weatherContext?.forDate).toBe("2026-11-16");
    const prompt = JSON.parse(buildOutfitGenerationUserPrompt(input, contextFor("what should I wear tomorrow")));
    expect(prompt.wearingOn).toMatchObject({ when: "tomorrow", weekday: "Monday", date: "2026-11-16" });
    expect(prompt.weatherNow).toMatch(/high 40°F/);
  });

  it("ignores stale weather and a date stamp on its own", () => {
    const old = normalizeOutfitWeatherContext({ tempF: 80, forDate: "2026-11-15", observedAtMs: now - 5 * 60 * 60 * 1000 });
    expect(resolveOutfitWeather({ userText: "today", localDate: "2026-11-15", weatherContext: old, now }).ignoredReason).toBe("stale");
    const future = normalizeOutfitWeatherContext({ tempF: 80, observedAtMs: now + 60 * 60 * 1000 });
    expect(resolveOutfitWeather({ userText: "today", localDate: "2026-11-15", weatherContext: future, now }).ignoredReason).toBe("stale");
    expect(normalizeOutfitWeatherContext({ forDate: "2026-11-15", observedAtMs: now })).toBeUndefined();
  });

  it("does not let chat context change the day or name items", () => {
    const input = normalizeOutfitGenerationInput({
      query: "different shoes. Recent chat/card context: user: outfit for tomorrow | assistant: White Sneakers",
      userText: "different shoes",
      localDate: "2026-11-15",
    });
    expect(input.targetDay.kind).toBe("today");
    expect(input.userText).toBe("different shoes");
  });
});
