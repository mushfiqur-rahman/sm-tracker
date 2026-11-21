import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-brand">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-subtle">The page you’re looking for doesn’t exist or was moved.</p>
      <LinkButton href="/" className="mt-6">Go home</LinkButton>
    </main>
  );
}
