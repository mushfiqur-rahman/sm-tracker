// Local-disk media storage. Swap for S3/R2 by reimplementing these three functions.
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { appUrl } from "./utils";

const ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.STORAGE_DIR ?? "storage/uploads");

function resolveKey(key: string) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putObject(key: string, data: Buffer) {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function getObject(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function deleteObject(key: string) {
  await unlink(resolveKey(key)).catch(() => undefined);
}

/** Public URL — networks like Instagram, Threads, TikTok and Pinterest fetch media from it, so APP_URL must be publicly reachable in production. */
export function publicMediaUrl(key: string) {
  return appUrl(`/media/${key}`);
}

export const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/quicktime", "video/webm",
];
