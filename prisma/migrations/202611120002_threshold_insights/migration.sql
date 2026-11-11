BEGIN;
-- AlterTable
ALTER TABLE "FarmInsight" ADD COLUMN     "cropCycleId" UUID,
ALTER COLUMN "batchId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BatchFeedItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchFeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchFeedItem_itemId_farmId_tenantId_idx" ON "BatchFeedItem"("itemId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "BatchFeedItem_changedBy_idx" ON "BatchFeedItem"("changedBy");

-- CreateIndex
CREATE UNIQUE INDEX "BatchFeedItem_batchId_farmId_tenantId_key" ON "BatchFeedItem"("batchId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "FarmInsight_cropCycleId_farmId_tenantId_idx" ON "FarmInsight"("cropCycleId", "farmId", "tenantId");

-- AddForeignKey
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_cropCycleId_farmId_tenantId_fkey" FOREIGN KEY ("cropCycleId", "farmId", "tenantId") REFERENCES "CropCycle"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchFeedItem" ADD CONSTRAINT "BatchFeedItem_batchId_farmId_tenantId_fkey" FOREIGN KEY ("batchId", "farmId", "tenantId") REFERENCES "PoultryBatch"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchFeedItem" ADD CONSTRAINT "BatchFeedItem_itemId_farmId_tenantId_fkey" FOREIGN KEY ("itemId", "farmId", "tenantId") REFERENCES "InventoryItem"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchFeedItem" ADD CONSTRAINT "BatchFeedItem_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 10 R002 checks (D-P10-003, D-P10-005, D-P10-007).
-- An insight is about exactly one subject: a poultry batch or a crop cycle (crop loss, D-P10-005).
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_subject_check" CHECK (num_nonnulls("batchId", "cropCycleId") = 1);
ALTER TABLE "FarmInsight" DROP CONSTRAINT "FarmInsight_rule_check";
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_rule_check" CHECK ("ruleKey" IN ('FEED_COST_RISING', 'EGGS_FALLING', 'MORTALITY_RISING', 'PRODUCTION_FALLING_COSTS_RISING',
  'HIGH_MORTALITY', 'FEED_RUNNING_LOW', 'LOSS_PER_EGG', 'LOSS_PER_BIRD', 'LOSS_PER_KG') AND "ruleVersion" >= 1
  AND ("cropCycleId" IS NULL OR "ruleKey" = 'LOSS_PER_KG') AND ("batchId" IS NULL OR "ruleKey" <> 'LOSS_PER_KG'));
ALTER TABLE "FarmInsight" DROP CONSTRAINT "FarmInsight_live_key_check";
ALTER TABLE "FarmInsight" ADD CONSTRAINT "FarmInsight_live_key_check" CHECK (
  ("status" = 'CLEARED' AND "liveKey" IS NULL AND "clearedOn" IS NOT NULL)
  OR ("status" <> 'CLEARED' AND "clearedOn" IS NULL AND "liveKey" = COALESCE("batchId", "cropCycleId")::text || ':' || "ruleKey" || ':' || COALESCE("currency", ''))
);
ALTER TABLE "BatchFeedItem" ADD CONSTRAINT "BatchFeedItem_version_check" CHECK ("version" >= 1);
ALTER TABLE "BatchFeedItem" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "BatchFeedItem" FROM PUBLIC;
COMMIT;
