BEGIN;
-- Phase 11 T002 (D-P11-001 to D-P11-006): questions asked of the farm assistant, private to the person who asked and kept
-- 90 days (D-P11-003), and what explaining them cost per farm (D-P11-004). Additive.
-- CreateEnum
CREATE TYPE "AssistantIntent" AS ENUM ('HIGHEST_PROFIT', 'AGRONOMY', 'UNSUPPORTED');

-- CreateTable
CREATE TABLE "AssistantQuestion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "intent" "AssistantIntent" NOT NULL,
    "answers" JSONB NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionUntil" TIMESTAMPTZ(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP + '90 days'::interval),

    CONSTRAINT "AssistantQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantUsage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(100),
    "calls" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costEstimateUsd" DECIMAL(20,6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantQuestion_tenantId_farmId_actorId_createdAt_idx" ON "AssistantQuestion"("tenantId", "farmId", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantQuestion_retentionUntil_idx" ON "AssistantQuestion"("retentionUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantQuestion_actorId_requestId_key" ON "AssistantQuestion"("actorId", "requestId");

-- CreateIndex
CREATE INDEX "AssistantUsage_tenantId_farmId_createdAt_idx" ON "AssistantUsage"("tenantId", "farmId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssistantQuestion" ADD CONSTRAINT "AssistantQuestion_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantQuestion" ADD CONSTRAINT "AssistantQuestion_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A question is never edited: the answer shown is the answer kept. It lives exactly 90 days from when it was asked.
ALTER TABLE "AssistantQuestion" ADD CONSTRAINT "AssistantQuestion_question_check" CHECK (length(btrim("question")) BETWEEN 1 AND 500);
ALTER TABLE "AssistantQuestion" ADD CONSTRAINT "AssistantQuestion_answers_check" CHECK (COALESCE(jsonb_typeof("answers") = 'object' AND ("answers"->>'answersVersion') = '1' AND jsonb_typeof("answers"->'answers') = 'array', false));
ALTER TABLE "AssistantQuestion" ADD CONSTRAINT "AssistantQuestion_retention_check" CHECK ("retentionUntil" = "createdAt" + interval '90 days');
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_counts_check" CHECK ("calls" >= 0 AND "inputTokens" >= 0 AND "outputTokens" >= 0 AND "costEstimateUsd" >= 0);
ALTER TABLE "AssistantQuestion" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "AssistantQuestion" FROM PUBLIC;
ALTER TABLE "AssistantUsage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "AssistantUsage" FROM PUBLIC;
COMMIT;