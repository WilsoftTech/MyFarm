import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import { evidenceOf, insightEvidenceSchema, isThresholdEvidence, thresholdEvidenceOf, type InsightEvidence, type InsightFeed, type InsightRepository, type InsightView } from "../contracts/insights";
import { evaluateBatchTrends, type BatchTrendEvaluation } from "../domain/batch-trends";
import { decideInsight, subjectOutcomes, type LatestInsight, type RepeatOutcome, type StoredFigure } from "../domain/insight-state";
import type { RuleKey, Severity } from "../domain/rules";
import { evaluateFeedStock, evaluateHighMortality, evaluateUnitLoss, thresholdCandidates, type ThresholdFigure, type ThresholdSubject } from "../domain/thresholds";
import { date, insightFacts } from "./insight-facts";

const day = (value: Date) => value.toISOString().slice(0, 10);
const liveKey = (subjectId: string, ruleKey: string, currency: string | null) => subjectId + ":" + ruleKey + ":" + (currency ?? "");
type InsightRow = Prisma.FarmInsightGetPayload<object>;

function view(row: InsightRow): InsightView {
  return {
    insightId: row.id, batchId: row.batchId, cropCycleId: row.cropCycleId, ruleKey: row.ruleKey as RuleKey, ruleVersion: row.ruleVersion, severity: row.severity, status: row.status, currency: row.currency,
    evaluatedOn: day(row.evaluatedOn), evidence: insightEvidenceSchema.parse(row.evidence), acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null, version: row.version,
  };
}
function storedFigures(evidence: InsightEvidence): StoredFigure[] {
  return isThresholdEvidence(evidence) ? [{ rule: evidence.figure.rule, exactChange: evidence.figure.exactValue }]
    : evidence.figures.map(figure => ({ rule: figure.rule, exactChange: figure.exactChange }));
}
/** One subject's outcome, ready for the repeat rule and, when raised, for storage. */
interface Decision { key: string; subject: { batchId: string | null; cropCycleId: string | null }; outcome: RepeatOutcome; create: { ruleKey: RuleKey; ruleVersion: number; severity: Severity; currency: string | null; evidence: InsightEvidence } | null }

const SEVERITY_ORDER = { WARNING: 0, WATCH: 1 } as const;

