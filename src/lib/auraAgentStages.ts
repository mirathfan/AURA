// What the app is really doing while an outfit request is in flight. Every
// stage is reported by the code that performs it, so the text shown to the
// user is never a guess. The backend answers in one response, so the app
// cannot see its internal steps; it only says what it can observe.

export type AuraAgentRequestStage =
  // The app is looking up weather for the day the outfit is for.
  | { kind: "checking_weather"; day: "today" | "tomorrow" }
  // The request has been sent and the app is waiting for the outfit.
  | { kind: "styling" }
  // Still waiting, longer than a typical request takes.
  | { kind: "still_working" }
  // The response arrived and is being prepared for display.
  | { kind: "finishing" };

// A typical warm request answers within this time.
export const AURA_AGENT_STILL_WORKING_AFTER_MS = 8000;

export function auraAgentStageLabel(stage: AuraAgentRequestStage | null | undefined): string | null {
  if (!stage) return null;
  switch (stage.kind) {
    case "checking_weather":
      return stage.day === "tomorrow" ? "Checking tomorrow's forecast" : "Checking today's weather";
    case "styling":
      return "Building your outfit from your closet";
    case "still_working":
      return "Still working on your outfit";
    case "finishing":
      return "Laying out your outfit";
    default:
      return null;
  }
}

// Runs `work` and reports "still_working" if it has not settled after `afterMs`.
// The timer is always cleared, so no stage is reported after the work ends.
export async function withStillWorkingStage<T>(
  work: Promise<T>,
  onStage: ((stage: AuraAgentRequestStage) => void) | undefined,
  afterMs: number = AURA_AGENT_STILL_WORKING_AFTER_MS,
): Promise<T> {
  if (!onStage) return work;
  const timer = setTimeout(() => onStage({ kind: "still_working" }), Math.max(0, afterMs));
  try {
    return await work;
  } finally {
    clearTimeout(timer);
  }
}
