import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";
import { can, isRestrictable, type Permission, type Role } from "./roles";
import { getPlan, type Plan } from "./plans";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function startSession(uid: string, oid: string | null) {
  const token = await signSession({ uid, oid });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getSession = cache(async () => {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
});

export interface AppContext {
  user: { id: string; name: string; email: string };
  org: { id: string; name: string; timezone: string; plan: string; planStatus: string; currentPeriodEnd: Date | null };
  plan: Plan;
  role: Role;
  membershipId: string;
  /** null = may use every social account in the workspace */
  allowedAccountIds: string[] | null;
  workspaces: { id: string; name: string; role: string }[];
}

/** Resolves the signed-in user + active workspace. Returns null when signed out or without a workspace. */
export const getContext = cache(async (): Promise<AppContext | null> => {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: {
      id: true, name: true, email: true,
      memberships: {
        include: { organization: true, accounts: { select: { socialAccountId: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user || user.memberships.length === 0) return null;

  const membership = user.memberships.find((m) => m.orgId === session.oid) ?? user.memberships[0];
  const org = membership.organization;
  const role = membership.role as Role;
  const assigned = membership.accounts.map((a) => a.socialAccountId);

  return {
    user: { id: user.id, name: user.name, email: user.email },
    org: { id: org.id, name: org.name, timezone: org.timezone, plan: org.plan, planStatus: org.planStatus, currentPeriodEnd: org.currentPeriodEnd },
    plan: getPlan(org.plan),
    role,
    membershipId: membership.id,
    allowedAccountIds: isRestrictable(role) && assigned.length > 0 ? assigned : null,
    workspaces: user.memberships.map((m) => ({ id: m.orgId, name: m.organization.name, role: m.role })),
  };
});

export async function requireContext(): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx) {
    const session = await getSession();
    redirect(session ? "/onboarding" : "/login");
  }
  return ctx;
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

export async function requirePermission(permission: Permission): Promise<AppContext> {
  const ctx = await requireContext();
  if (!can(ctx.role, permission)) throw new ForbiddenError();
  return ctx;
}

/** Prisma filter for the social accounts this member may use. */
export function accountScope(ctx: AppContext) {
  return ctx.allowedAccountIds ? { orgId: ctx.org.id, id: { in: ctx.allowedAccountIds } } : { orgId: ctx.org.id };
}

export async function audit(ctx: Pick<AppContext, "org" | "user">, action: string, details = "") {
  await db.auditLog.create({ data: { orgId: ctx.org.id, userId: ctx.user.id, action, details } });
}
