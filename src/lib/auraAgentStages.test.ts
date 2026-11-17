import {
  AURA_AGENT_STILL_WORKING_AFTER_MS,
  auraAgentStageLabel,
  withStillWorkingStage,
  type AuraAgentRequestStage,
} from "./auraAgentStages";

describe("aura agent request stages", () => {
  afterEach(() => jest.useRealTimers());

  it("describes each stage in plain words and nothing for no stage", () => {
    expect(auraAgentStageLabel(null)).toBeNull();
    expect(auraAgentStageLabel({ kind: "checking_weather", day: "today" })).toBe("Checking today's weather");
    expect(auraAgentStageLabel({ kind: "checking_weather", day: "tomorrow" })).toBe("Checking tomorrow's forecast");
    expect(auraAgentStageLabel({ kind: "styling" })).toBe("Building your outfit from your closet");
    expect(auraAgentStageLabel({ kind: "still_working" })).toBe("Still working on your outfit");
    expect(auraAgentStageLabel({ kind: "finishing" })).toBe("Laying out your outfit");
  });

  it("reports still-working only when the work really takes that long", async () => {
    jest.useFakeTimers();
    const stages: AuraAgentRequestStage[] = [];
    let finish: (value: string) => void = () => undefined;
    const work = new Promise<string>((resolve) => { finish = resolve; });
    const result = withStillWorkingStage(work, (stage) => stages.push(stage));
    jest.advanceTimersByTime(AURA_AGENT_STILL_WORKING_AFTER_MS - 1);
    expect(stages).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(stages).toEqual([{ kind: "still_working" }]);
    finish("done");
    await expect(result).resolves.toBe("done");
  });

  it("never reports a stage after fast work or a failure", async () => {
    jest.useFakeTimers();
    const stages: AuraAgentRequestStage[] = [];
    await expect(withStillWorkingStage(Promise.resolve(1), (stage) => stages.push(stage))).resolves.toBe(1);
    await expect(withStillWorkingStage(Promise.reject(new Error("boom")), (stage) => stages.push(stage)))
      .rejects.toThrow("boom");
    jest.advanceTimersByTime(AURA_AGENT_STILL_WORKING_AFTER_MS * 2);
    expect(stages).toEqual([]);
  });
});
