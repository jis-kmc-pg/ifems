# Dynamic Chart Resolution 전체 적용 Design Document (v2.0)

> **Summary**: i-FEMS 모든 시간축 차트(12개 화면)에 Progressive Resolution 적용 상세 설계
>
> **Project**: i-FEMS (Intelligence Facility & Energy Management System)
> **Version**: 2.0.0 (재작성)
> **Author**: AI Assistant (Claude) + User
> **Date**: 2026-02-28
> **Last Modified**: 2026-03-05
> **Status**: Ready for Implementation
> **Note**: SQL 예시의 `tag_type` 컬럼은 2026-03-04 재설계로 `measure_type`(MeasureType enum)으로 변경됨. TREND→INSTANTANEOUS, USAGE→CUMULATIVE 등. 실제 CA는 `cagg_usage_1min`, `cagg_trend_10sec`, `cagg_sensor_10sec` 사용.
> **Planning Doc**: [dynamic-resolution-전체적용.plan.md](../../01-plan/features/dynamic-resolution-전체적용.plan.md)

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Phase 1 | Schema Definition | N/A |
| Phase 2 | Coding Conventions | ✅ (CLAUDE.md) |
| Phase 3 | Mockup | N/A |
| Phase 4 | API Spec | ✅ (Backend 77 APIs 완료) |

---

## 1. Overview

### 1.1 Design Goals

이 설계 문서는 i-FEMS의 **모든 시간축 차트 (12개 화면)**에 Dynamic Chart Resolution (Progressive Resolution)을 적용하기 위한 상세 기술 설계를 제공합니다.

**핵심 원칙**: **X축이 시간인 모든 차트에 적용** (트렌드 차트 + 싸이클 파형 포함)

**Technical Goals**:
1. **MON-002 기준 구현 패턴**을 11개 화면에 일관되게 적용
2. **그룹 A (9개)와 그룹 B (3개)** 명확한 구현 패턴 제공
3. **화면별 maxDepth 설정**을 통한 맞춤형 줌 레벨 제공
4. **Backend API interval 파라미터 추가** (싸이클 파형 3개 화면)
5. **브라우저 콘솔 에러 0개** 달성 (MON-002 수준)
6. **단계별 검증 프로세스**를 통한 품질 보장

### 1.2 Design Principles

- **Reference Implementation First**: MON-002를 유일한 검증된 구현으로 삼고, 모든 화면이 이 패턴을 따름
- **Two-Group Pattern**: 그룹 A (시간 범위 트렌드)와 그룹 B (싸이클 파형)을 명확히 구분하고 각각의 패턴 제공
- **Time-Based X-Axis for All**: 싸이클 파형도 X축은 시간 (실제 시간 범위 조회 → Frontend 정규화)
- **No Temporary Code**: TODO 주석, 임시 하드코딩, "나중에 구현" 접근 금지
- **One Screen at a Time**: 한 화면씩 완전히 구현하고 검증한 후 다음 화면으로 진행
- **Browser-First Verification**: TypeScript 컴파일 후 반드시 브라우저 콘솔 검증 실시
- **Real DB Integration First**: Mock 데이터는 최소화하고, Real PostgreSQL + TimescaleDB 연동 우선
- **Testable Logic**: 시간 정규화 등 핵심 로직은 순수 함수로 분리하여 단위 테스트 가능하게

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React 19)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  그룹 A: 시간 범위 트렌드 (9개 화면)                  │     │
│  │  MON-001, MON-002, DSH-001, DSH-002                │     │
│  │  ANL-001, ANL-002, ANL-005, ALT-004, ALT-006       │     │
│  └────────────────────────────────────────────────────┘     │
│         │                                                    │
│         │ useDynamicResolution Hook                          │
│         ▼                                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  TrendChart + onZoomChange                          │     │
│  │  (X축 = time, Y축 = value)                          │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  그룹 B: 싸이클 파형 (3개 화면)                       │     │
│  │  ANL-003, ANL-004, SET-003                          │     │
│  └────────────────────────────────────────────────────┘     │
│         │                                                    │
│         │ Custom interval State + handleZoomChange           │
│         ▼                                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  TrendChart + onZoomChange                          │     │
│  │  (X축 = sec, Y축 = value)                           │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│         │ SWR Cache (interval별 dedupe)                      │
│         ▼                                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Service Layer (monitoring.ts / analysis.ts)        │     │
│  └────────────────────────────────────────────────────┘     │
│         │                                                    │
└─────────┼───────────────────────────────────────────────────┘
          │
          │ axios.get()
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (NestJS 11)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  그룹 A API: /api/monitoring/range/:facilityId/:type        │
│    ?start=...&end=...&interval={15m|1m|10s|1s}              │
│                                                             │
│  그룹 B API: /api/analysis/cycle/waveform                   │
│    ?cycleId=...&isReference=...&interval={10s|1s} ⭐ 추가    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
          │
          │ Prisma ORM
          ▼
┌─────────────────────────────────────────────────────────────┐
│          PostgreSQL 16 + TimescaleDB                         │
├─────────────────────────────────────────────────────────────┤
│  - tag_data_raw (1s 데이터, hypertable)                      │
│  - energy_usage_1min (1m 집계, continuous aggregate)         │
│  - energy_timeseries (15m 집계, continuous aggregate)        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

#### 그룹 A (시간 범위 트렌드) - useDynamicResolution 패턴

```
1. User Zoom Action (MON-001, DSH-002, ANL-001 등)
   ↓
2. TrendChart.onZoomChange() → zoomRatio 계산
   ↓
3. useDynamicResolution.handleZoom(zoomRatio)
   ↓
4. getIntervalForZoomRatio() → 새 interval 결정
   ↓
5. setCurrentInterval() → 상태 업데이트
   ↓
6. SWR Key 변경 감지
   ↓
7. fetchRangeData(facilityId, start, end, interval, metric)
   ↓
8. GET /api/monitoring/range/:facilityId/:metric?interval=...
   ↓
9. Backend: interval별 집계 쿼리 실행
   ↓
10. Response: { data: [{timestamp, value}], metadata: {...} }
    ↓
11. TrendChart 리렌더링 (uPlot)
```

#### 그룹 B (싸이클 파형) - Custom interval 상태 패턴

```
1. User Zoom Action (ANL-003, ANL-004, SET-003)
   ↓
2. TrendChart.onZoomChange() → zoomRatio 계산
   ↓
3. handleZoomChange(zoomRatio) - 커스텀 핸들러
   ↓
4. getIntervalForZoomRatio(zoomRatio, currentInterval, '10s') - 10초 기준
   ↓
5. setCurrentInterval(newInterval) - useState
   ↓
6. useQuery Key 변경 감지 (cycleId + interval)
   ↓
7. getCycleWaveformData(cycleId, isReference, interval) ⭐ interval 추가
   ↓
8. GET /api/analysis/cycle/waveform?cycleId=...&interval=... ⭐ 추가
   ↓
9. Backend: interval별 파형 데이터 생성 (360개 or 3600개 포인트)
   ↓
10. Response: [{ sec: number, value: number }]
    ↓
11. TrendChart 리렌더링 (X축 = sec)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| 그룹 A (9개 화면) | useDynamicResolution | Interval 자동 전환 로직 |
| 그룹 B (3개 화면) | useState + useQuery | Interval 상태 관리 + API 호출 |
| useDynamicResolution | SWR | API 캐싱 및 상태 관리 |
| useDynamicResolution | chart-utils | interval 계산 로직 |
| useDynamicResolution | monitoring.ts | API 호출 서비스 (시간 범위) |
| 그룹 B 화면 | analysis.ts | API 호출 서비스 (싸이클 파형) |
| TrendChart | uPlot 1.6.32 | Canvas 기반 차트 렌더링 |
| TrendChart | chart-utils | Zoom ratio 계산 |
| Backend API | Prisma ORM | DB 쿼리 |
| Backend API | PostgreSQL + TimescaleDB | 시계열 데이터 저장 |

---

## 3. Data Model

### 3.1 Frontend Data Types

#### Interval 타입 (4단계)

```typescript
// apps/web/src/types/chart.ts
export type Interval = '15m' | '1m' | '10s' | '1s';

