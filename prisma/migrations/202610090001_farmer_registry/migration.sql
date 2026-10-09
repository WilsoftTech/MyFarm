-- CreateEnum
CREATE TYPE "LandOwnership" AS ENUM ('OWNED', 'RENTED', 'FAMILY', 'COMMUNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "FarmActivity" AS ENUM ('CROPS', 'POULTRY', 'OTHER_LIVESTOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "AreaUnit" AS ENUM ('ACRE', 'HECTARE', 'SQUARE_METRE');

-- CreateEnum
CREATE TYPE "FarmMemberRole" AS ENUM ('OWNER');

-- CreateTable
CREATE TABLE "Farmer" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Farmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerProfile" (
    "farmerId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "alternativePhone" VARCHAR(16),
    "district" VARCHAR(80) NOT NULL,
    "subcounty" VARCHAR(80),
    "village" VARCHAR(80),
    "preferredLanguage" VARCHAR(16) NOT NULL,
    "ownershipType" "LandOwnership" NOT NULL,
    "mainActivities" "FarmActivity"[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "FarmerProfile_pkey" PRIMARY KEY ("farmerId")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ownerFarmerId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "district" VARCHAR(80) NOT NULL,
    "subcounty" VARCHAR(80),
    "village" VARCHAR(80),
    "approximateAcreage" DECIMAL(12,4),
    "ownershipType" "LandOwnership" NOT NULL,
    "primaryActivity" "FarmActivity" NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "area" DECIMAL(18,6),
    "areaUnit" "AreaUnit",
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmMember" (
    "farmId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "role" "FarmMemberRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmMember_pkey" PRIMARY KEY ("farmId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_userId_key" ON "Farmer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_tenantId_key" ON "Farmer"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_id_tenantId_key" ON "Farmer"("id", "tenantId");

-- CreateIndex
CREATE INDEX "Farm_tenantId_createdAt_id_idx" ON "Farm"("tenantId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Farm_id_tenantId_key" ON "Farm"("id", "tenantId");

-- CreateIndex
CREATE INDEX "Plot_tenantId_farmId_createdAt_id_idx" ON "Plot"("tenantId", "farmId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Plot_farmId_name_key" ON "Plot"("farmId", "name");

-- CreateIndex
CREATE INDEX "FarmMember_userId_status_idx" ON "FarmMember"("userId", "status");

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerProfile" ADD CONSTRAINT "FarmerProfile_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_ownerFarmerId_tenantId_fkey" FOREIGN KEY ("ownerFarmerId", "tenantId") REFERENCES "Farmer"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMember" ADD CONSTRAINT "FarmMember_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMember" ADD CONSTRAINT "FarmMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain rules repeated as database constraints (defense in depth; services validate first).
ALTER TABLE "FarmerProfile" ALTER COLUMN "mainActivities" SET NOT NULL;
ALTER TABLE "FarmerProfile" ADD CONSTRAINT "FarmerProfile_mainActivities_check" CHECK (cardinality("mainActivities") >= 1);
ALTER TABLE "FarmerProfile" ADD CONSTRAINT "FarmerProfile_alternativePhone_check" CHECK ("alternativePhone" IS NULL OR "alternativePhone" <> "phone");
ALTER TABLE "FarmerProfile" ADD CONSTRAINT "FarmerProfile_version_check" CHECK ("version" >= 1);
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_approximateAcreage_check" CHECK ("approximateAcreage" IS NULL OR "approximateAcreage" >= 0);
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_coordinates_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL));
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_coordinates_range_check" CHECK (("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90) AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180));
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_version_check" CHECK ("version" >= 1);
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_area_check" CHECK ("area" IS NULL OR "area" >= 0);
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_area_pair_check" CHECK (("area" IS NULL) = ("areaUnit" IS NULL));
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_version_check" CHECK ("version" >= 1);

-- Browser Supabase roles have no application-table policy. Server Prisma role owns access.
ALTER TABLE "Farmer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FarmerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Farm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Plot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FarmMember" ENABLE ROW LEVEL SECURITY;
