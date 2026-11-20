import { generateValidatedOutfitsFromContext, type OutfitOpenAIClient } from "../outfitGeneration";
import {
  blindOrderFor,
  buildLiveEvalContext,
  buildLiveEvalInput,
  buildLiveEvalJudgeRequest,
  estimateLiveEvalCalls,
  parseLiveEvalJudgement,
  renderLiveEvalBlindSheet,
  renderLiveEvalMarkdown,
  runLiveEval,
  scoreLiveEvalHardChecks,
  selectLiveEvalCases,
} from "../evals/liveEval";
import { HELD_OUT_LIVE_EVAL_CASES, LIVE_EVAL_CASES, LIVE_EVAL_CLOSET } from "../evals/liveEvalCases";
import { laundryNoticeText } from "../agentResponse";

function caseById(id: string) {
  const found = [...LIVE_EVAL_CASES, ...HELD_OUT_LIVE_EVAL_CASES].find((entry) => entry.id === id);
  if (!found) throw new Error(`missing case ${id}`);
  return found;
}

const ROLE_BY_ID = new Map(LIVE_EVAL_CLOSET.map((entry) => [entry.id, entry.role]));

function outfitPayload(itemIds: string[], stylistMessage = "A clean, warm look for tonight.") {
  return JSON.stringify({
    stylistMessage,
    outfits: [{
      title: "Eval Look",
      vibe: "clean",
      occasion: "outfit",
      formality: "smart_casual",
      items: itemIds.map((itemId) => ({ itemId, role: ROLE_BY_ID.get(itemId), reason: "fits" })),
      explanation: "Works together.",
      stylingTips: [],
      missingItems: [],
      confidence: 0.8,
    }],
  });
}

// The mock tells the arms apart the same way a real model would: by whether
// the prompt carries live weather.
function mockGenerationClient(byArm: { baseline: string[]; full: string[] }) {
  const prompts: Record<string, unknown>[] = [];
  const client: OutfitOpenAIClient = {
    responses: {
      create: async (args) => {
        const input = args.input as { content: unknown }[];
        const userContent = input[1].content as { text: string }[];
        const prompt = JSON.parse(userContent[0].text) as Record<string, unknown>;
        prompts.push(prompt);
        return { output_text: outfitPayload(prompt.weatherNow ? byArm.full : byArm.baseline) };
      },
    },
  };
  return { client, prompts };
}

describe("live eval cases", () => {
  it("only reference items that exist in the synthetic closet", () => {
    const ids = new Set(LIVE_EVAL_CLOSET.map((entry) => entry.id));
    expect(ids.size).toBe(LIVE_EVAL_CLOSET.length);
    for (const evalCase of LIVE_EVAL_CASES) {
      const referenced = [
        ...(evalCase.laundryItemIds ?? []),
        ...(evalCase.needsWashItemIds ?? []),
        ...Object.keys(evalCase.wornDaysAgo ?? {}),
      ];
      expect(referenced.filter((id) => !ids.has(id))).toEqual([]);
    }
    expect(new Set(LIVE_EVAL_CASES.map((entry) => entry.id)).size).toBe(LIVE_EVAL_CASES.length);
  });

  it("rejects unknown case ids", () => {
    expect(selectLiveEvalCases(["mild-day-no-pressure"])).toHaveLength(1);
    expect(() => selectLiveEvalCases(["nope"])).toThrow(/Unknown live eval case/);
  });
});

describe("live eval arms", () => {
  const evalCase = caseById("laundry-plus-cold");

  it("gives the full arm the context and removes laundry items", () => {
    const input = buildLiveEvalInput(evalCase, "full");
    const context = buildLiveEvalContext(evalCase, "full");
    const ids = Object.values(context.candidates).flat().map((entry) => entry.itemId);
    expect(input.weatherContext).toEqual({ tempF: 34, condition: "Clear" });
    expect(input.localDate).toBe("2026-12-05");
    expect(context.userPreferences?.preferredFit).toBe("relaxed");
    expect(ids).not.toContain("live-camel-coat");
    expect(context.diagnostics.laundryExcludedCount).toBe(2);
    expect(context.candidates.top[0].aiMetadata.warmth).toBeDefined();
    expect(context.candidates.top[0].daysSinceWorn).toBe(20);
  });

  it("strips that context from the baseline arm", () => {
    const input = buildLiveEvalInput(evalCase, "baseline");
    const context = buildLiveEvalContext(evalCase, "baseline");
    const all = Object.values(context.candidates).flat();
    expect(input.weatherContext).toBeUndefined();
    expect(input.localDate).toBeUndefined();
    expect(context.userPreferences).toBeUndefined();
    expect(all.map((entry) => entry.itemId)).toContain("live-camel-coat");
    expect(all.every((entry) => entry.aiMetadata.warmth === undefined && entry.daysSinceWorn === undefined)).toBe(true);
  });
});

