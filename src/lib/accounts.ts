import { db } from "./db";
import { encrypt } from "./crypto";
import type { DiscoveredAccount, TokenSet } from "./oauth";
import type { PlatformId } from "./platforms";
import { getPlan } from "./plans";

/** Insert or refresh connected accounts, respecting the plan's channel limit for new ones. */
export async function upsertAccounts(
  org: { id: string; plan: string },
  userId: string,
  platform: PlatformId,
  tokens: TokenSet,
  found: DiscoveredAccount[],
  opts: { sandbox?: boolean } = {},
) {
  const limit = getPlan(org.plan).limits.socialAccounts;
  let count = await db.socialAccount.count({ where: { orgId: org.id } });
  let added = 0;
  let skipped = 0;
  for (const acc of found) {
    const existing = await db.socialAccount.findUnique({
      where: { orgId_platform_externalId: { orgId: org.id, platform, externalId: acc.externalId } },
    });
    if (!existing && count >= limit) {
      skipped++;
      continue;
    }
    const data = {
      name: acc.name || acc.handle || platform,
      handle: acc.handle ?? null,
      avatarUrl: acc.avatarUrl ?? null,
      accessToken: encrypt(acc.accessToken ?? tokens.accessToken),
      refreshToken: tokens.refreshToken && !acc.accessToken ? encrypt(tokens.refreshToken) : null,
      tokenExpiresAt: tokens.expiresIn && !acc.accessToken ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
      meta: JSON.stringify(acc.meta ?? {}),
      status: "ACTIVE",
      isSandbox: !!opts.sandbox,
    };
    if (existing) await db.socialAccount.update({ where: { id: existing.id }, data });
    else {
      await db.socialAccount.create({ data: { ...data, orgId: org.id, platform, externalId: acc.externalId, connectedById: userId } });
      count++;
      added++;
    }
  }
  await db.auditLog.create({
    data: { orgId: org.id, userId, action: "account.connected", details: `${platform}: ${found.map((f) => f.name).join(", ")}` },
  });
  return { added, updated: found.length - added - skipped, skipped };
}
