import { describe, expect, it } from "vitest";
import { validateForPlatform, charCount } from "@/lib/platforms";

const img = (mb = 1) => ({ mimeType: "image/jpeg", sizeBytes: mb * 1024 * 1024 });
const vid = (mb = 10) => ({ mimeType: "video/mp4", sizeBytes: mb * 1024 * 1024 });
const errors = (...a: Parameters<typeof validateForPlatform>) => validateForPlatform(...a).filter((i) => i.level === "error");

describe("validateForPlatform", () => {
  it("enforces X character limit", () => {
    expect(errors("x", "a".repeat(280), [])).toHaveLength(0);
    expect(errors("x", "a".repeat(281), [])).toHaveLength(1);
  });
  it("counts emoji as one character", () => {
    expect(charCount("☕🎉")).toBe(2);
  });
  it("requires media on Instagram", () => {
    expect(errors("instagram", "hello", [])[0].message).toMatch(/image or video/);
    expect(errors("instagram", "hello", [img()])).toHaveLength(0);
  });
  it("requires a video on YouTube plus a title", () => {
    const e = errors("youtube", "desc", [img()], {});
    expect(e.some((i) => /video is required/.test(i.message))).toBe(true);
    expect(e.some((i) => /Video title/.test(i.message))).toBe(true);
    expect(errors("youtube", "desc", [vid()], { title: "My video", privacy: "public" })).toHaveLength(0);
  });
  it("rejects mixing images and video where unsupported", () => {
    expect(errors("x", "hi", [img(), vid()]).some((i) => /mix/.test(i.message))).toBe(true);
    expect(errors("instagram", "hi", [img(), vid()])).toHaveLength(0);
  });
  it("limits image count and size", () => {
    expect(errors("bluesky", "hi", [img(), img(), img(), img(), img()]).length).toBeGreaterThan(0);
    expect(errors("bluesky", "hi", [img(2)]).some((i) => /under 1 MB/.test(i.message))).toBe(true);
  });
  it("limits Instagram hashtags to 30", () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" ");
    expect(errors("instagram", tags, [img()]).some((i) => /hashtags/.test(i.message))).toBe(true);
  });
});
