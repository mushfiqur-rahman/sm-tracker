// Edge-safe session helpers (used by proxy.ts and server code).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pp_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface SessionPayload {
  uid: string;
  oid: string | null; // active workspace
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (at least 32 characters)");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "string") return null;
    return { uid: payload.uid, oid: typeof payload.oid === "string" ? payload.oid : null };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
