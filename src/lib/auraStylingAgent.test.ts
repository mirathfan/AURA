/* eslint-disable import/first */
jest.mock("../privacy/consentClient", () => ({ requireClientAiConsent: jest.fn(async () => undefined) }));
const mockApp = {};
const mockAuth = { currentUser: { uid: "test-user" } as { uid: string } | null };
const mockFunctionsRef = {};
const mockGetFunctions = jest.fn(() => mockFunctionsRef);
const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);

jest.mock("@/src/lib/firebase", () => ({
  app: mockApp,
  auth: mockAuth,
}));

const mockGetAuraAgentWeatherContext = jest.fn(
  async (_options?: unknown): Promise<Record<string, unknown> | undefined> => undefined,
);
jest.mock("@/src/lib/auraAgentWeather", () => ({
  getAuraAgentWeatherContext: (options?: unknown) => mockGetAuraAgentWeatherContext(options),
  localDateKey: () => "2026-11-14",
}));

jest.mock("firebase/functions", () => ({
  getFunctions: mockGetFunctions,
  httpsCallable: mockHttpsCallable,
}));

import {
  AURA_AGENT_CALLABLE_NAME,
  AURA_AGENT_ACTION_TIMEOUT_MS,
  AURA_AGENT_FALLBACK_MESSAGE,
  AURA_AGENT_FUNCTIONS_REGION,
  AURA_AGENT_DISLIKE_OUTFIT_CALLABLE_NAME,
  AURA_AGENT_LOG_WEAR_CALLABLE_NAME,
  AURA_AGENT_PLAN_OUTFIT_CALLABLE_NAME,
  AURA_AGENT_SAVE_OUTFIT_CALLABLE_NAME,
  AURA_AGENT_SIGN_IN_MESSAGE,
  buildAuraAgentFallbackMessage,
  buildAuraAgentCallablePayload,
  dislikeAuraAgentOutfitClient,
  logAuraAgentOutfitWearClient,
  normalizeAuraAgentError,
  planAuraAgentOutfitClient,
  runAuraStylingAgentClient,
  saveAuraAgentOutfitClient,
  sanitizeAuraAgentPayload,
} from "@/src/lib/auraStylingAgent";
import type { AuraAgentOutfit } from "@/src/types/auraAgent";

