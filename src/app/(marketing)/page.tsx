import { CalendarClock, CheckCheck, Globe2, Layers, ShieldCheck, Users } from "lucide-react";
import { PLATFORM_IDS, PLATFORMS } from "@/lib/platforms";
import { PlatformIcon } from "@/components/platform-icon";
import { PricingCards } from "@/components/pricing-cards";
import { LinkButton } from "@/components/ui";

const FEATURES = [
  { icon: CalendarClock, title: "Schedule months ahead", body: "Pick the exact date, time and timezone — next hour or next quarter. Posts go out automatically, with retries if a network hiccups." },
  { icon: Layers, title: "One post, every channel", body: "Write once, then tailor captions, titles and options per network. Live checks catch character limits and media rules before you schedule." },
  { icon: Users, title: "Built for teams", body: "Invite employees as Admins, Editors, Contributors or Viewers, and limit each person to the channels they manage." },
  { icon: CheckCheck, title: "Approval workflow", body: "Contributors draft, editors approve. Nothing goes live without the right eyes on it." },
  { icon: ShieldCheck, title: "Secure by default", body: "Official OAuth connections, encrypted tokens, and a full activity log of who changed what." },
  { icon: Globe2, title: "Works in any language", body: "Multi-script fonts and clean markup, so your browser can translate the whole interface into your language." },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
        <p className="mx-auto mb-4 inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs text-subtle">
          {PLATFORM_IDS.length} networks · one calendar
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Plan, schedule and publish to every social network — together.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-subtle">
          Connect your business’s Facebook, Instagram, X, LinkedIn, TikTok, YouTube and more. Your team writes, approves and schedules from one clean workspace.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/signup" size="lg">Start free</LinkButton>
          <LinkButton href="/pricing" size="lg" variant="secondary">See pricing</LinkButton>
        </div>
      </section>

      <section id="channels" className="border-y border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-3 px-4 py-8 sm:px-6">
          {PLATFORM_IDS.map((id) => (
            <span key={id} className="inline-flex items-center gap-2 text-sm text-subtle">
              <PlatformIcon platform={id} size="sm" />
              <span translate="no">{PLATFORMS[id].name}</span>
            </span>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Everything a busy social team needs</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-surface p-6">
              <div className="mb-4 inline-flex rounded-lg bg-brand-soft p-2 text-brand"><Icon className="size-5" aria-hidden /></div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-subtle">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Simple, usage-based pricing</h2>
        <p className="mx-auto mb-10 mt-3 max-w-xl text-center text-subtle">Pay for what your business uses: posts per month, team members, channels and media storage.</p>
        <PricingCards action={(id) => <LinkButton href={`/signup?plan=${id}`} className="w-full" variant={id === "growth" ? "primary" : "secondary"}>{id === "free" ? "Start free" : "Choose plan"}</LinkButton>} />
      </section>
    </>
  );
}
