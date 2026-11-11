import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import { moneyString, moneyUnits } from "@/modules/farm-accounting/domain/money";
import { quantityString, quantityUnits } from "@/modules/harvest-inventory/domain/harvest";
import type { ProductionEventType } from "@/modules/harvest-inventory/domain/production";
import { evidenceOf, insightEvidenceSchema, MAX_INSIGHT_BATCHES, type InsightFeed, type InsightRepository, type InsightView } from "../contracts/insights";
import { evaluateBatchTrends, trendWindows, type BatchTrendEvaluation, type BatchTrendFacts } from "../domain/batch-trends";
import { decideInsight, subjectOutcomes, type LatestInsight, type StoredFigure } from "../domain/insight-state";
import type { RuleKey } from "../domain/rules";

const day = (value: Date) => value.toISOString().slice(0, 10);
const date = (value: string) => new Date(value + "T00:00:00.000Z");
const quantity = (value: Prisma.Decimal) => quantityString(quantityUnits(value.toFixed(6)));
const money = (value: Prisma.Decimal) => moneyString(moneyUnits(value.toFixed(4)));
const liveKey = (batchId: string, ruleKey: string, currency: string | null) => batchId + ":" + ruleKey + ":" + (currency ?? "");
type InsightRow = Prisma.FarmInsightGetPayload<object>;

function view(row: InsightRow): InsightView {
  return {
    insightId: row.id, batchId: row.batchId, ruleKey: row.ruleKey as RuleKey, ruleVersion: row.ruleVersion, severity: row.severity, status: row.status, currency: row.currency,
    evaluatedOn: day(row.evaluatedOn), evidence: insightEvidenceSchema.parse(row.evidence), acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null, version: row.version,
  };
}
function storedFigures(row: InsightRow): StoredFigure[] {
  return insightEvidenceSchema.parse(row.evidence).figures.map(figure => ({ rule: figure.rule, exactChange: figure.exactChange }));
}

/** Reads one farm's active batches with everything the trend rules need, leaving out reversed entries and records. */
async function batchFacts(tx: Prisma.TransactionClient, where: { tenantId: string; farmId: string }, today: string) {
  const windows = trendWindows(today);
  const batches = await tx.poultryBatch.findMany({ where: { ...where, status: "ACTIVE" }, select: { id: true, batchLabel: true, startingQuantity: true, acquisitionDate: true },
    orderBy: [{ acquisitionDate: "desc" }, { id: "asc" }], take: MAX_INSIGHT_BATCHES + 1 });
  const shown = batches.slice(0, MAX_INSIGHT_BATCHES), batchIds = shown.map(row => row.id);
  const [entries, reversals, costs] = await Promise.all([
    // Every entry up to the end of the current window: flock size needs the whole history before it.
    tx.productionEvent.findMany({ where: { ...where, batchId: { in: batchIds }, occurredOn: { lte: date(windows.current.to) } }, select: { id: true, batchId: true, type: true, quantity: true, unit: true, occurredOn: true } }),
    tx.stockOperation.findMany({ where: { ...where, type: "REVERSE", targetType: "PRODUCTION" }, select: { targetId: true } }),
    // Feed costs are the categories marked FEED as data (P04-T004: code never names a seeded category).
    tx.accountingRecord.findMany({ where: { ...where, status: "POSTED", kind: { in: ["EXPENSE", "PURCHASE"] }, category: { metric: "FEED" }, batchId: { in: batchIds },
      occurredOn: { gte: date(windows.earlier.from), lte: date(windows.current.to) } }, select: { batchId: true, amount: true, currency: true, occurredOn: true } }),
  ]);
  const reversed = new Set(reversals.map(row => row.targetId));
  const facts: BatchTrendFacts[] = shown.map(batch => ({
    batchId: batch.id, label: batch.batchLabel, status: "ACTIVE", startingQuantity: batch.startingQuantity, acquiredOn: day(batch.acquisitionDate),
    entries: entries.filter(row => row.batchId === batch.id && !reversed.has(row.id)).map(row => ({ type: row.type as ProductionEventType, quantity: quantity(row.quantity), unit: row.unit, occurredOn: day(row.occurredOn) })),
    feedCosts: costs.filter(row => row.batchId === batch.id).map(row => ({ amount: money(row.amount), currency: row.currency, occurredOn: day(row.occurredOn) })),
  }));
  return { facts, truncated: batches.length > MAX_INSIGHT_BATCHES };
}