describe("live eval rotation filter", () => {
  const ids = (id: string, arm: "baseline" | "full") =>
    Object.values(buildLiveEvalContext(caseById(id), arm).candidates).flat().map((entry) => entry.itemId);

  it("removes recently worn and unwashed items from the full arm only", () => {
    const rotation = ids("recently-worn-rotation", "full");
    expect(rotation).not.toContain("live-white-sneakers");
    expect(rotation).not.toContain("live-white-tee");
    expect(rotation).not.toContain("live-dark-denim");
    expect(rotation).toContain("live-brown-boots");
    expect(ids("recently-worn-rotation", "baseline")).toContain("live-white-sneakers");
    expect(ids("needs-wash-prefers-clean", "full")).not.toContain("live-white-oxford");
    expect(buildLiveEvalContext(caseById("recently-worn-rotation"), "full").diagnostics.rotationExcludedCount).toBe(3);
  });
});

describe("live eval hard checks", () => {
  it("flags laundry, cold, heat, wet, colour and repeat violations", () => {
    expect(scoreLiveEvalHardChecks(caseById("laundry-plus-cold"), [
      "live-black-turtleneck", "live-dark-denim", "live-brown-boots", "live-camel-coat",
    ])).toMatchObject({ usedLaundryItem: true, underdressedForCold: false });

    expect(scoreLiveEvalHardChecks(caseById("cold-dinner-unstated-weather"), [
      "live-white-oxford", "live-black-trousers", "live-tan-suede-loafers",
    ])).toMatchObject({ underdressedForCold: true, violationCount: 1 });

    expect(scoreLiveEvalHardChecks(caseById("hot-day-errands"), [
      "live-cream-hoodie", "live-olive-shorts", "live-white-sneakers",
    ]).overdressedForHeat).toBe(true);

    expect(scoreLiveEvalHardChecks(caseById("rainy-commute-office"), [
      "live-white-oxford", "live-black-trousers", "live-tan-suede-loafers",
    ]).wetUnsafeFootwear).toBe(true);

    expect(scoreLiveEvalHardChecks(caseById("avoided-colour-orange"), [
      "live-orange-polo", "live-olive-shorts", "live-white-sneakers",
    ]).usedAvoidedColor).toBe(true);

    expect(scoreLiveEvalHardChecks(caseById("recently-worn-rotation"), [
      "live-white-tee", "live-black-cargos", "live-brown-boots",
    ]).repeatedRecentWear).toBe(true);

    // Fresh tee and jeans, but the sneakers were worn today.
    expect(scoreLiveEvalHardChecks(caseById("recently-worn-rotation"), [
      "live-black-tee", "live-black-cargos", "live-white-sneakers",
    ]).repeatedRecentWear).toBe(true);
  });

  it("flags unwashed items", () => {
    expect(scoreLiveEvalHardChecks(caseById("needs-wash-prefers-clean"), [
      "live-white-oxford", "live-black-trousers", "live-brown-boots",
    ])).toMatchObject({ usedUnwashedItem: true, violationCount: 1 });
    expect(scoreLiveEvalHardChecks(caseById("needs-wash-prefers-clean"), [
      "live-charcoal-knit", "live-black-trousers", "live-brown-boots",
    ]).violationCount).toBe(0);
  });

  it("passes a sensible outfit and judges typed weather over live weather", () => {
    expect(scoreLiveEvalHardChecks(caseById("cold-dinner-unstated-weather"), [
      "live-charcoal-knit", "live-dark-denim", "live-brown-boots", "live-camel-coat",
    ]).violationCount).toBe(0);
    // Freezing at home, but the user asked for a hot beach trip.
    expect(scoreLiveEvalHardChecks(caseById("typed-weather-overrides-live"), [
      "live-blue-linen-shirt", "live-stone-linen-trousers", "live-leather-sandals",
    ]).violationCount).toBe(0);
    expect(scoreLiveEvalHardChecks(caseById("typed-weather-overrides-live"), [
      "live-charcoal-knit", "live-dark-denim", "live-brown-boots", "live-black-puffer",
    ]).overdressedForHeat).toBe(true);
  });
});

