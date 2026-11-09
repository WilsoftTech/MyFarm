import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import type { CohortFacts, CohortSummary, IncidentView, MyParticipation, PilotRepository, StaffParticipant } from "../contracts/pilot";
import { MEASURED_ACTIONS } from "../domain/measures";

const day = (value: Date) => value.toISOString().slice(0, 10);
const date = (value: string) => new Date(value + "T00:00:00.000Z");
const unique = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
/** A cohort of about 25 farmers for one season stays far below this; reaching it means something is wrong. */
const MAX_FACT_ROWS = 100_000;

const cohortSelect = { id: true, name: true, code: true, startOn: true, endOn: true, status: true, _count: { select: { participations: { where: { status: "ENROLLED" } } } } } satisfies Prisma.PilotCohortSelect;
const cohortView = (row: Prisma.PilotCohortGetPayload<{ select: typeof cohortSelect }>): CohortSummary => ({ cohortId: row.id, name: row.name, code: row.code, startOn: day(row.startOn), endOn: day(row.endOn), status: row.status, joined: row._count.participations });
const mineSelect = { id: true, pseudonym: true, status: true, enrolledOn: true, version: true, cohort: { select: { name: true } } } satisfies Prisma.PilotParticipationSelect;
const mine = (row: Prisma.PilotParticipationGetPayload<{ select: typeof mineSelect }>): MyParticipation => ({ participationId: row.id, cohortName: row.cohort.name, pseudonym: row.pseudonym, status: row.status, enrolledOn: day(row.enrolledOn), version: row.version });
const incidentSelect = { id: true, openedOn: true, category: true, severity: true, summary: true, status: true, resolvedOn: true, version: true, participation: { select: { pseudonym: true, status: true } } } satisfies Prisma.SupportIncidentSelect;
const incident = (row: Prisma.SupportIncidentGetPayload<{ select: typeof incidentSelect }>): IncidentView => ({
  incidentId: row.id, openedOn: day(row.openedOn), category: row.category, severity: row.severity, summary: row.summary, status: row.status, resolvedOn: row.resolvedOn ? day(row.resolvedOn) : null, version: row.version,
  // A withdrawn farmer's pseudonym disappears from staff views (D-P09-009).
  pseudonym: row.participation && row.participation.status === "ENROLLED" ? row.participation.pseudonym : null,
});

