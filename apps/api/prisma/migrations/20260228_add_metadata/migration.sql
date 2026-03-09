-- Add metadata column to facilities table for storing threshold settings
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Create index for better JSONB query performance
CREATE INDEX IF NOT EXISTS "facilities_metadata_idx" ON "facilities" USING GIN ("metadata");
