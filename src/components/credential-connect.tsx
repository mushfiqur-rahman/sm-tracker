"use client";

import { useActionState, useState } from "react";
import { connectBluesky, connectMastodon } from "@/app/actions/accounts";
import type { FormState } from "@/app/actions/types";
import { Alert, Button, Field, Input } from "./ui";
import { SubmitButton } from "./submit-button";

export function CredentialConnect({ platform, disabled }: { platform: "bluesky" | "mastodon"; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(platform === "bluesky" ? connectBluesky : connectMastodon, {});
  if (!open) return <Button size="sm" variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>Connect</Button>;
  return (
    <form action={action} className="mt-3 w-full space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="ok">{state.ok}</Alert>}
      {platform === "bluesky" ? (
        <>
          <Field label="Handle"><Input name="handle" placeholder="yourbrand.bsky.social" required /></Field>
          <Field label="App password" hint="Create one in Bluesky → Settings → Privacy and security → App passwords.">
            <Input name="password" type="password" placeholder="xxxx-xxxx-xxxx-xxxx" required />
          </Field>
        </>
      ) : (
        <>
          <Field label="Instance"><Input name="instance" placeholder="mastodon.social" required /></Field>
          <Field label="Access token" hint="Preferences → Development → New application, with write:statuses and write:media.">
            <Input name="token" type="password" required />
          </Field>
        </>
      )}
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Checking…">Connect</SubmitButton>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
