"use client";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import type { ChoiceLoad, ChoicePage } from "./choice-types";
import { ChoiceField } from "./choice-field";
import { useProductionSubmit } from "./use-production-submit";
import { ProductionFormFeedback } from "./form-feedback";

export interface RecordField {
  name: string; label: string; optional?: boolean; hint?: string;
  type?: "text" | "date" | "number" | "checkbox"; defaultValue?: string; step?: string; min?: string;
  autoUnit?: boolean; readOnly?: boolean;
  choices?: ChoicePage; kind?: string;
}
/** Shared record entry layout; domain validation and authorization stay in the application service. */
export function RecordForm({ fields, submit, load, label }: { fields: RecordField[]; submit: CommandSubmit; load: ChoiceLoad<string>; label: string }) {
  const state = useProductionSubmit(submit), ref = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Record<string, string | boolean>>({ shouldFocusError: false,
    defaultValues: { ...Object.fromEntries(fields.map(f => [f.name, f.type === "checkbox" ? false : f.defaultValue ?? ""])), requestId: state.initialRequestId } });
  return <form ref={ref} aria-busy={isSubmitting || !state.ready} onSubmit={handleSubmit(data => state.save({ ...data, requestId: state.initialRequestId }), () => focusFirstInvalid(ref.current))}>
    <fieldset disabled={!state.ready || isSubmitting} className="min-w-0 space-y-5"><legend className="sr-only">{label}</legend>
      {fields.map(f => {
        const control = register(f.name, { required: f.optional ? false : "Enter " + f.label.toLowerCase() + "." });
        const error = errors[f.name]?.message;
        return f.choices ? <ChoiceField key={f.name} id={f.name} label={f.label} kind={f.kind ?? f.name} initial={f.choices} control={control} error={error} optional={f.optional} hint={f.hint} online={state.online} load={load} onSelect={choice => { if (f.autoUnit) setValue("unit", choice?.unit ?? ""); }} /> :
          <Field key={f.name} id={f.name} label={f.label} optional={f.optional} hint={f.hint} error={error}>{aria => <Input {...aria} {...control} type={f.type ?? "text"} readOnly={f.readOnly} className={f.type === "checkbox" ? "h-6 w-6" : undefined} required={!f.optional} maxLength={f.type === "text" || !f.type ? 500 : undefined} step={f.step} min={f.min} />}</Field>;
      })}
      <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
      <Button type="submit" disabled={!state.online || isSubmitting}>{isSubmitting ? "Saving..." : label}</Button>
    </fieldset>
  </form>;
}
