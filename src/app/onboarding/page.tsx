import { redirect } from "next/navigation";
import { getContext, getSession } from "@/lib/auth";
import { Card } from "@/components/ui";
import { CreateWorkspaceForm } from "@/components/auth-forms";
import { Logo } from "@/components/logo";

export default async function OnboardingPage() {
  if (!(await getSession())) redirect("/login");
  if (await getContext()) redirect("/dashboard");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold">Create your workspace</h1>
        <p className="mb-6 mt-1 text-sm text-subtle">A workspace holds your social channels, posts and team.</p>
        <CreateWorkspaceForm />
      </Card>
    </main>
  );
}
