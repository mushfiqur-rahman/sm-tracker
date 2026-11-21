// Demo data: one workspace with sandbox channels, a team, and posts across the month.
// Login: owner@demo.test / password123  (also editor@ and contributor@)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encrypt } from "../src/lib/crypto";

const db = new PrismaClient();

async function main() {
  if (await db.user.findUnique({ where: { email: "owner@demo.test" } })) {
    console.log("Seed data already present.");
    return;
  }
  const hash = await bcrypt.hash("password123", 10);
  const [owner, editor, contributor] = await Promise.all(
    [["Ayesha Rahman", "owner@demo.test"], ["Daniel Okafor", "editor@demo.test"], ["Mina Park", "contributor@demo.test"]].map(([name, email]) =>
      db.user.create({ data: { name, email, passwordHash: hash } }),
    ),
  );
  const org = await db.organization.create({
    data: {
      name: "Sunrise Coffee Co.", timezone: "Asia/Dhaka", plan: "growth",
      memberships: { create: [{ userId: owner.id, role: "OWNER" }, { userId: editor.id, role: "EDITOR" }, { userId: contributor.id, role: "CONTRIBUTOR" }] },
    },
  });
  const accounts = await Promise.all(
    (["facebook", "instagram", "x", "linkedin", "tiktok"] as const).map((platform, i) =>
      db.socialAccount.create({
        data: {
          orgId: org.id, platform, externalId: `sandbox-${platform}`, name: "Sunrise Coffee", handle: `sunrisecoffee${i || ""}`,
          accessToken: encrypt("sandbox"), isSandbox: true, connectedById: owner.id,
        },
      }),
    ),
  );
  const [fb, ig, x, li] = accounts;
  const contribMembership = await db.membership.findFirstOrThrow({ where: { userId: contributor.id } });
  await db.accountAssignment.create({ data: { membershipId: contribMembership.id, socialAccountId: ig.id } });

  const day = 86_400_000;
  const posts = [
    { content: "☕ New seasonal blend lands Monday — cardamom & orange. Who's trying it first?", at: 1, status: "SCHEDULED", acc: [fb, x, li], author: owner },
    { content: "Behind the beans: meet the farmers who grow our single-origin Sidamo. 🌱", at: 4, status: "SCHEDULED", acc: [fb, li], author: editor },
    { content: "Weekend special: 2-for-1 cold brew, Saturday only!", at: 9, status: "PENDING_APPROVAL", acc: [ig], author: contributor },
    { content: "We're hiring baristas in Dhanmondi. Apply in store or DM us.", at: 30, status: "SCHEDULED", acc: [fb, x, li], author: owner },
    { content: "Thank you for 10,000 followers! 🎉", at: -3, status: "PUBLISHED", acc: [fb, x], author: editor },
    { content: "Ideas for our anniversary post…", at: null, status: "DRAFT", acc: [fb], author: owner },
  ];
  for (const p of posts) {
    const scheduledAt = p.at === null ? null : new Date(Date.now() + p.at * day);
    await db.post.create({
      data: {
        orgId: org.id, authorId: p.author.id, content: p.content, status: p.status, scheduledAt, timezone: org.timezone,
        publishedAt: p.status === "PUBLISHED" ? scheduledAt : null,
        targets: {
          create: p.acc.map((a) => ({
            socialAccountId: a.id,
            status: p.status === "PUBLISHED" ? "PUBLISHED" : "PENDING",
            externalId: p.status === "PUBLISHED" ? `sandbox_${a.id}` : null,
            publishedAt: p.status === "PUBLISHED" ? scheduledAt : null,
          })),
        },
      },
    });
  }
  console.log("Seeded. Sign in as owner@demo.test / password123");
}

main().finally(() => db.$disconnect());
