-- Additive T008 poultry batch persistence and approved animal-type reference data (D-P03-010).
BEGIN;

-- CreateEnum
CREATE TYPE "PoultryPurpose" AS ENUM ('EGGS', 'MEAT', 'DUAL_PURPOSE', 'BREEDING');

-- CreateTable
CREATE TABLE "AnimalTypeCatalog" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalTypeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoultryBatch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "enterpriseId" UUID NOT NULL,
    "animalTypeId" UUID NOT NULL,
    "animalTypeName" VARCHAR(120) NOT NULL,
    "breed" VARCHAR(120),
    "batchLabel" VARCHAR(120) NOT NULL,
    "batchLabelKey" TEXT NOT NULL,
    "startingQuantity" INTEGER NOT NULL,
    "acquisitionDate" DATE NOT NULL,
    "purpose" "PoultryPurpose" NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoultryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalTypeCatalog_name_key" ON "AnimalTypeCatalog"("name");

-- CreateIndex
CREATE INDEX "AnimalTypeCatalog_active_createdAt_id_idx" ON "AnimalTypeCatalog"("active", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PoultryBatch_tenantId_farmId_createdAt_id_idx" ON "PoultryBatch"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PoultryBatch_enterpriseId_farmId_tenantId_idx" ON "PoultryBatch"("enterpriseId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "PoultryBatch_animalTypeId_idx" ON "PoultryBatch"("animalTypeId");

-- CreateIndex
CREATE INDEX "PoultryBatch_createdBy_idx" ON "PoultryBatch"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PoultryBatch_tenantId_farmId_batchLabelKey_key" ON "PoultryBatch"("tenantId", "farmId", "batchLabelKey");

-- AddForeignKey
ALTER TABLE "PoultryBatch" ADD CONSTRAINT "PoultryBatch_enterpriseId_farmId_tenantId_fkey" FOREIGN KEY ("enterpriseId", "farmId", "tenantId") REFERENCES "Enterprise"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoultryBatch" ADD CONSTRAINT "PoultryBatch_animalTypeId_fkey" FOREIGN KEY ("animalTypeId") REFERENCES "AnimalTypeCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoultryBatch" ADD CONSTRAINT "PoultryBatch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AnimalTypeCatalog" ADD CONSTRAINT "AnimalTypeCatalog_name_check" CHECK (length(btrim(name)) BETWEEN 1 AND 120);
ALTER TABLE "PoultryBatch" ADD CONSTRAINT "PoultryBatch_version_check" CHECK (version >= 1);
ALTER TABLE "PoultryBatch" ADD CONSTRAINT "PoultryBatch_quantity_check" CHECK ("startingQuantity" >= 0);
ALTER TABLE "PoultryBatch" ADD CONSTRAINT "PoultryBatch_name_check" CHECK (length(btrim("animalTypeName")) BETWEEN 1 AND 120);
ALTER TABLE "PoultryBatch" ADD CONSTRAINT "PoultryBatch_breed_check" CHECK (breed IS NULL OR length(btrim(breed)) BETWEEN 1 AND 120);
ALTER TABLE "PoultryBatch" ADD CONSTRAINT "PoultryBatch_label_check" CHECK (length(btrim("batchLabel")) BETWEEN 1 AND 120);
ALTER TABLE "PoultryBatch" ADD CONSTRAINT "PoultryBatch_label_key_check" CHECK (length(btrim("batchLabelKey")) BETWEEN 1 AND 480);
ALTER TABLE "PoultryBatch" ADD CONSTRAINT "PoultryBatch_acquisition_check" CHECK ("acquisitionDate" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');

-- Owner approved Chicken/Duck/Turkey/Guinea fowl on 2026-10-19 (D-P03-010).
-- Descending IDs list Chicken first under the newest-first catalog order.
INSERT INTO "AnimalTypeCatalog" (id, name) VALUES
 ('f4030008-0000-4000-8000-000000000004', 'Chicken'),
 ('f4030008-0000-4000-8000-000000000003', 'Duck'),
 ('f4030008-0000-4000-8000-000000000002', 'Turkey'),
 ('f4030008-0000-4000-8000-000000000001', 'Guinea fowl');

REVOKE ALL ON TABLE "AnimalTypeCatalog", "PoultryBatch" FROM PUBLIC;
ALTER TABLE "AnimalTypeCatalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PoultryBatch" ENABLE ROW LEVEL SECURITY;
-- Runtime grants are installed separately by the reviewed provisioning manifest.
COMMIT;
