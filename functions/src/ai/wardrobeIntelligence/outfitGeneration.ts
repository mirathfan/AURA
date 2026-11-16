import OpenAI from "../../shared/consentedOpenAI";
import { HttpsError } from "firebase-functions/v2/https";
import { requireOpenAiApiKey } from "../../shared/env";
import { outfitGenerationConfig } from "./config";
import {
  buildOutfitGenerationDeveloperPrompt,
  buildOutfitGenerationUserPrompt,
  flattenOutfitCandidates,
} from "./outfitPrompt";
import { normalizeOutfitRoleAlias } from "./outfitRole";
import type {
  GeneratedOutfit,
  GeneratedOutfitPayload,
  NormalizedOutfitGenerationInput,
  OutfitGenerationContext,
  OutfitValidationResult,
  OutfitValidationWarning,
  ValidatedOutfit,
} from "./outfitTypes";
import {
  buildValidatedOutfitResponse,
  validateGeneratedOutfits,
} from "./outfitValidation";

type ResponsesCreateArgs = {
  model: string;
  input: unknown;
  text: unknown;
};

export type OutfitOpenAIClient = {
  responses: {
    create: (args: ResponsesCreateArgs) => Promise<{ output_text?: string | null }>;
  };
};

export type GenerateOutfitsOptions = {
  client?: OutfitOpenAIClient;
  repair?: boolean;
};

type InvalidOutfit = {
  outfit: GeneratedOutfit;
  outfitIndex: number;
  errors: string[];
};

function defaultClient(): OutfitOpenAIClient {
  return new OpenAI({ apiKey: requireOpenAiApiKey() }) as OutfitOpenAIClient;
}

function text(value: unknown, fallback = ""): string {
  return String(value ?? fallback).trim();
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => text(entry)).filter(Boolean);
}

function formality(value: unknown): "casual" | "smart_casual" | "formal" {
  const raw = text(value).toLowerCase().replace(/\s+/g, "_");
  if (raw === "casual" || raw === "formal") return raw;
  return "smart_casual";
}

function generatedOutfitFromUnknown(value: unknown): GeneratedOutfit | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const item = entry as Record<string, unknown>;
      const role = normalizeOutfitRoleAlias(item.role);
      if (role === "unknown") return [];
      const itemId = text(item.itemId);
      if (!itemId) return [];
      return [{
        itemId,
        role: role as GeneratedOutfit["items"][number]["role"],
        reason: text(item.reason, "Selected from closet context."),
      }];
    })
    : [];
  return {
    title: text(record.title, "Closet Outfit"),
    vibe: text(record.vibe, "closet-based"),
    occasion: text(record.occasion, "outfit"),
    formality: formality(record.formality),
    items,
    explanation: text(record.explanation),
    stylingTips: arrayOfStrings(record.stylingTips).slice(0, 5),
    missingItems: arrayOfStrings(record.missingItems).slice(0, 5),
    confidence: Number(record.confidence),
  };
}

export function parseGeneratedOutfitPayload(value: unknown): GeneratedOutfitPayload {
  const payload = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { outfits: [] };
  }
  const stylistMessage = text((payload as Record<string, unknown>).stylistMessage).replace(/\s+/g, " ");
  const outfits = Array.isArray((payload as Record<string, unknown>).outfits)
    ? ((payload as Record<string, unknown>).outfits as unknown[]).flatMap((entry) => {
      const outfit = generatedOutfitFromUnknown(entry);
      return outfit ? [outfit] : [];
    })
    : [];
  return { outfits, ...(stylistMessage ? { stylistMessage } : {}) };
}

const MAX_STYLIST_MESSAGE_LENGTH = 280;

