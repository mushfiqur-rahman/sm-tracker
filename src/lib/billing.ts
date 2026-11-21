import Stripe from "stripe";
import { db } from "./db";
import type { PlanId } from "./plans";
import { appUrl } from "./utils";

let client: Stripe | null = null;

export function stripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export function isBillingConfigured() {
  return stripe() !== null;
}

const PRICE_ENV: Record<Exclude<PlanId, "free">, string> = {
  starter: "STRIPE_PRICE_STARTER",
  growth: "STRIPE_PRICE_GROWTH",
  business: "STRIPE_PRICE_BUSINESS",
};

export function priceIdFor(plan: PlanId): string | undefined {
  return plan === "free" ? undefined : process.env[PRICE_ENV[plan]];
}

export function planForPrice(priceId: string | undefined | null): PlanId | null {
  if (!priceId) return null;
  for (const [plan, env] of Object.entries(PRICE_ENV)) if (process.env[env] === priceId) return plan as PlanId;
  return null;
}

export async function createCheckoutUrl(org: { id: string; name: string; stripeCustomerId: string | null }, plan: PlanId, email: string) {
  const s = stripe()!;
  const price = priceIdFor(plan);
  if (!price) throw new Error(`No Stripe price configured for ${plan}`);
  let customer = org.stripeCustomerId;
  if (!customer) {
    customer = (await s.customers.create({ email, name: org.name, metadata: { orgId: org.id } })).id;
    await db.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customer } });
  }
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: org.id,
    subscription_data: { metadata: { orgId: org.id } },
    allow_promotion_codes: true,
    success_url: appUrl("/billing?status=success"),
    cancel_url: appUrl("/billing?status=cancelled"),
  });
  return session.url!;
}

export async function createPortalUrl(customerId: string) {
  const session = await stripe()!.billingPortal.sessions.create({ customer: customerId, return_url: appUrl("/billing") });
  return session.url;
}

/** Applies a Stripe subscription's state to the workspace. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const orgId = sub.metadata.orgId;
  const where = orgId ? { id: orgId } : { stripeCustomerId: String(sub.customer) };
  const org = await db.organization.findFirst({ where });
  if (!org) return;
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  const item = sub.items.data[0];
  const plan = active ? (planForPrice(item?.price.id) ?? org.plan) : "free";
  await db.organization.update({
    where: { id: org.id },
    data: {
      plan,
      planStatus: sub.status === "past_due" ? "past_due" : active ? "active" : "canceled",
      stripeSubscriptionId: active ? sub.id : null,
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    },
  });
}
