"use client";
import { useEffect } from "react";
import { accountGeneration, setOfflineAccount } from "@/modules/offline-first/client/account";

/** Signed-in pages prepare this phone for offline use. Failures only mean it stays unprepared; pages keep working. */
export function OfflineSetup() {
  useEffect(() => {
    async function prepare() {
      if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
      const startedAt = accountGeneration();
      const response = await fetch("/api/v1/sync/account", { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const { accountId } = await response.json() as { accountId: string };
      if (!setOfflineAccount(accountId, startedAt)) return;
      await navigator.serviceWorker.register("/sw.js");
      // Loaded on demand so ordinary signed-in pages do not carry the local database code.
      const [{ localDatabase }, { syncNow }, { requestPersistentStorage }] = await Promise.all([import("@/modules/offline-first/client/local-database"), import("@/modules/offline-first/client/sync-engine"), import("@/modules/offline-first/client/storage-status")]);
      await requestPersistentStorage();
      // Sends anything left over from time offline, then refreshes saved copies. Opening a signed-in page is when a send
      // is most likely to work, so, like opening Offline work, it skips any retry wait left from earlier failures.
      await syncNow(localDatabase(accountId), () => accountGeneration() === startedAt, true);
    }
    prepare().catch(() => undefined);
  }, []);
  return null;
}
