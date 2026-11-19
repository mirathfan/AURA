import { HttpsError } from "firebase-functions/v2/https";
import {
  createAuraStylingAgentLangGraph,
  runAuraStylingAgentGraph,
} from "../agentGraph";
import type { AuraAgentDeps } from "../agentNodes";
import type {
  OutfitCandidate,
  OutfitCandidateBuckets,
  OutfitGenerationContext,
  OutfitRole,
  ValidatedOutfit,
} from "../outfitTypes";
import type { StyleMemoryContextResponse, StyleProfile } from "../styleMemoryTypes";

function candidate(itemId: string, role: OutfitRole, name: string): OutfitCandidate {
  return {
    itemId,
    name,
    role,
    canonicalRole: role,
    allowedRole: role,
    sourceRole: role,
    sourceCategory: role,
    sourceAiMetadataCategory: role,
    category: role === "footwear" ? "footwear" : role,
    colors: ["black"],
    score: 0.9,
    vectorScore: 0.9,
    finalScore: 0.9,
    reason: "test candidate",
    imageUrl: null,
    aiMetadata: { category: role, styleTags: ["minimal"], occasionTags: ["office"] },
    embeddingTextPreview: null,
    status: "AVAILABLE",
  };
}

function context(): OutfitGenerationContext {
  const candidates: OutfitCandidateBuckets = {
    top: [candidate("shirt", "top", "White shirt")],
    bottom: [candidate("pants", "bottom", "Black trousers")],
    footwear: [candidate("loafers", "footwear", "Black loafers")],
    outerwear: [],
    accessory: [],
    one_piece: [],
  };
  return {
    retrievalPlan: {
      intent: {
        occasion: "office",
        formality: "smart_casual",
        styleHints: ["polished"],
        colorHints: ["black"],
        categorySpecificConstraints: { footwear: ["black"] },
      },
      categoryQueries: {
        top: "office top",
        bottom: "office bottom",
        footwear: "office black footwear",
        outerwear: "office outerwear",
        accessory: "office accessory",
        one_piece: "office one piece",
      },
    },
    candidates,
    diagnostics: {
      candidateLimitPerCategory: 8,
      rawLimitPerCategory: 24,
      missingRequiredRoles: [],
      candidateCounts: {
        top: 1,
        bottom: 1,
        footwear: 1,
        outerwear: 0,
        accessory: 0,
        one_piece: 0,
      },
      categoryQueries: {
        top: "office top",
        bottom: "office bottom",
        footwear: "office black footwear",
        outerwear: "office outerwear",
        accessory: "office accessory",
        one_piece: "office one piece",
      },
    },
  };
}

function outfit(): ValidatedOutfit {
  return {
    outfitId: "outfit-1",
    title: "Clean Office Fit",
    vibe: "polished",
    occasion: "office",
    formality: "smart_casual",
    items: [
      {
        itemId: "shirt",
        role: "top",
        reason: "clean top",
        name: "White shirt",
        category: "top",
        colors: ["white"],
        imageUrl: null,
        aiMetadata: { category: "top" },
      },
      {
        itemId: "loafers",
        role: "footwear",
        reason: "black shoes",
        name: "Black loafers",
        category: "footwear",
        colors: ["black"],
        imageUrl: null,
        aiMetadata: { category: "footwear" },
      },
    ],
    explanation: "A clean office outfit.",
    stylingTips: ["Tuck the shirt"],
    missingItems: [],
    confidence: 0.91,
    scoreBreakdown: {
      categoryCompleteness: 1,
      occasionFit: 1,
      colorCoherence: 1,
      colorCoherenceReasons: [],
      formalityFit: 1,
      targetFormality: 3,
      targetFormalityRange: [2, 4],
      formalityFitReason: "matches",
      formalityBiasApplied: 0,
      formalityBiasReason: "none",
      itemEffectiveFormalities: [],
      retrievalStrength: 1,
      stylePreferenceFit: 1,
      styleMemoryReasons: [],
      memoryBoosts: [],
      memoryPenalties: [],
      diversityScore: 1,
      diversityPenalties: [],
      penalties: [],
      total: 1,
    },
  };
}

function profile(): StyleProfile {
  return {
    userId: "uid",
    summary: "Prefers polished outfits.",
    preferredColors: [],
    avoidedColors: [],
    preferredStyleTags: [],
    avoidedStyleTags: [],
    preferredFits: [],
    avoidedFits: [],
    preferredBrands: [],
    avoidedBrands: [],
    preferredCategories: [],
    avoidedCategories: [],
    preferredMaterials: [],
    avoidedMaterials: [],
    itemAffinities: [],
    avoidedItemIds: [],
    avoidedOutfitFingerprints: [],
    occasionProfiles: {},
    formalityBiasByOccasion: {},
    memoryCount: 0,
    positiveMemoryCount: 0,
    negativeMemoryCount: 0,
    profileVersion: 1,
  };
}

