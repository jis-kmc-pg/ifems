-- Fix: Drop CaAgg views, then drop tagType/dataType columns, then recreate views

-- 1. Drop Continuous Aggregate views (tagType dependency)
DROP MATERIALIZED VIEW IF EXISTS energy_usage_1min CASCADE;
DROP MATERIALIZED VIEW IF EXISTS cagg_usage_1min CASCADE;
DROP MATERIALIZED VIEW IF EXISTS cagg_trend_10sec CASCADE;
DROP MATERIALIZED VIEW IF EXISTS cagg_sensor_10sec CASCADE;

-- 2. Drop old columns
ALTER TABLE "tags" DROP COLUMN IF EXISTS "tagType";
ALTER TABLE "tags" DROP COLUMN IF EXISTS "dataType";

-- 3. Drop old enums
DROP TYPE IF EXISTS "TagType" CASCADE;
DROP TYPE IF EXISTS "TagDataType" CASCADE;

-- 4. Recreate Continuous Aggregate views with new measureType/category

CREATE MATERIALIZED VIEW cagg_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', t."timestamp") AS bucket,
  t."tagId",
  tag."facilityId",
  tag."energyType" AS energy_type,
  first(t."numericValue", t."timestamp") AS first_value,
  last(t."numericValue", t."timestamp") AS last_value,
  last(t."numericValue", t."timestamp") - first(t."numericValue", t."timestamp") AS raw_usage_diff,
  count(*) AS data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."measureType" = 'CUMULATIVE'::"MeasureType"
  AND t."numericValue" IS NOT NULL
GROUP BY time_bucket('1 minute', t."timestamp"), t."tagId", tag."facilityId", tag."energyType"
WITH NO DATA;

CREATE MATERIALIZED VIEW cagg_trend_10sec
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('10 seconds', t."timestamp") AS bucket,
  t."tagId",
  tag."facilityId",
  tag."energyType" AS energy_type,
  last(t."numericValue", t."timestamp") AS last_value,
  count(*) AS data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."measureType" = 'INSTANTANEOUS'::"MeasureType"
  AND tag."category" = 'ENERGY'::"TagCategory"
  AND t."numericValue" IS NOT NULL
GROUP BY time_bucket('10 seconds', t."timestamp"), t."tagId", tag."facilityId", tag."energyType"
WITH NO DATA;

CREATE MATERIALIZED VIEW cagg_sensor_10sec
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('10 seconds', t."timestamp") AS bucket,
  t."tagId",
  tag."facilityId",
  tag."displayName" AS sensor_name,
  avg(t."numericValue") AS avg_value,
  min(t."numericValue") AS min_value,
  max(t."numericValue") AS max_value,
  count(*) AS data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."measureType" = 'INSTANTANEOUS'::"MeasureType"
  AND tag."category" = 'ENVIRONMENT'::"TagCategory"
  AND t."numericValue" IS NOT NULL
GROUP BY time_bucket('10 seconds', t."timestamp"), t."tagId", tag."facilityId", tag."displayName"
WITH NO DATA;

CREATE MATERIALIZED VIEW energy_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', t."timestamp") AS bucket,
  l.code AS line_code,
  tag."energyType" AS energy_type,
  t."tagId" AS tag_id,
  max(t."numericValue") - min(t."numericValue") AS usage
FROM tag_data_raw t
JOIN tags tag ON t."tagId" = tag.id
JOIN facilities f ON tag."facilityId" = f.id
JOIN lines l ON f."lineId" = l.id
WHERE tag."measureType" = 'CUMULATIVE'::"MeasureType"
GROUP BY time_bucket('1 minute', t."timestamp"), l.code, tag."energyType", t."tagId"
WITH NO DATA;
