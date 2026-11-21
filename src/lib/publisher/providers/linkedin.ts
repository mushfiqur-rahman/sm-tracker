import { getObject } from "../../storage";
import { api, bearer, isVideo, sleep } from "../http";
import { PublishError, type Publisher } from "../types";

const LI = "https://api.linkedin.com/rest";
const VERSION = "202510";

const headers = (token: string, json = true) =>
  bearer(token, { "LinkedIn-Version": VERSION, "X-Restli-Protocol-Version": "2.0.0", ...(json ? { "Content-Type": "application/json" } : {}) });

async function uploadAsset(token: string, owner: string, m: { storageKey: string; mimeType: string; sizeBytes: number }) {
  const video = isVideo(m.mimeType);
  const bytes = await getObject(m.storageKey);
  if (!video) {
    const init = await api<{ value: { uploadUrl: string; image: string } }>(`${LI}/images?action=initializeUpload`, {
      label: "LinkedIn image init", method: "POST", headers: headers(token), body: JSON.stringify({ initializeUploadRequest: { owner } }),
    });
    const put = await fetch(init.value.uploadUrl, { method: "PUT", headers: bearer(token), body: new Uint8Array(bytes) });
    if (!put.ok) throw new PublishError(`LinkedIn image upload failed (HTTP ${put.status})`, put.status >= 500);
    return init.value.image;
  }
  const init = await api<{ value: { video: string; uploadToken: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] } }>(
    `${LI}/videos?action=initializeUpload`,
    { label: "LinkedIn video init", method: "POST", headers: headers(token), body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: m.sizeBytes, uploadCaptions: false, uploadThumbnail: false } }) },
  );
  const etags: string[] = [];
  for (const part of init.value.uploadInstructions) {
    const res = await fetch(part.uploadUrl, { method: "PUT", body: new Uint8Array(bytes.subarray(part.firstByte, part.lastByte + 1)) });
    if (!res.ok) throw new PublishError(`LinkedIn video upload failed (HTTP ${res.status})`, res.status >= 500);
    etags.push(res.headers.get("etag") ?? "");
  }
  await api(`${LI}/videos?action=finalizeUpload`, {
    label: "LinkedIn video finalize", method: "POST", headers: headers(token),
    body: JSON.stringify({ finalizeUploadRequest: { video: init.value.video, uploadToken: init.value.uploadToken, uploadedPartIds: etags } }),
  });
  for (let i = 0; i < 60; i++) {
    const s = await api<{ status: string }>(`${LI}/videos/${encodeURIComponent(init.value.video)}`, { label: "LinkedIn video status", headers: headers(token, false) });
    if (s.status === "AVAILABLE") break;
    if (s.status === "PROCESSING_FAILED") throw new PublishError("LinkedIn: video processing failed");
    await sleep(5000);
  }
  return init.value.video;
}

export const publishLinkedIn: Publisher = async ({ account, text, media }) => {
  const token = account.accessToken;
  const author = account.meta.urn ?? `urn:li:person:${account.externalId}`;
  const ids: string[] = [];
  for (const m of media) ids.push(await uploadAsset(token, author, m));

  // LinkedIn "little text" format: escape reserved characters.
  const commentary = text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
  const content =
    ids.length === 0 ? undefined
    : ids.length === 1 ? { media: { id: ids[0] } }
    : { multiImage: { images: ids.map((id) => ({ id })) } };

  const res = await fetch(`${LI}/posts`, {
    method: "POST", headers: headers(token),
    body: JSON.stringify({
      author, commentary, visibility: "PUBLIC", lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false,
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(content ? { content } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new PublishError(`LinkedIn post: ${body.slice(0, 300) || res.status}`, res.status >= 500 || res.status === 429, res.status === 401);
  }
  const id = res.headers.get("x-restli-id") ?? "";
  return { externalId: id, url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined };
};