const SEVERITY_ORDER = { WARNING: 0, WATCH: 1 } as const;

export function insightRepository(db: PrismaClient): InsightRepository {
  return {
    generate: (scope, today) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const where = { tenantId: scope.tenantId, farmId: scope.farmId };
      const { facts, truncated } = await batchFacts(tx, where, today);
      const evaluations = facts.map(fact => evaluateBatchTrends(fact, today)).filter((row): row is BatchTrendEvaluation => row !== null);
      const live = await tx.farmInsight.findMany({ where: { ...where, liveKey: { not: null } } });
      const byKey = new Map(live.map(row => [row.liveKey as string, row]));
      const clear = (row: InsightRow) => tx.farmInsight.updateMany({ where: { ...where, id: row.id, liveKey: row.liveKey, version: row.version },
        data: { status: "CLEARED", liveKey: null, clearedOn: date(today), version: { increment: 1 }, updatedAt: new Date() } });
      // A closed batch has no current trend, so what was raised on it is no longer live.
      const closed = new Set((await tx.poultryBatch.findMany({ where: { ...where, id: { in: [...new Set(live.map(row => row.batchId))] }, status: { not: "ACTIVE" } }, select: { id: true } })).map(row => row.id));
      for (const row of live) if (closed.has(row.batchId)) await clear(row);
      for (const evaluation of evaluations) {
        for (const outcome of subjectOutcomes(evaluation)) {
          const key = liveKey(outcome.batchId, outcome.ruleKey, outcome.currency), current = byKey.get(key);
          const latest: LatestInsight | null = current ? { status: current.status, figures: storedFigures(current) } : null;
          const action = decideInsight(latest, outcome);
          if (action === "NONE") continue;
          // Clearing first frees the key, so a worse figure after acknowledgement can be raised in its place.
          if (current) await clear(current);
          if (action === "CREATE" && outcome.candidate) {
            const candidate = outcome.candidate;
            // A request evaluating the same farm at the same moment may have raised it already; the unique key keeps one.
            await tx.farmInsight.createMany({ skipDuplicates: true, data: [{ id: crypto.randomUUID(), ...where, batchId: candidate.batchId, ruleKey: candidate.ruleKey, ruleVersion: candidate.ruleVersion,
              severity: candidate.severity, currency: candidate.currency, liveKey: key, evaluatedOn: date(today), evidence: evidenceOf(evaluation, candidate) }] });
          }
        }
      }
      const rows = await tx.farmInsight.findMany({ where: { ...where, liveKey: { not: null } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
      const insights = rows.map(view).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.status === b.status ? 0 : a.status === "OPEN" ? -1 : 1));
      const notJudged = evaluations.flatMap(evaluation => evaluation.figures.filter(figure => figure.outcome === "NOT_ENOUGH_RECORDS")
        .map(figure => ({ batchId: evaluation.batchId, batchLabel: evaluation.label, rule: figure.rule, currency: figure.currency, missing: figure.missing })));
      const feed: InsightFeed = { evaluatedOn: today, insights, notJudged, batchesChecked: evaluations.length, batchesTruncated: truncated };
      return feed;
    }, { isolationLevel: "ReadCommitted", timeout: 15_000 }),

    acknowledge: (scope, insightId, command) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const where = { tenantId: scope.tenantId, farmId: scope.farmId, id: insightId };
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "INSIGHT_ACKNOWLEDGED", targetId: insightId });
      await requireProductionWriteAccess(tx, scope);
      const current = await tx.farmInsight.findFirst({ where });
      if (!current) throw new FoundationError("FORBIDDEN");
      if (replay) {
        if (replay !== insightId || current.acknowledgedBy !== scope.actorId || current.version < command.expectedVersion + 1) throw new FoundationError("CONFLICT");
        return view(current);
      }
      if (current.status !== "OPEN" || current.version !== command.expectedVersion) throw new FoundationError("CONFLICT");
      const now = new Date();
      const result = await tx.farmInsight.updateMany({ where: { ...where, status: "OPEN", version: command.expectedVersion },
        data: { status: "ACKNOWLEDGED", acknowledgedAt: now, acknowledgedBy: scope.actorId, version: { increment: 1 }, updatedAt: now } });
      if (result.count !== 1) throw new FoundationError("CONFLICT");
      return view(await tx.farmInsight.findFirstOrThrow({ where }));
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
