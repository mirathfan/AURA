/**
 * styleEventTriggers.ts
 *
 * Closes the AURA feedback loop by writing styleEvents when users save looks
 * or mark outfits as worn, then recomputing learnedStyleMemory so askAura
 * picks up the updated signal on the next call.
 *
 * Data flow:
 *   save look  → users/{uid}/savedLooks/{lookId}  (created)
 *   worn outfit → users/{uid}/outfits/{dateKey}   (wornOutfit field added)
 *     ↓
 *   users/{uid}/styleEvents/{eventId}              (written here)
 *     ↓
 *   users/{uid}/profile/learnedStyleMemory         (recomputed here)
 *     ↓
 *   askAura reads via loadCompactAuraMemoryContext  (already wired)
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

import {
  LEARNED_STYLE_MEMORY_DOC_ID,
  computeLearnedStyleMemory,
  normalizeLearnedStyleMemory,
  normalizeStyleEvent,
  type StyleEvent,
  type StyleEventDerivedTraits,
  type StyleEventOutfit,
} from "./shared/auraMemory";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

// ---------------------------------------------------------------------------
// Firestore path helpers (mirrors src/lib/auraMemory.ts)
// ---------------------------------------------------------------------------

function styleEventsCol(uid: string) {
  return db.collection("users").doc(uid).collection("styleEvents");
}

function learnedMemoryRef(uid: string) {
  return db.collection("users").doc(uid)
    .collection("profile").doc(LEARNED_STYLE_MEMORY_DOC_ID);
}

function itemsCol(uid: string) {
  return db.collection("users").doc(uid).collection("items");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanString(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

function normalizeToken(value: unknown): string | null {
  return cleanString(value)?.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ") ?? null;
}

function uniqueTokens(values: Array<string | null | undefined>, limit = 8): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const token = normalizeToken(value);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    next.push(token);
    if (next.length >= limit) break;
  }
  return next;
}

/** Fetch item docs and extract derivedTraits in the same format as src/lib/auraMemory.ts */
async function deriveTraitsFromItemIds(
  uid: string,
  itemIds: string[],
  options?: { formula?: string; vibe?: string[] }
): Promise<StyleEventDerivedTraits> {
  const ids = Array.from(new Set(itemIds.filter(Boolean)));
  if (!ids.length) return options?.formula ? { formula: options.formula } : {};

  const snaps = await Promise.all(
    ids.map((id) => itemsCol(uid).doc(id).get())
  );

  const colors: string[] = [];
  const categories: string[] = [];
  const fits: string[] = [];
  const brands: string[] = [];

  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() ?? {};

    // Colors — same priority order as src/lib/auraMemory.ts pickItemColor
    colors.push(
      cleanString(data.aiColorLabel) ??
      cleanString(data.aiColors?.[0]) ??
      cleanString(data.colors?.[0]) ??
      cleanString(data.colorLabel) ??
      cleanString(data.primaryColor) ??
      ""
    );

    // Category
    const subCat = normalizeToken(data.subCategory);
    const cat    = normalizeToken(data.category);
    categories.push(subCat ?? cat ?? "");

    // Fits
    fits.push(
      normalizeToken(data.fit) ?? "",
      normalizeToken(data.rise) ?? "",
      normalizeToken(data.legShape) ?? ""
    );

    // Brand
    brands.push(cleanString(data.brand) ?? "");
  }

  const derived: StyleEventDerivedTraits = {};
  const c = uniqueTokens(colors, 6);
  const g = uniqueTokens(categories, 6);
  const f = uniqueTokens(fits, 6);
  const b = uniqueTokens(brands, 4);
  const v = uniqueTokens(options?.vibe ?? [], 4);

  if (c.length) derived.colors = c;
  if (g.length) derived.categories = g;
  if (f.length) derived.fits = f;
  if (b.length) derived.brands = b;
  if (options?.formula) derived.formula = normalizeToken(options.formula) ?? undefined;
  if (v.length) derived.vibe = v;

  return derived;
}

/**
 * Write a styleEvent doc then recompute learnedStyleMemory from the full
 * event history (last 200 events), matching the logic in
 * src/lib/auraMemory.ts → recomputeLearnedStyleMemory.
 */
