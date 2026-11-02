import type { PullPage } from "../contracts/commands";
import type { CachedRecord } from "../domain/records";
import type { LocalDatabase } from "./local-database";

export type PullOutcome = "COMPLETE" | "STOPPED" | "OFFLINE" | "SIGNED_OUT";
async function fetchPage(cursor: string | null): Promise<PullPage | null> {
  const response = await fetch("/api/v1/sync/pull" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""), { headers: { accept: "application/json" } });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Pull failed");
  return await response.json() as PullPage;
}
/**
 * Pages are written as they arrive and older rows are replaced only once the whole snapshot is in, so an interrupted pull never
 * loses saved copies. Unsent entries live in other tables and are never touched. keepGoing lets a sign-out stop a running pull.
 */
export async function pullCachedData(db: LocalDatabase, keepGoing: () => boolean = () => true): Promise<PullOutcome> {
  let cursor: string | null = null, restarted = false;
  try {
    for (;;) {
      if (!keepGoing()) return "STOPPED";
      const page: PullPage | null = await fetchPage(cursor);
      if (page === null) return "SIGNED_OUT";
      if (!keepGoing()) return "STOPPED";
      if (page.status === "EXPIRED") {
        if (restarted) return "OFFLINE";
        restarted = true; cursor = null;
        continue;
      }
      const at = new Date().toISOString(), { farmId, section, snapshotId, farms } = page;
      const rows: CachedRecord[] = farmId && section ? page.items.map(item => ({ section, id: item.id, farmId, snapshotId, data: item })) : [];
      await db.transaction("rw", db.farms, db.records, db.meta, async () => {
        await db.farms.bulkPut(farms.map(farm => ({ ...farm, cachedAt: at })));
        await db.records.bulkPut(rows);
        if (page.nextCursor) return;
        await db.records.filter(row => row.snapshotId !== snapshotId).delete();
        const current = new Set(farms.map(farm => farm.farmId));
        await db.farms.filter(farm => !current.has(farm.farmId)).delete();
        await db.meta.put({ key: "lastSyncAt", value: at });
      });
      if (!page.nextCursor) return "COMPLETE";
      cursor = page.nextCursor;
    }
  } catch { return "OFFLINE"; }
}
