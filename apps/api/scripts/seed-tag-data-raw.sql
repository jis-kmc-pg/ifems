-- ============================================================
-- i-FEMS tag_data_raw 데모 데이터 시딩 스크립트
-- ============================================================
-- 목적: tag_data_raw에 데이터를 삽입하여 Continuous Aggregate가
--       자동 집계되게 한다 (cagg_usage_1min, cagg_trend_10sec)
--
-- 시간 범위: 48시간 (2일 KST = 어제 + 오늘)
--   UTC: 2026-03-02 15:00:00 ~ 2026-03-04 14:59:59
--   KST: 2026-03-03 00:00:00 ~ 2026-03-04 23:59:59
--
-- 대상 태그:
--   1) CUMULATIVE + ENERGY (510개) → cagg_usage_1min
--   2) INSTANTANEOUS + ENERGY (767개) → cagg_trend_10sec
-- ============================================================

\timing on

-- 0. 기존 tag_data_raw 데이터 삭제
SELECT 'Step 0: 기존 데이터 삭제' as step;
TRUNCATE tag_data_raw;

-- 태그 개수 확인
SELECT 'CUMULATIVE ENERGY 태그 수' as info, COUNT(*) as cnt
FROM tags WHERE "measureType" = 'CUMULATIVE' AND category = 'ENERGY' AND "isActive" = true;

SELECT 'INSTANTANEOUS ENERGY 태그 수' as info, COUNT(*) as cnt
FROM tags WHERE "measureType" = 'INSTANTANEOUS' AND category = 'ENERGY' AND "isActive" = true;

-- ============================================================
-- 1. CUMULATIVE ENERGY 태그 데이터 삽입
--    30초 간격 → 1분 버킷당 2개 데이터 (first != last → raw_usage_diff > 0)
--    값: 단조 증가 (적산값) = base + elapsed_minutes * rate
--    rate 패턴: KST 근무시간(08~18)에 높은 사용량
-- ============================================================
SELECT 'Step 1: CUMULATIVE 태그 데이터 삽입 시작' as step;

INSERT INTO tag_data_raw ("timestamp", "tagId", "numericValue", quality)
SELECT
  gs.ts,
  t.id,
  -- 적산값: base + 경과초 * 초당증가량 * 시간대계수
  -- base: 태그별 고유값 (elec: 10000~19999, air: 5000~9999)
  -- rate: elec=0.005~0.013 /sec (0.3~0.8/min), air=0.002~0.008 /sec (0.1~0.5/min)
  -- 시간대계수: KST 08~18시 = 1.0~1.5, 야간 = 0.3~0.6
  CASE WHEN t."energyType"::text = 'elec' THEN
    (10000 + ABS(hashtext(t.id) % 10000))::float8
    + (EXTRACT(EPOCH FROM gs.ts - '2026-03-02 15:00:00'::timestamp))
      * (0.005 + ABS(hashtext(t.id || '_rate') % 80) / 10000.0)
      * (0.4 + 0.6 * GREATEST(0, sin(
          (EXTRACT(HOUR FROM gs.ts + INTERVAL '9 hours') - 6) * pi() / 12.0
        )))
  ELSE
    (5000 + ABS(hashtext(t.id) % 5000))::float8
    + (EXTRACT(EPOCH FROM gs.ts - '2026-03-02 15:00:00'::timestamp))
      * (0.002 + ABS(hashtext(t.id || '_rate') % 60) / 10000.0)
      * (0.4 + 0.6 * GREATEST(0, sin(
          (EXTRACT(HOUR FROM gs.ts + INTERVAL '9 hours') - 6) * pi() / 12.0
        )))
  END,
  'GOOD'
FROM tags t
CROSS JOIN generate_series(
  '2026-03-02 15:00:00'::timestamp,
  '2026-03-04 14:59:30'::timestamp,
  '30 seconds'::interval
) gs(ts)
WHERE t."measureType" = 'CUMULATIVE'
  AND t.category = 'ENERGY'
  AND t."isActive" = true;

SELECT 'Step 1 완료: CUMULATIVE 삽입 행 수' as step, COUNT(*) as cnt
FROM tag_data_raw r JOIN tags t ON r."tagId" = t.id
WHERE t."measureType" = 'CUMULATIVE';

-- ============================================================
-- 2. INSTANTANEOUS ENERGY 태그 데이터 삽입
--    1분 간격 → cagg_trend_10sec에서는 10초당 1/6 밀도
--    값: 시간대별 패턴 (KST 낮에 높고 밤에 낮음) + 태그별 변동
-- ============================================================
SELECT 'Step 2: INSTANTANEOUS ENERGY 태그 데이터 삽입 시작' as step;

