"use client";
import { useId, useState, useTransition } from "react";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field } from "@/components/farmer-registry/field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ProductionFormFeedback } from "@/components/production/form-feedback";
import { useProductionSubmit } from "@/components/production/use-production-submit";

export interface SupplyChoice { itemId: string; name: string; unit: string }

/** D-P10-007: the farmer picks once which supply item this batch is fed from. Choosing it never moves stock. */
export function FeedItemForm({ supplies, current, version, submit }: { supplies: SupplyChoice[]; current: string | null; version: number | null; submit: CommandSubmit }) {
  const id = useId(), [itemId, setItemId] = useState(current ?? ""), [saving, startTransition] = useTransition();
  const { initialRequestId, online, ready, message, save } = useProductionSubmit(submit);
  const chosen = supplies.find(row => row.itemId === itemId);
  return <form className="mt-4 max-w-2xl space-y-4" aria-label="Feed for this batch" aria-busy={saving}
    onSubmit={event => { event.preventDefault(); if (itemId) startTransition(() => save({ requestId: initialRequestId, itemId, expectedVersion: version })); }}>
    <Field id={id} label="Feed item in stock" hint="Feed given to this batch is compared with this item's stock to warn when it runs low. Only an item counted in kg can be compared.">{aria =>
      <Select {...aria} value={itemId} required disabled={!ready || saving} onChange={event => setItemId(event.target.value)}>
        <option value="">Choose the feed this batch eats</option>
        {supplies.map(row => <option key={row.itemId} value={row.itemId}>{row.name} ({row.unit})</option>)}
      </Select>}</Field>
    {chosen && chosen.unit !== "KG" && <p role="status" className="rounded-xl bg-muted p-3 text-sm">This item is not counted in kg, so MyFarm cannot tell how many days it will last.</p>}
    <ProductionFormFeedback online={online} saving={saving} message={message} />
    <Button type="submit" variant="outline" disabled={!ready || !online || saving || !itemId || itemId === current}>{saving ? "Saving…" : "Save feed item"}</Button>
  </form>;
}
