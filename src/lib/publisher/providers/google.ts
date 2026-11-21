// YouTube (resumable upload) and Google Business Profile local posts.
import { getObject } from "../../storage";
import { api, bearer } from "../http";
import { PublishError, type Publisher } from "../types";

export const publishYouTube: Publisher = async ({ account, text, media, options }) => {
  const video = media[0];
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: bearer(account.accessToken, {
      "Content-Type": "application/json", "X-Upload-Content-Type": video.mimeType, "X-Upload-Content-Length": String(video.sizeBytes),
    }),
    body: JSON.stringify({
      snippet: { title: options.title || text.slice(0, 100) || "Untitled", description: text },
      status: { privacyStatus: options.privacy || "public", selfDeclaredMadeForKids: false },
    }),
  });
  if (!init.ok) throw new PublishError(`YouTube init: ${(await init.text()).slice(0, 300)}`, init.status >= 500, init.status === 401);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new PublishError("YouTube: no upload URL returned", true);
  const bytes = await getObject(video.storageKey);
  const up = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": video.mimeType }, body: new Uint8Array(bytes) });
  if (!up.ok) throw new PublishError(`YouTube upload failed (HTTP ${up.status})`, up.status >= 500);
  const r = (await up.json()) as { id: string };
  return { externalId: r.id, url: `https://www.youtube.com/watch?v=${r.id}` };
};

export const publishGoogleBusiness: Publisher = async ({ account, text, media, options }) => {
  // externalId = "accounts/{a}/locations/{l}"
  const r = await api<{ name: string; searchUrl?: string }>(`https://mybusiness.googleapis.com/v4/${account.externalId}/localPosts`, {
    label: "Google Business post", method: "POST", headers: bearer(account.accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      languageCode: "en", summary: text, topicType: "STANDARD",
      ...(media[0] ? { media: [{ mediaFormat: "PHOTO", sourceUrl: media[0].url }] } : {}),
      ...(options.link ? { callToAction: { actionType: "LEARN_MORE", url: options.link } } : {}),
    }),
  });
  return { externalId: r.name, url: r.searchUrl };
};
