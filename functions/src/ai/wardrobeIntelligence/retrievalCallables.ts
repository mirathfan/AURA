import { retrieveHybridCandidates } from "./hybridRetrieval";
import { assertAiConsent, setAiConsentUser } from "../../shared/aiConsent";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger, setLogContext, tracedHandler } from "../../shared/logger";
import { assertFunctionRateLimit, RATE_LIMITS, redactUid } from "../../shared/rateLimit";
import { EMBEDDING_VECTOR_FIELD } from "./config";
import { safeRecordAuraMetricEvent } from "./metrics";
import {
  buildCategoryBuckets,
  buildRetrievalDiagnostics,
  buildWardrobeRetrievalResults,
  countReadyVectorCandidates,
  normalizeWardrobeRetrievalInput,
  rawVectorLimit,
} from "./retrieval";
import { buildWardrobeRetrievalQueryText } from "./retrievalQuery";

const LOG_PREFIX = "[AURA_WARDROBE_RETRIEVAL]";

function requireAuthUid(uid: string | undefined): string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  return uid;
}

function vectorSearchError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("index") || lower.includes("nearest") || lower.includes("vector")) {
    return new HttpsError(
      "failed-precondition",
      `Firestore vector search failed. Ensure a COSINE vector index exists for users/{uid}/items on ${EMBEDDING_VECTOR_FIELD}. Original error: ${message}`,
      {
        code: "firestore_vector_index_required",
        vectorField: EMBEDDING_VECTOR_FIELD,
        distanceMeasure: "COSINE",
      },
    );
  }
  return new HttpsError("internal", `Wardrobe vector retrieval failed: ${message}`);
}

function retrievalErrorCode(error: unknown): string {
  if (error instanceof HttpsError) return error.code;
  if (error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string") {
    return String((error as { code?: unknown }).code);
  }
  return "internal";
}

function categoryCounts(categoryBuckets: ReturnType<typeof buildCategoryBuckets>) {
  return {
    top: categoryBuckets.top?.length ?? 0,
    bottom: categoryBuckets.bottom?.length ?? 0,
    footwear: categoryBuckets.footwear?.length ?? 0,
    outerwear: categoryBuckets.outerwear?.length ?? 0,
    accessory: categoryBuckets.accessory?.length ?? 0,
    one_piece: categoryBuckets.one_piece?.length ?? 0,
  };
}

export const retrieveWardrobeContext = onCall(
  { secrets: ["OPENAI_API_KEY"], timeoutSeconds: 120 },
  tracedHandler(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    const uidHash = redactUid(uid);
    setLogContext({ uidHash });
    setAiConsentUser(uid);
    await assertAiConsent(uid);
    await assertFunctionRateLimit(uid, "wardrobeRetrieval", RATE_LIMITS.wardrobeRetrieval);
    const input = normalizeWardrobeRetrievalInput(request.data);
    const retrievalQueryText = buildWardrobeRetrievalQueryText(input);
    const vectorLimit = rawVectorLimit(input.limit);
    const startedAt = Date.now();

    logger.info(`${LOG_PREFIX} request started`, {
      uidHash,
      queryLength: input.query.length,
      limit: input.limit,
      vectorLimit,
      includeDiagnostics: input.includeDiagnostics,
    });

    try {
      const { candidates, embeddingDimensions } = await retrieveHybridCandidates(uid, retrievalQueryText, vectorLimit);
      const allFilteredResults = buildWardrobeRetrievalResults(
        { ...input, limit: candidates.length || input.limit },
        candidates,
        { requireEmbedding: false },
      );
      const results = allFilteredResults.slice(0, input.limit);
      const categoryBuckets = buildCategoryBuckets(results);
      const response = {
        query: input.query,
        retrievalQueryText,
        limit: input.limit,
        results,
        categoryBuckets,
        ...(input.includeDiagnostics
          ? {
            diagnostics: buildRetrievalDiagnostics({
              input,
              rawVectorLimit: vectorLimit,
              rawResultCount: candidates.length,
              readyResultCount: countReadyVectorCandidates(candidates),
              filteredResultCount: allFilteredResults.length,
              returnedResultCount: results.length,
              embeddingDimensions,
            }),
          }
          : {}),
      };

      logger.info(`${LOG_PREFIX} request success`, {
        uidHash,
        rawResultCount: candidates.length,
        returnedResultCount: results.length,
      });

      await safeRecordAuraMetricEvent(uid, {
        type: "retrieval_completed",
        latencyMs: Date.now() - startedAt,
        returnedCount: results.length,
        categoryCounts: categoryCounts(categoryBuckets),
      });
      return response;
    } catch (error) {
      const payload = vectorSearchError(error);
      logger.error(`${LOG_PREFIX} request failed`, {
        uidHash,
        code: payload.code,
        message: payload.message,
      });
      await safeRecordAuraMetricEvent(uid, {
        type: "retrieval_failed",
        code: retrievalErrorCode(payload),
        timeout: payload.code === "deadline-exceeded",
      });
      throw payload;
    }
  }),
);
