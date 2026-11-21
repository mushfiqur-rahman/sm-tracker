"use client";

import { useActionState } from "react";
import { updateProfile, updateWorkspace } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/types";
import { Alert, Field, Input, Select } from "./ui";
import { SubmitButton } from "./submit-button";

export function WorkspaceForm({ name, timezone, timezones, disabled }: { name: string; timezone: string; timezones: string[]; disabled: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(updateWorkspace, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="ok">{state.ok}</Alert>}
      <Field label="Business name"><Input name="name" defaultValue={name} disabled={disabled} required /></Field>
      <Field label="Default timezone" hint="Used for the calendar, monthly usage and as the default when scheduling.">
        <Select name="timezone" defaultValue={timezone} disabled={disabled}>
          {timezones.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
        </Select>
      </Field>
      {!disabled && <SubmitButton>Save workspace</SubmitButton>}
    </form>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="ok">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><Input name="name" defaultValue={name} required /></Field>
        <Field label="Email"><Input value={email} disabled /></Field>
        <Field label="Current password"><Input name="currentPassword" type="password" autoComplete="current-password" /></Field>
        <Field label="New password" hint="Leave blank to keep your password."><Input name="newPassword" type="password" autoComplete="new-password" minLength={8} /></Field>
      </div>
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}
