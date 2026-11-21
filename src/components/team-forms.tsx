"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { inviteMember, updateMember } from "@/app/actions/team";
import type { FormState } from "@/app/actions/types";
import { ROLE_INFO, type Role } from "@/lib/roles";
import { PlatformIcon } from "./platform-icon";
import { Alert, Button, Field, Input, Select } from "./ui";
import { SubmitButton } from "./submit-button";

export interface AccountOption { id: string; platform: string; name: string }

const RESTRICTABLE = ["EDITOR", "CONTRIBUTOR", "VIEWER"];

function AccountPicker({ accounts, defaultSelected = [] }: { accounts: AccountOption[]; defaultSelected?: string[] }) {
  const [mode, setMode] = useState<"all" | "some">(defaultSelected.length ? "some" : "all");
  if (accounts.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Channel access</legend>
      <div className="mb-2 flex gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />All channels</label>
        <label className="flex items-center gap-2"><input type="radio" checked={mode === "some"} onChange={() => setMode("some")} />Only selected</label>
      </div>
      {mode === "some" && (
        <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">
          {accounts.map((a) => (
            <label key={a.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
              <input type="checkbox" name="accounts" value={a.id} defaultChecked={defaultSelected.includes(a.id)} />
              <PlatformIcon platform={a.platform} size="sm" />
              <span className="truncate" translate="no">{a.name}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function InviteForm({ roles, accounts, disabled }: { roles: Role[]; accounts: AccountOption[]; disabled?: boolean }) {
  const [state, action] = useActionState<FormState & { link?: string }, FormData>(inviteMember, {});
  const [role, setRole] = useState<string>(roles.includes("EDITOR") ? "EDITOR" : roles[0]);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && (
        <Alert tone="ok">
          <p>{state.ok}</p>
          {state.link && (
            <div className="mt-2 flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-xs text-fg">{state.link}</code>
              <Button type="button" size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(state.link!); setCopied(true); }}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="Email"><Input name="email" type="email" placeholder="employee@company.com" required disabled={disabled} /></Field>
        <Field label="Role">
          <Select name="role" value={role} onChange={(e) => setRole(e.target.value)} disabled={disabled}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-subtle">{ROLE_INFO[role as Role]?.description}</p>
      {RESTRICTABLE.includes(role) && <AccountPicker accounts={accounts} />}
      <SubmitButton disabled={disabled} pendingText="Inviting…">Create invitation</SubmitButton>
    </form>
  );
}

export function MemberEditForm({ membershipId, role, roles, accounts, assigned }: {
  membershipId: string; role: string; roles: Role[]; accounts: AccountOption[]; assigned: string[];
}) {
  const [state, action] = useActionState<FormState, FormData>(updateMember, {});
  const [r, setR] = useState(role);
  return (
    <form action={action} className="space-y-3 bg-muted/40 px-5 py-4">
      <input type="hidden" name="membershipId" value={membershipId} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="ok">{state.ok}</Alert>}
      <Field label="Role">
        <Select name="role" value={r} onChange={(e) => setR(e.target.value)} className="sm:max-w-60">
          {roles.map((x) => <option key={x} value={x}>{ROLE_INFO[x].label}</option>)}
        </Select>
      </Field>
      {RESTRICTABLE.includes(r) && <AccountPicker accounts={accounts} defaultSelected={assigned} />}
      <SubmitButton size="sm">Save changes</SubmitButton>
    </form>
  );
}
