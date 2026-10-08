"use client";
import { useRef, useState } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { farmerProfileSchema, type FarmerProfileData, type FarmerProfileInput } from "@/modules/farmer-registry/contracts/registry";
import { FARM_ACTIVITIES, LAND_OWNERSHIP, PREFERRED_LANGUAGES } from "@/modules/farmer-registry/domain/rules";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Field, focusFirstInvalid } from "./field";
import { activityLabels, languageLabels, ownershipLabels } from "./labels";

type Failure = { ok: false; message: string };
// Land arrangement starts unset so the farmer must choose it explicitly.
const empty: DefaultValues<FarmerProfileInput> = { name: "", phone: "", alternativePhone: "", district: "", subcounty: "", village: "", preferredLanguage: "en", mainActivities: [] };

export function FarmerProfileForm({ submit, defaults, expectedVersion }: { submit: (input: unknown) => Promise<Failure | undefined>; defaults?: FarmerProfileInput; expectedVersion?: number }) {
// One request ID per form visit: retries after a lost response replay instead of duplicating.
const [requestId] = useState(() => crypto.randomUUID());
const [message, setMessage] = useState("");
const form = useRef<HTMLFormElement>(null);
const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FarmerProfileInput, unknown, FarmerProfileData>({ resolver: zodResolver(farmerProfileSchema), defaultValues: defaults ?? empty, shouldFocusError: false });
const editing = expectedVersion !== undefined;
return <form ref={form} noValidate className="space-y-6" onSubmit={handleSubmit(async data => {
setMessage("");
try { const result = await submit({ ...data, requestId, ...(editing ? { expectedVersion } : {}) }); if (result && !result.ok) setMessage(result.message); }
catch { setMessage("Connection interrupted. Your details are still here. Try again."); }
}, () => focusFirstInvalid(form.current))}>
<Field id="name" label="Full name" error={errors.name?.message}>{aria => <Input autoComplete="name" {...aria} {...register("name")} />}</Field>
<Field id="phone" label="Phone number" hint="Used to contact you about your records. It is not used to sign in." error={errors.phone?.message}>{aria => <Input type="tel" inputMode="tel" autoComplete="tel" {...aria} {...register("phone")} />}</Field>
<Field id="alternativePhone" label="Alternative phone number" optional error={errors.alternativePhone?.message}>{aria => <Input type="tel" inputMode="tel" {...aria} {...register("alternativePhone")} />}</Field>
<Field id="district" label="District" error={errors.district?.message}>{aria => <Input {...aria} {...register("district")} />}</Field>
<Field id="subcounty" label="Subcounty" optional error={errors.subcounty?.message}>{aria => <Input {...aria} {...register("subcounty")} />}</Field>
<Field id="village" label="Village" optional error={errors.village?.message}>{aria => <Input {...aria} {...register("village")} />}</Field>
<Field id="preferredLanguage" label="Preferred language" hint="MyFarm is currently shown in English. This helps us plan other languages." error={errors.preferredLanguage?.message}>{aria => <Select {...aria} {...register("preferredLanguage")}>{PREFERRED_LANGUAGES.map(code => <option key={code} value={code}>{languageLabels[code]}</option>)}</Select>}</Field>
<Field id="ownershipType" label="How do you hold your farm land?" error={errors.ownershipType?.message}>{aria => <Select {...aria} {...register("ownershipType")}><option value="">Choose one</option>{LAND_OWNERSHIP.map(value => <option key={value} value={value}>{ownershipLabels[value]}</option>)}</Select>}</Field>
<fieldset aria-describedby={errors.mainActivities ? "mainActivities-error" : undefined}><legend className="field-label">Main farming activities</legend>
<div className="grid gap-2 sm:grid-cols-2">{FARM_ACTIVITIES.map(value => <label key={value} className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background px-4"><input type="checkbox" value={value} className="size-5" aria-invalid={!!errors.mainActivities} {...register("mainActivities")} />{activityLabels[value]}</label>)}</div>
{errors.mainActivities && <p id="mainActivities-error" role="alert" className="field-error">{errors.mainActivities.message ?? errors.mainActivities.root?.message}</p>}</fieldset>
{message && <p role="alert" className="field-error">{message}</p>}
<Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? "Saving…" : editing ? "Save profile" : "Register"}</Button>
</form>;
}
