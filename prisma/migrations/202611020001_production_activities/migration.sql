BEGIN;
-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('PLANTING', 'IRRIGATION', 'WEEDING', 'SPRAYING', 'FERTILIZING', 'VACCINATION', 'FEEDING', 'HARVESTING', 'PRUNING', 'MILKING', 'CLEANING', 'INSPECTION');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ProductionActivity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "dueOn" DATE NOT NULL,
    "enterpriseId" UUID,
    "plotId" UUID,
    "status" "ActivityStatus" NOT NULL DEFAULT 'SCHEDULED',
    "requestHash" VARCHAR(64) NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProductionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionActivity_tenantId_farmId_status_dueOn_id_idx" ON "ProductionActivity"("tenantId", "farmId", "status", "dueOn", "id");

-- CreateIndex
CREATE INDEX "ProductionActivity_tenantId_farmId_createdAt_id_idx" ON "ProductionActivity"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ProductionActivity_farmId_tenantId_idx" ON "ProductionActivity"("farmId", "tenantId");

-- CreateIndex
CREATE INDEX "ProductionActivity_enterpriseId_idx" ON "ProductionActivity"("enterpriseId");

-- CreateIndex
CREATE INDEX "ProductionActivity_plotId_idx" ON "ProductionActivity"("plotId");

-- CreateIndex
CREATE INDEX "ProductionActivity_createdBy_idx" ON "ProductionActivity"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionActivity_id_farmId_tenantId_key" ON "ProductionActivity"("id", "farmId", "tenantId");

-- AddForeignKey
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_version_check" CHECK (version >= 1);
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_date_check" CHECK ("dueOn" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');
ALTER TABLE "ProductionActivity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ProductionActivity" FROM PUBLIC;
COMMIT;