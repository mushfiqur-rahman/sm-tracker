import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { db } from "@/lib/db";
import { Alert, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { PostRow, postRowInclude } from "@/components/post-row";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Posts" };

const TABS = [
  { key: "upcoming", label: "Scheduled", where: { status: { in: ["SCHEDULED", "PUBLISHING"] } } },
  { key: "approval", label: "Needs approval", where: { status: "PENDING_APPROVAL" } },
  { key: "drafts", label: "Drafts", where: { status: "DRAFT" } },
  { key: "published", label: "Published", where: { status: { in: ["PUBLISHED", "PARTIAL"] } } },
  { key: "failed", label: "Failed", where: { status: { in: ["FAILED", "PARTIAL"] } } },
  { key: "all", label: "All", where: {} },
] as const;

const SAVED: Record<string, string> = {
  SCHEDULED: "Post scheduled. It will publish automatically at the chosen time.",
  PENDING_APPROVAL: "Submitted for approval. An admin or editor will review it.",
  DRAFT: "Draft saved.",
};

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ tab?: string; saved?: string }> }) {
  const ctx = await requireContext();
  const { tab: tabKey, saved } = await searchParams;
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[0];

  const scope: Prisma.PostWhereInput = ctx.allowedAccountIds
    ? { targets: { some: { socialAccountId: { in: ctx.allowedAccountIds } } } }
    : {};
  const base: Prisma.PostWhereInput = { orgId: ctx.org.id, ...scope };

  const [posts, counts] = await Promise.all([
    db.post.findMany({
      where: { ...base, ...(tab.where as Prisma.PostWhereInput) },
      include: postRowInclude,
      orderBy: tab.key === "upcoming" ? { scheduledAt: "asc" } : { updatedAt: "desc" },
      take: 100,
    }),
    Promise.all(TABS.map((t) => db.post.count({ where: { ...base, ...(t.where as Prisma.PostWhereInput) } }))),
  ]);

  const perms = {
    approve: can(ctx.role, "posts.approve"), editAll: can(ctx.role, "posts.editAll"),
    publish: can(ctx.role, "posts.publish"), create: can(ctx.role, "posts.create"),
  };

  return (
    <>
      <PageHeader
        title="Posts"
        description="Everything scheduled, waiting for approval, published or failed."
        action={perms.create && <LinkButton href="/compose"><Plus className="size-4" />Create post</LinkButton>}
      />
      {saved && SAVED[saved] && <div className="mb-4"><Alert tone="ok">{SAVED[saved]}</Alert></div>}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map((t, i) => (
          <Link
            key={t.key}
            href={`/posts?tab=${t.key}`}
            role="tab"
            aria-selected={t.key === tab.key}
            className={cn(
              "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              t.key === tab.key ? "border-brand text-fg" : "border-transparent text-subtle hover:text-fg",
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-xs", t.key === "approval" && counts[i] > 0 ? "bg-warn-soft text-warn" : "bg-muted text-subtle")}>{counts[i]}</span>
          </Link>
        ))}
      </div>
      <Card>
        {posts.length === 0 ? (
          <EmptyState icon={<ListChecks className="size-5" />} title="Nothing here yet" description="Posts you create will show up here." action={perms.create && <LinkButton href="/compose">Create a post</LinkButton>} />
        ) : (
          <ul className="divide-y divide-border">
            {posts.map((p) => <PostRow key={p.id} post={p} tz={ctx.org.timezone} perms={perms} userId={ctx.user.id} />)}
          </ul>
        )}
      </Card>
    </>
  );
}
