"use client";
import { useRef, useState } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { farmSchema, type FarmData, type FarmInput } from "@/modules/farmer-registry/contracts/registry";
import { FARM_ACTIVITIES, LAND_OWNERSHIP } from "@/modules/farmer-registry/domain/rules";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Field, focusFirstInvalid } from "./field";
import { activityLabels, ownershipLabels } from "./labels";

type Failure = { ok: false; message: string };

export function FarmForm({ submit, defaults }: { submit: (input: unknown) => Promise<Failure | undefined>; defaults?: DefaultValues<FarmInput> }) {
const [requestId] = useState(() => crypto.randomUUID());
const [message, setMessage] = useState("");
const form = useRef<HTMLFormElement>(null);
const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FarmInput, unknown, FarmData>({ resolver: zodResolver(farmSchema), shouldFocusError: false, defaultValues: { name: "", district: "", subcounty: "", village: "", approximateAcreage: "", latitude: "", longitude: "", ...defaults } });
return <form ref={form} noValidate className="space-y-6" onSubmit={handleSubmit(async data => {
setMessage("");
try { const result = await submit({ ...data, requestId }); if (result && !result.ok) setMessage(result.message); }
catch { setMessage("Connection interrupted. Your details are still here. Try again."); }
}, () => focusFirstInvalid(form.current))}>
<Field id="name" label="Farm name" hint="A name you will recognise, like “Home farm”." error={errors.name?.message}>{aria => <Input {...aria} {...register("name")} />}</Field>
<Field id="district" label="District" error={errors.district?.message}>{aria => <Input {...aria} {...register("district")} />}</Field>
<Field id="subcounty" label="Subcounty" optional error={errors.subcounty?.message}>{aria => <Input {...aria} {...register("subcounty")} />}</Field>
<Field id="village" label="Village" optional error={errors.village?.message}>{aria => <Input {...aria} {...register("village")} />}</Field>
<Field id="approximateAcreage" label="Approximate size in acres" optional hint="An estimate is fine." error={errors.approximateAcreage?.message}>{aria => <Input inputMode="decimal" {...aria} {...register("approximateAcreage")} />}</Field>
<Field id="ownershipType" label="How is this land held?" error={errors.ownershipType?.message}>{aria => <Select {...aria} {...register("ownershipType")}><option value="">Choose one</option>{LAND_OWNERSHIP.map(value => <option key={value} value={value}>{ownershipLabels[value]}</option>)}</Select>}</Field>
<Field id="primaryActivity" label="Main activity on this farm" error={errors.primaryActivity?.message}>{aria => <Select {...aria} {...register("primaryActivity")}><option value="">Choose one</option>{FARM_ACTIVITIES.map(value => <option key={value} value={value}>{activityLabels[value]}</option>)}</Select>}</Field>
<details className="rounded-xl border border-border bg-background p-4" open={!!(errors.latitude || errors.longitude)}>
<summary className="cursor-pointer font-semibold">GPS location (optional)</summary>
<p className="mt-2 text-sm text-foreground/70">Only add this if you want to. Enter both numbers, or leave both empty.</p>
<div className="mt-4 grid gap-4 sm:grid-cols-2">
<Field id="latitude" label="Latitude" error={errors.latitude?.message}>{aria => <Input inputMode="decimal" {...aria} {...register("latitude")} />}</Field>
<Field id="longitude" label="Longitude" error={errors.longitude?.message}>{aria => <Input inputMode="decimal" {...aria} {...register("longitude")} />}</Field>
</div></details>
{message && <p role="alert" className="field-error">{message}</p>}
<Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? "Saving…" : "Save farm"}</Button>
</form>;
}
