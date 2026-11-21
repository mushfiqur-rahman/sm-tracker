// Facebook Pages, Instagram (Instagram API with Instagram Login) and Threads.
import { api, isVideo, sleep } from "../http";
import { PublishError, type Publisher } from "../types";

const FB = "https://graph.facebook.com/v23.0";
const IG = "https://graph.instagram.com/v23.0";
const TH = "https://graph.threads.net/v1.0";

export const publishFacebook: Publisher = async ({ account, text, media, options }) => {
  const token = account.accessToken; // page access token
  const page = account.externalId;
  const video = media.find((m) => isVideo(m.mimeType));
  if (video) {
    const r = await api<{ id: string }>(`${FB}/${page}/videos`, {
      label: "Facebook video", method: "POST",
      body: new URLSearchParams({ file_url: video.url, description: text, access_token: token }),
    });
    return { externalId: r.id, url: `https://www.facebook.com/${r.id}` };
  }
  const photoIds: string[] = [];
  for (const m of media) {
    const r = await api<{ id: string }>(`${FB}/${page}/photos`, {
      label: "Facebook photo upload", method: "POST",
      body: new URLSearchParams({ url: m.url, published: "false", access_token: token }),
    });
    photoIds.push(r.id);
  }
  const params = new URLSearchParams({ message: text, access_token: token });
  if (options.link) params.set("link", options.link);
  photoIds.forEach((id, i) => params.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
  const r = await api<{ id: string }>(`${FB}/${page}/feed`, { label: "Facebook post", method: "POST", body: params });
  return { externalId: r.id, url: `https://www.facebook.com/${r.id}` };
};

async function waitForContainer(base: string, id: string, token: string, label: string) {
  for (let i = 0; i < 60; i++) {
    const s = await api<{ status_code?: string; status?: string }>(`${base}/${id}?fields=status_code,status&access_token=${token}`, { label });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new PublishError(`${label}: media processing failed (${s.status ?? s.status_code})`);
    await sleep(5_000);
  }
  throw new PublishError(`${label}: media processing timed out`, true);
}

export const publishInstagram: Publisher = async ({ account, text, media }) => {
  const token = account.accessToken;
  const user = account.externalId;
  const create = (params: Record<string, string>) =>
    api<{ id: string }>(`${IG}/${user}/media`, { label: "Instagram container", method: "POST", body: new URLSearchParams({ ...params, access_token: token }) });
  const mediaParams = (m: (typeof media)[number]): Record<string, string> =>
    isVideo(m.mimeType) ? { media_type: "REELS", video_url: m.url } : { image_url: m.url };

  let containerId: string;
  if (media.length === 1) {
    containerId = (await create({ ...mediaParams(media[0]), caption: text })).id;
  } else {
    const children: string[] = [];
    for (const m of media) {
      const p = mediaParams(m);
      if (p.media_type === "REELS") p.media_type = "VIDEO";
      const c = await create({ ...p, is_carousel_item: "true" });
      children.push(c.id);
    }
    for (const c of children) await waitForContainer(IG, c, token, "Instagram");
    containerId = (await create({ media_type: "CAROUSEL", children: children.join(","), caption: text })).id;
  }
  await waitForContainer(IG, containerId, token, "Instagram");
  const r = await api<{ id: string }>(`${IG}/${user}/media_publish`, {
    label: "Instagram publish", method: "POST", body: new URLSearchParams({ creation_id: containerId, access_token: token }),
  });
  const info = await api<{ permalink?: string }>(`${IG}/${r.id}?fields=permalink&access_token=${token}`, { label: "Instagram" }).catch(() => ({}) as { permalink?: string });
  return { externalId: r.id, url: info.permalink };
};

export const publishThreads: Publisher = async ({ account, text, media }) => {
  const token = account.accessToken;
  const user = account.externalId;
  const create = (params: Record<string, string>) =>
    api<{ id: string }>(`${TH}/${user}/threads`, { label: "Threads container", method: "POST", body: new URLSearchParams({ ...params, access_token: token }) });
  const mediaParams = (m: (typeof media)[number]): Record<string, string> =>
    isVideo(m.mimeType) ? { media_type: "VIDEO", video_url: m.url } : { media_type: "IMAGE", image_url: m.url };

  let containerId: string;
  if (media.length === 0) containerId = (await create({ media_type: "TEXT", text })).id;
  else if (media.length === 1) containerId = (await create({ ...mediaParams(media[0]), text })).id;
  else {
    const children: string[] = [];
    for (const m of media) children.push((await create({ ...mediaParams(m), is_carousel_item: "true" })).id);
    containerId = (await create({ media_type: "CAROUSEL", children: children.join(","), text })).id;
  }
  await waitForContainer(TH, containerId, token, "Threads");
  const r = await api<{ id: string }>(`${TH}/${user}/threads_publish`, {
    label: "Threads publish", method: "POST", body: new URLSearchParams({ creation_id: containerId, access_token: token }),
  });
  return { externalId: r.id, url: account.meta.username ? `https://www.threads.net/@${account.meta.username}` : undefined };
};
