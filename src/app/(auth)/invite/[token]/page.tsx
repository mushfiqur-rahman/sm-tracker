import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ROLE_INFO, type Role } from "@/lib/roles";
import { acceptInviteAsCurrentUser, logout } from "@/app/actions/auth";
import { Alert, Card, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await db.invitation.findUnique({ where: { token }, include: { organization: true, invitedBy: true } });
  const session = await getSession();
  const user = session ? await db.user.findUnique({ where: { id: session.uid } }) : null;

  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-subtle">This invitation link is invalid, already used, or expired. Ask your admin for a new one.</p>
        <LinkButton href="/login" variant="secondary" className="mt-6">Go to sign in</LinkButton>
      </Card>
    );
  }
  const role = ROLE_INFO[inv.role as Role];

  return (
    <Card className="p-6 sm:p-8">
      <p className="text-sm text-subtle">{inv.invitedBy.name} invited you to</p>
      <h1 className="mt-1 text-xl font-semibold">{inv.organization.name}</h1>
      <p className="mt-4 text-sm"><span className="font-medium">{role?.label}</span> — <span className="text-subtle">{role?.description}</span></p>
      <div className="mt-6">
        {user ? (
          user.email.toLowerCase() === inv.email.toLowerCase() ? (
            <form action={acceptInviteAsCurrentUser}>
              <input type="hidden" name="token" value={token} />
              <SubmitButton className="w-full">Accept invitation</SubmitButton>
            </form>
          ) : (
            <div className="space-y-3">
              <Alert tone="warn">You are signed in as {user.email}, but this invite is for {inv.email}.</Alert>
              <form action={logout}><SubmitButton variant="secondary" className="w-full">Sign out and switch account</SubmitButton></form>
            </div>
          )
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <LinkButton href={`/signup?invite=${token}`}>Create account</LinkButton>
            <LinkButton href={`/login?invite=${token}`} variant="secondary">I have an account</LinkButton>
          </div>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-subtle">Invitation sent to {inv.email}. <Link href="/" className="underline">What is SM Tracking?</Link></p>
    </Card>
  );
}
