// Next.js 16 "proxy" (formerly middleware): fast redirect for signed-out users.
// Real authorization happens server-side in requireContext()/requirePermission().
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const APP_PATHS = ["/dashboard", "/compose", "/posts", "/calendar", "/accounts", "/team", "/billing", "/settings", "/media-library", "/onboarding"];
const AUTH_PATHS = ["/login", "/signup"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session && APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (session && AUTH_PATHS.includes(pathname) && !req.nextUrl.searchParams.has("invite")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|media|_next/static|_next/image|favicon.ico).*)"],
};
