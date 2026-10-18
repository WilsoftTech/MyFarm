"use client";
import Link from "next/link";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { startPoultryBatchSchema, type StartPoultryBatch } from "@/modules/enterprises-seasons/contracts/poultry-batch";
import { POULTRY_PURPOSES } from "@/modules/enterprises-seasons/domain/poultry-batch";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChoiceField } from "./choice-field";
import type { PoultryChoiceLoad, PoultryChoicePages } from "./choice-types";
import { poultryPurposeLabels } from "./labels";
import { useProductionSubmit } from "./use-production-submit";
import { ProductionFormFeedback } from "./form-feedback";

export function PoultryBatchForm({ farmId, choices, enterpriseId, submit, load }: { farmId: string; choices: PoultryChoicePages; enterpriseId?: string; submit: CommandSubmit; load: PoultryChoiceLoad }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof startPoultryBatchSchema>, unknown, StartPoultryBatch>({ resolver: zodResolver(startPoultryBatchSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, enterpriseId: enterpriseId ?? "", animalTypeId: "", breed: "", batchLabel: "", startingQuantity: "", acquisitionDate: "" } });
  const missing = Object.entries(choices).filter(([, page]) => !page.nextCursor && !page.items.some(row => !row.disabled)).map(([kind]) => kind);
  if (missing.length) return <div className="space-y-4 leading-7"><h2 className="text-xl font-semibold">Set up this farm before adding a batch</h2>
    {missing.includes("enterprises") && <p>Add an active poultry enterprise. <Link className="underline" href={"/farms/" + farmId + "/enterprises/new"}>Add enterprise</Link></p>}
    {missing.includes("animal-types") && <p>No animal types are available to choose. Ask farm support to check the animal type list.</p>}
  </div>;
  return <form ref={form} noValidate aria-busy={isSubmitting || !state.ready} onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    {!state.ready && <p role="status">Loading form…</p>}
    <fieldset disabled={!state.ready} className="min-w-0 space-y-5"><legend className="sr-only">Poultry batch details</legend>
    <ChoiceField id="batchEnterprise" label="Enterprise" kind="enterprises" initial={choices.enterprises} control={register("enterpriseId")} error={errors.enterpriseId ? "Choose an active poultry enterprise." : undefined} online={state.online} load={load} />
    <Field id="batchLabel" label="Batch name" hint="For example Batch #004. Each batch on this farm needs its own name, including finished batches." error={errors.batchLabel?.message}>{aria => <Input {...aria} maxLength={120} {...register("batchLabel")} />}</Field>
    <ChoiceField id="batchAnimalType" label="Animal type" kind="animal-types" initial={choices["animal-types"]} control={register("animalTypeId")} error={errors.animalTypeId ? "Choose an animal type." : undefined} online={state.online} load={load} />
    <Field id="batchBreed" label="Breed" optional hint="For example Kuroiler or a local breed." error={errors.breed?.message}>{aria => <Input {...aria} maxLength={120} {...register("breed")} />}</Field>
    <Field id="batchPurpose" label="Production purpose" error={errors.purpose ? "Choose a production purpose." : undefined}>{aria => <Select {...aria} {...register("purpose")}><option value="">Choose one</option>{POULTRY_PURPOSES.map(value => <option key={value} value={value}>{poultryPurposeLabels[value]}</option>)}</Select>}</Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="batchQuantity" label="Starting number of birds" hint="Whole birds only, 0 or more." error={errors.startingQuantity?.message}>{aria => <Input {...aria} inputMode="numeric" {...register("startingQuantity")} />}</Field>
      <Field id="batchAcquired" label="Acquisition date" hint="The date the birds arrived or hatched." error={errors.acquisitionDate?.message}>{aria => <Input {...aria} type="date" min="0001-01-01" max="9999-12-31" {...register("acquisitionDate")} />}</Field>
    </div>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Saving…" : "Save poultry batch"}</Button>
    </fieldset>
  </form>;
}
