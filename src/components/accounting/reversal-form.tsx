"use client";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { confirmReversalSchema, type ConfirmReversal } from "@/modules/farm-accounting/contracts/accounting";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProductionSubmit } from "@/components/production/use-production-submit";
import { ProductionFormFeedback } from "@/components/production/form-feedback";

/** Corrections append a reversal with a reason; the original stays readable (D-P04-002). */
export function ReversalForm({ label, note, submit }: { label: string; note: string; submit: CommandSubmit }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof confirmReversalSchema>, unknown, ConfirmReversal>({ resolver: zodResolver(confirmReversalSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, reason: "" } });
  return <form ref={form} noValidate aria-label={"Reverse " + label} aria-busy={isSubmitting || !state.ready} className="mt-6 rounded-2xl border border-border bg-white p-6" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <fieldset disabled={!state.ready} className="min-w-0 space-y-4"><legend className="text-xl font-semibold">Reverse {label}</legend>
    <p className="leading-7">Use this if the record is wrong. It stays in your history marked as reversed and stops counting. Reversing is final; record a new one if needed. {note}</p>
    <Field id="reversalReason" label="Reason" hint="For example: entered twice, or wrong amount." error={errors.reason?.message}>{aria => <Input {...aria} maxLength={500} autoComplete="off" {...register("reason")} />}</Field>
    <div><label htmlFor="reversalConfirmed" className="flex min-h-11 items-center gap-3"><input id="reversalConfirmed" type="checkbox" aria-invalid={!!errors.confirmed} aria-describedby={errors.confirmed ? "reversalConfirmed-error" : undefined} {...register("confirmed")} />I understand that reversing is final.</label>
    {errors.confirmed && <p id="reversalConfirmed-error" role="alert" className="field-error">{errors.confirmed.message}</p>}</div>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" variant="outline" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Reversing…" : "Reverse " + label}</Button>
    </fieldset>
  </form>;
}
