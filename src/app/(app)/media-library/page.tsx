import type { Metadata } from "next";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { db } from "@/lib/db";
import { storageUsedBytes } from "@/lib/usage";
import { formatBytes } from "@/lib/utils";
import { deleteMedia } from "@/app/actions/media";
import { UsageMeter } from "@/components/usage-meter";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  const ctx = await requireContext();
  const [items, used] = await Promise.all([
    db.mediaAsset.findMany({ where: { orgId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { posts: true } } } }),
    storageUsedBytes(ctx.org.id),
  ]);
  const manage = can(ctx.role, "posts.create");
  return (
    <>
      <PageHeader title="Media library" description="Images and videos uploaded by your team. Delete unused files to free up storage." />
      <Card className="mb-6 p-5">
        <UsageMeter label="Storage" used={used} limit={ctx.plan.limits.storageMb * 1024 * 1024} format={formatBytes} />
      </Card>
      {items.length === 0 ? (
        <Card><EmptyState icon={<ImageIcon className="size-5" />} title="No media yet" description="Files you upload while creating posts appear here." /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((m) => (
            <Card key={m.id} className="group overflow-hidden">
              <div className="relative aspect-square bg-muted">
                {m.mimeType.startsWith("video/") ? (
                  <video src={`/media/${m.storageKey}`} className="size-full object-cover" muted controls preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${m.storageKey}`} alt={m.fileName} className="size-full object-cover" loading="lazy" />
                )}
                {manage && (
                  <form action={deleteMedia} className="absolute end-2 top-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <input type="hidden" name="mediaId" value={m.id} />
                    <button className="rounded-md bg-black/60 p-1.5 text-white hover:bg-danger" aria-label={`Delete ${m.fileName}`}><Trash2 className="size-4" /></button>
                  </form>
                )}
              </div>
              <div className="p-2.5 text-xs">
                <div className="truncate font-medium" title={m.fileName}>{m.fileName}</div>
                <div className="text-subtle">{formatBytes(m.sizeBytes)} · used in {m._count.posts} post(s)</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
