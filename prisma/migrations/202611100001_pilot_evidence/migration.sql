BEGIN;
-- CreateEnum
CREATE TYPE "PilotObservationKind" AS ENUM ('HESITATION', 'CONFUSION', 'ERROR', 'WORKAROUND', 'WORDING', 'POSITIVE');

-- CreateEnum
CREATE TYPE "PilotObservedScreen" AS ENUM ('EXPENSE_FORM', 'INCOME_FORM', 'SALE_OR_PURCHASE_FORM', 'HARVEST_FORM', 'ACTIVITY_FORM', 'STOCK', 'OFFLINE_WORK', 'FARM_FIGURES', 'SIGN_IN', 'OTHER');

-- CreateEnum
CREATE TYPE "PilotFindingStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PilotReviewDecision" AS ENUM ('CONTINUE', 'GO', 'NO_GO');

-- CreateTable
CREATE TABLE "PilotObservation" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "participationId" UUID,
    "observedOn" DATE NOT NULL,
    "screen" "PilotObservedScreen" NOT NULL,
    "kind" "PilotObservationKind" NOT NULL,
    "note" VARCHAR(500) NOT NULL,
    "requestId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotFinding" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "status" "PilotFindingStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotFindingEvidence" (
    "findingId" UUID NOT NULL,
    "observationId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,

    CONSTRAINT "PilotFindingEvidence_pkey" PRIMARY KEY ("findingId","observationId")
);

-- CreateTable
CREATE TABLE "PilotReview" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "reviewedOn" DATE NOT NULL,
    "decision" "PilotReviewDecision" NOT NULL,
    "gateWeek" INTEGER,
    "retainedVoluntarily" INTEGER,
    "onboarded" INTEGER NOT NULL,
    "gateMet" BOOLEAN,
    "atEnd" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(1000) NOT NULL,
    "requestId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PilotObservation_cohortId_observedOn_idx" ON "PilotObservation"("cohortId", "observedOn");

-- CreateIndex
CREATE INDEX "PilotObservation_participationId_tenantId_idx" ON "PilotObservation"("participationId", "tenantId");

-- CreateIndex
CREATE INDEX "PilotObservation_createdBy_idx" ON "PilotObservation"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PilotObservation_id_tenantId_key" ON "PilotObservation"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PilotObservation_tenantId_requestId_key" ON "PilotObservation"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "PilotFinding_cohortId_createdAt_idx" ON "PilotFinding"("cohortId", "createdAt");

-- CreateIndex
CREATE INDEX "PilotFinding_createdBy_idx" ON "PilotFinding"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PilotFinding_id_tenantId_key" ON "PilotFinding"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PilotFinding_tenantId_requestId_key" ON "PilotFinding"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "PilotFindingEvidence_observationId_tenantId_idx" ON "PilotFindingEvidence"("observationId", "tenantId");

-- CreateIndex
CREATE INDEX "PilotFindingEvidence_findingId_tenantId_idx" ON "PilotFindingEvidence"("findingId", "tenantId");

-- CreateIndex
CREATE INDEX "PilotReview_cohortId_reviewedOn_idx" ON "PilotReview"("cohortId", "reviewedOn");

-- CreateIndex
CREATE INDEX "PilotReview_createdBy_idx" ON "PilotReview"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PilotReview_tenantId_requestId_key" ON "PilotReview"("tenantId", "requestId");

-- AddForeignKey
ALTER TABLE "PilotObservation" ADD CONSTRAINT "PilotObservation_cohortId_tenantId_fkey" FOREIGN KEY ("cohortId", "tenantId") REFERENCES "PilotCohort"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotObservation" ADD CONSTRAINT "PilotObservation_participationId_tenantId_fkey" FOREIGN KEY ("participationId", "tenantId") REFERENCES "PilotParticipation"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotObservation" ADD CONSTRAINT "PilotObservation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFinding" ADD CONSTRAINT "PilotFinding_cohortId_tenantId_fkey" FOREIGN KEY ("cohortId", "tenantId") REFERENCES "PilotCohort"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFinding" ADD CONSTRAINT "PilotFinding_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFindingEvidence" ADD CONSTRAINT "PilotFindingEvidence_findingId_tenantId_fkey" FOREIGN KEY ("findingId", "tenantId") REFERENCES "PilotFinding"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotFindingEvidence" ADD CONSTRAINT "PilotFindingEvidence_observationId_tenantId_fkey" FOREIGN KEY ("observationId", "tenantId") REFERENCES "PilotObservation"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotReview" ADD CONSTRAINT "PilotReview_cohortId_tenantId_fkey" FOREIGN KEY ("cohortId", "tenantId") REFERENCES "PilotCohort"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotReview" ADD CONSTRAINT "PilotReview_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 9 R002 checks (D-P09-004, D-P09-009).
ALTER TABLE "PilotObservation" ADD CONSTRAINT "PilotObservation_note_check" CHECK (length(trim("note")) > 0);
ALTER TABLE "PilotFinding" ADD CONSTRAINT "PilotFinding_title_check" CHECK (length(trim("title")) > 0);
ALTER TABLE "PilotFinding" ADD CONSTRAINT "PilotFinding_version_check" CHECK ("version" >= 1);
ALTER TABLE "PilotReview" ADD CONSTRAINT "PilotReview_reason_check" CHECK (length(trim("reason")) > 0);
-- A decision either way rests on a judged gate; GO only on a met one. CONTINUE may come before any gate.
ALTER TABLE "PilotReview" ADD CONSTRAINT "PilotReview_gate_check" CHECK (
  ("gateWeek" IS NULL AND "retainedVoluntarily" IS NULL AND "gateMet" IS NULL AND "decision" = 'CONTINUE')
  OR ("gateWeek" >= 1 AND "retainedVoluntarily" >= 0 AND "retainedVoluntarily" <= "onboarded" AND "gateMet" IS NOT NULL AND ("decision" <> 'GO' OR "gateMet"))
);
ALTER TABLE "PilotReview" ADD CONSTRAINT "PilotReview_onboarded_check" CHECK ("onboarded" >= 0);
ALTER TABLE "PilotObservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PilotFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PilotFindingEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PilotReview" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "PilotObservation", "PilotFinding", "PilotFindingEvidence", "PilotReview" FROM PUBLIC;
COMMIT;
