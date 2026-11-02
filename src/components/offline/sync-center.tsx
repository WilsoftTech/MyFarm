"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LocalDatabase } from "@/modules/offline-first/client/local-database";
import { syncNow, type SyncResult } from "@/modules/offline-first/client/sync-engine";
import { discardEntry, replaceEntry, unsentCopy } from "@/modules/offline-first/client/sync-center";
import { OPERATION_LABELS, type OfflineOperation } from "@/modules/offline-first/domain/commands";
import { UNSENT_STATUSES, type OutboxEntry, type SyncStatus } from "@/modules/offline-first/domain/records";
import { parentState } from "@/modules/offline-first/domain/sync-state";
import { EntryForm, type EntryField } from "./entry-form";

export const syncStatusLabels: Record<SyncStatus, string> = { LOCAL_ONLY: "Only on this phone", PENDING: "Waiting to send", SYNCING: "Sending", SYNCED: "Sent", CONFLICT: "Needs your review", FAILED: "Could not send" };
const RESULT_LABELS: Record<SyncResult, string> = { DONE: "Everything that could be sent has been sent.", OFFLINE: "Could not reach MyFarm. Your entries are safe on this phone and will try again.", SIGNED_OUT: "Sign in again to send your entries.", BUSY: "Already sending from another tab." };
const EDITABLE: Record<string, string> = { amount: "Amount", currency: "Currency", occurredOn: "Date", counterparty: "Paid to or received from", harvestDate: "Harvest date", quantity: "Harvested kilograms", lossQuantity: "Initial loss in kilograms", grade: "Grade", dueOn: "Date", workerName: "Worker name", notes: "Notes" };
const editablePayload = (entry: OutboxEntry) => Object.fromEntries(Object.entries(entry.payload).filter(([name]) => name !== "requestId"));
const stamp = (value: string) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

function RepairForm({ db, entry, onDone }: { db: LocalDatabase; entry: OutboxEntry; onDone: () => void }) {
  const payload = editablePayload(entry);
  const fields: EntryField[] = Object.keys(EDITABLE).filter(name => name in payload).map(name => ({ name, label: EDITABLE[name], optional: true, defaultValue: String(payload[name] ?? "") }));
  return <EntryForm title="Fix and send again" submitLabel="Save and send" fields={fields} onSaved={onDone} onSubmit={values => {
    const cleaned = Object.fromEntries(Object.entries({ ...payload, ...values }).filter(([, value]) => value !== "" && value !== undefined && value !== null));
    return replaceEntry(db, entry, cleaned);
  }} />;
}

function EntryRow({ db, entry, all, onChanged }: { db: LocalDatabase; entry: OutboxEntry; all: ReadonlyMap<string, OutboxEntry>; onChanged: () => void }) {
  const [fixing, setFixing] = useState(false), [confirming, setConfirming] = useState(false);
  const blocked = parentState(entry, all) === "BLOCKED", current = entry.syncStatus === "CONFLICT" ? entry.result : null, reopen = current?.status === "SCHEDULED" && typeof current.version === "number";
  async function retryOnLatest() {
    if (typeof current?.version !== "number") return;
    await replaceEntry(db, entry, editablePayload(entry), current.version);
    onChanged();
  }
  return <li className="rounded-xl border p-4"><p>{OPERATION_LABELS[entry.operation as OfflineOperation]} · saved {stamp(entry.createdAt)}</p><p className="font-semibold">{syncStatusLabels[entry.syncStatus]}{blocked ? " · waiting for another entry to be sorted out" : ""}</p>
    {entry.lastError && <p className="mt-1">{entry.lastError}</p>}
    {entry.syncStatus === "CONFLICT" && !reopen && <p className="mt-1">It was already finished elsewhere, so this entry can be discarded.</p>}
    <div className="mt-3 flex flex-wrap gap-3">
      {entry.syncStatus === "FAILED" && entry.operation !== "ATTACH_PHOTO" && <Button variant="outline" onClick={() => setFixing(value => !value)}>Fix details</Button>}
      {reopen && <Button variant="outline" onClick={() => void retryOnLatest()}>Try again on the latest version</Button>}
      {(entry.syncStatus === "FAILED" || entry.syncStatus === "CONFLICT") && (confirming ? <><Button variant="outline" onClick={() => void discardEntry(db, entry).then(onChanged)}>Yes, discard it</Button><Button variant="outline" onClick={() => setConfirming(false)}>Keep it</Button></> : <Button variant="outline" onClick={() => setConfirming(true)}>Discard</Button>)}
    </div>
    {confirming && <p role="status" className="mt-2">Discarding removes this entry from this phone for good, along with anything waiting on it.</p>}
    {fixing && <div className="mt-4"><RepairForm db={db} entry={entry} onDone={onChanged} /></div>}
  </li>;
}

