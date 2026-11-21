import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { SignupForm } from "@/components/auth-forms";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ invite?: string; plan?: string }> }) {
  const { invite, plan } = await searchParams;
  const inv = invite ? await db.invitation.findUnique({ where: { token: invite }, include: { organization: true } }) : null;
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold">{inv ? `Join ${inv.organization.name}` : "Start scheduling in minutes"}</h1>
      <p className="mb-6 mt-1 text-sm text-subtle">
        {inv ? "Create your account to accept the invitation." : "Free plan included. No credit card required."}
      </p>
      <SignupForm invite={inv ? invite : undefined} inviteEmail={inv?.email} plan={plan} />
    </Card>
  );
}
