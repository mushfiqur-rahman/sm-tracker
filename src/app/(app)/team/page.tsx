import type { Metadata } from "next";
import { requireContext } from "@/lib/auth";
import { assignableRoles, can, ROLE_INFO, ROLES, type Role } from "@/lib/roles";
import { db } from "@/lib/db";
import { seatsUsed } from "@/lib/usage";
import { formatInTz } from "@/lib/timezone";
import { removeMember, revokeInvite } from "@/app/actions/team";
import { InviteForm, MemberEditForm } from "@/components/team-forms";
import { PlatformIcon } from "@/components/platform-icon";
import { Alert, Badge, buttonClass, Card, CardHeader, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireContext();
  const manage = can(ctx.role, "team.manage");
  const [members, invites, accounts, seats, logs] = await Promise.all([
    db.membership.findMany({
      where: { orgId: ctx.org.id }, orderBy: { createdAt: "asc" },
      include: { user: true, accounts: { include: { socialAccount: { select: { id: true, platform: true, name: true } } } } },
    }),
    manage ? db.invitation.findMany({ where: { orgId: ctx.org.id, acceptedAt: null }, orderBy: { createdAt: "desc" } }) : [],
    db.socialAccount.findMany({ where: { orgId: ctx.org.id }, select: { id: true, platform: true, name: true }, orderBy: { platform: "asc" } }),
    seatsUsed(ctx.org.id),
    can(ctx.role, "audit.view")
      ? db.auditLog.findMany({ where: { orgId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { name: true } } } })
      : [],
  ]);
  const roles = assignableRoles(ctx.role);
  const full = seats >= ctx.plan.limits.seats;

  return (
    <>
      <PageHeader title="Team" description={`${seats} of ${ctx.plan.limits.seats} seats used on the ${ctx.plan.name} plan (pending invitations count).`} />

      {manage && (
        <Card className="mb-6">
          <CardHeader title="Invite an employee" description="They’ll get access to this workspace with the role and channels you choose." />
          <div className="p-5">
            {full && <div className="mb-4"><Alert tone="warn">All seats are in use. Upgrade your plan or remove a member to invite more people.</Alert></div>}
            <InviteForm roles={roles} accounts={accounts} disabled={full} />
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader title="Members" />
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const editable = manage && m.userId !== ctx.user.id && m.role !== "OWNER" && (ctx.role === "OWNER" || m.role !== "ADMIN");
            return (
              <li key={m.id}>
                <details className="group">
                  <summary className={`flex list-none items-center gap-4 px-5 py-3 ${editable ? "cursor-pointer hover:bg-muted/40" : ""}`}>
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{m.user.name.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{m.user.name}{m.userId === ctx.user.id && <span className="text-subtle"> (you)</span>}</div>
                      <div className="truncate text-sm text-subtle">{m.user.email}</div>
                    </div>
                    <div className="hidden flex-wrap justify-end gap-1 sm:flex">
                      {m.accounts.length > 0
                        ? m.accounts.slice(0, 6).map((a) => <PlatformIcon key={a.socialAccount.id} platform={a.socialAccount.platform} size="sm" />)
                        : <span className="text-xs text-subtle">All channels</span>}
                    </div>
                    <Badge tone={m.role === "OWNER" ? "brand" : "neutral"}>{ROLE_INFO[m.role as Role]?.label ?? m.role}</Badge>
                    {editable && <span className="text-xs text-brand group-open:hidden">Edit</span>}
                  </summary>
                  {editable && (
                    <>
                      <MemberEditForm membershipId={m.id} role={m.role} roles={roles} accounts={accounts} assigned={m.accounts.map((a) => a.socialAccount.id)} />
                      <form action={removeMember} className="bg-muted/40 px-5 pb-4">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button className={buttonClass("ghost", "sm", "text-danger hover:text-danger")}>Remove from workspace</button>
                      </form>
                    </>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      </Card>

      {manage && invites.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Pending invitations" />
          <ul className="divide-y divide-border">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{i.email}</div>
                  <div className="text-xs text-subtle">
                    {ROLE_INFO[i.role as Role]?.label} · {i.expiresAt < new Date() ? "expired" : `expires ${formatInTz(i.expiresAt, ctx.org.timezone, "d MMM")}`}
                  </div>
                </div>
                <code className="hidden max-w-xs truncate rounded bg-muted px-2 py-1 text-xs lg:block">/invite/{i.token}</code>
                <form action={revokeInvite}>
                  <input type="hidden" name="inviteId" value={i.id} />
                  <button className={buttonClass("ghost", "sm")}>Revoke</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader title="Roles" />
        <dl className="divide-y divide-border">
          {ROLES.map((r) => (
            <div key={r} className="grid gap-1 px-5 py-3 sm:grid-cols-[140px_1fr]">
              <dt className="font-medium">{ROLE_INFO[r].label}</dt>
              <dd className="text-sm text-subtle">{ROLE_INFO[r].description}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader title="Recent activity" />
          <ul className="divide-y divide-border text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap gap-x-3 px-5 py-2.5">
                <span className="w-32 shrink-0 text-xs text-subtle">{formatInTz(l.createdAt, ctx.org.timezone, "d MMM HH:mm")}</span>
                <span className="font-medium">{l.user?.name ?? "System"}</span>
                <span className="text-subtle">{l.action.replace(".", " ")}</span>
                <span className="min-w-0 truncate text-subtle">{l.details}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
