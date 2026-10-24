"use client";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createSeasonSchema, type CreateSeason } from "@/modules/enterprises-seasons/contracts/production";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductionFormFeedback } from "./form-feedback";
import { useProductionSubmit } from "./use-production-submit";

export function SeasonForm({ submit }: { submit: CommandSubmit }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof createSeasonSchema>, unknown, CreateSeason>({ resolver: zodResolver(createSeasonSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, label: "", startDate: "", endDate: "" } });
  return <form ref={form} noValidate aria-busy={isSubmitting} className="space-y-5" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <Field id="seasonLabel" label="Season name" hint="For example “2026 Season A”. Seasons on a farm may overlap." error={errors.label?.message}>{aria => <Input {...aria} maxLength={120} {...register("label")} />}</Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="seasonStart" label="Start date" error={errors.startDate?.message}>{aria => <Input {...aria} type="date" min="0001-01-01" max="9999-12-31" {...register("startDate")} />}</Field>
      <Field id="seasonEnd" label="End date" optional hint="Leave empty if you do not know it yet." error={errors.endDate?.message}>{aria => <Input {...aria} type="date" min="0001-01-01" max="9999-12-31" {...register("endDate")} />}</Field>
    </div>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Saving…" : "Save season"}</Button>
  </form>;
}
