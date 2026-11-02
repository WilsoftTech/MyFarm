"use client";
import { useRef, useState, type ReactNode } from "react";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { localSaveFailureLabels } from "@/modules/offline-first/contracts/storage";
import type { EnqueueResult } from "@/modules/offline-first/client/outbox";

export interface EntryField { name: string; label: string; optional?: boolean; hint?: string; type?: "text" | "date" | "number"; step?: string; defaultValue?: string; choices?: { id: string; label: string; disabled?: boolean }[]; onChange?: (value: string) => void }
/** Saves on this phone. A failed save keeps every value on screen and says that nothing was saved. */
export function EntryForm({ title, fields, submitLabel, onSubmit, onSaved, children }: { title: string; fields: EntryField[]; submitLabel: string; onSubmit: (values: Record<string, string>) => Promise<EnqueueResult>; onSaved: () => void; children?: ReactNode }) {
  const initial = () => Object.fromEntries(fields.map(field => [field.name, field.defaultValue ?? ""]));
  const [values, setValues] = useState<Record<string, string>>(initial), [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "saved" | "failed"; text: string } | null>(null), [saving, setSaving] = useState(false), ref = useRef<HTMLFormElement>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setMessage(null); setErrors({});
    const missing = Object.fromEntries(fields.filter(field => !field.optional && !values[field.name]).map(field => [field.name, "Enter " + field.label.toLowerCase() + "."]));
    const result: EnqueueResult = Object.keys(missing).length ? { status: "INVALID", errors: missing } : await onSubmit(values);
    setSaving(false);
    if (result.status === "SAVED") { setValues(initial()); setMessage({ kind: "saved", text: "Saved on this phone. It will send when you reconnect." }); onSaved(); return; }
    if (result.status === "NOT_SAVED") { setMessage({ kind: "failed", text: localSaveFailureLabels[result.reason] }); return; }
    setErrors(result.errors);
    const known = new Set(fields.map(field => field.name));
    const other = Object.entries(result.errors).find(([name]) => !known.has(name));
    if (other) setMessage({ kind: "failed", text: "Not saved: " + other[1] });
    focusFirstInvalid(ref.current);
  }
  return <form ref={ref} onSubmit={submit} aria-label={title} aria-busy={saving} noValidate className="max-w-2xl space-y-5 rounded-xl border p-5"><h2 className="text-xl font-semibold">{title}</h2>
    {children}
    {fields.map(field => <Field key={field.name} id={"offline-" + field.name} label={field.label} optional={field.optional} hint={field.hint} error={errors[field.name]}>{aria => field.choices
      ? <Select {...aria} value={values[field.name] ?? ""} onChange={event => { setValues(current => ({ ...current, [field.name]: event.target.value })); field.onChange?.(event.target.value); }}><option value="">Choose…</option>{field.choices.map(choice => <option key={choice.id} value={choice.id} disabled={choice.disabled}>{choice.label}</option>)}</Select>
      : <Input {...aria} type={field.type ?? "text"} step={field.step} value={values[field.name] ?? ""} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))} />}</Field>)}
    {message && <p role={message.kind === "saved" ? "status" : "alert"} className={message.kind === "saved" ? "font-semibold" : "field-error"}>{message.text}</p>}
    <Button type="submit" disabled={saving}>{saving ? "Saving…" : submitLabel}</Button>
  </form>;
}
