BEGIN;
-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "ProductionActivity" ADD COLUMN     "recurrenceId" UUID;

-- CreateTable
CREATE TABLE "ActivityRecurrence" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL,
    "startOn" DATE NOT NULL,
    "endOn" DATE,
    "stoppedFrom" DATE,
    "expandedThrough" DATE,
    "enterpriseId" UUID,
    "plotId" UUID,
    "workerName" VARCHAR(120),
    "notes" VARCHAR(1000),
    "previousId" UUID,
    "requestHash" VARCHAR(64) NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ActivityRecurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRecurrence_previousId_key" ON "ActivityRecurrence"("previousId");

-- CreateIndex
CREATE INDEX "ActivityRecurrence_tenantId_farmId_createdAt_id_idx" ON "ActivityRecurrence"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ActivityRecurrence_tenantId_farmId_stoppedFrom_expandedThro_idx" ON "ActivityRecurrence"("tenantId", "farmId", "stoppedFrom", "expandedThrough");

-- CreateIndex
CREATE INDEX "ActivityRecurrence_farmId_tenantId_idx" ON "ActivityRecurrence"("farmId", "tenantId");

-- CreateIndex
CREATE INDEX "ActivityRecurrence_enterpriseId_idx" ON "ActivityRecurrence"("enterpriseId");

-- CreateIndex
CREATE INDEX "ActivityRecurrence_plotId_idx" ON "ActivityRecurrence"("plotId");

-- CreateIndex
CREATE INDEX "ActivityRecurrence_createdBy_idx" ON "ActivityRecurrence"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRecurrence_id_farmId_tenantId_key" ON "ActivityRecurrence"("id", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionActivity_recurrenceId_dueOn_key" ON "ProductionActivity"("recurrenceId", "dueOn");

-- AddForeignKey
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "ActivityRecurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecurrence" ADD CONSTRAINT "ActivityRecurrence_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecurrence" ADD CONSTRAINT "ActivityRecurrence_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecurrence" ADD CONSTRAINT "ActivityRecurrence_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecurrence" ADD CONSTRAINT "ActivityRecurrence_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecurrence" ADD CONSTRAINT "ActivityRecurrence_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "ActivityRecurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActivityRecurrence" ADD CONSTRAINT "ActivityRecurrence_interval_check" CHECK ("interval" BETWEEN 1 AND 365);
ALTER TABLE "ActivityRecurrence" ADD CONSTRAINT "ActivityRecurrence_version_check" CHECK (version >= 1);
ALTER TABLE "ActivityRecurrence" ADD CONSTRAINT "ActivityRecurrence_end_check" CHECK ("endOn" IS NULL OR "endOn" >= "startOn");
ALTER TABLE "ActivityRecurrence" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ActivityRecurrence" FROM PUBLIC;
COMMIT;