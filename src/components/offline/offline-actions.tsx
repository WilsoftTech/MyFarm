"use client";
import { useState } from "react";
import { Field } from "@/components/farmer-registry/field";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ACTIVITY_LABELS, ACTIVITY_TYPES, activityUnavailableReason } from "@/modules/farm-activities/domain/catalog";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import type { EnterpriseType, ProductionWorkflow } from "@/modules/enterprises-seasons/domain/production";
import type { LocalDatabase } from "@/modules/offline-first/client/local-database";
import { enqueueCommand, enqueuePhoto } from "@/modules/offline-first/client/outbox";
import { compressPhoto } from "@/modules/offline-first/client/photo-capture";
import { localSaveFailureLabels } from "@/modules/offline-first/contracts/storage";
import { OPERATION_LABELS, type OfflineOperation, type PhotoTarget } from "@/modules/offline-first/domain/commands";
import type { CachedRecord, OutboxEntry } from "@/modules/offline-first/domain/records";
import { EntryForm, type EntryField } from "./entry-form";

export type FarmRecords = Record<string, CachedRecord[]>;
const choices = (rows: CachedRecord[] | undefined, label: (data: Record<string, unknown>) => string, usable: (data: Record<string, unknown>) => boolean = () => true) => (rows ?? []).filter(row => usable(row.data)).map(row => ({ id: row.id, label: label(row.data) }));
const named = (data: Record<string, unknown>) => String(data.name ?? "");
const blankToUndefined = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));

function MoneyForm({ db, farmId, records, kind, onSaved }: { db: LocalDatabase; farmId: string; records: FarmRecords; kind: "RECORD_EXPENSE" | "RECORD_INCOME"; onSaved: () => void }) {
  const expense = kind === "RECORD_EXPENSE";
  const fields: EntryField[] = [
    { name: "categoryId", label: expense ? "What was it for?" : "What was it from?", choices: choices(records[expense ? "COST_CATEGORIES" : "REVENUE_CATEGORIES"], named, data => data.active !== false) },
    { name: "amount", label: "Amount", type: "number", step: "0.0001" }, { name: "currency", label: "Currency", defaultValue: "UGX" }, { name: "occurredOn", label: "Date", type: "date", defaultValue: farmToday(new Date()) },
    { name: "paymentMethodId", label: "How was it paid?", optional: true, choices: choices(records.PAYMENT_METHODS, named, data => data.active !== false) },
    { name: "counterparty", label: expense ? "Paid to" : "Received from", optional: true },
    { name: "enterpriseId", label: "Enterprise", optional: true, choices: choices(records.ENTERPRISES, named, data => data.status === "ACTIVE") }, { name: "plotId", label: "Plot", optional: true, choices: choices(records.PLOTS, named) },
    ...(expense ? [{ name: "batchId", label: "Poultry batch", optional: true, choices: choices(records.POULTRY_BATCHES, data => String(data.batchLabel ?? ""), data => data.status === "ACTIVE") }] : []),
  ];
  return <EntryForm key={kind} title={"Record " + OPERATION_LABELS[kind].toLowerCase()} submitLabel={"Save " + OPERATION_LABELS[kind].toLowerCase()} fields={fields} onSaved={onSaved} onSubmit={values => enqueueCommand(db, kind, farmId, blankToUndefined(values))} />;
}

function HarvestForm({ db, farmId, records, onSaved }: { db: LocalDatabase; farmId: string; records: FarmRecords; onSaved: () => void }) {
  const cycles = records.CROP_CYCLES ?? [];
  const fields: EntryField[] = [
    { name: "cropCycleId", label: "Crop cycle", choices: choices(cycles, data => String(data.cropName) + " · planted " + String(data.plantingDate), data => data.status === "ACTIVE") },
    { name: "storageLocationId", label: "Store", choices: choices(records.STORES, named) }, { name: "harvestDate", label: "Harvest date", type: "date", defaultValue: farmToday(new Date()) },
    { name: "quantity", label: "Harvested kilograms", type: "number", step: "0.000001" }, { name: "lossQuantity", label: "Initial loss in kilograms", type: "number", step: "0.000001", defaultValue: "0" }, { name: "grade", label: "Grade", optional: true },
  ];
  return <EntryForm key="harvest" title="Record harvest" submitLabel="Save harvest" fields={fields} onSaved={onSaved} onSubmit={async values => {
    const cycle = cycles.find(row => row.id === values.cropCycleId)?.data;
    return enqueueCommand(db, "RECORD_HARVEST", farmId, { ...blankToUndefined(values), cropId: cycle?.cropId, plotId: cycle?.plotId, unit: "KG" });
  }}><p>Enter kilograms. Bags are not converted.</p></EntryForm>;
}

function ActivityForm({ db, farmId, records, done, onSaved }: { db: LocalDatabase; farmId: string; records: FarmRecords; done: boolean; onSaved: () => void }) {
  const [enterpriseId, setEnterpriseId] = useState("");
  const enterprise = records.ENTERPRISES?.find(row => row.id === enterpriseId)?.data as { type?: EnterpriseType; workflow?: ProductionWorkflow | null } | undefined;
  const fields: EntryField[] = [
    { name: "enterpriseId", label: "What is it for?", optional: true, hint: "Leave blank for the whole farm.", onChange: setEnterpriseId, choices: (records.ENTERPRISES ?? []).filter(row => row.data.status === "ACTIVE" && row.data.workflow).map(row => ({ id: row.id, label: named(row.data) })) },
    { name: "type", label: "Activity", choices: ACTIVITY_TYPES.filter(type => activityUnavailableReason(type, enterprise?.type ?? null) === null).map(type => ({ id: type, label: ACTIVITY_LABELS[type] })) },
    { name: "dueOn", label: done ? "Date done" : "Due date", type: "date", defaultValue: farmToday(new Date()) }, { name: "plotId", label: "Plot", optional: true, choices: choices(records.PLOTS, named) },
    { name: "workerName", label: "Worker name", optional: true }, { name: "notes", label: "Notes", optional: true },
  ];
  const operation: OfflineOperation = done ? "RECORD_ACTIVITY" : "CREATE_TASK";
  return <EntryForm key={operation} title={done ? "Record activity" : "Create task"} submitLabel={done ? "Save activity" : "Save task"} fields={fields} onSaved={onSaved} onSubmit={values => enqueueCommand(db, operation, farmId, blankToUndefined(values))} />;
}