async function writeStyleEventAndRecompute(
  uid: string,
  event: StyleEvent
): Promise<void> {
  const normalized = normalizeStyleEvent(event);
  if (!normalized) {
    logger.warn("styleEventTriggers: normalizeStyleEvent returned null — skipping", { uid, eventType: event.type });
    return;
  }

  // 1. Write the new styleEvent
  await styleEventsCol(uid).add(normalized);

  // 2. Recompute learnedStyleMemory from the full recent history
  const snap = await styleEventsCol(uid)
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  const events = snap.docs
    .map((docSnap) => normalizeStyleEvent(docSnap.data()))
    .filter((e): e is StyleEvent => !!e);

  const learned = computeLearnedStyleMemory(events, Date.now());
  const normalizedLearned = normalizeLearnedStyleMemory(learned);

  await learnedMemoryRef(uid).set(
    { ...normalizedLearned, updatedAt: Date.now() },
    { merge: true }
  );
}

// ---------------------------------------------------------------------------
// Trigger 1: savedLooks — "outfit_saved" (weight 3)
// ---------------------------------------------------------------------------

/**
 * Fires when a new look is saved to users/{uid}/savedLooks/{lookId}.
 *
 * Idempotency: checks savedLookEventWritten on a fresh read before processing,
 * writes the flag after the styleEvent is created.
 *
 * Only processes document creations (before.exists === false) so edits to an
 * existing saved look (e.g. title changes) don't re-fire the signal.
 */
export const onSavedLookStyleEvent = onDocumentWritten(
  "users/{uid}/savedLooks/{lookId}",
  async (event) => {
    const uid    = String(event.params.uid);
    const lookId = String(event.params.lookId);

    // Ignore updates to existing docs — only process new saves
    if (event.data?.before?.exists === true) return;

    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) return;

    // Fresh read — handles retries where the event snapshot may be stale
    const current = await afterSnap.ref.get();
    if (!current.exists) return;
    const data = current.data() ?? {};

    // Idempotency check
    if (data.savedLookEventWritten === true) {
      logger.info("onSavedLookStyleEvent: already processed, skipping", { uid, lookId });
      return;
    }

    try {
      const look = data.look;
      if (!look || typeof look !== "object") {
        logger.warn("onSavedLookStyleEvent: no look object found", { uid, lookId });
        return;
      }

      // Extract closet piece IDs
      const rawPieces = Array.isArray(look.pieces) ? look.pieces : [];
      const closetPieceIds: string[] = rawPieces
        .filter((p: Record<string, unknown>) => p.source === "closet" && typeof p.itemId === "string" && (p.itemId as string).trim())
        .map((p: Record<string, unknown>) => p.itemId as string);

      // Build StyleEventOutfit from piece roles
      const outfit: StyleEventOutfit = {};
      for (const piece of rawPieces as Array<Record<string, unknown>>) {
        if (piece.source !== "closet" || !piece.itemId) continue;
        const id = String(piece.itemId).trim();
        if (piece.role === "top"      && !outfit.top)      outfit.top = id;
        if (piece.role === "outerwear" && !outfit.outerwear) outfit.outerwear = id;
        if (piece.role === "bottom"   && !outfit.bottom)   outfit.bottom = id;
        if (piece.role === "shoes"    && !outfit.footwear) outfit.footwear = id;
        if (piece.role === "accessory") {
          outfit.accessories = [...(outfit.accessories ?? []), id];
        }
      }

      // Formula from piece roles present
      const roles = ["outerwear", "top", "bottom", "shoes", "accessory"]
        .filter((role) => rawPieces.some((p: Record<string, unknown>) => p.role === role));
      const formula = roles.join(" + ");

      // Vibe tokens from the look.vibe string
      const vibeTokens = String(look.vibe ?? "")
        .split(/[,/\s]+/)
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 2);

      const derivedTraits = await deriveTraitsFromItemIds(uid, closetPieceIds, {
        formula,
        vibe: vibeTokens,
      });

      await writeStyleEventAndRecompute(uid, {
        type: "outfit_saved",
        itemIds: closetPieceIds,
        outfit: Object.keys(outfit).length ? outfit : undefined,
        derivedTraits: Object.keys(derivedTraits).length ? derivedTraits : undefined,
        source: "aura",
        createdAt: Date.now(),
      });

      // Mark processed — prevents double-counting on retries
      await afterSnap.ref.set(
        {
          savedLookEventWritten: true,
          savedLookEventWrittenAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("onSavedLookStyleEvent: processed", {
        uid, lookId, itemCount: closetPieceIds.length,
      });
    } catch (error) {
      logger.error("onSavedLookStyleEvent: failed", { uid, lookId, error });
      // Do not rethrow — a failed memory update must never roll back the save
    }
  }
);

