-- CreateTable
CREATE TABLE "OfficerRegistrationDraft" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "review" JSONB NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP + '7 days'::interval),
    "farmId" UUID,
    "tenantId" UUID,
    "acceptedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficerRegistrationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficerVisitPhoto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "visitId" UUID NOT NULL,
    "contentType" VARCHAR(40) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploadedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficerVisitPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficerRegistrationDraft_farmId_key" ON "OfficerRegistrationDraft"("farmId");

-- CreateIndex
CREATE INDEX "OfficerRegistrationDraft_organizationId_officerId_createdAt_idx" ON "OfficerRegistrationDraft"("organizationId", "officerId", "createdAt");

-- CreateIndex
CREATE INDEX "OfficerRegistrationDraft_targetUserId_createdAt_idx" ON "OfficerRegistrationDraft"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "OfficerRegistrationDraft_farmId_tenantId_idx" ON "OfficerRegistrationDraft"("farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficerRegistrationDraft_farmId_tenantId_key" ON "OfficerRegistrationDraft"("farmId", "tenantId");

-- CreateIndex
CREATE INDEX "OfficerVisitPhoto_visitId_farmId_tenantId_officerId_idx" ON "OfficerVisitPhoto"("visitId", "farmId", "tenantId", "officerId");

-- CreateIndex
CREATE INDEX "OfficerVisitPhoto_tenantId_farmId_createdAt_idx" ON "OfficerVisitPhoto"("tenantId", "farmId", "createdAt");

-- AddForeignKey
ALTER TABLE "OfficerRegistrationDraft" ADD CONSTRAINT "OfficerRegistrationDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerRegistrationDraft" ADD CONSTRAINT "OfficerRegistrationDraft_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerRegistrationDraft" ADD CONSTRAINT "OfficerRegistrationDraft_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerRegistrationDraft" ADD CONSTRAINT "OfficerRegistrationDraft_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerVisitPhoto" ADD CONSTRAINT "OfficerVisitPhoto_visitId_farmId_tenantId_officerId_fkey" FOREIGN KEY ("visitId", "farmId", "tenantId", "officerId") REFERENCES "OfficerVisit"("id", "farmId", "tenantId", "officerId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OfficerRegistrationDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficerVisitPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficerRegistrationDraft" ADD CONSTRAINT "registration_receipt_shape" CHECK (
 "payloadHash" ~ '^[a-f0-9]{64}$' AND "expiresAt">"createdAt" AND
 ((version=1 AND "farmId" IS NULL AND "tenantId" IS NULL AND "acceptedAt" IS NULL AND jsonb_typeof(review)='object')
 OR (version=2 AND "farmId" IS NOT NULL AND "tenantId" IS NOT NULL AND "acceptedAt" IS NOT NULL AND review='null'::jsonb))
);
ALTER TABLE "OfficerVisitPhoto" ADD CONSTRAINT "officer_photo_bounds" CHECK (
 "contentType" IN ('image/png','image/jpeg','image/webp') AND "byteSize">0 AND "byteSize"<=2097152 AND sha256 ~ '^[a-f0-9]{64}$'
);
