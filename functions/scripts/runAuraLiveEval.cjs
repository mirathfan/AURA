#!/usr/bin/env node

// Live outfit quality eval. Sends ONLY the synthetic closet and scenarios in
// src/ai/wardrobeIntelligence/evals/liveEvalCases.ts to the model provider.
// It reads no user data and no Firestore, which is why it talks to the
// provider directly instead of through the per-user consent transport that
// deployed code must use.
//
// Usage (from functions/, after a build):
//   node scripts/runAuraLiveEval.cjs                      plan only, no calls
//   node scripts/runAuraLiveEval.cjs --confirm-spend      run it
// Options:
//   --cases id1,id2        only these cases
//   --no-judge             skip the blind judge
//   --generation-model m   override the outfit model
//   --judge-model m        judge model (default gpt-5.4)
//   --seed s               seed for the blind A/B order
//   --output path          JSON report path (default reports/aura-live-eval-report.json)

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  let liveEval;
  try {
    liveEval = require("../lib/functions/src/ai/wardrobeIntelligence/evals/liveEval.js");
  } catch (error) {
    throw new Error("Build output not found. Build functions first (tsc), then rerun.");
  }
  const caseIds = arg("--cases") ? arg("--cases").split(",").map((id) => id.trim()).filter(Boolean) : undefined;
  const withJudge = !process.argv.includes("--no-judge");
  const cases = liveEval.selectLiveEvalCases(caseIds);
  const calls = liveEval.estimateLiveEvalCalls(cases.length, withJudge);
  console.log(`Live eval plan: ${cases.length} case(s), ${calls.minimum}-${calls.maximum} model calls${withJudge ? " including the judge" : ""}.`);
  console.log("Only synthetic eval data is sent. No user data is read.");

  if (!process.argv.includes("--confirm-spend")) {
    console.log("Nothing was sent. Re-run with --confirm-spend to make the calls.");
    return;
  }
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in this shell.");

  const OpenAI = require("openai");
  const Client = OpenAI.default || OpenAI;
  const client = new Client({ apiKey });
  const report = await liveEval.runLiveEval({
    generationClient: client,
    judgeClient: withJudge ? client : undefined,
    generationModel: arg("--generation-model"),
    judgeModel: arg("--judge-model"),
    caseIds,
    seed: arg("--seed"),
    onProgress: (message) => console.log(message),
  });
  const paths = await liveEval.writeLiveEvalReports(report, arg("--output"));
  const { summary } = report;
  console.log("");
  console.log(`Cases with a hard-check violation: baseline ${summary.casesWithViolations.baseline}, full ${summary.casesWithViolations.full} of ${summary.totalCases}.`);
  if (summary.judge.judgedCases) {
    console.log(`Blind judge: full ${summary.judge.fullWins}, baseline ${summary.judge.baselineWins}, tie ${summary.judge.ties}.`);
  }
  console.log(`Report: ${paths.markdownPath}`);
  console.log(`Blind rating sheet: ${paths.blindSheetPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
