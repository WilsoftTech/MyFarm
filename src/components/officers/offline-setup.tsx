"use client";
import { useEffect, useState } from "react";
import type { AssignedFarm } from "@/modules/extension-officers/contracts/service";
import { localDatabase } from "@/modules/offline-first/client/local-database";
import { accountGeneration, setOfflineAccount } from "@/modules/offline-first/client/account";
export function OfficerOfflineSetup({ accountId, scope, farms, asOf }: { accountId: string; scope: string; farms: AssignedFarm[]; asOf: string }) {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  useEffect(() => {
    const generation = accountGeneration();
    void Promise.resolve().then(async () => {
      // This account comes from the authorized server view. Establish it before
      // caching assignments so switching from a farmer account cannot erase them.
      if (!setOfflineAccount(accountId, generation)) return;
      await localDatabase(accountId).meta.put({ key: "officer:scope", value: scope });
      // Server-projected assignments are a stale label cache, never authorization.
      await localDatabase(accountId).meta.put({ key: "officer:farms", value: JSON.stringify(farms.filter(row => row.permissions.includes("VISITS")).map(row => ({ accountId, scope, farmId: row.farmId, assignmentId: row.assignmentId, name: row.name, asOf }))) });
      if (generation !== accountGeneration()) await localDatabase(accountId).meta.bulkDelete(["officer:farms", "officer:scope"]);
      else setSavedAt(asOf);
    }).catch(() => undefined);
  }, [accountId, scope, farms, asOf]);
  return <p role="status">{savedAt === asOf ? "Assigned farms saved on this phone." : "Preparing assigned farms for offline work. Keep this page open until saved."}</p>;
}
