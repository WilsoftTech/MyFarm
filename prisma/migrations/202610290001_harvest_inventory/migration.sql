BEGIN;
-- CreateTable
CREATE TABLE "StorageLocation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "cropCycleId" UUID,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Harvest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "cropCycleId" UUID NOT NULL,
    "cropId" UUID NOT NULL,
    "plotId" UUID NOT NULL,
    "storageLocationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "cropName" VARCHAR(120) NOT NULL,
    "storageLocationName" VARCHAR(120) NOT NULL,
    "harvestDate" DATE NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "grade" VARCHAR(120),
    "lossQuantity" DECIMAL(18,6) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Harvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "harvestId" UUID NOT NULL,
    "quantityDelta" DECIMAL(18,6) NOT NULL,
    "reason" VARCHAR(30) NOT NULL,
    "sourceKey" VARCHAR(120) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorageLocation_tenantId_farmId_createdAt_id_idx" ON "StorageLocation"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "StorageLocation_createdBy_idx" ON "StorageLocation"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_id_farmId_tenantId_key" ON "StorageLocation"("id", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_farmId_tenantId_nameKey_key" ON "StorageLocation"("farmId", "tenantId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_cropCycleId_key" ON "InventoryItem"("cropCycleId");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_farmId_createdAt_id_idx" ON "InventoryItem"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "InventoryItem_createdBy_idx" ON "InventoryItem"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_id_farmId_tenantId_key" ON "InventoryItem"("id", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "Harvest_tenantId_farmId_createdAt_id_idx" ON "Harvest"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Harvest_cropCycleId_farmId_tenantId_idx" ON "Harvest"("cropCycleId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "Harvest_storageLocationId_farmId_tenantId_idx" ON "Harvest"("storageLocationId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "Harvest_itemId_farmId_tenantId_idx" ON "Harvest"("itemId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "Harvest_createdBy_idx" ON "Harvest"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "Harvest_id_farmId_tenantId_key" ON "Harvest"("id", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_sourceKey_key" ON "StockMovement"("sourceKey");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_farmId_itemId_locationId_occurredOn__idx" ON "StockMovement"("tenantId", "farmId", "itemId", "locationId", "occurredOn", "id");

-- CreateIndex
CREATE INDEX "StockMovement_locationId_farmId_tenantId_idx" ON "StockMovement"("locationId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "StockMovement_harvestId_farmId_tenantId_idx" ON "StockMovement"("harvestId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "StockMovement_createdBy_idx" ON "StockMovement"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "CropCycle_id_farmId_tenantId_key" ON "CropCycle"("id", "farmId", "tenantId");

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_cropCycleId_farmId_tenantId_fkey" FOREIGN KEY ("cropCycleId", "farmId", "tenantId") REFERENCES "CropCycle"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_cropCycleId_farmId_tenantId_fkey" FOREIGN KEY ("cropCycleId", "farmId", "tenantId") REFERENCES "CropCycle"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_storageLocationId_farmId_tenantId_fkey" FOREIGN KEY ("storageLocationId", "farmId", "tenantId") REFERENCES "StorageLocation"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_itemId_farmId_tenantId_fkey" FOREIGN KEY ("itemId", "farmId", "tenantId") REFERENCES "InventoryItem"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_farmId_tenantId_fkey" FOREIGN KEY ("itemId", "farmId", "tenantId") REFERENCES "InventoryItem"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_farmId_tenantId_fkey" FOREIGN KEY ("locationId", "farmId", "tenantId") REFERENCES "StorageLocation"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_harvestId_farmId_tenantId_fkey" FOREIGN KEY ("harvestId", "farmId", "tenantId") REFERENCES "Harvest"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_name_check" CHECK (length(btrim(name)) BETWEEN 1 AND 120 AND version = 1);
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_kind_check" CHECK (kind = 'CROP' AND unit = 'KG' AND "cropCycleId" IS NOT NULL AND version = 1);
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_quantity_check" CHECK (quantity > 0 AND "lossQuantity" >= 0 AND "lossQuantity" <= quantity AND unit = 'KG' AND version = 1);
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_date_check" CHECK ("harvestDate" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reason_check" CHECK ((reason = 'HARVEST' AND "quantityDelta" > 0) OR (reason = 'LOSS' AND "quantityDelta" < 0));
REVOKE ALL ON TABLE "StorageLocation" FROM PUBLIC;
ALTER TABLE "StorageLocation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InventoryItem" FROM PUBLIC;
ALTER TABLE "InventoryItem" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Harvest" FROM PUBLIC;
ALTER TABLE "Harvest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "StockMovement" FROM PUBLIC;
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
COMMIT;
