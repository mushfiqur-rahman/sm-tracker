import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" aria-label="PostPilot home"><Logo /></Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
