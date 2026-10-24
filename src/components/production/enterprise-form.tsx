"use client";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createEnterpriseSchema, type CreateEnterprise } from "@/modules/enterprises-seasons/contracts/production";
import { ENTERPRISE_TYPES } from "@/modules/enterprises-seasons/domain/production";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { enterpriseTypeLabels } from "./labels";
import { ProductionFormFeedback } from "./form-feedback";
import { useProductionSubmit } from "./use-production-submit";

export function EnterpriseForm({ submit }: { submit: CommandSubmit }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateEnterprise>({ resolver: zodResolver(createEnterpriseSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, name: "" } });
  return <form ref={form} noValidate aria-busy={isSubmitting} className="space-y-5" onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    <Field id="enterpriseName" label="Enterprise name" hint="For example “Maize”, “Coffee” or “Layers”." error={errors.name?.message}>{aria => <Input {...aria} maxLength={120} {...register("name")} />}</Field>
    <Field id="enterpriseType" label="Enterprise type" error={errors.type?.message}>{aria => <Select {...aria} {...register("type")}><option value="">Choose one</option>{ENTERPRISE_TYPES.map(value => <option key={value} value={value}>{enterpriseTypeLabels[value]}</option>)}</Select>}</Field>
    <p className="text-sm leading-6 text-foreground/75">Save a separate enterprise for each part of the farm you want to track. Detailed crop and animal records will be available later.</p>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Saving…" : "Save enterprise"}</Button>
  </form>;
}
