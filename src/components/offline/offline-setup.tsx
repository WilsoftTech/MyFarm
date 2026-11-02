"use client";
import { useEffect } from "react";
import { accountGeneration, setOfflineAccount } from "@/modules/offline-first/client/account";
import { requestPersistentStorage } from "@/modules/offline-first/client/storage-status";

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
      await requestPersistentStorage();
    }
    prepare().catch(() => undefined);
  }, []);
  return null;
}
