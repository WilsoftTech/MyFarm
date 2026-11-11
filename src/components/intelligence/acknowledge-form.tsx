"use client";
import { useTransition } from "react";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Button } from "@/components/ui/button";
import { ProductionFormFeedback } from "@/components/production/form-feedback";
import { useProductionSubmit } from "@/components/production/use-production-submit";

/** Marks one insight as seen. A retry keeps its request ID; the server checks the version the farmer saw. */
export function AcknowledgeForm({ title, version, submit }: { title: string; version: number; submit: CommandSubmit }) {
  const [saving, startTransition] = useTransition();
  const { initialRequestId, online, ready, message, save } = useProductionSubmit(submit);
  return <form className="mt-4 space-y-3" aria-label={"Mark as seen: " + title} aria-busy={saving}
    onSubmit={event => { event.preventDefault(); startTransition(() => save({ requestId: initialRequestId, expectedVersion: version })); }}>
    <ProductionFormFeedback online={online} saving={saving} message={message} />
    <Button type="submit" variant="outline" disabled={!ready || !online || saving}>{saving ? "Saving…" : "I have seen this"}</Button>
  </form>;
}
