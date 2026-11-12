import { assertActiveInTransaction, userIdFromPath } from "../../shared/accountLifecycle";
import { assertAiConsent, aiConsentRef, consentRequired } from "../../shared/aiConsent";
import { isCurrentAiConsent } from "../../../../shared/aiConsent";
import type { DocumentReference, Transaction, Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  AI_METADATA_VERSION,
  EMBEDDING_TEXT_VERSION,
  EMBEDDING_VERSION,
  EMBEDDING_VECTOR_FIELD,
  wardrobeIntelligenceConfig,
} from "./config";
import { buildClosetItemEmbeddingText } from "./embeddingText";
import { createTextEmbedding } from "./embeddings";
import { hashEmbeddingInput } from "./hash";
import { isIndexableClosetItemState } from "./skip";
import { normalizeClosetItemMetadata } from "./metadata";
import type {
  ClosetItemDocument,
  IndexClosetItemResult,
  NormalizedClosetItemMetadata,
} from "./types";

type IndexClosetItemArgs = {
  itemId: string;
  item: ClosetItemDocument;
  ref?: DocumentReference;
  force?: boolean;
  dryRun?: boolean;
  consentRevision?: number;
  itemCreatedAt?: Timestamp;
  createEmbedding?: (text: string) => Promise<number[]>;
  commitGuard?: (transaction: Transaction) => Promise<boolean>;
  onCommitted?: (transaction: Transaction) => void;
};

function hasExistingEmbedding(item: ClosetItemDocument): boolean {
  return Boolean(item.embeddingVector);
}

function hasEmbeddingVector(item: ClosetItemDocument): boolean {
  return Boolean(item.embeddingVector);
}

function indexReason(item: ClosetItemDocument, embeddingHash: string, force: boolean | undefined): string {
  if (force) return "force reindex";
  if (!item.embeddingHash && !hasExistingEmbedding(item)) return "new embedding generated";
  if (item.embeddingHash === embeddingHash && !hasEmbeddingVector(item)) return "missing embeddingVector";
  if (item.embeddingHash && item.embeddingHash !== embeddingHash) return "embedding hash changed";
  if (!hasExistingEmbedding(item)) return "missing embeddingVector";
  return "new embedding generated";
}

function preview(text: string): string {
  return text.length <= 280 ? text : `${text.slice(0, 277).trim()}...`;
}

export function serializeMetadataPreview(metadata: NormalizedClosetItemMetadata): Record<string, unknown> {
  const updatedAt = metadata.updatedAt && typeof (metadata.updatedAt as any).toDate === "function"
    ? (metadata.updatedAt as { toDate: () => Date }).toDate().toISOString()
    : null;
  return {
    ...metadata,
    updatedAt,
  };
}

export function buildClosetItemIntelligenceInput(item: ClosetItemDocument) {
  const config = wardrobeIntelligenceConfig();
  const aiMetadata = normalizeClosetItemMetadata(item);
  const embeddingText = buildClosetItemEmbeddingText(item, aiMetadata);
  const embeddingHash = hashEmbeddingInput(
    embeddingText,
    AI_METADATA_VERSION,
    EMBEDDING_TEXT_VERSION,
    config.embeddingModel,
    config.embeddingDimensions,
  );

  return {
    config,
    aiMetadata,
    embeddingText,
    embeddingHash,
  };
}

export async function indexClosetItemIntelligence(
  args: IndexClosetItemArgs,
): Promise<IndexClosetItemResult> {
  const { config, aiMetadata, embeddingText, embeddingHash } = buildClosetItemIntelligenceInput(args.item);
  const reason = indexReason(args.item, embeddingHash, args.force);
  const unchanged = !args.force &&
    args.item.embeddingHash === embeddingHash &&
    hasExistingEmbedding(args.item);

  if (unchanged) {
    return {
      itemId: args.itemId,
      status: "skipped",
      reason: "matching embedding hash",
      embeddingText,
      embeddingTextPreview: preview(embeddingText),
      aiMetadata,
      embeddingHash,
    };
  }

  if (args.dryRun) {
    return {
      itemId: args.itemId,
      status: "indexed",
      reason,
      embeddingText,
      embeddingTextPreview: preview(embeddingText),
      aiMetadata,
      embeddingHash,
    };
  }

  if (!args.ref) {
    throw new Error("A Firestore document reference is required to index closet item intelligence.");
  }

  const consent = await assertAiConsent(userIdFromPath(args.ref.path));
  if (args.consentRevision !== undefined && consent.revision !== args.consentRevision) throw consentRequired();
  const embedding = await (args.createEmbedding ?? ((text) => createTextEmbedding(text, { maxRetries: 0 })))(embeddingText);
  const ref = args.ref;
  // AI work can finish after an edit or deletion. Read and condition the write
  // in one transaction so stale events cannot restore removed user data.
  const written = await ref.firestore.runTransaction(async (transaction) => {
    await assertActiveInTransaction(transaction, userIdFromPath(ref.path));
    const currentConsent = await transaction.get(aiConsentRef(userIdFromPath(ref.path)));
    if (!isCurrentAiConsent(currentConsent.data()) || currentConsent.get("revision") !== consent.revision) throw consentRequired();
    if (args.commitGuard && !await args.commitGuard(transaction)) return false;
    const latest = await transaction.get(ref);
    const current = latest.data() as ClosetItemDocument | undefined;
    if (
      !current ||
      (args.itemCreatedAt && !latest.createTime?.isEqual(args.itemCreatedAt)) ||
      !isIndexableClosetItemState(current) ||
      buildClosetItemIntelligenceInput(current).embeddingHash !== embeddingHash
    ) {
      return false;
    }
    transaction.set(ref, {
      aiMetadata,
      aiMetadataVersion: AI_METADATA_VERSION,
      embeddingText,
      embeddingHash,
      [EMBEDDING_VECTOR_FIELD]: FieldValue.vector(embedding),
      embeddingModel: config.embeddingModel,
      embeddingDimensions: config.embeddingDimensions,
      embeddingVersion: EMBEDDING_VERSION,
      embeddingUpdatedAt: FieldValue.serverTimestamp(),
      intelligenceUpdatedAt: FieldValue.serverTimestamp(),
      lastIntelligenceRunAt: FieldValue.serverTimestamp(),
      lastIntelligenceReason: reason,
    }, { merge: true });
    args.onCommitted?.(transaction);
    return true;
  });

  if (!written) {
    return {
      itemId: args.itemId,
      status: "skipped",
      reason: "item removed or changed during indexing",
      embeddingText,
      embeddingTextPreview: preview(embeddingText),
      aiMetadata,
      embeddingHash,
    };
  }

  return {
    itemId: args.itemId,
    status: "indexed",
    reason,
    embeddingText,
    embeddingTextPreview: preview(embeddingText),
    aiMetadata,
    embeddingHash,
  };
}