function styleMemory(): StyleMemoryContextResponse {
  return {
    query: "office outfit",
    memoryQueryText: "office outfit",
    positiveMemories: [],
    negativeMemories: [],
    profileSummary: "Prefers polished outfits.",
    profileSignals: profile(),
  };
}

function deps(overrides: Partial<AuraAgentDeps> = {}) {
  const calls: string[] = [];
  const base: AuraAgentDeps = {
    retrieveStyleMemory: async () => {
      calls.push("memory");
      return styleMemory();
    },
    retrieveOutfitContext: async () => {
      calls.push("context");
      return context();
    },
    generateOutfits: async ({ input }) => {
      calls.push(`generate:${input.query}`);
      return {
        outfits: [outfit()],
        validationErrors: [],
        validationWarnings: [],
        repaired: false,
      };
    },
    recordFeedback: async () => {
      calls.push("feedback");
      return { written: 1 };
    },
    ...overrides,
  };
  return { calls, deps: base };
}

describe("runAuraStylingAgentGraph", () => {
  const originalUseLangGraph = process.env.AURA_AGENT_USE_LANGGRAPH;

  afterEach(() => {
    if (originalUseLangGraph === undefined) {
      delete process.env.AURA_AGENT_USE_LANGGRAPH;
    } else {
      process.env.AURA_AGENT_USE_LANGGRAPH = originalUseLangGraph;
    }
  });

  it("compiles the LangGraph graph", () => {
    const graph = createAuraStylingAgentLangGraph(deps().deps);

    expect(graph).toBeDefined();
  });

  it("runs the generate path through memory, context, generation, and response nodes", async () => {
    const harness = deps();
    const response = await runAuraStylingAgentGraph("uid", {
      query: "office outfit with black shoes",
      includeDiagnostics: true,
    }, harness.deps);

    expect(response.mode).toBe("generate_outfit");
    expect(response.outfits).toHaveLength(1);
    expect(harness.calls).toEqual(expect.arrayContaining(["memory", "context"]));
    expect(harness.calls.some((call) => call.startsWith("generate:office outfit with black shoes"))).toBe(true);
    expect(response.diagnostics?.steps).toEqual([
      "classify_intent",
      "retrieve_style_memory",
      "retrieve_outfit_context",
      "generate_outfits",
      "build_agent_response",
    ]);
    expect(response.diagnostics?.nodesExecuted).toEqual(response.diagnostics?.steps);
    expect(response.diagnostics?.runner).toBe("langgraph");
    expect(response.diagnostics?.langGraphEnabled).toBe(true);
    expect(response.diagnostics?.graphVersion).toBe("phase-5-langgraph-v1");
  });

  it("skips style memory retrieval when disabled", async () => {
    const harness = deps();
    const response = await runAuraStylingAgentGraph("uid", {
      query: "office outfit",
      useStyleMemory: false,
      includeDiagnostics: true,
    }, harness.deps);

    expect(response.mode).toBe("generate_outfit");
    expect(harness.calls).not.toContain("memory");
    expect(harness.calls).toContain("context");
  });

  it("continues without memory when the style memory vector index is missing", async () => {
    const harness = deps({
      retrieveStyleMemory: async () => {
        throw new HttpsError("failed-precondition", "style memory vector index is not ready");
      },
    });
    const response = await runAuraStylingAgentGraph("uid", {
      query: "office outfit",
      includeDiagnostics: true,
    }, harness.deps);

    expect(response.outfits).toHaveLength(1);
    expect(response.diagnostics?.warnings.join(" ")).toContain("Style memory unavailable");
  });

  it("fails when wardrobe retrieval fails", async () => {
    const harness = deps({
      retrieveOutfitContext: async () => {
        throw new HttpsError("internal", "wardrobe retrieval failed");
      },
    });

    await expect(runAuraStylingAgentGraph("uid", {
      query: "office outfit",
    }, harness.deps)).rejects.toThrow("wardrobe retrieval failed");
  });

  it("explains a previous outfit without retrieval or generation", async () => {
    const harness = deps();
    const response = await runAuraStylingAgentGraph("uid", {
      mode: "explain_outfit",
      query: "why does this work?",
      previousOutfit: outfit() as unknown as Record<string, unknown>,
      includeDiagnostics: true,
    }, harness.deps);

    expect(response.mode).toBe("explain_outfit");
    expect(response.explanation?.itemRationales).toHaveLength(2);
    expect(harness.calls).toEqual([]);
    expect(response.diagnostics?.steps).toEqual(["classify_intent", "build_explanation_response"]);
  });

  it("adds refinement instructions to the generated outfit query", async () => {
    const harness = deps();
    const response = await runAuraStylingAgentGraph("uid", {
      mode: "refine_outfit",
      query: "make it less formal",
      previousOutfit: outfit() as unknown as Record<string, unknown>,
      includeDiagnostics: true,
    }, harness.deps);

    expect(harness.calls.some((call) => call.includes("Refinement request: make it less formal"))).toBe(true);
    expect(response.diagnostics?.steps).toEqual([
      "classify_intent",
      "resolve_refinement_context",
      "retrieve_style_memory",
      "retrieve_outfit_context",
      "generate_outfits",
      "build_agent_response",
    ]);
  });

  it("passes selected item IDs as required hard anchors into generation", async () => {
    const seenRequiredIds: string[][] = [];
    const harness = deps({
      generateOutfits: async ({ input }) => {
        seenRequiredIds.push(input.requiredItemIds);
        return {
          outfits: [outfit()],
          validationErrors: [],
          validationWarnings: [],
          repaired: false,
        };
      },
    });

    await runAuraStylingAgentGraph("uid", {
      mode: "generate_outfit",
      query: "use my black cargos",
      selectedItemIds: ["pants"],
    }, harness.deps);

    expect(seenRequiredIds[0]).toEqual(["pants"]);
  });

  it("explains both unavailable shoes and warmth without producing a replacement card", async () => {
    const harness = deps({retrieveOutfitContext: async () => context()});
    const response = await runAuraStylingAgentGraph("uid", {
      query: "Keep the trousers, swap the shoes, and make it work for a cold walk.",
      previousOutfit: {occasion: "dinner", items: [{itemId: "loafers", role: "footwear"}]},
      useStyleMemory: false,
    }, harness.deps);
    expect(response.message).toMatch(/another eligible pair of shoes/);
    expect(response.message).toMatch(/warm layer/);
    expect(response.outfits?.length ?? 0).toBe(0);
  });

  it("switches a new office brief without carrying the dinner walk into tomorrow", async () => {
    const harness = deps({generateOutfits: async ({input}) => {
      expect(input.query).toBe("Actually, tomorrow I need something for the office.");
      expect(input.occasion).toBe("office");
      expect(input.weather).toBeUndefined();
      return {outfits: [outfit()], validationErrors: [], validationWarnings: [], repaired: false};
    }});
    await runAuraStylingAgentGraph("uid", {
      mode: "refine_outfit", query: "Actually, tomorrow I need something for the office.",
      previousOutfit: {occasion: "dinner", items: []},
      conversationContext: {recentTurns: [{role: "user", text: "make it work for a cold walk"}],
        priorOutfitRefs: [], selectedItemIds: [], feedbackSignals: []},
    }, harness.deps);
  });

  it("returns a graceful no-outfit response when selected item anchors are unavailable", async () => {
    const harness = deps({
      retrieveOutfitContext: async () => {
        throw new HttpsError(
          "failed-precondition",
          "I can't use one of those selected closet items.",
          {
            requiredItemIds: ["Black-Cargos_01"],
            missingRequiredItemIds: ["Black-Cargos_01"],
            failedRequiredItemIds: ["Black-Cargos_01"],
          },
        );
      },
    });

    const response = await runAuraStylingAgentGraph("uid", {
      mode: "generate_outfit",
      query: "style these pants",
      selectedItemIds: ["Black-Cargos_01"],
      includeDiagnostics: true,
    }, harness.deps);

    expect(response.outfits).toBeUndefined();
    expect(response.message).toContain("can't use one of those selected closet items");
    expect(response.intent.constraints.selectedItemIds).toEqual(["Black-Cargos_01"]);
    expect(response.diagnostics?.errors.join(" ")).toContain("selected closet items");
  });

  it("includes selected outfit/card context in follow-up generation queries", async () => {
    const generatedQueries: string[] = [];
    const harness = deps({
      generateOutfits: async ({ input }) => {
        generatedQueries.push(input.query);
        return {
          outfits: [outfit()],
          validationErrors: [],
          validationWarnings: [],
          repaired: false,
        };
      },
    });

    await runAuraStylingAgentGraph("uid", {
      mode: "refine_outfit",
      query: "make outfit 2 more casual",
      previousOutfit: outfit() as unknown as Record<string, unknown>,
      conversationContext: {
        selectedOutfitId: "outfit-2",
        selectedItemIds: [],
        feedbackSignals: ["negative feedback: too formal"],
        recentTurns: [
          { role: "user", text: "Give me 3 outfits for a date" },
          { role: "assistant", text: "Rendered outfit-card context for follow-ups." },
        ],
        priorOutfitRefs: [
          { outfitId: "outfit-2", index: 2, title: "Older version", itemIds: ["stale-trousers"] },
          { outfitId: "outfit-1", index: 1, title: "First", itemIds: ["shirt"] },
          { outfitId: "outfit-2", index: 2, title: "Second", occasion: "dinner", formality: "smart_casual", itemIds: ["pants", "loafers"] },
        ],
      },
    }, harness.deps);

    expect(generatedQueries[0]).toContain("make outfit 2 more casual");
    expect(generatedQueries[0]).toContain("Selected outfit: outfit 2; Second");
    expect(generatedQueries[0]).toContain("outfit 2");
    expect(generatedQueries[0]).toContain("negative feedback: too formal");
  });

  it("records feedback through the style memory path", async () => {
    const harness = deps();
    const response = await runAuraStylingAgentGraph("uid", {
      mode: "feedback",
      query: "not my vibe",
      feedbackType: "not_my_vibe",
      previousOutfit: outfit() as unknown as Record<string, unknown>,
      includeDiagnostics: true,
    }, harness.deps);

    expect(harness.calls).toEqual(["feedback"]);
    expect(response.feedback?.recorded).toBe(true);
    expect(response.diagnostics?.steps).toEqual([
      "classify_intent",
      "record_feedback",
      "build_feedback_response",
    ]);
  });

  it("keeps the LangGraph path under the max step budget", async () => {
    const harness = deps();
    const response = await runAuraStylingAgentGraph("uid", {
      query: "streetwear outfit",
      includeDiagnostics: true,
    }, harness.deps);

    expect(response.diagnostics?.steps.length).toBeLessThanOrEqual(10);
    expect(response.diagnostics?.runner).toBe("langgraph");
    expect(response.diagnostics?.nodeTimings.length).toBe(response.diagnostics?.steps.length);
  });

  it("uses the internal runner when AURA_AGENT_USE_LANGGRAPH=false", async () => {
    process.env.AURA_AGENT_USE_LANGGRAPH = "false";
    const harness = deps();
    const response = await runAuraStylingAgentGraph("uid", {
      query: "office outfit",
      includeDiagnostics: true,
    }, harness.deps);

    expect(response.diagnostics?.runner).toBe("controlled-internal-graph");
    expect(response.diagnostics?.langGraphEnabled).toBe(false);
    expect(response.diagnostics?.graphVersion).toBe("phase-5-internal-v1");
  });

  it("routes unknown requests to fallback_response", async () => {
    const harness = deps();
    const response = await runAuraStylingAgentGraph("uid", {
      query: "hello there",
      includeDiagnostics: true,
    }, harness.deps);

    expect(response.mode).toBe("unknown");
    expect(response.diagnostics?.steps).toEqual(["classify_intent", "fallback_response"]);
    expect(harness.calls).toEqual([]);
  });

  it("passes weather, date and stated preferences into generation and returns the stylist reply", async () => {
    let seenInput: Record<string, unknown> | undefined;
    let seenPreferences: unknown;
    const harness = deps({
      loadUserPreferences: async () => ({ preferredFit: "relaxed", avoidedColors: ["orange"] }),
      generateOutfits: async ({ input, context: generationContext }) => {
        seenInput = input as unknown as Record<string, unknown>;
        seenPreferences = generationContext.userPreferences;
        return {
          outfits: [outfit()],
          validationErrors: [],
          validationWarnings: [],
          repaired: false,
          stylistMessage: "White oxford with black trousers. Sharp without trying.",
        };
      },
    });
    const response = await runAuraStylingAgentGraph("uid", {
      query: "office outfit with black shoes",
      weatherContext: { tempF: 38, condition: "Clear" },
      localDate: "2026-11-14",
    }, harness.deps);

    expect(seenInput?.weatherContext).toEqual({ tempF: 38, condition: "Clear" });
    expect(seenInput?.localDate).toBe("2026-11-14");
    expect(seenPreferences).toEqual({ preferredFit: "relaxed", avoidedColors: ["orange"] });
    expect(response.message).toBe("White oxford with black trousers. Sharp without trying.");
    expect(response.messageSource).toBe("stylist");
  });

  it("falls back to the template reply and still generates when preferences fail to load", async () => {
    const harness = deps({
      loadUserPreferences: async () => {
        throw new Error("profile unavailable");
      },
    });
    const response = await runAuraStylingAgentGraph("uid", { query: "office outfit with black shoes" }, harness.deps);
    expect(response.outfits).toHaveLength(1);
    expect(response.messageSource).toBe("template");
    expect(response.message).toMatch(/closet-based option/);
  });
});