describe("live eval blind judge", () => {
  it("orders arms reproducibly and uses both positions across cases", () => {
    expect(blindOrderFor("seed", "case-a")).toEqual(blindOrderFor("seed", "case-a"));
    const positions = new Set(LIVE_EVAL_CASES.map((entry) => blindOrderFor("aura-live-eval-v1", entry.id).A));
    expect(positions).toEqual(new Set(["full", "baseline"]));
  });

  it("maps the judge's A/B answer back to the right arm", () => {
    const order = { A: "baseline" as const, B: "full" as const };
    const judged = parseLiveEvalJudgement(JSON.stringify({
      scoresA: { occasion: 4, weather: 1, coherence: 4, personalFit: 3 },
      scoresB: { occasion: 4, weather: 5, coherence: 4, personalFit: 9 },
      winner: "B",
      reason: "B is dressed for the cold.",
    }), order);
    expect(judged.winner).toBe("full");
    expect(judged.scores.baseline.weather).toBe(1);
    expect(judged.scores.full).toEqual({ occasion: 4, weather: 5, coherence: 4, personalFit: 5 });
  });

  it("never tells the judge which outfit is which", () => {
    const evalCase = caseById("cold-dinner-unstated-weather");
    const arm = (name: "baseline" | "full", itemId: string) => ({
      arm: name,
      ok: true,
      durationMs: 1,
      repaired: false,
      outfit: { title: `${name} arm title`, explanation: "", items: [{ itemId, name: "A top", role: "top" }] },
    });
    const request = buildLiveEvalJudgeRequest(
      evalCase,
      { baseline: arm("baseline", "live-white-tee"), full: arm("full", "live-charcoal-knit") },
      { A: "full", B: "baseline" },
      "judge-model",
    );
    const text = JSON.stringify(request);
    expect(text).not.toMatch(/baseline|"full"|live-|arm title/);
    expect(text).toMatch(/freezing/);
  });
});

describe("runLiveEval", () => {
  it("runs both arms, scores them and reports the comparison", async () => {
    const generation = mockGenerationClient({
      baseline: ["live-white-oxford", "live-black-trousers", "live-tan-suede-loafers"],
      full: ["live-charcoal-knit", "live-dark-denim", "live-brown-boots", "live-camel-coat"],
    });
    const judgeCalls: unknown[] = [];
    const judgeClient: OutfitOpenAIClient = {
      responses: {
        create: async (args) => {
          judgeCalls.push(args);
          const order = blindOrderFor("test-seed", "cold-dinner-unstated-weather");
          return {
            output_text: JSON.stringify({
              scoresA: { occasion: 4, weather: 4, coherence: 4, personalFit: 4 },
              scoresB: { occasion: 4, weather: 4, coherence: 4, personalFit: 4 },
              winner: order.A === "full" ? "A" : "B",
              reason: "Warmer.",
            }),
          };
        },
      },
    };
    const report = await runLiveEval({
      generationClient: generation.client,
      judgeClient,
      judgeModel: "judge-model",
      caseIds: ["cold-dinner-unstated-weather"],
      seed: "test-seed",
      now: Date.UTC(2026, 10, 15),
    });

    expect(generation.prompts).toHaveLength(2);
    expect(judgeCalls).toHaveLength(1);
    expect(report.summary.casesWithViolations).toEqual({ baseline: 1, full: 0 });
    expect(report.summary.violations.baseline.underdressedForCold).toBe(1);
    expect(report.summary.judge).toMatchObject({ judgedCases: 1, fullWins: 1, baselineWins: 0, ties: 0 });
    expect(report.summary.stylistMessageRate).toBe(1);
    expect(report.cases[0].arms.full.stylistMessage).toBe("A clean, warm look for tonight.");

    const markdown = renderLiveEvalMarkdown(report);
    expect(markdown).toMatch(/underdressedForCold \| 1 \| 0/);
    const sheet = renderLiveEvalBlindSheet(report);
    expect(sheet).toMatch(/- A: /);
    expect(sheet).not.toMatch(/baseline|Full:/i);
  });

  it("records a generation failure without stopping the run or calling the judge", async () => {
    const judge = jest.fn();
    const report = await runLiveEval({
      generationClient: { responses: { create: async () => ({ output_text: "{\"outfits\":[]}" }) } },
      judgeClient: { responses: { create: judge } },
      caseIds: ["mild-day-no-pressure"],
    });
    expect(report.summary.generationFailures).toEqual({ baseline: 1, full: 1 });
    expect(report.cases[0].arms.full.ok).toBe(false);
    expect(judge).not.toHaveBeenCalled();
  });

  it("estimates the number of billed calls", () => {
    expect(estimateLiveEvalCalls(12, true)).toEqual({ minimum: 36, maximum: 60 });
    expect(estimateLiveEvalCalls(12, false)).toEqual({ minimum: 24, maximum: 48 });
  });
});

