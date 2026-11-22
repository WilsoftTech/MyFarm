"use client";
import { useState } from "react";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import type { AssignmentView } from "@/modules/extension-officers/contracts/assignments";
import { useProductionSubmit } from "../production/use-production-submit";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field } from "../farmer-registry/field";

export function GrantOfficerForm({ submit }: { submit: CommandSubmit }) {
  const { initialRequestId, message, online, ready, save } = useProductionSubmit(submit);
  const [saving, setSaving] = useState(false);
  return <form className="space-y-5" onSubmit={async event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setSaving(true);
    try { await save({ requestId: initialRequestId, officerId: String(data.get("officerId") ?? "").trim(), permissions: ["DASHBOARD", "VISITS", "FOLLOW_UPS"], confirmed: data.get("confirmed") === "on" }); }
    finally { setSaving(false); }
  }}>
    <Field id="officerId" label="Officer account ID" hint="Ask the officer to share the ID from their own workspace. There is no farmer directory.">{aria => <Input {...aria} name="officerId" required maxLength={36} autoComplete="off" />}</Field>
    <p className="leading-7">This person will see this farm’s name, district and their assigned visit work. They can record visits and follow-ups when those tools are available. This does not grant money records, exports or access to other farms.</p>
    <label className="flex items-start gap-3"><input name="confirmed" type="checkbox" required className="mt-1 size-5" /><span>I choose to grant this named officer access to this farm.</span></label>
    {!online && <p role="status">Reconnect to grant access. Your form is still here.</p>}
    {message && <p role="alert">{message}</p>}
    <Button disabled={!ready || !online || saving} type="submit">{saving ? "Granting access…" : "Grant officer access"}</Button>
  </form>;
}
export function RevokeOfficerForm({ row, submit }: { row: AssignmentView; submit: CommandSubmit }) {
  const { initialRequestId, message, online, ready, save } = useProductionSubmit(submit);
  const [saving, setSaving] = useState(false);
  return <form className="mt-3 space-y-3" onSubmit={async event => {
    event.preventDefault(); setSaving(true);
    try { await save({ requestId: initialRequestId, assignmentId: row.assignmentId, expectedVersion: row.version, confirmed: true }); }
    finally { setSaving(false); }
  }}>
    <label className="flex items-start gap-3"><input type="checkbox" required className="mt-1 size-5" /><span>Remove access for officer {row.officerId}</span></label>
    <Button variant="outline" disabled={!ready || !online || saving} type="submit">{saving ? "Removing access…" : "Remove officer access"}</Button>
    {!online && <p role="status">Reconnect to remove access.</p>}{message && <p role="alert">{message}</p>}
  </form>;
}