// 그룹 A: useDynamicResolution Options
export interface DynamicResolutionOptions {
  initialInterval: Interval;  // 초기 interval (화면별 상이)
  startTime: string;          // ISO8601 시작 시간
  endTime: string;            // ISO8601 종료 시간
  facilityId: string;         // 설비 ID (HNK10-000)
  metric: 'power' | 'air' | 'gas' | 'solar'; // 에너지 타입
  enabled?: boolean;          // 훅 활성화 여부 (기본: true)
}

export interface DynamicResolutionResult {
  data: ChartDataPoint[];     // 차트 데이터 배열
  metadata?: RangeMetadata;   // 메타데이터 (interval, count 등)
  currentInterval: Interval;  // 현재 interval
  isLoading: boolean;         // 로딩 상태
  isError: boolean;           // 에러 상태
  error: Error | null;        // 에러 객체
  handleZoom: (zoomRatio: number) => void; // Zoom 핸들러
  reset: () => void;          // 초기 interval로 리셋
  setManualInterval: (interval: Interval) => void; // 수동 interval 변경
}

// 그룹 A: 시간 범위 데이터 포인트
export interface ChartDataPoint {
  timestamp: string;  // ISO8601 (2024-01-01T00:00:00Z)
  value: number;      // 집계된 값
}

// 그룹 B: 싸이클 파형 관련 타입

/** 싸이클 메타데이터 (Backend 응답) */
export interface CycleMetadata {
  cycleId: string;         // 싸이클 ID (예: 'ref', 'c001', 'c002')
  startTime: string;       // ISO8601 시작 시간 (예: "2024-01-01T11:00:00Z")
  endTime: string;         // ISO8601 종료 시간 (예: "2024-01-01T11:20:00Z")
  facilityId: string;      // 설비 ID (예: "HNK10-020")
  duration: number;        // 싸이클 길이 (초 단위, endTime - startTime)
  status?: 'normal' | 'anomaly'; // 싸이클 상태
  energy?: number;         // 총 에너지 사용량 (kWh)
  similarity?: number;     // 기준 싸이클 대비 유사도 (0~100%)
}

/** 실제 시간 데이터 포인트 (Backend 응답) */
export interface TimeSeriesPoint {
  timestamp: string;  // ISO8601 (예: "2024-01-01T11:00:00Z")
  value: number;      // 전력 값 (kW)
}

/** 정규화된 데이터 포인트 (Frontend 변환 후) */
export interface NormalizedPoint {
  sec: number;   // 상대 시간 (0부터 시작, 초 단위)
  value: number; // 전력 값 (kW)
}

/** 싸이클 파형 오버레이 데이터 */
export interface OverlayPoint {
  sec: number;            // 상대 시간 (0부터)
  refValue?: number;      // 기준 파형 값
  compare1Value?: number; // 비교1 파형 값
  compare2Value?: number; // 비교2 파형 값
}

export interface RangeMetadata {
  interval: Interval;
  count: number;
  startTime: string;
  endTime: string;
}
```

#### 화면별 maxDepth 및 initialInterval 설정

```typescript
// apps/web/src/lib/constants.ts
export const SCREEN_MAX_DEPTH: Record<string, number> = {
  'MON-001': 2,  // 종합 현황 (15m, 1m)
  'MON-002': 3,  // 라인별 상세 (15m, 1m, 10s, 1s) ✅ 완료
  'DSH-001': 1,  // 에너지 사용 추이 (15m)
  'DSH-002': 2,  // 설비별 추이 (15m, 1m)
  'ANL-001': 2,  // 비교 분석 (15m, 1m)
  'ANL-002': 3,  // 상세 비교 분석 (15m, 1m, 10s)
  'ANL-003': 3,  // 싸이클 분석 (10s, 1s)
  'ANL-004': 3,  // 싸이클 타임 지연 (10s, 1s)
  'ANL-005': 2,  // 전력 품질 분석 (15m, 1m)
  'ALT-004': 1,  // 전력 품질 이력 (15m)
  'ALT-006': 2,  // 싸이클 이상 이력 (15m, 10s)
  'SET-003': 3,  // 기준 싸이클 파형 (1s, 줌 비활성화)
};

export const SCREEN_INITIAL_INTERVAL: Record<string, Interval> = {
  'ANL-003': '10s',  // 싸이클 분석 (10초부터 시작)
  'ANL-004': '10s',  // 싸이클 타임 지연 (10초부터 시작)
  'SET-003': '1s',   // 기준 싸이클 파형 (1초 고정)
  // 나머지는 기본값 '15m' 사용
};
```

### 3.2 Backend Data Model

#### 그룹 A: API Request/Response (기존 완료)

```typescript
// GET /api/monitoring/range/:facilityId/:type
interface RangeDataRequest {
  facilityId: string;  // Path parameter
  type: 'power' | 'air' | 'gas' | 'solar'; // Path parameter
  start: string;       // Query param (ISO8601)
  end: string;         // Query param (ISO8601)
  interval: '15m' | '1m' | '10s' | '1s'; // Query param
}

interface RangeDataResponse {
  facilityId: string;
  energyType: 'power' | 'air' | 'gas' | 'solar';
  interval: '15m' | '1m' | '10s' | '1s';
  data: Array<{
    timestamp: string; // ISO8601
    value: number;
  }>;
}
```

#### 그룹 B: API Request/Response (interval 파라미터 추가 필요) ⭐

**변경 전**:
```typescript
// GET /api/analysis/cycle/waveform
interface CycleWaveformRequest {
  cycleId: string;      // Query param
  isReference: boolean; // Query param (true: 기준 파형, false: 비교 파형)
}

interface CycleWaveformResponse {
  data: Array<{
    sec: number;   // 0~360초 (360개 포인트, 10초 간격 가정)
    value: number; // kW
  }>;
}
```

**변경 후**:
```typescript
// GET /api/analysis/cycle/waveform?cycleId=...&isReference=...&interval=... ⭐
interface CycleWaveformRequest {
  cycleId: string;      // Query param
  isReference: boolean; // Query param
  interval: '10s' | '1s'; // ⭐ 추가: 파형 해상도 (기본값: '10s')
}

interface CycleWaveformResponse {
  data: Array<{
    sec: number;   // interval='10s': 360개 포인트 (1초 간격)
                  // interval='1s': 3600개 포인트 (0.1초 간격)
    value: number; // kW
  }>;
}
```

### 3.3 Database Schema

#### PostgreSQL + TimescaleDB (그룹 A - 기존 완료)

**tag_data_raw** (1초 데이터, hypertable):
```sql
CREATE TABLE tag_data_raw (
  time TIMESTAMPTZ NOT NULL,
  tag_name VARCHAR(100) NOT NULL,
  value DOUBLE PRECISION,
  quality INTEGER,
  PRIMARY KEY (time, tag_name)
);

SELECT create_hypertable('tag_data_raw', 'time');
```

**energy_usage_1min** (1분 집계, continuous aggregate):
```sql
CREATE MATERIALIZED VIEW energy_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  tag_name,
  CASE
    WHEN tag_type = 'TREND' THEN last(value, time)
    WHEN tag_type = 'USAGE' THEN last(value, time) - first(value, time)
    WHEN tag_type = 'OPERATE' THEN sum(value)
    WHEN tag_type = 'SENSOR' THEN avg(value)
  END AS value
FROM tag_data_raw
GROUP BY bucket, tag_name, tag_type;
```

**energy_timeseries** (15분 집계, continuous aggregate):
```sql
CREATE MATERIALIZED VIEW energy_timeseries
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', bucket) AS bucket,
  tag_name,
  CASE
    WHEN tag_type = 'TREND' THEN last(value, bucket)
    WHEN tag_type = 'USAGE' THEN sum(value)
    WHEN tag_type = 'OPERATE' THEN sum(value)
    WHEN tag_type = 'SENSOR' THEN avg(value)
  END AS value
