import { deleteItemAtomically } from "../../shared/itemLifecycle";
import { enqueueIndexing } from "./indexingRecovery";
import { assertAiConsent, setAiConsentUser } from "../../shared/aiConsent";
import { FieldPath, getFirestore, type DocumentReference, type Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger, setLogContext, tracedHandler } from "../../shared/logger";
import { assertFunctionRateLimit, RATE_LIMITS, redactUid } from "../../shared/rateLimit";
import {
  isAutoDeleteSafeAbandonedDraft,
  DRAFT_CLEANUP_CONFIRM,
  MAX_DRAFT_CLEANUP_RETURNED_ITEMS,
  buildBulkAbandonedDraftCleanupPlan,
  cutoffTimestampForDays,
  draftCleanupCutoffDays,
  draftCleanupItem,
  draftCleanupLimit,
  previewAbandonedDraftCleanupRecords,
  validateBulkAbandonedDraftCleanupConfirm,
  type DraftCleanupBulkResult,
  type DraftCleanupPreviewResult,
  type DraftCleanupRecord,
} from "./draftCleanup";
import {
  auditClosetDraftItemRecords,
  draftAuditLimit,
  validateDeleteDraftClosetItem,
} from "./draftAudit";
import { indexClosetItemIntelligence, serializeMetadataPreview } from "./indexClosetItem";
import { buildClosetItemEmbeddingText } from "./embeddingText";
import { normalizeClosetItemMetadata } from "./metadata";
import { getClosetItemIndexSkipReason } from "./skip";
import { safeRecordAuraMetricEvent } from "./metrics";
import type { BackfillItemEntry, ClosetItemDocument } from "./types";

const DEFAULT_BACKFILL_LIMIT = 50;
const MAX_BACKFILL_LIMIT = 100;
const MAX_BACKFILL_DEBUG_ITEMS = 50;
const BACKFILL_ALL_BATCH_SIZE = 100;
const MAX_BACKFILL_ALL_ITEMS = 300;

type CleanupDocRecord = DraftCleanupRecord & {
  ref: DocumentReference;
  version: Timestamp | undefined;
};

function requireAuthUid(uid: string | undefined): string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  return uid;
}

function requireItemId(value: unknown): string {
  const itemId = String(value ?? "").trim();
  if (!itemId || itemId.includes("/")) {
    throw new HttpsError("invalid-argument", "A closet item ID is required.");
  }
  return itemId;
}

function backfillLimit(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_BACKFILL_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_BACKFILL_LIMIT;
  return Math.max(1, Math.min(MAX_BACKFILL_LIMIT, Math.floor(parsed)));
}

