import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { outfitGenerationConfig } from "../config";
import {
  buildOutfitRetrievalPlan,
  excludeLaundryCandidates,
  applyWearRotation,
  findLaundryNotices,
  normalizeOutfitGenerationInput,
} from "../outfitContext";
import {
  generateValidatedOutfitsFromContext,
  type OutfitOpenAIClient,
} from "../outfitGeneration";
import {
  isNotFreshForRole,
  isWornTooRecently,
  summarizeOutfitWeather,
  type OutfitWeatherBand,
} from "../outfitSignals";
import { laundryNoticeText } from "../agentResponse";
import {
  OUTFIT_ROLES,
  type NormalizedOutfitGenerationInput,
  type OutfitCandidate,
  type OutfitCandidateBuckets,
  type OutfitGenerationContext,
  type ValidatedOutfit,
} from "../outfitTypes";
import {
  HELD_OUT_LIVE_EVAL_CASES,
  LIVE_EVAL_CASES,
  LIVE_EVAL_CLOSET,
  type LiveEvalCase,
  type LiveEvalItem,
} from "./liveEvalCases";

// Live quality eval for outfit generation.
//
// Two arms run on the same synthetic closet and request:
//   "full"     - what production sends now: weather, date, stated preferences,
//                garment details, wear history, laundry items removed.
//   "baseline" - the same request with that context taken away, which is what
//                the model saw before. This is a context ablation, not a replay
//                of the old code, so it isolates the value of the context.
// Each arm is scored with deterministic hard checks, then a judge model
// compares the two outfits blind. The model clients are injected: this module
// never builds one and never reads user data.

export type LiveEvalArm = "baseline" | "full";

export type LiveEvalHardChecks = {
  usedLaundryItem: boolean;
  usedAvoidedColor: boolean;
  underdressedForCold: boolean;
  overdressedForHeat: boolean;
  wetUnsafeFootwear: boolean;
  repeatedRecentWear: boolean;
  usedUnwashedItem: boolean;
  droppedKeptItem: boolean;
  usedReplacedItem: boolean;
  wrongForOffice: boolean;
  violationCount: number;
};

export type LiveEvalArmResult = {
  arm: LiveEvalArm;
  ok: boolean;
  error?: string;
  durationMs: number;
  repaired: boolean;
  stylistMessage?: string;
  // The sentence the reply adds when a requested item is in the laundry.
  laundryNotice?: string;
  outfit?: {
    title: string;
    explanation: string;
    items: { itemId: string; name: string; role: string }[];
  };
  checks?: LiveEvalHardChecks;
};

export type LiveEvalJudgeScores = {
  occasion: number;
  weather: number;
  coherence: number;
  personalFit: number;
};

export type LiveEvalJudgeResult = {
  winner: LiveEvalArm | "tie";
  blindOrder: { A: LiveEvalArm; B: LiveEvalArm };
  scores: Record<LiveEvalArm, LiveEvalJudgeScores>;
  reason: string;
};

export type LiveEvalCaseResult = {
  caseId: string;
  query: string;
  notes: string;
  arms: Record<LiveEvalArm, LiveEvalArmResult>;
  judge?: LiveEvalJudgeResult;
  judgeError?: string;
};

export type LiveEvalSummary = {
  totalCases: number;
  generationFailures: Record<LiveEvalArm, number>;
  casesWithViolations: Record<LiveEvalArm, number>;
  violations: Record<LiveEvalArm, Omit<LiveEvalHardChecks, "violationCount"> extends infer T
    ? { [K in keyof T]: number }
    : never>;
  judge: {
    judgedCases: number;
    fullWins: number;
    baselineWins: number;
    ties: number;
    meanScores: Record<LiveEvalArm, LiveEvalJudgeScores>;
  };
  stylistMessageRate: number;
  medianDurationMs: Record<LiveEvalArm, number>;
};

