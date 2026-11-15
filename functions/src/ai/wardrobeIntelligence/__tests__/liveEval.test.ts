import type { OutfitOpenAIClient } from "../outfitGeneration";
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
import { LIVE_EVAL_CASES, LIVE_EVAL_CLOSET } from "../evals/liveEvalCases";

function caseById(id: string) {
  const found = LIVE_EVAL_CASES.find((entry) => entry.id === id);
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
