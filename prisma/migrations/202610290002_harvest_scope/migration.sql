BEGIN;
-- DropForeignKey
ALTER TABLE "Harvest" DROP CONSTRAINT "Harvest_cropCycleId_farmId_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_harvestId_farmId_tenantId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "CropCycle_id_plotId_cropId_farmId_tenantId_key" ON "CropCycle"("id", "plotId", "cropId", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Harvest_id_itemId_storageLocationId_farmId_tenantId_key" ON "Harvest"("id", "itemId", "storageLocationId", "farmId", "tenantId");

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_cropCycleId_plotId_cropId_farmId_tenantId_fkey" FOREIGN KEY ("cropCycleId", "plotId", "cropId", "farmId", "tenantId") REFERENCES "CropCycle"("id", "plotId", "cropId", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_harvestId_itemId_locationId_farmId_tenantId_fkey" FOREIGN KEY ("harvestId", "itemId", "locationId", "farmId", "tenantId") REFERENCES "Harvest"("id", "itemId", "storageLocationId", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