export type LiveEvalReport = {
  timestamp: string;
  generationModel: string;
  judgeModel: string | null;
  seed: string;
  cases: LiveEvalCaseResult[];
  summary: LiveEvalSummary;
};

export type LiveEvalOptions = {
  generationClient: OutfitOpenAIClient;
  judgeClient?: OutfitOpenAIClient;
  generationModel?: string;
  judgeModel?: string;
  caseIds?: string[];
  caseSet?: LiveEvalCaseSet;
  seed?: string;
  now?: number;
  onProgress?: (message: string) => void;
};

const DEFAULT_WORN_DAYS_AGO = 20;
const WET_UNSAFE = /\b(sandal|sandals|suede|espadrille|canvas)\b/i;
const OFFICE_WRONG = /\b(hoodie|shorts|sandals|cargo pants)\b/i;
// Every "needs wash" piece in the eval has been worn this many times.
const EVAL_WEARS_SINCE_WASH = 2;
const VIOLATION_KEYS = [
  "usedLaundryItem",
  "usedAvoidedColor",
  "underdressedForCold",
  "overdressedForHeat",
  "wetUnsafeFootwear",
  "repeatedRecentWear",
  "usedUnwashedItem",
  "droppedKeptItem",
  "usedReplacedItem",
  "wrongForOffice",
] as const;

function closetById(): Map<string, LiveEvalItem> {
  return new Map(LIVE_EVAL_CLOSET.map((entry) => [entry.id, entry]));
}

function emptyBuckets(): OutfitCandidateBuckets {
  return { top: [], bottom: [], footwear: [], outerwear: [], accessory: [], one_piece: [] };
}

function caseCloset(evalCase: LiveEvalCase): LiveEvalItem[] {
  if (!evalCase.closetItemIds?.length) return LIVE_EVAL_CLOSET;
  const wanted = new Set(evalCase.closetItemIds);
  return LIVE_EVAL_CLOSET.filter((entry) => wanted.has(entry.id));
}

function laundryState(evalCase: LiveEvalCase, itemId: string): "clean" | "needs_wash" | "in_laundry" {
  if (evalCase.laundryItemIds?.includes(itemId)) return "in_laundry";
  if (evalCase.needsWashItemIds?.includes(itemId)) return "needs_wash";
  return "clean";
}

function candidateFor(evalCase: LiveEvalCase, entry: LiveEvalItem, arm: LiveEvalArm): OutfitCandidate {
  const state = laundryState(evalCase, entry.id);
  const base: OutfitCandidate = {
    itemId: entry.id,
    name: entry.name,
    category: entry.role,
    role: entry.role,
    canonicalRole: entry.role,
    allowedRole: entry.role,
    sourceRole: entry.role,
    sourceCategory: entry.role,
    sourceAiMetadataCategory: entry.role === "footwear" ? "shoes" : entry.role,
    subcategory: entry.subcategory,
    colors: entry.colors,
    // Every candidate gets the same retrieval score so the eval measures the
    // generation step, not retrieval ranking.
    score: 0.6,
    vectorScore: 0.6,
    finalScore: 0.6,
    reason: "synthetic live eval candidate",
    imageUrl: null,
    aiMetadata: {
      category: entry.role === "footwear" ? "shoes" : entry.role,
      subcategory: entry.subcategory,
      colors: entry.colors,
      formality: entry.formality,
      styleTags: entry.styleTags,
      occasionTags: entry.occasionTags,
    },
    embeddingTextPreview: null,
    status: state === "in_laundry" ? "IN_LAUNDRY" : state === "needs_wash" ? "WORN" : "AVAILABLE",
  };
  if (arm === "baseline") return base;
  return {
    ...base,
    aiMetadata: {
      ...base.aiMetadata,
      fit: entry.fit,
      material: entry.material,
      warmth: entry.warmth,
      seasonTags: entry.seasonTags,
      weatherTags: entry.weatherTags,
    },
    pattern: entry.pattern,
    laundryState: state,
    daysSinceWorn: evalCase.wornDaysAgo?.[entry.id] ?? DEFAULT_WORN_DAYS_AGO,
    wearCountSinceWash: state === "needs_wash" ? EVAL_WEARS_SINCE_WASH : 0,
  };
}

