-- CreateTable
CREATE TABLE "OfficerAssignment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "farmerId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "grantedByOwnerId" UUID NOT NULL,
    "permissions" TEXT[],
    "validFrom" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficerVisit" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "scheduledOn" DATE NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "observations" VARCHAR(2000) NOT NULL,
    "recommendation" VARCHAR(2000) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficerVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficerFollowUp" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "visitId" UUID NOT NULL,
    "dueOn" DATE NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "notes" VARCHAR(1000) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficerFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficerProblem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "visitId" UUID NOT NULL,
    "explicitlyFlagged" BOOLEAN NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(1000) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficerProblem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfficerAssignment_officerId_farmId_validFrom_id_idx" ON "OfficerAssignment"("officerId", "farmId", "validFrom", "id");

-- CreateIndex
CREATE INDEX "OfficerAssignment_tenantId_farmId_createdAt_id_idx" ON "OfficerAssignment"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "OfficerAssignment_grantedByOwnerId_idx" ON "OfficerAssignment"("grantedByOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficerAssignment_id_farmId_tenantId_officerId_key" ON "OfficerAssignment"("id", "farmId", "tenantId", "officerId");

-- CreateIndex
CREATE INDEX "OfficerVisit_assignmentId_farmId_tenantId_officerId_idx" ON "OfficerVisit"("assignmentId", "farmId", "tenantId", "officerId");

-- CreateIndex
CREATE INDEX "OfficerVisit_officerId_scheduledOn_id_idx" ON "OfficerVisit"("officerId", "scheduledOn", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OfficerVisit_id_farmId_tenantId_officerId_key" ON "OfficerVisit"("id", "farmId", "tenantId", "officerId");

-- CreateIndex
CREATE INDEX "OfficerFollowUp_visitId_farmId_tenantId_officerId_idx" ON "OfficerFollowUp"("visitId", "farmId", "tenantId", "officerId");

-- CreateIndex
CREATE INDEX "OfficerFollowUp_officerId_status_dueOn_id_idx" ON "OfficerFollowUp"("officerId", "status", "dueOn", "id");

-- CreateIndex
CREATE INDEX "OfficerProblem_visitId_farmId_tenantId_officerId_idx" ON "OfficerProblem"("visitId", "farmId", "tenantId", "officerId");

-- CreateIndex
CREATE INDEX "OfficerProblem_officerId_resolved_id_idx" ON "OfficerProblem"("officerId", "resolved", "id");

-- AddForeignKey
ALTER TABLE "OfficerAssignment" ADD CONSTRAINT "OfficerAssignment_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerAssignment" ADD CONSTRAINT "OfficerAssignment_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerAssignment" ADD CONSTRAINT "OfficerAssignment_grantedByOwnerId_fkey" FOREIGN KEY ("grantedByOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerVisit" ADD CONSTRAINT "OfficerVisit_assignmentId_farmId_tenantId_officerId_fkey" FOREIGN KEY ("assignmentId", "farmId", "tenantId", "officerId") REFERENCES "OfficerAssignment"("id", "farmId", "tenantId", "officerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerFollowUp" ADD CONSTRAINT "OfficerFollowUp_visitId_farmId_tenantId_officerId_fkey" FOREIGN KEY ("visitId", "farmId", "tenantId", "officerId") REFERENCES "OfficerVisit"("id", "farmId", "tenantId", "officerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerProblem" ADD CONSTRAINT "OfficerProblem_visitId_farmId_tenantId_officerId_fkey" FOREIGN KEY ("visitId", "farmId", "tenantId", "officerId") REFERENCES "OfficerVisit"("id", "farmId", "tenantId", "officerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense in depth before provider provisioning: new public tables are browser-inaccessible.
ALTER TABLE "OfficerAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficerVisit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficerFollowUp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficerProblem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficerAssignment" ADD CONSTRAINT "OfficerAssignment_permissions_check" CHECK (
  permissions IS NOT NULL AND cardinality(permissions) BETWEEN 1 AND 3
  AND permissions <@ ARRAY['DASHBOARD','VISITS','FOLLOW_UPS']::text[] AND 'DASHBOARD'=ANY(permissions)
  AND array_position(permissions,NULL) IS NULL);
ALTER TABLE "OfficerAssignment" ADD CONSTRAINT "OfficerAssignment_validity_check" CHECK (version>0 AND ("expiresAt" IS NULL OR "expiresAt">"validFrom"));
CREATE UNIQUE INDEX "OfficerAssignment_current_officer_farm" ON "OfficerAssignment"("farmId","officerId") WHERE "revokedAt" IS NULL;
ALTER TABLE "OfficerVisit" ADD CONSTRAINT "OfficerVisit_values_check" CHECK (version>0 AND status IN ('PLANNED','COMPLETED','CANCELLED') AND ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)));
ALTER TABLE "OfficerFollowUp" ADD CONSTRAINT "OfficerFollowUp_values_check" CHECK (version>0 AND status IN ('OPEN','COMPLETED','CANCELLED'));
ALTER TABLE "OfficerProblem" ADD CONSTRAINT "OfficerProblem_version_check" CHECK (version>0);
