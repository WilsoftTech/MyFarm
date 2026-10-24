"use client";
import { useId, useState, useTransition } from "react";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Button } from "@/components/ui/button";
import { ProductionFormFeedback } from "./form-feedback";
import { useProductionSubmit } from "./use-production-submit";

export function ProductionClosureForm({ label, version, season = false, submit }: { label: string; version: number; season?: boolean; submit: CommandSubmit }) {
  const id = useId(), [confirmed, setConfirmed] = useState(false), [saving, startTransition] = useTransition();
  const { initialRequestId, online, ready, message, save } = useProductionSubmit(submit);
  return <form className="mt-6 space-y-4 rounded-2xl border border-border bg-white p-6" aria-label={"Close " + label} aria-busy={saving}
    onSubmit={event => { event.preventDefault(); if (confirmed) startTransition(() => save({ requestId: initialRequestId, expectedVersion: version, confirmed: true })); }}>
    <h2 className="text-xl font-semibold">Close {label}</h2>
    <p className="leading-7">Closing is final. This record stays in your history and cannot be reopened.{season ? " Close every active crop cycle in this season first." : " Its planted area will no longer count as active use of the plot."}</p>
    <label htmlFor={id} className="flex min-h-11 items-center gap-3"><input id={id} type="checkbox" required checked={confirmed} disabled={!ready || saving} onChange={event => setConfirmed(event.target.checked)} />I understand that closing is final.</label>
    <ProductionFormFeedback online={online} saving={saving} message={message} />
    <Button type="submit" disabled={!ready || !online || !confirmed || saving}>{saving ? "Closing…" : "Close " + label}</Button>
  </form>;
}