export function buildLiveEvalInput(evalCase: LiveEvalCase, arm: LiveEvalArm): NormalizedOutfitGenerationInput {
  return normalizeOutfitGenerationInput({
    query: evalCase.query,
    count: 1,
    useStyleMemory: false,
    // What the user selected or asked to replace is part of the request, so
    // both arms get it.
    requiredItemIds: evalCase.requiredItemIds,
    avoidItemIds: evalCase.avoidItemIds,
    ...(arm === "full"
      ? { weatherContext: evalCase.weatherContext, localDate: evalCase.localDate }
      : {}),
  });
}

export function buildLiveEvalContext(evalCase: LiveEvalCase, arm: LiveEvalArm): OutfitGenerationContext {
  const input = buildLiveEvalInput(evalCase, arm);
  let candidates = emptyBuckets();
  const closet = caseCloset(evalCase);
  for (const entry of closet) {
    candidates[entry.role].push(candidateFor(evalCase, entry, arm));
  }
  let laundryExcludedCount = 0;
  let rotationExcludedCount = 0;
  let laundryNotices: ReturnType<typeof findLaundryNotices> | undefined;
  if (arm === "full") {
    const inLaundry = closet.filter((entry) => laundryState(evalCase, entry.id) === "in_laundry");
    laundryNotices = findLaundryNotices({
      userText: input.userText,
      requiredItemIds: input.requiredItemIds,
      laundryItems: inLaundry.map((entry) => ({ itemId: entry.id, name: entry.name, subcategory: entry.subcategory })),
      availableSubcategories: closet
        .filter((entry) => laundryState(evalCase, entry.id) !== "in_laundry")
        .map((entry) => entry.subcategory),
    });
    const filtered = excludeLaundryCandidates(candidates, input.requiredItemIds);
    candidates = filtered.buckets;
    laundryExcludedCount = filtered.excludedCount;
    const rotated = applyWearRotation(candidates, { userText: input.userText, keepItemIds: input.requiredItemIds });
    candidates = rotated.buckets;
    rotationExcludedCount = rotated.excludedCount;
  }
  const plan = buildOutfitRetrievalPlan(input);
  return {
    retrievalPlan: plan,
    candidates,
    ...(arm === "full" && evalCase.userPreferences ? { userPreferences: evalCase.userPreferences } : {}),
    diagnostics: {
      ...(laundryExcludedCount ? { laundryExcludedCount } : {}),
      ...(rotationExcludedCount ? { rotationExcludedCount } : {}),
      ...(laundryNotices && (laundryNotices.namedInLaundry.length || laundryNotices.selectedInLaundry.length)
        ? { laundryNotices }
        : {}),
      candidateLimitPerCategory: LIVE_EVAL_CLOSET.length,
      rawLimitPerCategory: LIVE_EVAL_CLOSET.length,
      missingRequiredRoles: [],
      candidateCounts: Object.fromEntries(
        OUTFIT_ROLES.map((role) => [role, candidates[role].length]),
      ) as OutfitGenerationContext["diagnostics"]["candidateCounts"],
      categoryQueries: plan.categoryQueries,
    },
  };
}

function judgedWeather(evalCase: LiveEvalCase): { band: OutfitWeatherBand | null; wet: boolean; text: string } | null {
  return evalCase.judgedWeather ?? summarizeOutfitWeather(evalCase.weatherContext);
}

