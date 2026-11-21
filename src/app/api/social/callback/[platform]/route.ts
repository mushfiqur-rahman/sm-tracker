import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { isPlatformId, PLATFORMS } from "@/lib/platforms";
import { exchangeCode } from "@/lib/oauth";
import { upsertAccounts } from "@/lib/accounts";
import { appUrl } from "@/lib/utils";

const back = (q: string) => {
  const res = NextResponse.redirect(appUrl(`/accounts?${q}`));
  res.cookies.delete("pp_oauth");
  return res;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = req.nextUrl;
  if (!isPlatformId(platform)) return back("error=Unsupported+platform");
  const name = PLATFORMS[platform].name;

  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (oauthError) return back("error=" + encodeURIComponent(`${name}: ${oauthError}`));

  const ctx = await getContext();
  if (!ctx || !can(ctx.role, "accounts.manage")) return back("error=Not+allowed");

  let state: { nonce: string; verifier: string; platform: string; uid: string; oid: string };
  try {
    const { payload } = await jwtVerify(req.cookies.get("pp_oauth")?.value ?? "", new TextEncoder().encode(process.env.AUTH_SECRET!));
    state = payload as typeof state;
  } catch {
    return back("error=" + encodeURIComponent("Connection expired. Please try again."));
  }
  if (state.nonce !== url.searchParams.get("state") || state.platform !== platform || state.uid !== ctx.user.id || state.oid !== ctx.org.id)
    return back("error=" + encodeURIComponent("Security check failed. Please try again."));

  const code = url.searchParams.get("code");
  if (!code) return back("error=Missing+authorization+code");

  try {
    const { tokens, accounts } = await exchangeCode(platform, code, state.verifier);
    if (accounts.length === 0) return back("error=" + encodeURIComponent(`No ${PLATFORMS[platform].accountNoun.toLowerCase()}s found on that ${name} login.`));
    const r = await upsertAccounts(ctx.org, ctx.user.id, platform, tokens, accounts);
    return back(`connected=${platform}&added=${r.added}&skipped=${r.skipped}`);
  } catch (e) {
    console.error(`[oauth:${platform}]`, e);
    return back("error=" + encodeURIComponent(`${name}: ${(e as Error).message}`));
  }
}