INSERT INTO tag_data_raw ("timestamp", "tagId", "numericValue", quality)
SELECT
  gs.ts,
  t.id,
  CASE WHEN t."energyType"::text = 'elec' THEN
    GREATEST(5.0,
      50.0
      + 60.0 * (0.3 + 0.7 * GREATEST(0, sin(
          (EXTRACT(HOUR FROM gs.ts + INTERVAL '9 hours') - 6) * pi() / 12.0
        )))
      + (ABS(hashtext(t.id) % 30) - 15)::float8
      + (ABS(hashtext(t.id || gs.ts::text) % 20) - 10)::float8
    )
  ELSE
    GREATEST(2.0,
      15.0
      + 35.0 * (0.3 + 0.7 * GREATEST(0, sin(
          (EXTRACT(HOUR FROM gs.ts + INTERVAL '9 hours') - 6) * pi() / 12.0
        )))
      + (ABS(hashtext(t.id) % 15) - 7)::float8
      + (ABS(hashtext(t.id || gs.ts::text) % 10) - 5)::float8
    )
  END,
  'GOOD'
FROM tags t
CROSS JOIN generate_series(
  '2026-03-02 15:00:00'::timestamp,
  '2026-03-04 14:59:00'::timestamp,
  '1 minute'::interval
) gs(ts)
WHERE t."measureType" = 'INSTANTANEOUS'
  AND t.category = 'ENERGY'
  AND t."isActive" = true;

SELECT 'Step 2 완료: INSTANTANEOUS 삽입 행 수' as step, COUNT(*) as cnt
FROM tag_data_raw r JOIN tags t ON r."tagId" = t.id
WHERE t."measureType" = 'INSTANTANEOUS';

-- ============================================================
-- 3. 데이터 삽입 결과 확인
-- ============================================================
SELECT 'Step 3: 전체 결과 확인' as step;

SELECT 'tag_data_raw 총 행 수' as info, COUNT(*) as cnt FROM tag_data_raw;

SELECT
  t."measureType" as measure,
  t."energyType"::text as energy,
  COUNT(*) as rows,
  MIN(r."numericValue")::numeric(12,2) as min_val,
  MAX(r."numericValue")::numeric(12,2) as max_val,
  AVG(r."numericValue")::numeric(12,2) as avg_val
FROM tag_data_raw r
JOIN tags t ON r."tagId" = t.id
GROUP BY t."measureType", t."energyType"
ORDER BY t."measureType", t."energyType";

-- ============================================================
-- 4. Continuous Aggregate 수동 리프레시
-- ============================================================
SELECT 'Step 4: Continuous Aggregate 리프레시 시작' as step;

CALL refresh_continuous_aggregate('cagg_usage_1min', '2026-03-02 15:00:00'::timestamptz, '2026-03-04 15:00:00'::timestamptz);
CALL refresh_continuous_aggregate('cagg_trend_10sec', '2026-03-02 15:00:00'::timestamptz, '2026-03-04 15:00:00'::timestamptz);
CALL refresh_continuous_aggregate('cagg_sensor_10sec', '2026-03-02 15:00:00'::timestamptz, '2026-03-04 15:00:00'::timestamptz);
CALL refresh_continuous_aggregate('energy_usage_1min', '2026-03-02 15:00:00'::timestamptz, '2026-03-04 15:00:00'::timestamptz);

-- ============================================================
-- 5. Continuous Aggregate 결과 확인
-- ============================================================
SELECT 'Step 5: CA 결과 확인' as step;

SELECT 'cagg_usage_1min' as ca, COUNT(*) as rows FROM cagg_usage_1min
UNION ALL
SELECT 'cagg_trend_10sec', COUNT(*) FROM cagg_trend_10sec
UNION ALL
SELECT 'cagg_sensor_10sec', COUNT(*) FROM cagg_sensor_10sec
UNION ALL
SELECT 'energy_usage_1min', COUNT(*) FROM energy_usage_1min;

-- cagg_usage_1min: raw_usage_diff가 양수인지 확인 (핵심!)
SELECT '-- cagg_usage_1min 샘플 (최근 10행) --' as info;
SELECT bucket, "facilityId", energy_type::text,
       first_value::numeric(12,4), last_value::numeric(12,4),
       raw_usage_diff::numeric(12,4), data_count
FROM cagg_usage_1min
ORDER BY bucket DESC
LIMIT 10;

-- raw_usage_diff 통계
SELECT '-- raw_usage_diff 통계 --' as info;
SELECT
  energy_type::text,
  COUNT(*) as total_buckets,
  COUNT(CASE WHEN raw_usage_diff > 0 THEN 1 END) as positive_diff,
  COUNT(CASE WHEN raw_usage_diff = 0 THEN 1 END) as zero_diff,
  COUNT(CASE WHEN raw_usage_diff < 0 THEN 1 END) as negative_diff,
  AVG(raw_usage_diff)::numeric(12,4) as avg_diff,
  MIN(raw_usage_diff)::numeric(12,4) as min_diff,
  MAX(raw_usage_diff)::numeric(12,4) as max_diff
FROM cagg_usage_1min
GROUP BY energy_type;

-- cagg_trend_10sec 샘플
SELECT '-- cagg_trend_10sec 샘플 (최근 10행) --' as info;
SELECT bucket, "facilityId", energy_type::text,
       last_value::numeric(12,2), data_count
FROM cagg_trend_10sec
ORDER BY bucket DESC
LIMIT 10;
