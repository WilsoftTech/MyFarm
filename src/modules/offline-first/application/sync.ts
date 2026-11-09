import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { parseProductionInput as parse } from "@/modules/enterprises-seasons/application/farm-access";
import { decodePullCursor, encodePullCursor, isPullCursorExpired, nextPullPosition, PULL_LIMITS, PULL_SECTIONS, type PullPosition, type PullSection } from "../domain/commands";
import { pullPositionSchema, pullQuerySchema, pushCommandSchema, pushRequestSchema, type PullPage, type PushCommand, type PushResponse } from "../contracts/commands";
import { keyReusedByAnotherOperation } from "../domain/replay";
import type { PushOutcome } from "../domain/sync-state";

/** The existing services do the work, so their authorization, validation, receipts and atomic writes all still apply. */
export interface SyncCommandServices {
  recordTransaction(kind: "EXPENSE" | "INCOME", farmId: string, input: unknown): Promise<{ recordId: string; version: number }>;
  recordHarvest(farmId: string, input: unknown): Promise<{ harvestId: string; version: number }>;
  scheduleActivity(farmId: string, input: unknown): Promise<{ activityId: string; version: number }>;
  recordActivityDone(farmId: string, input: unknown): Promise<{ activityId: string; version: number }>;
  completeActivity(farmId: string, activityId: string, input: unknown): Promise<{ activityId: string; version: number }>;
  /** Receipts already held on this key, for the replay check. Requires access to the farm. */
  priorReceiptActions(farmId: string, requestId: string): Promise<string[]>;
  /** What a stale edit is shown instead. */
  currentActivity(farmId: string, activityId: string): Promise<{ activityId: string; version: number; status: string }>;
}
/**
 * Optional pilot measure (D-P09-008): what reached the server from a phone, once per entry. It never fails a sync;
 * an implementation records its own errors and returns.
 */
export interface PushUsageLog { record(actorId: string, entries: { farmId: string; requestId: string; operation: string; outcome: "COMMITTED" | "REFUSED" }[]): Promise<void> }

/** requestId is always the command's own ID, whatever the payload says, so one intent cannot claim another's receipt. Photos upload separately. */
export function applySyncCommand(services: SyncCommandServices, command: PushCommand): Promise<Record<string, unknown>> {
  const input = { ...command.payload, requestId: command.clientMutationId };
  switch (command.operation) {
    case "RECORD_EXPENSE": return services.recordTransaction("EXPENSE", command.farmId, input).then(row => ({ recordId: row.recordId, version: row.version }));
    case "RECORD_INCOME": return services.recordTransaction("INCOME", command.farmId, input).then(row => ({ recordId: row.recordId, version: row.version }));
    case "RECORD_HARVEST": return services.recordHarvest(command.farmId, input).then(row => ({ harvestId: row.harvestId, version: row.version }));
    case "CREATE_TASK": return services.scheduleActivity(command.farmId, input).then(row => ({ activityId: row.activityId, version: row.version }));
    case "RECORD_ACTIVITY": return services.recordActivityDone(command.farmId, input).then(row => ({ activityId: row.activityId, version: row.version }));
    case "COMPLETE_ACTIVITY": {
      if (command.baseVersion === null) return Promise.reject(new FoundationError("INVALID_INPUT"));
      const { activityId, ...details } = input as { activityId?: unknown } & Record<string, unknown>;
      if (typeof activityId !== "string") return Promise.reject(new FoundationError("INVALID_INPUT"));
      return services.completeActivity(command.farmId, activityId, { ...details, expectedVersion: command.baseVersion }).then(row => ({ activityId: row.activityId, version: row.version }));
    }
    default: return Promise.reject(new FoundationError("INVALID_INPUT"));
  }
}

