"use client";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { closeFindingSchema, findingSchema, observationSchema, reviewSchema } from "@/modules/field-pilot/contracts/pilot";
import { OBSERVATION_KINDS, OBSERVED_SCREENS, type ObservationView, type ReviewDecision } from "@/modules/field-pilot/domain/evidence";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ProductionFormFeedback } from "@/components/production/form-feedback";
import { useProductionSubmit } from "@/components/production/use-production-submit";
import { decisionLabels, kindLabels, screenLabels } from "./labels";
import type { PseudonymChoice } from "./staff-forms";

const textarea = "w-full rounded-xl border border-border bg-white px-4 py-3";

export function ObservationForm({ submit, choices, today }: { submit: CommandSubmit; choices: PseudonymChoice[]; today: string }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof observationSchema>, unknown, z.output<typeof observationSchema>>({ resolver: zodResolver(observationSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, participationId: "", observedOn: today, screen: "EXPENSE_FORM", kind: "HESITATION", note: "" } });
  return <form ref={form} noValidate aria-label="Record an observation" className="space-y-5" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="observedFarmer" label="Farmer" optional>{aria => <Select {...aria} {...register("participationId")}><option value="">Not about one farmer</option>{choices.map(row => <option key={row.participationId} value={row.participationId}>{row.pseudonym}</option>)}</Select>}</Field>
      <Field id="observedOn" label="Date seen" error={errors.observedOn?.message}>{aria => <Input {...aria} type="date" {...register("observedOn")} />}</Field>
      <Field id="observedScreen" label="Where">{aria => <Select {...aria} {...register("screen")}>{OBSERVED_SCREENS.map(value => <option key={value} value={value}>{screenLabels[value]}</option>)}</Select>}</Field>
      <Field id="observedKind" label="What happened">{aria => <Select {...aria} {...register("kind")}>{OBSERVATION_KINDS.map(value => <option key={value} value={value}>{kindLabels[value]}</option>)}</Select>}</Field>
    </div>
    <Field id="observedNote" label="What you saw" hint="Describe what the farmer did or said, for example the words that confused them. No names or phone numbers." error={errors.note?.message}>{aria => <textarea {...aria} rows={3} maxLength={500} className={textarea} {...register("note")} />}</Field>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Saving…" : "Record observation"}</Button>
  </form>;
}

export function FindingForm({ submit, observations }: { submit: CommandSubmit; observations: ObservationView[] }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof findingSchema>, unknown, z.output<typeof findingSchema>>({ resolver: zodResolver(findingSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, title: "", observationIds: [] } });
  return <form ref={form} noValidate aria-label="Write a finding" className="space-y-5" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <Field id="findingTitle" label="Finding" hint="One sentence, for example “Farmers do not understand ‘expense category’”." error={errors.title?.message}>{aria => <Input {...aria} maxLength={160} {...register("title")} />}</Field>
    <fieldset aria-describedby={errors.observationIds ? "findingEvidence-error" : undefined}>
      <legend className="field-label">Observations behind it</legend>
      <ul className="space-y-2">{observations.map(row => <li key={row.observationId}><label className="flex min-h-12 items-start gap-3 leading-6">
        <input type="checkbox" value={row.observationId} className="mt-1 size-5" {...register("observationIds")} />
        <span><span className="font-semibold">{row.observedOn} · {screenLabels[row.screen]} · {kindLabels[row.kind]}{row.pseudonym ? " · " + row.pseudonym : ""}</span><br />{row.note}</span>
      </label></li>)}</ul>
      {errors.observationIds && <p id="findingEvidence-error" className="field-error">Tick at least one observation.</p>}
    </fieldset>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Saving…" : "Save finding"}</Button>
  </form>;
}

export function CloseFindingForm({ submit, version, label }: { submit: CommandSubmit; version: number; label: string }) {
  const state = useProductionSubmit(submit);
  const schema = closeFindingSchema.omit({ findingId: true });
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { requestId: state.initialRequestId, status: "ACTIONED", expectedVersion: version } });
  return <form aria-label={label} className="mt-3 flex flex-wrap items-end gap-3" onSubmit={handleSubmit(state.save)}>
    <Field id={"close-" + label} label="Close as">{aria => <Select {...aria} {...register("status")}><option value="ACTIONED">Acted on</option><option value="DISMISSED">Dismissed</option></Select>}</Field>
    <Button type="submit" variant="outline" disabled={isSubmitting || !state.online}>{isSubmitting ? "Saving…" : "Close finding"}</Button>
    {state.message && <p role="alert" className="field-error w-full">{state.message}</p>}
  </form>;
}

/** Only the decisions the evidence allows today are offered; the server checks again when saving. */
export function ReviewForm({ submit, allowed }: { submit: CommandSubmit; allowed: ReviewDecision[] }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof reviewSchema>, unknown, z.output<typeof reviewSchema>>({ resolver: zodResolver(reviewSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, decision: "CONTINUE", reason: "" } });
  return <form ref={form} noValidate aria-label="Record a decision" className="space-y-5" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <fieldset><legend className="field-label">Decision</legend>
      <div className="space-y-2">{allowed.map(value => <label key={value} className="flex min-h-12 items-center gap-3"><input type="radio" value={value} className="size-5" {...register("decision")} />{decisionLabels[value]}</label>)}</div>
    </fieldset>
    <Field id="reviewReason" label="Why" hint="Point to the findings and figures behind the decision." error={errors.reason?.message}>{aria => <textarea {...aria} rows={3} maxLength={1000} className={textarea} {...register("reason")} />}</Field>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Saving…" : "Record decision"}</Button>
  </form>;
}
