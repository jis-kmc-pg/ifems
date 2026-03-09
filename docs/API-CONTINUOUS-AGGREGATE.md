# Continuous Aggregate API 사용 가이드

## 📋 개요

i-FEMS Backend는 TimescaleDB Continuous Aggregate를 사용하여 시계열 데이터를 효율적으로 집계합니다.

**생성일**: 2026-03-03
**작성자**: AI Agent (Claude)
**TimescaleDB 버전**: 2.24.0

---

## 🎯 Continuous Aggregate 구조

### 1. USAGE (적산 데이터)

**View**: `cagg_usage_1min`, `cagg_usage_1min_corrected`

- **집계 간격**: 1분
- **집계 함수**: FIRST, LAST (시간순 첫값, 끝값)
- **계산 방식**: `raw_usage_diff = LAST - FIRST` (적산차)
- **리셋 보정**: `corrected_usage_diff = raw_usage_diff + reset_correction`
- **Refresh Policy**: 1분마다 자동 갱신

**데이터 구조**:
```typescript
{
  timestamp: Date;        // bucket (1분 단위)
  tagId: string;
  facilityId: string;
  energyType: 'elec' | 'air';
  usage: number;          // 보정된 적산차
  resetCorrection: number; // 리셋 보정값
  dataCount: number;       // 데이터 개수
  hadResets: boolean;      // 리셋 발생 여부
}
```

### 2. TREND (순시값 데이터)

**View**: `cagg_trend_10sec`

- **집계 간격**: 10초
- **집계 함수**: LAST (대표값) + AVG/MIN/MAX (통계)
- **계산 방식**: 10초 버킷의 마지막 값을 대표값으로, 평균/최소/최대는 통계 참고용
- **Refresh Policy**: 20초마다 자동 갱신

**데이터 구조**:
```typescript
{
  timestamp: Date;        // bucket (10초 단위)
  tagId: string;
  facilityId: string;
  energyType: 'elec' | 'air';
  value: number;          // 대표값 (LAST — 마지막 순시값)
  avgValue: number;       // 평균값 (통계 참고용)
  minValue: number;       // 최소값 (통계 참고용)
  maxValue: number;       // 최대값 (통계 참고용)
  dataCount: number;      // 데이터 개수
}
```

### 3. SENSOR (센서 데이터)

**View**: `cagg_sensor_10sec`

- **집계 간격**: 10초
- **집계 함수**: AVG, MIN, MAX (평균, 최소, 최대)
- **Refresh Policy**: 20초마다 자동 갱신

**데이터 구조**:
```typescript
{
  timestamp: Date;
  tagId: string;
  facilityId: string;
  sensorName: string;     // 센서 표시명
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataCount: number;
}
```

---

## 🚀 API 엔드포인트

### USAGE API

#### 1. 최근 적산 데이터 조회

```http
GET /api/test/cagg/usage/recent?minutes=10&facilityId={id}
```

**Query Parameters**:
- `minutes` (optional, default: 10): 조회 기간 (분)
- `facilityId` (optional): 설비 ID

**Response**:
```json
{
  "success": true,
  "count": 11,
  "data": [
    {
      "timestamp": "2026-03-03T03:57:00.000Z",
      "tagId": "xxx",
      "facilityId": "yyy",
      "energyType": "elec",
      "usage": -24,
      "resetCorrection": 0,
      "dataCount": 49,
      "hadResets": false
    }
  ]
}
```

#### 2. 기간별 적산 데이터 조회

```http
GET /api/test/cagg/usage/range?startTime=2026-03-03T00:00:00Z&endTime=2026-03-03T12:00:00Z&interval=1hour
```

**Query Parameters**:
- `startTime` (optional): 시작 시간 (ISO 8601)
- `endTime` (optional): 종료 시간 (ISO 8601)
- `interval` (optional, default: 1min): 집계 간격 (1min, 5min, 1hour, 1day)
- `facilityId` (optional): 설비 ID

#### 3. 시간대별 비교 (오늘 vs 어제)

```http
GET /api/test/cagg/compare-hourly?facilityId={id}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "today": [...],
    "yesterday": [...],
    "comparison": {
      "todayTotal": 1234.5,
      "yesterdayTotal": 1180.2,
      "diff": 54.3,
      "changePercent": 4.6
    }
  }
}
```

### TREND API

#### 1. 최근 순시값 조회

```http
GET /api/test/cagg/trend/recent?minutes=10&facilityId={id}
```

**Query Parameters**:
- `minutes` (optional, default: 10): 조회 기간 (분)
- `facilityId` (optional): 설비 ID

**Response**:
```json
{
  "success": true,
  "count": 61,
  "data": [
    {
      "timestamp": "2026-03-03T03:57:40.000Z",
      "tagId": "xxx",
      "facilityId": "yyy",
      "energyType": "elec",
      "value": 100,
      "avgValue": 100,
      "minValue": 100,
      "maxValue": 100,
      "dataCount": 9
    }
  ]
}
```

#### 2. 실시간 값 조회 (마지막 1분)

```http
GET /api/test/cagg/trend/realtime?facilityIds=id1,id2,id3
```