function nullableCursor(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function errorReason(error: unknown): string {
  return error instanceof HttpsError ? error.code : "indexing_unavailable";
}

function itemName(item: ClosetItemDocument): string {
  return String(item.name ?? item.title ?? item.subCategory ?? item.subcategory ?? item.category ?? "Untitled item")
    .trim() || "Untitled item";
}

function itemCategory(item: ClosetItemDocument): string {
  return String(item.category ?? item.subCategory ?? item.subcategory ?? item.type ?? "unknown").trim() || "unknown";
}

function backfillItemEntry(itemId: string, item: ClosetItemDocument, reason: string): BackfillItemEntry {
  return {
    itemId,
    name: itemName(item),
    category: itemCategory(item),
    reason,
  };
}

function pushDebugItem(items: BackfillItemEntry[], entry: BackfillItemEntry) {
  if (items.length < MAX_BACKFILL_DEBUG_ITEMS) items.push(entry);
}

async function readDraftCleanupRecords(uid: string, limit: number): Promise<CleanupDocRecord[]> {
  const snap = await getFirestore()
    .collection("users")
    .doc(uid)
    .collection("items")
    .where("isDraft", "==", true)
    .limit(limit)
    .get();

  return snap.docs.map((docSnap) => ({
    uid,
    itemId: docSnap.id,
    item: { id: docSnap.id, ...docSnap.data() } as ClosetItemDocument,
    ref: docSnap.ref,
    version: docSnap.updateTime,
  }));
}

async function rereadDraftCleanupRecords(records: CleanupDocRecord[]): Promise<{
  freshRecords: CleanupDocRecord[];
  missingItems: DraftCleanupBulkResult["skippedItems"];
}> {
  const freshRecords: CleanupDocRecord[] = [];
  const missingItems: DraftCleanupBulkResult["skippedItems"] = [];

  for (const record of records) {
    const freshSnap = await record.ref.get();
    if (!freshSnap.exists) {
      if (missingItems.length < MAX_DRAFT_CLEANUP_RETURNED_ITEMS) {
        missingItems.push(draftCleanupItem(
          { uid: record.uid, itemId: record.itemId, item: {} as ClosetItemDocument },
          "not cleanup safe: missing before delete",
        ));
      }
      continue;
    }
    freshRecords.push({
      ...record,
      version: freshSnap.updateTime,
      item: { id: freshSnap.id, ...freshSnap.data() } as ClosetItemDocument,
    });
  }

  return { freshRecords, missingItems };
}

async function deleteCleanupRecords(records: CleanupDocRecord[], cutoffMs: number): Promise<string[]> {
  const deleted: string[] = [];
  for (const record of records) {
    const uid = record.ref.path.split("/")[1];
    if (await deleteItemAtomically(uid, record.itemId, (current) =>
      Boolean(record.version && current.updateTime?.isEqual(record.version)) && isAutoDeleteSafeAbandonedDraft({ id: current.id, ...current.data() } as ClosetItemDocument, cutoffMs))) deleted.push(record.itemId);
  }
  return deleted;
}

type BackfillBatchArgs = {
  uid: string;
  limit: number;
  force: boolean;
  dryRun: boolean;
  cursor?: string | null;
  includeDebugItems?: boolean;
};

type BackfillBatchResult = {
  processed: number;
  indexed: number;
  queued: number;
  skipped: number;
  failed: number;
  indexedItems: BackfillItemEntry[];
  skippedItems: BackfillItemEntry[];
  failedItems: BackfillItemEntry[];
  hasMore: boolean;
  nextCursor: string | null;
  totalBatchSize: number;
  dryRun: boolean;
};

async function processBackfillBatch(args: BackfillBatchArgs): Promise<BackfillBatchResult> {
  let query = getFirestore()
    .collection("users")
    .doc(args.uid)
    .collection("items")
    .orderBy(FieldPath.documentId());

  if (args.cursor) {
    query = query.startAfter(args.cursor);
  }

  const snap = await query.limit(args.limit + 1).get();
  const docsToProcess = snap.docs.slice(0, args.limit);
  const hasMore = snap.docs.length > args.limit;
  const nextCursor = docsToProcess.at(-1)?.id ?? null;
  const includeDebugItems = args.includeDebugItems !== false;

  let indexed = 0;
  let queued = 0;
  let skipped = 0;
  let failed = 0;
  const indexedItems: BackfillItemEntry[] = [];
  const skippedItems: BackfillItemEntry[] = [];
  const failedItems: BackfillItemEntry[] = [];

  for (const doc of docsToProcess) {
    const item = { id: doc.id, ...doc.data() } as ClosetItemDocument;
    const skipReason = getClosetItemIndexSkipReason(item);
    if (skipReason) {
      skipped += 1;
      if (includeDebugItems) pushDebugItem(skippedItems, backfillItemEntry(doc.id, item, skipReason));
      continue;
    }
    try {
      if (!args.dryRun) {
        const state = await enqueueIndexing(args.uid, doc.id, { retryTerminal: args.force });
        if (["pending", "processing", "retryable_failure"].includes(state)) queued += 1;
        else if (state === "terminal_failure") failed += 1;
        else skipped += 1;
        continue;
      }
      const result = await indexClosetItemIntelligence({
        itemId: doc.id,
        item,
        ref: doc.ref,
        force: args.force,
        dryRun: args.dryRun,
      });
      if (result.status === "indexed") {
        indexed += 1;
        if (includeDebugItems) pushDebugItem(indexedItems, backfillItemEntry(doc.id, item, result.reason));
      } else {
        skipped += 1;
        if (includeDebugItems) pushDebugItem(skippedItems, backfillItemEntry(doc.id, item, result.reason));
      }
    } catch (error) {
      failed += 1;
      if (includeDebugItems) pushDebugItem(failedItems, backfillItemEntry(doc.id, item, errorReason(error)));
      logger.error("[WARDROBE_INTELLIGENCE] backfill item failed", {
        itemId: doc.id,
        reason: errorReason(error),
      });
    }
  }

  return {
    processed: docsToProcess.length,
    indexed,
    queued,
    skipped,
    failed,
    indexedItems,
    skippedItems,
    failedItems,
    hasMore,
    nextCursor: hasMore ? nextCursor : null,
    totalBatchSize: docsToProcess.length,
    dryRun: args.dryRun,
  };
}

export const reindexClosetItem = onCall(
  { secrets: ["OPENAI_API_KEY"], timeoutSeconds: 120 },
  tracedHandler(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    setLogContext({ uidHash: redactUid(uid) });
    setAiConsentUser(uid);
    await assertAiConsent(uid);
    await assertFunctionRateLimit(uid, "wardrobeBackfill", RATE_LIMITS.wardrobeBackfill);
    const itemId = requireItemId(request.data?.itemId);
    const status = await enqueueIndexing(uid, itemId, { retryTerminal: request.data?.force === true });
    if (status === "missing") throw new HttpsError("not-found", "Closet item not found.");
    return { itemId, status, reason: "Durable indexing status; queued work is not completion." };
  }),
);