function PhotoForm({ db, farmId, records, outbox, onSaved }: { db: LocalDatabase; farmId: string; records: FarmRecords; outbox: OutboxEntry[]; onSaved: () => void }) {
  const [target, setTarget] = useState(""), [file, setFile] = useState<File | null>(null), [message, setMessage] = useState<{ kind: "saved" | "failed"; text: string } | null>(null), [saving, setSaving] = useState(false), [input, setInput] = useState(0);
  const unsent = outbox.filter(row => ["RECORD_EXPENSE", "RECORD_INCOME", "RECORD_ACTIVITY", "CREATE_TASK"].includes(row.operation));
  const targetFor = (operation: string): PhotoTarget => operation === "RECORD_EXPENSE" || operation === "RECORD_INCOME" ? "ACCOUNTING_RECORD" : "ACTIVITY";
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!target || !file) { setMessage({ kind: "failed", text: "Not saved: choose a record and take a photo." }); return; }
    setSaving(true); setMessage(null);
    const blob = await compressPhoto(file);
    if (!blob) { setSaving(false); setMessage({ kind: "failed", text: "Not saved: this photo could not be read or made small enough. Your choices are still here." }); return; }
    const [kind, id] = target.split(":");
    const local = kind === "local" ? unsent.find(row => row.clientMutationId === id) : undefined;
    const result = await enqueuePhoto(db, farmId, blob, kind === "local" ? targetFor(local?.operation ?? "") : kind === "money" ? "ACCOUNTING_RECORD" : "ACTIVITY", kind === "local" ? { parentMutationId: id } : { recordId: id });
    setSaving(false);
    if (result.status === "SAVED") { setFile(null); setTarget(""); setInput(value => value + 1); setMessage({ kind: "saved", text: "Photo saved on this phone. It will send when you reconnect." }); onSaved(); return; }
    setMessage({ kind: "failed", text: result.status === "NOT_SAVED" ? localSaveFailureLabels[result.reason] : "Not saved: check the record you chose." });
  }
  return <form onSubmit={save} aria-label="Take photo" aria-busy={saving} className="max-w-2xl space-y-5 rounded-xl border p-5"><h2 className="text-xl font-semibold">Take photo</h2><p>Photos stay private to this farm and are kept as long as the record.</p>
    <Field id="offline-photo-target" label="Attach to">{aria => <Select {...aria} value={target} onChange={event => setTarget(event.target.value)}><option value="">Choose…</option>
      {unsent.map(row => <option key={row.clientMutationId} value={"local:" + row.clientMutationId}>Waiting to send · {OPERATION_LABELS[row.operation as OfflineOperation]} · {row.createdAt.slice(0, 10)}</option>)}
      {(records.ACCOUNTING_RECORDS ?? []).map(row => <option key={row.id} value={"money:" + row.id}>{String(row.data.occurredOn)} · {String(row.data.categoryName)} · {String(row.data.amount)} {String(row.data.currency)}</option>)}
      {(records.ACTIVITIES ?? []).map(row => <option key={row.id} value={"activity:" + row.id}>{String(row.data.dueOn)} · {String(row.data.typeLabel)}</option>)}</Select>}</Field>
    <Field id="offline-photo-file" label="Photo">{aria => <input {...aria} key={input} type="file" accept="image/*" capture="environment" className="block min-h-12 w-full py-2" onChange={event => setFile(event.target.files?.[0] ?? null)} />}</Field>
    {message && <p role={message.kind === "saved" ? "status" : "alert"} className={message.kind === "saved" ? "font-semibold" : "field-error"}>{message.text}</p>}
    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save photo"}</Button></form>;
}

export const ACTION_LABELS = { expense: "Record expense", income: "Record income", harvest: "Record harvest", activity: "Record activity", task: "Create task", photo: "Take photo" } as const;
export type OfflineAction = keyof typeof ACTION_LABELS;
export function ActionForm({ action, db, farmId, records, outbox, onSaved }: { action: OfflineAction; db: LocalDatabase; farmId: string; records: FarmRecords; outbox: OutboxEntry[]; onSaved: () => void }) {
  switch (action) {
    case "expense": return <MoneyForm db={db} farmId={farmId} records={records} kind="RECORD_EXPENSE" onSaved={onSaved} />;
    case "income": return <MoneyForm db={db} farmId={farmId} records={records} kind="RECORD_INCOME" onSaved={onSaved} />;
    case "harvest": return <HarvestForm db={db} farmId={farmId} records={records} onSaved={onSaved} />;
    case "activity": return <ActivityForm key="done" db={db} farmId={farmId} records={records} done onSaved={onSaved} />;
    case "task": return <ActivityForm key="task" db={db} farmId={farmId} records={records} done={false} onSaved={onSaved} />;
    case "photo": return <PhotoForm db={db} farmId={farmId} records={records} outbox={outbox} onSaved={onSaved} />;
  }
}
