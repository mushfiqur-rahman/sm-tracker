import { PublishError } from "./types";

/** fetch + JSON with error classification: 401/403 → reconnect, 429/5xx → retry. */
export async function api<T = Record<string, unknown>>(url: string, init: RequestInit & { label: string }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
  } catch (e) {
    throw new PublishError(`${init.label}: network error (${(e as Error).message})`, true);
  }
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const detail = extractError(body) ?? `HTTP ${res.status}`;
    throw new PublishError(
      `${init.label}: ${detail}`,
      res.status === 429 || res.status >= 500,
      res.status === 401,
    );
  }
  return body as T;
}

function extractError(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return typeof body === "string" && body ? body.slice(0, 300) : undefined;
  const b = body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    b.error?.message ?? b.error_description ?? b.detail ?? b.message ?? b.title ??
    (typeof b.error === "string" ? b.error : undefined) ?? b.errors?.[0]?.message
  );
}

export const bearer = (token: string, extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${token}`,
  ...extra,
});

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isVideo(mime: string) {
  return mime.startsWith("video/");
}
