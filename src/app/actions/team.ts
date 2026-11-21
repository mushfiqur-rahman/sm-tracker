"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requirePermission, type AppContext } from "@/lib/auth";
import { assignableRoles, isRestrictable, type Role } from "@/lib/roles";
import { randomToken } from "@/lib/crypto";
import { assertSeatQuota, QuotaError } from "@/lib/usage";
import { appUrl } from "@/lib/utils";
import type { FormState } from "./types";

const INVITE_DAYS = 7;

async function validAccountIds(ctx: AppContext, ids: string[]) {
  const rows = await db.socialAccount.findMany({ where: { orgId: ctx.org.id, id: { in: ids } }, select: { id: true } });
  return rows.map((r) => r.id);
}

export async function inviteMember(_: FormState, formData: FormData): Promise<FormState & { link?: string }> {
  const ctx = await requirePermission("team.manage");
  const parsed = z.object({
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    role: z.string(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, role } = parsed.data;
  if (!assignableRoles(ctx.role).includes(role as Role)) return { error: "You can't grant that role." };

  const already = await db.membership.findFirst({ where: { orgId: ctx.org.id, user: { email } } });
  if (already) return { error: `${email} is already in this workspace.` };
  await db.invitation.deleteMany({ where: { orgId: ctx.org.id, email, acceptedAt: null } });

  try {
    await assertSeatQuota(ctx.org);
  } catch (e) {
    if (e instanceof QuotaError) return { error: e.message };
    throw e;
  }

  const accountIds = isRestrictable(role) ? await validAccountIds(ctx, formData.getAll("accounts").map(String)) : [];
  const token = randomToken(24);
  await db.invitation.create({
    data: {
      orgId: ctx.org.id, email, role, token, invitedById: ctx.user.id,
      accountIds: JSON.stringify(accountIds), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    },
  });
  await audit(ctx, "member.invited", `${email} as ${role}`);
  revalidatePath("/team");
  const link = appUrl(`/invite/${token}`);
  return { ok: `Invitation created for ${email}. Share this link with them (valid ${INVITE_DAYS} days):`, link };
}

export async function revokeInvite(formData: FormData) {
  const ctx = await requirePermission("team.manage");
  await db.invitation.deleteMany({ where: { id: String(formData.get("inviteId")), orgId: ctx.org.id, acceptedAt: null } });
  revalidatePath("/team");
}

async function loadMember(ctx: AppContext, membershipId: string) {
  const m = await db.membership.findFirst({ where: { id: membershipId, orgId: ctx.org.id }, include: { user: true } });
  if (!m) throw new Error("Member not found");
  if (m.role === "OWNER") throw new Error("The workspace owner can't be changed here.");
  if (m.userId === ctx.user.id) throw new Error("You can't change your own access.");
  if (ctx.role !== "OWNER" && m.role === "ADMIN") throw new Error("Only the owner can change admins.");
  return m;
}

export async function updateMember(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("team.manage");
  try {
    const m = await loadMember(ctx, String(formData.get("membershipId")));
    const role = String(formData.get("role"));
    if (!assignableRoles(ctx.role).includes(role as Role)) return { error: "You can't grant that role." };
    const ids = isRestrictable(role) ? await validAccountIds(ctx, formData.getAll("accounts").map(String)) : [];
    await db.$transaction([
      db.membership.update({ where: { id: m.id }, data: { role } }),
      db.accountAssignment.deleteMany({ where: { membershipId: m.id } }),
      ...ids.map((socialAccountId) => db.accountAssignment.create({ data: { membershipId: m.id, socialAccountId } })),
    ]);
    await audit(ctx, "member.updated", `${m.user.email}: ${role}, ${ids.length ? `${ids.length} channel(s)` : "all channels"}`);
    revalidatePath("/team");
    return { ok: "Saved." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function removeMember(formData: FormData) {
  const ctx = await requirePermission("team.manage");
  const m = await loadMember(ctx, String(formData.get("membershipId")));
  await db.membership.delete({ where: { id: m.id } });
  await audit(ctx, "member.removed", m.user.email);
  revalidatePath("/team");
}
