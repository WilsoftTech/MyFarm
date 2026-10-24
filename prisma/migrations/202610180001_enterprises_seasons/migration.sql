-- Additive Phase3 T001 foundation; no existing row or applied migration is rewritten.
BEGIN;

-- CreateEnum
CREATE TYPE "EnterpriseType" AS ENUM ('CROP', 'POULTRY', 'DAIRY', 'LIVESTOCK', 'FISH', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "Enterprise" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "type" "EnterpriseType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enterprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "ProductionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enterprise_tenantId_farmId_createdAt_id_idx" ON "Enterprise"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Enterprise_farmId_tenantId_idx" ON "Enterprise"("farmId", "tenantId");

-- CreateIndex
CREATE INDEX "Enterprise_createdBy_idx" ON "Enterprise"("createdBy");

-- CreateIndex
CREATE INDEX "Season_tenantId_farmId_createdAt_id_idx" ON "Season"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Season_farmId_tenantId_idx" ON "Season"("farmId", "tenantId");

-- CreateIndex
CREATE INDEX "Season_createdBy_idx" ON "Season"("createdBy");

-- AddForeignKey
ALTER TABLE "Enterprise" ADD CONSTRAINT "Enterprise_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enterprise" ADD CONSTRAINT "Enterprise_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints and fail-closed access before any future runtime grant is installed.
ALTER TABLE "Enterprise" ADD CONSTRAINT "Enterprise_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 120);
ALTER TABLE "Enterprise" ADD CONSTRAINT "Enterprise_version_check" CHECK ("version" >= 1);
ALTER TABLE "Season" ADD CONSTRAINT "Season_label_check" CHECK (length(btrim("label")) BETWEEN 1 AND 120);
ALTER TABLE "Season" ADD CONSTRAINT "Season_version_check" CHECK ("version" >= 1);
ALTER TABLE "Season" ADD CONSTRAINT "Season_startDate_check" CHECK ("startDate" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');
ALTER TABLE "Season" ADD CONSTRAINT "Season_endDate_check" CHECK ("endDate" IS NULL OR ("endDate" BETWEEN "startDate" AND DATE '9999-12-31'));

-- No browser or shared runtime policy yet. Provider lockdown remains last in provisioning.json.
-- Existing default grants cannot bypass these tables' deny-all RLS.
REVOKE ALL ON TABLE "Enterprise", "Season" FROM PUBLIC;
ALTER TABLE "Enterprise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Season" ENABLE ROW LEVEL SECURITY;

COMMIT;