describe("aura styling agent client helpers", () => {
  const response = {
    mode: "generate_outfit",
    intent: {},
    message: "One office outfit is ready.",
    suggestedActions: [],
  };
  let consoleLogSpy: jest.SpyInstance;
  const outfit: AuraAgentOutfit = {
    outfitId: "outfit-1",
    title: "Office fit",
    vibe: "clean",
    occasion: "office",
    formality: "smart_casual",
    explanation: "Works for office.",
    stylingTips: [],
    missingItems: [],
    confidence: 0.9,
    scoreBreakdown: { total: 1 },
    items: [
      {
        itemId: "shirt-1",
        role: "top",
        reason: "Polished.",
        name: "Blue shirt",
        category: "shirt",
        colors: ["blue"],
        imageUrl: null,
        aiMetadata: { debug: true },
      },
      {
        itemId: "shoe-1",
        role: "footwear",
        reason: "Grounds the look.",
        name: "Black loafers",
        category: "shoes",
        colors: ["black"],
        imageUrl: "https://example.com/shoe.png",
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.currentUser = { uid: "test-user" };
    mockCallable.mockResolvedValue({ data: response });
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
  });

  it("sanitizes vector and diagnostics fields from nested payloads", () => {
    const sanitized = sanitizeAuraAgentPayload({
      message: "ok",
      embeddingVector: [1, 2, 3],
      nested: {
        queryVector: [4, 5, 6],
        keep: "yes",
      },
    });
    expect(sanitized).toEqual({
      message: "ok",
      nested: { keep: "yes" },
    });
  });

  it("builds callable payload with safe defaults", () => {
    const payload = buildAuraAgentCallablePayload({
      query: "  style me today  ",
      count: 20,
      preferredColors: ["black", "black", "white"],
      previousOutfit: {
        outfitId: "one",
        rawVector: [0.1],
      },
    });
    expect(payload).toMatchObject({
      query: "style me today",
      mode: "auto",
      count: 5,
      preferredColors: ["black", "white"],
      useStyleMemory: true,
    });
    expect(payload.previousOutfit).toEqual({ outfitId: "one" });
  });

  it("normalizes backend errors to friendly messages", () => {
    const error = normalizeAuraAgentError({
      code: "functions/failed-precondition",
      message: "not enough indexed closet items",
    });
    expect(error.message).toContain("few more ready closet items");
    expect(error.originalMessage).toBe("not enough indexed closet items");
  });

  it("uses the us-central1 runAuraStylingAgent callable with the full raw query", async () => {
    const fullQuery = "Give me 3 outfits for a date";
    await expect(runAuraStylingAgentClient({ query: fullQuery, count: 3 }, { timeoutMs: 100 })).resolves.toMatchObject({
      message: "One office outfit is ready.",
      requestedCount: 3,
    });
    expect(mockGetFunctions).toHaveBeenCalledWith(mockApp, AURA_AGENT_FUNCTIONS_REGION);
    expect(mockHttpsCallable).toHaveBeenCalledWith(mockFunctionsRef, AURA_AGENT_CALLABLE_NAME);
    expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({ query: fullQuery, count: 3 }));
  });

  it("timeout rejects with a normalized timeout error", async () => {
    mockCallable.mockImplementationOnce(() => new Promise(() => {}));
    await expect(runAuraStylingAgentClient({ query: "office outfit" }, { timeoutMs: 5 })).rejects.toMatchObject({
      code: "functions/deadline-exceeded",
      message: AURA_AGENT_FALLBACK_MESSAGE,
    });
  });

  it("null response normalizes to the friendly fallback message", async () => {
    mockCallable.mockResolvedValueOnce({ data: null });
    await expect(runAuraStylingAgentClient({ query: "office outfit" }, { timeoutMs: 100 })).rejects.toMatchObject({
      code: "aura-agent/empty-response",
      message: AURA_AGENT_FALLBACK_MESSAGE,
    });
  });

  it("does not call the agent when auth is missing", async () => {
    mockAuth.currentUser = null;
    await expect(runAuraStylingAgentClient({ query: "office outfit" }, { timeoutMs: 100 })).rejects.toMatchObject({
      code: "auth/unauthenticated",
      message: AURA_AGENT_SIGN_IN_MESSAGE,
    });
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it("sends lightweight payloads to saveAuraAgentOutfit", async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        saved: true,
        alreadySaved: false,
        savedOutfitId: "aura_agent_hash",
        message: "Added to your saved outfits.",
      },
    });

    await expect(
      saveAuraAgentOutfitClient({
        outfit,
        query: "Give me 3 outfits for office",
        sourceMessageId: "message-1",
      }, { timeoutMs: 100 }),
    ).resolves.toMatchObject({
      saved: true,
      savedOutfitId: "aura_agent_hash",
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith(
      mockFunctionsRef,
      AURA_AGENT_SAVE_OUTFIT_CALLABLE_NAME,
    );
    expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({
      query: "Give me 3 outfits for office",
      sourceMessageId: "message-1",
      outfit: expect.objectContaining({ outfitId: "outfit-1" }),
    }));
    const payload = mockCallable.mock.calls[0][0];
    expect(JSON.stringify(payload)).not.toContain("scoreBreakdown");
    expect(JSON.stringify(payload)).not.toContain("aiMetadata");
  });

  it.each([{ saved: false, savedOutfitId: "id" }, { saved: true, savedOutfitId: " " }])(
    "rejects an unconfirmed save response %j", async (data) => {
      mockCallable.mockResolvedValueOnce({ data });
      await expect(saveAuraAgentOutfitClient({ outfit }, { timeoutMs: 100 })).rejects.toMatchObject({
        code: "aura-agent/invalid-save-response",
      });
    },
  );

  it("uses the shorter production timeout for action callables by default", async () => {
    jest.useFakeTimers();
    mockCallable.mockImplementationOnce(() => new Promise(() => {}));

    const pending = saveAuraAgentOutfitClient({
      outfit,
      query: "save this",
    });

    jest.advanceTimersByTime(AURA_AGENT_ACTION_TIMEOUT_MS);

    await expect(pending).rejects.toMatchObject({
      code: "functions/deadline-exceeded",
      callableName: AURA_AGENT_SAVE_OUTFIT_CALLABLE_NAME,
      originalMessage: `${AURA_AGENT_SAVE_OUTFIT_CALLABLE_NAME} timed out after ${AURA_AGENT_ACTION_TIMEOUT_MS}ms.`,
    });
  });

  it("sends selected outfit payloads to logAuraAgentOutfitWear", async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        logged: true,
        alreadyLogged: false,
        wearEventId: "wear-1",
        message: "Marked as worn.",
      },
    });

    await expect(
      logAuraAgentOutfitWearClient({
        outfit,
        query: "office outfit",
        wornAt: new Date("2026-06-01T12:00:00.000Z"),
      }, { timeoutMs: 100 }),
    ).resolves.toMatchObject({
      logged: true,
      wearEventId: "wear-1",
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith(
      mockFunctionsRef,
      AURA_AGENT_LOG_WEAR_CALLABLE_NAME,
    );
    expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({
      query: "office outfit",
      wornAt: "2026-06-01T12:00:00.000Z",
      outfit: expect.objectContaining({ outfitId: "outfit-1" }),
    }));
  });

  it("sends selected outfit payloads to planAuraAgentOutfit", async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        planned: true,
        alreadyPlanned: false,
        eventId: "planned-1",
        dateKey: "2026-06-05",
        weatherWarnings: [{ severity: "warning", message: "Rainy." }],
        message: "Planned for 2026-06-05.",
      },
    });

    await expect(
      planAuraAgentOutfitClient({
        outfit,
        query: "Save this for Friday",
        dateKey: "2026-06-05",
      }, { timeoutMs: 100 }),
    ).resolves.toMatchObject({
      planned: true,
      eventId: "planned-1",
      dateKey: "2026-06-05",
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith(
      mockFunctionsRef,
      AURA_AGENT_PLAN_OUTFIT_CALLABLE_NAME,
    );
    expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({
      query: "Save this for Friday",
      dateKey: "2026-06-05",
      outfit: expect.objectContaining({ outfitId: "outfit-1" }),
    }));
  });

  it("sends selected outfit payloads to dislikeAuraAgentOutfit", async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        disliked: true,
        alreadyDisliked: false,
        dislikedOutfitId: "disliked-1",
        message: "Got it.",
      },
    });

    await expect(
      dislikeAuraAgentOutfitClient({
        outfit,
        query: "not my vibe",
        reasonText: "not my vibe",
      }, { timeoutMs: 100 }),
    ).resolves.toMatchObject({
      disliked: true,
      dislikedOutfitId: "disliked-1",
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith(
      mockFunctionsRef,
      AURA_AGENT_DISLIKE_OUTFIT_CALLABLE_NAME,
    );
    expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({
      query: "not my vibe",
      reasonText: "not my vibe",
      outfit: expect.objectContaining({ outfitId: "outfit-1" }),
    }));
  });

  it("fallback message builder returns production-safe copy", () => {
    expect(buildAuraAgentFallbackMessage({ code: "functions/deadline-exceeded", message: "timeout" })).toBe(
      AURA_AGENT_FALLBACK_MESSAGE,
    );
    expect(buildAuraAgentFallbackMessage({ code: "auth/unauthenticated", message: "no user" })).toBe(
      AURA_AGENT_SIGN_IN_MESSAGE,
    );
  });

  it("adds today's date and quick weather to outfit requests", async () => {
    mockGetAuraAgentWeatherContext.mockResolvedValueOnce({ highF: 41, lowF: 30, condition: "Clear" });
    await runAuraStylingAgentClient({ query: "dinner tonight" }, { timeoutMs: 100 });
    expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({
      localDate: "2026-11-14",
      weatherContext: { highF: 41, lowF: 30, condition: "Clear" },
    }));
  });

  it("still sends the request when weather is unavailable", async () => {
    mockGetAuraAgentWeatherContext.mockRejectedValueOnce(new Error("no location"));
    await runAuraStylingAgentClient({ query: "dinner tonight" }, { timeoutMs: 100 });
    const payload = mockCallable.mock.calls[0][0];
    expect(payload.localDate).toBe("2026-11-14");
    expect(payload.weatherContext).toBeUndefined();
  });

  it("does not look up weather for feedback or when the caller states weather", async () => {
    await runAuraStylingAgentClient({ mode: "feedback", feedbackType: "like", previousOutfit: {} }, { timeoutMs: 100 });
    await runAuraStylingAgentClient({ query: "outfit", weather: "rainy" }, { timeoutMs: 100 });
    expect(mockGetAuraAgentWeatherContext).not.toHaveBeenCalled();
    expect(mockCallable.mock.calls[0][0].localDate).toBeUndefined();
  });

  it("asks for tomorrow's forecast when the request is about tomorrow", async () => {
    mockGetAuraAgentWeatherContext.mockResolvedValueOnce({
      highF: 38, lowF: 27, condition: "Snow", forDate: "2026-11-15", observedAtMs: 1794700000000,
    });
    await runAuraStylingAgentClient({ query: "what should I wear tomorrow" });
    expect(mockGetAuraAgentWeatherContext).toHaveBeenLastCalledWith({ dateKey: "2026-11-15" });
    expect(mockCallable.mock.calls[mockCallable.mock.calls.length - 1][0]).toMatchObject({
      localDate: "2026-11-14",
      weatherContext: { highF: 38, forDate: "2026-11-15", observedAtMs: 1794700000000 },
    });
  });

  it("sends no weather for a trip or another day", async () => {
    mockGetAuraAgentWeatherContext.mockClear();
    await runAuraStylingAgentClient({ query: "pack an outfit for my beach trip next week" });
    expect(mockGetAuraAgentWeatherContext).not.toHaveBeenCalled();
    const payload = mockCallable.mock.calls[mockCallable.mock.calls.length - 1][0];
    expect(payload.weatherContext).toBeUndefined();
    expect(payload.localDate).toBe("2026-11-14");
  });

  it("reports each real step of the request in order", async () => {
    mockGetAuraAgentWeatherContext.mockResolvedValueOnce({ highF: 41, lowF: 30, condition: "Clear" });
    const stages: string[] = [];
    await runAuraStylingAgentClient({ query: "dinner tonight" }, { onStage: (stage) => stages.push(stage.kind) });
    expect(stages).toEqual(["checking_weather", "styling", "finishing"]);
  });

  it("does not claim a weather check it did not make, and survives a failing listener", async () => {
    const stages: string[] = [];
    await runAuraStylingAgentClient(
      { query: "outfit", weather: "rainy" },
      { onStage: (stage) => { stages.push(stage.kind); throw new Error("listener broke"); } },
    );
    expect(stages).toEqual(["styling", "finishing"]);
  });

  it("drops malformed weather values from the payload", () => {
    expect(buildAuraAgentCallablePayload({
      query: "outfit",
      localDate: "today",
      weatherContext: { tempF: Number.NaN, highF: 999, condition: "  Clear " },
    })).toMatchObject({ weatherContext: { condition: "Clear" } });
    expect(buildAuraAgentCallablePayload({ query: "outfit", localDate: "today" }).localDate).toBeUndefined();
  });
});