export function pilotRepository(db: PrismaClient): PilotRepository {
  const owned = (scope: { organizationId: string }, cohortId: string) => ({ id: cohortId, tenantId: scope.organizationId });
  return {
    async isActiveFarmer(userId) {
      return (await db.membership.count({ where: { userId, role: "FARMER", status: "ACTIVE", user: { status: "ACTIVE" } } })) > 0;
    },
    async createCohort(scope, input) {
      return db.$transaction(async tx => {
        const id = crypto.randomUUID();
        const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.organizationId, requestId: input.requestId, action: "PILOT_COHORT_CREATED", targetId: id });
        if (!replay) await tx.pilotCohort.create({ data: { id, tenantId: scope.organizationId, name: input.name, code: input.code, consentVersion: input.consentVersion, startOn: date(input.startOn), endOn: date(input.endOn), requestId: input.requestId, createdBy: scope.actorId } });
        return cohortView(await tx.pilotCohort.findUniqueOrThrow({ where: { id: replay ?? id }, select: cohortSelect }));
      }).catch(error => { if (unique(error)) throw new FoundationError("CONFLICT"); throw error; });
    },
    async cohorts(scope) {
      return (await db.pilotCohort.findMany({ where: { tenantId: scope.organizationId }, select: cohortSelect, orderBy: [{ startOn: "desc" }, { id: "asc" }], take: 100 })).map(cohortView);
    },
    async cohort(scope, cohortId) {
      const row = await db.pilotCohort.findFirst({ where: owned(scope, cohortId), select: cohortSelect });
      return row ? cohortView(row) : null;
    },
    async cohortByCode(code) {
      const row = await db.pilotCohort.findUnique({ where: { code }, select: { id: true, tenantId: true, name: true, status: true, consentVersion: true, startOn: true, endOn: true } });
      return row ? { cohortId: row.id, tenantId: row.tenantId, name: row.name, status: row.status, consentVersion: row.consentVersion, startOn: day(row.startOn), endOn: day(row.endOn) } : null;
    },
    async join({ userId, cohort, requestId, enrolledOn }) {
      // Pseudonyms go P-01, P-02… in joining order; two farmers joining at once retry for the next free one.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          return await db.$transaction(async tx => {
            const existing = await tx.pilotParticipation.findUnique({ where: { cohortId_userId: { cohortId: cohort.cohortId, userId } }, select: { ...mineSelect, requestId: true } });
            // Joining again is harmless while in the pilot; after leaving, the farmer cannot come back (D-P09-009).
            if (existing) { if (existing.status !== "ENROLLED") throw new FoundationError("CONFLICT"); return mine(existing); }
            const id = crypto.randomUUID();
            await claimCommandReceipt(tx, { actorId: userId, tenantId: cohort.tenantId, requestId, action: "PILOT_JOINED", targetId: id });
            const taken = await tx.pilotParticipation.count({ where: { cohortId: cohort.cohortId } });
            const pseudonym = "P-" + String(taken + 1).padStart(2, "0");
            return mine(await tx.pilotParticipation.create({ data: { id, cohortId: cohort.cohortId, tenantId: cohort.tenantId, userId, pseudonym, consentVersion: cohort.consentVersion, enrolledOn: date(enrolledOn), requestId }, select: mineSelect }));
          });
        } catch (error) { if (!unique(error)) throw error; }
      }
      throw new FoundationError("CONFLICT");
    },
    async myParticipations(userId) {
      return (await db.pilotParticipation.findMany({ where: { userId }, select: mineSelect, orderBy: [{ enrolledAt: "desc" }, { id: "asc" }] })).map(mine);
    },
    async withdraw({ userId, participationId, requestId, expectedVersion }) {
      return db.$transaction(async tx => {
        const row = await tx.pilotParticipation.findFirst({ where: { id: participationId, userId }, select: { tenantId: true } });
        // Another farmer's participation looks the same as one that does not exist.
        if (!row) throw new FoundationError("FORBIDDEN");
        const replay = await claimCommandReceipt(tx, { actorId: userId, tenantId: row.tenantId, requestId, action: "PILOT_WITHDRAWN", targetId: participationId });
        if (!replay) {
          const changed = await tx.pilotParticipation.updateMany({ where: { id: participationId, userId, status: "ENROLLED", version: expectedVersion }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), version: { increment: 1 } } });
          if (changed.count !== 1) throw new FoundationError("CONFLICT");
        }
        return mine(await tx.pilotParticipation.findUniqueOrThrow({ where: { id: participationId }, select: mineSelect }));
      });
    },
    async facts(scope, cohortId) {
      const cohort = await db.pilotCohort.findFirstOrThrow({ where: owned(scope, cohortId), select: { startOn: true, endOn: true } });
      const participations = await db.pilotParticipation.findMany({ where: { cohortId, tenantId: scope.organizationId }, select: { id: true, userId: true, pseudonym: true, status: true, enrolledOn: true } });
      const users = participations.filter(row => row.status === "ENROLLED").map(row => row.userId);
      // A day of margin each side: receipts are stored in UTC and become farm days below.
      const occurredAt = { gte: new Date(cohort.startOn.getTime() - 86_400_000), lt: new Date(cohort.endOn.getTime() + 2 * 86_400_000) };
      const [receipts, usage, prompts, incidents] = await Promise.all([
        db.auditEvent.findMany({ where: { actorId: { in: users }, action: { in: [...MEASURED_ACTIONS] }, occurredAt }, select: { tenantId: true, requestId: true, actorId: true, action: true, occurredAt: true }, take: MAX_FACT_ROWS + 1 }),
        db.pilotUsageEvent.findMany({ where: { actorId: { in: users }, occurredAt }, select: { tenantId: true, requestId: true, actorId: true, kind: true, occurredAt: true }, take: MAX_FACT_ROWS + 1 }),
        db.pilotPrompt.findMany({ where: { cohortId, tenantId: scope.organizationId }, select: { participationId: true, promptedOn: true } }),
        db.supportIncident.findMany({ where: { cohortId, tenantId: scope.organizationId }, select: { participationId: true, openedOn: true, severity: true, status: true } }),
      ]);
      if (receipts.length > MAX_FACT_ROWS || usage.length > MAX_FACT_ROWS) throw new FoundationError("UNAVAILABLE");
      const facts: CohortFacts = {
        window: { startOn: day(cohort.startOn), endOn: day(cohort.endOn) },
        participants: participations.map(row => ({ participationId: row.id, userId: row.userId, pseudonym: row.pseudonym, status: row.status, enrolledOn: day(row.enrolledOn) })),
        receipts: receipts.map(row => ({ tenantId: row.tenantId, requestId: row.requestId, actorId: row.actorId, action: row.action, day: farmToday(row.occurredAt) })),
        usage: usage.map(row => ({ tenantId: row.tenantId, requestId: row.requestId, actorId: row.actorId, kind: row.kind, day: farmToday(row.occurredAt) })),
        prompts: prompts.map(row => ({ participationId: row.participationId, day: day(row.promptedOn) })),
        incidents: incidents.map(row => ({ participationId: row.participationId, openedOn: day(row.openedOn), severity: row.severity, status: row.status })),
      };
      return facts;
    },
    async participants(scope, cohortId) {
      // Pseudonyms only, and only of farmers still in the pilot (D-P09-007, D-P09-009).
      const rows = await db.pilotParticipation.findMany({ where: { cohortId, tenantId: scope.organizationId, status: "ENROLLED" }, select: { id: true, pseudonym: true, enrolledOn: true, paperConsentRef: true, version: true } });
      return rows.map((row): StaffParticipant => ({ participationId: row.id, pseudonym: row.pseudonym, enrolledOn: day(row.enrolledOn), paperConsent: row.paperConsentRef !== null, version: row.version }))
        .sort((a, b) => a.pseudonym.localeCompare(b.pseudonym, undefined, { numeric: true }));
    },
    async incidents(scope, cohortId) {
      return (await db.supportIncident.findMany({ where: { cohortId, tenantId: scope.organizationId }, select: incidentSelect, orderBy: [{ openedOn: "desc" }, { createdAt: "desc" }], take: 200 })).map(incident);
    },
    async recordPrompt(scope, cohortId, input) {
      return db.$transaction(async tx => {
        const participation = await tx.pilotParticipation.findFirst({ where: { id: input.participationId, cohortId, tenantId: scope.organizationId, status: "ENROLLED" }, select: { id: true } });
        if (!participation) throw new FoundationError("FORBIDDEN");
        const id = crypto.randomUUID();
        const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.organizationId, requestId: input.requestId, action: "PILOT_PROMPT_RECORDED", targetId: id });
        if (!replay) await tx.pilotPrompt.create({ data: { id, cohortId, tenantId: scope.organizationId, participationId: participation.id, promptedOn: date(input.promptedOn), channel: input.channel, requestId: input.requestId, createdBy: scope.actorId } });
        return { promptId: replay ?? id };
      });
    },
    async openIncident(scope, cohortId, input) {
      return db.$transaction(async tx => {
        if (input.participationId && !(await tx.pilotParticipation.count({ where: { id: input.participationId, cohortId, tenantId: scope.organizationId, status: "ENROLLED" } }))) throw new FoundationError("FORBIDDEN");
        const id = crypto.randomUUID();
        const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.organizationId, requestId: input.requestId, action: "SUPPORT_INCIDENT_OPENED", targetId: id });
        if (!replay) await tx.supportIncident.create({ data: { id, cohortId, tenantId: scope.organizationId, participationId: input.participationId ?? null, openedOn: date(input.openedOn), category: input.category, severity: input.severity, summary: input.summary, requestId: input.requestId, createdBy: scope.actorId } });
        return incident(await tx.supportIncident.findUniqueOrThrow({ where: { id: replay ?? id }, select: incidentSelect }));
      });
    },
    async resolveIncident(scope, cohortId, input) {
      return db.$transaction(async tx => {
        const row = await tx.supportIncident.findFirst({ where: { id: input.incidentId, cohortId, tenantId: scope.organizationId }, select: { openedOn: true } });
        if (!row) throw new FoundationError("FORBIDDEN");
        if (input.resolvedOn < day(row.openedOn)) throw new FoundationError("INVALID_INPUT");
        const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.organizationId, requestId: input.requestId, action: "SUPPORT_INCIDENT_RESOLVED", targetId: input.incidentId });
        if (!replay) {
          const changed = await tx.supportIncident.updateMany({ where: { id: input.incidentId, status: "OPEN", version: input.expectedVersion }, data: { status: "RESOLVED", resolvedOn: date(input.resolvedOn), version: { increment: 1 } } });
          if (changed.count !== 1) throw new FoundationError("CONFLICT");
        }
        return incident(await tx.supportIncident.findUniqueOrThrow({ where: { id: input.incidentId }, select: incidentSelect }));
      });
    },
    async recordPaperConsent(scope, cohortId, input) {
      return db.$transaction(async tx => {
        const row = await tx.pilotParticipation.findFirst({ where: { id: input.participationId, cohortId, tenantId: scope.organizationId, status: "ENROLLED" }, select: { id: true } });
        if (!row) throw new FoundationError("FORBIDDEN");
        const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.organizationId, requestId: input.requestId, action: "PILOT_PAPER_CONSENT_RECORDED", targetId: row.id });
        if (!replay) {
          const changed = await tx.pilotParticipation.updateMany({ where: { id: row.id, status: "ENROLLED", version: input.expectedVersion }, data: { paperConsentRef: input.paperConsentRef, paperConsentBy: scope.actorId, version: { increment: 1 } } });
          if (changed.count !== 1) throw new FoundationError("CONFLICT");
        }
        const after = await tx.pilotParticipation.findUniqueOrThrow({ where: { id: row.id }, select: { id: true, pseudonym: true, enrolledOn: true, paperConsentRef: true, version: true } });
        return { participationId: after.id, pseudonym: after.pseudonym, enrolledOn: day(after.enrolledOn), paperConsent: after.paperConsentRef !== null, version: after.version };
      });
    },
  };
}
