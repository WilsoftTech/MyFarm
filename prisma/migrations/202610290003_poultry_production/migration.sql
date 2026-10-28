BEGIN;
-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "batchId" UUID;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "openingBatchId" UUID,
ADD COLUMN     "productionEventId" UUID,
ALTER COLUMN "harvestId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProductionEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "note" VARCHAR(500),
    "requestHash" VARCHAR(64) NOT NULL,
    "accountingRecordId" UUID,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProductionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionEvent_accountingRecordId_key" ON "ProductionEvent"("accountingRecordId");

-- CreateIndex
CREATE INDEX "ProductionEvent_tenantId_farmId_batchId_occurredOn_createdA_idx" ON "ProductionEvent"("tenantId", "farmId", "batchId", "occurredOn", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ProductionEvent_locationId_farmId_tenantId_idx" ON "ProductionEvent"("locationId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "ProductionEvent_createdBy_idx" ON "ProductionEvent"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionEvent_accountingRecordId_farmId_tenantId_key" ON "ProductionEvent"("accountingRecordId", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionEvent_id_farmId_tenantId_key" ON "ProductionEvent"("id", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PoultryBatch_id_farmId_tenantId_key" ON "PoultryBatch"("id", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_batchId_kind_key" ON "InventoryItem"("batchId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_openingBatchId_key" ON "StockMovement"("openingBatchId");

-- CreateIndex
CREATE INDEX "StockMovement_productionEventId_farmId_tenantId_idx" ON "StockMovement"("productionEventId", "farmId", "tenantId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_batchId_farmId_tenantId_fkey" FOREIGN KEY ("batchId", "farmId", "tenantId") REFERENCES "PoultryBatch"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productionEventId_farmId_tenantId_fkey" FOREIGN KEY ("productionEventId", "farmId", "tenantId") REFERENCES "ProductionEvent"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_openingBatchId_farmId_tenantId_fkey" FOREIGN KEY ("openingBatchId", "farmId", "tenantId") REFERENCES "PoultryBatch"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_batchId_farmId_tenantId_fkey" FOREIGN KEY ("batchId", "farmId", "tenantId") REFERENCES "PoultryBatch"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_locationId_farmId_tenantId_fkey" FOREIGN KEY ("locationId", "farmId", "tenantId") REFERENCES "StorageLocation"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_accountingRecordId_farmId_tenantId_fkey" FOREIGN KEY ("accountingRecordId", "farmId", "tenantId") REFERENCES "AccountingRecord"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_kind_check";
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_kind_check" CHECK (version = 1 AND ((kind='CROP' AND unit='KG' AND "cropCycleId" IS NOT NULL AND "batchId" IS NULL) OR (kind IN ('BIRD','EGG') AND unit=kind AND "batchId" IS NOT NULL AND "cropCycleId" IS NULL)));
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_reason_check";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reason_check" CHECK ((reason IN ('HARVEST','OPENING','PURCHASE','EGGS') AND "quantityDelta">0) OR (reason IN ('LOSS','MORTALITY','BIRD_SALE') AND "quantityDelta"<0));
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_source_check" CHECK (num_nonnulls("harvestId","productionEventId","openingBatchId")=1);
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_quantity_check" CHECK (quantity>0 AND version=1 AND ((type IN ('PURCHASE','MORTALITY','BIRD_SALE') AND unit='BIRD' AND quantity=trunc(quantity)) OR (type='EGGS' AND unit='EGG' AND quantity=trunc(quantity)) OR (type='FEED' AND unit='KG') OR (type='MEDICATION' AND length(btrim(unit)) BETWEEN 1 AND 20 AND unit NOT IN ('BIRD','EGG'))));
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_sale_check" CHECK ((type='BIRD_SALE')=("accountingRecordId" IS NOT NULL));
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_date_check" CHECK ("occurredOn" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');
ALTER TABLE "ProductionEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ProductionEvent" FROM PUBLIC;
COMMIT;
