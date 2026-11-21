import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { db } from "./db";
import { getPlan, UNLIMITED } from "./plans";

/** Calendar month [start, end) containing `date`, in the workspace timezone. */
export function monthWindow(date: Date, tz: string) {
  const ym = formatInTimeZone(date, tz, "yyyy-MM");
  const [y, m] = ym.split("-").map(Number);
  const start = fromZonedTime(`${ym}-01T00:00:00`, tz);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const end = fromZonedTime(`${next}-01T00:00:00`, tz);
  return { start, end, label: ym };
}

const COUNTED_TARGET_STATUSES = ["PENDING", "PUBLISHING", "PUBLISHED"];

/** Posts are metered per channel: 1 post sent to 3 channels uses 3 of the monthly quota. */
export async function postsInMonth(orgId: string, tz: string, date: Date, excludePostId?: string) {
  const { start, end } = monthWindow(date, tz);
  return db.postTarget.count({
    where: {
      status: { in: COUNTED_TARGET_STATUSES },
      post: {
        orgId,
        status: { notIn: ["DRAFT"] },
        scheduledAt: { gte: start, lt: end },
        ...(excludePostId ? { id: { not: excludePostId } } : {}),
      },
    },
  });
}

export async function storageUsedBytes(orgId: string) {
  const agg = await db.mediaAsset.aggregate({ where: { orgId }, _sum: { sizeBytes: true } });
  return agg._sum.sizeBytes ?? 0;
}

export async function seatsUsed(orgId: string) {
  const [members, invites] = await Promise.all([
    db.membership.count({ where: { orgId } }),
    db.invitation.count({ where: { orgId, acceptedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  return members + invites;
}

export async function getUsage(org: { id: string; plan: string; timezone: string }) {
  const plan = getPlan(org.plan);
  const [posts, storage, seats, accounts] = await Promise.all([
    postsInMonth(org.id, org.timezone, new Date()),
    storageUsedBytes(org.id),
    seatsUsed(org.id),
    db.socialAccount.count({ where: { orgId: org.id } }),
  ]);
  return {
    plan,
    posts: { used: posts, limit: plan.limits.postsPerMonth },
    storage: { used: storage, limit: plan.limits.storageMb * 1024 * 1024 },
    seats: { used: seats, limit: plan.limits.seats },
    accounts: { used: accounts, limit: plan.limits.socialAccounts },
  };
}

export type Usage = Awaited<ReturnType<typeof getUsage>>;

export class QuotaError extends Error {}

export async function assertPostQuota(
  org: { id: string; plan: string; timezone: string },
  scheduledAt: Date,
  channels: number,
  excludePostId?: string,
) {
  const plan = getPlan(org.plan);
  const maxAhead = plan.limits.scheduleAheadDays * 86_400_000;
  if (scheduledAt.getTime() - Date.now() > maxAhead)
    throw new QuotaError(`Your ${plan.name} plan can schedule up to ${plan.limits.scheduleAheadDays} days ahead. Upgrade to plan further out.`);
  if (plan.limits.postsPerMonth >= UNLIMITED) return;
  const used = await postsInMonth(org.id, org.timezone, scheduledAt, excludePostId);
  if (used + channels > plan.limits.postsPerMonth) {
    const { label } = monthWindow(scheduledAt, org.timezone);
    throw new QuotaError(
      `This would exceed your ${plan.limits.postsPerMonth} posts for ${label} (${used} used, ${channels} needed). Upgrade your plan for more.`,
    );
  }
}

export async function assertStorageQuota(org: { id: string; plan: string }, addBytes: number) {
  const plan = getPlan(org.plan);
  const used = await storageUsedBytes(org.id);
  if (used + addBytes > plan.limits.storageMb * 1024 * 1024)
    throw new QuotaError(`Media storage limit reached (${plan.limits.storageMb.toLocaleString()} MB on ${plan.name}). Delete media or upgrade.`);
}

export async function assertSeatQuota(org: { id: string; plan: string }) {
  const plan = getPlan(org.plan);
  if ((await seatsUsed(org.id)) >= plan.limits.seats)
    throw new QuotaError(`Your ${plan.name} plan includes ${plan.limits.seats} team member(s). Upgrade to invite more.`);
}

export async function assertAccountQuota(org: { id: string; plan: string }, adding = 1) {
  const plan = getPlan(org.plan);
  const count = await db.socialAccount.count({ where: { orgId: org.id } });
  if (count + adding > plan.limits.socialAccounts)
    throw new QuotaError(`Your ${plan.name} plan allows ${plan.limits.socialAccounts} social channels. Upgrade to connect more.`);
}
