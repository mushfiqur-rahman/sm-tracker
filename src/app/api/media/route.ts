import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { db } from "@/lib/db";
import { ALLOWED_MIME, putObject } from "@/lib/storage";
import { assertStorageQuota, QuotaError } from "@/lib/usage";

const MAX_FILE_BYTES = 1024 * 1024 * 1024; // 1 GB per file

export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "posts.create")) return NextResponse.json({ error: "Your role can't upload media." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: `Unsupported file type ${file.type || "unknown"}. Use JPG, PNG, GIF, WebP, MP4, MOV or WebM.` }, { status: 415 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Files must be under 1 GB." }, { status: 413 });

  try {
    await assertStorageQuota(ctx.org, file.size);
  } catch (e) {
    if (e instanceof QuotaError) return NextResponse.json({ error: e.message }, { status: 402 });
    throw e;
  }

  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const key = `${ctx.org.id}/${randomUUID()}.${ext}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()));
  const asset = await db.mediaAsset.create({
    data: { orgId: ctx.org.id, uploadedById: ctx.user.id, fileName: file.name.slice(0, 200), storageKey: key, mimeType: file.type, sizeBytes: file.size },
  });
  return NextResponse.json({ id: asset.id, fileName: asset.fileName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, url: `/media/${key}` });
}