// Deterministic checks against the scenario's ground truth. They are applied
// to both arms identically, including facts the baseline arm was never told.
export function scoreLiveEvalHardChecks(evalCase: LiveEvalCase, itemIds: string[]): LiveEvalHardChecks {
  const byId = closetById();
  const items = itemIds.flatMap((itemId) => byId.get(itemId) ?? []);
  const weather = judgedWeather(evalCase);
  const cold = weather?.band === "freezing" || weather?.band === "cold";
  const hot = weather?.band === "hot";
  const avoid = (evalCase.avoidColors ?? []).map((color) => color.toLowerCase());
  const usedRoles = new Set(items.map((entry) => entry.role));
  const closet = caseCloset(evalCase);
  const itemIdSet = new Set(itemIds);
  const freshAlternativeExists = (worn: LiveEvalItem) => closet.some((other) =>
    other.role === worn.role &&
    other.id !== worn.id &&
    (evalCase.wornDaysAgo?.[other.id] ?? DEFAULT_WORN_DAYS_AGO) > 2 &&
    laundryState(evalCase, other.id) !== "in_laundry");
  const cleanAlternativeExists = (used: LiveEvalItem) => closet.some((other) =>
    other.role === used.role && other.id !== used.id && laundryState(evalCase, other.id) === "clean");
  const checks = {
    usedLaundryItem: items.some((entry) => laundryState(evalCase, entry.id) === "in_laundry"),
    usedAvoidedColor: items.some((entry) => entry.colors.some((color) => avoid.includes(color.toLowerCase()))),
    underdressedForCold: cold && (
      !items.some((entry) => (entry.role === "top" || entry.role === "outerwear") && entry.warmth >= 4) ||
      items.some((entry) => entry.role !== "accessory" && entry.warmth <= 1 && !usedRoles.has("outerwear")) ||
      items.some((entry) => /\b(shorts|sandals)\b/i.test(entry.subcategory))
    ),
    overdressedForHeat: hot && items.some((entry) => entry.warmth >= 4),
    wetUnsafeFootwear: weather?.wet === true && items.some((entry) =>
      entry.role === "footwear" && WET_UNSAFE.test(`${entry.subcategory} ${entry.material}`)),
    // Rotation and washing follow the per-garment rules: a coat worn yesterday
    // or shoes "worn since washing" are not violations.
    repeatedRecentWear: items.some((entry) =>
      !evalCase.requiredItemIds?.includes(entry.id) &&
      isWornTooRecently(entry.role, evalCase.wornDaysAgo?.[entry.id] ?? DEFAULT_WORN_DAYS_AGO) &&
      freshAlternativeExists(entry)),
    usedUnwashedItem: items.some((entry) =>
      !evalCase.requiredItemIds?.includes(entry.id) &&
      isNotFreshForRole(entry.role, laundryState(evalCase, entry.id), EVAL_WEARS_SINCE_WASH) &&
      cleanAlternativeExists(entry)),
    droppedKeptItem: (evalCase.requiredItemIds ?? []).some((itemId) => !itemIdSet.has(itemId)),
    usedReplacedItem: (evalCase.avoidItemIds ?? []).some((itemId) => itemIdSet.has(itemId)),
    wrongForOffice: evalCase.officeRequest === true && (
      items.some((entry) => OFFICE_WRONG.test(entry.subcategory)) ||
      (items.some((entry) => entry.role === "top" && /\bt-shirt\b/.test(entry.subcategory)) && !usedRoles.has("outerwear"))
    ),
  };
  return {
    ...checks,
    violationCount: VIOLATION_KEYS.filter((key) => checks[key]).length,
  };
}

function withModel(client: OutfitOpenAIClient, model: string | undefined): OutfitOpenAIClient {
  if (!model) return client;
  return { responses: { create: (args) => client.responses.create({ ...args, model }) } };
}

