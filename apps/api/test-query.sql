-- 현재 시간 확인
SELECT NOW() as current_time;

-- TagDataRaw 테이블에 데이터가 있는지 확인
SELECT COUNT(*) as total_records FROM tag_data_raw;

-- 오늘(2026-02-27) 데이터 개수 확인
SELECT COUNT(*) as today_records 
FROM tag_data_raw 
WHERE timestamp >= '2026-02-27T00:00:00.000Z';

-- 최근 10개 레코드 확인 (시간, 태그, 값)
SELECT 
  t.timestamp, 
  tag.name, 
  tag."energyType", 
  tag."tagType",
  t."numericValue"
FROM tag_data_raw t
JOIN tags tag ON t."tagId" = tag.id
ORDER BY t.timestamp DESC
LIMIT 10;

-- Block 라인의 USAGE 타입 태그 개수
SELECT COUNT(*) as block_usage_tags
FROM tags tag
JOIN facilities f ON tag."facilityId" = f.id
JOIN lines l ON f."lineId" = l.id
WHERE l.code = 'BLOCK' AND tag."tagType" = 'USAGE';
