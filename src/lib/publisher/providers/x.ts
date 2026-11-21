import { getObject } from "../../storage";
import { api, bearer, isVideo, sleep } from "../http";
import { PublishError, type Publisher } from "../types";

const X = "https://api.x.com/2";

async function uploadMedia(token: string, m: { storageKey: string; mimeType: string; sizeBytes: number }) {
  const category = isVideo(m.mimeType) ? "tweet_video" : m.mimeType === "image/gif" ? "tweet_gif" : "tweet_image";
  const bytes = await getObject(m.storageKey);
  const init = await api<{ data: { id: string } }>(`${X}/media/upload/initialize`, {
    label: "X media init", method: "POST", headers: bearer(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ media_type: m.mimeType, total_bytes: m.sizeBytes, media_category: category }),
  });
  const id = init.data.id;
  const CHUNK = 4 * 1024 * 1024;
  for (let i = 0, seg = 0; i < bytes.length; i += CHUNK, seg++) {
    const form = new FormData();
    form.set("segment_index", String(seg));
    form.set("media", new Blob([new Uint8Array(bytes.subarray(i, i + CHUNK))]));
    await api(`${X}/media/upload/${id}/append`, { label: "X media append", method: "POST", headers: bearer(token), body: form });
  }
  let fin = await api<{ data: { processing_info?: { state: string; check_after_secs?: number } } }>(
    `${X}/media/upload/${id}/finalize`, { label: "X media finalize", method: "POST", headers: bearer(token) },
  );
  for (let i = 0; i < 60 && fin.data.processing_info && fin.data.processing_info.state !== "succeeded"; i++) {
    if (fin.data.processing_info.state === "failed") throw new PublishError("X: media processing failed");
    await sleep((fin.data.processing_info.check_after_secs ?? 5) * 1000);
    fin = await api(`${X}/media/upload?command=STATUS&media_id=${id}`, { label: "X media status", headers: bearer(token) });
  }
  return id;
}

export const publishX: Publisher = async ({ account, text, media }) => {
  const mediaIds: string[] = [];
  for (const m of media) mediaIds.push(await uploadMedia(account.accessToken, m));
  const r = await api<{ data: { id: string } }>(`${X}/tweets`, {
    label: "X post", method: "POST", headers: bearer(account.accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ text, ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}) }),
  });
  const handle = account.meta.username ?? "i";
  return { externalId: r.data.id, url: `https://x.com/${handle}/status/${r.data.id}` };
};
