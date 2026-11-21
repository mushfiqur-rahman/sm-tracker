import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, syncSubscription } from "@/lib/billing";

export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ error: "Billing not configured" }, { status: 501 });

  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${(e as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.subscription) await syncSubscription(await s.subscriptions.retrieve(String(session.subscription)));
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
  }
  return NextResponse.json({ received: true });
}
