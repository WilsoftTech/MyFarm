"use client";
import { useId, useState, useTransition } from "react";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field } from "@/components/farmer-registry/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductionFormFeedback } from "./form-feedback";
import { useProductionSubmit } from "./use-production-submit";

/** A one-way activity action: one field, then an explicit confirmation before it can be sent. */
export function ActivityConfirmForm({ title, body, confirm, pending, version, field, submit }: { title: string; body: string; confirm: string; pending: string; version: number; field: { name: string; label: string; type?: "text" | "date"; optional?: boolean; maxLength?: number }; submit: CommandSubmit }) {
  const id = useId(), [confirmed, setConfirmed] = useState(false), [value, setValue] = useState(""), [saving, startTransition] = useTransition();
  const { initialRequestId, online, ready, message, save } = useProductionSubmit(submit);
  const complete = confirmed && (field.optional || value !== "");
  return <form className="mt-6 max-w-2xl space-y-4 rounded-xl border p-5" aria-label={title} aria-busy={saving}
    onSubmit={event => { event.preventDefault(); if (complete) startTransition(() => save({ requestId: initialRequestId, expectedVersion: version, [field.name]: value, confirmed: true })); }}>
    <h2 className="text-xl font-semibold">{title}</h2>
    <p className="leading-7">{body}</p>
    <Field id={id + "field"} label={field.label} optional={field.optional}>{aria => <Input {...aria} type={field.type ?? "text"} value={value} maxLength={field.maxLength} required={!field.optional} disabled={!ready || saving} onChange={event => setValue(event.target.value)} />}</Field>
    <label htmlFor={id} className="flex min-h-11 items-center gap-3"><input id={id} type="checkbox" required checked={confirmed} disabled={!ready || saving} onChange={event => setConfirmed(event.target.checked)} />{confirm}</label>
    <ProductionFormFeedback online={online} saving={saving} message={message} />
    <Button type="submit" variant="outline" disabled={!ready || !online || !complete || saving}>{saving ? pending : title}</Button>
  </form>;
}