export const backfillWardrobeIntelligence = onCall(
  { secrets: ["OPENAI_API_KEY"], timeoutSeconds: 540 },
  tracedHandler(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    setLogContext({ uidHash: redactUid(uid) });
    setAiConsentUser(uid);
    await assertAiConsent(uid);
    await assertFunctionRateLimit(uid, "wardrobeBackfill", RATE_LIMITS.wardrobeBackfill);
    const limit = backfillLimit(request.data?.limit);
    const force = request.data?.force === true;
    const dryRun = request.data?.dryRun === true;
    const cursor = nullableCursor(request.data?.cursor);
    return processBackfillBatch({ uid, limit, force, dryRun, cursor });
  }),
);

export const backfillWardrobeIntelligenceAll = onCall(
  { secrets: ["OPENAI_API_KEY"], timeoutSeconds: 540 },
  tracedHandler(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    const uidHash = redactUid(uid);
    setLogContext({ uidHash });
    setAiConsentUser(uid);
    await assertAiConsent(uid);
    await assertFunctionRateLimit(uid, "wardrobeBackfill", RATE_LIMITS.wardrobeBackfill);
    const force = request.data?.force === true;
    const dryRun = request.data?.dryRun === true;

    let cursor: string | null = null;
    let totalProcessed = 0;
    let totalIndexed = 0;
    let totalQueued = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let batchesExecuted = 0;

    try {
      do {
        const remaining = MAX_BACKFILL_ALL_ITEMS - totalProcessed;
        if (remaining <= 0) break;
        const batch = await processBackfillBatch({
          uid,
          limit: Math.min(BACKFILL_ALL_BATCH_SIZE, remaining),
          force,
          dryRun,
          cursor,
          includeDebugItems: false,
        });
        batchesExecuted += 1;
        totalProcessed += batch.processed;
        totalIndexed += batch.indexed;
        totalQueued += batch.queued;
        totalSkipped += batch.skipped;
        totalFailed += batch.failed;
        cursor = batch.nextCursor;
        logger.info("[AURA_INTELLIGENCE_BACKFILL_ALL] batch processed", {
          uidHash,
          batch: batchesExecuted,
          processed: batch.processed,
          indexed: batch.indexed,
          skipped: batch.skipped,
          failed: batch.failed,
          hasMore: batch.hasMore,
        });
        if (!batch.hasMore) break;
      } while (cursor);

      logger.info("[AURA_INTELLIGENCE_BACKFILL_ALL] completed", {
        uidHash,
        totalProcessed,
        totalIndexed,
        totalSkipped,
        totalFailed,
        batchesExecuted,
      });
    } catch (error) {
      logger.error("[AURA_INTELLIGENCE_BACKFILL_ALL] stopped early", {
        uidHash,
        batchesExecuted,
        reason: errorReason(error),
      });
    }

    return {
      totalProcessed,
      totalIndexed,
      totalQueued,
      totalSkipped,
      totalFailed,
      batchesExecuted,
      capped: totalProcessed >= MAX_BACKFILL_ALL_ITEMS && cursor !== null,
      maxItemsPerRun: MAX_BACKFILL_ALL_ITEMS,
      dryRun,
    };
  }),
);

export const previewClosetItemIntelligence = onCall(
  { timeoutSeconds: 60 },
  tracedHandler(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    setLogContext({ uidHash: redactUid(uid) });
    setAiConsentUser(uid);
    const itemId = requireItemId(request.data?.itemId);
    const ref = getFirestore().collection("users").doc(uid).collection("items").doc(itemId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Closet item not found.");
    }

    const item = { id: itemId, ...snap.data() } as ClosetItemDocument;
    const aiMetadata = normalizeClosetItemMetadata(item);
    const embeddingText = buildClosetItemEmbeddingText(item, aiMetadata);
    return {
      itemId,
      aiMetadata: serializeMetadataPreview(aiMetadata),
      embeddingText,
    };
  }),
);

export const auditClosetDraftItems = onCall(
  { timeoutSeconds: 120 },
  tracedHandler(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    setLogContext({ uidHash: redactUid(uid) });
    setAiConsentUser(uid);
    const limit = draftAuditLimit(request.data?.limit);
    const snap = await getFirestore()
      .collection("users")
      .doc(uid)
      .collection("items")
      .limit(limit)
      .get();

    const result = auditClosetDraftItemRecords(
      snap.docs.map((doc) => ({
        itemId: doc.id,
        item: { id: doc.id, ...doc.data() } as ClosetItemDocument,
      })),
    );
    await safeRecordAuraMetricEvent(uid, {
      type: "wardrobe_coverage_checked",
      readyVisibleItems: result.readyVisibleCount,
      indexedReadyItems: result.indexedReadyCount,
      missingEmbeddingReadyItems: result.missingEmbeddingReadyCount,
    });
    return result;
  }),
);

