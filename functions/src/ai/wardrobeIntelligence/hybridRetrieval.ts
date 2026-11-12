import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { isAiConsentError } from "../../shared/aiConsent";
import { isAccountDeleting } from "../../shared/accountLifecycle";
import { EMBEDDING_VECTOR_FIELD, wardrobeIntelligenceConfig } from "./config";
import { createTextEmbedding } from "./embeddings";
import { buildClosetItemIntelligenceInput } from "./indexClosetItem";
import { VECTOR_DISTANCE_FIELD, type WardrobeVectorCandidate } from "./retrieval";
import type { ClosetItemDocument } from "./types";

// Bounded owner-only scan supplies unindexed items even when some vectors exist.
// Above this documented bound fail explicitly, never infer absence from truncation.
export const STRUCTURED_RETRIEVAL_LIMIT = 500;
export function mergeStructuredCandidates(vectors: WardrobeVectorCandidate[], wardrobe: WardrobeVectorCandidate[]) {
  const byId = new Map(vectors.map((candidate) => [candidate.itemId, candidate]));
  return wardrobe.map((current) => {
    const valid = current.item.embeddingVector && current.item.embeddingHash === buildClosetItemIntelligenceInput(current.item).embeddingHash;
    const vector = byId.get(current.itemId);
    if (valid && vector) return { ...vector, item: current.item };
    // Outdated intelligence must not override current manual structured fields.
    return { ...current, item: valid ? current.item : { ...current.item, aiMetadata: undefined, embeddingText: undefined }, distance: null };
  });
}
export async function retrieveHybridCandidates(uid: string, query: string, limit: number) {
  const collection = getFirestore().collection(`users/${uid}/items`);
  const snapshot = await collection.limit(STRUCTURED_RETRIEVAL_LIMIT + 1).get();
  if (snapshot.size > STRUCTURED_RETRIEVAL_LIMIT) throw new HttpsError("failed-precondition", "This wardrobe exceeds the current 500-item styling retrieval limit.");
  const wardrobe = snapshot.docs.map((doc) => ({ itemId: doc.id, item: doc.data() as ClosetItemDocument }));
  let vectors: WardrobeVectorCandidate[] = [];
  try {
    const vector = await createTextEmbedding(query);
    const nearest = await collection.findNearest({ vectorField: EMBEDDING_VECTOR_FIELD, queryVector: vector,
      limit, distanceMeasure: "COSINE", distanceResultField: VECTOR_DISTANCE_FIELD }).get();
    vectors = nearest.docs.map((doc) => ({ itemId: doc.id, item: doc.data() as ClosetItemDocument, distance: doc.get(VECTOR_DISTANCE_FIELD) }));
  } catch (error) {
    if (isAiConsentError(error) || isAccountDeleting(error)) throw error;
    // Provider/index unavailability degrades to the same structured scoring,
    // not an empty wardrobe. No query, item, vector or raw error is logged.
  }
  return { candidates: mergeStructuredCandidates(vectors, wardrobe), embeddingDimensions: wardrobeIntelligenceConfig().embeddingDimensions };
}
