import { db } from "../db";
import { decrypt, encrypt } from "../crypto";
import { refreshTokens } from "../oauth";
import { isPlatformId, type PlatformId } from "../platforms";
import { publicMediaUrl } from "../storage";
import { parseJson } from "../utils";
import { publishFacebook, publishInstagram, publishThreads } from "./providers/meta";
import { publishX } from "./providers/x";
import { publishLinkedIn } from "./providers/linkedin";
import { publishGoogleBusiness, publishYouTube } from "./providers/google";
import { publishBluesky, publishMastodon, publishPinterest, publishTikTok } from "./providers/others";
import { PublishError, type Publisher, type PublishResult } from "./types";

const PUBLISHERS: Record<PlatformId, Publisher> = {
  facebook: publishFacebook,
  instagram: publishInstagram,
  threads: publishThreads,
  x: publishX,
  linkedin: publishLinkedIn,
  tiktok: publishTikTok,
  youtube: publishYouTube,
  pinterest: publishPinterest,
  bluesky: publishBluesky,
  mastodon: publishMastodon,
  google_business: publishGoogleBusiness,
};

export const MAX_ATTEMPTS = 4;
/** Backoff after attempt n: 1 min, 5 min, 15 min */
export function retryDelayMs(attempt: number) {
  return [60_000, 300_000, 900_000][attempt - 1] ?? 900_000;
}

/** Stale lock recovery: a target stuck in PUBLISHING (worker crashed) is retried after this. */
const LOCK_TIMEOUT_MS = 15 * 60_000;

async function freshAccessToken(account: {
  id: string; platform: string; accessToken: string; refreshToken: string | null; tokenExpiresAt: Date | null;
}): Promise<string> {
  const token = decrypt(account.accessToken);
  const expiresSoon = account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() < 10 * 60_000;
  if (!expiresSoon) return token;
  const refreshed = await refreshTokens(account.platform as PlatformId, {
    accessToken: token,
    refreshToken: account.refreshToken ? decrypt(account.refreshToken) : undefined,
  }).catch((e: Error) => {
    throw new PublishError(`Token refresh failed: ${e.message}`, false, true);
  });
  if (!refreshed) throw new PublishError("Access token expired — reconnect this account.", false, true);
  await db.socialAccount.update({
    where: { id: account.id },
    data: {
      accessToken: encrypt(refreshed.accessToken),
      refreshToken: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : account.refreshToken,
      tokenExpiresAt: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000) : null,
    },
  });
  return refreshed.accessToken;
}

/** Publishes one target. Assumes the caller has claimed it (status = PUBLISHING). */
export async function publishTarget(targetId: string): Promise<void> {
  const target = await db.postTarget.findUniqueOrThrow({
    where: { id: targetId },
    include: {
      socialAccount: true,
      post: { include: { media: { include: { media: true }, orderBy: { order: "asc" } } } },
    },
  });
  const account = target.socialAccount;
  const attempts = target.attempts + 1;

  try {
    if (account.status !== "ACTIVE") throw new PublishError("Account is disconnected — reconnect it in Social accounts.", false, true);
    if (!isPlatformId(account.platform)) throw new PublishError(`Unsupported platform ${account.platform}`);

    let result: PublishResult;
    if (account.isSandbox) {
      await new Promise((r) => setTimeout(r, 300));
      result = { externalId: `sandbox_${target.id}` };
    } else {
      const accessToken = await freshAccessToken(account);
      result = await PUBLISHERS[account.platform]({
        account: {
          id: account.id, platform: account.platform, externalId: account.externalId, accessToken,
          meta: parseJson<Record<string, string>>(account.meta, {}),
        },
        text: target.contentOverride ?? target.post.content,
        media: target.post.media.map(({ media }) => ({
          url: publicMediaUrl(media.storageKey), storageKey: media.storageKey,
          mimeType: media.mimeType, sizeBytes: media.sizeBytes, fileName: media.fileName,
        })),
        options: parseJson<Record<string, string>>(target.options, {}),
      });
    }

    await db.postTarget.update({
      where: { id: target.id },
      data: { status: "PUBLISHED", externalId: result.externalId, externalUrl: result.url ?? null, error: null, attempts, publishedAt: new Date(), nextAttemptAt: null },
    });
  } catch (e) {
    const err = e instanceof PublishError ? e : new PublishError((e as Error).message ?? "Unknown error", true);
    const retry = err.retryable && attempts < MAX_ATTEMPTS;
    await db.postTarget.update({
      where: { id: target.id },
      data: {
        status: retry ? "PENDING" : "FAILED",
        error: err.message.slice(0, 1000),
        attempts,
        nextAttemptAt: retry ? new Date(Date.now() + retryDelayMs(attempts)) : null,
      },
    });
    if (err.needsReconnect) await db.socialAccount.update({ where: { id: account.id }, data: { status: "NEEDS_RECONNECT" } });
  }

  await refreshPostStatus(target.postId);
}

/** Derives the post's overall status from its targets. */
export async function refreshPostStatus(postId: string) {
  const post = await db.post.findUnique({ where: { id: postId }, include: { targets: { select: { status: true } } } });
  if (!post || !["SCHEDULED", "PUBLISHING", "PARTIAL", "FAILED", "PUBLISHED"].includes(post.status)) return;
  const s = post.targets.map((t) => t.status).filter((x) => x !== "CANCELLED");
  let status = post.status;
  if (s.length === 0) return;
  if (s.some((x) => x === "PENDING" || x === "PUBLISHING")) status = s.some((x) => x !== "PENDING") ? "PUBLISHING" : "SCHEDULED";
  else if (s.every((x) => x === "PUBLISHED")) status = "PUBLISHED";
  else if (s.every((x) => x === "FAILED")) status = "FAILED";
  else status = "PARTIAL";
  await db.post.update({
    where: { id: postId },
    data: { status, publishedAt: status === "PUBLISHED" || status === "PARTIAL" ? (post.publishedAt ?? new Date()) : post.publishedAt },
  });
}

/** Finds due targets, claims each atomically (safe with several workers), and publishes them. */
export async function runDueTargets(limit = 25): Promise<{ processed: number }> {
  const now = new Date();
  await db.postTarget.updateMany({
    where: { status: "PUBLISHING", nextAttemptAt: { lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) } },
    data: { status: "PENDING" },
  });

  const due = await db.postTarget.findMany({
    where: {
      status: "PENDING",
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      post: { status: { in: ["SCHEDULED", "PUBLISHING"] }, scheduledAt: { lte: now } },
    },
    select: { id: true },
    orderBy: { post: { scheduledAt: "asc" } },
    take: limit,
  });

  let processed = 0;
  for (const { id } of due) {
    // Claim: only one worker can flip PENDING → PUBLISHING. nextAttemptAt doubles as the lock timestamp.
    const claimed = await db.postTarget.updateMany({ where: { id, status: "PENDING" }, data: { status: "PUBLISHING", nextAttemptAt: new Date() } });
    if (claimed.count !== 1) continue;
    await publishTarget(id);
    processed++;
  }
  return { processed };
}