async function runArm(
  evalCase: LiveEvalCase,
  arm: LiveEvalArm,
  client: OutfitOpenAIClient,
): Promise<LiveEvalArmResult> {
  const startedAt = Date.now();
  try {
    const context = buildLiveEvalContext(evalCase, arm);
    const laundryNotice = laundryNoticeText(context.diagnostics.laundryNotices);
    const generated = await generateValidatedOutfitsFromContext(
      buildLiveEvalInput(evalCase, arm),
      context,
      { client },
    );
    const outfit: ValidatedOutfit | undefined = generated.outfits[0];
    if (!outfit) throw new Error("No outfit returned.");
    const byId = closetById();
    const items = outfit.items.map((entry) => ({
      itemId: entry.itemId,
      name: byId.get(entry.itemId)?.name ?? entry.itemId,
      role: String(entry.role),
    }));
    return {
      arm,
      ok: true,
      durationMs: Date.now() - startedAt,
      repaired: generated.repaired,
      ...(generated.stylistMessage ? { stylistMessage: generated.stylistMessage } : {}),
      ...(laundryNotice ? { laundryNotice } : {}),
      outfit: { title: outfit.title, explanation: outfit.explanation.slice(0, 400), items },
      checks: scoreLiveEvalHardChecks(evalCase, items.map((entry) => entry.itemId)),
    };
  } catch (error) {
    return {
      arm,
      ok: false,
      durationMs: Date.now() - startedAt,
      repaired: false,
      error: (error instanceof Error ? error.message : String(error)).slice(0, 300),
    };
  }
}

// Which arm is shown as "A" is decided by a hash of the seed and case id, so a
// run is reproducible and the judge cannot learn a position.
export function blindOrderFor(seed: string, caseId: string): { A: LiveEvalArm; B: LiveEvalArm } {
  const bit = createHash("sha256").update(`${seed}:${caseId}`).digest()[0] % 2;
  return bit === 0 ? { A: "full", B: "baseline" } : { A: "baseline", B: "full" };
}

function describeOutfitForJudge(result: LiveEvalArmResult) {
  const byId = closetById();
  // Titles are left out: a model-written title can reveal what that arm knew.
  return {
    items: (result.outfit?.items ?? []).map((entry) => {
      const source = byId.get(entry.itemId);
      return {
        role: entry.role,
        name: entry.name,
        colors: source?.colors ?? [],
        fit: source?.fit ?? null,
        material: source?.material ?? null,
        warmth: source?.warmth ?? null,
      };
    }),
  };
}

function scenarioForJudge(evalCase: LiveEvalCase) {
  const byId = closetById();
  const names = (ids: string[] | undefined) => (ids ?? []).map((id) => byId.get(id)?.name ?? id);
  return {
    request: evalCase.query,
    weather: judgedWeather(evalCase)?.text ?? "unknown",
    date: evalCase.localDate ?? "unknown",
    statedPreferences: evalCase.userPreferences ?? null,
    inLaundryAndUnwearable: names(evalCase.laundryItemIds),
    wornButNotWashed: names(evalCase.needsWashItemIds),
    wornInLastTwoDays: names(Object.entries(evalCase.wornDaysAgo ?? {})
      .filter(([, days]) => days <= 2)
      .map(([id]) => id)),
  };
}

function clampScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(5, Math.round(parsed)));
}

function parseScores(value: unknown): LiveEvalJudgeScores {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    occasion: clampScore(data.occasion),
    weather: clampScore(data.weather),
    coherence: clampScore(data.coherence),
    personalFit: clampScore(data.personalFit),
  };
}

const JUDGE_SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    occasion: { type: "integer" },
    weather: { type: "integer" },
    coherence: { type: "integer" },
    personalFit: { type: "integer" },
  },
  required: ["occasion", "weather", "coherence", "personalFit"],
};

