-- Additive T008 poultry-batch persistence. No reference data and no runtime grants.
BEGIN;

-- CreateTable
CREATE TABLE "LivestockBatch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "enterpriseId" UUID NOT NULL,
    "batchName" VARCHAR(120) NOT NULL,
    "animalType" VARCHAR(120) NOT NULL,
    "breed" VARCHAR(120),
    "startingQuantity" INTEGER NOT NULL,
    "acquisitionDate" DATE NOT NULL,
    "purpose" VARCHAR(120) NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LivestockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LivestockBatch_tenantId_farmId_createdAt_id_idx" ON "LivestockBatch"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "LivestockBatch_enterpriseId_farmId_tenantId_idx" ON "LivestockBatch"("enterpriseId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "LivestockBatch_createdBy_idx" ON "LivestockBatch"("createdBy");

-- AddForeignKey
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_enterpriseId_farmId_tenantId_fkey" FOREIGN KEY ("enterpriseId", "farmId", "tenantId") REFERENCES "Enterprise"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_version_check" CHECK (version >= 1);
-- Whole birds (D-P03-003); INTEGER already bounds the maximum.
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_quantity_check" CHECK ("startingQuantity" >= 0);
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_name_check" CHECK (length(btrim("batchName")) BETWEEN 1 AND 120);
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_animal_check" CHECK (length(btrim("animalType")) BETWEEN 1 AND 120);
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_breed_check" CHECK (breed IS NULL OR length(btrim(breed)) BETWEEN 1 AND 120);
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_purpose_check" CHECK (length(btrim(purpose)) BETWEEN 1 AND 120);
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_acquisition_check" CHECK ("acquisitionDate" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');

REVOKE ALL ON TABLE "LivestockBatch" FROM PUBLIC;
ALTER TABLE "LivestockBatch" ENABLE ROW LEVEL SECURITY;
-- Runtime grants are installed separately by the reviewed provisioning manifest.
COMMIT;
