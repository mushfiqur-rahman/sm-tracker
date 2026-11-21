"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays, CreditCard, Image as ImageIcon, LayoutDashboard, ListChecks, Menu, PenSquare, Settings, Share2, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Create post", icon: PenSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/posts", label: "Posts", icon: ListChecks },
  { href: "/media-library", label: "Media", icon: ImageIcon },
  { href: "/accounts", label: "Social accounts", icon: Share2 },
  { href: "/team", label: "Team", icon: Users },
  { href: "/billing", label: "Plan & usage", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate, badges }: { onNavigate?: () => void; badges: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-soft text-brand" : "text-subtle hover:bg-muted hover:text-fg",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {badges[href] ? <span className="rounded-full bg-warn-soft px-1.5 text-xs font-semibold text-warn">{badges[href]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppNav({ footer, badges = {} }: { footer: React.ReactNode; badges?: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-border bg-surface lg:flex">
        <div className="px-5 py-5"><Link href="/dashboard"><Logo /></Link></div>
        <div className="flex-1 overflow-y-auto px-3"><NavLinks badges={badges} /></div>
        <div className="border-t border-border p-3">{footer}</div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard"><Logo /></Link>
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-subtle hover:bg-muted" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-subtle hover:bg-muted" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3"><NavLinks badges={badges} onNavigate={() => setOpen(false)} /></div>
            <div className="border-t border-border p-3">{footer}</div>
          </div>
        </div>
      )}
    </>
  );
}