describe("held-out live eval cases", () => {
  const fullIds = (id: string) =>
    Object.values(buildLiveEvalContext(caseById(id), "full").candidates).flat().map((entry) => entry.itemId);

  it("are a separate set that only references real closet items", () => {
    const ids = new Set(LIVE_EVAL_CLOSET.map((entry) => entry.id));
    for (const evalCase of HELD_OUT_LIVE_EVAL_CASES) {
      expect(evalCase.heldOut).toBe(true);
      const referenced = [
        ...(evalCase.closetItemIds ?? []), ...(evalCase.laundryItemIds ?? []), ...(evalCase.needsWashItemIds ?? []),
        ...(evalCase.requiredItemIds ?? []), ...(evalCase.avoidItemIds ?? []),
        ...(evalCase.expectLaundryNoticeItemIds ?? []), ...Object.keys(evalCase.wornDaysAgo ?? {}),
      ];
      expect(referenced.filter((id) => !ids.has(id))).toEqual([]);
    }
    expect(selectLiveEvalCases()).toHaveLength(LIVE_EVAL_CASES.length);
    expect(selectLiveEvalCases(undefined, "heldout")).toHaveLength(HELD_OUT_LIVE_EVAL_CASES.length);
    expect(selectLiveEvalCases(undefined, "all")).toHaveLength(LIVE_EVAL_CASES.length + HELD_OUT_LIVE_EVAL_CASES.length);
    expect(selectLiveEvalCases(["heldout-missing-weather"])).toHaveLength(1);
  });

  it("small closet: keeps the only warm pieces even though they were just worn", () => {
    const ids = fullIds("heldout-small-closet-cold");
    expect(ids).toHaveLength(6);
    expect(ids).toEqual(expect.arrayContaining(["live-charcoal-knit", "live-brown-boots", "live-black-puffer"]));
    expect(fullIds("heldout-small-closet-all-worn")).toHaveLength(4);
  });

  it("named laundry items: left out and explained", () => {
    const coat = buildLiveEvalContext(caseById("heldout-named-laundry-coat"), "full");
    expect(fullIds("heldout-named-laundry-coat")).not.toContain("live-camel-coat");
    expect(laundryNoticeText(coat.diagnostics.laundryNotices)).toMatch(/Camel Wool Overcoat is in the laundry/);
    const jeans = buildLiveEvalContext(caseById("heldout-named-laundry-kind"), "full");
    expect(laundryNoticeText(jeans.diagnostics.laundryNotices)).toMatch(/Dark Indigo Straight Jeans is in the laundry/);
    // No notice when nothing asked for is in the laundry.
    expect(buildLiveEvalContext(caseById("laundry-plus-cold"), "full").diagnostics.laundryNotices).toBeUndefined();
  });

  it("outerwear reuse: worn-yesterday coats stay available and are not violations", () => {
    const ids = fullIds("heldout-outerwear-reuse");
    expect(ids).toEqual(expect.arrayContaining(["live-black-puffer", "live-camel-coat"]));
    expect(scoreLiveEvalHardChecks(caseById("heldout-outerwear-reuse"), [
      "live-charcoal-knit", "live-dark-denim", "live-brown-boots", "live-black-puffer",
    ]).violationCount).toBe(0);
    expect(scoreLiveEvalHardChecks(caseById("heldout-outerwear-reuse"), [
      "live-white-tee", "live-dark-denim", "live-white-sneakers", "live-olive-overshirt",
    ]).underdressedForCold).toBe(true);
  });

  it("changed occasion: weekend-only pieces fail an office request", () => {
    const evalCase = caseById("heldout-changed-occasion-office");
    expect(scoreLiveEvalHardChecks(evalCase, ["live-cream-hoodie", "live-black-cargos", "live-white-sneakers"]).wrongForOffice).toBe(true);
    expect(scoreLiveEvalHardChecks(evalCase, ["live-white-tee", "live-black-trousers", "live-brown-boots"]).wrongForOffice).toBe(true);
    expect(scoreLiveEvalHardChecks(evalCase, ["live-white-oxford", "live-black-trousers", "live-brown-boots"]).violationCount).toBe(0);
  });

  it("missing weather and tomorrow's forecast", () => {
    const missing = buildLiveEvalInput(caseById("heldout-missing-weather"), "full");
    expect(missing.weatherContext).toBeUndefined();
    expect(missing.localDate).toBeUndefined();
    const tomorrow = buildLiveEvalInput(caseById("heldout-tomorrow-forecast"), "full");
    expect(tomorrow.targetDay).toEqual({ kind: "tomorrow", date: "2026-02-10" });
    expect(tomorrow.weatherContext).toMatchObject({ highF: 30, forDate: "2026-02-10" });
  });

  it("shoe-only swap: kept pieces stay, replaced shoes go", () => {
    const evalCase = caseById("heldout-shoe-only-swap");
    for (const arm of ["baseline", "full"] as const) {
      const input = buildLiveEvalInput(evalCase, arm);
      expect(input.requiredItemIds).toEqual(["live-black-tee", "live-black-cargos"]);
      expect(input.avoidItemIds).toEqual(["live-white-sneakers"]);
    }
    expect(scoreLiveEvalHardChecks(evalCase, ["live-black-tee", "live-black-cargos", "live-brown-boots"]).violationCount).toBe(0);
    expect(scoreLiveEvalHardChecks(evalCase, ["live-black-tee", "live-black-cargos", "live-white-sneakers"]).usedReplacedItem).toBe(true);
    expect(scoreLiveEvalHardChecks(evalCase, ["live-white-tee", "live-black-cargos", "live-brown-boots"]).droppedKeptItem).toBe(true);
  });
});

