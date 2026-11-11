BEGIN;
-- CreateEnum
CREATE TYPE "CategoryMetric" AS ENUM ('FEED');

-- AlterTable
ALTER TABLE "TransactionCategory" ADD COLUMN     "metric" "CategoryMetric";

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('WARNING', 'WATCH');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLEARED');

-- CreateTable
CREATE TABLE "FarmInsight" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "ruleKey" VARCHAR(60) NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "severity" "InsightSeverity" NOT NULL,
    "status" "InsightStatus" NOT NULL DEFAULT 'OPEN',
    "currency" CHAR(3),
    "liveKey" VARCHAR(140),
    "evaluatedOn" DATE NOT NULL,
    "evidence" JSONB NOT NULL,
    "acknowledgedAt" TIMESTAMPTZ(6),
    "acknowledgedBy" UUID,
    "clearedOn" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmInsight_tenantId_farmId_batchId_ruleKey_createdAt_idx" ON "FarmInsight"("tenantId", "farmId", "batchId", "ruleKey", "createdAt");

-- CreateIndex
CREATE INDEX "FarmInsight_batchId_farmId_tenantId_idx" ON "FarmInsight"("batchId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "FarmInsight_acknowledgedBy_idx" ON "FarmInsight"("acknowledgedBy");

-- CreateIndex
CREATE UNIQUE INDEX "FarmInsight_farmId_tenantId_liveKey_key" ON "FarmInsight"("farmId", "tenantId", "liveKey");

-- AddForeignKey
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_batchId_farmId_tenantId_fkey" FOREIGN KEY ("batchId", "farmId", "tenantId") REFERENCES "PoultryBatch"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A metric marker describes a cost, so a revenue category can never hold one.
ALTER TABLE "TransactionCategory" ADD CONSTRAINT "TransactionCategory_metric_is_for_costs" CHECK ("metric" IS NULL OR kind = 'COST');
-- D-P10-002: feed cost per bird reads the approved Feed category.
UPDATE "TransactionCategory" SET "metric" = 'FEED' WHERE id = 'f4040002-0000-4000-8000-000000000112';

-- Phase 10 checks (D-P10-002 to D-P10-006).
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_rule_check" CHECK ("ruleKey" IN ('FEED_COST_RISING', 'EGGS_FALLING', 'MORTALITY_RISING', 'PRODUCTION_FALLING_COSTS_RISING') AND "ruleVersion" >= 1);
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_currency_check" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$');
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_version_check" CHECK ("version" >= 1);
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_evidence_check" CHECK (jsonb_typeof("evidence") = 'object' AND ("evidence"->>'evidenceVersion') = '1');
-- One live insight per batch, rule and currency: the key is set exactly while the insight is not cleared.
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_live_key_check" CHECK (
  ("status" = 'CLEARED' AND "liveKey" IS NULL AND "clearedOn" IS NOT NULL)
  OR ("status" <> 'CLEARED' AND "clearedOn" IS NULL AND "liveKey" = "batchId"::text || ':' || "ruleKey" || ':' || COALESCE("currency", ''))
);
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_acknowledged_check" CHECK (("acknowledgedAt" IS NULL) = ("acknowledgedBy" IS NULL) AND ("status" <> 'ACKNOWLEDGED' OR "acknowledgedAt" IS NOT NULL));
ALTER TABLE "FarmInsight" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "FarmInsight" FROM PUBLIC;
COMMIT;
