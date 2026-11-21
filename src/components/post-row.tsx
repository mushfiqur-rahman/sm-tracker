import Link from "next/link";
import { Copy, ExternalLink, Pencil, RotateCcw, Trash2, CheckCircle2, XCircle, PauseCircle } from "lucide-react";
import { formatInTz } from "@/lib/timezone";
import { approvePost, deletePost, duplicatePost, rejectPost, retryFailed, unschedulePost } from "@/app/actions/posts";
import { PlatformIcon } from "./platform-icon";
import { StatusBadge, POST_STATUS_TONE } from "./ui";
import { cn } from "@/lib/utils";

export interface PostRowData {
  id: string;
  content: string;
  status: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  author: { id: string; name: string };
  media: { media: { storageKey: string; mimeType: string } }[];
  targets: { id: string; status: string; error: string | null; externalUrl: string | null; socialAccount: { platform: string; name: string } }[];
}

const iconBtn = "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-subtle hover:bg-muted hover:text-fg";

export function PostRow({ post, tz, perms, userId }: {
  post: PostRowData; tz: string; userId: string;
  perms: { approve: boolean; editAll: boolean; publish: boolean; create: boolean };
}) {
  const editable = ["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "FAILED"].includes(post.status);
  const mine = post.author.id === userId;
  const canEdit = perms.editAll || (perms.create && mine);
  const thumb = post.media[0]?.media;
  const failed = post.targets.filter((t) => t.status === "FAILED");
  const when = post.publishedAt ?? post.scheduledAt;

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      {thumb ? (
        thumb.mimeType.startsWith("video/") ? (
          <video src={`/media/${thumb.storageKey}`} className="size-16 shrink-0 rounded-lg object-cover" muted />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/media/${thumb.storageKey}`} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
        )
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={post.status} />
          <span className="text-xs text-subtle">
            {when ? `${post.publishedAt ? "Published" : "Scheduled"} ${formatInTz(when, tz)}` : "No date set"} · by {post.author.name}
          </span>
        </div>
        <p translate="no" className="notranslate mt-1.5 line-clamp-2 whitespace-pre-wrap break-words text-sm">{post.content || <em className="text-subtle">No caption</em>}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.targets.map((t) => {
            const tone = POST_STATUS_TONE[t.status];
            const inner = (
              <>
                <PlatformIcon platform={t.socialAccount.platform} size="sm" />
                <span translate="no" className="max-w-28 truncate">{t.socialAccount.name}</span>
                {t.externalUrl && <ExternalLink className="size-3" aria-hidden />}
              </>
            );
            const cls = cn(
              "inline-flex items-center gap-1.5 rounded-full border py-0.5 pe-2 ps-0.5 text-xs",
              tone === "ok" ? "border-ok/30" : tone === "danger" ? "border-danger/40 text-danger" : "border-border",
            );
            return t.externalUrl ? (
              <a key={t.id} href={t.externalUrl} target="_blank" rel="noreferrer" className={cn(cls, "hover:bg-muted")} title={`${t.status} — open post`}>{inner}</a>
            ) : (
              <span key={t.id} className={cls} title={t.error ?? t.status}>{inner}</span>
            );
          })}
        </div>
        {failed.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-danger">
            {failed.map((t) => <li key={t.id}><span className="font-medium">{t.socialAccount.name}:</span> {t.error}</li>)}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1 sm:justify-end">
        {post.status === "PENDING_APPROVAL" && perms.approve && (
          <>
            <form action={approvePost}><input type="hidden" name="postId" value={post.id} />
              <button className={cn(iconBtn, "text-ok")}><CheckCircle2 className="size-3.5" />Approve</button></form>
            <form action={rejectPost}><input type="hidden" name="postId" value={post.id} />
              <button className={iconBtn}><XCircle className="size-3.5" />Send back</button></form>
          </>
        )}
        {(post.status === "FAILED" || post.status === "PARTIAL") && perms.publish && canEdit && (
          <form action={retryFailed}><input type="hidden" name="postId" value={post.id} />
            <button className={iconBtn}><RotateCcw className="size-3.5" />Retry failed</button></form>
        )}
        {editable && canEdit && <Link href={`/compose?post=${post.id}`} className={iconBtn}><Pencil className="size-3.5" />Edit</Link>}
        {post.status === "SCHEDULED" && canEdit && (
          <form action={unschedulePost}><input type="hidden" name="postId" value={post.id} />
            <button className={iconBtn} title="Move back to drafts"><PauseCircle className="size-3.5" />Unschedule</button></form>
        )}
        {perms.create && (
          <form action={duplicatePost}><input type="hidden" name="postId" value={post.id} />
            <button className={iconBtn}><Copy className="size-3.5" />Duplicate</button></form>
        )}
        {canEdit && post.status !== "PUBLISHING" && (
          <form action={deletePost}><input type="hidden" name="postId" value={post.id} />
            <button className={cn(iconBtn, "hover:text-danger")} aria-label="Delete post"><Trash2 className="size-3.5" /></button></form>
        )}
      </div>
    </li>
  );
}

export const postRowInclude = {
  author: { select: { id: true, name: true } },
  media: { include: { media: { select: { storageKey: true, mimeType: true } } }, orderBy: { order: "asc" as const }, take: 1 },
  targets: { include: { socialAccount: { select: { platform: true, name: true } } } },
};
