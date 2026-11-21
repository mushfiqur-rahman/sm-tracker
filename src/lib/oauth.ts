// OAuth 2.0 connection flows for every network that uses OAuth.
// Register `${APP_URL}/api/social/callback/{platform}` as the redirect URI in each developer portal.
import { createHash } from "node:crypto";
import { api, bearer } from "./publisher/http";
import type { PlatformId } from "./platforms";
import { appUrl } from "./utils";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // seconds
}

export interface DiscoveredAccount {
  externalId: string;
  name: string;
  handle?: string;
  avatarUrl?: string;
  /** Overrides the user token (e.g. Facebook Page tokens). */
  accessToken?: string;
  meta?: Record<string, string>;
}

interface ProviderConfig {
  env: string; // FACEBOOK → FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  scopeSeparator?: string;
  clientIdParam?: string;
  tokenAuth?: "body" | "basic";
  pkce?: boolean;
  extraAuthParams?: Record<string, string>;
  /** e.g. exchange a short-lived token for a long-lived one */
  afterToken?: (t: TokenSet, creds: Creds) => Promise<TokenSet>;
  discover: (t: TokenSet) => Promise<DiscoveredAccount[]>;
  /** Custom refresh (Meta long-lived tokens). Default: standard refresh_token grant. */
  refresh?: (t: { accessToken: string; refreshToken?: string }, creds: Creds) => Promise<TokenSet>;
}

