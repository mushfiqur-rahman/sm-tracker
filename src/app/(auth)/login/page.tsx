import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-subtle">Sign in to manage your social channels.</p>
      <LoginForm invite={invite} />
    </Card>
  );
}