export function insightRepository(db: PrismaClient): InsightRepository {
  return {
    generate: (scope, today) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const where = { tenantId: scope.tenantId, farmId: scope.farmId };
      const facts = await insightFacts(tx, where, today);
      const decisions: Decision[] = [];

      // R001 trends, as in T002.
      const evaluations = facts.batches.map(row => evaluateBatchTrends(row.trend, today)).filter((row): row is BatchTrendEvaluation => row !== null);
      for (const evaluation of evaluations) for (const outcome of subjectOutcomes(evaluation)) {
        const candidate = outcome.candidate;
        decisions.push({ key: liveKey(outcome.batchId, outcome.ruleKey, outcome.currency), subject: { batchId: outcome.batchId, cropCycleId: null }, outcome,
          create: candidate ? { ruleKey: candidate.ruleKey, ruleVersion: candidate.ruleVersion, severity: candidate.severity, currency: candidate.currency, evidence: evidenceOf(evaluation, candidate) } : null });
      }

      // R002 thresholds: every figure is a subject outcome, judged or not.
      const thresholdsNotJudged: InsightFeed["thresholdsNotJudged"] = [];
      const decide = (subject: ThresholdSubject, figures: readonly ThresholdFigure[]) => {
        const raised = thresholdCandidates(subject, figures);
        for (const figure of figures) {
          if (figure.outcome === "NOT_ENOUGH_RECORDS") thresholdsNotJudged.push({ subject, rule: figure.rule, currency: figure.currency, missing: figure.missing });
          const candidate = raised.find(row => row.figure === figure) ?? null;
          decisions.push({ key: liveKey(subject.id, figure.rule, figure.currency), subject: subject.kind === "BATCH" ? { batchId: subject.id, cropCycleId: null } : { batchId: null, cropCycleId: subject.id },
            outcome: { judged: figure.outcome !== "NOT_ENOUGH_RECORDS", candidate: candidate ? { figures: [{ rule: figure.rule, exactChange: figure.exactValue }] } : null },
            create: candidate ? { ruleKey: candidate.ruleKey, ruleVersion: candidate.ruleVersion, severity: candidate.severity, currency: candidate.currency, evidence: thresholdEvidenceOf(candidate) } : null });
        }
      };
      for (const batch of facts.batches) {
        const subject: ThresholdSubject = { kind: "BATCH", id: batch.trend.batchId, label: batch.trend.label };
        decide(subject, [evaluateHighMortality({ ...batch.trend }, today), evaluateFeedStock(batch.feed, today)]);
        // T004 readings: egg loss for laying batches, bird loss for meat batches.
        if (batch.purpose === "EGGS" || batch.purpose === "DUAL_PURPOSE") decide(subject, evaluateUnitLoss(batch.eggLoss));
        if (batch.purpose === "MEAT") decide(subject, evaluateUnitLoss(batch.birdLoss));
      }
      for (const crop of facts.crops) decide({ kind: "CROP_CYCLE", id: crop.cycleId, label: crop.label }, evaluateUnitLoss(crop.loss));

      const live = await tx.farmInsight.findMany({ where: { ...where, liveKey: { not: null } } });
      const byKey = new Map(live.map(row => [row.liveKey as string, row]));
      const clear = (row: InsightRow) => tx.farmInsight.updateMany({ where: { ...where, id: row.id, liveKey: row.liveKey, version: row.version },
        data: { status: "CLEARED", liveKey: null, clearedOn: date(today), version: { increment: 1 }, updatedAt: new Date() } });
      // A closed batch or crop cycle has nothing current to warn about, so what was raised on it is no longer live.
      const [closedBatches, closedCycles] = await Promise.all([
        tx.poultryBatch.findMany({ where: { ...where, id: { in: live.flatMap(row => row.batchId ? [row.batchId] : []) }, status: { not: "ACTIVE" } }, select: { id: true } }),
        tx.cropCycle.findMany({ where: { ...where, id: { in: live.flatMap(row => row.cropCycleId ? [row.cropCycleId] : []) }, status: { not: "ACTIVE" } }, select: { id: true } }),
      ]);
      const closed = new Set([...closedBatches, ...closedCycles].map(row => row.id));
      for (const row of live) if (closed.has(row.batchId ?? row.cropCycleId ?? "")) await clear(row);

      for (const decision of decisions) {
        const current = byKey.get(decision.key);
        const latest: LatestInsight | null = current ? { status: current.status, figures: storedFigures(insightEvidenceSchema.parse(current.evidence)) } : null;
        const action = decideInsight(latest, decision.outcome);
        if (action === "NONE") continue;
        // Clearing first frees the key, so a worse figure after acknowledgement can be raised in its place.
        if (current) await clear(current);
        if (action === "CREATE" && decision.create) {
          const row = decision.create;
          // A request evaluating the same farm at the same moment may have raised it already; the unique key keeps one.
          await tx.farmInsight.createMany({ skipDuplicates: true, data: [{ id: crypto.randomUUID(), ...where, ...decision.subject, ruleKey: row.ruleKey, ruleVersion: row.ruleVersion,
            severity: row.severity, currency: row.currency, liveKey: decision.key, evaluatedOn: date(today), evidence: row.evidence }] });
        }
      }
      const rows = await tx.farmInsight.findMany({ where: { ...where, liveKey: { not: null } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
      const insights = rows.map(view).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.status === b.status ? 0 : a.status === "OPEN" ? -1 : 1));
      const notJudged = evaluations.flatMap(evaluation => evaluation.figures.filter(figure => figure.outcome === "NOT_ENOUGH_RECORDS")
        .map(figure => ({ batchId: evaluation.batchId, batchLabel: evaluation.label, rule: figure.rule, currency: figure.currency, missing: figure.missing })));
      const feed: InsightFeed = { evaluatedOn: today, insights, notJudged, thresholdsNotJudged, batchesChecked: facts.batches.length, cropCyclesChecked: facts.crops.length, batchesTruncated: facts.truncated };
      return feed;
    }, { isolationLevel: "ReadCommitted", timeout: 20_000 }),

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

    async feedItem(scope, batchId) {
      const where = { tenantId: scope.tenantId, farmId: scope.farmId };
      if (!await db.poultryBatch.findFirst({ where: { ...where, id: batchId }, select: { id: true } })) throw new FoundationError("FORBIDDEN");
      const row = await db.batchFeedItem.findFirst({ where: { ...where, batchId }, select: { itemId: true, version: true, item: { select: { name: true, unit: true } } } });
      return row ? { batchId, itemId: row.itemId, itemName: row.item.name, unit: row.item.unit, version: row.version } : null;
    },
    setFeedItem: (scope, batchId, command) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const where = { tenantId: scope.tenantId, farmId: scope.farmId };
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "BATCH_FEED_ITEM_SET", targetId: batchId });
      await requireProductionWriteAccess(tx, scope);
      const [batch, item, current] = await Promise.all([
        tx.poultryBatch.findFirst({ where: { ...where, id: batchId }, select: { status: true } }),
        tx.inventoryItem.findFirst({ where: { ...where, id: command.itemId }, select: { id: true, name: true, unit: true, kind: true } }),
        tx.batchFeedItem.findFirst({ where: { ...where, batchId } }),
      ]);
      if (!batch) throw new FoundationError("FORBIDDEN");
      const link = (row: { itemId: string; version: number }, chosen: { name: string; unit: string }) => ({ batchId, itemId: row.itemId, itemName: chosen.name, unit: chosen.unit, version: row.version });
      if (replay) {
        if (replay !== batchId || !current || current.itemId !== command.itemId || current.version < (command.expectedVersion ?? 0) + 1 || !item) throw new FoundationError("CONFLICT");
        return link(current, item);
      }
      // A batch that is closed takes no new links; only a supply item of this farm can be its feed.
      if (batch.status !== "ACTIVE") throw new FoundationError("CONFLICT");
      if (!item || item.kind !== "SUPPLY") throw new FoundationError("INVALID_INPUT");
      if ((current?.version ?? null) !== command.expectedVersion) throw new FoundationError("CONFLICT");
      if (!current) {
        // Two first choices at the same moment: the unique batch key keeps one, and the other is told to reload.
        const made = await tx.batchFeedItem.createMany({ skipDuplicates: true, data: [{ id: crypto.randomUUID(), ...where, batchId, itemId: item.id, changedBy: scope.actorId }] });
        if (made.count !== 1) throw new FoundationError("CONFLICT");
        return link(await tx.batchFeedItem.findFirstOrThrow({ where: { ...where, batchId } }), item);
      }
      const result = await tx.batchFeedItem.updateMany({ where: { ...where, batchId, version: current.version }, data: { itemId: item.id, changedBy: scope.actorId, version: { increment: 1 }, updatedAt: new Date() } });
      if (result.count !== 1) throw new FoundationError("CONFLICT");
      return link(await tx.batchFeedItem.findFirstOrThrow({ where: { ...where, batchId } }), item);
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
