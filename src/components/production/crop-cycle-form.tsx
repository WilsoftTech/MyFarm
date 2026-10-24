"use client";
import Link from "next/link";
import { useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { startCropCycleSchema, type StartCropCycle } from "@/modules/enterprises-seasons/contracts/crop-cycle";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { areaUnitLabels } from "@/components/farmer-registry/labels";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CropChoiceField } from "./crop-choice-field";
import type { CropChoiceLoad, CropChoicePages } from "./crop-choice-types";
import { useProductionSubmit } from "./use-production-submit";
import { ProductionFormFeedback } from "./form-feedback";

export function CropCycleForm({ farmId, choices, enterpriseId, submit, load }: { farmId: string; choices: CropChoicePages; enterpriseId?: string; submit: CommandSubmit; load: CropChoiceLoad }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<z.input<typeof startCropCycleSchema>, unknown, StartCropCycle>({ resolver: zodResolver(startCropCycleSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, enterpriseId: enterpriseId ?? "", seasonId: "", plotId: "", cropId: "", variety: "", areaPlanted: "", plantingDate: "", expectedHarvest: "", areaExceptionReason: "" } });
  const unit = useWatch({ control, name: "areaUnit" });
  const missing = Object.entries(choices).filter(([, page]) => !page.nextCursor && !page.items.some(row => !row.disabled)).map(([kind]) => kind);
  if (missing.length) return <div className="space-y-4 leading-7"><h2 className="text-xl font-semibold">Set up this farm before planting</h2>
    {missing.includes("enterprises") && <p>Add an active crop enterprise. <Link className="underline" href={"/farms/" + farmId + "/enterprises/new"}>Add enterprise</Link></p>}
    {missing.includes("seasons") && <p>Add an active season. <Link className="underline" href={"/farms/" + farmId + "/seasons/new"}>Add season</Link></p>}
    {missing.includes("plots") && <p>Add a plot with its area and unit recorded. <Link className="underline" href={"/farms/" + farmId}>Open farm plots</Link></p>}
    {missing.includes("crops") && <p>No crops are available to choose. Ask farm support to check the crop list.</p>}
  </div>;
  return <form ref={form} noValidate aria-busy={isSubmitting || !state.ready} onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    {!state.ready && <p role="status">Loading form…</p>}
    <fieldset disabled={!state.ready} className="min-w-0 space-y-5"><legend className="sr-only">Crop cycle details</legend>
    <CropChoiceField id="cycleEnterprise" label="Enterprise" kind="enterprises" initial={choices.enterprises} control={register("enterpriseId")} error={errors.enterpriseId ? "Choose an active crop enterprise." : undefined} online={state.online} load={load} />
    <CropChoiceField id="cycleSeason" label="Season" kind="seasons" initial={choices.seasons} control={register("seasonId")} error={errors.seasonId ? "Choose an active season." : undefined} online={state.online} load={load} />
    <CropChoiceField id="cyclePlot" label="Plot" kind="plots" initial={choices.plots} control={register("plotId")} error={errors.plotId ? "Choose a plot with its area recorded." : undefined} online={state.online} load={load} onSelect={choice => { if (choice?.areaUnit) setValue("areaUnit", choice.areaUnit, { shouldValidate: true }); }} />
    <CropChoiceField id="cycleCrop" label="Crop" kind="crops" initial={choices.crops} control={register("cropId")} error={errors.cropId ? "Choose a crop." : undefined} online={state.online} load={load} />
    <Field id="cycleVariety" label="Variety" optional error={errors.variety?.message}>{aria => <Input {...aria} maxLength={120} {...register("variety")} />}</Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="cycleArea" label="Area planted" hint="Use the same unit as the plot. All active crops on the plot count toward its area." error={errors.areaPlanted?.message}>{aria => <Input {...aria} inputMode="decimal" {...register("areaPlanted")} />}</Field>
      <Field id="cycleUnit" label="Area unit" hint="Matches the chosen plot. Units are not converted." error={errors.areaUnit?.message}>{aria => <Input {...aria} readOnly value={unit ? areaUnitLabels[unit] : "Choose a plot first"} />}</Field>
    </div>
    <input type="hidden" {...register("areaUnit")} />
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="cyclePlanting" label="Planting date" error={errors.plantingDate?.message}>{aria => <Input {...aria} type="date" min="0001-01-01" max="9999-12-31" {...register("plantingDate")} />}</Field>
      <Field id="cycleHarvest" label="Expected harvest date" optional hint="Leave empty for a perennial crop or if you do not know yet." error={errors.expectedHarvest?.message}>{aria => <Input {...aria} type="date" min="0001-01-01" max="9999-12-31" {...register("expectedHarvest")} />}</Field>
    </div>
    <Field id="cycleReason" label="Reason for extra planted area" optional hint="Required if the total active planted area exceeds the plot's recorded area, for example when crops overlap. The reason is saved with this cycle." error={errors.areaExceptionReason?.message}>{aria => <Input {...aria} maxLength={500} {...register("areaExceptionReason")} />}</Field>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Saving…" : "Save crop cycle"}</Button>
    </fieldset>
  </form>;
}
