// Catalog of supported networks and the rules each one enforces on a post.
// Validation runs in the composer (live feedback) and again on the server before scheduling.

export const PLATFORM_IDS = [
  "facebook",
  "instagram",
  "threads",
  "x",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "bluesky",
  "mastodon",
  "google_business",
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

export type ConnectMethod = "oauth" | "app_password" | "instance_token";

export interface PlatformOptionField {
  key: string;
  label: string;
  type: "text" | "select";
  required?: boolean;
  maxLength?: number;
  choices?: { value: string; label: string }[];
  help?: string;
}

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  short: string; // badge glyph
  color: string; // brand-ish badge colour
  connect: ConnectMethod;
  accountNoun: string; // "Page", "Profile", "Channel"...
  maxChars: number;
  maxImages: number;
  maxVideos: number;
  mixMedia: boolean; // images and video in one post
  requiresMedia: "none" | "any" | "image" | "video";
  maxImageMb: number;
  maxVideoMb: number;
  options?: PlatformOptionField[];
  notes?: string;
}

export const PLATFORMS: Record<PlatformId, PlatformInfo> = {
  facebook: {
    id: "facebook", name: "Facebook", short: "f", color: "#1877F2", connect: "oauth", accountNoun: "Page",
    maxChars: 63_206, maxImages: 10, maxVideos: 1, mixMedia: false, requiresMedia: "none", maxImageMb: 10, maxVideoMb: 1024,
  },
  instagram: {
    id: "instagram", name: "Instagram", short: "IG", color: "#E1306C", connect: "oauth", accountNoun: "Business account",
    maxChars: 2_200, maxImages: 10, maxVideos: 10, mixMedia: true, requiresMedia: "any", maxImageMb: 8, maxVideoMb: 300,
    notes: "Requires an Instagram Business or Creator account. Posts need at least one image or video.",
  },
  threads: {
    id: "threads", name: "Threads", short: "@", color: "#101010", connect: "oauth", accountNoun: "Profile",
    maxChars: 500, maxImages: 10, maxVideos: 10, mixMedia: true, requiresMedia: "none", maxImageMb: 8, maxVideoMb: 1024,
  },
  x: {
    id: "x", name: "X (Twitter)", short: "X", color: "#000000", connect: "oauth", accountNoun: "Profile",
    maxChars: 280, maxImages: 4, maxVideos: 1, mixMedia: false, requiresMedia: "none", maxImageMb: 5, maxVideoMb: 512,
  },
  linkedin: {
    id: "linkedin", name: "LinkedIn", short: "in", color: "#0A66C2", connect: "oauth", accountNoun: "Profile",
    maxChars: 3_000, maxImages: 9, maxVideos: 1, mixMedia: false, requiresMedia: "none", maxImageMb: 10, maxVideoMb: 500,
  },
  tiktok: {
    id: "tiktok", name: "TikTok", short: "TT", color: "#010101", connect: "oauth", accountNoun: "Profile",
    maxChars: 2_200, maxImages: 0, maxVideos: 1, mixMedia: false, requiresMedia: "video", maxImageMb: 0, maxVideoMb: 4096,
    options: [
      {
        key: "privacy", label: "Who can view", type: "select", required: true,
        choices: [
          { value: "PUBLIC_TO_EVERYONE", label: "Everyone" },
          { value: "MUTUAL_FOLLOW_FRIENDS", label: "Friends" },
          { value: "SELF_ONLY", label: "Only me" },
        ],
      },
    ],
  },
  youtube: {
    id: "youtube", name: "YouTube", short: "YT", color: "#FF0000", connect: "oauth", accountNoun: "Channel",
    maxChars: 5_000, maxImages: 0, maxVideos: 1, mixMedia: false, requiresMedia: "video", maxImageMb: 0, maxVideoMb: 10_240,
    options: [
      { key: "title", label: "Video title", type: "text", required: true, maxLength: 100 },
      {
        key: "privacy", label: "Visibility", type: "select", required: true,
        choices: [
          { value: "public", label: "Public" },
          { value: "unlisted", label: "Unlisted" },
          { value: "private", label: "Private" },
        ],
      },
    ],
  },
  pinterest: {
    id: "pinterest", name: "Pinterest", short: "P", color: "#E60023", connect: "oauth", accountNoun: "Profile",
    maxChars: 500, maxImages: 1, maxVideos: 0, mixMedia: false, requiresMedia: "image", maxImageMb: 20, maxVideoMb: 0,
    options: [
      { key: "boardId", label: "Board ID", type: "text", required: true, help: "Find it in the board URL or Pinterest API." },
      { key: "title", label: "Pin title", type: "text", maxLength: 100 },
      { key: "link", label: "Destination link", type: "text" },
    ],
  },
  bluesky: {
    id: "bluesky", name: "Bluesky", short: "B", color: "#0085FF", connect: "app_password", accountNoun: "Profile",
    maxChars: 300, maxImages: 4, maxVideos: 0, mixMedia: false, requiresMedia: "none", maxImageMb: 1, maxVideoMb: 0,
    notes: "Connect with your handle and an App Password (Settings → Privacy and security → App passwords).",
  },
  mastodon: {
    id: "mastodon", name: "Mastodon", short: "M", color: "#6364FF", connect: "instance_token", accountNoun: "Profile",
    maxChars: 500, maxImages: 4, maxVideos: 1, mixMedia: false, requiresMedia: "none", maxImageMb: 16, maxVideoMb: 99,
    notes: "Connect with your instance URL and an access token (Preferences → Development → New application, scope write).",
  },
  google_business: {
    id: "google_business", name: "Google Business Profile", short: "G", color: "#34A853", connect: "oauth", accountNoun: "Location",
    maxChars: 1_500, maxImages: 1, maxVideos: 0, mixMedia: false, requiresMedia: "none", maxImageMb: 5, maxVideoMb: 0,
    options: [{ key: "link", label: "Button link (Learn more)", type: "text" }],
  },
};

