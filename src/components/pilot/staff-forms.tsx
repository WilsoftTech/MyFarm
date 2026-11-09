"use client";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createCohortSchema, paperConsentSchema, PROMPT_CHANNELS, promptSchema, resolveIncidentSchema, SUPPORT_CATEGORIES, supportIncidentSchema } from "@/modules/field-pilot/contracts/pilot";
import { SUPPORT_SEVERITIES } from "@/modules/field-pilot/domain/measures";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ProductionFormFeedback } from "@/components/production/form-feedback";
import { useProductionSubmit } from "@/components/production/use-production-submit";
import { categoryLabels, channelLabels, severityLabels } from "./labels";

export interface PseudonymChoice { participationId: string; pseudonym: string }

function Frame({ children, submitting, state, action }: { children: React.ReactNode; submitting: boolean; state: ReturnType<typeof useProductionSubmit>; action: string }) {
  return <>
    {children}
    <ProductionFormFeedback online={state.online} saving={submitting} message={state.message} />
    <Button type="submit" disabled={submitting || !state.online} className="w-full sm:w-auto">{submitting ? "Saving…" : action}</Button>
  </>;
}

export function CohortForm({ submit }: { submit: CommandSubmit }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof createCohortSchema>, unknown, z.output<typeof createCohortSchema>>({ resolver: zodResolver(createCohortSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, name: "", startOn: "", endOn: "" } });
  return <form ref={form} noValidate aria-label="Open a cohort" className="space-y-5" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <Frame submitting={isSubmitting} state={state} action="Open cohort">
      <Field id="cohortName" label="Cohort name" hint="For example the district and season. No farmer names." error={errors.name?.message}>{aria => <Input {...aria} maxLength={120} {...register("name")} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cohortStart" label="First day" error={errors.startOn?.message}>{aria => <Input {...aria} type="date" {...register("startOn")} />}</Field>
        <Field id="cohortEnd" label="Last day" hint="One season, at most 200 days." error={errors.endOn?.message}>{aria => <Input {...aria} type="date" {...register("endOn")} />}</Field>
      </div>
    </Frame>
  </form>;
}

function Pseudonyms({ id, choices, error, register, optional }: { id: string; choices: PseudonymChoice[]; error?: string; register: object; optional?: boolean }) {
  return <Field id={id} label="Farmer" optional={optional} error={error}>{aria => <Select {...aria} {...register}>
    <option value="">{optional ? "Not about one farmer" : "Choose…"}</option>
    {choices.map(row => <option key={row.participationId} value={row.participationId}>{row.pseudonym}</option>)}
  </Select>}</Field>;
}

export function PromptForm({ submit, choices, today }: { submit: CommandSubmit; choices: PseudonymChoice[]; today: string }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof promptSchema>, unknown, z.output<typeof promptSchema>>({ resolver: zodResolver(promptSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, participationId: "", promptedOn: today, channel: "CALL" } });
  return <form ref={form} noValidate aria-label="Log a reminder" className="space-y-5" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <p className="leading-7">Log every call, message or visit that reminds a farmer to use MyFarm. That week then does not count as unprompted use.</p>
    <Frame submitting={isSubmitting} state={state} action="Log reminder">
      <Pseudonyms id="promptFarmer" choices={choices} error={errors.participationId ? "Choose a farmer." : undefined} register={register("participationId")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="promptDate" label="Date" error={errors.promptedOn?.message}>{aria => <Input {...aria} type="date" {...register("promptedOn")} />}</Field>
        <Field id="promptChannel" label="How">{aria => <Select {...aria} {...register("channel")}>{PROMPT_CHANNELS.map(value => <option key={value} value={value}>{channelLabels[value]}</option>)}</Select>}</Field>
      </div>
    </Frame>
  </form>;
}

export function IncidentForm({ submit, choices, today }: { submit: CommandSubmit; choices: PseudonymChoice[]; today: string }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof supportIncidentSchema>, unknown, z.output<typeof supportIncidentSchema>>({ resolver: zodResolver(supportIncidentSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, participationId: "", openedOn: today, category: "SYNC", severity: "MEDIUM", summary: "" } });
  return <form ref={form} noValidate aria-label="Log a support incident" className="space-y-5" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <Frame submitting={isSubmitting} state={state} action="Log incident">
      <Pseudonyms id="incidentFarmer" optional choices={choices} register={register("participationId")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="incidentDate" label="Date" error={errors.openedOn?.message}>{aria => <Input {...aria} type="date" {...register("openedOn")} />}</Field>
        <Field id="incidentCategory" label="What about">{aria => <Select {...aria} {...register("category")}>{SUPPORT_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabels[value]}</option>)}</Select>}</Field>
        <Field id="incidentSeverity" label="How serious">{aria => <Select {...aria} {...register("severity")}>{SUPPORT_SEVERITIES.map(value => <option key={value} value={value}>{severityLabels[value]}</option>)}</Select>}</Field>
      </div>
      <Field id="incidentSummary" label="What happened" hint="Do not write names or phone numbers; the code name identifies the farmer." error={errors.summary?.message}>{aria => <textarea {...aria} rows={3} maxLength={500} className="w-full rounded-xl border border-border bg-white px-4 py-3" {...register("summary")} />}</Field>
    </Frame>
  </form>;
}

export function ResolveForm({ submit, version, today, label }: { submit: CommandSubmit; version: number; today: string; label: string }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const schema = resolveIncidentSchema.omit({ incidentId: true });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, resolvedOn: today, expectedVersion: version } });
  return <form ref={form} noValidate aria-label={label} className="mt-3 flex flex-wrap items-end gap-3" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <Field id={"resolve-" + label} label="Resolved on" error={errors.resolvedOn?.message}>{aria => <Input {...aria} type="date" {...register("resolvedOn")} />}</Field>
    <Button type="submit" variant="outline" disabled={isSubmitting || !state.online}>{isSubmitting ? "Saving…" : "Mark resolved"}</Button>
    {state.message && <p role="alert" className="field-error w-full">{state.message}</p>}
  </form>;
}

export function PaperConsentForm({ submit, version, label }: { submit: CommandSubmit; version: number; label: string }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const schema = paperConsentSchema.omit({ participationId: true });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, paperConsentRef: "", expectedVersion: version } });
  return <form ref={form} noValidate aria-label={label} className="flex flex-wrap items-end gap-3" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <Field id={"consent-" + label} label="Paper form reference" hint="The number on the signed form, not a name." error={errors.paperConsentRef?.message}>{aria => <Input {...aria} maxLength={60} {...register("paperConsentRef")} />}</Field>
    <Button type="submit" variant="outline" disabled={isSubmitting || !state.online}>{isSubmitting ? "Saving…" : "Record"}</Button>
    {state.message && <p role="alert" className="field-error w-full">{state.message}</p>}
  </form>;
}