const OUTCOMES: Partial<Record<FoundationError["code"], PushOutcome>> = { CONFLICT: { status: "CONFLICT" }, INVALID_INPUT: { status: "INVALID" }, FORBIDDEN: { status: "DENIED" } };
/** Each command stands alone, so one refusal does not undo another's committed effect. Order is kept so parents go first. */
export class PushService {
  constructor(private readonly auth: Pick<RegistryAuthorization, "account">, private readonly services: SyncCommandServices, private readonly usage?: PushUsageLog) {}
  private async conflictDetails(command: PushCommand): Promise<PushOutcome> {
    const activityId = command.payload.activityId;
    if (command.operation !== "COMPLETE_ACTIVITY" || typeof activityId !== "string") return { status: "CONFLICT" };
    try { const row = await this.services.currentActivity(command.farmId, activityId); return { status: "CONFLICT", current: { activityId: row.activityId, version: row.version, status: row.status } }; }
    catch { return { status: "CONFLICT" }; }
  }
  async push(input: unknown): Promise<PushResponse> {
    const account = await this.auth.account();
    const { commands } = parse(pushRequestSchema, input);
    const results: PushResponse["results"] = [];
    const logged: Parameters<PushUsageLog["record"]>[1] = [];
    for (const raw of commands) {
      const parsed = pushCommandSchema.safeParse(raw);
      if (!parsed.success) { results.push({ clientMutationId: String(raw.clientMutationId ?? ""), outcome: { status: "INVALID" } }); continue; }
      const command = parsed.data;
      try {
        // A faulty client racing itself across operations could slip past this read; receipts still stop any repeat of each one.
        if (keyReusedByAnotherOperation(command.operation, await this.services.priorReceiptActions(command.farmId, command.clientMutationId))) throw new FoundationError("CONFLICT");
        results.push({ clientMutationId: command.clientMutationId, outcome: { status: "COMMITTED", result: await applySyncCommand(this.services, command) } });
        logged.push({ farmId: command.farmId, requestId: command.clientMutationId, operation: command.operation, outcome: "COMMITTED" });
      }
      catch (error) {
        // A session that ended mid-batch fails the whole request. Anything already committed replays from its receipt.
        if (error instanceof FoundationError && error.code === "UNAUTHENTICATED") throw error;
        const outcome = error instanceof FoundationError ? OUTCOMES[error.code] : undefined;
        results.push({ clientMutationId: command.clientMutationId, outcome: outcome?.status === "CONFLICT" ? await this.conflictDetails(command) : outcome ?? { status: "RETRYABLE" } });
        // Refused means the server said no; a passing failure will be retried and is not counted.
        if (outcome) logged.push({ farmId: command.farmId, requestId: command.clientMutationId, operation: command.operation, outcome: "REFUSED" });
      }
    }
    if (this.usage && logged.length > 0) await this.usage.record(account.id, logged);
    return { results };
  }
}

export interface PullSources {
  farms(): Promise<{ farmId: string; name: string }[]>;
  page(section: PullSection, farmId: string, cursor: string | null, limit: number): Promise<{ items: { id: string }[]; nextCursor: string | null }>;
}
/** Each page reuses the normal authorized lists. Records are only ever appended or change status, so no deletion markers are needed. */
export class PullService {
  constructor(private readonly auth: Pick<RegistryAuthorization, "account">, private readonly sources: PullSources, private readonly now: () => Date = () => new Date()) {}
  /** An account with no farmer profile yet has nothing to cache, which is not an error. */
  private farmList() {
    return this.sources.farms().catch((error: unknown) => {
      if (error instanceof FoundationError && error.code === "FORBIDDEN") return [];
      throw error;
    });
  }
  async pull(input: unknown = {}): Promise<PullPage> {
    await this.auth.account();
    const { cursor } = parse(pullQuerySchema, input);
    const now = this.now();
    let position: PullPosition = { snapshotId: crypto.randomUUID(), issuedAt: now.toISOString(), farmIndex: 0, sectionIndex: 0, pageCursor: null, taken: 0 };
    if (cursor) {
      position = parse(pullPositionSchema, decodePullCursor(cursor));
      if (isPullCursorExpired(position, now)) return { status: "EXPIRED" };
    }
    const farms = (await this.farmList()).slice(0, PULL_LIMITS.maxFarms);
    while (position.farmIndex < farms.length) {
      const farm = farms[position.farmIndex], section = PULL_SECTIONS[position.sectionIndex];
      try {
        const page = await this.sources.page(section, farm.farmId, position.pageCursor, PULL_LIMITS.pageSize);
        const next = nextPullPosition(position, page.nextCursor, page.items.length, farms.length);
        return { status: "OK", snapshotId: position.snapshotId, farms, farmId: farm.farmId, section, items: page.items, nextCursor: next ? encodePullCursor(next) : null };
      } catch (error) {
        // Access can end during a pull: this farm is skipped and later reconciliation drops it.
        if (!(error instanceof FoundationError) || error.code !== "FORBIDDEN") throw error;
        position = { ...position, farmIndex: position.farmIndex + 1, sectionIndex: 0, pageCursor: null, taken: 0 };
      }
    }
    return { status: "OK", snapshotId: position.snapshotId, farms, farmId: null, section: null, items: [], nextCursor: null };
  }
}
