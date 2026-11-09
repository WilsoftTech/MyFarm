import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import type { EvidenceRepository, ReviewView } from "../contracts/pilot";

const day = (value: Date) => value.toISOString().slice(0, 10);
const date = (value: string) => new Date(value + "T00:00:00.000Z");
const reviewSelect = { id: true, reviewedOn: true, decision: true, gateWeek: true, retainedVoluntarily: true, onboarded: true, gateMet: true, atEnd: true, reason: true } satisfies Prisma.PilotReviewSelect;
const review = (row: Prisma.PilotReviewGetPayload<{ select: typeof reviewSelect }>): ReviewView => ({
  reviewId: row.id, reviewedOn: day(row.reviewedOn), decision: row.decision, onboarded: row.onboarded, reason: row.reason,
  gate: row.gateWeek === null || row.retainedVoluntarily === null || row.gateMet === null ? null : { gateWeek: row.gateWeek, retainedVoluntarily: row.retainedVoluntarily, onboarded: row.onboarded, gateMet: row.gateMet, atEnd: row.atEnd },
});
/** One season of observation stays far below this. */
const MAX_ROWS = 2000;

export function evidenceRepository(db: PrismaClient): EvidenceRepository {
  const where = (scope: { organizationId: string }, cohortId: string) => ({ cohortId, tenantId: scope.organizationId });
  return {
    async observations(scope, cohortId) {
      const rows = await db.pilotObservation.findMany({ where: where(scope, cohortId), select: { id: true, participationId: true, observedOn: true, screen: true, kind: true, note: true }, orderBy: [{ observedOn: "desc" }, { id: "asc" }], take: MAX_ROWS });
      return rows.map(row => ({ observationId: row.id, participationId: row.participationId, observedOn: day(row.observedOn), screen: row.screen, kind: row.kind, note: row.note }));
    },
    async participantStates(scope, cohortId) {
      return (await db.pilotParticipation.findMany({ where: where(scope, cohortId), select: { id: true, pseudonym: true, status: true } })).map(row => ({ participationId: row.id, pseudonym: row.pseudonym, status: row.status }));
    },
    async findings(scope, cohortId) {
      const rows = await db.pilotFinding.findMany({ where: where(scope, cohortId), select: { id: true, title: true, status: true, version: true, evidence: { select: { observationId: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: MAX_ROWS });
      return rows.map(row => ({ findingId: row.id, title: row.title, status: row.status, version: row.version, observationIds: row.evidence.map(link => link.observationId) }));
    },
    async reviews(scope, cohortId) {
      return (await db.pilotReview.findMany({ where: where(scope, cohortId), select: reviewSelect, orderBy: [{ reviewedOn: "desc" }, { createdAt: "desc" }], take: MAX_ROWS })).map(review);
    },
    async recordObservation(scope, cohortId, input) {
      return db.$transaction(async tx => {
        if (input.participationId && !(await tx.pilotParticipation.count({ where: { id: input.participationId, ...where(scope, cohortId), status: "ENROLLED" } }))) throw new FoundationError("FORBIDDEN");
        const id = crypto.randomUUID();
        const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.organizationId, requestId: input.requestId, action: "PILOT_OBSERVATION_RECORDED", targetId: id });
        if (!replay) await tx.pilotObservation.create({ data: { id, ...where(scope, cohortId), participationId: input.participationId ?? null, observedOn: date(input.observedOn), screen: input.screen, kind: input.kind, note: input.note, requestId: input.requestId, createdBy: scope.actorId } });
        return { observationId: replay ?? id };
      });
    },
    async createFinding(scope, cohortId, input) {
      return db.$transaction(async tx => {
        const id = crypto.randomUUID();
        const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.organizationId, requestId: input.requestId, action: "PILOT_FINDING_CREATED", targetId: id });
        if (replay) return { findingId: replay };
        await tx.pilotFinding.create({ data: { id, ...where(scope, cohortId), title: input.title, requestId: input.requestId, createdBy: scope.actorId } });
        // The service checked the observations stand; the policy checks each belongs to this cohort.
        await tx.pilotFindingEvidence.createMany({ data: input.observationIds.map(observationId => ({ findingId: id, observationId, tenantId: scope.organizationId })) });
        return { findingId: id };
      });
    },
    async closeFinding(scope, cohortId, input) {
      return db.$transaction(async tx => {
        if (!(await tx.pilotFinding.count({ where: { id: input.findingId, ...where(scope, cohortId) } }))) throw new FoundationError("FORBIDDEN");
        const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.organizationId, requestId: input.requestId, action: "PILOT_FINDING_CLOSED", targetId: input.findingId });
        if (!replay) {
          const changed = await tx.pilotFinding.updateMany({ where: { id: input.findingId, status: "OPEN", version: input.expectedVersion }, data: { status: input.status, version: { increment: 1 } } });
          if (changed.count !== 1) throw new FoundationError("CONFLICT");
        }
        return { findingId: input.findingId };
      });
    },
    async recordReview(scope, cohortId, input) {
      return db.$transaction(async tx => {
        const id = crypto.randomUUID();
        const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.organizationId, requestId: input.requestId, action: "PILOT_REVIEW_RECORDED", targetId: id });
        if (!replay) await tx.pilotReview.create({ data: {
          id, ...where(scope, cohortId), reviewedOn: date(input.reviewedOn), decision: input.decision, reason: input.reason, onboarded: input.onboarded,
          gateWeek: input.gate?.gateWeek ?? null, retainedVoluntarily: input.gate?.retainedVoluntarily ?? null, gateMet: input.gate?.gateMet ?? null, atEnd: input.gate?.atEnd ?? false,
          requestId: input.requestId, createdBy: scope.actorId,
        } });
        return review(await tx.pilotReview.findUniqueOrThrow({ where: { id: replay ?? id }, select: reviewSelect }));
      });
    },
  };
}
