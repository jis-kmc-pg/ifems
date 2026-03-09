-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Line" AS ENUM ('BLOCK', 'HEAD', 'CRANK', 'ASSEMBLY');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('PROCESSING', 'COMPRESSOR', 'UTILITY');

-- CreateEnum
CREATE TYPE "TagDataType" AS ENUM ('NUMERIC', 'STRING', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "DataQuality" AS ENUM ('GOOD', 'BAD', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "FacilityStatus" AS ENUM ('NORMAL', 'WARNING', 'DANGER', 'OFFLINE');

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "line" "Line" NOT NULL,
    "process" TEXT,
    "type" "FacilityType" NOT NULL,
    "isProcessing" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "depth" INTEGER NOT NULL,
    "parentId" TEXT,
    "facilityId" TEXT,
    "unit" TEXT,
    "dataType" "TagDataType" NOT NULL,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "samplingRate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_data_raw" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "tagId" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "stringValue" TEXT,
    "booleanValue" BOOLEAN,
    "quality" "DataQuality" NOT NULL DEFAULT 'GOOD',
    "collectorId" TEXT,

    CONSTRAINT "tag_data_raw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "energy_timeseries" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "facilityId" TEXT NOT NULL,
    "powerKwh" DOUBLE PRECISION NOT NULL,
    "powerPeak" DOUBLE PRECISION,
    "voltage" DOUBLE PRECISION,
    "current" DOUBLE PRECISION,
    "imbalance" DOUBLE PRECISION,
    "powerFactor" DOUBLE PRECISION,
    "frequency" DOUBLE PRECISION,
    "airL" DOUBLE PRECISION,
    "airPressure" DOUBLE PRECISION,
    "airFlow" DOUBLE PRECISION,
    "status" "FacilityStatus" NOT NULL DEFAULT 'NORMAL',

    CONSTRAINT "energy_timeseries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facilities_code_key" ON "facilities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tags_code_key" ON "tags"("code");

-- CreateIndex
CREATE INDEX "tags_facilityId_isActive_idx" ON "tags"("facilityId", "isActive");

-- CreateIndex
CREATE INDEX "tags_parentId_depth_idx" ON "tags"("parentId", "depth");

-- CreateIndex
CREATE INDEX "tag_data_raw_timestamp_tagId_idx" ON "tag_data_raw"("timestamp", "tagId");

-- CreateIndex
CREATE INDEX "energy_timeseries_timestamp_facilityId_idx" ON "energy_timeseries"("timestamp", "facilityId");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_data_raw" ADD CONSTRAINT "tag_data_raw_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "energy_timeseries" ADD CONSTRAINT "energy_timeseries_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

