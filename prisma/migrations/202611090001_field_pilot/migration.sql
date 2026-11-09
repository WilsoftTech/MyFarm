BEGIN;
-- CreateEnum
CREATE TYPE "PilotParticipationStatus" AS ENUM ('ENROLLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PilotUsageKind" AS ENUM ('OFFLINE_COMMITTED', 'SYNC_REFUSED');

-- CreateEnum
CREATE TYPE "PilotPromptChannel" AS ENUM ('CALL', 'SMS', 'VISIT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('SIGN_IN', 'SYNC', 'DATA_ENTRY', 'UNDERSTANDING', 'DEVICE', 'OTHER');

-- CreateTable
CREATE TABLE "PilotCohort" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "consentVersion" VARCHAR(40) NOT NULL,
    "startOn" DATE NOT NULL,
    "endOn" DATE NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotParticipation" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "pseudonym" VARCHAR(12) NOT NULL,
    "status" "PilotParticipationStatus" NOT NULL DEFAULT 'ENROLLED',
    "consentVersion" VARCHAR(40) NOT NULL,
    "enrolledOn" DATE NOT NULL,
    "enrolledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMPTZ(6),
    "paperConsentRef" VARCHAR(60),
    "paperConsentBy" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestId" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotUsageEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "kind" "PilotUsageKind" NOT NULL,
    "operation" VARCHAR(40) NOT NULL,
    "requestId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotPrompt" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "participationId" UUID NOT NULL,
    "promptedOn" DATE NOT NULL,
    "channel" "PilotPromptChannel" NOT NULL,
    "requestId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportIncident" (
    "id" UUID NOT NULL,
    "cohortId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "participationId" UUID,
    "openedOn" DATE NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "severity" "SupportSeverity" NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedOn" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PilotCohort_code_key" ON "PilotCohort"("code");

-- CreateIndex
CREATE INDEX "PilotCohort_tenantId_createdAt_id_idx" ON "PilotCohort"("tenantId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PilotCohort_createdBy_idx" ON "PilotCohort"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PilotCohort_id_tenantId_key" ON "PilotCohort"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PilotCohort_tenantId_requestId_key" ON "PilotCohort"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "PilotParticipation_userId_idx" ON "PilotParticipation"("userId");

-- CreateIndex
CREATE INDEX "PilotParticipation_paperConsentBy_idx" ON "PilotParticipation"("paperConsentBy");

-- CreateIndex
CREATE UNIQUE INDEX "PilotParticipation_cohortId_userId_key" ON "PilotParticipation"("cohortId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PilotParticipation_cohortId_pseudonym_key" ON "PilotParticipation"("cohortId", "pseudonym");

-- CreateIndex
CREATE UNIQUE INDEX "PilotParticipation_id_tenantId_key" ON "PilotParticipation"("id", "tenantId");

-- CreateIndex
CREATE INDEX "PilotUsageEvent_actorId_occurredAt_idx" ON "PilotUsageEvent"("actorId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PilotUsageEvent_tenantId_requestId_kind_key" ON "PilotUsageEvent"("tenantId", "requestId", "kind");

-- CreateIndex
CREATE INDEX "PilotPrompt_cohortId_promptedOn_idx" ON "PilotPrompt"("cohortId", "promptedOn");

-- CreateIndex
CREATE INDEX "PilotPrompt_participationId_tenantId_idx" ON "PilotPrompt"("participationId", "tenantId");

-- CreateIndex
CREATE INDEX "PilotPrompt_createdBy_idx" ON "PilotPrompt"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PilotPrompt_tenantId_requestId_key" ON "PilotPrompt"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "SupportIncident_cohortId_openedOn_idx" ON "SupportIncident"("cohortId", "openedOn");

-- CreateIndex
CREATE INDEX "SupportIncident_participationId_tenantId_idx" ON "SupportIncident"("participationId", "tenantId");

-- CreateIndex
CREATE INDEX "SupportIncident_createdBy_idx" ON "SupportIncident"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "SupportIncident_tenantId_requestId_key" ON "SupportIncident"("tenantId", "requestId");

-- AddForeignKey
ALTER TABLE "PilotCohort" ADD CONSTRAINT "PilotCohort_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotCohort" ADD CONSTRAINT "PilotCohort_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotParticipation" ADD CONSTRAINT "PilotParticipation_cohortId_tenantId_fkey" FOREIGN KEY ("cohortId", "tenantId") REFERENCES "PilotCohort"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotParticipation" ADD CONSTRAINT "PilotParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotParticipation" ADD CONSTRAINT "PilotParticipation_paperConsentBy_fkey" FOREIGN KEY ("paperConsentBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotUsageEvent" ADD CONSTRAINT "PilotUsageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotUsageEvent" ADD CONSTRAINT "PilotUsageEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotPrompt" ADD CONSTRAINT "PilotPrompt_cohortId_tenantId_fkey" FOREIGN KEY ("cohortId", "tenantId") REFERENCES "PilotCohort"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotPrompt" ADD CONSTRAINT "PilotPrompt_participationId_tenantId_fkey" FOREIGN KEY ("participationId", "tenantId") REFERENCES "PilotParticipation"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotPrompt" ADD CONSTRAINT "PilotPrompt_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportIncident" ADD CONSTRAINT "SupportIncident_cohortId_tenantId_fkey" FOREIGN KEY ("cohortId", "tenantId") REFERENCES "PilotCohort"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportIncident" ADD CONSTRAINT "SupportIncident_participationId_tenantId_fkey" FOREIGN KEY ("participationId", "tenantId") REFERENCES "PilotParticipation"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportIncident" ADD CONSTRAINT "SupportIncident_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 9 field pilot checks (D-P09-002 to D-P09-009).
ALTER TABLE "PilotCohort" ADD CONSTRAINT "PilotCohort_code_check" CHECK ("code" ~ '^[A-Z0-9]{6,12}$');
ALTER TABLE "PilotCohort" ADD CONSTRAINT "PilotCohort_window_check" CHECK ("endOn" >= "startOn");
ALTER TABLE "PilotCohort" ADD CONSTRAINT "PilotCohort_version_check" CHECK ("version" >= 1);
ALTER TABLE "PilotParticipation" ADD CONSTRAINT "PilotParticipation_pseudonym_check" CHECK ("pseudonym" ~ '^P-[0-9]{2,4}$');
ALTER TABLE "PilotParticipation" ADD CONSTRAINT "PilotParticipation_status_check" CHECK (("status" = 'ENROLLED' AND "withdrawnAt" IS NULL) OR ("status" = 'WITHDRAWN' AND "withdrawnAt" IS NOT NULL));
ALTER TABLE "PilotParticipation" ADD CONSTRAINT "PilotParticipation_paper_consent_check" CHECK (("paperConsentRef" IS NULL) = ("paperConsentBy" IS NULL));
ALTER TABLE "PilotParticipation" ADD CONSTRAINT "PilotParticipation_version_check" CHECK ("version" >= 1);
ALTER TABLE "PilotUsageEvent" ADD CONSTRAINT "PilotUsageEvent_operation_check" CHECK (length(trim("operation")) > 0);
ALTER TABLE "SupportIncident" ADD CONSTRAINT "SupportIncident_status_check" CHECK (("status" = 'OPEN' AND "resolvedOn" IS NULL) OR ("status" = 'RESOLVED' AND "resolvedOn" IS NOT NULL AND "resolvedOn" >= "openedOn"));
ALTER TABLE "SupportIncident" ADD CONSTRAINT "SupportIncident_summary_check" CHECK (length(trim("summary")) > 0);
ALTER TABLE "SupportIncident" ADD CONSTRAINT "SupportIncident_version_check" CHECK ("version" >= 1);
ALTER TABLE "PilotCohort" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PilotParticipation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PilotUsageEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PilotPrompt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportIncident" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "PilotCohort", "PilotParticipation", "PilotUsageEvent", "PilotPrompt", "SupportIncident" FROM PUBLIC;
COMMIT;