export const previewAbandonedDraftCleanup = onCall(
  { timeoutSeconds: 120 },
  tracedHandler(async (request): Promise<DraftCleanupPreviewResult> => {
    const uid = requireAuthUid(request.auth?.uid);
    const uidHash = redactUid(uid);
    setLogContext({ uidHash });
    setAiConsentUser(uid);
    const cutoffDays = draftCleanupCutoffDays(request.data?.cutoffDays);
    const cutoffMs = cutoffTimestampForDays(cutoffDays);
    const limit = draftCleanupLimit(request.data?.limit);
    const records = await readDraftCleanupRecords(uid, limit);
    const result = previewAbandonedDraftCleanupRecords({
      uid,
      records,
      cutoffDays,
      cutoffMs,
    });

    logger.info("[AURA_DRAFT_CLEANUP] preview completed", {
      uidHash,
      cutoffDays,
      limit,
      totalChecked: result.totalChecked,
      deleteCandidateCount: result.deleteCandidateCount,
    });

    return result;
  }),
);

export const bulkDeleteAbandonedDrafts = onCall(
  { timeoutSeconds: 120 },
  tracedHandler(async (request): Promise<DraftCleanupBulkResult> => {
    const uid = requireAuthUid(request.auth?.uid);
    const uidHash = redactUid(uid);
    setLogContext({ uidHash });
    setAiConsentUser(uid);
    validateBulkAbandonedDraftCleanupConfirm(request.data?.confirm);
    const cutoffDays = draftCleanupCutoffDays(request.data?.cutoffDays);
    const cutoffMs = cutoffTimestampForDays(cutoffDays);
    const limit = draftCleanupLimit(request.data?.limit);

    logger.warn("[AURA_DRAFT_CLEANUP] bulk delete started", {
      uidHash,
      cutoffDays,
      limit,
      confirm: DRAFT_CLEANUP_CONFIRM,
    });

    const initialRecords = await readDraftCleanupRecords(uid, limit);
    const { freshRecords, missingItems } = await rereadDraftCleanupRecords(initialRecords);
    const plan = buildBulkAbandonedDraftCleanupPlan({
      uid,
      records: freshRecords,
      cutoffDays,
      cutoffMs,
      confirm: request.data?.confirm,
    });

    const deletedIds = await deleteCleanupRecords(plan.deleteRecords as CleanupDocRecord[], cutoffMs);

    const skippedItems = [
      ...missingItems,
      ...plan.skippedItems,
    ].slice(0, MAX_DRAFT_CLEANUP_RETURNED_ITEMS);
    const result: DraftCleanupBulkResult = {
      cutoffDays,
      totalChecked: initialRecords.length,
      deletedCount: deletedIds.length,
      skippedCount: initialRecords.length - deletedIds.length,
      deletedItems: plan.deletedItems.filter((item) => deletedIds.includes(item.itemId)),
      skippedItems,
    };

    logger.warn("[AURA_DRAFT_CLEANUP] bulk delete completed", {
      uidHash,
      cutoffDays,
      totalChecked: result.totalChecked,
      deletedCount: result.deletedCount,
      skippedCount: result.skippedCount,
    });

    return result;
  }),
);

export const deleteDraftClosetItem = onCall(
  { timeoutSeconds: 60 },
  tracedHandler(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    setLogContext({ uidHash: redactUid(uid) });
    setAiConsentUser(uid);
    const itemId = requireItemId(request.data?.itemId);
    const ref = getFirestore().collection("users").doc(uid).collection("items").doc(itemId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Draft closet item not found.");
    }

    const item = { id: itemId, ...snap.data() } as ClosetItemDocument;
    const reason = validateDeleteDraftClosetItem(item, request.data?.confirm);
    logger.warn("[AURA_DRAFT_AUDIT] deleting draft closet item document", {
      uidHash: redactUid(uid),
      itemId,
      reason,
    });
    const deleted = await deleteItemAtomically(uid, itemId, (current) => {
      if ((!snap.updateTime || !current.updateTime?.isEqual(snap.updateTime))) return false;
      validateDeleteDraftClosetItem({ id: itemId, ...current.data() } as ClosetItemDocument, request.data?.confirm);
      return true;
    });
    if (!deleted) throw new HttpsError("failed-precondition", "Item changed. Review it again before deleting.");
    return {
      itemId,
      deleted: true,
      reason,
    };
  }),
);
