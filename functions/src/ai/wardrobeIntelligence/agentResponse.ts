import type {
  AuraAgentExplanation,
  AuraAgentFeedbackResult,
  AuraAgentStyleMemorySummary,
  AuraStylingAgentResponse,
  AuraStylingAgentState,
} from "./agentTypes";
import type { OutfitLaundryNotices } from "./outfitTypes";
import { warmLayerItemIds } from "./outfitValidation";
import type { StyleMemoryContextResponse } from "./styleMemoryTypes";

const CLIENT_VECTOR_KEYS = new Set([
  "embeddingVector",
  "embeddingRaw",
  "_values",
  "vector",
  "rawVector",
  "queryVector",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  const result = String(value ?? fallback).trim();
  return result || fallback;
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];
}

function fieldRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

export function sanitizeAgentResponse<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAgentResponse(entry)) as T;
  }
  if (!isRecord(value)) return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (CLIENT_VECTOR_KEYS.has(key)) continue;
    output[key] = sanitizeAgentResponse(entry);
  }
  return output as T;
}

export function buildStyleMemorySummary(
  styleMemory: StyleMemoryContextResponse | null | undefined,
  warnings: string[] = [],
): AuraAgentStyleMemorySummary | undefined {
  if (!styleMemory) {
    return warnings.length
      ? {
        profileSummary: "",
        positiveMemoryCount: 0,
        negativeMemoryCount: 0,
        warnings,
      }
      : undefined;
  }
  return {
    profileSummary: styleMemory.profileSummary,
    positiveMemoryCount: styleMemory.positiveMemories.length,
    negativeMemoryCount: styleMemory.negativeMemories.length,
    warnings,
  };
}

export function buildExplanationFromOutfit(previousOutfit: unknown): AuraAgentExplanation {
  const outfit = fieldRecord(previousOutfit);
  const items = objectArray(outfit?.items);
  return {
    ...(text(outfit?.outfitId) ? { outfitId: text(outfit?.outfitId) } : {}),
    ...(text(outfit?.title) ? { title: text(outfit?.title) } : {}),
    itemRationales: items.map((item) => ({
      itemId: text(item.itemId),
      name: text(item.name, "Closet item"),
      role: text(item.role ?? item.allowedRole ?? item.category, "item"),
      reason: text(item.reason, "Selected because it fits the outfit request and closet context."),
    })),
    ...(isRecord(outfit?.scoreBreakdown) ? { scoreBreakdown: sanitizeAgentResponse(outfit?.scoreBreakdown) } : {}),
  };
}