// ---------------------------------------------------------------------------
// Trigger 2: outfits — "outfit_worn" (weight 5)
// ---------------------------------------------------------------------------

/**
 * Fires when wornOutfit is written to users/{uid}/outfits/{dateKey}.
 *
 * Idempotency: checks wornEventWritten on a fresh read before processing,
 * writes the flag after the styleEvent is created.
 *
 * Only processes the transition from no-wornOutfit → wornOutfit to avoid
 * re-firing on unrelated updates to the same outfit doc.
 */
export const onWornOutfitStyleEvent = onDocumentWritten(
  "users/{uid}/outfits/{dateKey}",
  async (event) => {
    const uid     = String(event.params.uid);
    const dateKey = String(event.params.dateKey);

    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) return;

    const beforeData = (event.data?.before?.data() ?? {}) as Record<string, unknown>;
    const afterData  = (afterSnap.data() ?? {}) as Record<string, unknown>;

    // Only process when wornOutfit is newly present in this write
    if (beforeData.wornOutfit && typeof beforeData.wornOutfit === "object") return;
    if (!afterData.wornOutfit || typeof afterData.wornOutfit !== "object") return;

    // Fresh read — handles retries and the re-trigger from our own flag write
    const current = await afterSnap.ref.get();
    if (!current.exists) return;
    const data = (current.data() ?? {}) as Record<string, unknown>;

    // Idempotency check
    if (data.wornEventWritten === true) {
      logger.info("onWornOutfitStyleEvent: already processed, skipping", { uid, dateKey });
      return;
    }

    try {
      const wornOutfit = data.wornOutfit as Record<string, unknown>;
      const itemsByCategory = (wornOutfit.itemsByCategory ?? {}) as Record<string, unknown>;

      const outerwear = cleanString(itemsByCategory.outerwear);
      const top       = cleanString(itemsByCategory.top);
      const bottom    = cleanString(itemsByCategory.bottom);
      const shoes     = cleanString(itemsByCategory.shoes);

      const itemIds = [outerwear, top, bottom, shoes].filter(Boolean) as string[];

      const outfit: StyleEventOutfit = {};
      if (outerwear) outfit.outerwear = outerwear;
      if (top)       outfit.top       = top;
      if (bottom)    outfit.bottom    = bottom;
      if (shoes)     outfit.footwear  = shoes;

      const formula = [
        outerwear ? "outerwear" : null,
        top       ? "top"       : null,
        bottom    ? "bottom"    : null,
        shoes     ? "shoes"     : null,
      ].filter(Boolean).join(" + ");

      const derivedTraits = await deriveTraitsFromItemIds(uid, itemIds, { formula });

      const wornAt = typeof wornOutfit.wornAt === "number" ? wornOutfit.wornAt : Date.now();

      await writeStyleEventAndRecompute(uid, {
        type: "outfit_worn",
        itemIds,
        outfit: Object.keys(outfit).length ? outfit : undefined,
        derivedTraits: Object.keys(derivedTraits).length ? derivedTraits : undefined,
        source: "planner",
        createdAt: wornAt,
      });

      // Mark processed — prevents double-counting on retries
      await afterSnap.ref.set(
        {
          wornEventWritten: true,
          wornEventWrittenAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("onWornOutfitStyleEvent: processed", {
        uid, dateKey, itemCount: itemIds.length,
      });
    } catch (error) {
      logger.error("onWornOutfitStyleEvent: failed", { uid, dateKey, error });
      // Do not rethrow — a failed memory update must never roll back the worn write
    }
  }
);
