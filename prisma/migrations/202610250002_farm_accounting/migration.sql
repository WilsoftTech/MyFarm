-- Additive T002 farm accounting persistence and approved catalogs (D-P04-002/003/005).
BEGIN;

-- CreateEnum
CREATE TYPE "AccountingRecordKind" AS ENUM ('EXPENSE', 'INCOME', 'PURCHASE', 'SALE');

-- CreateEnum
CREATE TYPE "TransactionCategoryKind" AS ENUM ('COST', 'REVENUE');

-- CreateEnum
CREATE TYPE "AccountingStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('RECEIVED', 'MADE');

-- CreateTable
CREATE TABLE "TransactionCategory" (
    "id" UUID NOT NULL,
    "kind" "TransactionCategoryKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "kind" "AccountingRecordKind" NOT NULL,
    "categoryId" UUID NOT NULL,
    "categoryName" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "counterparty" VARCHAR(120),
    "paymentMethodId" UUID,
    "plotId" UUID,
    "enterpriseId" UUID,
    "seasonId" UUID,
    "status" "AccountingStatus" NOT NULL DEFAULT 'POSTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "paidOn" DATE NOT NULL,
    "paymentMethodId" UUID NOT NULL,
    "externalReference" VARCHAR(120),
    "status" "AccountingStatus" NOT NULL DEFAULT 'POSTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "obligationId" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingReversal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "recordId" UUID,
    "paymentId" UUID,
    "reason" VARCHAR(500) NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingReversal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionCategory_kind_active_createdAt_id_idx" ON "TransactionCategory"("kind", "active", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCategory_kind_name_key" ON "TransactionCategory"("kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");

-- CreateIndex
CREATE INDEX "PaymentMethod_active_createdAt_id_idx" ON "PaymentMethod"("active", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AccountingRecord_tenantId_farmId_createdAt_id_idx" ON "AccountingRecord"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AccountingRecord_farmId_tenantId_idx" ON "AccountingRecord"("farmId", "tenantId");

-- CreateIndex
CREATE INDEX "AccountingRecord_categoryId_idx" ON "AccountingRecord"("categoryId");

-- CreateIndex
CREATE INDEX "AccountingRecord_paymentMethodId_idx" ON "AccountingRecord"("paymentMethodId");

-- CreateIndex
CREATE INDEX "AccountingRecord_plotId_idx" ON "AccountingRecord"("plotId");

-- CreateIndex
CREATE INDEX "AccountingRecord_enterpriseId_idx" ON "AccountingRecord"("enterpriseId");

-- CreateIndex
CREATE INDEX "AccountingRecord_seasonId_idx" ON "AccountingRecord"("seasonId");

-- CreateIndex
CREATE INDEX "AccountingRecord_createdBy_idx" ON "AccountingRecord"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingRecord_id_farmId_tenantId_key" ON "AccountingRecord"("id", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "PaymentRecord_tenantId_farmId_createdAt_id_idx" ON "PaymentRecord"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PaymentRecord_farmId_tenantId_idx" ON "PaymentRecord"("farmId", "tenantId");

-- CreateIndex
CREATE INDEX "PaymentRecord_paymentMethodId_idx" ON "PaymentRecord"("paymentMethodId");

-- CreateIndex
CREATE INDEX "PaymentRecord_createdBy_idx" ON "PaymentRecord"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_id_farmId_tenantId_key" ON "PaymentRecord"("id", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_obligationId_farmId_tenantId_idx" ON "PaymentAllocation"("obligationId", "farmId", "tenantId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_farmId_tenantId_idx" ON "PaymentAllocation"("paymentId", "farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_obligationId_key" ON "PaymentAllocation"("paymentId", "obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingReversal_recordId_key" ON "AccountingReversal"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingReversal_paymentId_key" ON "AccountingReversal"("paymentId");

-- CreateIndex
CREATE INDEX "AccountingReversal_tenantId_farmId_createdAt_id_idx" ON "AccountingReversal"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AccountingReversal_createdBy_idx" ON "AccountingReversal"("createdBy");

-- AddForeignKey
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TransactionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_farmId_tenantId_fkey" FOREIGN KEY ("paymentId", "farmId", "tenantId") REFERENCES "PaymentRecord"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_obligationId_farmId_tenantId_fkey" FOREIGN KEY ("obligationId", "farmId", "tenantId") REFERENCES "AccountingRecord"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingReversal" ADD CONSTRAINT "AccountingReversal_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AccountingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingReversal" ADD CONSTRAINT "AccountingReversal_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingReversal" ADD CONSTRAINT "AccountingReversal_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "TransactionCategory" ADD CONSTRAINT "TransactionCategory_name_check" CHECK (length(btrim(name)) BETWEEN 1 AND 120);
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_name_check" CHECK (length(btrim(name)) BETWEEN 1 AND 120);
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_amount_check" CHECK (amount > 0);
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_currency_check" CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_category_name_check" CHECK (length(btrim("categoryName")) BETWEEN 1 AND 120);
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_counterparty_check" CHECK (counterparty IS NULL OR length(btrim(counterparty)) BETWEEN 1 AND 120);
-- Sales and purchases are settled by payments, never by a method on the record itself.
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_payment_method_check" CHECK (kind IN ('EXPENSE', 'INCOME') OR "paymentMethodId" IS NULL);
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_version_check" CHECK (version >= 1);
ALTER TABLE "AccountingRecord" ADD CONSTRAINT "AccountingRecord_date_check" CHECK ("occurredOn" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_amount_check" CHECK (amount > 0);
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_currency_check" CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_reference_check" CHECK ("externalReference" IS NULL OR length(btrim("externalReference")) BETWEEN 1 AND 120);
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_version_check" CHECK (version >= 1);
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_date_check" CHECK ("paidOn" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_check" CHECK (amount > 0);
ALTER TABLE "AccountingReversal" ADD CONSTRAINT "AccountingReversal_target_check" CHECK (num_nonnulls("recordId", "paymentId") = 1);
ALTER TABLE "AccountingReversal" ADD CONSTRAINT "AccountingReversal_reason_check" CHECK (length(btrim(reason)) BETWEEN 1 AND 500);

-- Owner approved on 2026-10-25 (D-P04-005): the 13 source cost categories (P0288-P0300),
-- four revenue categories and three payment methods. Descending IDs list them in this
-- order under the newest-first catalog order.
INSERT INTO "TransactionCategory" (id, kind, name) VALUES
 ('f4040002-0000-4000-8000-000000000113', 'COST', 'Seeds'),
 ('f4040002-0000-4000-8000-000000000112', 'COST', 'Feed'),
 ('f4040002-0000-4000-8000-000000000111', 'COST', 'Fertilizer'),
 ('f4040002-0000-4000-8000-000000000110', 'COST', 'Veterinary'),
 ('f4040002-0000-4000-8000-000000000109', 'COST', 'Labour'),
 ('f4040002-0000-4000-8000-000000000108', 'COST', 'Transport'),
 ('f4040002-0000-4000-8000-000000000107', 'COST', 'Fuel'),
 ('f4040002-0000-4000-8000-000000000106', 'COST', 'Equipment'),
 ('f4040002-0000-4000-8000-000000000105', 'COST', 'Rent'),
 ('f4040002-0000-4000-8000-000000000104', 'COST', 'Utilities'),
 ('f4040002-0000-4000-8000-000000000103', 'COST', 'Medication'),
 ('f4040002-0000-4000-8000-000000000102', 'COST', 'Pesticides'),
 ('f4040002-0000-4000-8000-000000000101', 'COST', 'Packaging'),
 ('f4040002-0000-4000-8000-000000000204', 'REVENUE', 'Crop sales'),
 ('f4040002-0000-4000-8000-000000000203', 'REVENUE', 'Livestock sales'),
 ('f4040002-0000-4000-8000-000000000202', 'REVENUE', 'Egg sales'),
 ('f4040002-0000-4000-8000-000000000201', 'REVENUE', 'Other income');
INSERT INTO "PaymentMethod" (id, name) VALUES
 ('f4040002-0000-4000-8000-000000000303', 'Cash'),
 ('f4040002-0000-4000-8000-000000000302', 'Mobile Money'),
 ('f4040002-0000-4000-8000-000000000301', 'Bank transfer');

REVOKE ALL ON TABLE "TransactionCategory", "PaymentMethod", "AccountingRecord", "PaymentRecord", "PaymentAllocation", "AccountingReversal" FROM PUBLIC;
ALTER TABLE "TransactionCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentMethod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountingRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountingReversal" ENABLE ROW LEVEL SECURITY;
-- Runtime grants are installed separately by the reviewed provisioning manifest.
COMMIT;
