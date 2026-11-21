import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { accountScope, requireContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { db } from "@/lib/db";
import { allTimezones, utcToLocalInput } from "@/lib/timezone";
import { parseJson } from "@/lib/utils";
import type { PlatformId } from "@/lib/platforms";
import { Composer, type ComposerInitial } from "@/components/composer";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Create post" };

const mediaDto = (m: { id: string; fileName: string; mimeType: string; sizeBytes: number; storageKey: string }) => ({
  id: m.id, fileName: m.fileName, mimeType: m.mimeType, sizeBytes: m.sizeBytes, url: `/media/${m.storageKey}`,
});

export default async function ComposePage({ searchParams }: { searchParams: Promise<{ post?: string; date?: string }> }) {
  const ctx = await requireContext();
  const { post: postId, date } = await searchParams;

  if (!can(ctx.role, "posts.create")) {
    return (
      <>
        <PageHeader title="Create post" />
        <Alert tone="warn">Your role is read-only. Ask a workspace admin for Editor or Contributor access.</Alert>
      </>
    );
  }

  const [accounts, recent] = await Promise.all([
    db.socialAccount.findMany({ where: accountScope(ctx), orderBy: [{ platform: "asc" }, { name: "asc" }] }),
    db.mediaAsset.findMany({ where: { orgId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 24 }),
  ]);

  let initial: ComposerInitial = {
    content: "", media: [], targets: {}, timezone: ctx.org.timezone,
    scheduledLocal: date ? `${date}T09:00` : "",
  };

  if (postId) {
    const post = await db.post.findFirst({
      where: { id: postId, orgId: ctx.org.id },
      include: { targets: true, media: { include: { media: true }, orderBy: { order: "asc" } } },
    });
    if (!post) notFound();
    if (!["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "FAILED"].includes(post.status)) {
      return (
        <>
          <PageHeader title="Edit post" />
          <Alert tone="warn">This post has already been published and can no longer be edited. Duplicate it from the Posts page instead.</Alert>
        </>
      );
    }
    initial = {
      postId: post.id,
      content: post.content,
      media: post.media.map((pm) => mediaDto(pm.media)),
      targets: Object.fromEntries(post.targets.map((t) => [t.socialAccountId, { contentOverride: t.contentOverride, options: parseJson(t.options, {}) }])),
      timezone: post.timezone,
      scheduledLocal: post.scheduledAt ? utcToLocalInput(post.scheduledAt, post.timezone) : "",
      status: post.status,
    };
  }

  return (
    <>
      <PageHeader
        title={postId ? "Edit post" : "Create post"}
        description="Write once, tailor per channel, and schedule it for any date — days or months ahead."
      />
      <Composer
        accounts={accounts.map((a) => ({ id: a.id, platform: a.platform as PlatformId, name: a.name, handle: a.handle, avatarUrl: a.avatarUrl, status: a.status }))}
        initial={initial}
        timezones={allTimezones()}
        canPublish={can(ctx.role, "posts.publish")}
        scheduleAheadDays={ctx.plan.limits.scheduleAheadDays}
        recentMedia={recent.map(mediaDto)}
      />
    </>
  );
}
