-- Manual Migration: Tag Management System
-- Date: 2026-02-23
-- Purpose: Factory → Line → Facility → Tag 계층 구조 추가

-- ============================================================
-- Step 1: Create Factory table
-- ============================================================
CREATE TABLE IF NOT EXISTS "factories" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "fullName" TEXT,
  "location" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- ============================================================
-- Step 2: Create Line table
-- ============================================================
CREATE TABLE IF NOT EXISTS "lines" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("factoryId") REFERENCES "factories"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "lines_factoryId_idx" ON "lines"("factoryId");

-- ============================================================
-- Step 3: Insert Factory data
-- ============================================================
INSERT INTO "factories" ("id", "code", "name", "fullName", "location", "createdAt", "updatedAt")
VALUES (
  'factory-hw4',
  'hw4',
  '4공장',
  '화성PT4공장',
  '경기도 화성시',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("code") DO NOTHING;

-- ============================================================
-- Step 4: Insert Line data
-- ============================================================
INSERT INTO "lines" ("id", "code", "name", "factoryId", "order", "createdAt", "updatedAt")
VALUES
  ('line-block', 'BLOCK', '블록', 'factory-hw4', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('line-head', 'HEAD', '헤드', 'factory-hw4', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('line-crank', 'CRANK', '크랑크', 'factory-hw4', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('line-assemble', 'ASSEMBLE', '조립', 'factory-hw4', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================
-- Step 5: Add lineId column to facilities (nullable)
-- ============================================================
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "lineId" TEXT;

-- ============================================================
-- Step 6: Update facilities.lineId based on existing line enum
-- ============================================================
UPDATE "facilities"
SET "lineId" = CASE
  WHEN "line" = 'BLOCK' THEN 'line-block'
  WHEN "line" = 'HEAD' THEN 'line-head'
  WHEN "line" = 'CRANK' THEN 'line-crank'
  WHEN "line" = 'ASSEMBLE' THEN 'line-assemble'
END;

-- ============================================================
-- Step 7: Make lineId NOT NULL
-- ============================================================
ALTER TABLE "facilities" ALTER COLUMN "lineId" SET NOT NULL;

-- ============================================================
-- Step 8: Add Foreign Key constraint
-- ============================================================
ALTER TABLE "facilities"
ADD CONSTRAINT "facilities_lineId_fkey"
FOREIGN KEY ("lineId") REFERENCES "lines"("id") ON DELETE CASCADE;

-- ============================================================
-- Step 9: Create index on lineId
-- ============================================================
CREATE INDEX IF NOT EXISTS "facilities_lineId_idx" ON "facilities"("lineId");

-- ============================================================
-- Step 10: Drop old line enum column
-- ============================================================
ALTER TABLE "facilities" DROP COLUMN IF EXISTS "line";

-- ============================================================
-- Step 11: Drop old Line enum type
-- ============================================================
DROP TYPE IF EXISTS "Line";

-- ============================================================
-- Step 12: Create new Tag enums
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "TagType" AS ENUM ('TREND', 'USAGE', 'SENSOR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EnergyType" AS ENUM ('elec', 'air');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- Step 13: Update TagDataType enum
-- ============================================================
-- Drop old enum values if they exist
DO $$ BEGIN
  ALTER TYPE "TagDataType" RENAME TO "TagDataType_old";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TagDataType" AS ENUM ('T', 'Q');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- Step 14: Drop old tags table (if exists) and recreate
-- ============================================================
DROP TABLE IF EXISTS "tags" CASCADE;

CREATE TABLE "tags" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "facilityId" TEXT NOT NULL,
  "tagName" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "tagType" "TagType" NOT NULL,
  "energyType" "EnergyType",
  "dataType" "TagDataType" NOT NULL,
  "unit" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "tags_facilityId_idx" ON "tags"("facilityId");
CREATE INDEX IF NOT EXISTS "tags_tagType_idx" ON "tags"("tagType");
CREATE INDEX IF NOT EXISTS "tags_energyType_idx" ON "tags"("energyType");

-- ============================================================
-- Step 15: Drop old TagDataType enum
-- ============================================================
DROP TYPE IF EXISTS "TagDataType_old";

-- ============================================================
-- Step 16: Drop tag_data_raw table if it references old Tag schema
-- ============================================================
DROP TABLE IF EXISTS "tag_data_raw" CASCADE;

-- Recreate with correct schema
CREATE TABLE "tag_data_raw" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "tagId" TEXT NOT NULL,
  "numericValue" DOUBLE PRECISION,
  "stringValue" TEXT,
  "booleanValue" BOOLEAN,
  "quality" "DataQuality" NOT NULL DEFAULT 'GOOD',
  "collectorId" TEXT,
  FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "tag_data_raw_timestamp_tagId_idx" ON "tag_data_raw"("timestamp", "tagId");

-- ============================================================
-- Complete
-- ============================================================
