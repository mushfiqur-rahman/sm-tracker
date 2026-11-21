import type { Metadata } from "next";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/roles";
import { allTimezones } from "@/lib/timezone";
import { ProfileForm, WorkspaceForm } from "@/components/settings-forms";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardHeader, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireContext();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Workspace" description={can(ctx.role, "settings.manage") ? undefined : "Only owners and admins can change these."} />
          <div className="p-5"><WorkspaceForm name={ctx.org.name} timezone={ctx.org.timezone} timezones={allTimezones()} disabled={!can(ctx.role, "settings.manage")} /></div>
        </Card>
        <Card>
          <CardHeader title="Your profile" />
          <div className="p-5"><ProfileForm name={ctx.user.name} email={ctx.user.email} /></div>
        </Card>
        <Card>
          <CardHeader title="Appearance" description="Light, dark, or follow your device." />
          <div className="p-5"><ThemeToggle /></div>
        </Card>
        <Card>
          <CardHeader title="Language" />
          <p className="p-5 text-sm text-subtle">
            Use your browser’s built-in translation (for example “Translate this page” in Chrome, Edge or Safari) to view SM Tracking in your language.
            Post text is never translated, so you always see exactly what will be published.
          </p>
        </Card>
      </div>
    </>
  );
}
