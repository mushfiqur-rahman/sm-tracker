// Trigger publishing from any cron service (Vercel Cron, GitHub Actions, cron-job.org…), every minute:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/publish
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDueTargets } from "@/lib/publisher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runDueTargets(50);
  return NextResponse.json(result);
}