// The model's reply is only shown when it still describes the outfit the user
// will see first. Anything doubtful falls back to the neutral template.
export function resolveStylistMessage(args: {
  message: string | undefined;
  firstGenerated: GeneratedOutfit | undefined;
  firstReturned: { items: { itemId: string }[] } | undefined;
  candidateItemIds: string[];
}): string | undefined {
  const message = text(args.message).replace(/\s+/g, " ");
  if (!message || message.length > MAX_STYLIST_MESSAGE_LENGTH) return undefined;
  if (!args.firstGenerated || !args.firstReturned) return undefined;
  const generatedIds = args.firstGenerated.items.map((item) => item.itemId).sort().join("|");
  const returnedIds = args.firstReturned.items.map((item) => item.itemId).sort().join("|");
  if (!generatedIds || generatedIds !== returnedIds) return undefined;
  if (args.candidateItemIds.some((itemId) => itemId.length >= 6 && message.includes(itemId))) return undefined;
  if (/[{}[\]<>]|https?:\/\//i.test(message)) return undefined;
  return message;
}

function outfitSchema(maxOutfits: number) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      stylistMessage: { type: "string" },
      outfits: {
        type: "array",
        minItems: 1,
        maxItems: maxOutfits,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            vibe: { type: "string" },
            occasion: { type: "string" },
            formality: { type: "string", enum: ["casual", "smart_casual", "formal"] },
            items: {
              type: "array",
              minItems: 2,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  itemId: { type: "string" },
                  role: { type: "string", enum: ["top", "bottom", "footwear", "outerwear", "accessory", "one_piece"] },
                  reason: { type: "string" },
                },
                required: ["itemId", "role", "reason"],
              },
            },
            explanation: { type: "string" },
            stylingTips: {
              type: "array",
              maxItems: 5,
              items: { type: "string" },
            },
            missingItems: {
              type: "array",
              maxItems: 5,
              items: { type: "string" },
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: [
            "title",
            "vibe",
            "occasion",
            "formality",
            "items",
            "explanation",
            "stylingTips",
            "missingItems",
            "confidence",
          ],
        },
      },
    },
    required: ["stylistMessage", "outfits"],
  };
}

async function requestOutfitJson(args: {
  client: OutfitOpenAIClient;
  input: NormalizedOutfitGenerationInput;
  context: OutfitGenerationContext;
  repairInstruction?: string;
}): Promise<GeneratedOutfitPayload> {
  const config = outfitGenerationConfig();
  const response = await args.client.responses.create({
    model: config.model,
    input: [
      {
        role: "developer",
        content: buildOutfitGenerationDeveloperPrompt(),
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              buildOutfitGenerationUserPrompt(args.input, args.context) +
              (args.repairInstruction ? `\n\nRepair instruction:\n${args.repairInstruction}` : ""),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "aura_outfit_recommendations",
        schema: outfitSchema(args.input.count),
      },
    },
  });
  return parseGeneratedOutfitPayload(String(response.output_text || "{}"));
}

function rewriteOutfitPrefix(value: string, outfitIndex: number): string {
  return value.replace(/^outfit 1:/, `outfit ${outfitIndex + 1}:`);
}

function validateOutfitAtIndex(
  outfit: GeneratedOutfit,
  outfitIndex: number,
  context: OutfitGenerationContext,
  input: NormalizedOutfitGenerationInput,
): OutfitValidationResult {
  const result = validateGeneratedOutfits([outfit], context, input);
  return {
    ...result,
    errors: result.errors.map((error) => rewriteOutfitPrefix(error, outfitIndex)),
    warnings: result.warnings.map((warning) => rewriteOutfitPrefix(warning, outfitIndex)),
    validationWarnings: result.validationWarnings.map((warning) => ({
      ...warning,
      outfitIndex,
      issue: rewriteOutfitPrefix(warning.issue, outfitIndex),
    })),
  };
}

function outfitSignature(outfit: GeneratedOutfit): string {
  return outfit.items
    .map((item) => `${item.itemId}:${item.role}`)
    .sort()
    .join("|");
}

function dropWarning(outfitIndex: number, errors: string[]): OutfitValidationWarning {
  return {
    outfitIndex,
    issue: errors.join(" | ") || "Generated outfit failed validation.",
    action: "dropped",
  };
}

export async function generateOutfitsFromContext(
  input: NormalizedOutfitGenerationInput,
  context: OutfitGenerationContext,
  options: GenerateOutfitsOptions = {},
): Promise<GeneratedOutfitPayload> {
  const client = options.client ?? defaultClient();
  return requestOutfitJson({ client, input, context });
}

