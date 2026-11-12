import { assertActiveInTransaction } from "./accountLifecycle";
import { createHash } from "node:crypto";

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "./logger";
import { HttpsError } from "firebase-functions/v2/https";

export const RATE_LIMIT_MESSAGE = "Rate limit exceeded. Please wait a moment and try again.";

export type RateLimitRule = {
  key: "minute" | "day";
  max: number;
  windowMs: number;
  ttlMs: number;
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function minuteLimit(max: number): RateLimitRule {
  return { key: "minute", max, windowMs: MINUTE, ttlMs: DAY };
}

export function dayLimit(max: number): RateLimitRule {
  return { key: "day", max, windowMs: DAY, ttlMs: 14 * DAY };
}

export const RATE_LIMITS = {
  itemDeletion: [minuteLimit(60), dayLimit(500)],
  prepareMediaWrite: [minuteLimit(60), dayLimit(2000)],
  auraChat: [minuteLimit(6), dayLimit(40)],
  productLink: [minuteLimit(5), dayLimit(30)],
  imageIngestion: [minuteLimit(3), dayLimit(25)],
  productPolish: [minuteLimit(3), dayLimit(20)],
  outfitExtraction: [minuteLimit(2), dayLimit(15)],
  outfitLayoutReconstruction: [minuteLimit(2), dayLimit(15)],
  accessoryPolish: [minuteLimit(3), dayLimit(20)],
  affiliateLinks: [minuteLimit(30), dayLimit(300)],
  parseOutfitIntent: [minuteLimit(20), dayLimit(200)],
  productSearch: [minuteLimit(3), dayLimit(20)],
  outfitChat: [minuteLimit(10), dayLimit(100)],
  outfitGeneration: [minuteLimit(4), dayLimit(30)],
  wardrobeRetrieval: [minuteLimit(8), dayLimit(60)],
  styleMemoryAi: [minuteLimit(8), dayLimit(60)],
  wardrobeIndexing: [minuteLimit(10), dayLimit(50)],
  wardrobeBackfill: [minuteLimit(1), dayLimit(1)],
  voiceTranscription: [minuteLimit(6), dayLimit(60)],
  appleRevocation: [minuteLimit(2), dayLimit(10)],
  accountDelete: [dayLimit(3)],
} as const;

export function redactUid(uid: string) {
  return createHash("sha256").update(uid).digest("hex").slice(0, 12);
}

export function isRateLimitError(error: unknown): error is HttpsError {
  return error instanceof HttpsError && error.code === "resource-exhausted";
}

export async function assertFunctionRateLimit(
  uid: string,
  endpoint: keyof typeof RATE_LIMITS | string,
  rules: readonly RateLimitRule[],
  now = Date.now(),
) {
  const db = getFirestore();
  const uidHash = redactUid(uid);
  const windows = rules.map((rule) => {
    const bucket = Math.floor(now / rule.windowMs);
    return {
      rule,
      ref: db
        .collection("functionRateLimits")
        .doc(String(endpoint))
        .collection("users")
        .doc(uidHash)
        .collection("windows")
        .doc(`${rule.key}_${bucket}`),
      expiresAt: Timestamp.fromMillis(now + rule.ttlMs),
    };
  });

  await db.runTransaction(async (transaction) => {
    await assertActiveInTransaction(transaction, uid);
    const snapshots = await Promise.all(windows.map((entry) => transaction.get(entry.ref)));
    const blocked = snapshots
      .map((snapshot, index) => ({
        snapshot,
        ...windows[index],
      }))
      .find(({ snapshot, rule }) => Number(snapshot.data()?.count ?? 0) >= rule.max);

    if (blocked) {
      logger.warn("[RATE_LIMIT] request blocked", {
        endpoint,
        uidHash,
        window: blocked.rule.key,
        max: blocked.rule.max,
      });
      throw new HttpsError("resource-exhausted", RATE_LIMIT_MESSAGE, {
        retryAt: Math.max(...snapshots.flatMap((snapshot, index) =>
          Number(snapshot.data()?.count ?? 0) >= windows[index].rule.max
            ? [(Math.floor(now / windows[index].rule.windowMs) + 1) * windows[index].rule.windowMs] : [])),
      });
    }

    snapshots.forEach((snapshot, index) => {
      const entry = windows[index];
      const count = Number(snapshot.data()?.count ?? 0) + 1;
      transaction.set(
        entry.ref,
        {
          count,
          endpoint: String(endpoint),
          window: entry.rule.key,
          updatedAt: Timestamp.fromMillis(now),
          expiresAt: entry.expiresAt,
        },
        { merge: true },
      );
    });
  });
}