FROM energy_usage_1min
GROUP BY bucket, tag_name, tag_type;
```

---

## 4. API Specification

### 4.1 그룹 A: 시간 범위 트렌드 API (기존 완료 ✅)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/monitoring/range/:facilityId/power | 전력 트렌드 데이터 (interval별) | Required |
| GET | /api/monitoring/range/:facilityId/air | 에어 트렌드 데이터 (interval별) | Required |
| GET | /api/monitoring/range/:facilityId/gas | 가스 트렌드 데이터 (interval별) | Required |
| GET | /api/monitoring/range/:facilityId/solar | 태양광 트렌드 데이터 (interval별) | Required |

#### `GET /api/monitoring/range/:facilityId/power`

**Request:**
```http
GET /api/monitoring/range/HNK10-010-1/power?start=2024-01-01T00:00:00Z&end=2024-01-01T23:59:59Z&interval=1m
```

**Query Parameters:**
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| start | string | Yes | ISO8601 시작 시간 | 2024-01-01T00:00:00Z |
| end | string | Yes | ISO8601 종료 시간 | 2024-01-01T23:59:59Z |
| interval | string | Yes | 데이터 집계 간격 | 15m, 1m, 10s, 1s |

**Response (200 OK):**
```json
{
  "facilityId": "HNK10-010-1",
  "energyType": "power",
  "interval": "1m",
  "data": [
    { "timestamp": "2024-01-01T00:00:00Z", "value": 45.3 },
    { "timestamp": "2024-01-01T00:01:00Z", "value": 46.1 },
    { "timestamp": "2024-01-01T00:02:00Z", "value": 44.8 }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Invalid interval (허용값: 15m, 1m, 10s, 1s)
- `401 Unauthorized`: JWT 토큰 없음
- `404 Not Found`: Facility not found
- `500 Internal Server Error`: DB 연결 오류, 쿼리 실패

**Tag Type별 집계 로직** (Backend 자동 처리):

Backend는 Tag Name을 기반으로 Tag Type을 자동 판별하고, 적절한 집계 SQL을 적용합니다.

| Tag Type | 집계 SQL | 용도 | 예시 Tag | 분석 화면 사용 |
|----------|----------|------|----------|--------------|
| **TREND** | `last(value, time)` | 순간값 (현재 상태) | `HNK10-020_POWER_KW` | ⭐ **주로 사용** (kW) |
| USAGE | `last(value, time) - first(value, time)` | 누적값 차이 | `HNK10-020_ENERGY_KWH` | 선택적 사용 |
| OPERATE | `sum(value)` | 운전 시간 합계 | `HNK10-020_RUN_TIME` | 일부 화면 |
| SENSOR | `avg(value)` | 센서 평균값 | `HNK10-020_TEMP` | 일부 화면 |

**분석 화면(ANL-001~005) 주의사항**:
- **kW (TREND 타입) 주로 사용**: 순간 전력값을 비교하기 위해
- Frontend에서 `metric='power'` 전달 시 Backend가 자동으로 TREND 타입 태그 조회
- Backend 응답 값은 이미 Tag Type별 집계가 완료된 상태

**Interval별 데이터 소스**:
| Interval | Database Table | Tag Type 집계 | Query Time |
|----------|---------------|--------------|------------|
| 15m | energy_timeseries | ✓ 적용 | < 100ms |
| 1m | energy_usage_1min | ✓ 적용 | < 200ms |
| 10s | tag_data_raw (10초 집계) | ✓ 적용 | < 500ms |
| 1s | tag_data_raw | ✓ 적용 | < 1000ms |

### 4.2 그룹 B: 싸이클 파형 API (interval 파라미터 추가 필요) ⭐

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/analysis/cycle/waveform | 싸이클 파형 데이터 (interval별) ⭐ | Required |

#### `GET /api/analysis/cycle/waveform` (변경 후)

**Request:**
```http
GET /api/analysis/cycle/waveform?cycleId=c001&isReference=false&interval=1s
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| cycleId | string | Yes | - | 싸이클 ID | c001, c002, ref |
| isReference | boolean | Yes | - | 기준 파형 여부 | true, false |
| interval | string | No | '10s' | 파형 해상도 ⭐ 추가 | 10s, 1s |

**Response (200 OK):**

**interval='10s' (360개 포인트, 1초 간격)**:
```json
{
  "data": [
    { "sec": 0, "value": 850.5 },
    { "sec": 1, "value": 852.3 },
    { "sec": 2, "value": 848.7 },
    ...
    { "sec": 359, "value": 851.2 }
  ]
}
```

**interval='1s' (3600개 포인트, 0.1초 간격)**:
```json
{
  "data": [
    { "sec": 0.0, "value": 850.5 },
    { "sec": 0.1, "value": 850.8 },
    { "sec": 0.2, "value": 851.1 },
    ...
    { "sec": 359.9, "value": 851.2 }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Invalid interval (허용값: 10s, 1s)
- `401 Unauthorized`: JWT 토큰 없음
- `404 Not Found`: Cycle not found
- `500 Internal Server Error`: DB 연결 오류, 쿼리 실패

**Backend API 구현 변경사항**:

```typescript
// Backend: apps/api/src/analysis/analysis.service.ts

// 변경 전
getCycleWaveform(cycleId: string, isReference: boolean) {
  const pointCount = 360; // 고정
  // ... 360개 포인트 생성
}

// 변경 후
getCycleWaveform(cycleId: string, isReference: boolean, interval: '10s' | '1s' = '10s') {
  const pointCount = interval === '1s' ? 3600 : 360; // ⭐ interval별 포인트 수
  const step = interval === '1s' ? 0.1 : 1; // ⭐ interval별 step

  return Array.from({ length: pointCount }, (_, i) => ({
    sec: i * step,
    value: this.calculateWaveformValue(cycleId, i * step, isReference),
  }));
}
```

---

## 5. UI/UX Design

### 5.1 그룹 A 패턴 (MON-002 기준)

#### 화면 레이아웃 (예: MON-001 종합 현황)
```
┌────────────────────────────────────────────────────────────┐
│  [MON-001 종합 현황]                                         │
├────────────────────────────────────────────────────────────┤
│  필터:  [설비 선택 ▼]  [날짜 ▼]                              │
│         HNK10-020      2024-01-01                            │
├────────────────────────────────────────────────────────────┤
│  전력 차트 (kW)                      현재: 1분 (Level 1)      │
│  ┌────────────────────────────────────────────────────┐    │
│  │                         ┌─ 현재 시각 수직선         │    │
│  │    ────┐               │                           │    │
│  │        │ ──────┐       │  ┌─ 줌 영역 (더 세밀)     │    │
│  │        └──     └───────┘  │                        │    │
│  └────────────────────────────────────────────────────┘    │
│  ℹ️ Loading... (interval 전환 중)                            │
└────────────────────────────────────────────────────────────┘
```

### 5.2 그룹 B 패턴 (ANL-003 싸이클 분석)

#### 화면 레이아웃
```
┌────────────────────────────────────────────────────────────┐
│  [ANL-003 싸이클 분석]                                       │
├────────────────────────────────────────────────────────────┤
│  [설비1 목록]  [싸이클 파형 오버레이]  [설비2 목록]          │
│                                                             │
│  ┌───────┐   ┌────────────────────────┐   ┌───────┐       │
│  │ c001  │   │  ╱╲    기준(회색)       │   │ c002  │       │
│  │ c002✓ │   │ ╱  ╲   비교1(노랑)      │   │ c003✓ │       │
│  │ c003  │   │      ╲╱  ╲  비교2(파랑) │   │ c004  │       │
│  │ c004  │   │          ╲╱             │   │ c005  │       │
│  └───────┘   └────────────────────────┘   └───────┘       │
│              X축: 0~360초 (현재: 1s, 3600개 포인트)          │
│              ℹ️ Loading... (interval 전환 중)                │
└────────────────────────────────────────────────────────────┘
```

### 5.3 User Flow (Dynamic Resolution)

#### 그룹 A (MON-001 등)
```
1. 화면 접속
   ↓
2. 초기 데이터 로드 (initialInterval: '15m')
   ↓
3. 차트 표시 (전체 범위, 15분 간격)
   ↓
4. [User] 마우스 휠로 줌인
   ↓
5. [System] Zoom ratio 계산 (예: 0.8 → 70%)
   ↓
6. [System] getIntervalForZoomRatio() → '1m'
   ↓
7. [UI] "Loading..." 오버레이 표시
   ↓
8. [System] fetchRangeData(facilityId, start, end, '1m', 'power')
   ↓
9. [System] 데이터 수신 및 렌더링
   ↓
10. [UI] 오버레이 숨김, 1분 데이터 표시
```

#### 그룹 B (ANL-003 등)
```
1. 화면 접속
   ↓
2. 초기 데이터 로드 (initialInterval: '10s', 360개 포인트)
   ↓
3. 차트 표시 (싸이클 파형 오버레이)
   ↓
4. [User] 마우스 휠로 줌인
   ↓
5. [System] Zoom ratio 계산 (예: 0.3 → 30%)
   ↓
6. [System] getIntervalForZoomRatio(0.3, '10s', '10s') → '1s'
   ↓
7. [UI] "Loading..." 오버레이 표시
   ↓
8. [System] getCycleWaveformData(cycleId, isRef, '1s') ⭐
   ↓
9. [System] 3600개 포인트 수신 및 렌더링
   ↓
10. [UI] 오버레이 숨김, 1초 해상도 데이터 표시
```

---

## 6. Error Handling

### 6.1 Error Code Definition

| Code | Message | Cause | Handling |
|------|---------|-------|----------|
| 400 | Invalid interval | interval 파라미터 오류 (그룹 A: 15m/1m/10s/1s, 그룹 B: 10s/1s) | Frontend에서 interval 검증, 허용값만 전송 |
| 400 | Invalid date format | ISO8601 형식 오류 (그룹 A) | Frontend에서 날짜 포맷 검증 |
| 401 | Unauthorized | JWT 토큰 없음/만료 | 로그인 페이지로 리다이렉트 |
| 404 | Facility not found (그룹 A) / Cycle not found (그룹 B) | 존재하지 않는 ID | 사용자에게 경고 메시지 표시 |
| 500 | Internal server error | DB 연결 오류, 쿼리 실패 | 에러 로깅, 재시도 (SWR 자동 재시도) |

### 6.2 Error Response Format

```json
{
  "statusCode": 400,
  "message": "Invalid interval. Allowed values for cycle waveform: 10s, 1s",
  "error": "Bad Request"
}
```

### 6.3 Frontend Error Handling

#### 그룹 A: useDynamicResolution 훅 에러 처리

```typescript
// M-01: Toast notification on API error (현재: alert, 향후: toast)
useEffect(() => {
  if (error && enabled) {
    const errorMessage = error instanceof Error
      ? error.message
      : '데이터를 불러오는 중 오류가 발생했습니다.';
    alert(`[동적 해상도 오류] ${errorMessage}`);
  }
}, [error, enabled]);
```

#### 그룹 B: useQuery 에러 처리

```typescript
// ANL-003, ANL-004, SET-003
const { data: waveData, isLoading, error } = useQuery({
  queryKey: ['cycle-wave', cycleId, currentInterval],
  queryFn: () => getCycleWaveformData(cycleId, false, currentInterval),
  retry: 3,
  onError: (err) => {
    console.error('[Cycle Waveform] API Error:', err);
    alert(`싸이클 파형 데이터를 불러오는 중 오류가 발생했습니다: ${err.message}`);
  },
});
```

---

## 7. Security Considerations

- [x] **Input validation**: interval 파라미터 검증 (화이트리스트)
  - 그룹 A: 15m, 1m, 10s, 1s
  - 그룹 B: 10s, 1s
- [x] **Authentication**: JWT 토큰 기반 인증 (Backend 77 APIs 공통)
- [x] **SQL Injection 방지**: Prisma ORM 사용 (파라미터화된 쿼리)
- [x] **XSS 방지**: React는 기본적으로 XSS 방지 (HTML escaping)
- [x] **HTTPS enforcement**: Production 환경에서 HTTPS 필수
- [ ] **Rate Limiting**: Backend API에 Rate Limiting 추가 권장 (향후 개선)

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool |
|------|--------|------|
| Unit Test | useDynamicResolution 훅 | Vitest |
| Unit Test | getIntervalForZoomRatio() | Vitest |
| Unit Test | getCycleWaveformData() (interval 파라미터) | Vitest |
| Integration Test | fetchRangeData() | MSW (Mock Service Worker) |
| E2E Test | 12개 화면 줌 동작 | Playwright |
| Manual Test | 브라우저 콘솔 검증 | Chrome DevTools |

### 8.2 Test Cases (Key)

#### 그룹 A: useDynamicResolution 훅

- [ ] **Happy path**: Zoom ratio 0.8 → interval 15m → 1m 전환
- [ ] **Error scenario**: API 에러 시 error 상태 반환, alert 호출
- [ ] **Edge case**: Zoom ratio 1.0 (전체 범위) → interval 변경 없음
- [ ] **Edge case**: maxDepth 초과 줌 → interval 고정

#### 그룹 B: getCycleWaveformData 함수

- [ ] **Happy path**: interval='10s' → 360개 포인트 반환
- [ ] **Happy path**: interval='1s' → 3600개 포인트 반환
- [ ] **Error scenario**: Invalid interval ('5s') → 400 Bad Request
- [ ] **Edge case**: cycleId='ref', isReference=true → 기준 파형 반환

#### 화면별 검증 (12개)

- [ ] **각 화면**: MON-002 패턴 적용 후 브라우저 콘솔 에러 0개
- [ ] **각 화면**: maxDepth 제한 동작 확인
- [ ] **각 화면**: interval 전환 시 API 파라미터 정확히 전송 (Network 탭)
- [ ] **각 화면**: SWR/useQuery 캐싱 정상 동작

---

## 9. Implementation Pattern Analysis

### 9.1 그룹 A 패턴 (MON-002 기준)

#### useDynamicResolution 훅 사용 패턴

```typescript
// MON-001 종합 현황 (maxDepth: 2)
const dynamicPowerResolution = useDynamicResolution({
  initialInterval: '15m',  // SCREEN_INITIAL_INTERVAL['MON-001'] || '15m'
  startTime: `${date}T00:00:00Z`,
  endTime: `${date}T23:59:59Z`,
  facilityId: 'HNK10-020',
  metric: 'power',
  enabled: true,
});

// TrendChart에 props 전달
<TrendChart
  data={dynamicPowerResolution.data || []}
  series={powerSeries}
  xKey="time"  // ⭐ 그룹 A는 "time"
  yLabel="kWh"
  onZoomChange={dynamicPowerResolution.handleZoom}  // ⭐ 필수
  isLoading={dynamicPowerResolution.isLoading}      // ⭐ 필수
  loadingMessage={`현재 해상도: ${formatInterval(dynamicPowerResolution.currentInterval)}`}
/>
```

**적용 화면**: MON-001, DSH-001, DSH-002, ANL-001, ANL-002, ANL-005, ALT-004, ALT-006 (+ MON-002 이미 완료)

### 9.2 그룹 B 패턴 (싸이클 파형 오버레이 + 시간 정규화)

#### 핵심 개념

**싸이클 파형 화면(ANL-003, ANL-004, SET-003)은 X축이 시간이지만, 비교를 위해 정규화가 필요합니다.**

**예시**:
- **기준 싸이클**: 11:00~11:20 (20분 길이)
- **비교 싸이클**: 17:40~18:10 (30분 길이)

**화면 표시**:
- 기준 싸이클: 11:00을 0으로 치환 → X축 0~20분
- 비교 싸이클: 17:40을 0으로 치환 → X축 0~30분
- 두 시리즈를 같은 차트에 오버레이
- **확대 기능**: interval 변경 (10s → 1s) → 각 시간 범위 다시 조회 → 정규화 → 오버레이

#### 구현 순서

```
1. 싸이클 메타데이터 조회 (startTime, endTime, facilityId)
   ↓
2. 각 싸이클의 실제 시간 범위로 데이터 조회 (fetchRangeData)
   - 기준: fetchRangeData(facilityId, "11:00:00", "11:20:00", "10s", "power")
   - 비교: fetchRangeData(facilityId, "17:40:00", "18:10:00", "10s", "power")
   ↓
3. 실제 timestamp 데이터를 상대 시간(sec)으로 정규화
   - 기준: [{timestamp: "11:00:00", value: 850}, ...] → [{sec: 0, value: 850}, ...]
   - 비교: [{timestamp: "17:40:00", value: 920}, ...] → [{sec: 0, value: 920}, ...]
   ↓
4. 정규화된 데이터를 오버레이 (merge)
   - [{sec: 0, refValue: 850, compareValue: 920}, ...]
   ↓
5. TrendChart 렌더링 (xKey="sec")
   ↓
6. 사용자 확대 시
   - interval 변경 (10s → 1s)
   - 2~5 반복 (각 시간 범위 다시 조회)
```

#### 유틸리티 함수 (순수 함수, 단위 테스트 가능)

```typescript
// ============================================================
// apps/web/src/lib/cycle-utils.ts
// ============================================================

import type { Interval } from '../types/chart';

/** interval 문자열을 초 단위로 변환 */
export function intervalToSeconds(interval: Interval): number {
  switch (interval) {
    case '15m': return 900;
    case '1m': return 60;
    case '10s': return 10;
    case '1s': return 1;
    default: return 60;
  }
}

/** 실제 시간 데이터를 상대 시간(0부터)으로 정규화 */
export function normalizeToRelativeTime(
  data: TimeSeriesPoint[],
  startTime: string,
  interval: Interval
): NormalizedPoint[] {
  if (!data || data.length === 0) return [];

  const step = intervalToSeconds(interval);

  return data.map((point, index) => ({
    sec: index * step,  // 0, 1, 2, ... (1s) or 0, 10, 20, ... (10s)
    value: point.value,
  }));
}

/** 여러 시리즈를 오버레이 데이터로 병합 */
export function mergeOverlayData(
  ref?: NormalizedPoint[],
  compare1?: NormalizedPoint[],
  compare2?: NormalizedPoint[]
): OverlayPoint[] {
  // 가장 긴 시리즈 길이 찾기
  const maxLength = Math.max(
    ref?.length || 0,
    compare1?.length || 0,
    compare2?.length || 0
  );

  // 오버레이 데이터 생성
  return Array.from({ length: maxLength }, (_, i) => ({
    sec: ref?.[i]?.sec || compare1?.[i]?.sec || compare2?.[i]?.sec || i * intervalToSeconds('1s'),
    refValue: ref?.[i]?.value,
    compare1Value: compare1?.[i]?.value,
    compare2Value: compare2?.[i]?.value,
  }));
}

/** 상대 시간(sec)을 사람이 읽을 수 있는 형식으로 변환 */
export function formatRelativeTime(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초`;
  }
  return `${seconds}초`;
}
```

#### ANL-003 완전한 구현 예시

```typescript
// ============================================================
// apps/web/src/pages/analysis/ANL003CycleAnalysis.tsx
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRangeData } from '../../services/monitoring';
import { getCycleInfo, getCycleList } from '../../services/analysis';
import { normalizeToRelativeTime, mergeOverlayData } from '../../lib/cycle-utils';
import { getIntervalForZoomRatio, formatInterval } from '../../lib/chart-utils';
import { SCREEN_INITIAL_INTERVAL } from '../../lib/constants';
import type { Interval } from '../../types/chart';
import type { CycleMetadata, NormalizedPoint, OverlayPoint } from '../../types/chart';

export default function ANL003CycleAnalysis() {
  // ============================================================
  // 상태 관리
  // ============================================================
  const [facility1, setFacility1] = useState('HNK10-020');
  const [facility2, setFacility2] = useState('HNK10-010');
  const [selectedCycle1, setSelectedCycle1] = useState('c001');
  const [selectedCycle2, setSelectedCycle2] = useState('c002');

  // 동적 해상도
  const initialInterval = (SCREEN_INITIAL_INTERVAL['ANL-003'] || '10s') as Interval;
  const [currentInterval, setCurrentInterval] = useState<Interval>(initialInterval);
  const [isZooming, setIsZooming] = useState(false);

  // ============================================================
  // 1. 싸이클 목록 조회 (facility1 기준)
  // ============================================================
  const { data: cycles } = useQuery({
    queryKey: ['anl-cycles', facility1],
    queryFn: () => getCycleList(facility1),
  });

  // ============================================================
  // 2. 기준 싸이클 메타데이터 조회
  // ============================================================
  const { data: refCycleInfo } = useQuery<CycleMetadata>({
    queryKey: ['cycle-info', 'ref'],
    queryFn: () => getCycleInfo('ref'),
    // 응답 예시:
    // {
    //   cycleId: 'ref',
    //   startTime: '2024-01-01T11:00:00Z',
    //   endTime: '2024-01-01T11:20:00Z',
    //   facilityId: 'HNK10-020',
    //   duration: 1200
    // }
  });

  // ============================================================
  // 3. 비교1 싸이클 메타데이터 조회
  // ============================================================
  const { data: compare1CycleInfo } = useQuery<CycleMetadata>({
    queryKey: ['cycle-info', selectedCycle1],
    queryFn: () => getCycleInfo(selectedCycle1),
    enabled: !!selectedCycle1,
  });

  // ============================================================
  // 4. 비교2 싸이클 메타데이터 조회
  // ============================================================
  const { data: compare2CycleInfo } = useQuery<CycleMetadata>({
    queryKey: ['cycle-info', selectedCycle2],
    queryFn: () => getCycleInfo(selectedCycle2),
    enabled: !!selectedCycle2,
  });

  // ============================================================
  // 5. 기준 싸이클 파형 데이터 조회 (실제 시간 범위)
  // ============================================================
  const { data: refWaveData, isLoading: loadingRef } = useQuery({
    queryKey: [
      'cycle-wave-ref',
      refCycleInfo?.startTime,
      refCycleInfo?.endTime,
      currentInterval,
    ],
    queryFn: () =>
      fetchRangeData(
        refCycleInfo!.facilityId,
        refCycleInfo!.startTime,  // "2024-01-01T11:00:00Z"
        refCycleInfo!.endTime,    // "2024-01-01T11:20:00Z"
        currentInterval,          // "10s" or "1s"
        'power'
      ),
    enabled: !!refCycleInfo,
    // 응답 예시 (10s interval):
    // [
    //   { timestamp: "2024-01-01T11:00:00Z", value: 850 },
    //   { timestamp: "2024-01-01T11:00:10Z", value: 852 },
    //   ...
    // ]
  });

  // ============================================================
  // 6. 비교1 싸이클 파형 데이터 조회 (실제 시간 범위)
  // ============================================================
  const { data: compare1WaveData, isLoading: loading1 } = useQuery({
    queryKey: [
      'cycle-wave-compare1',
      compare1CycleInfo?.startTime,
      compare1CycleInfo?.endTime,
      currentInterval,
    ],
    queryFn: () =>
      fetchRangeData(
        compare1CycleInfo!.facilityId,
        compare1CycleInfo!.startTime,  // "2024-01-01T17:40:00Z"
        compare1CycleInfo!.endTime,    // "2024-01-01T18:10:00Z"
        currentInterval,
        'power'
      ),
    enabled: !!compare1CycleInfo && !!selectedCycle1,
  });

  // ============================================================
  // 7. 비교2 싸이클 파형 데이터 조회 (실제 시간 범위)
  // ============================================================
  const { data: compare2WaveData, isLoading: loading2 } = useQuery({
    queryKey: [
      'cycle-wave-compare2',
      compare2CycleInfo?.startTime,
      compare2CycleInfo?.endTime,
      currentInterval,
    ],
    queryFn: () =>
      fetchRangeData(
        compare2CycleInfo!.facilityId,
        compare2CycleInfo!.startTime,
        compare2CycleInfo!.endTime,
        currentInterval,
        'power'
      ),
    enabled: !!compare2CycleInfo && !!selectedCycle2,
  });

  // ============================================================
  // 8. 시간 정규화 (실제 timestamp → 상대 시간 0부터)
  // ============================================================
  const normalizedRef = useMemo<NormalizedPoint[]>(() => {
    if (!refWaveData || !refCycleInfo) return [];
    return normalizeToRelativeTime(refWaveData, refCycleInfo.startTime, currentInterval);
    // 결과 예시 (10s interval):
    // [
    //   { sec: 0, value: 850 },
    //   { sec: 10, value: 852 },
    //   ...
    // ]
  }, [refWaveData, refCycleInfo, currentInterval]);

  const normalizedCompare1 = useMemo<NormalizedPoint[]>(() => {
    if (!compare1WaveData || !compare1CycleInfo) return [];
    return normalizeToRelativeTime(compare1WaveData, compare1CycleInfo.startTime, currentInterval);
  }, [compare1WaveData, compare1CycleInfo, currentInterval]);

  const normalizedCompare2 = useMemo<NormalizedPoint[]>(() => {
    if (!compare2WaveData || !compare2CycleInfo) return [];
    return normalizeToRelativeTime(compare2WaveData, compare2CycleInfo.startTime, currentInterval);
  }, [compare2WaveData, compare2CycleInfo, currentInterval]);

  // ============================================================
  // 9. 오버레이 데이터 생성
  // ============================================================
  const overlayData = useMemo<OverlayPoint[]>(() => {
    return mergeOverlayData(normalizedRef, normalizedCompare1, normalizedCompare2);
    // 결과 예시:
    // [
    //   { sec: 0, refValue: 850, compare1Value: 920, compare2Value: 880 },
    //   { sec: 10, refValue: 852, compare1Value: 925, compare2Value: 882 },
    //   ...
    // ]
  }, [normalizedRef, normalizedCompare1, normalizedCompare2]);

  // ============================================================
  // 10. Zoom 핸들러: interval 자동 전환
  // ============================================================
  const handleZoomChange = useCallback(
    (zoomRatio: number) => {
      setIsZooming(true);

      const newInterval = getIntervalForZoomRatio(zoomRatio, currentInterval, initialInterval);

      if (newInterval !== currentInterval) {
        console.log(
          `[ANL-003] Interval 전환: ${formatInterval(currentInterval)} → ${formatInterval(newInterval)} (ratio: ${(zoomRatio * 100).toFixed(1)}%)`
        );
        setCurrentInterval(newInterval);
        // ⭐ interval 변경 → useQuery 재실행 → 각 시간 범위 다시 조회 → 정규화 → 오버레이
      }

      setTimeout(() => setIsZooming(false), 500);
    },
    [currentInterval, initialInterval]
  );

  // ============================================================
  // 11. TrendChart series 설정
  // ============================================================
  const series: TrendSeries[] = useMemo(
    () => [
      {
        key: 'refValue',
        label: '기준 파형',
        color: 'rgba(156,163,175,0.7)',
        type: 'line' as const,
        width: 1.5,
      },
      {
        key: 'compare1Value',
        label: `비교1 (${selectedCycle1})`,
        color: COLORS.energy.power,
        type: 'line' as const,
        width: 2,
      },
      {
        key: 'compare2Value',
        label: `비교2 (${selectedCycle2})`,
        color: COLORS.energy.air,
        type: 'line' as const,
        width: 2,
      },
    ],
    [selectedCycle1, selectedCycle2]
  );

  const isLoading = loadingRef || loading1 || loading2 || isZooming;

  // ============================================================
  // 12. 렌더링
  // ============================================================
  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="싸이클 분석"
        description={`싸이클 파형 오버레이 비교 | 해상도: ${formatInterval(currentInterval)}`}
      />

      <div className="flex gap-3 flex-1 min-h-0">
        {/* 싸이클 목록 (좌/우) - 생략 */}

        {/* 오버레이 차트 (중) */}
        <ChartCard
          title="싸이클 파형 오버레이"
          subtitle={`기준(회색) / 비교1(노란) / 비교2(파란) | 해상도: ${formatInterval(currentInterval)}`}
          className="flex-1"
        >
          {overlayData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              데이터 로딩 중...
            </div>
          ) : (
            <TrendChart
              data={overlayData}
              series={series}
              xKey="sec"  // ⭐ 상대 시간 (0부터)
              yLabel="kW"
              syncKey="anl003"
              showLegend={true}
              onZoomChange={handleZoomChange}  // ⭐ 확대 기능
              isLoading={isLoading}
              loadingMessage={`현재 해상도: ${formatInterval(currentInterval)}`}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
```

#### 단위 테스트 예시

```typescript
// ============================================================
// apps/web/src/lib/__tests__/cycle-utils.test.ts
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  intervalToSeconds,
  normalizeToRelativeTime,
  mergeOverlayData
} from '../cycle-utils';

describe('intervalToSeconds', () => {
  it('should convert interval to seconds', () => {
    expect(intervalToSeconds('15m')).toBe(900);
    expect(intervalToSeconds('1m')).toBe(60);
    expect(intervalToSeconds('10s')).toBe(10);
    expect(intervalToSeconds('1s')).toBe(1);
  });
});

describe('normalizeToRelativeTime', () => {
  it('should normalize timestamps to relative seconds (1s interval)', () => {
    const data = [
      { timestamp: '2024-01-01T11:00:00Z', value: 850 },
      { timestamp: '2024-01-01T11:00:01Z', value: 852 },
      { timestamp: '2024-01-01T11:00:02Z', value: 848 },
    ];

    const result = normalizeToRelativeTime(data, '2024-01-01T11:00:00Z', '1s');

    expect(result).toEqual([
      { sec: 0, value: 850 },
      { sec: 1, value: 852 },
      { sec: 2, value: 848 },
    ]);
  });

  it('should normalize timestamps to relative seconds (10s interval)', () => {
    const data = [
      { timestamp: '2024-01-01T11:00:00Z', value: 850 },
      { timestamp: '2024-01-01T11:00:10Z', value: 852 },
      { timestamp: '2024-01-01T11:00:20Z', value: 848 },
    ];

    const result = normalizeToRelativeTime(data, '2024-01-01T11:00:00Z', '10s');

    expect(result).toEqual([
      { sec: 0, value: 850 },
      { sec: 10, value: 852 },
      { sec: 20, value: 848 },
    ]);
  });

  it('should handle empty data', () => {
    const result = normalizeToRelativeTime([], '2024-01-01T11:00:00Z', '1s');
    expect(result).toEqual([]);
  });

  it('should handle undefined data', () => {
    const result = normalizeToRelativeTime(undefined as any, '2024-01-01T11:00:00Z', '1s');
    expect(result).toEqual([]);
  });
});

describe('mergeOverlayData', () => {
  it('should merge multiple series with same length', () => {
    const ref = [
      { sec: 0, value: 850 },
      { sec: 10, value: 852 },
    ];

    const compare1 = [
      { sec: 0, value: 920 },
      { sec: 10, value: 925 },
    ];

    const result = mergeOverlayData(ref, compare1);

    expect(result).toEqual([
      { sec: 0, refValue: 850, compare1Value: 920, compare2Value: undefined },
      { sec: 10, refValue: 852, compare1Value: 925, compare2Value: undefined },
    ]);
  });

  it('should merge multiple series with different lengths', () => {
    const ref = [
      { sec: 0, value: 850 },
      { sec: 10, value: 852 },
    ];

    const compare1 = [
      { sec: 0, value: 920 },
      { sec: 10, value: 925 },
      { sec: 20, value: 930 },
    ];

    const result = mergeOverlayData(ref, compare1);

    expect(result).toEqual([
      { sec: 0, refValue: 850, compare1Value: 920, compare2Value: undefined },
      { sec: 10, refValue: 852, compare1Value: 925, compare2Value: undefined },
      { sec: 20, refValue: undefined, compare1Value: 930, compare2Value: undefined },
    ]);
  });

  it('should handle empty arrays', () => {
    const result = mergeOverlayData([], [], []);
    expect(result).toEqual([]);
  });

  it('should handle undefined arrays', () => {
    const result = mergeOverlayData(undefined, undefined, undefined);
    expect(result).toEqual([]);
  });

  it('should merge three series correctly', () => {
    const ref = [{ sec: 0, value: 850 }];
    const compare1 = [{ sec: 0, value: 920 }];
    const compare2 = [{ sec: 0, value: 880 }];

    const result = mergeOverlayData(ref, compare1, compare2);

    expect(result).toEqual([
      { sec: 0, refValue: 850, compare1Value: 920, compare2Value: 880 },
    ]);
  });
});
```

**적용 화면**: ANL-003, ANL-004

**특수 케이스 (SET-003)**: 줌 비활성화
```typescript
// SET-003 기준 싸이클 파형 (maxDepth: 3, initialInterval: '1s', disableZoom: true)
const [currentInterval] = useState<Interval>('1s'); // 고정

const { data: refCycleInfo } = useQuery({
  queryKey: ['cycle-info', 'ref'],
  queryFn: () => getCycleInfo('ref'),
});

const { data: refWaveData } = useQuery({
  queryKey: ['ref-wave', refCycleInfo?.startTime, refCycleInfo?.endTime, '1s'],
  queryFn: () => fetchRangeData(
    refCycleInfo!.facilityId,
    refCycleInfo!.startTime,
    refCycleInfo!.endTime,
    '1s',
    'power'
  ),
  enabled: !!refCycleInfo,
});

const normalizedData = useMemo(() => {
  if (!refWaveData || !refCycleInfo) return [];
  return normalizeToRelativeTime(refWaveData, refCycleInfo.startTime, '1s');
}, [refWaveData, refCycleInfo]);

<TrendChart
  data={normalizedData}
  xKey="sec"
  onZoomChange={undefined}  // ⭐ Zoom 비활성화
  isLoading={false}
/>
```

### 9.3 화면별 maxDepth 적용 요약

| 화면 ID | maxDepth | initialInterval | 허용 Interval | 패턴 |
|---------|----------|----------------|--------------|------|
| MON-001 | 2 | 15m | 15m, 1m | 그룹 A |
| MON-002 | 3 | 15m | 15m, 1m, 10s, 1s | 그룹 A (✅ 완료) |
| DSH-001 | 1 | 15m | 15m | 그룹 A |
| DSH-002 | 2 | 15m | 15m, 1m | 그룹 A |
| ANL-001 | 2 | 15m | 15m, 1m | 그룹 A |
| ANL-002 | 3 | 15m | 15m, 1m, 10s | 그룹 A |
| ANL-003 | 3 | **10s** | **10s, 1s** | 그룹 B |
| ANL-004 | 3 | **10s** | **10s, 1s** | 그룹 B |
| ANL-005 | 2 | 15m | 15m, 1m | 그룹 A |
| ALT-004 | 1 | 15m | 15m | 그룹 A |
| ALT-006 | 2 | 15m | 15m, 10s | 그룹 A |
| SET-003 | 3 | **1s** | **1s** (고정) | 그룹 B (줌 비활성화) |

---

## 10. Implementation Guide

### 10.1 File Structure

```
apps/web/src/
├── pages/                          # 12개 화면
│   ├── monitoring/
│   │   ├── MON001Overview.tsx       ✅ 수정 대상 (그룹 A, maxDepth: 2)
│   │   └── MON002LineDetail.tsx     ✅ 완료 (기준 구현)
│   ├── dashboard/
│   │   ├── DSH001EnergyTrend.tsx    ✅ 수정 대상 (그룹 A, maxDepth: 1)
│   │   └── DSH002FacilityTrend.tsx  ✅ 수정 대상 (그룹 A, maxDepth: 2)
│   ├── analysis/
│   │   ├── ANL001Comparison.tsx     ✅ 수정 대상 (그룹 A, maxDepth: 2)
│   │   ├── ANL002DetailedComparison.tsx ✅ 수정 대상 (그룹 A, maxDepth: 3)
│   │   ├── ANL003CycleAnalysis.tsx  ✅ 수정 대상 (그룹 B, maxDepth: 3, init: 10s)
│   │   ├── ANL004CycleDelay.tsx     ✅ 수정 대상 (그룹 B, maxDepth: 3, init: 10s)
│   │   └── ANL005PowerQualityAnalysis.tsx ✅ 수정 대상 (그룹 A, maxDepth: 2)
│   ├── alert/
│   │   ├── ALT004PowerQualityHistory.tsx ✅ 수정 대상 (그룹 A, maxDepth: 1)
│   │   └── ALT006CycleAnomalyHistory.tsx ✅ 수정 대상 (그룹 A, maxDepth: 2)
│   └── settings/
│       └── SET003ReferenceCycle.tsx  ✅ 수정 대상 (그룹 B, maxDepth: 3, init: 1s, disableZoom)
├── hooks/
│   └── useDynamicResolution.ts      ✅ 재사용 (수정 불필요)
├── components/charts/
│   └── TrendChart.tsx               ✅ 재사용 (수정 불필요)
├── services/
│   ├── monitoring.ts                ✅ 재사용 (fetchRangeData 사용)
│   └── analysis.ts                  ✅ 수정 필요 (getCycleWaveformData interval 추가)
└── lib/
    ├── chart-utils.ts               ✅ 재사용 (수정 불필요)
    └── constants.ts                 ✅ 이미 완료 (SCREEN_MAX_DEPTH, SCREEN_INITIAL_INTERVAL)
```

### 10.2 Implementation Order (우선순위별)

#### Phase 1: Backend API interval 파라미터 추가 (1시간)

**그룹 B API 확장** (싸이클 파형 3개 화면):

1. **analysis.service.ts 수정** (Backend):
   ```typescript
   // apps/api/src/analysis/analysis.service.ts

   // 변경 전
   getCycleWaveform(cycleId: string, isReference = false) {
     // ... 360개 포인트 생성
   }

   // 변경 후
   getCycleWaveform(cycleId: string, isReference = false, interval: '10s' | '1s' = '10s') {
     const pointCount = interval === '1s' ? 3600 : 360;
     const step = interval === '1s' ? 0.1 : 1;

     return Array.from({ length: pointCount }, (_, i) => ({
       sec: i * step,
       value: this.calculateWaveformValue(cycleId, i * step, isReference),
     }));
   }
   ```

2. **analysis.controller.ts 수정** (Backend):
   ```typescript
   @Get('cycle/waveform')
   getCycleWaveform(
     @Query('cycleId') cycleId: string,
     @Query('isReference') isReference: boolean,
     @Query('interval') interval: '10s' | '1s' = '10s' // ⭐ 추가
   ) {
     return this.analysisService.getCycleWaveform(cycleId, isReference, interval);
   }
   ```

3. **analysis.ts 수정** (Frontend):
   ```typescript
   // apps/web/src/services/analysis.ts

   export async function getCycleWaveformData(
     cycleId: string,
     isReference = false,
     interval: '15m' | '1m' | '10s' | '1s' = '10s' // ⭐ 추가
   ) {
     if (USE_MOCK) return mockDelay(getCycleWaveform(cycleId, isReference, interval));
     return apiClient.get('/analysis/cycle/waveform', {
       params: { cycleId, isReference, interval } // ⭐ interval 추가
     }).then((r) => r.data);
   }
   ```

4. **Mock 데이터 수정** (Frontend):
   ```typescript
   // apps/web/src/services/mock/analysis.ts

   export function getCycleWaveform(
     cycleId: string,
     isReference = false,
     interval: '10s' | '1s' = '10s' // ⭐ 추가
   ) {
     const pointCount = interval === '1s' ? 3600 : 360; // ⭐
     const step = interval === '1s' ? 0.1 : 1; // ⭐
     const base = isReference ? 850 : (cycleId === 'c004' ? 1050 : 880);
     const variance = isReference ? 80 : (cycleId === 'c004' ? 220 : 90);

     return Array.from({ length: pointCount }, (_, i) => ({
       sec: i * step, // ⭐
       value: Math.max(0, base + Math.sin(i * 0.087) * variance * 0.8 + (Math.random() - 0.5) * variance * 0.4),
     }));
   }
   ```

#### Phase 2: 그룹 B 화면 우선 구현 (1.5시간)

**싸이클 파형 3개 화면 (Backend API 의존성 높음)**:

1. **ANL-003: 싸이클 분석** (maxDepth: 3, initialInterval: '10s')
   - ✅ 이미 완료 (ANL003CycleAnalysis.tsx 읽음)
   - 검증: 브라우저 콘솔 에러 0개, 1s 데이터 표시 확인

2. **ANL-004: 싸이클 타임 지연** (maxDepth: 3, initialInterval: '10s')
   - ANL-003 패턴 복사
   - 검증 완료 후 다음 진행

3. **SET-003: 기준 싸이클 파형** (maxDepth: 3, initialInterval: '1s', disableZoom: true)
   - onZoomChange={undefined} 추가
   - 줌 비활성화 확인

#### Phase 3: 그룹 A 화면 8개 구현 (3시간)

**MON-002 패턴 복사** (useDynamicResolution 훅):

**우선순위 1 (상세 분석, maxDepth: 3)**: 1시간
- ANL-002: 상세 비교 분석 (maxDepth: 3)
- MON-001: 종합 현황 (maxDepth: 2)

**우선순위 2 (기본 트렌드, maxDepth: 2)**: 1.5시간
- DSH-002: 설비별 추이 (maxDepth: 2)
- ANL-001: 비교 분석 (maxDepth: 2)
- ANL-005: 전력 품질 분석 (maxDepth: 2)
- ALT-006: 싸이클 이상 이력 (maxDepth: 2)

**우선순위 3 (단순 트렌드, maxDepth: 1)**: 0.5시간
- DSH-001: 에너지 사용 추이 (maxDepth: 1)
- ALT-004: 전력 품질 이력 (maxDepth: 1)

#### Phase 4: 브라우저 검증 (Mock 모드) (1시간)

- 12개 화면 모두 브라우저 콘솔 에러 0개 확인
- Chrome DevTools Performance 탭 60 FPS 확인
- Network 탭에서 interval 파라미터 정확히 전송 확인

#### Phase 5: Backend API 연동 (Real API 모드) (1.5시간)

- `VITE_USE_MOCK=false` 전환
- Backend API 서버 실행 (`pnpm dev:api`)
- PostgreSQL + TimescaleDB 연결 확인
- 12개 화면 모두 Real API 데이터 표시 확인
- 4개 interval (15m, 1m, 10s, 1s) 모두 DB 데이터 정상 확인

#### Phase 6: 최종 검증 및 Gap Analysis (1시간)

- TypeScript 컴파일 (`pnpm tsc --noEmit`)
- ESLint (`pnpm lint`)
- 브라우저 콘솔 최종 확인 (에러 0개, 경고 최소화)
- Gap Analysis 실행 (`/pdca analyze dynamic-resolution-전체적용`)

**총 예상 시간**: 9시간

---

## 11. 화면별 구현 체크리스트

### 11.1 그룹 A 공통 작업 (8개 화면)

각 화면마다 아래 체크리스트를 반복:

- [ ] **1. MON-002 코드 패턴 복사**
  ```typescript
  // useDynamicResolution 훅 호출
  const dynamicPowerResolution = useDynamicResolution({
    initialInterval: '15m', // SCREEN_INITIAL_INTERVAL[screenId] || '15m'
    startTime,
    endTime,
    facilityId,
    metric: 'power',
    enabled: true,
  });
  ```

- [ ] **2. maxDepth 설정**
  ```typescript
  // constants.ts 참조
  const maxDepth = SCREEN_MAX_DEPTH['MON-001']; // 1, 2, 3
  ```

- [ ] **3. TrendChart props 전달**
  ```typescript
  <TrendChart
    data={dynamicPowerResolution.data || []}
    series={powerSeries}
    xKey="time"  // ⭐ 그룹 A
    yLabel="kWh"
    onZoomChange={dynamicPowerResolution.handleZoom}  // ⭐ 필수
    isLoading={dynamicPowerResolution.isLoading}      // ⭐ 필수
    loadingMessage={`현재: ${formatInterval(dynamicPowerResolution.currentInterval)}`}
  />
  ```

- [ ] **4. TypeScript 컴파일** (`pnpm tsc --noEmit`)
- [ ] **5. 브라우저 실행** (`pnpm dev:web`)
- [ ] **6. Chrome DevTools Console 탭** (F12)
- [ ] **7. 해당 화면 접속**
- [ ] **8. 에러 빨간색 0개 확인**
- [ ] **9. 차트 줌 동작 확인**
- [ ] **10. Network 탭 interval 파라미터 확인**
- [ ] **11. ✅ 검증 통과 → 다음 화면 진행**

### 11.2 그룹 B 공통 작업 (3개 화면)

각 화면마다 아래 체크리스트를 반복:

- [ ] **1. ANL-003 코드 패턴 복사**
  ```typescript
  const initialInterval = (SCREEN_INITIAL_INTERVAL['ANL-003'] || '10s') as Interval;
  const [currentInterval, setCurrentInterval] = useState<Interval>(initialInterval);
  const [isZooming, setIsZooming] = useState(false);

  const { data: waveData, isLoading } = useQuery({
    queryKey: ['cycle-wave', cycleId, currentInterval],
    queryFn: () => getCycleWaveformData(cycleId, false, currentInterval), // ⭐ interval
  });

  const handleZoomChange = useCallback((zoomRatio: number) => {
    setIsZooming(true);
    const newInterval = getIntervalForZoomRatio(zoomRatio, currentInterval, initialInterval);
    if (newInterval !== currentInterval) {
      setCurrentInterval(newInterval);
    }
    setTimeout(() => setIsZooming(false), 500);
  }, [currentInterval, initialInterval]);
  ```

- [ ] **2. maxDepth 설정** (constants.ts 참조)

- [ ] **3. TrendChart props 전달**
  ```typescript
  <TrendChart
    data={waveData || []}
    series={series}
    xKey="sec"  // ⭐ 그룹 B
    yLabel="kW"
    onZoomChange={handleZoomChange}  // ⭐ 커스텀 핸들러
    isLoading={isLoading || isZooming}
    loadingMessage={`현재: ${formatInterval(currentInterval)}`}
  />
  ```

- [ ] **4~11. 그룹 A와 동일**

### 11.3 특수 케이스: SET-003 (줌 비활성화)

- [ ] **1. interval 고정**
  ```typescript
  const [currentInterval] = useState<Interval>('1s'); // 고정
  ```

- [ ] **2. onZoomChange={undefined}**
  ```typescript
  <TrendChart
    onZoomChange={undefined}  // ⭐ Zoom 비활성화
    isLoading={false}
  />
  ```

---

## 12. Browser Verification Checklist

### 12.1 Chrome DevTools 검증 항목

#### Console 탭
- [ ] 에러 (빨간색) 0개
- [ ] 경고 (노란색) 최소화
- [ ] Dynamic Resolution 로그 정상 (`[useDynamicResolution]` or `[ANL-003]`)

#### Network 탭
- [ ] **그룹 A**: `/api/monitoring/range/:facilityId/:type?interval={15m|1m|10s|1s}`
- [ ] **그룹 B**: `/api/analysis/cycle/waveform?cycleId=...&interval={10s|1s}`
- [ ] 응답 200 OK (4xx, 5xx 없음)
- [ ] interval 파라미터 정확히 전송
- [ ] 응답 시간 < 1초

#### Performance 탭
- [ ] 차트 렌더링 60 FPS 유지
- [ ] 메모리 누수 없음
- [ ] Zoom 이벤트 처리 < 500ms

#### React DevTools
- [ ] **그룹 A**: useDynamicResolution 훅 상태 정상
- [ ] **그룹 B**: currentInterval useState 정상
- [ ] TrendChart props 전달 정상

### 12.2 기능 검증

- [ ] **초기 로드**: initialInterval 데이터 표시
- [ ] **줌인**: interval 자동 전환
  - 그룹 A: 15m → 1m → 10s → 1s
  - 그룹 B: 10s → 1s
- [ ] **줌아웃**: interval 자동 복귀
- [ ] **maxDepth 제한**: 최대 Depth 초과 시 interval 고정
- [ ] **Loading 오버레이**: interval 전환 중 표시
- [ ] **에러 처리**: API 에러 시 alert 표시
- [ ] **캐싱**: SWR/useQuery 중복 요청 차단

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-28 | Initial design (Plan v0.1~v1.4 기반) | Claude |
| 2.0 | 2026-02-28 | **재작성**: 그룹 A/B 명확한 구분, Backend API 확장 명세 추가 | Claude |
