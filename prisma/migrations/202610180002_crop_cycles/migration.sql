-- Additive T005 crop persistence and approved initial reference data.
BEGIN;

-- CreateTable
CREATE TABLE "CropCatalog" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropCycle" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "enterpriseId" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "plotId" UUID NOT NULL,
    "cropId" UUID NOT NULL,
    "cropName" VARCHAR(120) NOT NULL,
    "variety" VARCHAR(120),
    "areaPlanted" DECIMAL(18,6) NOT NULL,
    "areaUnit" "AreaUnit" NOT NULL,
    "plantingDate" DATE NOT NULL,
    "expectedHarvest" DATE,
    "areaExceptionReason" VARCHAR(500),
    "status" "ProductionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CropCatalog_name_key" ON "CropCatalog"("name");

-- CreateIndex
CREATE INDEX "CropCatalog_active_createdAt_id_idx" ON "CropCatalog"("active", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CropCycle_tenantId_farmId_createdAt_id_idx" ON "CropCycle"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CropCycle_plotId_farmId_tenantId_status_idx" ON "CropCycle"("plotId", "farmId", "tenantId", "status");

-- CreateIndex
CREATE INDEX "CropCycle_enterpriseId_farmId_tenantId_idx" ON "CropCycle"("enterpriseId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "CropCycle_seasonId_farmId_tenantId_idx" ON "CropCycle"("seasonId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "CropCycle_cropId_idx" ON "CropCycle"("cropId");

-- CreateIndex
CREATE INDEX "CropCycle_createdBy_idx" ON "CropCycle"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "Plot_id_farmId_tenantId_key" ON "Plot"("id", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Enterprise_id_farmId_tenantId_key" ON "Enterprise"("id", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_id_farmId_tenantId_key" ON "Season"("id", "farmId", "tenantId");

-- AddForeignKey
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_enterpriseId_farmId_tenantId_fkey" FOREIGN KEY ("enterpriseId", "farmId", "tenantId") REFERENCES "Enterprise"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_seasonId_farmId_tenantId_fkey" FOREIGN KEY ("seasonId", "farmId", "tenantId") REFERENCES "Season"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_plotId_farmId_tenantId_fkey" FOREIGN KEY ("plotId", "farmId", "tenantId") REFERENCES "Plot"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "CropCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CropCatalog" ADD CONSTRAINT "CropCatalog_name_check" CHECK (length(btrim(name)) BETWEEN 1 AND 120);
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_version_check" CHECK (version >= 1);
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_area_check" CHECK ("areaPlanted" > 0 AND "areaPlanted" <= 999999999999.999999);
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_name_check" CHECK (length(btrim("cropName")) BETWEEN 1 AND 120);
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_variety_check" CHECK (variety IS NULL OR length(btrim(variety)) BETWEEN 1 AND 120);
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_reason_check" CHECK ("areaExceptionReason" IS NULL OR length(btrim("areaExceptionReason")) BETWEEN 1 AND 500);
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_planting_check" CHECK ("plantingDate" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_harvest_check" CHECK ("expectedHarvest" IS NULL OR "expectedHarvest" BETWEEN "plantingDate" AND DATE '9999-12-31');

-- Owner approved Maize/Coffee from the project examples on 2026-10-18.
INSERT INTO "CropCatalog" (id, name) VALUES
 ('f4030005-0000-4000-8000-000000000001', 'Maize'),
 ('f4030005-0000-4000-8000-000000000002', 'Coffee');

REVOKE ALL ON TABLE "CropCatalog", "CropCycle" FROM PUBLIC;
ALTER TABLE "CropCatalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CropCycle" ENABLE ROW LEVEL SECURITY;
-- Runtime grants are installed separately by the reviewed provisioning manifest.
COMMIT;
