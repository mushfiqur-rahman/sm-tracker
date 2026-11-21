"use client";

import { useActionState, useSyncExternalStore } from "react";
import Link from "next/link";
import { login, signup, createWorkspace } from "@/app/actions/auth";
import type { FormState } from "@/app/actions/types";
import { Alert, Field, Input } from "./ui";
import { SubmitButton } from "./submit-button";

const noopSubscribe = () => () => {};

function useBrowserTimezone() {
  return useSyncExternalStore(noopSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", () => "UTC");
}

export function LoginForm({ invite }: { invite?: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {invite && <input type="hidden" name="invite" value={invite} />}
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} /></Field>
      <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      <SubmitButton className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm text-subtle">
        New to SM Tracking? <Link className="font-medium text-brand hover:underline" href={invite ? `/signup?invite=${invite}` : "/signup"}>Create an account</Link>
      </p>
    </form>
  );
}

export function SignupForm({ invite, inviteEmail, plan }: { invite?: string; inviteEmail?: string; plan?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signup, {});
  const tz = useBrowserTimezone();
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="timezone" value={tz} />
      {invite && <input type="hidden" name="invite" value={invite} />}
      {plan && <input type="hidden" name="plan" value={plan} />}
      <Field label="Your name" htmlFor="name"><Input id="name" name="name" autoComplete="name" required defaultValue={state.values?.name} /></Field>
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={inviteEmail ?? state.values?.email} readOnly={!!inviteEmail} />
      </Field>
      {!invite && <Field label="Business name" htmlFor="company"><Input id="company" name="company" autoComplete="organization" required defaultValue={state.values?.company} /></Field>}
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton className="w-full" pendingText="Creating account…">{invite ? "Join workspace" : "Create account"}</SubmitButton>
      <p className="text-center text-sm text-subtle">
        Already have an account? <Link className="font-medium text-brand hover:underline" href={invite ? `/login?invite=${invite}` : "/login"}>Sign in</Link>
      </p>
    </form>
  );
}

export function CreateWorkspaceForm() {
  const [state, action] = useActionState<FormState, FormData>(createWorkspace, {});
  const tz = useBrowserTimezone();
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="timezone" value={tz} />
      <Field label="Business name" htmlFor="company"><Input id="company" name="company" required /></Field>
      <SubmitButton className="w-full">Create workspace</SubmitButton>
    </form>
  );
}
