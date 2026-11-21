"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { accountScope, audit, ForbiddenError, requireContext, type AppContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { isPlatformId, PLATFORMS, validateForPlatform } from "@/lib/platforms";
import { isValidTimezone, localInputToUtc } from "@/lib/timezone";
import { assertPostQuota, QuotaError } from "@/lib/usage";
import { runDueTargets, refreshPostStatus } from "@/lib/publisher";

const targetSchema = z.object({
  accountId: z.string().min(1),
  contentOverride: z.string().max(70_000).nullable().optional(),
  options: z.record(z.string(), z.string()).default({}),
});

const postSchema = z.object({
  postId: z.string().optional(),
  content: z.string().max(70_000),
  mediaIds: z.array(z.string()).max(20),
  targets: z.array(targetSchema).min(1, "Pick at least one social account."),
  mode: z.enum(["draft", "schedule", "now"]),
  scheduledLocal: z.string().optional(),
  timezone: z.string(),
});

export type SavePostInput = z.input<typeof postSchema>;
export type SavePostResult = { ok: true; postId: string; status: string } | { ok: false; error: string; issues?: string[] };

const EDITABLE = ["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "FAILED"];

function canEditPost(ctx: AppContext, post: { authorId: string }) {
  return can(ctx.role, "posts.editAll") || (can(ctx.role, "posts.create") && post.authorId === ctx.user.id);
}

export async function savePost(raw: SavePostInput): Promise<SavePostResult> {
  const ctx = await requireContext();
  if (!can(ctx.role, "posts.create")) return { ok: false, error: "Your role can't create posts." };
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const input = parsed.data;
  if (!isValidTimezone(input.timezone)) return { ok: false, error: "Invalid timezone." };

  const existing = input.postId
    ? await db.post.findFirst({ where: { id: input.postId, orgId: ctx.org.id } })
    : null;
  if (input.postId) {
    if (!existing) return { ok: false, error: "Post not found." };
    if (!canEditPost(ctx, existing)) return { ok: false, error: "You can only edit your own posts." };
    if (!EDITABLE.includes(existing.status)) return { ok: false, error: "This post is already publishing or published and can't be edited." };
  }

  const accountIds = [...new Set(input.targets.map((t) => t.accountId))];
  const accounts = await db.socialAccount.findMany({ where: { ...accountScope(ctx), id: { in: accountIds } } });
  if (accounts.length !== accountIds.length) return { ok: false, error: "One or more selected accounts are not available to you." };
  const media = await db.mediaAsset.findMany({ where: { orgId: ctx.org.id, id: { in: input.mediaIds } } });
  if (media.length !== new Set(input.mediaIds).size) return { ok: false, error: "Some media files were not found." };
  const orderedMedia = input.mediaIds.map((id) => media.find((m) => m.id === id)!);

  // Per-network validation (skipped for drafts so people can save work in progress).
  if (input.mode !== "draft") {
    const issues: string[] = [];
    for (const t of input.targets) {
      const acc = accounts.find((a) => a.id === t.accountId)!;
      if (acc.status !== "ACTIVE") issues.push(`${acc.name} (${PLATFORMS[acc.platform as keyof typeof PLATFORMS]?.name}) needs to be reconnected.`);
      if (!isPlatformId(acc.platform)) continue;
      const text = t.contentOverride ?? input.content;
      for (const i of validateForPlatform(acc.platform, text, orderedMedia, t.options)) if (i.level === "error") issues.push(i.message);
    }
    if (issues.length) return { ok: false, error: "Fix these issues before scheduling.", issues: [...new Set(issues)] };
  }

  let scheduledAt: Date | null = null;
  if (input.mode === "now") scheduledAt = new Date();
  else if (input.scheduledLocal) {
    try {
      scheduledAt = localInputToUtc(input.scheduledLocal, input.timezone);
    } catch {
      return { ok: false, error: "Invalid date or time." };
    }
  }
  if (input.mode === "schedule") {
    if (!scheduledAt) return { ok: false, error: "Choose a date and time." };
    if (scheduledAt.getTime() < Date.now() - 60_000) return { ok: false, error: "The scheduled time is in the past." };
  }
  if (input.mode !== "draft") {
    try {
      await assertPostQuota(ctx.org, scheduledAt!, input.targets.length, existing?.id);
    } catch (e) {
      if (e instanceof QuotaError) return { ok: false, error: e.message };
      throw e;
    }
  }

  const needsApproval = input.mode !== "draft" && !can(ctx.role, "posts.publish");
  const status = input.mode === "draft" ? "DRAFT" : needsApproval ? "PENDING_APPROVAL" : "SCHEDULED";

  const data = {
    content: input.content,
    status,
    scheduledAt,
    timezone: input.timezone,
    approvedById: status === "SCHEDULED" ? ctx.user.id : null,
  };
  const targetRows = input.targets.map((t) => ({
    socialAccountId: t.accountId,
    contentOverride: t.contentOverride?.trim() ? t.contentOverride : null,
    options: JSON.stringify(t.options ?? {}),
  }));
  const mediaRows = input.mediaIds.map((mediaId, order) => ({ mediaId, order }));

  const post = await db.$transaction(async (tx) => {
    if (existing) {
      await tx.postTarget.deleteMany({ where: { postId: existing.id } });
      await tx.postMedia.deleteMany({ where: { postId: existing.id } });
      return tx.post.update({
        where: { id: existing.id },
        data: { ...data, targets: { create: targetRows }, media: { create: mediaRows } },
      });
    }
    return tx.post.create({
      data: { ...data, orgId: ctx.org.id, authorId: ctx.user.id, targets: { create: targetRows }, media: { create: mediaRows } },
    });
  });

  await audit(ctx, existing ? "post.updated" : "post.created", `${status} · ${input.targets.length} channel(s)`);
  if (input.mode === "now" && status === "SCHEDULED") after(() => runDueTargets().then(() => undefined));
  revalidatePath("/", "layout");
  return { ok: true, postId: post.id, status };
}

async function loadOwnedPost(postId: string) {
  const ctx = await requireContext();
  const post = await db.post.findFirst({ where: { id: postId, orgId: ctx.org.id }, include: { targets: true } });
  if (!post) throw new Error("Post not found");
  return { ctx, post };
}

export async function deletePost(formData: FormData) {
  const { ctx, post } = await loadOwnedPost(String(formData.get("postId")));
  if (!canEditPost(ctx, post)) throw new ForbiddenError();
  if (post.status === "PUBLISHING") throw new Error("Wait until publishing finishes.");
  await db.post.delete({ where: { id: post.id } });
  await audit(ctx, "post.deleted", post.content.slice(0, 80));
  revalidatePath("/", "layout");
}

export async function approvePost(formData: FormData) {
  const { ctx, post } = await loadOwnedPost(String(formData.get("postId")));
  if (!can(ctx.role, "posts.approve")) throw new ForbiddenError();
  if (post.status !== "PENDING_APPROVAL") return;
  const scheduledAt = !post.scheduledAt || post.scheduledAt < new Date() ? new Date() : post.scheduledAt;
  await db.post.update({ where: { id: post.id }, data: { status: "SCHEDULED", approvedById: ctx.user.id, scheduledAt } });
  await audit(ctx, "post.approved", post.id);
  if (scheduledAt.getTime() <= Date.now()) after(() => runDueTargets().then(() => undefined));
  revalidatePath("/", "layout");
}

export async function rejectPost(formData: FormData) {
  const { ctx, post } = await loadOwnedPost(String(formData.get("postId")));
  if (!can(ctx.role, "posts.approve")) throw new ForbiddenError();
  await db.post.update({ where: { id: post.id }, data: { status: "DRAFT" } });
  await audit(ctx, "post.rejected", post.id);
  revalidatePath("/", "layout");
}

export async function unschedulePost(formData: FormData) {
  const { ctx, post } = await loadOwnedPost(String(formData.get("postId")));
  if (!canEditPost(ctx, post) || !["SCHEDULED", "PENDING_APPROVAL"].includes(post.status)) throw new ForbiddenError();
  await db.post.update({ where: { id: post.id }, data: { status: "DRAFT" } });
  revalidatePath("/", "layout");
}

export async function retryFailed(formData: FormData) {
  const { ctx, post } = await loadOwnedPost(String(formData.get("postId")));
  if (!can(ctx.role, "posts.publish") || !canEditPost(ctx, post)) throw new ForbiddenError();
  await db.postTarget.updateMany({ where: { postId: post.id, status: "FAILED" }, data: { status: "PENDING", attempts: 0, error: null, nextAttemptAt: null } });
  await db.post.update({ where: { id: post.id }, data: { status: "SCHEDULED", scheduledAt: post.scheduledAt && post.scheduledAt > new Date() ? post.scheduledAt : new Date() } });
  await refreshPostStatus(post.id);
  after(() => runDueTargets().then(() => undefined));
  revalidatePath("/", "layout");
}

export async function duplicatePost(formData: FormData) {
  const { ctx, post } = await loadOwnedPost(String(formData.get("postId")));
  if (!can(ctx.role, "posts.create")) throw new ForbiddenError();
  const full = await db.post.findUniqueOrThrow({ where: { id: post.id }, include: { media: true, targets: true } });
  const copy = await db.post.create({
    data: {
      orgId: ctx.org.id, authorId: ctx.user.id, content: full.content, status: "DRAFT", timezone: full.timezone,
      media: { create: full.media.map((m) => ({ mediaId: m.mediaId, order: m.order })) },
      targets: { create: full.targets.map((t) => ({ socialAccountId: t.socialAccountId, contentOverride: t.contentOverride, options: t.options })) },
    },
  });
  const { redirect } = await import("next/navigation");
  redirect(`/compose?post=${copy.id}`);
}
