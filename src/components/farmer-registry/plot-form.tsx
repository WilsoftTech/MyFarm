"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { plotSchema, type PlotData, type PlotInput } from "@/modules/farmer-registry/contracts/registry";
import { AREA_UNITS } from "@/modules/farmer-registry/domain/rules";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Field, focusFirstInvalid } from "./field";
import { areaUnitLabels } from "./labels";

type Failure = { ok: false; message: string };

export function PlotForm({ submit }: { submit: (input: unknown) => Promise<Failure | undefined> }) {
const [requestId] = useState(() => crypto.randomUUID());
const [message, setMessage] = useState("");
const form = useRef<HTMLFormElement>(null);
const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PlotInput, unknown, PlotData>({ resolver: zodResolver(plotSchema), shouldFocusError: false, defaultValues: { name: "", area: "", areaUnit: "" } });
return <form ref={form} noValidate className="space-y-5" onSubmit={handleSubmit(async data => {
setMessage("");
try { const result = await submit({ ...data, requestId }); if (result && !result.ok) setMessage(result.message); }
catch { setMessage("Connection interrupted. Your details are still here. Try again."); }
}, () => focusFirstInvalid(form.current))}>
<Field id="plotName" label="Plot name" hint="For example “Plot A” or “Near the river”." error={errors.name?.message}>{aria => <Input {...aria} {...register("name")} />}</Field>
<div className="grid gap-4 sm:grid-cols-2">
<Field id="area" label="Area" optional error={errors.area?.message}>{aria => <Input inputMode="decimal" {...aria} {...register("area")} />}</Field>
<Field id="areaUnit" label="Area unit" optional error={errors.areaUnit?.message}>{aria => <Select {...aria} {...register("areaUnit")}><option value="">No unit</option>{AREA_UNITS.map(value => <option key={value} value={value}>{areaUnitLabels[value]}</option>)}</Select>}</Field>
</div>
{message && <p role="alert" className="field-error">{message}</p>}
<Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">{isSubmitting ? "Adding…" : "Add plot"}</Button>
</form>;
}