export async function generateValidatedOutfitsFromContext(
  input: NormalizedOutfitGenerationInput,
  context: OutfitGenerationContext,
  options: GenerateOutfitsOptions = {},
): Promise<{
  outfits: ValidatedOutfit[];
  validationErrors: string[];
  validationWarnings: OutfitValidationWarning[];
  repaired: boolean;
  stylistMessage?: string;
}> {
  const config = outfitGenerationConfig();
  const client = options.client ?? defaultClient();
  const first = await requestOutfitJson({ client, input, context });
  const validOutfits: GeneratedOutfit[] = [];
  const seenValidOutfits = new Set<string>();
  const invalidOutfits: InvalidOutfit[] = [];
  const payloadErrors = first.outfits.length
    ? []
    : validateGeneratedOutfits(first.outfits, context, input).errors;
  const validationErrors: string[] = [];
  const validationWarnings: OutfitValidationWarning[] = [];
  const repairedOutfitIndexes = new Set<number>();
  let repaired = false;

  first.outfits.forEach((outfit, outfitIndex) => {
    const validation = validateOutfitAtIndex(outfit, outfitIndex, context, input);
    validationWarnings.push(...validation.validationWarnings);
    if (validation.valid && validation.normalizedOutfits[0]) {
      const normalized = validation.normalizedOutfits[0];
      const signature = outfitSignature(normalized);
      if (!seenValidOutfits.has(signature)) {
        seenValidOutfits.add(signature);
        validOutfits.push(normalized);
      }
      return;
    }
    invalidOutfits.push({ outfit, outfitIndex, errors: validation.errors });
  });

  if ((invalidOutfits.length || payloadErrors.length) && (options.repair ?? config.enableRepair)) {
    repaired = true;
    const repairPayload = await requestOutfitJson({
      client,
      input,
      context,
      repairInstruction: [
        "Repair only the invalid outfit JSON entries once.",
        "Validation errors:",
        ...payloadErrors,
        ...invalidOutfits.flatMap((entry) => entry.errors),
        "Use only provided candidate itemIds.",
        "Use each item with its exact allowedRole.",
        ...(input.requiredItemIds.length
          ? [`Every repaired outfit must include requiredItemIds: ${input.requiredItemIds.join(", ")}.`]
          : []),
        ...(input.avoidItemIds.length
          ? [`Do not use avoidItemIds: ${input.avoidItemIds.join(", ")}.`]
          : []),
        ...(input.avoidTerms.length
          ? [`Do not use items matching avoidTerms: ${input.avoidTerms.join(", ")}.`]
          : []),
        `Return up to ${invalidOutfits.length} replacement outfit(s), not the already valid outfits.`,
        "Return valid JSON in the same schema.",
      ].join("\n"),
    });
    repairPayload.outfits.forEach((outfit, repairIndex) => {
      const original = invalidOutfits[Math.min(repairIndex, invalidOutfits.length - 1)];
      const outfitIndex = original?.outfitIndex ?? first.outfits.length + repairIndex;
      if (original) repairedOutfitIndexes.add(original.outfitIndex);
      const validation = validateOutfitAtIndex(outfit, outfitIndex, context, input);
      validationWarnings.push(...validation.validationWarnings);
      if (validation.valid && validation.normalizedOutfits[0]) {
        const normalized = validation.normalizedOutfits[0];
        const signature = outfitSignature(normalized);
        if (!seenValidOutfits.has(signature)) {
          seenValidOutfits.add(signature);
          validOutfits.push(normalized);
        }
        validationWarnings.push({
          outfitIndex,
          issue: "Invalid generated outfit was repaired successfully.",
          action: "repaired",
        });
        return;
      }
      validationErrors.push(...validation.errors);
      validationWarnings.push(dropWarning(outfitIndex, validation.errors));
    });
  }

  invalidOutfits.forEach((entry) => {
    if (!repaired || !repairedOutfitIndexes.has(entry.outfitIndex)) {
      validationErrors.push(...entry.errors);
      validationWarnings.push(dropWarning(entry.outfitIndex, entry.errors));
    }
  });
  if ((!repaired || !validOutfits.length) && payloadErrors.length) {
    validationErrors.push(...payloadErrors);
    validationWarnings.push(dropWarning(0, payloadErrors));
  }

  if (!validOutfits.length) {
    throw new HttpsError("failed-precondition", OUTFIT_VALIDATION_FAILURE_MESSAGE, {
      validationErrors,
      validationWarnings,
    });
  }

  const outfits = buildValidatedOutfitResponse(validOutfits, context, input).slice(0, input.count);
  const stylistMessage = repaired || invalidOutfits.length
    ? undefined
    : resolveStylistMessage({
      message: first.stylistMessage,
      firstGenerated: validOutfits[0],
      firstReturned: outfits[0],
      candidateItemIds: flattenOutfitCandidates(context).map((candidate) => candidate.itemId),
    });
  return {
    outfits,
    validationErrors,
    validationWarnings,
    repaired,
    ...(stylistMessage ? { stylistMessage } : {}),
  };
}

