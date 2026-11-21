// Serves uploaded media. Keys are unguessable UUIDs because social networks
// (Instagram, Threads, TikTok, Pinterest) must fetch media without logging in.
import { getObject } from "@/lib/storage";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.join("/");
  try {
    const data = await getObject(path);
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
