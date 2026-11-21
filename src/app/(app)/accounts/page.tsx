import type { Metadata } from "next";
import { Share2, TriangleAlert, Unplug } from "lucide-react";
import { accountScope, requireContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { db } from "@/lib/db";
import { PLATFORM_IDS, PLATFORMS } from "@/lib/platforms";
import { isOAuthConfigured } from "@/lib/oauth";
import { isDemoMode } from "@/lib/utils";
import { formatLimit } from "@/lib/plans";
import { disconnectAccount } from "@/app/actions/accounts";
import { AccountAvatar, PlatformIcon } from "@/components/platform-icon";
import { CredentialConnect } from "@/components/credential-connect";
import { Alert, Badge, buttonClass, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Social accounts" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireContext();
  const q = await searchParams;
  const manage = can(ctx.role, "accounts.manage");
  const accounts = await db.socialAccount.findMany({
    where: accountScope(ctx), orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { targets: { where: { status: "PENDING" } } } } },
  });
  const total = await db.socialAccount.count({ where: { orgId: ctx.org.id } });
  const atLimit = total >= ctx.plan.limits.socialAccounts;
  const demo = isDemoMode();

  return (
    <>
      <PageHeader
        title="Social accounts"
        description={`${total} of ${formatLimit(ctx.plan.limits.socialAccounts)} channels on the ${ctx.plan.name} plan.`}
      />

      <div className="mb-6 space-y-3">
        {q.error && <Alert>{q.error}</Alert>}
        {q.connected && (
          <Alert tone="ok">
            {PLATFORMS[q.connected as keyof typeof PLATFORMS]?.name ?? "Account"} connected
            {q.sandbox ? " as a sandbox account (demo mode — posts are simulated, nothing is sent)." : "."}
            {q.skipped && q.skipped !== "0" ? ` ${q.skipped} account(s) skipped: plan limit reached.` : ""}
          </Alert>
        )}
        {atLimit && manage && <Alert tone="warn">You’ve reached your plan’s channel limit. Upgrade on the Plan & usage page to connect more.</Alert>}
      </div>

      <Card className="mb-8">
        <CardHeader title="Connected" description={ctx.allowedAccountIds ? "Channels you have been given access to." : "Channels your team can publish to."} />
        {accounts.length === 0 ? (
          <EmptyState icon={<Share2 className="size-5" />} title="No accounts connected" description={manage ? "Connect your first channel below." : "Ask an admin to connect channels or give you access."} />
        ) : (
          <ul className="divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                <AccountAvatar platform={a.platform} name={a.name} avatarUrl={a.avatarUrl} />
                <div className="min-w-0 flex-1" translate="no">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{a.name}</span>
                    {a.isSandbox && <Badge>Sandbox</Badge>}
                    {a.status !== "ACTIVE" && <Badge tone="danger"><TriangleAlert className="size-3" />Reconnect needed</Badge>}
                  </div>
                  <div className="truncate text-sm text-subtle">
                    {PLATFORMS[a.platform as keyof typeof PLATFORMS]?.name}{a.handle ? ` · @${a.handle}` : ""} · {a._count.targets} scheduled
                  </div>
                </div>
                {manage && (
                  <div className="flex items-center gap-2">
                    {a.status !== "ACTIVE" && PLATFORMS[a.platform as keyof typeof PLATFORMS]?.connect === "oauth" && (
                      <a href={`/api/social/connect/${a.platform}`} className={buttonClass("primary", "sm")}>Reconnect</a>
                    )}
                    <form action={disconnectAccount}>
                      <input type="hidden" name="accountId" value={a.id} />
                      <button className={buttonClass("ghost", "sm")} title="Disconnect"><Unplug className="size-4" />Disconnect</button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {manage && (
        <>
          <h2 className="mb-1 text-lg font-semibold">Add a channel</h2>
          <p className="mb-4 text-sm text-subtle">
            You’ll be sent to each network to approve access. We never see your password.
            {demo && " Demo mode is on: networks without API keys connect as sandbox accounts."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PLATFORM_IDS.map((id) => {
              const p = PLATFORMS[id];
              const ready = p.connect !== "oauth" || isOAuthConfigured(id);
              return (
                <Card key={id} className="flex flex-col p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <PlatformIcon platform={id} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium" translate="no">{p.name}</div>
                      <div className="text-xs text-subtle">
                        {p.accountNoun}s · {p.maxChars.toLocaleString()} chars
                        {p.requiresMedia !== "none" && ` · needs ${p.requiresMedia === "any" ? "media" : p.requiresMedia}`}
                      </div>
                    </div>
                    {p.connect === "oauth" && (
                      ready || demo ? (
                        <a href={atLimit ? undefined : `/api/social/connect/${id}`} aria-disabled={atLimit} className={buttonClass("secondary", "sm", atLimit ? "pointer-events-none opacity-50" : "")}>
                          Connect
                        </a>
                      ) : (
                        <Badge>Not configured</Badge>
                      )
                    )}
                    {p.connect !== "oauth" && <CredentialConnect platform={id as "bluesky" | "mastodon"} disabled={atLimit} />}
                  </div>
                  {p.notes && <p className="mt-3 text-xs text-subtle">{p.notes}</p>}
                  {p.connect === "oauth" && !ready && demo && <p className="mt-3 text-xs text-subtle">No API keys yet — connects as a sandbox account.</p>}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