/** Sends in the foreground whenever it can: on opening, on reconnecting and every minute. Background delivery is not assumed. */
export function SyncCenter({ db, online, onChanged, refreshKey }: { db: LocalDatabase; online: boolean; onChanged: () => void; refreshKey: number }) {
  const [entries, setEntries] = useState<OutboxEntry[]>([]), [sent, setSent] = useState(0), [farmNames, setFarmNames] = useState<ReadonlyMap<string, string>>(new Map()), [sending, setSending] = useState(false), [result, setResult] = useState<SyncResult | null>(null), [loaded, setLoaded] = useState(false);
  const busy = useRef(false);
  const load = useCallback(async () => {
    const rows = await db.outbox.toArray(), farms = await db.farms.toArray();
    setEntries(rows.filter(row => UNSENT_STATUSES.includes(row.syncStatus)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))); setSent(rows.length); setFarmNames(new Map(farms.map(farm => [farm.farmId, farm.name]))); setLoaded(true);
  }, [db]);
  const send = useCallback(async (force: boolean) => {
    if (busy.current) return;
    busy.current = true; setSending(true);
    try { setResult(await syncNow(db, () => true, force)); } catch { setResult("OFFLINE"); }
    busy.current = false; setSending(false);
    await load(); onChanged();
  }, [db, load, onChanged]);
  useEffect(() => { void Promise.resolve().then(load).catch(() => undefined); }, [load, refreshKey]);
  useEffect(() => {
    if (!online) return;
    void Promise.resolve().then(() => send(false));
    const timer = setInterval(() => void send(false), 60_000);
    return () => clearInterval(timer);
  }, [online, send]);
  function download() {
    const url = URL.createObjectURL(new Blob([unsentCopy(entries, farmNames, new Date())], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "myfarm-unsent-entries.json"; link.click();
    URL.revokeObjectURL(url);
  }
  const byId = new Map(entries.map(row => [row.clientMutationId, row]));
  return <section aria-labelledby="syncHeading" className="rounded-xl border p-5"><h2 id="syncHeading" className="text-xl font-semibold">Sync center</h2>
    <div className="mt-3 flex flex-wrap gap-3"><Button onClick={() => void send(true)} disabled={sending || !online}>{sending ? "Sending…" : "Send now"}</Button>{entries.length > 0 && <Button variant="outline" onClick={download}>Download a copy</Button>}</div>
    {entries.length > 0 && <p className="mt-3 text-sm">The download is not encrypted and leaves out photos. Anyone with the file can read it.</p>}
    {result && <p role="status" className="mt-3">{RESULT_LABELS[result]}{result === "SIGNED_OUT" && <> <a className="underline" href="/sign-in">Sign in</a></>}</p>}
    {!loaded ? <p role="status" className="mt-3">Checking what is waiting…</p> : entries.length === 0 ? <p className="mt-3">{sent > 0 ? "All your entries have been sent." : "Nothing is waiting to send."}</p> : <ul className="mt-4 space-y-3">{entries.map(entry => <EntryRow key={entry.clientMutationId} db={db} entry={entry} all={byId} onChanged={() => void load().then(onChanged)} />)}</ul>}
  </section>;
}
