import { describe, expect, it, beforeAll } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";
import { localInputToUtc, utcToLocalInput } from "@/lib/timezone";
import { monthWindow } from "@/lib/usage";
import { can, assignableRoles } from "@/lib/roles";
import { getPlan } from "@/lib/plans";
import { linkFacets } from "@/lib/publisher/providers/others";
import { retryDelayMs } from "@/lib/publisher";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123";
});

describe("crypto", () => {
  it("round-trips and uses a random IV", () => {
    const a = encrypt("token-123");
    expect(decrypt(a)).toBe("token-123");
    expect(encrypt("token-123")).not.toBe(a);
  });
  it("detects tampering", () => {
    const [iv, tag, enc] = encrypt("x").split(".");
    expect(() => decrypt([iv, tag, Buffer.from("zz").toString("base64") + enc].join("."))).toThrow();
  });
});

describe("timezones", () => {
  it("converts a local schedule time to UTC", () => {
    expect(localInputToUtc("2026-12-24T09:30", "Asia/Dhaka").toISOString()).toBe("2026-12-24T03:30:00.000Z");
    expect(localInputToUtc("2026-07-01T09:00", "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });
  it("round-trips for the datetime-local input", () => {
    const d = localInputToUtc("2027-01-15T18:45", "Europe/London");
    expect(utcToLocalInput(d, "Europe/London")).toBe("2027-01-15T18:45");
  });
  it("computes the calendar month in the workspace timezone", () => {
    const { start, end, label } = monthWindow(new Date("2026-11-30T20:00:00Z"), "Asia/Dhaka"); // Dec 1, 02:00 in Dhaka
    expect(label).toBe("2026-12");
    expect(start.toISOString()).toBe("2026-11-30T18:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T18:00:00.000Z");
  });
});

describe("roles", () => {
  it("restricts capabilities by role", () => {
    expect(can("OWNER", "billing.manage")).toBe(true);
    expect(can("ADMIN", "billing.manage")).toBe(false);
    expect(can("CONTRIBUTOR", "posts.publish")).toBe(false);
    expect(can("VIEWER", "posts.create")).toBe(false);
    expect(assignableRoles("ADMIN")).not.toContain("ADMIN");
  });
});

describe("plans", () => {
  it("falls back to free for unknown plans", () => {
    expect(getPlan("nope").id).toBe("free");
  });
});

describe("publisher helpers", () => {
  it("builds Bluesky link facets with byte offsets", () => {
    const [f] = linkFacets("☕ see https://example.com now");
    expect(f.index.byteStart).toBe(8); // ☕ is 3 bytes + " see " 5 bytes
    expect(f.features[0].uri).toBe("https://example.com");
  });
  it("backs off between retries", () => {
    expect(retryDelayMs(1)).toBeLessThan(retryDelayMs(2));
  });
});