export function buildLiveEvalJudgeRequest(
  evalCase: LiveEvalCase,
  arms: Record<LiveEvalArm, LiveEvalArmResult>,
  order: { A: LiveEvalArm; B: LiveEvalArm },
  model: string,
) {
  return {
    model,
    input: [
      {
        role: "developer",
        content: [
          "You are an experienced personal stylist judging two outfits built from the same synthetic wardrobe for the same person and moment.",
          "Judge only what you are given. The scenario facts are ground truth, including facts the outfit's author may not have known.",
          "Score each outfit 1 to 5 on: occasion (fits the request), weather (comfortable and practical for the stated conditions), coherence (colour, proportion and formality work together as one look), personalFit (respects the person's stated preferences, uses nothing in the laundry, and avoids pieces worn in the last two days when it reasonably can).",
          "Then pick the outfit this person would be better off wearing. Answer tie only when they are equally good. Do not reward longer outfits or more accessories by default.",
          "Return JSON only.",
        ].join(" "),
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: JSON.stringify({
            scenario: scenarioForJudge(evalCase),
            outfitA: describeOutfitForJudge(arms[order.A]),
            outfitB: describeOutfitForJudge(arms[order.B]),
          }, null, 2),
        }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "aura_live_eval_judgement",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            scoresA: JUDGE_SCORE_SCHEMA,
            scoresB: JUDGE_SCORE_SCHEMA,
            winner: { type: "string", enum: ["A", "B", "tie"] },
            reason: { type: "string" },
          },
          required: ["scoresA", "scoresB", "winner", "reason"],
        },
      },
    },
  };
}