interface Creds {
  clientId: string;
  clientSecret: string;
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const get = (url: string, token?: string) => api<Json>(url, { label: "OAuth", headers: token ? bearer(token) : {} });
const toTokenSet = (j: Json): TokenSet => ({ accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in });

const GOOGLE_BASE = {
  env: "GOOGLE",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
};

const PROVIDERS: Partial<Record<PlatformId, ProviderConfig>> = {
  facebook: {
    env: "FACEBOOK",
    authorizeUrl: "https://www.facebook.com/v23.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v23.0/oauth/access_token",
    scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "business_management"],
    scopeSeparator: ",",
    async afterToken(t, c) {
      const j = await get(
        `https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${c.clientId}&client_secret=${c.clientSecret}&fb_exchange_token=${t.accessToken}`,
      );
      return toTokenSet(j);
    },
    async discover(t) {
      // Page tokens derived from a long-lived user token do not expire.
      const j = await get(`https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,picture{url}&limit=100&access_token=${t.accessToken}`);
      return (j.data ?? []).map((p: Json) => ({
        externalId: p.id, name: p.name, avatarUrl: p.picture?.data?.url, accessToken: p.access_token,
      }));
    },
  },
  instagram: {
    env: "INSTAGRAM",
    authorizeUrl: "https://www.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    scopeSeparator: ",",
    async afterToken(t, c) {
      return toTokenSet(await get(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${c.clientSecret}&access_token=${t.accessToken}`));
    },
    async refresh(t) {
      return toTokenSet(await get(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${t.accessToken}`));
    },
    async discover(t) {
      const me = await get(`https://graph.instagram.com/v23.0/me?fields=user_id,username,name,profile_picture_url&access_token=${t.accessToken}`);
      return [{ externalId: String(me.user_id ?? me.id), name: me.name || me.username, handle: me.username, avatarUrl: me.profile_picture_url }];
    },
  },
  threads: {
    env: "THREADS",
    authorizeUrl: "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    scopes: ["threads_basic", "threads_content_publish"],
    scopeSeparator: ",",
    async afterToken(t, c) {
      return toTokenSet(await get(`https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${c.clientSecret}&access_token=${t.accessToken}`));
    },
    async refresh(t) {
      return toTokenSet(await get(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${t.accessToken}`));
    },
    async discover(t) {
      const me = await get(`https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${t.accessToken}`);
      return [{ externalId: me.id, name: me.name || me.username, handle: me.username, avatarUrl: me.threads_profile_picture_url, meta: { username: me.username } }];
    },
  },
  x: {
    env: "X",
    authorizeUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"],
    tokenAuth: "basic",
    pkce: true,
    async discover(t) {
      const { data } = await get("https://api.x.com/2/users/me?user.fields=profile_image_url", t.accessToken);
      return [{ externalId: data.id, name: data.name, handle: data.username, avatarUrl: data.profile_image_url, meta: { username: data.username } }];
    },
  },
  linkedin: {
    env: "LINKEDIN",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
    async discover(t) {
      const me = await get("https://api.linkedin.com/v2/userinfo", t.accessToken);
      return [{ externalId: me.sub, name: me.name, avatarUrl: me.picture, meta: { urn: `urn:li:person:${me.sub}` } }];
    },
  },
  tiktok: {
    env: "TIKTOK",
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "video.publish"],
    scopeSeparator: ",",
    clientIdParam: "client_key",
    async discover(t) {
      const j = await get("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username", t.accessToken);
      const u = j.data.user;
      return [{ externalId: u.open_id, name: u.display_name, handle: u.username, avatarUrl: u.avatar_url }];
    },
  },
  youtube: {
    ...GOOGLE_BASE,
    scopes: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    async discover(t) {
      const j = await get("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", t.accessToken);
      return (j.items ?? []).map((c: Json) => ({
        externalId: c.id, name: c.snippet.title, handle: c.snippet.customUrl, avatarUrl: c.snippet.thumbnails?.default?.url,
      }));
    },
  },
  google_business: {
    ...GOOGLE_BASE,
    scopes: ["https://www.googleapis.com/auth/business.manage"],
    async discover(t) {
      const accounts = await get("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", t.accessToken);
      const out: DiscoveredAccount[] = [];
      for (const a of accounts.accounts ?? []) {
        const locs = await get(`https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title&pageSize=100`, t.accessToken);
        for (const l of locs.locations ?? []) out.push({ externalId: `${a.name}/${l.name}`, name: l.title });
      }
      return out;
    },
  },
  pinterest: {
    env: "PINTEREST",
    authorizeUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    scopes: ["boards:read", "pins:read", "pins:write", "user_accounts:read"],
    scopeSeparator: ",",
    tokenAuth: "basic",
    async discover(t) {
      const me = await get("https://api.pinterest.com/v5/user_account", t.accessToken);
      return [{ externalId: me.id ?? me.username, name: me.business_name || me.username, handle: me.username, avatarUrl: me.profile_image }];
    },
  },
};

function creds(platform: PlatformId): Creds | null {
  const p = PROVIDERS[platform];
  if (!p) return null;
  const clientId = process.env[`${p.env}_CLIENT_ID`];
  const clientSecret = process.env[`${p.env}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function isOAuthConfigured(platform: PlatformId): boolean {
  return creds(platform) !== null;
}

export function redirectUri(platform: PlatformId) {
  return appUrl(`/api/social/callback/${platform}`);
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthorizeUrl(platform: PlatformId, state: string, verifier: string): string {
  const p = PROVIDERS[platform];
  const c = creds(platform);
  if (!p || !c) throw new Error(`${platform} OAuth is not configured`);
  const url = new URL(p.authorizeUrl);
  url.searchParams.set(p.clientIdParam ?? "client_id", c.clientId);
  url.searchParams.set("redirect_uri", redirectUri(platform));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", p.scopes.join(p.scopeSeparator ?? " "));
  url.searchParams.set("state", state);
  if (p.pkce) {
    url.searchParams.set("code_challenge", pkceChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  for (const [k, v] of Object.entries(p.extraAuthParams ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

async function tokenRequest(platform: PlatformId, params: Record<string, string>): Promise<TokenSet> {
  const p = PROVIDERS[platform]!;
  const c = creds(platform)!;
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (p.tokenAuth === "basic") {
    headers.Authorization = `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`;
    if (p.pkce) body.set("client_id", c.clientId);
  } else {
    body.set(p.clientIdParam ?? "client_id", c.clientId);
    body.set("client_secret", c.clientSecret);
  }
  const j = await api<Json>(p.tokenUrl, { label: `${platform} token`, method: "POST", headers, body });
  if (!j.access_token) throw new Error(`${platform}: no access token in response`);
  return toTokenSet(j);
}

export async function exchangeCode(platform: PlatformId, code: string, verifier: string) {
  const p = PROVIDERS[platform];
  const c = creds(platform);
  if (!p || !c) throw new Error(`${platform} OAuth is not configured`);
  let tokens = await tokenRequest(platform, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(platform),
    ...(p.pkce ? { code_verifier: verifier } : {}),
  });
  if (p.afterToken) tokens = { ...tokens, ...(await p.afterToken(tokens, c)) };
  const accounts = await p.discover(tokens);
  return { tokens, accounts };
}

export async function refreshTokens(platform: PlatformId, current: { accessToken: string; refreshToken?: string }): Promise<TokenSet | null> {
  const p = PROVIDERS[platform];
  const c = creds(platform);
  if (!p || !c) return null;
  if (p.refresh) return p.refresh(current, c);
  if (!current.refreshToken) return null;
  const t = await tokenRequest(platform, { grant_type: "refresh_token", refresh_token: current.refreshToken });
  return { ...t, refreshToken: t.refreshToken ?? current.refreshToken };
}
