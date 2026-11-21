import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LinkButton } from "@/components/ui";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="PostPilot home"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-sm text-subtle md:flex">
            <Link href="/#features" className="hover:text-fg">Features</Link>
            <Link href="/#channels" className="hover:text-fg">Channels</Link>
            <Link href="/pricing" className="hover:text-fg">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><ThemeToggle /></div>
            {session ? (
              <LinkButton href="/dashboard" size="sm">Open app</LinkButton>
            ) : (
              <>
                <LinkButton href="/login" size="sm" variant="ghost">Sign in</LinkButton>
                <LinkButton href="/signup" size="sm">Start free</LinkButton>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-subtle sm:px-6">
          <Logo />
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-fg">Pricing</Link>
            <Link href="/login" className="hover:text-fg">Sign in</Link>
            <span className="sm:hidden"><ThemeToggle /></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
