import { onSchedule } from "firebase-functions/v2/scheduler";
import { recoverWardrobeIndexing } from "./indexingRecovery";

export const recoverWardrobeIndexJobs = onSchedule({
  schedule: "every 5 minutes",
  timeoutSeconds: 540,
  memory: "512MiB",
  maxInstances: 1,
  concurrency: 1,
  secrets: ["OPENAI_API_KEY"],
}, async () => {
  await recoverWardrobeIndexing();
});
