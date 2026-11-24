-- CreateTable
CREATE TABLE "CooperativeMember" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "invitedBy" UUID NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CooperativeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperativeShare" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "grantedBy" UUID NOT NULL,
    "shareLocation" BOOLEAN NOT NULL,
    "shareProduction" BOOLEAN NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CooperativeShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperativeForecast" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "shareId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "product" VARCHAR(120) NOT NULL,
    "unit" VARCHAR(8) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "harvestFrom" DATE NOT NULL,
    "harvestTo" DATE NOT NULL,
    "cancelledAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CooperativeForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperativeLot" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "shareId" UUID NOT NULL,
    "harvestId" UUID,
    "createdBy" UUID NOT NULL,
    "product" VARCHAR(120) NOT NULL,
    "unit" VARCHAR(8) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(20,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "total" DECIMAL(20,4) NOT NULL,
    "grade" VARCHAR(80) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CooperativeLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperativeEntry" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "location" VARCHAR(120) NOT NULL,
    "quantityDelta" DECIMAL(18,6) NOT NULL,
    "amountDelta" DECIMAL(20,4) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "reversalOfId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CooperativeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperativeReceipt" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "targetId" UUID NOT NULL,
    "targetVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CooperativeReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CooperativeMember_userId_status_id_idx" ON "CooperativeMember"("userId", "status", "id");

-- CreateIndex
CREATE INDEX "CooperativeMember_organizationId_id_idx" ON "CooperativeMember"("organizationId", "id");

-- CreateIndex
CREATE INDEX "CooperativeMember_invitedBy_idx" ON "CooperativeMember"("invitedBy");

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeMember_organizationId_userId_key" ON "CooperativeMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "CooperativeShare_organizationId_id_idx" ON "CooperativeShare"("organizationId", "id");

-- CreateIndex
CREATE INDEX "CooperativeShare_farmId_tenantId_idx" ON "CooperativeShare"("farmId", "tenantId");

-- CreateIndex
CREATE INDEX "CooperativeShare_grantedBy_idx" ON "CooperativeShare"("grantedBy");

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeShare_id_organizationId_key" ON "CooperativeShare"("id", "organizationId");

-- CreateIndex
CREATE INDEX "CooperativeForecast_organizationId_id_idx" ON "CooperativeForecast"("organizationId", "id");

-- CreateIndex
CREATE INDEX "CooperativeForecast_shareId_organizationId_idx" ON "CooperativeForecast"("shareId", "organizationId");

-- CreateIndex
CREATE INDEX "CooperativeForecast_createdBy_idx" ON "CooperativeForecast"("createdBy");

-- CreateIndex
CREATE INDEX "CooperativeLot_organizationId_id_idx" ON "CooperativeLot"("organizationId", "id");

-- CreateIndex
CREATE INDEX "CooperativeLot_shareId_organizationId_idx" ON "CooperativeLot"("shareId", "organizationId");

-- CreateIndex
CREATE INDEX "CooperativeLot_harvestId_idx" ON "CooperativeLot"("harvestId");

-- CreateIndex
CREATE INDEX "CooperativeLot_createdBy_idx" ON "CooperativeLot"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeLot_id_organizationId_key" ON "CooperativeLot"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeEntry_reversalOfId_key" ON "CooperativeEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "CooperativeEntry_organizationId_id_idx" ON "CooperativeEntry"("organizationId", "id");

-- CreateIndex
CREATE INDEX "CooperativeEntry_operationId_organizationId_idx" ON "CooperativeEntry"("operationId", "organizationId");

-- CreateIndex
CREATE INDEX "CooperativeEntry_lotId_organizationId_idx" ON "CooperativeEntry"("lotId", "organizationId");

-- CreateIndex
CREATE INDEX "CooperativeEntry_createdBy_idx" ON "CooperativeEntry"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeEntry_id_lotId_organizationId_key" ON "CooperativeEntry"("id", "lotId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeEntry_id_organizationId_key" ON "CooperativeEntry"("id", "organizationId");

-- CreateIndex
CREATE INDEX "CooperativeReceipt_actorId_idx" ON "CooperativeReceipt"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeReceipt_organizationId_requestId_key" ON "CooperativeReceipt"("organizationId", "requestId");

-- AddForeignKey
ALTER TABLE "CooperativeMember" ADD CONSTRAINT "CooperativeMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeMember" ADD CONSTRAINT "CooperativeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeMember" ADD CONSTRAINT "CooperativeMember_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeShare" ADD CONSTRAINT "CooperativeShare_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeShare" ADD CONSTRAINT "CooperativeShare_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeShare" ADD CONSTRAINT "CooperativeShare_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeForecast" ADD CONSTRAINT "CooperativeForecast_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeForecast" ADD CONSTRAINT "CooperativeForecast_shareId_organizationId_fkey" FOREIGN KEY ("shareId", "organizationId") REFERENCES "CooperativeShare"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeForecast" ADD CONSTRAINT "CooperativeForecast_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeLot" ADD CONSTRAINT "CooperativeLot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeLot" ADD CONSTRAINT "CooperativeLot_shareId_organizationId_fkey" FOREIGN KEY ("shareId", "organizationId") REFERENCES "CooperativeShare"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeLot" ADD CONSTRAINT "CooperativeLot_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeLot" ADD CONSTRAINT "CooperativeLot_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeEntry" ADD CONSTRAINT "CooperativeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeEntry" ADD CONSTRAINT "CooperativeEntry_lotId_organizationId_fkey" FOREIGN KEY ("lotId", "organizationId") REFERENCES "CooperativeLot"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeEntry" ADD CONSTRAINT "CooperativeEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeEntry" ADD CONSTRAINT "CooperativeEntry_reversalOfId_lotId_organizationId_fkey" FOREIGN KEY ("reversalOfId", "lotId", "organizationId") REFERENCES "CooperativeEntry"("id", "lotId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeReceipt" ADD CONSTRAINT "CooperativeReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeReceipt" ADD CONSTRAINT "CooperativeReceipt_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CooperativeMember" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CooperativeShare" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CooperativeForecast" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CooperativeLot" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CooperativeEntry" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CooperativeReceipt" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CooperativeMember" ADD CONSTRAINT "CooperativeMember_values" CHECK (version>0 AND role IN ('MANAGER','FARMER','AGENT','BUYER') AND status IN ('INVITED','ACTIVE','REVOKED'));
ALTER TABLE "CooperativeShare" ADD CONSTRAINT "CooperativeShare_values" CHECK (version>0);
CREATE UNIQUE INDEX "CooperativeShare_current_farm" ON "CooperativeShare"("organizationId","farmId") WHERE "revokedAt" IS NULL;
ALTER TABLE "CooperativeForecast" ADD CONSTRAINT "CooperativeForecast_values" CHECK (version>0 AND quantity>0 AND "harvestFrom"<="harvestTo" AND unit IN ('KG','EGG','BIRD') AND (unit='KG' OR quantity=trunc(quantity)));
ALTER TABLE "CooperativeLot" ADD CONSTRAINT "CooperativeLot_values" CHECK (version>0 AND quantity>0 AND "unitPrice">0 AND total>0 AND total=round(quantity*"unitPrice",4) AND currency ~ '^[A-Z]{3}$' AND unit IN ('KG','EGG','BIRD') AND (unit='KG' OR quantity=trunc(quantity)));
ALTER TABLE "CooperativeEntry" ADD CONSTRAINT "CooperativeEntry_values" CHECK ((kind='STOCK' AND "quantityDelta"<>0 AND "amountDelta"=0 AND length(location)>0) OR (kind='PAYMENT' AND "quantityDelta"=0 AND "amountDelta"<>0 AND location=''));
ALTER TABLE "CooperativeReceipt" ADD CONSTRAINT "CooperativeReceipt_values" CHECK ("targetVersion">0 AND "requestHash" ~ '^[0-9a-f]{64}$');
