import { LogOut } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { can, ROLE_INFO } from "@/lib/roles";
import { db } from "@/lib/db";
import { logout, switchWorkspace } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const pendingApprovals = can(ctx.role, "posts.approve")
    ? await db.post.count({ where: { orgId: ctx.org.id, status: "PENDING_APPROVAL" } })
    : 0;
  const reconnect = can(ctx.role, "accounts.manage")
    ? await db.socialAccount.count({ where: { orgId: ctx.org.id, status: "NEEDS_RECONNECT" } })
    : 0;

  const footer = (
    <div className="space-y-3">
      {ctx.workspaces.length > 1 ? (
        <form action={switchWorkspace} className="flex gap-2">
          <select name="orgId" defaultValue={ctx.org.id} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-sm" aria-label="Workspace">
            {ctx.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button className="rounded-lg border border-border px-2 text-sm hover:bg-muted">Go</button>
        </form>
      ) : (
        <div className="truncate px-1 text-sm font-semibold">{ctx.org.name}</div>
      )}
      <div className="flex items-center gap-3 px-1">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
          {ctx.user.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{ctx.user.name}</div>
          <div className="truncate text-xs text-subtle">{ROLE_INFO[ctx.role].label}</div>
        </div>
        <form action={logout}>
          <button className="rounded-lg p-1.5 text-subtle hover:bg-muted hover:text-fg" title="Sign out" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
      <ThemeToggle />
    </div>
  );

  return (
    <div className="min-h-dvh">
      <AppNav footer={footer} badges={{ "/posts": pendingApprovals, "/accounts": reconnect }} />
      <main className="lg:ps-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
