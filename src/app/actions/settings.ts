"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, hashPassword, requireContext, requirePermission, verifyPassword } from "@/lib/auth";
import { isValidTimezone } from "@/lib/timezone";
import type { FormState } from "./types";

export async function updateWorkspace(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("settings.manage");
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "");
  if (!name) return { error: "Name is required." };
  if (!isValidTimezone(timezone)) return { error: "Invalid timezone." };
  await db.organization.update({ where: { id: ctx.org.id }, data: { name: name.slice(0, 100), timezone } });
  await audit(ctx, "workspace.updated", `${name}, ${timezone}`);
  revalidatePath("/", "layout");
  return { ok: "Workspace saved." };
}

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireContext();
  const name = String(formData.get("name") ?? "").trim();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  if (!name) return { error: "Name is required." };
  const data: { name: string; passwordHash?: string } = { name: name.slice(0, 100) };
  if (next) {
    if (next.length < 8) return { error: "New password must be at least 8 characters." };
    const user = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
    if (!(await verifyPassword(current, user.passwordHash))) return { error: "Current password is incorrect." };
    data.passwordHash = await hashPassword(next);
  }
  await db.user.update({ where: { id: ctx.user.id }, data });
  revalidatePath("/", "layout");
  return { ok: next ? "Profile and password updated." : "Profile saved." };
}
