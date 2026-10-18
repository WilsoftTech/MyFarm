"use client";
import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Field } from "@/components/farmer-registry/field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Choice, ChoiceLoad, ChoicePage } from "./choice-types";

/** A paged server-backed select; later pages append without losing the current draft or selection. */
export function ChoiceField<K extends string>({ id, label, kind, initial, control, error, online, load, onSelect }: { id: string; label: string; kind: K; initial: ChoicePage; control: UseFormRegisterReturn; error?: string; online: boolean; load: ChoiceLoad<K>; onSelect?: (choice: Choice | undefined) => void }) {
  const [page, setPage] = useState(initial), [pending, setPending] = useState(false), [message, setMessage] = useState("");
  async function more() {
    if (!page.nextCursor || pending || !online) return;
    setPending(true); setMessage("");
    try {
      const result = await load(kind, page.nextCursor);
      if (!result.ok) { setMessage(result.message); return; }
      setPage(current => ({ items: Array.from(new Map([...current.items, ...result.page.items].map(row => [row.id, row])).values()), nextCursor: result.page.nextCursor }));
    } catch { setMessage("Connection interrupted. Try loading more choices again. Your details are still here."); }
    finally { setPending(false); }
  }
  return <div>
    <Field id={id} label={label} error={error}>{aria => <Select {...aria} {...control} onChange={event => { void control.onChange(event); onSelect?.(page.items.find(row => row.id === event.target.value)); }}><option value="">Choose one</option>{page.items.map(row => <option key={row.id} value={row.id} disabled={row.disabled}>{row.label}</option>)}</Select>}</Field>
    {page.nextCursor && <Button type="button" variant="outline" className="mt-2" disabled={pending || !online} onClick={more}>{pending ? "Loading…" : "More " + label.toLowerCase() + " choices"}</Button>}
    {pending && <p role="status" className="mt-2 text-sm">Loading more {label.toLowerCase()} choices…</p>}
    {message && <p role="alert" className="mt-2 text-sm text-destructive">{message}</p>}
  </div>;
}
