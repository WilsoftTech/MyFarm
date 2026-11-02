"use client";
import { useId, useState, useTransition } from "react";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field } from "@/components/farmer-registry/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductionFormFeedback } from "./form-feedback";
import { useProductionSubmit } from "./use-production-submit";

export function ActivityCancelForm({ version, submit }: { version: number; submit: CommandSubmit }) {
  const id = useId(), [confirmed, setConfirmed] = useState(false), [reason, setReason] = useState(""), [saving, startTransition] = useTransition();
  const { initialRequestId, online, ready, message, save } = useProductionSubmit(submit);
  return <form className="mt-6 max-w-2xl space-y-4 rounded-xl border p-5" aria-label="Cancel activity" aria-busy={saving}
    onSubmit={event => { event.preventDefault(); if (confirmed) startTransition(() => save({ requestId: initialRequestId, expectedVersion: version, reason, confirmed: true })); }}>
    <h2 className="text-xl font-semibold">Cancel activity</h2>
    <p className="leading-7">It stays in your history as cancelled and cannot be scheduled again from here.</p>
    <Field id={id + "reason"} label="Why it was cancelled" optional>{aria => <Input {...aria} value={reason} maxLength={500} disabled={!ready || saving} onChange={event => setReason(event.target.value)} />}</Field>
    <label htmlFor={id} className="flex min-h-11 items-center gap-3"><input id={id} type="checkbox" required checked={confirmed} disabled={!ready || saving} onChange={event => setConfirmed(event.target.checked)} />I want to cancel this activity.</label>
    <ProductionFormFeedback online={online} saving={saving} message={message} />
    <Button type="submit" variant="outline" disabled={!ready || !online || !confirmed || saving}>{saving ? "Cancelling…" : "Cancel activity"}</Button>
  </form>;
}
