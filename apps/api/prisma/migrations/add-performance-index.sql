-- Performance Index for Dynamic Resolution API
-- Created: 2026-02-28
-- Purpose: Optimize facility + timestamp range queries

-- Create index on energy_timeseries for faster range queries
CREATE INDEX IF NOT EXISTS idx_energy_facility_time
ON energy_timeseries ("facilityId", timestamp DESC);

-- Verify index creation
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'energy_timeseries'
  AND indexname = 'idx_energy_facility_time';

-- Expected Performance Improvement:
-- Before: Full scan (~500ms for 1-day data)
-- After: Index scan (~50ms for 1-day data)

-- Usage Example:
-- SELECT * FROM energy_timeseries
-- WHERE "facilityId" = '...' AND timestamp >= '...' AND timestamp < '...'
-- ORDER BY timestamp DESC;
