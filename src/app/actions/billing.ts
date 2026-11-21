"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requirePermission } from "@/lib/auth";
import { createCheckoutUrl, createPortalUrl, isBillingConfigured } from "@/lib/billing";
import { PLANS, type PlanId } from "@/lib/plans";
import { getUsage } from "@/lib/usage";

export async function changePlan(formData: FormData) {
  const ctx = await requirePermission("billing.manage");
  const plan = String(formData.get("plan")) as PlanId;
  if (!(plan in PLANS) || plan === ctx.org.plan) redirect("/billing");
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.org.id } });

  if (isBillingConfigured()) {
    // Existing subscribers change/cancel plans in the Stripe customer portal (handles proration).
    if (org.stripeSubscriptionId && org.stripeCustomerId) redirect(await createPortalUrl(org.stripeCustomerId));
    if (plan === "free") redirect("/billing");
    redirect(await createCheckoutUrl(org, plan, ctx.user.email));
  }

  // No Stripe configured (local/dev): switch instantly, but refuse downgrades that break limits.
  const usage = await getUsage(ctx.org);
  const target = PLANS[plan];
  const blockers = [
    usage.seats.used > target.limits.seats && `${usage.seats.used} team members (limit ${target.limits.seats})`,
    usage.accounts.used > target.limits.socialAccounts && `${usage.accounts.used} channels (limit ${target.limits.socialAccounts})`,
    usage.storage.used > target.limits.storageMb * 1024 * 1024 && "media storage",
  ].filter(Boolean);
  if (blockers.length) redirect(`/billing?error=${encodeURIComponent(`Can't move to ${target.name}: you have ${blockers.join(", ")}.`)}`);

  await db.organization.update({ where: { id: org.id }, data: { plan, planStatus: "active" } });
  await audit(ctx, "plan.changed", `${org.plan} → ${plan}`);
  revalidatePath("/", "layout");
  redirect("/billing?status=success");
}

export async function openPortal() {
  const ctx = await requirePermission("billing.manage");
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.org.id } });
  if (!org.stripeCustomerId || !isBillingConfigured()) redirect("/billing");
  redirect(await createPortalUrl(org.stripeCustomerId));
}
