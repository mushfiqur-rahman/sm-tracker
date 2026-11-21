// TikTok, Pinterest, Bluesky, Mastodon.
import { getObject } from "../../storage";
import { api, bearer } from "../http";
import type { Publisher } from "../types";

export const publishTikTok: Publisher = async ({ account, text, media, options }) => {
  // PULL_FROM_URL requires the media domain to be verified in the TikTok developer portal.
  const r = await api<{ data: { publish_id: string } }>("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    label: "TikTok", method: "POST", headers: bearer(account.accessToken, { "Content-Type": "application/json; charset=UTF-8" }),
    body: JSON.stringify({
      post_info: { title: text.slice(0, 2200), privacy_level: options.privacy || "SELF_ONLY", disable_comment: false },
      source_info: { source: "PULL_FROM_URL", video_url: media[0].url },
    }),
  });
  return { externalId: r.data.publish_id };
};

export const publishPinterest: Publisher = async ({ account, text, media, options }) => {
  const r = await api<{ id: string }>("https://api.pinterest.com/v5/pins", {
    label: "Pinterest", method: "POST", headers: bearer(account.accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      board_id: options.boardId, title: options.title || undefined, description: text, link: options.link || undefined,
      media_source: { source_type: "image_url", url: media[0].url },
    }),
  });
  return { externalId: r.id, url: `https://www.pinterest.com/pin/${r.id}/` };
};

export const publishBluesky: Publisher = async ({ account, text, media }) => {
  const service = account.meta.service || "https://bsky.social";
  // accessToken holds the app password; open a fresh session for each publish.
  const session = await api<{ accessJwt: string; did: string; handle: string }>(`${service}/xrpc/com.atproto.server.createSession`, {
    label: "Bluesky login", method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: account.meta.handle ?? account.externalId, password: account.accessToken }),
  });
  const images = [];
  for (const m of media) {
    const bytes = await getObject(m.storageKey);
    const blob = await api<{ blob: unknown }>(`${service}/xrpc/com.atproto.repo.uploadBlob`, {
      label: "Bluesky upload", method: "POST", headers: bearer(session.accessJwt, { "Content-Type": m.mimeType }), body: new Uint8Array(bytes),
    });
    images.push({ alt: "", image: blob.blob });
  }
  const r = await api<{ uri: string }>(`${service}/xrpc/com.atproto.repo.createRecord`, {
    label: "Bluesky post", method: "POST", headers: bearer(session.accessJwt, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      repo: session.did, collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString(), facets: linkFacets(text),
        ...(images.length ? { embed: { $type: "app.bsky.embed.images", images } } : {}),
      },
    }),
  });
  const rkey = r.uri.split("/").pop();
  return { externalId: r.uri, url: `https://bsky.app/profile/${session.handle}/post/${rkey}` };
};

/** Bluesky needs explicit byte-offset facets for links to be clickable. */
export function linkFacets(text: string) {
  const enc = new TextEncoder();
  const facets = [];
  for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) {
    const byteStart = enc.encode(text.slice(0, m.index)).length;
    facets.push({
      index: { byteStart, byteEnd: byteStart + enc.encode(m[0]).length },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }],
    });
  }
  return facets;
}

export const publishMastodon: Publisher = async ({ account, text, media }) => {
  const instance = account.meta.instance;
  const ids: string[] = [];
  for (const m of media) {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(await getObject(m.storageKey))], { type: m.mimeType }), m.fileName);
    const r = await api<{ id: string }>(`${instance}/api/v2/media`, { label: "Mastodon upload", method: "POST", headers: bearer(account.accessToken), body: form });
    ids.push(r.id);
  }
  const r = await api<{ id: string; url: string }>(`${instance}/api/v1/statuses`, {
    label: "Mastodon post", method: "POST", headers: bearer(account.accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ status: text, media_ids: ids }),
  });
  return { externalId: r.id, url: r.url };
};
