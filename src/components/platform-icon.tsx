import { PLATFORMS, type PlatformId, isPlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/** Neutral monogram badge in each network's colour (no third-party logos bundled). */
export function PlatformIcon({ platform, size = "md", className }: { platform: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const p = isPlatformId(platform) ? PLATFORMS[platform as PlatformId] : null;
  const dims = { sm: "size-5 text-[9px]", md: "size-7 text-[11px]", lg: "size-10 text-sm" }[size];
  return (
    <span
      translate="no"
      title={p?.name ?? platform}
      className={cn("notranslate inline-flex shrink-0 items-center justify-center rounded-md font-bold text-white ring-1 ring-white/10", dims, className)}
      style={{ backgroundColor: p?.color ?? "#64748b" }}
    >
      {p?.short ?? "?"}
    </span>
  );
}

export function AccountAvatar({ platform, name, avatarUrl }: { platform: string; name: string; avatarUrl?: string | null }) {
  return (
    <span className="relative inline-flex shrink-0">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="size-9 rounded-full object-cover" />
      ) : (
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-subtle">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <PlatformIcon platform={platform} size="sm" className="absolute -bottom-1 -end-1 ring-2 ring-surface" />
    </span>
  );
}
