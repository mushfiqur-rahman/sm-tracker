import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { isPlatformId, PLATFORMS } from "@/lib/platforms";
import { buildAuthorizeUrl, isOAuthConfigured } from "@/lib/oauth";
import { randomToken } from "@/lib/crypto";
import { upsertAccounts } from "@/lib/accounts";
import { appUrl, isDemoMode } from "@/lib/utils";
import { assertAccountQuota, QuotaError } from "@/lib/usage";

const OAUTH_STATE_COOKIE = "pp_oauth";

const back = (q: string) => NextResponse.redirect(appUrl(`/accounts?${q}`));

export async function GET(_req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const ctx = await getContext();
  if (!ctx) return NextResponse.redirect(appUrl("/login"));
  if (!can(ctx.role, "accounts.manage")) return back("error=" + encodeURIComponent("You don't have permission to connect accounts."));
  if (!isPlatformId(platform) || PLATFORMS[platform].connect !== "oauth") return back("error=Unsupported+platform");

  try {
    await assertAccountQuota(ctx.org);
  } catch (e) {
    if (e instanceof QuotaError) return back("error=" + encodeURIComponent(e.message));
    throw e;
  }

  if (!isOAuthConfigured(platform)) {
    if (!isDemoMode()) return back("error=" + encodeURIComponent(`${PLATFORMS[platform].name} is not configured on this server yet.`));
    // Demo mode: create a sandbox account so the whole flow can be tried without API keys.
    const n = Math.floor(Math.random() * 900 + 100);
    await upsertAccounts(ctx.org, ctx.user.id, platform, { accessToken: "sandbox" }, [
      { externalId: `sandbox-${platform}-${n}`, name: `${ctx.org.name} ${PLATFORMS[platform].accountNoun}`, handle: `${ctx.org.name.toLowerCase().replace(/[^a-z0-9]/g, "")}${n}` },
    ], { sandbox: true });
    return back(`connected=${platform}&sandbox=1`);
  }

  const nonce = randomToken(16);
  const verifier = randomToken(48);
  const state = await new SignJWT({ nonce, verifier, platform, uid: ctx.user.id, oid: ctx.org.id })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));

  const res = NextResponse.redirect(buildAuthorizeUrl(platform, nonce, verifier));
  res.cookies.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 900 });
  return res;
}
