BEGIN;
-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "nameKey" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "reversalOfId" UUID,
ADD COLUMN     "stockOperationId" UUID;

-- CreateTable
CREATE TABLE "StockOperation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "itemId" UUID,
    "locationId" UUID,
    "destinationLocationId" UUID,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "direction" VARCHAR(10),
    "reason" VARCHAR(500) NOT NULL,
    "targetType" VARCHAR(20),
    "targetId" UUID,
    "reversalKey" VARCHAR(80),
    "accountingRecordId" UUID,
    "requestHash" VARCHAR(64) NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StockOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "approvedBy" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockOperation_reversalKey_key" ON "StockOperation"("reversalKey");

-- CreateIndex
CREATE UNIQUE INDEX "StockOperation_accountingRecordId_key" ON "StockOperation"("accountingRecordId");

-- CreateIndex
CREATE INDEX "StockOperation_tenantId_farmId_createdAt_id_idx" ON "StockOperation"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "StockOperation_itemId_farmId_tenantId_idx" ON "StockOperation"("itemId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "StockOperation_locationId_farmId_tenantId_idx" ON "StockOperation"("locationId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "StockOperation_destinationLocationId_farmId_tenantId_idx" ON "StockOperation"("destinationLocationId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "StockOperation_createdBy_idx" ON "StockOperation"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "StockOperation_id_farmId_tenantId_key" ON "StockOperation"("id", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOperation_accountingRecordId_farmId_tenantId_key" ON "StockOperation"("accountingRecordId", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_operationId_key" ON "StockAdjustment"("operationId");

-- CreateIndex
CREATE INDEX "StockAdjustment_tenantId_farmId_createdAt_id_idx" ON "StockAdjustment"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "StockAdjustment_operationId_farmId_tenantId_idx" ON "StockAdjustment"("operationId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "StockAdjustment_createdBy_idx" ON "StockAdjustment"("createdBy");

-- CreateIndex
CREATE INDEX "StockAdjustment_approvedBy_idx" ON "StockAdjustment"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_operationId_farmId_tenantId_key" ON "StockAdjustment"("operationId", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_farmId_tenantId_nameKey_unit_key" ON "InventoryItem"("farmId", "tenantId", "nameKey", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_reversalOfId_key" ON "StockMovement"("reversalOfId");

-- CreateIndex
CREATE INDEX "StockMovement_stockOperationId_farmId_tenantId_idx" ON "StockMovement"("stockOperationId", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_id_farmId_tenantId_key" ON "StockMovement"("id", "farmId", "tenantId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockOperationId_farmId_tenantId_fkey" FOREIGN KEY ("stockOperationId", "farmId", "tenantId") REFERENCES "StockOperation"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reversalOfId_farmId_tenantId_fkey" FOREIGN KEY ("reversalOfId", "farmId", "tenantId") REFERENCES "StockMovement"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_itemId_farmId_tenantId_fkey" FOREIGN KEY ("itemId", "farmId", "tenantId") REFERENCES "InventoryItem"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_locationId_farmId_tenantId_fkey" FOREIGN KEY ("locationId", "farmId", "tenantId") REFERENCES "StorageLocation"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_destinationLocationId_farmId_tenantId_fkey" FOREIGN KEY ("destinationLocationId", "farmId", "tenantId") REFERENCES "StorageLocation"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_accountingRecordId_farmId_tenantId_fkey" FOREIGN KEY ("accountingRecordId", "farmId", "tenantId") REFERENCES "AccountingRecord"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_operationId_farmId_tenantId_fkey" FOREIGN KEY ("operationId", "farmId", "tenantId") REFERENCES "StockOperation"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_kind_check";
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_kind_check" CHECK (version=1 AND length(btrim(name)) BETWEEN 1 AND 120 AND ((kind='CROP' AND unit='KG' AND "cropCycleId" IS NOT NULL AND "batchId" IS NULL) OR (kind IN ('BIRD','EGG') AND unit=kind AND "batchId" IS NOT NULL AND "cropCycleId" IS NULL) OR (kind='SUPPLY' AND "batchId" IS NULL AND "cropCycleId" IS NULL AND "nameKey" IS NOT NULL AND length(btrim(unit)) BETWEEN 1 AND 20 AND unit NOT IN ('BIRD','EGG'))));
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_reason_check";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reason_check" CHECK ((reason IN ('HARVEST','OPENING','PURCHASE','EGGS','TRANSFER_IN','ADJUSTMENT_IN') AND "quantityDelta">0) OR (reason IN ('LOSS','MORTALITY','BIRD_SALE','SALE','TRANSFER_OUT','ADJUSTMENT_OUT') AND "quantityDelta"<0) OR (reason='REVERSAL' AND "quantityDelta"<>0 AND "reversalOfId" IS NOT NULL));
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_source_check";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_source_check" CHECK (num_nonnulls("harvestId","productionEventId","openingBatchId","stockOperationId")=1);
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_shape_check" CHECK (quantity>0 AND version=1 AND length(btrim(reason)) BETWEEN 1 AND 500 AND length(btrim(unit)) BETWEEN 1 AND 20 AND type IN ('SALE','LOSS','TRANSFER','ADJUSTMENT','REVERSE') AND (type='SALE')=("accountingRecordId" IS NOT NULL) AND (type='TRANSFER')=("destinationLocationId" IS NOT NULL) AND (type='REVERSE')=("reversalKey" IS NOT NULL) AND (type='ADJUSTMENT')=(direction IS NOT NULL) AND (direction IS NULL OR direction IN ('IN','OUT')));
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_target_check" CHECK ((type='REVERSE' AND "targetType" IN ('HARVEST','PRODUCTION','OPERATION') AND "targetId" IS NOT NULL) OR (type<>'REVERSE' AND "targetType" IS NULL AND "targetId" IS NULL AND "itemId" IS NOT NULL AND "locationId" IS NOT NULL));
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_date_check" CHECK ("occurredOn" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_approval_check" CHECK ("approvedBy"="createdBy" AND length(btrim(reason)) BETWEEN 1 AND 500);
ALTER TABLE "StockOperation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockAdjustment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "StockOperation","StockAdjustment" FROM PUBLIC;
COMMIT;
