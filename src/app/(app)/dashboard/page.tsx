import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Circle, Clock, Plus, Send, TriangleAlert } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { db } from "@/lib/db";
import { getUsage, monthWindow } from "@/lib/usage";
import { formatInTz } from "@/lib/timezone";
import { formatBytes } from "@/lib/utils";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { UsageMeter } from "@/components/usage-meter";
import { PlatformIcon } from "@/components/platform-icon";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireContext();
  const now = new Date();
  const { start, end } = monthWindow(now, ctx.org.timezone);
  const scope: Prisma.PostWhereInput = { orgId: ctx.org.id, ...(ctx.allowedAccountIds ? { targets: { some: { socialAccountId: { in: ctx.allowedAccountIds } } } } : {}) };

  const [usage, upcoming, scheduledCount, publishedMonth, approvals, failed, accountCount, memberCount, postCount] = await Promise.all([
    getUsage(ctx.org),
    db.post.findMany({
      where: { ...scope, status: { in: ["SCHEDULED", "PENDING_APPROVAL"] }, scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" }, take: 6,
      include: { targets: { include: { socialAccount: { select: { platform: true } } } } },
    }),
    db.post.count({ where: { ...scope, status: "SCHEDULED" } }),
    db.post.count({ where: { ...scope, status: { in: ["PUBLISHED", "PARTIAL"] }, publishedAt: { gte: start, lt: end } } }),
    db.post.count({ where: { ...scope, status: "PENDING_APPROVAL" } }),
    db.post.count({ where: { ...scope, status: { in: ["FAILED", "PARTIAL"] } } }),
    db.socialAccount.count({ where: { orgId: ctx.org.id } }),
    db.membership.count({ where: { orgId: ctx.org.id } }),
    db.post.count({ where: { orgId: ctx.org.id } }),
  ]);

  const stats = [
    { label: "Scheduled", value: scheduledCount, icon: CalendarClock, href: "/posts?tab=upcoming" },
    { label: "Published this month", value: publishedMonth, icon: Send, href: "/posts?tab=published" },
    { label: "Needs approval", value: approvals, icon: Clock, href: "/posts?tab=approval" },
    { label: "Failed", value: failed, icon: TriangleAlert, href: "/posts?tab=failed" },
  ];

  const steps = [
    { done: accountCount > 0, label: "Connect your social accounts", href: "/accounts", show: can(ctx.role, "accounts.manage") },
    { done: postCount > 0, label: "Schedule your first post", href: "/compose", show: can(ctx.role, "posts.create") },
    { done: memberCount > 1, label: "Invite your team", href: "/team", show: can(ctx.role, "team.manage") },
  ].filter((s) => s.show);
  const showOnboarding = steps.some((s) => !s.done);

  return (
    <>
      <PageHeader
        title={`Hello, ${ctx.user.name.split(" ")[0]}`}
        description={<>Here’s what’s happening in <span translate="no">{ctx.org.name}</span></>}
        action={can(ctx.role, "posts.create") && <LinkButton href="/compose"><Plus className="size-4" />Create post</LinkButton>}
      />

      {showOnboarding && (
        <Card className="mb-6 p-5">
          <h2 className="font-semibold">Get set up</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-2.5 rounded-lg border border-border p-3 text-sm hover:bg-muted">
                  {s.done ? <CheckCircle2 className="size-5 text-ok" /> : <Circle className="size-5 text-subtle" />}
                  <span className={s.done ? "text-subtle line-through" : "font-medium"}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="rounded-xl border border-border bg-surface p-4 transition hover:border-brand/40">
            <div className="flex items-center justify-between text-subtle">
              <span className="text-sm">{label}</span>
              <Icon className="size-4" aria-hidden />
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Coming up" action={<Link href="/calendar" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Calendar <ArrowRight className="size-3.5" /></Link>} />
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarClock className="size-5" />} title="No upcoming posts" description="Schedule posts days, weeks or months ahead — they publish automatically." />
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((p) => (
                <li key={p.id}>
                  <Link href={`/compose?post=${p.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/50">
                    <div className="w-24 shrink-0 text-xs text-subtle">{p.scheduledAt && formatInTz(p.scheduledAt, ctx.org.timezone, "d MMM, HH:mm")}</div>
                    <p translate="no" className="notranslate min-w-0 flex-1 truncate text-sm">{p.content || "(media only)"}</p>
                    <div className="hidden shrink-0 -space-x-1 sm:flex">
                      {[...new Set(p.targets.map((t) => t.socialAccount.platform))].slice(0, 5).map((pl) => <PlatformIcon key={pl} platform={pl} size="sm" className="ring-2 ring-surface" />)}
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={`${usage.plan.name} plan`} description="Usage this month" action={can(ctx.role, "billing.manage") && usage.plan.id !== "business" && <Link href="/billing" className="text-sm font-medium text-brand hover:underline">Upgrade</Link>} />
          <div className="space-y-4 p-5">
            <UsageMeter label="Posts" used={usage.posts.used} limit={usage.posts.limit} />
            <UsageMeter label="Social channels" used={usage.accounts.used} limit={usage.accounts.limit} />
            <UsageMeter label="Team members" used={usage.seats.used} limit={usage.seats.limit} />
            <UsageMeter label="Media storage" used={usage.storage.used} limit={usage.storage.limit} format={formatBytes} />
          </div>
        </Card>
      </div>
    </>
  );
}
