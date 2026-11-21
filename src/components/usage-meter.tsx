import { UNLIMITED } from "@/lib/plans";
import { cn } from "@/lib/utils";

export function UsageMeter({ label, used, limit, format = (n: number) => n.toLocaleString("en-US") }: {
  label: string; used: number; limit: number; format?: (n: number) => string;
}) {
  const unlimited = limit >= UNLIMITED;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warn" : "bg-brand";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-subtle">{label}</span>
        <span className="font-medium tabular-nums">
          {format(used)} <span className="text-subtle">/ {unlimited ? "Unlimited" : format(limit)}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${unlimited ? 2 : pct}%` }} />
      </div>
    </div>
  );
}
