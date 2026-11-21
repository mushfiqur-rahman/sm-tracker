"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requirePermission } from "@/lib/auth";
import { upsertAccounts } from "@/lib/accounts";
import { assertAccountQuota, QuotaError } from "@/lib/usage";
import type { FormState } from "./types";

async function guard() {
  const ctx = await requirePermission("accounts.manage");
  await assertAccountQuota(ctx.org);
  return ctx;
}

function fail(e: unknown): FormState {
  if (e instanceof QuotaError) return { error: e.message };
  return { error: (e as Error).message || "Could not connect the account." };
}

export async function connectBluesky(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await guard();
    const { handle, password, service } = z.object({
      handle: z.string().trim().min(3).transform((h) => h.replace(/^@/, "")),
      password: z.string().trim().min(8, "Enter an app password"),
      service: z.string().trim().url().default("https://bsky.social"),
    }).parse({ ...Object.fromEntries(formData), service: formData.get("service") || undefined });

    const res = await fetch(`${service}/xrpc/com.atproto.server.createSession`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: handle, password }),
    });
    if (!res.ok) return { error: "Bluesky rejected those credentials. Check the handle and app password." };
    const session = (await res.json()) as { did: string; handle: string; accessJwt: string };
    const profile = await fetch(`${service}/xrpc/app.bsky.actor.getProfile?actor=${session.did}`, { headers: { Authorization: `Bearer ${session.accessJwt}` } })
      .then((r) => (r.ok ? r.json() : {})) as { displayName?: string; avatar?: string };

    await upsertAccounts(ctx.org, ctx.user.id, "bluesky", { accessToken: password }, [
      { externalId: session.did, name: profile.displayName || session.handle, handle: session.handle, avatarUrl: profile.avatar, meta: { handle: session.handle, service } },
    ]);
    revalidatePath("/accounts");
    return { ok: "Bluesky account connected." };
  } catch (e) {
    return fail(e);
  }
}

export async function connectMastodon(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await guard();
    const { instance, token } = z.object({
      instance: z.string().trim().transform((s) => (s.startsWith("http") ? s : `https://${s}`).replace(/\/$/, "")).pipe(z.string().url()),
      token: z.string().trim().min(10, "Enter an access token"),
    }).parse(Object.fromEntries(formData));
    const res = await fetch(`${instance}/api/v1/accounts/verify_credentials`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { error: "That instance rejected the token. It needs the write:statuses and write:media scopes." };
    const me = (await res.json()) as { id: string; username: string; display_name: string; avatar: string };
    await upsertAccounts(ctx.org, ctx.user.id, "mastodon", { accessToken: token }, [
      { externalId: `${new URL(instance).host}:${me.id}`, name: me.display_name || me.username, handle: `${me.username}@${new URL(instance).host}`, avatarUrl: me.avatar, meta: { instance } },
    ]);
    revalidatePath("/accounts");
    return { ok: "Mastodon account connected." };
  } catch (e) {
    return fail(e);
  }
}

export async function disconnectAccount(formData: FormData) {
  const ctx = await requirePermission("accounts.manage");
  const acc = await db.socialAccount.findFirst({ where: { id: String(formData.get("accountId")), orgId: ctx.org.id } });
  if (!acc) return;
  // Pending targets for this account are removed with it (cascade); refresh affected posts.
  await db.socialAccount.delete({ where: { id: acc.id } });
  await audit(ctx, "account.disconnected", `${acc.platform}: ${acc.name}`);
  revalidatePath("/", "layout");
}
