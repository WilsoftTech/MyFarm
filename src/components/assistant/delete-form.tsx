"use client";
import { useTransition } from "react";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Button } from "@/components/ui/button";
import { useProductionSubmit } from "@/components/production/use-production-submit";

/** The farmer deletes their own question before its 90 days (D-P11-003). */
export function DeleteQuestionForm({ question, submit }: { question: string; submit: CommandSubmit }) {
  const [saving, startTransition] = useTransition();
  const { initialRequestId, online, ready, message, save } = useProductionSubmit(submit);
  return <form className="mt-3" aria-label={"Delete question: " + question} aria-busy={saving}
    onSubmit={event => { event.preventDefault(); startTransition(() => save({ requestId: initialRequestId })); }}>
    {message && <p role="alert" className="field-error mb-2">{message}</p>}
    <Button type="submit" variant="outline" disabled={!ready || !online || saving}>{saving ? "Deleting…" : "Delete this question"}</Button>
  </form>;
}