export function isPlatformId(v: string): v is PlatformId {
  return (PLATFORM_IDS as readonly string[]).includes(v);
}

export interface MediaLike {
  mimeType: string;
  sizeBytes: number;
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

/** Counts characters the way most networks do (grapheme-ish via code points). */
export function charCount(text: string): number {
  return Array.from(text).length;
}

export function validateForPlatform(
  platform: PlatformId,
  text: string,
  media: MediaLike[],
  options: Record<string, string> = {},
): ValidationIssue[] {
  const p = PLATFORMS[platform];
  const issues: ValidationIssue[] = [];
  const images = media.filter((m) => m.mimeType.startsWith("image/"));
  const videos = media.filter((m) => m.mimeType.startsWith("video/"));
  const len = charCount(text);

  if (len > p.maxChars) issues.push({ level: "error", message: `${p.name}: text is ${len}/${p.maxChars} characters.` });
  if (!text.trim() && media.length === 0) issues.push({ level: "error", message: `${p.name}: add text or media.` });

  if (images.length > p.maxImages)
    issues.push({ level: "error", message: p.maxImages === 0 ? `${p.name} does not accept images.` : `${p.name}: max ${p.maxImages} images.` });
  if (videos.length > p.maxVideos)
    issues.push({ level: "error", message: p.maxVideos === 0 ? `${p.name} does not accept video.` : `${p.name}: max ${p.maxVideos} video(s).` });
  if (!p.mixMedia && images.length > 0 && videos.length > 0)
    issues.push({ level: "error", message: `${p.name}: cannot mix images and video in one post.` });

  if (p.requiresMedia === "any" && media.length === 0) issues.push({ level: "error", message: `${p.name}: at least one image or video is required.` });
  if (p.requiresMedia === "image" && images.length === 0) issues.push({ level: "error", message: `${p.name}: an image is required.` });
  if (p.requiresMedia === "video" && videos.length === 0) issues.push({ level: "error", message: `${p.name}: a video is required.` });

  for (const m of images)
    if (m.sizeBytes > p.maxImageMb * 1024 * 1024)
      issues.push({ level: "error", message: `${p.name}: images must be under ${p.maxImageMb} MB.` });
  for (const m of videos)
    if (m.sizeBytes > p.maxVideoMb * 1024 * 1024)
      issues.push({ level: "error", message: `${p.name}: videos must be under ${p.maxVideoMb} MB.` });

  for (const field of p.options ?? []) {
    const v = (options[field.key] ?? "").trim();
    if (field.required && !v) issues.push({ level: "error", message: `${p.name}: "${field.label}" is required.` });
    if (field.maxLength && charCount(v) > field.maxLength)
      issues.push({ level: "error", message: `${p.name}: "${field.label}" max ${field.maxLength} characters.` });
  }

  if (platform === "instagram") {
    const tags = text.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
    if (tags > 30) issues.push({ level: "error", message: "Instagram: max 30 hashtags." });
  }
  if (platform === "x" && /https?:\/\//.test(text))
    issues.push({ level: "warning", message: "X shortens links to 23 characters; the count shown is approximate." });

  return issues;
}
