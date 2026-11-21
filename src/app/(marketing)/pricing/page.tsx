import type { Metadata } from "next";
import { PLAN_ORDER, PLANS, formatLimit } from "@/lib/plans";
import { formatBytes } from "@/lib/utils";
import { PricingCards } from "@/components/pricing-cards";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Pricing" };

const ROWS: { label: string; value: (id: (typeof PLAN_ORDER)[number]) => string }[] = [
  { label: "Posts per month", value: (id) => formatLimit(PLANS[id].limits.postsPerMonth) },
  { label: "Team members", value: (id) => formatLimit(PLANS[id].limits.seats) },
  { label: "Social channels", value: (id) => formatLimit(PLANS[id].limits.socialAccounts) },
  { label: "Media storage", value: (id) => formatBytes(PLANS[id].limits.storageMb * 1024 * 1024) },
  { label: "Schedule ahead", value: (id) => `${PLANS[id].limits.scheduleAheadDays} days` },
  { label: "Approval workflow", value: (id) => (PLANS[id].approvalWorkflow ? "✓" : "—") },
];

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-center text-4xl font-semibold tracking-tight">Pricing</h1>
      <p className="mx-auto mb-12 mt-3 max-w-xl text-center text-subtle">
        Start free. Upgrade when your team grows, you post more, or you need more storage. A “post” is one publication to one channel.
      </p>
      <PricingCards action={(id) => <LinkButton href={`/signup?plan=${id}`} className="w-full" variant={id === "growth" ? "primary" : "secondary"}>{id === "free" ? "Start free" : "Choose plan"}</LinkButton>} />

      <div className="mt-16 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-start">
              <th className="px-5 py-3 text-start font-medium text-subtle">Compare plans</th>
              {PLAN_ORDER.map((id) => <th key={id} className="px-5 py-3 text-start font-semibold">{PLANS[id].name}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-b border-border last:border-0">
                <td className="px-5 py-3 text-subtle">{r.label}</td>
                {PLAN_ORDER.map((id) => <td key={id} className="px-5 py-3 tabular-nums">{r.value(id)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-10 text-center"><LinkButton href="/signup" size="lg">Create your workspace</LinkButton></div>
    </section>
  );
}
