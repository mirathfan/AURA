import {
  classifyAuraStylingAgentIntent,
  extractRequestedOutfitCount,
  resolveRequestedOutfitCount,
} from "../agentIntent";

const previousOutfit = {
  outfitId: "outfit-1",
  title: "Test outfit",
  items: [
    { itemId: "shirt-1", role: "top", name: "White shirt" },
    { itemId: "shoe-1", role: "footwear", name: "Black loafers" },
  ],
};

describe("classifyAuraStylingAgentIntent", () => {
  it("routes an anchored use request to structured outfit generation", () => {
    const intent = classifyAuraStylingAgentIntent({
      query: "Use my black cargos", selectedItemIds: ["cargo-1"],
    });
    expect(intent.mode).toBe("generate_outfit");
    expect(intent.constraints.selectedItemIds).toEqual(["cargo-1"]);
  });

  it("routes anchored follow-ups to refinement while preserving explanation requests", () => {
    expect(classifyAuraStylingAgentIntent({
      query: "Use my black cargos", selectedItemIds: ["cargo-1"], previousOutfit,
    }).mode).toBe("refine_outfit");
    expect(classifyAuraStylingAgentIntent({
      query: "Why use my black cargos?", selectedItemIds: ["cargo-1"], previousOutfit,
    }).mode).toBe("explain_outfit");
  });

  it("does not treat arbitrary use requests as selected-item styling", () => {
    expect(classifyAuraStylingAgentIntent({ query: "Use my location" }).mode).toBe("unknown");
  });
  it("extracts requested outfit counts from query text", () => {
    expect(extractRequestedOutfitCount("give me 3 outfits for office")).toBe(3);
    expect(extractRequestedOutfitCount("give me 3 more")).toBe(3);
    expect(extractRequestedOutfitCount("give me a few more")).toBe(3);
    expect(extractRequestedOutfitCount("show me three looks")).toBe(3);
    expect(extractRequestedOutfitCount("give me two options")).toBe(2);
    expect(extractRequestedOutfitCount("style me today")).toBeUndefined();
  });

  it("resolves explicit count before inferred query count and caps to five", () => {
    expect(resolveRequestedOutfitCount({ query: "give me 3 outfits", count: 2 })).toBe(2);
    expect(resolveRequestedOutfitCount({ query: "give me 9 outfits" })).toBe(5);
  });

  it("classifies office black-shoe requests as generation with footwear constraints", () => {
    const intent = classifyAuraStylingAgentIntent({
      query: "office outfit with black shoes",
    });

    expect(intent.mode).toBe("generate_outfit");
    expect(intent.constraints.occasion).toBe("office");
    expect(intent.constraints.formality).toBe("smart_casual");
    expect(intent.constraints.requiredCategories).toContain("footwear");
    expect(intent.constraints.requiredColors).toContain("black");
  });

  it("classifies date night requests with elevated dinner context", () => {
    const intent = classifyAuraStylingAgentIntent({ query: "date night outfit" });

    expect(intent.mode).toBe("generate_outfit");
    expect(intent.constraints.occasion).toBe("dinner");
    expect(intent.constraints.formality).toBe("smart_casual");
    expect(intent.constraints.styleHints).toEqual(expect.arrayContaining(["elevated", "date night"]));
  });

  it("classifies counted date requests with dinner context", () => {
    const query = "Give me 3 outfits for a date";
    const intent = classifyAuraStylingAgentIntent({ query });

    expect(extractRequestedOutfitCount(query)).toBe(3);
    expect(resolveRequestedOutfitCount({ query })).toBe(3);
    expect(intent.mode).toBe("generate_outfit");
    expect(intent.constraints.occasion).toBe("dinner");
    expect(intent.constraints.formality).toBe("smart_casual");
    expect(intent.constraints.styleHints).toEqual(expect.arrayContaining(["elevated", "date night"]));
  });

  it("classifies summer casual requests with hot-weather context", () => {
    const intent = classifyAuraStylingAgentIntent({ query: "summer casual outfit" });

    expect(intent.mode).toBe("generate_outfit");
    expect(intent.constraints.occasion).toBe("vacation");
    expect(intent.constraints.weather).toBe("hot");
    expect(intent.constraints.formality).toBe("casual");
  });

  it("classifies streetwear requests with streetwear style hints", () => {
    const intent = classifyAuraStylingAgentIntent({ query: "streetwear outfit" });

    expect(intent.mode).toBe("generate_outfit");
    expect(intent.constraints.occasion).toBe("streetwear");
    expect(intent.constraints.styleHints).toContain("streetwear");
    expect(intent.constraints.formality).toBe("casual");
  });

  it("honors explicit modes over query heuristics", () => {
    const intent = classifyAuraStylingAgentIntent({
      mode: "explain_outfit",
      query: "office outfit",
    });

    expect(intent.mode).toBe("explain_outfit");
    expect(intent.reason).toBe("explicit mode");
  });

  it.each([
    "I like the second one. Keep the pants, swap the shoes, and make it work for a cold walk.",
    "For option two replace the footwear but retain the trousers for a chilly stroll.",
    "Option 2: don't change the trousers, switch the boots for a cold walk.",
  ])("keeps and replaces exact IDs from the referenced dinner card: %s", (query) => {
    const second = { occasion: "dinner date", items: [
      { itemId: "Twin_Pants-B", role: "bottom" },
      { itemId: "Boots-B", role: "footwear" },
    ] };
    const intent = classifyAuraStylingAgentIntent({ query, previousOutfit: second });
    expect(intent.mode).toBe("refine_outfit");
    expect(intent.constraints.selectedItemIds).toEqual(["Twin_Pants-B"]);
    expect(intent.constraints.avoidItemIds).toEqual(["Boots-B"]);
    expect(intent.constraints.occasion).toBe("dinner date");
    expect(intent.constraints.weather).toBe("cold");
    expect(intent.constraints.styleHints).not.toContain("professional");
    const office = classifyAuraStylingAgentIntent({
      query: "Actually, tomorrow I need something for the office.", previousOutfit: second,
    });
    expect(office.mode).toBe("generate_outfit");
    expect(office.constraints.occasion).toBe("office");
    expect(office.constraints.selectedItemIds).toEqual([]);
  });

  it("classifies less-formal followups as refinement", () => {
    const intent = classifyAuraStylingAgentIntent({
      query: "make it less formal",
      previousOutfit,
    });

    expect(intent.mode).toBe("refine_outfit");
    expect(intent.constraints.refinementInstruction).toBe("make it less formal");
  });

  it("avoids prior footwear when the refinement asks for different shoes", () => {
    const intent = classifyAuraStylingAgentIntent({
      query: "try different shoes",
      previousOutfit,
    });

    expect(intent.mode).toBe("refine_outfit");
    expect(intent.constraints.avoidItemIds).toEqual(["shoe-1"]);
  });

  it("avoids prior referenced footwear when the user says not to use those shoes", () => {
    const intent = classifyAuraStylingAgentIntent({
      query: "don't use those shoes",
      previousOutfit,
    });

    expect(intent.mode).toBe("refine_outfit");
    expect(intent.constraints.avoidItemIds).toEqual(["shoe-1"]);
  });

  it("extracts hard negative terms from no/don't-use requests", () => {
    const intent = classifyAuraStylingAgentIntent({
      query: "give me a date outfit but don't use sandals or hoodies",
    });

    expect(intent.constraints.avoidTerms).toEqual(expect.arrayContaining(["sandals", "hoodies"]));
  });

  it("preserves selected closet item IDs exactly", () => {
    const intent = classifyAuraStylingAgentIntent({
      query: "style these pants",
      selectedItemIds: ["Black-Cargos_01", "Black-Cargos_01"],
    });

    expect(intent.constraints.selectedItemIds).toEqual(["Black-Cargos_01"]);
  });

  it("treats more-like numbered outfit references as refinement follow-ups", () => {
    const intent = classifyAuraStylingAgentIntent({
      query: "more like outfit 2",
      conversationContext: {
        recentTurns: [],
        selectedItemIds: [],
        feedbackSignals: [],
        priorOutfitRefs: [
          { outfitId: "outfit-1", index: 1, itemIds: ["shirt-1"] },
          { outfitId: "outfit-2", index: 2, itemIds: ["shoe-1"] },
        ],
      },
    });

    expect(intent.mode).toBe("refine_outfit");
  });

  it("classifies explanation requests", () => {
    const intent = classifyAuraStylingAgentIntent({
      query: "why does this outfit work?",
      previousOutfit,
    });

    expect(intent.mode).toBe("explain_outfit");
  });

  it("classifies explicit feedback requests", () => {
    const intent = classifyAuraStylingAgentIntent({
      mode: "feedback",
      query: "not my vibe",
      feedbackType: "not_my_vibe",
      previousOutfit,
    });

    expect(intent.mode).toBe("feedback");
    expect(intent.constraints.feedbackType).toBe("not_my_vibe");
  });

  it("returns unknown for empty requests", () => {
    const intent = classifyAuraStylingAgentIntent({});

    expect(intent.mode).toBe("unknown");
    expect(intent.confidence).toBeLessThan(0.5);
  });
});
