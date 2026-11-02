BEGIN;
-- AlterTable
ALTER TABLE "ProductionActivity" ADD COLUMN     "cancelReason" VARCHAR(500),
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(6),
ADD COLUMN     "cancelledBy" UUID,
ADD COLUMN     "completedAt" TIMESTAMPTZ(6),
ADD COLUMN     "completedBy" UUID,
ADD COLUMN     "costRecordId" UUID,
ADD COLUMN     "notes" VARCHAR(1000),
ADD COLUMN     "workerName" VARCHAR(120);

-- CreateIndex
CREATE INDEX "ProductionActivity_costRecordId_idx" ON "ProductionActivity"("costRecordId");

-- CreateIndex
CREATE INDEX "ProductionActivity_completedBy_idx" ON "ProductionActivity"("completedBy");

-- CreateIndex
CREATE INDEX "ProductionActivity_cancelledBy_idx" ON "ProductionActivity"("cancelledBy");

-- AddForeignKey
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_costRecordId_fkey" FOREIGN KEY ("costRecordId") REFERENCES "AccountingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionActivity" ADD CONSTRAINT "ProductionActivity_lifecycle_check" CHECK (
  ((status = 'COMPLETED') = ("completedAt" IS NOT NULL AND "completedBy" IS NOT NULL))
  AND ((status = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelledBy" IS NOT NULL))
  AND (("completedAt" IS NULL) = ("completedBy" IS NULL))
  AND (("cancelledAt" IS NULL) = ("cancelledBy" IS NULL))
);
COMMIT;