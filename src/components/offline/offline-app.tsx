"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/farmer-registry/field";
import { Select } from "@/components/ui/select";
import { currentOfflineAccount } from "@/modules/offline-first/client/account";
import { localDatabase, type LocalDatabase } from "@/modules/offline-first/client/local-database";
import { currentStorageHealth } from "@/modules/offline-first/client/storage-status";
import { storageWarningLabels } from "@/modules/offline-first/contracts/storage";
import { CATALOG_SECTIONS, OPERATION_LABELS, type OfflineOperation, type PullSection } from "@/modules/offline-first/domain/commands";
import type { CachedFarm, CachedRecord, OutboxEntry } from "@/modules/offline-first/domain/records";
import type { StorageHealth } from "@/modules/offline-first/domain/storage";
import { enqueueCommand } from "@/modules/offline-first/client/outbox";
import { localSaveFailureLabels } from "@/modules/offline-first/contracts/storage";
import { ACTION_LABELS, ActionForm, type FarmRecords, type OfflineAction } from "./offline-actions";
import { SyncCenter, syncStatusLabels } from "./sync-center";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener); window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
}
const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

const stamp = (value: string) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export function StoragePanel({ health }: { health: StorageHealth }) {
  return <section aria-labelledby="storageHeading" className="rounded-xl border p-5"><h2 id="storageHeading" className="text-xl font-semibold">On this phone</h2>
    <dl className="mt-3 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm">Entries waiting to send</dt><dd className="font-semibold">{health.unsentEntries}</dd></div>
      <div><dt className="text-sm">Last synced</dt><dd className="font-semibold">{health.lastSyncAt ? stamp(health.lastSyncAt) : "Not yet"}</dd></div></dl>
    {health.warnings.length > 0 && <ul className="mt-4 space-y-2">{health.warnings.map(warning => <li key={warning} role="status" className="rounded-lg border border-border p-3">{storageWarningLabels[warning]}</li>)}</ul>}
    <p className="mt-4 text-sm">Entries are stored in this browser until they send. MyFarm cannot recover them if the browser data is cleared or the phone is lost.</p>
  </section>;
}

const RECORD_SECTIONS: { section: PullSection; title: string; line: (data: Record<string, unknown>) => string }[] = [
  { section: "ACCOUNTING_RECORDS", title: "Money records", line: data => [data.occurredOn, data.categoryName, String(data.amount) + " " + String(data.currency), data.status === "REVERSED" ? "Reversed" : ""].filter(Boolean).join(" · ") },
  { section: "HARVESTS", title: "Harvests", line: data => [data.harvestDate, data.cropName, String(data.quantity) + " kg"].join(" · ") },
  { section: "ACTIVITIES", title: "Activities", line: data => [data.dueOn, data.typeLabel, data.state].join(" · ") },
];
/** Saved copies can be stale, so the entry carries the version seen; the server turns a stale one into a conflict for review. */
function MarkDone({ db, farmId, row, entries, onSaved }: { db: LocalDatabase; farmId: string; row: CachedRecord; entries: OutboxEntry[]; onSaved: () => void }) {
  const [message, setMessage] = useState("");
  if (row.data.status !== "SCHEDULED" || entries.some(entry => entry.operation === "COMPLETE_ACTIVITY" && entry.payload.activityId === row.id)) return null;
  async function mark() {
    const result = await enqueueCommand(db, "COMPLETE_ACTIVITY", farmId, { activityId: row.id }, { baseVersion: Number(row.data.version) });
    if (result.status === "SAVED") { onSaved(); return; }
    setMessage(result.status === "NOT_SAVED" ? localSaveFailureLabels[result.reason] : "Not saved: this activity could not be marked done.");
  }
  return <div className="mt-2"><Button variant="outline" onClick={() => void mark()}>Mark done</Button>{message && <p role="alert" className="field-error mt-2">{message}</p>}</div>;
}
function CachedRecords({ db, farmId, records, entries, lastSyncAt, onSaved }: { db: LocalDatabase; farmId: string; records: FarmRecords; entries: OutboxEntry[]; lastSyncAt: string | null; onSaved: () => void }) {
  return <section aria-labelledby="recordsHeading" className="space-y-5"><h2 id="recordsHeading" className="text-xl font-semibold">Records</h2>
    <p>{lastSyncAt ? "Saved copies from " + stamp(lastSyncAt) + ". They may have changed since." : "No saved copies yet. Connect once while signed in to save them."}</p>
    {entries.length > 0 && <div><h3 className="font-semibold">On this phone only</h3><ul className="mt-2 space-y-2">{entries.map(row => <li key={row.clientMutationId} className="rounded-xl border p-4">{OPERATION_LABELS[row.operation as OfflineOperation]} · {stamp(row.createdAt)} · <strong>{syncStatusLabels[row.syncStatus]}</strong></li>)}</ul></div>}
    {RECORD_SECTIONS.map(({ section, title, line }) => <div key={section}><h3 className="font-semibold">{title}</h3>{(records[section] ?? []).length === 0 ? <p className="mt-2">None saved on this phone.</p> : <ul className="mt-2 space-y-2">{(records[section] ?? []).map(row => <li key={row.id} className="rounded-xl border p-4">{line(row.data)}{section === "ACTIVITIES" && <MarkDone db={db} farmId={farmId} row={row} entries={entries} onSaved={onSaved} />}</li>)}</ul>}</div>)}
  </section>;
}

