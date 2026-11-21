import type { Metadata } from "next";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getUsage, monthWindow } from "@/lib/usage";
import { isBillingConfigured } from "@/lib/billing";
import { PLAN_ORDER } from "@/lib/plans";
import { formatInTz } from "@/lib/timezone";
import { formatBytes } from "@/lib/utils";
import { changePlan, openPortal } from "@/app/actions/billing";
import { PricingCards } from "@/components/pricing-cards";
import { UsageMeter } from "@/components/usage-meter";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Button, Card, CardHeader, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Plan & usage" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const ctx = await requireContext();
  const { status, error } = await searchParams;
  const usage = await getUsage(ctx.org);
  const manage = can(ctx.role, "billing.manage");
  const stripe = isBillingConfigured();
  const { label } = monthWindow(new Date(), ctx.org.timezone);
  const currentIdx = PLAN_ORDER.indexOf(usage.plan.id);

  return (
    <>
      <PageHeader title="Plan & usage" description="Pricing is based on posts per month, team members, social channels and media storage." />
      <div className="mb-6 space-y-3">
        {status === "success" && <Alert tone="ok">Your plan has been updated.</Alert>}
        {status === "cancelled" && <Alert tone="warn">Checkout was cancelled. Nothing changed.</Alert>}
        {error && <Alert>{error}</Alert>}
        {ctx.org.planStatus === "past_due" && <Alert>Your last payment failed. Update your payment method to avoid losing access.</Alert>}
        {!stripe && manage && <Alert tone="neutral">Stripe isn’t configured on this server, so plan changes apply instantly (development mode).</Alert>}
      </div>

      <Card className="mb-8">
        <CardHeader
          title={`${usage.plan.name} plan`}
          description={<>Usage for {label}{ctx.org.currentPeriodEnd && <> · renews {formatInTz(ctx.org.currentPeriodEnd, ctx.org.timezone, "d MMM yyyy")}</>}</>}
          action={manage && stripe && ctx.org.plan !== "free" && (
            <form action={openPortal}><Button variant="secondary" size="sm">Manage billing</Button></form>
          )}
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <UsageMeter label="Posts this month (1 per channel)" used={usage.posts.used} limit={usage.posts.limit} />
          <UsageMeter label="Social channels" used={usage.accounts.used} limit={usage.accounts.limit} />
          <UsageMeter label="Team members" used={usage.seats.used} limit={usage.seats.limit} />
          <UsageMeter label="Media storage" used={usage.storage.used} limit={usage.storage.limit} format={formatBytes} />
        </div>
      </Card>

      <h2 className="mb-4 text-lg font-semibold">Plans</h2>
      <PricingCards
        current={usage.plan.id}
        action={(id) =>
          id === usage.plan.id ? (
            <Button variant="secondary" className="w-full" disabled>Current plan</Button>
          ) : manage ? (
            <form action={changePlan}>
              <input type="hidden" name="plan" value={id} />
              <SubmitButton className="w-full" variant={PLAN_ORDER.indexOf(id) > currentIdx ? "primary" : "secondary"}>
                {PLAN_ORDER.indexOf(id) > currentIdx ? "Upgrade" : "Downgrade"}
              </SubmitButton>
            </form>
          ) : (
            <p className="text-center text-xs text-subtle">Only the owner can change plans.</p>
          )
        }
      />
    </>
  );
}
