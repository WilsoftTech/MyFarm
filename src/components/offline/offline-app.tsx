"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { currentOfflineAccount } from "@/modules/offline-first/client/account";
import { localDatabase, type LocalDatabase } from "@/modules/offline-first/client/local-database";
import { currentStorageHealth } from "@/modules/offline-first/client/storage-status";
import { storageWarningLabels } from "@/modules/offline-first/contracts/storage";
import type { StorageHealth } from "@/modules/offline-first/domain/storage";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener); window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
}
const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

export function StoragePanel({ health }: { health: StorageHealth }) {
  return <section aria-labelledby="storageHeading" className="rounded-xl border p-5"><h2 id="storageHeading" className="text-xl font-semibold">On this phone</h2>
    <dl className="mt-3 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm">Entries waiting to send</dt><dd className="font-semibold">{health.unsentEntries}</dd></div>
      <div><dt className="text-sm">Last synced</dt><dd className="font-semibold">{health.lastSyncAt ? new Date(health.lastSyncAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Not yet"}</dd></div></dl>
    {health.warnings.length > 0 && <ul className="mt-4 space-y-2">{health.warnings.map(warning => <li key={warning} role="status" className="rounded-lg border border-border p-3">{storageWarningLabels[warning]}</li>)}</ul>}
    <p className="mt-4 text-sm">Entries are stored in this browser until they send. MyFarm cannot recover them if the browser data is cleared or the phone is lost.</p>
  </section>;
}

export function OfflineApp() {
  const online = useOnline();
  const [state, setState] = useState<{ status: "loading" } | { status: "no-account" } | { status: "blocked" } | { status: "ready"; db: LocalDatabase; health: StorageHealth }>({ status: "loading" });
  const refresh = useCallback(async () => {
    const account = currentOfflineAccount();
    if (!account) { setState({ status: "no-account" }); return; }
    try { const db = localDatabase(account); setState({ status: "ready", db, health: await currentStorageHealth(db) }); }
    catch { setState({ status: "blocked" }); }
  }, []);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  return <section className="space-y-6"><div><p className="text-sm text-primary">Farm work without signal</p><h1 className="mt-2 text-3xl font-bold">Offline work</h1></div>
    <p role="status" className="rounded-xl border p-4 font-semibold">{online ? "You are connected." : "You are offline. Entries are saved on this phone until you reconnect."}</p>
    {state.status === "loading" && <p role="status">Opening your saved work…</p>}
    {state.status === "no-account" && <p>Sign in while connected to get this phone ready for offline work. <a className="underline" href="/sign-in">Sign in</a></p>}
    {state.status === "blocked" && <p role="alert">This browser is not allowing MyFarm to store data, which can happen in private browsing. You can still use MyFarm while connected.</p>}
    {state.status === "ready" && <StoragePanel health={state.health} />}
  </section>;
}
