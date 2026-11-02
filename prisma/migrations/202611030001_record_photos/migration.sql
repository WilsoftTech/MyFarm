BEGIN;
-- CreateTable
CREATE TABLE "RecordPhoto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "activityId" UUID,
    "accountingRecordId" UUID,
    "contentType" VARCHAR(40) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecordPhoto_tenantId_farmId_activityId_createdAt_idx" ON "RecordPhoto"("tenantId", "farmId", "activityId", "createdAt");

-- CreateIndex
CREATE INDEX "RecordPhoto_tenantId_farmId_accountingRecordId_createdAt_idx" ON "RecordPhoto"("tenantId", "farmId", "accountingRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "RecordPhoto_farmId_tenantId_idx" ON "RecordPhoto"("farmId", "tenantId");

-- CreateIndex
CREATE INDEX "RecordPhoto_activityId_idx" ON "RecordPhoto"("activityId");

-- CreateIndex
CREATE INDEX "RecordPhoto_accountingRecordId_idx" ON "RecordPhoto"("accountingRecordId");

-- CreateIndex
CREATE INDEX "RecordPhoto_createdBy_idx" ON "RecordPhoto"("createdBy");

-- AddForeignKey
ALTER TABLE "RecordPhoto" ADD CONSTRAINT "RecordPhoto_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordPhoto" ADD CONSTRAINT "RecordPhoto_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ProductionActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordPhoto" ADD CONSTRAINT "RecordPhoto_accountingRecordId_fkey" FOREIGN KEY ("accountingRecordId") REFERENCES "AccountingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordPhoto" ADD CONSTRAINT "RecordPhoto_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecordPhoto" ADD CONSTRAINT "RecordPhoto_target_check" CHECK (num_nonnulls("activityId", "accountingRecordId") = 1);
ALTER TABLE "RecordPhoto" ADD CONSTRAINT "RecordPhoto_size_check" CHECK ("byteSize" BETWEEN 1 AND 2097152);
ALTER TABLE "RecordPhoto" ADD CONSTRAINT "RecordPhoto_type_check" CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE "RecordPhoto" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "RecordPhoto" FROM PUBLIC;
COMMIT;