**Query Parameters**:
- `facilityIds` (required): 설비 ID 목록 (쉼표 구분)

**Response**:
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "tagId": "xxx",
      "facilityId": "id1",
      "energyType": "elec",
      "timestamp": "2026-03-03T04:00:00Z",
      "value": 105.5
    }
  ]
}
```

### 리셋 이벤트 API

#### 1. 리셋 이벤트 조회

```http
GET /api/test/cagg/resets?hours=24&facilityId={id}
```

**Query Parameters**:
- `hours` (optional, default: 24): 조회 기간 (시간)
- `facilityId` (optional): 설비 ID
- `tagId` (optional): 태그 ID

#### 2. 리셋 감지 수동 트리거

```http
GET /api/test/cagg/detect-reset
```

---

## 🔧 서비스 구조

### 1. UsageAggregateService

**파일**: `src/monitoring/usage-aggregate.service.ts`

**주요 메서드**:
- `getUsageData()`: 기간별 USAGE 데이터 조회
- `getRecentUsage()`: 최근 N분 데이터 조회
- `compareUsageByHour()`: 오늘/어제 시간대별 비교
- `getResetHistory()`: 리셋 이벤트 이력 조회

**특징**:
- ✅ 리셋 보정 자동 적용 (`cagg_usage_1min_corrected` 사용)
- ✅ 다양한 interval 지원 (1min, 5min, 1hour, 1day)
- ✅ SQL Injection 방지 ($queryRawUnsafe 사용)

### 2. TrendAggregateService

**파일**: `src/monitoring/trend-aggregate.service.ts`

**주요 메서드**:
- `getTrendData()`: 기간별 TREND 데이터 조회
- `getRecentTrend()`: 최근 N분 순시값 조회
- `getRealTimeValues()`: 실시간 최신값 조회 (여러 설비)

**특징**:
- ✅ 10초 단위 고해상도 데이터
- ✅ AVG/MIN/MAX 통계 제공
- ✅ 실시간 모니터링 최적화

### 3. ResetDetectorService

**파일**: `src/monitoring/reset-detector.service.ts`

**주요 메서드**:
- `detectResets()`: 자동 리셋 감지 (@Cron 10초마다)
- `recordManualReset()`: 수동 리셋 기록
- `getResetEvents()`: 리셋 이벤트 조회
- `toggleCorrectionApplied()`: 보정 적용/해제

**특징**:
- ✅ 10% 감소 임계값 자동 감지
- ✅ 중복 방지 (tag_id + reset_time UNIQUE)
- ✅ LAG Window Function 활용

---

## 📊 데이터 흐름

```
PLC/SCADA
    ↓
tag_data_raw (Raw 데이터 저장)
    ↓
TimescaleDB Continuous Aggregate (자동 집계)
    ├── cagg_usage_1min (1분 적산)
    ├── cagg_trend_10sec (10초 순시)
    └── cagg_sensor_10sec (10초 센서)
    ↓
ResetDetectorService (10초마다 리셋 감지)
    ↓
meter_reset_events (리셋 이벤트 기록)
    ↓
cagg_usage_1min_corrected (리셋 보정 View)
    ↓
UsageAggregateService / TrendAggregateService
    ↓
Frontend API 호출
```

---

## ⚙️ 설정 및 유지보수

### Refresh Policy 확인

```sql
SELECT view_name, schedule_interval
FROM timescaledb_information.jobs
WHERE application_name LIKE '%Continuous Aggregate%';
```

### 수동 Refresh

```sql
-- 전체 기간 갱신
CALL refresh_continuous_aggregate('cagg_usage_1min', NULL, NULL);

-- 특정 기간만 갱신
CALL refresh_continuous_aggregate('cagg_usage_1min',
  '2026-03-01 00:00:00',
  '2026-03-02 00:00:00'
);
```

### 리셋 이벤트 확인

```sql
SELECT * FROM meter_reset_events
WHERE reset_time >= NOW() - INTERVAL '24 hours'
ORDER BY reset_time DESC;
```

---

## 🚨 주의사항

1. **Raw 데이터 보존**
   - Continuous Aggregate는 집계된 데이터만 저장
   - Raw 데이터(`tag_data_raw`)는 별도로 보관 필요

2. **리셋 감지 정확도**
   - 10% 임계값은 조정 가능 (`ResetDetectorService.RESET_THRESHOLD`)
   - 통신 장애로 인한 데이터 손실 시 오감지 가능

3. **성능 고려사항**
   - 너무 많은 설비를 한 번에 조회하면 성능 저하
   - interval을 크게 설정하면 응답 속도 향상

4. **시간대 주의**
   - 모든 timestamp는 UTC 기준
   - 프론트엔드에서 로컬 타임존 변환 필요

---

## 📝 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-03-03 | 1.0.0 | 초기 문서 작성 (USAGE + TREND + Reset Detector) |

---

## 🔗 관련 문서

- [Prisma Schema](../apps/api/prisma/schema.prisma)
- [Migration SQL](../apps/api/prisma/migrations/20260303_add_continuous_aggregates_v2/)
- [TimescaleDB 공식 문서](https://docs.timescale.com/timescaledb/latest/how-to-guides/continuous-aggregates/)