export const OUTFIT_VALIDATION_FAILURE_MESSAGE = "Generated outfits failed validation.";

const VALIDATION_REASON_PATTERNS: [string, RegExp][] = [
  ["no_outfits", /no outfits were generated/i],
  ["incomplete_outfit", /must include top \+ bottom \+ footwear/i],
  ["unknown_item", /hallucinated itemId/i],
  ["duplicate_item", /duplicate itemId/i],
  ["avoided_item", /explicitly avoided itemId/i],
  ["avoided_term", /matched avoided term/i],
  ["wrong_role", /allowedRole is/i],
  ["office_weak_top", /office outfit uses weak top/i],
  ["office_weak_footwear", /office outfit uses weak footwear/i],
  ["missing_required_item", /missing required selected itemId/i],
  ["call_budget_exhausted", /model call budget exhausted/i],
];

// Rule names and counts only: safe to log, with no item, query or wardrobe text.
export function summarizeValidationFailure(errors: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of Array.isArray(errors) ? errors : []) {
    const text = String(entry ?? "");
    const reason = VALIDATION_REASON_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
  return counts;
}

export function isOutfitValidationFailure(error: unknown): error is HttpsError {
  return error instanceof HttpsError &&
    error.code === "failed-precondition" &&
    error.message === OUTFIT_VALIDATION_FAILURE_MESSAGE;
}

// One request never makes more than this many outfit model calls in total,
// counting every first attempt, repair pass and retry.
export const OUTFIT_MAX_MODEL_CALLS_PER_REQUEST = 4;
// A new attempt is not started this long after the first one began, so a slow
// provider cannot push the request past the app's own timeout.
export const OUTFIT_RETRY_DEADLINE_MS = 18_000;

// A rejected outfit is usually a one-off: the same request often passes on the
// next try. Retry on the server so the user does not see a failure for it.
// The retry reuses the same input and context, so every user constraint
// (selected items, avoided items, colours, occasion) applies again unchanged.
// Generation only reads; nothing is saved or recorded here, so a retry cannot
// repeat a user-visible action.
export async function generateValidatedOutfitsWithRetry(
  input: NormalizedOutfitGenerationInput,
  context: OutfitGenerationContext,
  options: GenerateOutfitsOptions & {
    maxAttempts?: number;
    maxModelCalls?: number;
    retryDeadlineMs?: number;
    now?: () => number;
    onValidationFailure?: (info: {
      attempt: number;
      maxAttempts: number;
      modelCalls: number;
      willRetry: boolean;
      reasons: Record<string, number>;
    }) => void;
  } = {},
): ReturnType<typeof generateValidatedOutfitsFromContext> {
  const {
    maxAttempts: requestedAttempts,
    maxModelCalls: requestedCalls,
    retryDeadlineMs,
    now = Date.now,
    onValidationFailure,
    ...generationOptions
  } = options;
  const maxAttempts = Math.min(3, Math.max(1, requestedAttempts ?? 2));
  const maxModelCalls = Math.min(OUTFIT_MAX_MODEL_CALLS_PER_REQUEST, Math.max(1, requestedCalls ?? OUTFIT_MAX_MODEL_CALLS_PER_REQUEST));
  const deadlineMs = Math.max(0, retryDeadlineMs ?? OUTFIT_RETRY_DEADLINE_MS);
  const startedAt = now();
  const inner = generationOptions.client ?? defaultClient();
  let modelCalls = 0;
  const client: OutfitOpenAIClient = {
    responses: {
      create: (args) => {
        if (modelCalls >= maxModelCalls) {
          throw new HttpsError("failed-precondition", OUTFIT_VALIDATION_FAILURE_MESSAGE, {
            validationErrors: ["Outfit model call budget exhausted."],
          });
        }
        modelCalls += 1;
        return inner.responses.create(args);
      },
    },
  };
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await generateValidatedOutfitsFromContext(input, context, { ...generationOptions, client });
    } catch (error) {
      if (!isOutfitValidationFailure(error)) throw error;
      const details = error.details as { validationErrors?: unknown } | undefined;
      const willRetry = attempt < maxAttempts &&
        modelCalls < maxModelCalls &&
        now() - startedAt < deadlineMs;
      onValidationFailure?.({
        attempt,
        maxAttempts,
        modelCalls,
        willRetry,
        reasons: summarizeValidationFailure(details?.validationErrors),
      });
      if (!willRetry) throw error;
    }
  }
}