function OfflineWork({ db, online, onChanged, health, refreshKey }: { db: LocalDatabase; online: boolean; onChanged: () => void; health: StorageHealth; refreshKey: number }) {
  const [farms, setFarms] = useState<CachedFarm[]>([]), [farmId, setFarmId] = useState(""), [records, setRecords] = useState<FarmRecords>({}), [outbox, setOutbox] = useState<OutboxEntry[]>([]), [action, setAction] = useState<OfflineAction | "records" | null>(null), [loaded, setLoaded] = useState(false);
  // Loads overlap (opening, a send attempt, a farm change). Only the newest may apply, or a load that started
  // before the farmer chose a farm could finish later and put the earlier farm back.
  const newest = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++newest.current;
    const rows = await db.farms.toArray();
    const chosen = rows.some(row => row.farmId === farmId) ? farmId : rows[0]?.farmId ?? "";
    const [cached, entries] = chosen ? await Promise.all([db.records.where("farmId").equals(chosen).toArray(), db.outbox.where("farmId").equals(chosen).toArray()]) : [[] as CachedRecord[], [] as OutboxEntry[]];
    const grouped: FarmRecords = {};
    for (const row of cached) (grouped[row.section] ??= []).push(row);
    if (ticket !== newest.current) return;
    setFarms(rows); setFarmId(chosen); setRecords(grouped); setOutbox(entries.filter(row => row.syncStatus !== "SYNCED")); setLoaded(true);
  }, [db, farmId]);
  useEffect(() => { void Promise.resolve().then(load).catch(() => undefined); }, [load, refreshKey]);
  const saved = () => { void load(); onChanged(); };
  if (!loaded) return <p role="status">Opening your saved work…</p>;
  if (farms.length === 0) return <section className="rounded-xl border p-5"><h2 className="text-xl font-semibold">No farms saved on this phone</h2><p className="mt-2">{online ? "Open My farms while signed in and your farms will be saved here." : "Connect once while signed in to save your farms on this phone. Entries need a saved farm."}</p>{online && <a className="mt-2 inline-block min-h-12 py-3 underline" href="/farms">My farms</a>}</section>;
  void health;
  return <div className="space-y-6">
    <section aria-labelledby="farmHeading" className="rounded-xl border p-5"><h2 id="farmHeading" className="text-xl font-semibold">Farm</h2>
      {farms.length === 1 ? <p className="mt-2 font-semibold">{farms[0].name}</p> : <div className="mt-2"><Field id="offline-farm" label="Choose a farm">{aria => <Select {...aria} value={farmId} onChange={event => { setFarmId(event.target.value); setAction(null); }}>{farms.map(farm => <option key={farm.farmId} value={farm.farmId}>{farm.name}</option>)}</Select>}</Field></div>}
      <p className="mt-2 text-sm">Saved on this phone {stamp(farms.find(row => row.farmId === farmId)?.cachedAt ?? farms[0].cachedAt)}.</p></section>
    <nav aria-label="Offline actions" className="flex flex-wrap gap-3">{(Object.keys(ACTION_LABELS) as OfflineAction[]).map(value => <Button key={value} variant={action === value ? "default" : "outline"} aria-pressed={action === value} onClick={() => setAction(value)}>{ACTION_LABELS[value]}</Button>)}<Button variant={action === "records" ? "default" : "outline"} aria-pressed={action === "records"} onClick={() => setAction("records")}>View records</Button></nav>
    {action === "records" ? <CachedRecords db={db} farmId={farmId} records={records} entries={outbox} lastSyncAt={health.lastSyncAt} onSaved={saved} /> : action ? <ActionForm action={action} db={db} farmId={farmId} records={records} outbox={outbox} onSaved={saved} /> : <p>{CATALOG_SECTIONS.every(section => !records[section]?.length) ? "Your farm is saved, but its choices have not finished saving. Connect to finish." : "Choose what you want to record."}</p>}
  </div>;
}

export function OfflineApp() {
  const online = useOnline();
  const [state, setState] = useState<{ status: "loading" } | { status: "no-account" } | { status: "blocked" } | { status: "ready"; db: LocalDatabase; health: StorageHealth }>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(async () => {
    const account = currentOfflineAccount();
    if (!account) { setState({ status: "no-account" }); return; }
    try { const db = localDatabase(account); setState({ status: "ready", db, health: await currentStorageHealth(db) }); setRefreshKey(value => value + 1); }
    catch { setState({ status: "blocked" }); }
  }, []);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  const onChanged = useCallback(() => { void refresh(); }, [refresh]);
  return <section className="space-y-6"><div><p className="text-sm text-primary">Farm work without signal</p><h1 className="mt-2 text-3xl font-bold">Offline work</h1></div>
    <p role="status" className="rounded-xl border p-4 font-semibold">{online ? "You are connected." : "You are offline. Entries are saved on this phone until you reconnect."}</p>
    <p>How the farm is doing needs a connection, because it adds up what MyFarm has received. Entries waiting on this phone are counted once they are sent.</p>
    {state.status === "loading" && <p role="status">Opening your saved work…</p>}
    {state.status === "no-account" && <p>Sign in while connected to get this phone ready for offline work. <a className="underline" href="/sign-in">Sign in</a></p>}
    {state.status === "blocked" && <p role="alert">This browser is not allowing MyFarm to store data, which can happen in private browsing. You can still use MyFarm while connected.</p>}
    {state.status === "ready" && <><StoragePanel health={state.health} /><SyncCenter db={state.db} online={online} refreshKey={refreshKey} onChanged={onChanged} /><OfflineWork db={state.db} online={online} health={state.health} refreshKey={refreshKey} onChanged={onChanged} /></>}
  </section>;
}