describe("cold weather laundry substitutions and wear alternatives", () => {
  const coldLaundry = caseById("heldout-named-laundry-coat");
  const original = ["live-black-turtleneck", "live-black-trousers", "live-brown-boots", "live-steel-watch"];

  async function dinner(closetItemIds?: string[], extraSelected: string[] = []) {
    const scenario = { ...coldLaundry, closetItemIds };
    const context = buildLiveEvalContext(scenario, "full");
    const input = buildLiveEvalInput(scenario, "full");
    const staleText = "The camel wool overcoat adds the polished finish.";
    const draft = JSON.parse(outfitPayload([...original, ...extraSelected], staleText));
    draft.outfits[0].explanation = staleText;
    draft.outfits[0].title = "Camel wool overcoat dinner";
    const client = { responses: { create: async () => ({ output_text: JSON.stringify(draft) }) } };
    const result = await generateValidatedOutfitsFromContext(input, context, { client, repair: false });
    return { ...result, notice: laundryNoticeText(context.diagnostics.laundryNotices) };
  }

  it("replaces the unavailable coat in a cold dinner card and grounds the explanation and reply", async () => {
    const result = await dinner();
    const card = result.outfits[0];
    expect(card.items.map((item) => item.itemId)).toContain("live-black-puffer");
    expect(card.items.map((item) => item.itemId)).not.toContain("live-camel-coat");
    expect(result.stylistMessage).toContain("Black Down Puffer");
    expect(card.explanation).toContain("Black Down Puffer");
    expect(result.stylistMessage + card.explanation + card.title).not.toMatch(/camel wool overcoat/i);
    expect(result.notice).toMatch(/Camel Wool Overcoat is in the laundry/);
  });

  it("retains an already selected warm layer and mentions it once on the card", async () => {
    const result = await dinner(undefined, ["live-black-puffer"]);
    expect(result.outfits[0].items.filter((item) => item.itemId === "live-black-puffer")).toHaveLength(1);
    expect(result.stylistMessage).toContain("Black Down Puffer");
  });

  it("plainly discloses missing warmth when the remaining closet has no suitable layer", async () => {
    const result = await dinner([...original, "live-camel-coat", "live-brown-suede-jacket"]);
    expect(result.outfits[0].items.map((item) => item.itemId)).toEqual(original);
    expect(result.stylistMessage).toMatch(/no suitable warm|couldn.t find a (?:suitable )?warm/i);
    expect(result.outfits[0].explanation).toMatch(/no suitable warm|couldn.t find a (?:suitable )?warm/i);
    expect(result.notice).toMatch(/Camel Wool Overcoat is in the laundry/);
  });

  it("only penalizes a cold-weather repeat if a suitable fresh alternative exists", () => {
    const scenario = caseById("heldout-small-closet-cold");
    const chosen = ["live-charcoal-knit", "live-dark-denim", "live-brown-boots", "live-black-puffer"];
    expect(scoreLiveEvalHardChecks(scenario, chosen).repeatedRecentWear).toBe(false);
    const withFreshWarmTop = { ...scenario, closetItemIds: [...scenario.closetItemIds!, "live-cream-hoodie"] };
    expect(scoreLiveEvalHardChecks(withFreshWarmTop, chosen).repeatedRecentWear).toBe(true);
  });
});
