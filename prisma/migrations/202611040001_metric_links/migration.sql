BEGIN;
-- CreateEnum
CREATE TYPE "CostGroup" AS ENUM ('LABOUR', 'INPUT');

-- AlterTable
ALTER TABLE "AccountingRecord" ADD COLUMN     "batchId" UUID;

-- AlterTable
ALTER TABLE "TransactionCategory" ADD COLUMN     "costGroup" "CostGroup";

-- CreateIndex
CREATE INDEX "AccountingRecord_batchId_farmId_tenantId_idx" ON "AccountingRecord"("batchId", "farmId", "tenantId");

-- AddForeignKey
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_batchId_farmId_tenantId_fkey" FOREIGN KEY ("batchId", "farmId", "tenantId") REFERENCES "PoultryBatch"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A group describes a cost, so a revenue category can never hold one.
ALTER TABLE "TransactionCategory" ADD CONSTRAINT "TransactionCategory_costGroup_is_for_costs" CHECK ("costGroup" IS NULL OR kind = 'COST');

-- D-P08-009: Labour; Seeds, Feed, Fertilizer, Veterinary, Medication, Pesticides. Other cost categories stay in neither group.
UPDATE "TransactionCategory" SET "costGroup" = 'LABOUR' WHERE id = 'f4040002-0000-4000-8000-000000000109';
UPDATE "TransactionCategory" SET "costGroup" = 'INPUT' WHERE id IN (
  'f4040002-0000-4000-8000-000000000113',
  'f4040002-0000-4000-8000-000000000112',
  'f4040002-0000-4000-8000-000000000111',
  'f4040002-0000-4000-8000-000000000110',
  'f4040002-0000-4000-8000-000000000103',
  'f4040002-0000-4000-8000-000000000102'
);
COMMIT;
