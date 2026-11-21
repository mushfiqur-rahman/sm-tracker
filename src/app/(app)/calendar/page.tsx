import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, parse, startOfMonth, startOfWeek } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { db } from "@/lib/db";
import { monthWindow } from "@/lib/usage";
import { localInputToUtc } from "@/lib/timezone";
import { PlatformIcon } from "@/components/platform-icon";
import { Card, LinkButton, PageHeader, POST_STATUS_TONE } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

const chipTone: Record<string, string> = {
  brand: "bg-brand-soft text-brand",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-muted text-subtle",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ctx = await requireContext();
  const tz = ctx.org.timezone;
  const { m } = await searchParams;
  const todayKey = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const monthKey = m && /^\d{4}-\d{2}$/.test(m) ? m : todayKey.slice(0, 7);
  // "Naive" month date used only for grid layout; real instants are computed in the workspace timezone.
  const month = parse(`${monthKey}-01`, "yyyy-MM-dd", new Date());
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });

  const rangeStart = localInputToUtc(format(gridStart, "yyyy-MM-dd'T'00:00"), tz);
  const rangeEnd = localInputToUtc(format(addDays(gridEnd, 1), "yyyy-MM-dd'T'00:00"), tz);
  const scope: Prisma.PostWhereInput = ctx.allowedAccountIds ? { targets: { some: { socialAccountId: { in: ctx.allowedAccountIds } } } } : {};

  const posts = await db.post.findMany({
    where: { orgId: ctx.org.id, ...scope, scheduledAt: { gte: rangeStart, lt: rangeEnd } },
    orderBy: { scheduledAt: "asc" },
    include: { targets: { select: { socialAccount: { select: { platform: true } } } } },
  });

  const byDay = new Map<string, typeof posts>();
  for (const p of posts) {
    const key = formatInTimeZone(p.scheduledAt!, tz, "yyyy-MM-dd");
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const canCreate = can(ctx.role, "posts.create");
  const { label } = monthWindow(new Date(), tz);
  const prev = format(addMonths(month, -1), "yyyy-MM");
  const next = format(addMonths(month, 1), "yyyy-MM");

  return (
    <>
      <PageHeader
        title="Calendar"
        description={<>All times in {tz.replace(/_/g, " ")}. Click a day to schedule a post.</>}
        action={canCreate && <LinkButton href="/compose"><Plus className="size-4" />Create post</LinkButton>}
      />
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-1">
            <Link href={`/calendar?m=${prev}`} className="rounded-lg p-1.5 text-subtle hover:bg-muted hover:text-fg" aria-label="Previous month"><ChevronLeft className="size-5" /></Link>
            <Link href={`/calendar?m=${next}`} className="rounded-lg p-1.5 text-subtle hover:bg-muted hover:text-fg" aria-label="Next month"><ChevronRight className="size-5" /></Link>
            <h2 className="ms-2 text-lg font-semibold">{format(month, "MMMM yyyy")}</h2>
          </div>
          {monthKey !== label && <Link href="/calendar" className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-muted">Today</Link>}
        </div>

        {/* Month grid (tablet & desktop) */}
        <div className="hidden md:block">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-xs font-medium text-subtle">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-2 py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const items = byDay.get(key) ?? [];
              const past = key < todayKey;
              return (
                <div key={key} className={cn("group min-h-28 border-b border-e border-border p-1.5 [&:nth-child(7n)]:border-e-0", !isSameMonth(d, month) && "bg-muted/40")}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs", key === todayKey ? "bg-brand font-semibold text-brand-fg" : isSameMonth(d, month) ? "text-fg" : "text-subtle")}>
                      {format(d, "d")}
                    </span>
                    {canCreate && !past && (
                      <Link href={`/compose?date=${key}`} className="rounded p-0.5 text-subtle opacity-0 transition hover:bg-muted hover:text-brand group-hover:opacity-100 focus:opacity-100" aria-label={`Schedule on ${key}`}>
                        <Plus className="size-3.5" />
                      </Link>
                    )}
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((p) => (
                      <Link key={p.id} href={`/compose?post=${p.id}`} className={cn("flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px]", chipTone[POST_STATUS_TONE[p.status] ?? "neutral"])}>
                        <span className="shrink-0 font-semibold tabular-nums">{formatInTimeZone(p.scheduledAt!, tz, "HH:mm")}</span>
                        <PlatformIcon platform={p.targets[0]?.socialAccount.platform ?? ""} size="sm" className="!size-3.5 !text-[7px]" />
                        <span translate="no" className="truncate">{p.content || "Media post"}</span>
                      </Link>
                    ))}
                    {items.length > 3 && <div className="px-1.5 text-[11px] text-subtle">+{items.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agenda list (phones) */}
        <ul className="divide-y divide-border md:hidden">
          {days.filter((d) => isSameMonth(d, month)).map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            if (!items.length && key !== todayKey) return null;
            return (
              <li key={key} className="px-4 py-3">
                <div className="mb-1.5 flex items-center justify-between text-sm font-medium">
                  <span className={key === todayKey ? "text-brand" : ""}>{format(d, "EEE d MMM")}</span>
                  {canCreate && key >= todayKey && <Link href={`/compose?date=${key}`} className="text-xs text-brand">+ Add</Link>}
                </div>
                {items.length === 0 ? <p className="text-xs text-subtle">Nothing scheduled</p> : items.map((p) => (
                  <Link key={p.id} href={`/compose?post=${p.id}`} className={cn("mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs", chipTone[POST_STATUS_TONE[p.status] ?? "neutral"])}>
                    <span className="font-semibold">{formatInTimeZone(p.scheduledAt!, tz, "HH:mm")}</span>
                    <span translate="no" className="truncate">{p.content || "Media post"}</span>
                  </Link>
                ))}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