export function buildFeedbackResult(state: AuraStylingAgentState): AuraAgentFeedbackResult {
  return {
    feedbackType: state.intent?.constraints.feedbackType,
    recorded: Boolean(state.feedbackResult),
    message: state.feedbackResult
      ? "Feedback was recorded into style memory."
      : "Feedback could not be recorded.",
  };
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// A plain sentence the user must see whenever something they asked for is in
// the laundry. Written here, not by the model, so it is always accurate.
export function laundryNoticeText(notices: OutfitLaundryNotices | undefined | null): string {
  if (!notices) return "";
  const parts: string[] = [];
  if (notices.namedInLaundry.length) {
    const many = notices.namedInLaundry.length > 1;
    parts.push(
      `Your ${joinNames(notices.namedInLaundry)} ${many ? "are" : "is"} in the laundry, so I left ${many ? "them" : "it"} out. ` +
      `Tell me if ${many ? "they're" : "it's"} clean and I'll use ${many ? "them" : "it"}.`,
    );
  }
  if (notices.selectedInLaundry.length) {
    const many = notices.selectedInLaundry.length > 1;
    parts.push(
      `Heads up: your ${joinNames(notices.selectedInLaundry)} ${many ? "are" : "is"} marked as in the laundry. ` +
      `I used ${many ? "them" : "it"} because you picked ${many ? "them" : "it"}.`,
    );
  }
  return parts.join(" ");
}

function laundryNotice(state: AuraStylingAgentState): string {
  return laundryNoticeText(state.context?.diagnostics.laundryNotices);
}

// Describe the validated card even if the generator omitted its coat or a repair changed it.
function coldWalkEditMessage(state: AuraStylingAgentState): string | undefined {
  const outfit = state.outfits?.[0];
  if (state.intent?.mode !== "refine_outfit" || !outfit || !state.input || !state.context) return undefined;
  const warmIds = warmLayerItemIds(state.input, state.context);
  const layer = outfit.items.find((item) => warmIds?.includes(item.itemId));
  if (!layer) return undefined;

  const otherPieces = outfit.items.filter((item) => item.itemId !== layer.itemId).map((item) => item.name);
  const lead = (state.outfits?.length ?? 0) > 1 ? "For the first look, wear" : "Wear";
  return `${lead} your ${joinNames(otherPieces)} with the ${layer.name} for warmth.`;
}

function buildMessage(state: AuraStylingAgentState, base = buildBaseMessage(state)): string {
  const mode = state.intent?.mode ?? "unknown";
  const notice = mode === "generate_outfit" || mode === "refine_outfit" ? laundryNotice(state) : "";
  return notice ? `${base} ${notice}` : base;
}

function buildBaseMessage(state: AuraStylingAgentState): string {
  const mode = state.intent?.mode ?? "unknown";
  if (mode === "unknown") {
    return "I could not map that to a supported styling action yet.";
  }
  if (mode === "explain_outfit") {
    const title = text((state.request.previousOutfit as Record<string, unknown> | undefined)?.title, "that outfit");
    return `Here is why ${title} works.`;
  }
  if (mode === "feedback") {
    return state.feedbackResult ? "Got it. I saved that as style memory." : "I need an outfit before I can record feedback.";
  }
  const count = state.outfits?.length ?? 0;
  if (!count) return "I could not generate an outfit from the current closet context.";
  if (state.stylistMessage) return state.stylistMessage;
  const lead = state.outfits?.[0]?.title ?? "your first outfit";
  return count === 1
    ? `I found one closet-based option: ${lead}.`
    : `I found ${count} closet-based options. First up: ${lead}.`;
}

function suggestedActions(state: AuraStylingAgentState) {
  const mode = state.intent?.mode ?? "unknown";
  if (mode === "generate_outfit" || mode === "refine_outfit") {
    return [
      {
        id: "refine-less-formal",
        label: "Make it less formal",
        type: "refine" as const,
        payload: { mode: "refine_outfit", query: "make it less formal" },
      },
      {
        id: "explain",
        label: "Explain this outfit",
        type: "explain" as const,
        payload: { mode: "explain_outfit" },
      },
      {
        id: "more-like-this",
        label: "More like this",
        type: "feedback" as const,
        payload: { mode: "feedback", feedbackType: "more_like_this" },
      },
    ];
  }
  if (mode === "explain_outfit") {
    return [
      {
        id: "refine",
        label: "Refine this outfit",
        type: "refine" as const,
        payload: { mode: "refine_outfit" },
      },
      {
        id: "save-feedback",
        label: "Save as preference",
        type: "feedback" as const,
        payload: { mode: "feedback", feedbackType: "save" },
      },
    ];
  }
  if (mode === "feedback") {
    return [
      {
        id: "generate-updated",
        label: "Generate with updated memory",
        type: "generate" as const,
        payload: { mode: "generate_outfit" },
      },
    ];
  }
  return [
    {
      id: "generate-outfit",
      label: "Try an outfit request",
      type: "generate" as const,
      payload: { mode: "generate_outfit" },
    },
  ];
}

export function buildAgentResponse(state: AuraStylingAgentState): AuraStylingAgentResponse {
  if (!state.intent) {
    throw new Error("Cannot build agent response before intent classification.");
  }
  const memoryWarnings = state.diagnostics.warnings.filter((warning) => /style memory/i.test(warning));
  const editMessage = coldWalkEditMessage(state);
  const response: AuraStylingAgentResponse = {
    mode: state.intent.mode,
    intent: state.intent,
    message: buildMessage(state, editMessage),
    // Preserve grounded edit and laundry details when the app formats the chat reply.
    messageSource: (editMessage || state.stylistMessage || laundryNotice(state)) && state.outfits?.length ? "stylist" : "template",
    suggestedActions: suggestedActions(state),
    ...(state.input?.count ? {requestedCount: state.input.count} : {}),
    ...(state.outfits ? { outfits: state.outfits } : {}),
    ...(buildStyleMemorySummary(state.styleMemory, memoryWarnings)
      ? { styleMemorySummary: buildStyleMemorySummary(state.styleMemory, memoryWarnings) }
      : {}),
    ...(state.request.includeDiagnostics ? { diagnostics: state.diagnostics } : {}),
  };
  return sanitizeAgentResponse(response);
}

export function buildExplanationResponse(state: AuraStylingAgentState): AuraStylingAgentResponse {
  if (!state.intent) {
    throw new Error("Cannot build explanation response before intent classification.");
  }
  const response: AuraStylingAgentResponse = {
    mode: "explain_outfit",
    intent: state.intent,
    message: buildMessage(state),
    suggestedActions: suggestedActions(state),
    explanation: buildExplanationFromOutfit(state.request.previousOutfit),
    ...(state.request.includeDiagnostics ? { diagnostics: state.diagnostics } : {}),
  };
  return sanitizeAgentResponse(response);
}

export function buildFeedbackResponse(state: AuraStylingAgentState): AuraStylingAgentResponse {
  if (!state.intent) {
    throw new Error("Cannot build feedback response before intent classification.");
  }
  const response: AuraStylingAgentResponse = {
    mode: "feedback",
    intent: state.intent,
    message: buildMessage(state),
    suggestedActions: suggestedActions(state),
    feedback: buildFeedbackResult(state),
    ...(state.request.includeDiagnostics ? { diagnostics: state.diagnostics } : {}),
  };
  return sanitizeAgentResponse(response);
}

export function buildFallbackAgentResponse(state: AuraStylingAgentState): AuraStylingAgentResponse {
  if (!state.intent) {
    throw new Error("Cannot build fallback response before intent classification.");
  }
  const response: AuraStylingAgentResponse = {
    mode: "unknown",
    intent: state.intent,
    message: buildMessage(state),
    suggestedActions: suggestedActions(state),
    ...(state.request.includeDiagnostics ? { diagnostics: state.diagnostics } : {}),
  };
  return sanitizeAgentResponse(response);
}
