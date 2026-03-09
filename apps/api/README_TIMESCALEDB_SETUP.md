# TimescaleDB 초기화 가이드

> i-FEMS Backend API - TimescaleDB Hypertable 설정 및 성능 최적화

## 목차
1. [사전 준비](#사전-준비)
2. [초기화 실행](#초기화-실행)
3. [검증 방법](#검증-방법)
4. [트러블슈팅](#트러블슈팅)

---

## 사전 준비

### 0. Windows에 TimescaleDB 설치 (최초 1회)

1. PostgreSQL 버전 확인: `SELECT version();`
2. [TimescaleDB Releases](https://github.com/timescale/timescaledb/releases)에서 해당 버전 ZIP 다운로드
3. `timescaledb.dll` → `C:\Program Files\PostgreSQL\16\lib\` 복사
4. `postgresql.conf`에 `shared_preload_libraries = 'timescaledb'` 추가
5. PostgreSQL 서비스 재시작: `Restart-Service postgresql-x64-16`
6. Extension 활성화: `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`
7. 확인: `SELECT * FROM pg_extension WHERE extname = 'timescaledb';`

> DLL 로드 실패, 권한 오류 등 상세 트러블슈팅은 [install-timescaledb-guide.md](scripts/install-timescaledb-guide.md) 참조

### 1. PostgreSQL + TimescaleDB 실행 확인

```bash
# Docker Compose로 실행 (이미 실행 중이면 생략)
docker-compose up -d

# 연결 확인
psql -h localhost -U postgres -d ifems -c "SELECT version();"
```

### 2. TimescaleDB Extension 확인

```bash
# Extension 설치 여부 확인
psql -h localhost -U postgres -d ifems -c "SELECT * FROM pg_extension WHERE extname = 'timescaledb';"
```

---

## 초기화 실행

### 방법 1: psql CLI 사용 (권장)

```bash
# i-FEMS/apps/api 디렉토리에서 실행
cd d:/AI_PJ/IFEMS/apps/api

# TimescaleDB 초기화 스크립트 실행
psql -h localhost -U postgres -d ifems -f prisma/timescaledb-init.sql
```

**예상 출력:**
```
CREATE EXTENSION
SELECT 1
SELECT 1
...
NOTICE:  ✅ TimescaleDB 초기화 완료!
NOTICE:  ✅ Hypertables: tag_data_raw, energy_timeseries
NOTICE:  ✅ Continuous Aggregates: energy_15min_agg, energy_1hour_agg, energy_1day_agg
NOTICE:  ✅ Retention Policies: 3개월 (raw), 2년 (timeseries)
NOTICE:  ✅ Compression Policies: 7일 (raw), 30일 (timeseries)
NOTICE:  ✅ Indexes: 14개 성능 최적화 인덱스 생성 완료
```

### 방법 2: Docker Compose 내부에서 실행

```bash
# Docker 컨테이너 접속
docker exec -it ifems-postgres-1 bash

# 컨테이너 내부에서 실행
psql -U postgres -d ifems -f /path/to/timescaledb-init.sql
```

### 방법 3: pgAdmin GUI 사용

1. pgAdmin 접속 (http://localhost:5050)
2. 서버 연결: `localhost:5432`
3. Query Tool 열기
4. `timescaledb-init.sql` 파일 내용 복사 후 실행

---

## 검증 방법

### 1. Hypertable 생성 확인

```sql
-- Hypertable 목록 조회
SELECT hypertable_name, num_chunks
FROM timescaledb_information.hypertables;
```

**예상 결과:**
```
   hypertable_name   | num_chunks
---------------------+------------
 tag_data_raw        |          0
 energy_timeseries   |          0
```

### 2. Continuous Aggregate 확인

```sql
-- Continuous Aggregate 목록
SELECT view_name, refresh_interval
FROM timescaledb_information.continuous_aggregates;
```

**예상 결과:**
```
    view_name     | refresh_interval
------------------+------------------
 energy_15min_agg | 00:05:00
 energy_1hour_agg | 00:15:00
 energy_1day_agg  | 01:00:00
```

### 3. Compression Policy 확인

```sql
-- Compression Policy 목록
SELECT hypertable_name, compress_after
FROM timescaledb_information.compression_settings;
```

**예상 결과:**
```
   hypertable_name   | compress_after
---------------------+----------------
 tag_data_raw        | 7 days
 energy_timeseries   | 30 days
```

### 4. Retention Policy 확인

```sql
-- Retention Policy 목록
SELECT hypertable_name, drop_after
FROM timescaledb_information.jobs
WHERE proc_name = 'policy_retention';
```

**예상 결과:**
```
   hypertable_name   | drop_after
---------------------+------------
 tag_data_raw        | 3 months
 energy_timeseries   | 2 years
```

### 5. Index 확인

```sql
-- tag_data_raw 인덱스 목록
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'tag_data_raw';
```

---

## 성능 테스트

### 1. 데이터 삽입 테스트

```sql
-- 샘플 데이터 삽입 (1주일치)
INSERT INTO energy_timeseries (timestamp, "facilityId", "powerKwh", "airL")
SELECT
  generate_series(
    NOW() - INTERVAL '7 days',
    NOW(),
    INTERVAL '15 minutes'
  ) AS timestamp,
  (SELECT id FROM facilities LIMIT 1) AS "facilityId",
  random() * 100 AS "powerKwh",
  random() * 1000 AS "airL";
```

### 2. 쿼리 성능 테스트

```sql
-- time_bucket을 사용한 15분 집계 (TimescaleDB 최적화)
EXPLAIN ANALYZE
SELECT
  time_bucket('15 minutes', timestamp) AS bucket,
  AVG("powerKwh") AS avg_power
FROM energy_timeseries
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY bucket
ORDER BY bucket;
```

**예상 실행 시간:** < 100ms (1주일치 데이터 기준)

### 3. Continuous Aggregate 사용 테스트

```sql
-- 집계 뷰 사용 (훨씬 빠름)
EXPLAIN ANALYZE
SELECT * FROM energy_15min_agg
WHERE bucket >= NOW() - INTERVAL '24 hours'
ORDER BY bucket;
```

**예상 실행 시간:** < 10ms (사전 집계된 데이터 사용)

---

## 트러블슈팅

### 문제 1: "extension does not exist" 에러

**원인**: TimescaleDB Extension이 설치되지 않음

**해결방법**:
```bash
# Docker Compose에 TimescaleDB 이미지 사용 확인
# docker-compose.yml 파일에서:
image: timescale/timescaledb:latest-pg16

# 또는 PostgreSQL에 TimescaleDB 수동 설치
apt-get install timescaledb-2-postgresql-16
```

### 문제 2: "could not create hypertable" 에러

**원인**: 테이블이 이미 Hypertable로 생성되어 있음

**해결방법**:
```sql
-- 기존 Hypertable 확인
SELECT * FROM timescaledb_information.hypertables;

-- 필요 시 Hypertable 삭제 후 재생성
DROP TABLE IF EXISTS tag_data_raw CASCADE;
DROP TABLE IF EXISTS energy_timeseries CASCADE;
```

### 문제 3: Continuous Aggregate 생성 실패

**원인**: 테이블에 데이터가 없음 (WITH NO DATA 옵션 필요)

**해결방법**:
```sql
-- 기존 Continuous Aggregate 삭제
DROP MATERIALIZED VIEW IF EXISTS energy_15min_agg CASCADE;

-- WITH NO DATA 옵션으로 재생성
CREATE MATERIALIZED VIEW energy_15min_agg
WITH (timescaledb.continuous) AS
...
WITH NO DATA;

-- 수동 Refresh (데이터가 있을 때)
CALL refresh_continuous_aggregate('energy_15min_agg', NULL, NULL);
```

### 문제 4: Compression Policy 설정 실패

**원인**: 테이블에 Compression이 이미 설정되어 있음

**해결방법**:
```sql
-- 기존 Compression Policy 제거
SELECT remove_compression_policy('tag_data_raw', if_exists => TRUE);

-- 다시 설정
SELECT add_compression_policy('tag_data_raw', INTERVAL '7 days');
```

---

## 참고 자료

- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Hypertables Guide](https://docs.timescale.com/use-timescale/latest/hypertables/)
- [Continuous Aggregates](https://docs.timescale.com/use-timescale/latest/continuous-aggregates/)
- [Compression](https://docs.timescale.com/use-timescale/latest/compression/)
- [Data Retention](https://docs.timescale.com/use-timescale/latest/data-retention/)

---

## 다음 단계

✅ TimescaleDB 초기화 완료 후:
1. Mock 데이터 생성기 구현 (`TagDataCollectorService`)
2. 15분 단위 집계 Cron Job 구현 (`EnergyAggregatorService`)
3. Monitoring API 구현 시작

---

**작성일**: 2026-02-25
**최종 수정**: 2026-03-05 (DB 주소 localhost로 수정)
**담당**: Claude Code
**참고**: 현재 CA는 `cagg_usage_1min`, `cagg_trend_10sec`, `cagg_sensor_10sec`으로 변경됨 → [API-CONTINUOUS-AGGREGATE.md](../../docs/API-CONTINUOUS-AGGREGATE.md)
