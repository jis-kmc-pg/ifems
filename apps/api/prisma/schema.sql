-- i-FEMS Database Schema (Generated from Prisma)

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enums
CREATE TYPE "Line" AS ENUM ('BLOCK', 'HEAD', 'CRANK', 'ASSEMBLY');
CREATE TYPE "FacilityType" AS ENUM ('PROCESSING', 'COMPRESSOR', 'UTILITY');
CREATE TYPE "TagDataType" AS ENUM ('NUMERIC', 'STRING', 'BOOLEAN');
CREATE TYPE "DataQuality" AS ENUM ('GOOD', 'BAD', 'UNCERTAIN');
CREATE TYPE "FacilityStatus" AS ENUM ('NORMAL', 'WARNING', 'DANGER', 'OFFLINE');

-- Facilities Table
CREATE TABLE "facilities" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "code" TEXT UNIQUE NOT NULL,
    "name" TEXT NOT NULL,
    "line" "Line" NOT NULL,
    "process" TEXT,
    "type" "FacilityType" NOT NULL,
    "isProcessing" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tags Table
CREATE TABLE "tags" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "code" TEXT UNIQUE NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "depth" INTEGER NOT NULL,
    "parentId" TEXT REFERENCES "tags"("id"),
    "facilityId" TEXT REFERENCES "facilities"("id"),
    "unit" TEXT,
    "dataType" "TagDataType" NOT NULL,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "samplingRate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tag Data Raw (Hypertable)
CREATE TABLE "tag_data_raw" (
    "id" TEXT DEFAULT gen_random_uuid()::TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "tagId" TEXT NOT NULL REFERENCES "tags"("id"),
    "numericValue" DOUBLE PRECISION,
    "stringValue" TEXT,
    "booleanValue" BOOLEAN,
    "quality" "DataQuality" NOT NULL DEFAULT 'GOOD',
    "collectorId" TEXT,
    PRIMARY KEY ("timestamp", "id")
);

-- Energy Timeseries (Hypertable)
CREATE TABLE "energy_timeseries" (
    "id" TEXT DEFAULT gen_random_uuid()::TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "facilityId" TEXT NOT NULL REFERENCES "facilities"("id"),
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
    PRIMARY KEY ("timestamp", "id")
);

-- Indexes
CREATE INDEX "tags_facilityId_isActive_idx" ON "tags"("facilityId", "isActive");
CREATE INDEX "tags_parentId_depth_idx" ON "tags"("parentId", "depth");
CREATE INDEX "tag_data_raw_timestamp_tagId_idx" ON "tag_data_raw"("timestamp", "tagId");
CREATE INDEX "energy_timeseries_timestamp_facilityId_idx" ON "energy_timeseries"("timestamp", "facilityId");

-- Convert to Hypertables
SELECT create_hypertable('tag_data_raw', 'timestamp', chunk_time_interval => INTERVAL '7 days');
SELECT create_hypertable('energy_timeseries', 'timestamp', chunk_time_interval => INTERVAL '7 days');

-- Compression Policy (7일 후 압축)
SELECT add_compression_policy('tag_data_raw', INTERVAL '7 days');
SELECT add_compression_policy('energy_timeseries', INTERVAL '7 days');

-- Retention Policy (tag_data_raw: 90일, energy_timeseries: 5년)
SELECT add_retention_policy('tag_data_raw', INTERVAL '90 days');
SELECT add_retention_policy('energy_timeseries', INTERVAL '5 years');
