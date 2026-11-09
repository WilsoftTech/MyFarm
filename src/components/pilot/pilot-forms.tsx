"use client";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { joinCohortSchema, withdrawSchema, type JoinCohort } from "@/modules/field-pilot/contracts/pilot";
import { PILOT_CONSENT_POINTS, PILOT_CONSENT_VERSION } from "@/modules/field-pilot/domain/consent";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductionFormFeedback } from "@/components/production/form-feedback";
import { useProductionSubmit } from "@/components/production/use-production-submit";

/** The consent words are shown in full before the box, so agreeing is informed (D-P09-006). */
export function ConsentPoints() {
  return <ul className="list-disc space-y-2 pl-5 leading-7">{PILOT_CONSENT_POINTS.map(point => <li key={point}>{point}</li>)}</ul>;
}

export function JoinPilotForm({ submit }: { submit: CommandSubmit }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof joinCohortSchema>, unknown, JoinCohort>({ resolver: zodResolver(joinCohortSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, code: "", consentVersion: PILOT_CONSENT_VERSION } });
  return <form ref={form} noValidate aria-busy={isSubmitting} aria-label="Join the pilot" className="space-y-5" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <Field id="pilotCode" label="Pilot code" hint="The MyFarm team gives you this code. Spaces and dashes do not matter." error={errors.code?.message}>{aria => <Input {...aria} autoComplete="off" autoCapitalize="characters" maxLength={20} {...register("code")} />}</Field>
    <section aria-labelledby="consentHeading" className="rounded-xl border border-border p-4">
      <h2 id="consentHeading" className="font-semibold">What joining means</h2>
      <div className="mt-2"><ConsentPoints /></div>
    </section>
    <div>
      <label className="flex min-h-12 items-start gap-3 leading-7">
        <input type="checkbox" className="mt-1.5 size-5" aria-invalid={Boolean(errors.agreed)} aria-describedby={errors.agreed ? "pilotAgree-error" : undefined} {...register("agreed")} />
        <span>I have read this and I agree to join the pilot.</span>
      </label>
      {errors.agreed && <p id="pilotAgree-error" className="field-error">{errors.agreed.message}</p>}
    </div>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Joining…" : "Join the pilot"}</Button>
  </form>;
}

export function LeavePilotForm({ submit, version }: { submit: CommandSubmit; version: number }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const schema = withdrawSchema.omit({ participationId: true });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, expectedVersion: version } });
  return <form ref={form} noValidate aria-busy={isSubmitting} aria-label="Leave the pilot" className="space-y-4" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <p className="leading-7">If you leave, the team stops counting anything about you, including what was counted before. Your farm records stay as they are. You cannot join this pilot again.</p>
    <div>
      <label className="flex min-h-12 items-start gap-3 leading-7">
        <input type="checkbox" className="mt-1.5 size-5" aria-invalid={Boolean(errors.confirmed)} aria-describedby={errors.confirmed ? "pilotLeave-error" : undefined} {...register("confirmed")} />
        <span>Yes, I want to leave the pilot.</span>
      </label>
      {errors.confirmed && <p id="pilotLeave-error" className="field-error">Tick the box if you want to leave.</p>}
    </div>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" variant="outline" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Leaving…" : "Leave the pilot"}</Button>
  </form>;
}
