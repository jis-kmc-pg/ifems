-- VQTT Migration: tag_data_raw schema cleanup
-- numericValue -> value, remove stringValue/booleanValue/collectorId, add type enum

-- 1. Create DataSourceType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataSourceType') THEN
    CREATE TYPE "DataSourceType" AS ENUM ('TEST', 'COMMISSIONING', 'REAL');
  END IF;
END
$$;

-- 2. Rename numericValue -> value
ALTER TABLE tag_data_raw RENAME COLUMN "numericValue" TO value;

-- 3. Drop unused columns
ALTER TABLE tag_data_raw DROP COLUMN IF EXISTS "stringValue";
ALTER TABLE tag_data_raw DROP COLUMN IF EXISTS "booleanValue";
ALTER TABLE tag_data_raw DROP COLUMN IF EXISTS "collectorId";

-- 4. Add type column with default TEST
ALTER TABLE tag_data_raw ADD COLUMN IF NOT EXISTS type "DataSourceType" NOT NULL DEFAULT 'TEST';
