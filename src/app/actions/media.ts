"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, requirePermission } from "@/lib/auth";
import { deleteObject } from "@/lib/storage";

export async function deleteMedia(formData: FormData) {
  const ctx = await requirePermission("posts.create");
  const asset = await db.mediaAsset.findFirst({
    where: { id: String(formData.get("mediaId")), orgId: ctx.org.id },
    include: { posts: { include: { post: { select: { status: true } } } } },
  });
  if (!asset) return;
  if (asset.posts.some((p) => ["SCHEDULED", "PENDING_APPROVAL", "PUBLISHING"].includes(p.post.status)))
    throw new Error("This file is used by a scheduled post. Remove it from the post first.");
  await db.mediaAsset.delete({ where: { id: asset.id } });
  await deleteObject(asset.storageKey);
  await audit(ctx, "media.deleted", asset.fileName);
  revalidatePath("/media-library");
}