export function parseLiveEvalJudgement(
  outputText: string | null | undefined,
  order: { A: LiveEvalArm; B: LiveEvalArm },
): LiveEvalJudgeResult {
  const data = JSON.parse(String(outputText ?? "").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as Record<string, unknown>;
  const winner = data.winner === "A" ? order.A : data.winner === "B" ? order.B : "tie";
  const scores = { baseline: parseScores(null), full: parseScores(null) };
  scores[order.A] = parseScores(data.scoresA);
  scores[order.B] = parseScores(data.scoresB);
  return {
    winner,
    blindOrder: order,
    scores,
    reason: String(data.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function mean(values: number[]): number {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
}

export function summarizeLiveEval(cases: LiveEvalCaseResult[]): LiveEvalSummary {
  const perArm = <T>(build: (arm: LiveEvalArm) => T) => ({ baseline: build("baseline"), full: build("full") });
  const judged = cases.flatMap((entry) => entry.judge ? [entry.judge] : []);
  const violationCounts = (arm: LiveEvalArm) => Object.fromEntries(VIOLATION_KEYS.map((key) => [
    key,
    cases.filter((entry) => entry.arms[arm].checks?.[key]).length,
  ])) as LiveEvalSummary["violations"]["full"];
  const meanScores = (arm: LiveEvalArm): LiveEvalJudgeScores => ({
    occasion: mean(judged.map((entry) => entry.scores[arm].occasion)),
    weather: mean(judged.map((entry) => entry.scores[arm].weather)),
    coherence: mean(judged.map((entry) => entry.scores[arm].coherence)),
    personalFit: mean(judged.map((entry) => entry.scores[arm].personalFit)),
  });
  const fullOk = cases.filter((entry) => entry.arms.full.ok);
  return {
    totalCases: cases.length,
    generationFailures: perArm((arm) => cases.filter((entry) => !entry.arms[arm].ok).length),
    casesWithViolations: perArm((arm) => cases.filter((entry) => (entry.arms[arm].checks?.violationCount ?? 0) > 0).length),
    violations: perArm(violationCounts),
    judge: {
      judgedCases: judged.length,
      fullWins: judged.filter((entry) => entry.winner === "full").length,
      baselineWins: judged.filter((entry) => entry.winner === "baseline").length,
      ties: judged.filter((entry) => entry.winner === "tie").length,
      meanScores: perArm(meanScores),
    },
    stylistMessageRate: fullOk.length
      ? Number((fullOk.filter((entry) => entry.arms.full.stylistMessage).length / fullOk.length).toFixed(2))
      : 0,
    medianDurationMs: perArm((arm) => median(cases.filter((entry) => entry.arms[arm].ok).map((entry) => entry.arms[arm].durationMs))),
  };
}

export type LiveEvalCaseSet = "core" | "heldout" | "all";

export function selectLiveEvalCases(caseIds?: string[], set: LiveEvalCaseSet = "core"): LiveEvalCase[] {
  const all = [...LIVE_EVAL_CASES, ...HELD_OUT_LIVE_EVAL_CASES];
  if (!caseIds?.length) {
    return set === "all" ? all : set === "heldout" ? HELD_OUT_LIVE_EVAL_CASES : LIVE_EVAL_CASES;
  }
  const wanted = new Set(caseIds);
  const selected = all.filter((entry) => wanted.has(entry.id));
  const unknown = caseIds.filter((id) => !selected.some((entry) => entry.id === id));
  if (unknown.length) throw new Error(`Unknown live eval case id(s): ${unknown.join(", ")}`);
  return selected;
}

// Upper bound on billed model calls for a run: each arm may use one repair
// call, and each case is judged once.
export function estimateLiveEvalCalls(caseCount: number, withJudge: boolean): { minimum: number; maximum: number } {
  const judgeCalls = withJudge ? caseCount : 0;
  return { minimum: caseCount * 2 + judgeCalls, maximum: caseCount * 4 + judgeCalls };
}

export async function runLiveEval(options: LiveEvalOptions): Promise<LiveEvalReport> {
  const seed = options.seed ?? "aura-live-eval-v1";
  const generationClient = withModel(options.generationClient, options.generationModel);
  const judgeModel = options.judgeClient ? options.judgeModel ?? "gpt-5.4" : null;
  const results: LiveEvalCaseResult[] = [];
  for (const evalCase of selectLiveEvalCases(options.caseIds, options.caseSet)) {
    options.onProgress?.(`case ${evalCase.id}: generating`);
    const [baseline, full] = await Promise.all([
      runArm(evalCase, "baseline", generationClient),
      runArm(evalCase, "full", generationClient),
    ]);
    const result: LiveEvalCaseResult = {
      caseId: evalCase.id,
      query: evalCase.query,
      notes: evalCase.heldOut ? `[held-out] ${evalCase.notes}` : evalCase.notes,
      arms: { baseline, full },
    };
    if (options.judgeClient && judgeModel && baseline.ok && full.ok) {
      const order = blindOrderFor(seed, evalCase.id);
      try {
        options.onProgress?.(`case ${evalCase.id}: judging`);
        const response = await options.judgeClient.responses.create(
          buildLiveEvalJudgeRequest(evalCase, result.arms, order, judgeModel),
        );
        result.judge = parseLiveEvalJudgement(response.output_text, order);
      } catch (error) {
        result.judgeError = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      }
    }
    results.push(result);
  }
  return {
    timestamp: new Date(options.now ?? Date.now()).toISOString(),
    generationModel: options.generationModel ?? outfitGenerationConfig().model,
    judgeModel,
    seed,
    cases: results,
    summary: summarizeLiveEval(results),
  };
}

function outfitLine(result: LiveEvalArmResult): string {
  if (!result.ok) return `_generation failed: ${result.error ?? "unknown error"}_`;
  return (result.outfit?.items ?? []).map((entry) => entry.name).join(" + ");
}

function violationList(checks: LiveEvalHardChecks | undefined): string {
  if (!checks) return "n/a";
  const hit = VIOLATION_KEYS.filter((key) => checks[key]);
  return hit.length ? hit.join(", ") : "none";
}

export function renderLiveEvalMarkdown(report: LiveEvalReport): string {
  const { summary } = report;
  const lines = [
    "# AURA Live Outfit Eval",
    "",
    `- Run: ${report.timestamp}`,
    `- Generation model: ${report.generationModel}`,
    `- Judge model: ${report.judgeModel ?? "not run"}`,
    `- Cases: ${summary.totalCases} (synthetic closet, one outfit per arm)`,
    "",
    "Baseline is the same request with weather, date, stated preferences, garment details, wear history and laundry filtering removed.",
    "",
    "## Hard checks",
    "",
    "| Check | Baseline | Full |",
    "| --- | ---: | ---: |",
    `| Generation failures | ${summary.generationFailures.baseline} | ${summary.generationFailures.full} |`,
    `| Cases with any violation | ${summary.casesWithViolations.baseline} | ${summary.casesWithViolations.full} |`,
    ...VIOLATION_KEYS.map((key) => `| ${key} | ${summary.violations.baseline[key]} | ${summary.violations.full[key]} |`),
    `| Median generation time (ms) | ${summary.medianDurationMs.baseline} | ${summary.medianDurationMs.full} |`,
    "",
    `Stylist reply returned in ${Math.round(summary.stylistMessageRate * 100)}% of successful full-arm outfits.`,
    "",
    "## Blind judge",
    "",
    summary.judge.judgedCases
      ? `Full preferred in ${summary.judge.fullWins}, baseline in ${summary.judge.baselineWins}, tie in ${summary.judge.ties} of ${summary.judge.judgedCases} judged cases.`
      : "Judge not run.",
    "",
    "| Score (1-5) | Baseline | Full |",
    "| --- | ---: | ---: |",
    ...(["occasion", "weather", "coherence", "personalFit"] as const).map((key) =>
      `| ${key} | ${summary.judge.meanScores.baseline[key]} | ${summary.judge.meanScores.full[key]} |`),
    "",
    "## Cases",
    "",
  ];
  for (const entry of report.cases) {
    lines.push(
      `### ${entry.caseId}`,
      "",
      `Request: "${entry.query}". ${entry.notes}`,
      "",
      `- Baseline: ${outfitLine(entry.arms.baseline)} (violations: ${violationList(entry.arms.baseline.checks)})`,
      `- Full: ${outfitLine(entry.arms.full)} (violations: ${violationList(entry.arms.full.checks)})`,
      ...(entry.arms.full.stylistMessage ? [`- Stylist reply: ${entry.arms.full.stylistMessage}`] : []),
      ...(entry.arms.full.laundryNotice ? [`- Laundry notice added to the reply: ${entry.arms.full.laundryNotice}`] : []),
      ...(entry.judge ? [`- Judge: ${entry.judge.winner}. ${entry.judge.reason}`] : []),
      ...(entry.judgeError ? [`- Judge error: ${entry.judgeError}`] : []),
      "",
    );
  }
  return lines.join("\n");
}

// A sheet for rating the same pairs by hand without knowing which is which.
// The key is in the JSON report under each case's judge.blindOrder, or can be
// recomputed from the seed.
export function renderLiveEvalBlindSheet(report: LiveEvalReport): string {
  const lines = [
    "# AURA Live Outfit Eval: blind rating sheet",
    "",
    "For each case, mark the outfit you would rather wear: A, B or tie. Do not open the report until you are done.",
    "",
  ];
  for (const entry of report.cases) {
    if (!entry.arms.baseline.ok || !entry.arms.full.ok) continue;
    const order = blindOrderFor(report.seed, entry.caseId);
    lines.push(
      `## ${entry.caseId}`,
      "",
      `Request: "${entry.query}". ${entry.notes}`,
      "",
      `- A: ${outfitLine(entry.arms[order.A])}`,
      `- B: ${outfitLine(entry.arms[order.B])}`,
      "- Your pick: ",
      "",
    );
  }
  return lines.join("\n");
}

export async function writeLiveEvalReports(
  report: LiveEvalReport,
  outputPath = "reports/aura-live-eval-report.json",
  cwd = process.cwd(),
): Promise<{ jsonPath: string; markdownPath: string; blindSheetPath: string }> {
  const jsonPath = resolve(cwd, outputPath);
  const markdownPath = jsonPath.replace(/\.json$/i, ".md");
  const blindSheetPath = jsonPath.replace(/\.json$/i, "-blind-sheet.md");
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(markdownPath, `${renderLiveEvalMarkdown(report)}\n`);
  await writeFile(blindSheetPath, `${renderLiveEvalBlindSheet(report)}\n`);
  return { jsonPath, markdownPath, blindSheetPath };
}
