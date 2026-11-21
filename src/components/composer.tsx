"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays, addMonths, nextMonday } from "date-fns";
import {
  AlertCircle, CalendarClock, Check, FileText, ImagePlus, Loader2, Send, SlidersHorizontal, Trash2, UploadCloud,
} from "lucide-react";
import { charCount, PLATFORMS, validateForPlatform, type PlatformId } from "@/lib/platforms";
import { cn, formatBytes } from "@/lib/utils";
import { savePost } from "@/app/actions/posts";
import { AccountAvatar, PlatformIcon } from "./platform-icon";
import { Alert, Badge, Button, Card, Input, Label, Select, Textarea } from "./ui";

export interface ComposerAccount {
  id: string;
  platform: PlatformId;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  status: string;
}

export interface ComposerMedia {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

interface TargetState {
  contentOverride: string | null;
  options: Record<string, string>;
}

export interface ComposerInitial {
  postId?: string;
  content: string;
  media: ComposerMedia[];
  targets: Record<string, TargetState>;
  scheduledLocal: string;
  timezone: string;
  status?: string;
}

type Mode = "schedule" | "now" | "draft";

export function Composer({
  accounts, initial, timezones, canPublish, scheduleAheadDays, recentMedia,
}: {
  accounts: ComposerAccount[];
  initial: ComposerInitial;
  timezones: string[];
  canPublish: boolean;
  scheduleAheadDays: number;
  recentMedia: ComposerMedia[];
}) {
  const router = useRouter();
  const [content, setContent] = useState(initial.content);
  const [media, setMedia] = useState<ComposerMedia[]>(initial.media);
  const [targets, setTargets] = useState<Record<string, TargetState>>(initial.targets);
  const [mode, setMode] = useState<Mode>("schedule");
  const [scheduledLocal, setScheduledLocal] = useState(initial.scheduledLocal);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [customizing, setCustomizing] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<string[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = accounts.filter((a) => targets[a.id]);
  const selectedPlatforms = [...new Set(selected.map((a) => a.platform))];

  const issues = useMemo(() => {
    const out: { accountId: string; level: "error" | "warning"; message: string }[] = [];
    for (const a of selected) {
      const t = targets[a.id];
      for (const i of validateForPlatform(a.platform, t.contentOverride ?? content, media, t.options))
        out.push({ accountId: a.id, ...i });
      if (a.status !== "ACTIVE") out.push({ accountId: a.id, level: "error", message: `${a.name} must be reconnected.` });
    }
    return out;
  }, [selected, targets, content, media]);
  const errors = issues.filter((i) => i.level === "error");

  const tightestLimit = selectedPlatforms.length ? Math.min(...selectedPlatforms.map((p) => PLATFORMS[p].maxChars)) : null;
  const len = charCount(content);

  function toggleAccount(id: string) {
    setTargets((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { contentOverride: null, options: defaultOptions(accounts.find((a) => a.id === id)!.platform) };
      return next;
    });
  }

  function updateTarget(id: string, patch: Partial<TargetState>) {
    setTargets((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function upload(files: FileList | File[]) {
    setError(null);
    for (const file of Array.from(files)) {
      const tempId = `${file.name}-${Date.now()}`;
      setUploading((u) => [...u, tempId]);
      try {
        const body = new FormData();
        body.set("file", file);
        const res = await fetch("/api/media", { method: "POST", body });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        setMedia((m) => [...m, json]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading((u) => u.filter((x) => x !== tempId));
      }
    }
  }

  function quickPick(date: Date) {
    // Keep the wall-clock time in the chosen timezone.
    setScheduledLocal(formatInTimeZone(date, timezone, "yyyy-MM-dd") + "T09:00");
    setMode("schedule");
  }

  const scheduledUtc = useMemo(() => {
    if (!scheduledLocal) return null;
    const d = fromZonedTime(scheduledLocal, timezone);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [scheduledLocal, timezone]);
  const browserTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const now = new Date();
  const maxDate = formatInTimeZone(addDays(now, scheduleAheadDays), timezone, "yyyy-MM-dd'T'HH:mm");
  const minDate = formatInTimeZone(now, timezone, "yyyy-MM-dd'T'HH:mm");

  function submit(submitMode: Mode) {
    setError(null);
    setServerIssues([]);
    startTransition(async () => {
      const res = await savePost({
        postId: initial.postId,
        content,
        mediaIds: media.map((m) => m.id),
        targets: selected.map((a) => ({ accountId: a.id, contentOverride: targets[a.id].contentOverride, options: targets[a.id].options })),
        mode: submitMode,
        scheduledLocal: submitMode === "now" ? undefined : scheduledLocal || undefined,
        timezone,
      });
      if (!res.ok) {
        setError(res.error);
        setServerIssues(res.issues ?? []);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(`/posts?saved=${res.status}`);
      router.refresh();
    });
  }

  const primaryLabel =
    mode === "draft" ? "Save draft"
    : !canPublish ? "Submit for approval"
    : mode === "now" ? "Publish now"
    : "Schedule post";

  if (accounts.length === 0) {
    return (
      <Card className="p-10 text-center">
        <h2 className="text-lg font-semibold">Connect a social account first</h2>
        <p className="mt-1 text-sm text-subtle">You need at least one connected channel (or access to one) to create posts.</p>
        <Button className="mt-5" onClick={() => router.push("/accounts")}>Connect accounts</Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        {error && (
          <Alert>
            <p className="font-medium">{error}</p>
            {serverIssues.length > 0 && <ul className="mt-1 list-disc ps-5">{serverIssues.map((i) => <li key={i}>{i}</li>)}</ul>}
          </Alert>
        )}

        {/* 1. Channels */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Post to</h2>
            <button
              type="button"
              className="text-sm font-medium text-brand hover:underline"
              onClick={() => (selected.length === accounts.length ? setTargets({}) : setTargets(Object.fromEntries(accounts.map((a) => [a.id, targets[a.id] ?? { contentOverride: null, options: defaultOptions(a.platform) }]))))}
            >
              {selected.length === accounts.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => {
              const on = !!targets[a.id];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAccount(a.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-2.5 rounded-full border py-1 pe-3.5 ps-1 text-sm transition",
                    on ? "border-brand bg-brand-soft text-fg" : "border-border bg-surface text-subtle hover:border-subtle/50",
                    a.status !== "ACTIVE" && "opacity-60",
                  )}
                >
                  <AccountAvatar platform={a.platform} name={a.name} avatarUrl={a.avatarUrl} />
                  <span className="max-w-40 truncate font-medium" translate="no">{a.name}</span>
                  {on && <Check className="size-4 text-brand" aria-hidden />}
                </button>
              );
            })}
          </div>
        </Card>

        {/* 2. Content */}
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <Label htmlFor="content" className="mb-0">Caption</Label>
            {tightestLimit && (
              <span className={cn("text-xs tabular-nums", len > tightestLimit ? "font-semibold text-danger" : "text-subtle")}>
                {len.toLocaleString()} / {tightestLimit.toLocaleString()}
              </span>
            )}
          </div>
          <Textarea
            id="content"
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What would you like to share?"
            translate="no"
            className="notranslate resize-y text-[15px]"
          />
          {selectedPlatforms.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {selectedPlatforms.map((p) => (
                <span key={p} className={cn("inline-flex items-center gap-1.5 text-xs", len > PLATFORMS[p].maxChars ? "text-danger" : "text-subtle")}>
                  <PlatformIcon platform={p} size="sm" />
                  {Math.max(PLATFORMS[p].maxChars - len, -99999).toLocaleString()} left
                </span>
              ))}
            </div>
          )}

          {/* Media */}
          <div
            className="mt-4 rounded-lg border border-dashed border-border p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
            }}
          >
            <div className="flex flex-wrap gap-3">
              {media.map((m, i) => (
                <div key={m.id} className="group relative size-24 overflow-hidden rounded-lg border border-border bg-muted">
                  {m.mimeType.startsWith("video/") ? (
                    <video src={m.url} className="size-full object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.fileName} className="size-full object-cover" />
                  )}
                  <span className="absolute start-1 top-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setMedia((all) => all.filter((x) => x.id !== m.id))}
                    className="absolute end-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Remove ${m.fileName}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {uploading.map((u) => (
                <div key={u} className="flex size-24 items-center justify-center rounded-lg border border-border bg-muted">
                  <Loader2 className="size-5 animate-spin text-subtle" />
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-border text-xs text-subtle transition hover:border-brand hover:text-brand"
              >
                <UploadCloud className="size-5" />
                Upload
              </button>
              {recentMedia.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowLibrary((s) => !s)}
                  className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-border text-xs text-subtle transition hover:border-brand hover:text-brand"
                >
                  <ImagePlus className="size-5" />
                  Library
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-subtle">Drag & drop or upload images (JPG, PNG, GIF, WebP) and videos (MP4, MOV, WebM).</p>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
              onChange={(e) => {
                if (e.target.files) upload(e.target.files);
                e.target.value = "";
              }}
            />
            {showLibrary && (
              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 sm:grid-cols-6">
                {recentMedia.filter((r) => !media.some((m) => m.id === r.id)).map((r) => (
                  <button key={r.id} type="button" onClick={() => setMedia((m) => [...m, r])} className="aspect-square overflow-hidden rounded-md border border-border hover:ring-2 hover:ring-brand" title={r.fileName}>
                    {r.mimeType.startsWith("video/") ? <video src={r.url} className="size-full object-cover" muted /> : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.url} alt={r.fileName} className="size-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* 3. Per-network customisation */}
        {selected.length > 0 && (
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-subtle" aria-hidden />
              <h2 className="font-semibold">Customize per channel</h2>
              <span className="text-sm text-subtle">optional</span>
            </div>
            <div className="divide-y divide-border rounded-lg border border-border">
              {selected.map((a) => {
                const p = PLATFORMS[a.platform];
                const t = targets[a.id];
                const open = customizing === a.id;
                const needsOptions = (p.options ?? []).some((o) => o.required && !t.options[o.key]);
                const accIssues = issues.filter((i) => i.accountId === a.id && i.level === "error");
                return (
                  <div key={a.id}>
                    <button type="button" onClick={() => setCustomizing(open ? null : a.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-muted/60">
                      <PlatformIcon platform={a.platform} size="sm" />
                      <span className="flex-1 truncate text-sm font-medium" translate="no">{a.name}</span>
                      {t.contentOverride !== null && <Badge tone="brand">Custom text</Badge>}
                      {needsOptions && <Badge tone="warn">Needs details</Badge>}
                      {accIssues.length > 0 ? <AlertCircle className="size-4 text-danger" aria-label="Has issues" /> : <Check className="size-4 text-ok" aria-label="Ready" />}
                    </button>
                    {open && (
                      <div className="space-y-3 bg-muted/40 px-3 pb-4 pt-2">
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <Label className="mb-0">Text for {p.name}</Label>
                            <label className="flex items-center gap-2 text-xs text-subtle">
                              <input
                                type="checkbox"
                                checked={t.contentOverride !== null}
                                onChange={(e) => updateTarget(a.id, { contentOverride: e.target.checked ? content : null })}
                              />
                              Use different text
                            </label>
                          </div>
                          {t.contentOverride !== null && (
                            <>
                              <Textarea rows={4} value={t.contentOverride} translate="no" className="notranslate" onChange={(e) => updateTarget(a.id, { contentOverride: e.target.value })} />
                              <p className={cn("mt-1 text-end text-xs", charCount(t.contentOverride) > p.maxChars ? "text-danger" : "text-subtle")}>
                                {charCount(t.contentOverride)} / {p.maxChars}
                              </p>
                            </>
                          )}
                        </div>
                        {(p.options ?? []).map((o) => (
                          <div key={o.key}>
                            <Label htmlFor={`${a.id}-${o.key}`}>{o.label}{o.required && <span className="text-danger"> *</span>}</Label>
                            {o.type === "select" ? (
                              <Select id={`${a.id}-${o.key}`} value={t.options[o.key] ?? ""} onChange={(e) => updateTarget(a.id, { options: { ...t.options, [o.key]: e.target.value } })}>
                                {o.choices!.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                              </Select>
                            ) : (
                              <Input id={`${a.id}-${o.key}`} maxLength={o.maxLength} value={t.options[o.key] ?? ""} onChange={(e) => updateTarget(a.id, { options: { ...t.options, [o.key]: e.target.value } })} />
                            )}
                            {o.help && <p className="mt-1 text-xs text-subtle">{o.help}</p>}
                          </div>
                        ))}
                        {p.notes && <p className="text-xs text-subtle">{p.notes}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* 4. When */}
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">When to publish</h2>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Publishing option">
            {([
              { v: "schedule", icon: CalendarClock, title: "Schedule", desc: "Pick a date & time" },
              { v: "now", icon: Send, title: "Publish now", desc: "Goes out immediately" },
              { v: "draft", icon: FileText, title: "Save as draft", desc: "Finish later" },
            ] as const).map(({ v, icon: Icon, title, desc }) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={mode === v}
                onClick={() => setMode(v)}
                className={cn("flex items-start gap-3 rounded-lg border p-3 text-start transition", mode === v ? "border-brand bg-brand-soft" : "border-border hover:bg-muted")}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", mode === v ? "text-brand" : "text-subtle")} aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-xs text-subtle">{desc}</span>
                </span>
              </button>
            ))}
          </div>

          {mode !== "now" && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="when">Date & time {mode === "draft" && <span className="font-normal text-subtle">(optional)</span>}</Label>
                  <Input id="when" type="datetime-local" value={scheduledLocal} min={minDate} max={maxDate} onChange={(e) => setScheduledLocal(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="tz">Timezone</Label>
                  <Select id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    {timezones.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Tomorrow 9:00", date: addDays(now, 1) },
                  { label: "Next Monday 9:00", date: nextMonday(now) },
                  { label: "In 1 week", date: addDays(now, 7) },
                  { label: "In 1 month", date: addMonths(now, 1) },
                ].filter((q) => q.date.getTime() - now.getTime() <= scheduleAheadDays * 86_400_000).map((q) => (
                  <button key={q.label} type="button" onClick={() => quickPick(q.date)} className="rounded-full border border-border px-3 py-1 text-xs text-subtle hover:border-brand hover:text-brand">
                    {q.label}
                  </button>
                ))}
              </div>
              {scheduledUtc && (
                <p className="text-sm text-subtle">
                  Publishes <span className="font-medium text-fg">{formatInTimeZone(scheduledUtc, timezone, "EEEE, d MMMM yyyy 'at' HH:mm")}</span> ({timezone.replace(/_/g, " ")})
                  {browserTz !== timezone && <> · {formatInTimeZone(scheduledUtc, browserTz, "d MMM HH:mm")} your time</>}
                </p>
              )}
              <p className="text-xs text-subtle">Your plan lets you schedule up to {scheduleAheadDays} days ahead.</p>
            </div>
          )}
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-bg/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          {!canPublish && mode !== "draft" && <span className="me-auto text-xs text-subtle">An admin or editor will review this post before it goes out.</span>}
          {mode !== "draft" && (
            <Button variant="secondary" type="button" disabled={pending || selected.length === 0} onClick={() => submit("draft")}>Save draft</Button>
          )}
          <Button
            type="button"
            disabled={pending || selected.length === 0 || (mode !== "draft" && errors.length > 0) || (mode === "schedule" && !scheduledLocal) || uploading.length > 0}
            onClick={() => submit(mode)}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {primaryLabel}
          </Button>
        </div>
      </div>

      {/* Preview & checks */}
      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Checks</h2>
          {selected.length === 0 ? (
            <p className="text-sm text-subtle">Select at least one channel.</p>
          ) : issues.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ok"><Check className="size-4" /> Ready for all {selected.length} channel(s)</p>
          ) : (
            <ul className="space-y-2">
              {[...new Map(issues.map((i) => [i.message, i])).values()].map((i) => (
                <li key={i.message} className={cn("flex gap-2 text-sm", i.level === "error" ? "text-danger" : "text-warn")}>
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {i.message}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected.slice(0, 4).map((a) => (
          <PreviewCard key={a.id} account={a} text={targets[a.id].contentOverride ?? content} media={media} />
        ))}
        {selected.length > 4 && <p className="text-center text-xs text-subtle">+{selected.length - 4} more channels</p>}
      </aside>
    </div>
  );
}

function defaultOptions(platform: PlatformId): Record<string, string> {
  const o: Record<string, string> = {};
  for (const f of PLATFORMS[platform].options ?? []) if (f.type === "select" && f.choices) o[f.key] = f.choices[0].value;
  return o;
}

function PreviewCard({ account, text, media }: { account: ComposerAccount; text: string; media: ComposerMedia[] }) {
  const p = PLATFORMS[account.platform];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <AccountAvatar platform={account.platform} name={account.name} avatarUrl={account.avatarUrl} />
        <div className="min-w-0" translate="no">
          <div className="truncate text-sm font-semibold">{account.name}</div>
          <div className="truncate text-xs text-subtle">{account.handle ? `@${account.handle}` : p.name} · now</div>
        </div>
      </div>
      <p translate="no" className="notranslate whitespace-pre-wrap break-words px-4 py-3 text-sm leading-relaxed">
        {text || <span className="text-subtle">Your caption will appear here…</span>}
      </p>
      {media.length > 0 && (
        <div className={cn("grid gap-0.5 bg-muted", media.length > 1 && "grid-cols-2")}>
          {media.slice(0, 4).map((m) =>
            m.mimeType.startsWith("video/") ? (
              <video key={m.id} src={m.url} className="aspect-square w-full object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.url} alt="" className="aspect-square w-full object-cover" />
            ),
          )}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-subtle">
        <span>{p.name} preview</span>
        <span>{formatBytes(media.reduce((s, m) => s + m.sizeBytes, 0))}</span>
      </div>
    </Card>
  );
}
