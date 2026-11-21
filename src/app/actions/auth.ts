"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { endSession, getSession, hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { isValidTimezone } from "@/lib/timezone";
import { parseJson } from "@/lib/utils";
import type { FormState } from "./types";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  company: z.string().trim().max(100).optional(),
  timezone: z.string().optional(),
  invite: z.string().optional(),
});

async function acceptInvitation(userId: string, email: string, token: string): Promise<string> {
  const inv = await db.invitation.findUnique({ where: { token }, include: { organization: true } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw new Error("This invitation is invalid or has expired.");
  if (inv.email.toLowerCase() !== email.toLowerCase()) throw new Error(`This invitation was sent to ${inv.email}. Sign in with that email.`);
  const accountIds = parseJson<string[]>(inv.accountIds, []);
  const valid = await db.socialAccount.findMany({ where: { orgId: inv.orgId, id: { in: accountIds } }, select: { id: true } });
  await db.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({ where: { userId_orgId: { userId, orgId: inv.orgId } } });
    if (!existing) {
      await tx.membership.create({
        data: { userId, orgId: inv.orgId, role: inv.role, accounts: { create: valid.map((a) => ({ socialAccountId: a.id })) } },
      });
    }
    await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
    await tx.auditLog.create({ data: { orgId: inv.orgId, userId, action: "member.joined", details: `${email} joined as ${inv.role}` } });
  });
  return inv.orgId;
}

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? ""), company: String(formData.get("company") ?? "") };
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { name, email, password, company, timezone, invite } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists. Sign in instead.", values };
  if (!invite && !company) return { error: "Enter your business name", values };

  const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  let orgId: string;
  if (invite) {
    try {
      orgId = await acceptInvitation(user.id, email, invite);
    } catch (e) {
      await db.user.delete({ where: { id: user.id } });
      return { error: (e as Error).message, values };
    }
  } else {
    const org = await db.organization.create({
      data: {
        name: company!,
        timezone: timezone && isValidTimezone(timezone) ? timezone : "UTC",
        memberships: { create: { userId: user.id, role: "OWNER" } },
        auditLogs: { create: { userId: user.id, action: "workspace.created", details: company! } },
      },
    });
    orgId = org.id;
  }
  await startSession(user.id, orgId);
  redirect("/dashboard");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const invite = String(formData.get("invite") ?? "");
  const user = await db.user.findUnique({ where: { email }, include: { memberships: { take: 1, orderBy: { createdAt: "asc" } } } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "Incorrect email or password.", values: { email } };

  let orgId = user.memberships[0]?.orgId ?? null;
  if (invite) {
    try {
      orgId = await acceptInvitation(user.id, user.email, invite);
    } catch (e) {
      return { error: (e as Error).message, values: { email } };
    }
  }
  await startSession(user.id, orgId);
  redirect(orgId ? "/dashboard" : "/onboarding");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function switchWorkspace(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const orgId = String(formData.get("orgId"));
  const m = await db.membership.findUnique({ where: { userId_orgId: { userId: session.uid, orgId } } });
  if (m) await startSession(session.uid, orgId);
  redirect("/dashboard");
}

export async function createWorkspace(_: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const name = String(formData.get("company") ?? "").trim();
  const tz = String(formData.get("timezone") ?? "UTC");
  if (!name) return { error: "Enter your business name" };
  const org = await db.organization.create({
    data: {
      name, timezone: isValidTimezone(tz) ? tz : "UTC",
      memberships: { create: { userId: session.uid, role: "OWNER" } },
      auditLogs: { create: { userId: session.uid, action: "workspace.created", details: name } },
    },
  });
  await startSession(session.uid, org.id);
  redirect("/dashboard");
}

/** Signed-in user accepting an invite from the invite page. */
export async function acceptInviteAsCurrentUser(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await db.user.findUniqueOrThrow({ where: { id: session.uid } });
  const token = String(formData.get("token"));
  const orgId = await acceptInvitation(user.id, user.email, token);
  await startSession(user.id, orgId);
  redirect("/dashboard");
}
