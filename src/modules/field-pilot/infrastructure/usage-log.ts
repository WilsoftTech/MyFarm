import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { logSafe } from "@/modules/engineering-foundation/infrastructure/logging";
import type { PushUsageLog } from "@/modules/offline-first/application/sync";

/**
 * D-P09-008: one row per entry and outcome, in the tenant of the farm the farmer is a member of. A farm the farmer
 * does not belong to gives no tenant, so nothing is logged for it. Duplicates are skipped, so a retry adds nothing.
 */
export function pilotUsageLog(db: PrismaClient, farms: { farmScopeForMember(input: { userId: string; farmId: string }): Promise<{ tenantId: string } | null> }): PushUsageLog {
  return {
    async record(actorId, entries) {
      try {
        const tenants = new Map<string, string | null>();
        for (const farmId of new Set(entries.map(entry => entry.farmId))) tenants.set(farmId, (await farms.farmScopeForMember({ userId: actorId, farmId }))?.tenantId ?? null);
        const data = entries.flatMap(entry => {
          const tenantId = tenants.get(entry.farmId);
          return tenantId ? [{ tenantId, actorId, kind: entry.outcome === "COMMITTED" ? "OFFLINE_COMMITTED" as const : "SYNC_REFUSED" as const, operation: entry.operation, requestId: entry.requestId }] : [];
        });
        if (data.length > 0) await db.pilotUsageEvent.createMany({ data, skipDuplicates: true });
      } catch {
        // Measuring must never cost a farmer their sync; the gap shows as a logged failure.
        logSafe({ event: "request_failed", requestId: crypto.randomUUID(), code: "PILOT_USAGE_LOG_FAILED" });
      }
    },
  };
}
