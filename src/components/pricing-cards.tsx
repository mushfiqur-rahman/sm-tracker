import { Check } from "lucide-react";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";

/** Renders plan cards. `action` returns the button for each plan (link on marketing site, form in-app). */
export function PricingCards({ current, action }: { current?: string; action: (plan: PlanId) => React.ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {PLAN_ORDER.map((id) => {
        const p = PLANS[id];
        return (
          <div key={id} className={cn("flex flex-col rounded-xl border bg-surface p-5", p.highlighted ? "border-brand shadow-sm ring-1 ring-brand/30" : "border-border")}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{p.name}</h3>
              {current === id ? <Badge tone="ok">Current</Badge> : p.highlighted ? <Badge tone="brand">Popular</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-subtle">{p.tagline}</p>
            <p className="mt-4">
              <span className="text-3xl font-semibold tracking-tight">${p.priceMonthly}</span>
              <span className="text-sm text-subtle"> / month</span>
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />{f}</li>
              ))}
            </ul>
            <div className="mt-5">{action(id)}</div>
          </div>
        );
      })}
    </div>
  );
}
