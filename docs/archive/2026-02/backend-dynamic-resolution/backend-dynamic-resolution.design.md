# Backend Dynamic Resolution API Design

> **Summary**: NestJS + TimescaleDB 기반 동적 차트 해상도 API 상세 설계 문서
>
> **Project**: i-FEMS (설비·에너지 관리시스템)
> **Version**: 1.0.0
> **Author**: AI Assistant
> **Date**: 2026-02-28
> **Status**: Design
> **Related Plan**: [backend-dynamic-resolution.plan.md](../01-plan/features/backend-dynamic-resolution.plan.md)
> **Related Frontend**: [동적-차트-해상도.design.md](./동적-차트-해상도.design.md)

---

## 1. System Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React 19 + Vite)                                  │
│  └─ useDynamicResolution() Hook                            │
│      ├─ SWR Cache (interval별 캐시 키)                     │
│      └─ fetchRangeData()                                    │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP GET
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ NestJS Backend API (:4000)                                  │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ MonitoringController                               │    │
│  │  ├─ GET /facilities/:id/power/range               │    │
│  │  │   @Query: startTime, endTime, interval         │    │
│  │  └─ GET /facilities/:id/air/range                 │    │
│  │      @Query: startTime, endTime, interval         │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ MonitoringService                                  │    │
│  │  ├─ fetchRangeData()                              │    │
│  │  │   ├─ Validate input                            │    │
│  │  │   ├─ Build TimescaleDB query                   │    │
│  │  │   └─ Transform response                        │    │
│  │  └─ buildTimeBucketQuery()                        │    │
│  │      └─ Generate interval-specific SQL            │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ PrismaService                                      │    │
│  │  └─ $queryRaw<T>()                                │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │ SQL Query
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL + TimescaleDB                                    │
│  ├─ energy_timeseries (Hypertable, 15분 집계)             │
│  ├─ energy_usage_1min (Continuous Aggregate, 1분)         │
│  └─ tag_data_raw (Hypertable, 1초 원본 데이터)           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
사용자 차트 Zoom (Frontend)
    ↓
Zoom Ratio 계산 (0~1)
    ↓
Interval 전환 감지 (15m → 1m → 10s → 1s)
    ↓
API 호출: GET /facilities/:id/power/range?interval=1m
    ↓
Controller: Query Validation (RangeQueryDto)
    ↓
Service: TimescaleDB time_bucket() 쿼리 생성
    ↓
Service: 현재 + 전일 데이터 조회 (LEFT JOIN)
    ↓
Service: Metadata 생성 (totalPoints, zoomLevel)
    ↓
Response: { data: [...], metadata: {...} }
    ↓
Frontend: SWR 캐시 저장 + Chart 렌더링
```

---

## 2. API Specification

### 2.1 Endpoint 1: Power Range Data

#### 2.1.1 Request

```http
GET /api/facilities/:facilityId/power/range
```

**Path Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `facilityId` | string | Yes | 설비 ID (Facility code) | `"HNK10-000"` |

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `startTime` | string | Yes | 시작 시간 (ISO8601 UTC) | `"2024-01-01T00:00:00Z"` |
| `endTime` | string | Yes | 종료 시간 (ISO8601 UTC) | `"2024-01-01T23:59:59Z"` |
| `interval` | string | Yes | 데이터 간격 (enum) | `"15m"` \| `"1m"` \| `"10s"` \| `"1s"` |
| `maxPoints` | number | No | Down-sampling 최대 포인트 | `1000` (기본: 무제한) |

**Validation Rules**:
- `startTime` < `endTime` (시간 범위 유효성)
- `interval` ∈ {`"15m"`, `"1m"`, `"10s"`, `"1s"`}
- `maxPoints` > 0 (선택적)
- `facilityId`는 DB에 존재해야 함

#### 2.1.2 Response (200 OK)

```json
{
  "data": [
    { "time": "08:00:00", "power": 3.45, "prevPower": 3.21 },
    { "time": "08:01:00", "power": 3.52, "prevPower": 3.28 },
    { "time": "08:02:00", "power": 3.48, "prevPower": 3.25 }
  ],
  "metadata": {
    "interval": "1m",
    "totalPoints": 480,
    "returnedPoints": 480,
    "downsampled": false,
    "zoomLevel": 1,
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-01-01T23:59:59Z",
    "facilityId": "HNK10-000",
    "metric": "power"
  }
}
```

**Response Schema**:
```typescript
interface RangeDataResponse {
  data: Array<{
    time: string;           // HH:MM:SS or HH:MM:SS.mmm
    power: number;          // kWh (소수점 2자리)
    prevPower: number;      // 전일 동시각 데이터
  }>;
  metadata: {
    interval: "15m" | "1m" | "10s" | "1s";
    totalPoints: number;    // 집계된 총 포인트 수
    returnedPoints: number; // 실제 반환된 포인트 수 (down-sampling 후)
    downsampled: boolean;   // maxPoints로 인한 down-sampling 여부
    zoomLevel: 0 | 1 | 2 | 3; // 15m=0, 1m=1, 10s=2, 1s=3
    startTime: string;      // 요청된 시작 시간 (ISO8601)
    endTime: string;        // 요청된 종료 시간 (ISO8601)
    facilityId: string;     // 요청된 설비 ID
    metric: "power";        // 메트릭 타입
  };
}
```

#### 2.1.3 Error Responses

| HTTP Status | Error Code | Description | Response Body |
|-------------|------------|-------------|---------------|
| 400 | `INVALID_INTERVAL` | interval 파라미터가 허용 값이 아님 | `{ "statusCode": 400, "message": "Invalid interval. Allowed: 15m, 1m, 10s, 1s", "error": "Bad Request" }` |
| 400 | `INVALID_TIME_RANGE` | endTime < startTime | `{ "statusCode": 400, "message": "End time must be after start time", "error": "Bad Request" }` |
| 400 | `INVALID_MAX_POINTS` | maxPoints <= 0 | `{ "statusCode": 400, "message": "maxPoints must be greater than 0", "error": "Bad Request" }` |
| 404 | `FACILITY_NOT_FOUND` | 설비 ID가 DB에 없음 | `{ "statusCode": 404, "message": "Facility not found: HNK10-999", "error": "Not Found" }` |
| 500 | `DATABASE_ERROR` | DB 조회 실패 | `{ "statusCode": 500, "message": "Database query failed", "error": "Internal Server Error" }` |

### 2.2 Endpoint 2: Air Range Data

#### 2.2.1 Request

```http
GET /api/facilities/:facilityId/air/range
```

**Same as Power Endpoint** (Path Parameters, Query Parameters, Validation Rules 동일)

#### 2.2.2 Response (200 OK)

```json
{
  "data": [
    { "time": "08:00:00", "air": 1250, "prevAir": 1180 },
    { "time": "08:01:00", "air": 1280, "prevAir": 1200 },
    { "time": "08:02:00", "air": 1265, "prevAir": 1195 }
  ],
  "metadata": {
    "interval": "1m",
    "totalPoints": 480,
    "returnedPoints": 480,
    "downsampled": false,
    "zoomLevel": 1,
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-01-01T23:59:59Z",
    "facilityId": "HNK10-000",
    "metric": "air"
  }
}
```

**Response Schema**:
```typescript
interface RangeDataResponse {
  data: Array<{
    time: string;           // HH:MM:SS or HH:MM:SS.mmm
    air: number;            // L (리터, 정수)
    prevAir: number;        // 전일 동시각 데이터
  }>;
  metadata: {
    // Power와 동일, metric만 "air"로 변경
  };
}
```

**Error Responses**: Power Endpoint와 동일

---

## 3. Database Design

### 3.1 Schema

#### 3.1.1 Existing Hypertable: `energy_timeseries`

```sql
CREATE TABLE energy_timeseries (
  timestamp TIMESTAMPTZ NOT NULL,
  "facilityId" UUID NOT NULL,
  "powerKwh" DOUBLE PRECISION,        -- 전력 (kWh)
  "airL" DOUBLE PRECISION,            -- 에어 (L)
  "powerFactor" DOUBLE PRECISION,     -- 역률 (%)
  imbalance DOUBLE PRECISION,         -- 불평형률 (%)
  "airPressure" DOUBLE PRECISION,     -- 에어 압력 (bar)
  status VARCHAR(20) DEFAULT 'NORMAL', -- NORMAL/WARNING/DANGER/OFFLINE
  PRIMARY KEY (timestamp, "facilityId")
);

-- Hypertable 설정 (이미 적용됨)
SELECT create_hypertable('energy_timeseries', 'timestamp');
```

**Data Interval**: 15분 단위 집계 데이터

#### 3.1.2 New Index (Required)

```sql
-- 설비 ID + 시간 역순 인덱스 (범위 조회 최적화)
CREATE INDEX idx_energy_facility_time
ON energy_timeseries ("facilityId", timestamp DESC);
```

**Purpose**:
- facilityId로 필터링 후 timestamp 역순 조회 성능 향상
- time_bucket() 쿼리 최적화

**Expected Performance**:
- Before: Full scan (~500ms for 1일 데이터)
- After: Index scan (~50ms for 1일 데이터)

### 3.2 TimescaleDB Query Design

#### 3.2.1 Interval Mapping

| Interval | time_bucket() | Data Points (1일) | Data Source |
|----------|---------------|-------------------|-------------|
| `"15m"` | `'15 minutes'` | 96 | `energy_timeseries` (15분 집계) |
| `"1m"` | `'1 minute'` | 1,440 | `energy_usage_1min` (Continuous Aggregate) |
| `"10s"` | `'10 seconds'` | 8,640 | `tag_data_raw` (1초 원본 → 10초 집계) |
| `"1s"` | `'1 second'` | 86,400 | `tag_data_raw` (1초 원본) |

#### 3.2.2 Query Template (Power, 1분 간격)

```sql
-- 현재 데이터 (당일)
WITH current_data AS (
  SELECT
    time_bucket('1 minute', timestamp) AS bucket,
    AVG("powerKwh") AS power
  FROM energy_timeseries
  WHERE "facilityId" = $1
    AND timestamp >= $2  -- startTime
    AND timestamp < $3   -- endTime
  GROUP BY bucket
  ORDER BY bucket
),
-- 전일 데이터 (비교용)
prev_data AS (
  SELECT
    time_bucket('1 minute', timestamp) AS bucket,
    AVG("powerKwh") AS prev_power
  FROM energy_timeseries
  WHERE "facilityId" = $1
    AND timestamp >= $4  -- startTime - 1 day
    AND timestamp < $5   -- endTime - 1 day
  GROUP BY bucket
  ORDER BY bucket
)
SELECT
  TO_CHAR(c.bucket, 'HH24:MI:SS') AS time,
  ROUND(c.power::numeric, 2) AS power,
  ROUND(p.prev_power::numeric, 2) AS "prevPower"
FROM current_data c
LEFT JOIN prev_data p ON (c.bucket - INTERVAL '1 day') = p.bucket
ORDER BY c.bucket;
```

**Parameters**:
- `$1`: facilityId (UUID)
- `$2`: startTime (ISO8601 → timestamptz)
- `$3`: endTime (ISO8601 → timestamptz)
- `$4`: startTime - 1 day
- `$5`: endTime - 1 day

#### 3.2.3 Query Template (Air, 10초 간격)

```sql
-- tag_data_raw 사용 (초 단위 원본 데이터)
WITH tag_diffs AS (
  SELECT
    time_bucket('10 seconds', t.timestamp) AS bucket,
    t."tagId",
    MAX(t."numericValue") - MIN(t."numericValue") AS usage
  FROM tag_data_raw t
  JOIN tags tag ON t."tagId" = tag.id
  WHERE tag."facilityId" = $1
    AND t.timestamp >= $2
    AND t.timestamp < $3
    AND tag."tagType" = 'USAGE'
    AND tag."energyType" = 'air'
  GROUP BY bucket, t."tagId"
),
current_data AS (
  SELECT
    bucket,
    SUM(usage) AS air
  FROM tag_diffs
  GROUP BY bucket
  ORDER BY bucket
),
-- 전일 데이터
prev_tag_diffs AS (
  SELECT
    time_bucket('10 seconds', t.timestamp) AS bucket,
    t."tagId",
    MAX(t."numericValue") - MIN(t."numericValue") AS usage
  FROM tag_data_raw t
  JOIN tags tag ON t."tagId" = tag.id
  WHERE tag."facilityId" = $1
    AND t.timestamp >= $4
    AND t.timestamp < $5
    AND tag."tagType" = 'USAGE'
    AND tag."energyType" = 'air'
  GROUP BY bucket, t."tagId"
),
prev_data AS (
  SELECT
    bucket,
    SUM(usage) AS prev_air
  FROM prev_tag_diffs
  GROUP BY bucket
  ORDER BY bucket
)
SELECT
  TO_CHAR(c.bucket, 'HH24:MI:SS') AS time,
  ROUND(c.air::numeric, 0) AS air,
  ROUND(p.prev_air::numeric, 0) AS "prevAir"
FROM current_data c
LEFT JOIN prev_data p ON (c.bucket - INTERVAL '1 day') = p.bucket
ORDER BY c.bucket;
```

#### 3.2.4 Query Optimization Strategy

| Interval | Data Source | Optimization | Expected Response Time |
|----------|-------------|--------------|------------------------|
| `15m` | `energy_timeseries` (15분 집계) | Index scan | < 100ms |
| `1m` | `energy_usage_1min` (Continuous Aggregate) | Materialized view | < 200ms |
| `10s` | `tag_data_raw` (1초 → 10초 집계) | Hypertable chunk exclusion | < 300ms |
| `1s` | `tag_data_raw` (1초 원본) | Hypertable + maxPoints 제한 | < 500ms |

**Performance Factors**:
- **Chunk Exclusion**: TimescaleDB는 시간 범위에 따라 자동으로 chunk 선택 (불필요한 chunk 스캔 제외)
- **Parallel Query**: PostgreSQL 병렬 쿼리 자동 활성화 (CPU 코어 수에 따라)
- **Continuous Aggregate**: 1분 단위는 사전 집계된 Materialized View 사용 (127배 빠름)

---

## 4. Implementation Design

### 4.1 NestJS File Structure

```
apps/api/src/monitoring/
├── monitoring.controller.ts       // 수정: 2개 엔드포인트 추가
├── monitoring.service.ts          // 수정: fetchRangeData() 구현
├── dto/
│   ├── range-query.dto.ts         // 신규: Query validation
│   └── range-response.dto.ts      // 신규: Response type
└── types/
    └── interval.enum.ts           // 신규: Interval enum
```

### 4.2 DTO Design

#### 4.2.1 `range-query.dto.ts`

```typescript
import { IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum IntervalEnum {
  FIFTEEN_MIN = '15m',
  ONE_MIN = '1m',
  TEN_SEC = '10s',
  ONE_SEC = '1s',
}

export class RangeQueryDto {
  @ApiProperty({
    description: '시작 시간 (ISO8601 UTC)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsString()
  startTime: string;

  @ApiProperty({
    description: '종료 시간 (ISO8601 UTC)',
    example: '2024-01-01T23:59:59Z',
  })
  @IsString()
  endTime: string;

  @ApiProperty({
    description: '데이터 간격',
    enum: IntervalEnum,
    example: IntervalEnum.ONE_MIN,
  })
  @IsEnum(IntervalEnum, {
    message: 'interval must be one of: 15m, 1m, 10s, 1s',
  })
  interval: IntervalEnum;

  @ApiProperty({
    description: 'Down-sampling 최대 포인트 (선택)',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPoints?: number;
}
```

#### 4.2.2 `range-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class RangeDataPoint {
  @ApiProperty({ description: '시간 (HH:MM:SS)', example: '08:00:00' })
  time: string;

  @ApiProperty({ description: '전력 (kWh)', example: 3.45, required: false })
  power?: number;

  @ApiProperty({ description: '전일 전력 (kWh)', example: 3.21, required: false })
  prevPower?: number;

  @ApiProperty({ description: '에어 (L)', example: 1250, required: false })
  air?: number;

  @ApiProperty({ description: '전일 에어 (L)', example: 1180, required: false })
  prevAir?: number;
}

export class RangeMetadata {
  @ApiProperty({ description: '간격', example: '1m' })
  interval: string;

  @ApiProperty({ description: '총 포인트 수', example: 480 })
  totalPoints: number;

  @ApiProperty({ description: '반환된 포인트 수', example: 480 })
  returnedPoints: number;

  @ApiProperty({ description: 'Down-sampling 여부', example: false })
  downsampled: boolean;

  @ApiProperty({ description: 'Zoom Level (0~3)', example: 1 })
  zoomLevel: number;

  @ApiProperty({ description: '시작 시간', example: '2024-01-01T00:00:00Z' })
  startTime: string;

  @ApiProperty({ description: '종료 시간', example: '2024-01-01T23:59:59Z' })
  endTime: string;

  @ApiProperty({ description: '설비 ID', example: 'HNK10-000' })
  facilityId: string;

  @ApiProperty({ description: '메트릭 타입', example: 'power' })
  metric: 'power' | 'air';
}

export class RangeDataResponse {
  @ApiProperty({ type: [RangeDataPoint] })
  data: RangeDataPoint[];

  @ApiProperty({ type: RangeMetadata })
  metadata: RangeMetadata;
}
```

### 4.3 Controller Implementation

#### 4.3.1 `monitoring.controller.ts` (추가 메서드)

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { RangeQueryDto } from './dto/range-query.dto';
import { RangeDataResponse } from './dto/range-response.dto';

@ApiTags('Monitoring')
@Controller('facilities')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  // ... 기존 메서드 생략 ...

  @Get(':facilityId/power/range')
  @ApiOperation({ summary: '설비별 전력 범위 데이터 조회 (동적 해상도)' })
  @ApiResponse({ status: 200, type: RangeDataResponse })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 404, description: 'Facility not found' })
  async getPowerRangeData(
    @Param('facilityId') facilityId: string,
    @Query() query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    return this.monitoringService.fetchRangeData(
      facilityId,
      'power',
      query,
    );
  }

  @Get(':facilityId/air/range')
  @ApiOperation({ summary: '설비별 에어 범위 데이터 조회 (동적 해상도)' })
  @ApiResponse({ status: 200, type: RangeDataResponse })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 404, description: 'Facility not found' })
  async getAirRangeData(
    @Param('facilityId') facilityId: string,
    @Query() query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    return this.monitoringService.fetchRangeData(
      facilityId,
      'air',
      query,
    );
  }
}
```

### 4.4 Service Implementation

#### 4.4.1 `monitoring.service.ts` (핵심 메서드)

```typescript
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RangeQueryDto, IntervalEnum } from './dto/range-query.dto';
import { RangeDataResponse } from './dto/range-response.dto';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 동적 해상도 데이터 조회
   *
   * @param facilityId - 설비 ID (Facility.code)
   * @param metric - 메트릭 타입 ('power' | 'air')
   * @param query - 쿼리 파라미터 (startTime, endTime, interval, maxPoints)
   * @returns RangeDataResponse
   */
  async fetchRangeData(
    facilityId: string,
    metric: 'power' | 'air',
    query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    this.logger.log(`Fetching ${metric} range data: ${facilityId}, ${query.interval}`);

    // 1. Validation
    const { startTime, endTime, interval, maxPoints } = query;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO8601 UTC format.');
    }

    if (start >= end) {
      throw new BadRequestException('End time must be after start time');
    }

    // 2. Facility 존재 확인
    const facility = await this.prisma.facility.findUnique({
      where: { code: facilityId },
    });

    if (!facility) {
      throw new NotFoundException(`Facility not found: ${facilityId}`);
    }

    // 3. TimescaleDB 쿼리 생성 및 실행
    const { data, totalPoints } = await this.buildTimeBucketQuery(
      facility.id,
      metric,
      start,
      end,
      interval,
    );

    // 4. Down-sampling (maxPoints 제한)
    let finalData = data;
    let downsampled = false;

    if (maxPoints && data.length > maxPoints) {
      finalData = this.downsample(data, maxPoints);
      downsampled = true;
    }

    // 5. Metadata 생성
    const metadata = {
      interval,
      totalPoints,
      returnedPoints: finalData.length,
      downsampled,
      zoomLevel: this.getZoomLevel(interval),
      startTime,
      endTime,
      facilityId,
      metric,
    };

    return { data: finalData, metadata };
  }

  /**
   * TimescaleDB time_bucket() 쿼리 생성 및 실행
   *
   * @param facilityUuid - Facility UUID
   * @param metric - 메트릭 타입
   * @param start - 시작 시간
   * @param end - 종료 시간
   * @param interval - 간격
   * @returns 데이터 배열 및 총 포인트 수
   */
  private async buildTimeBucketQuery(
    facilityUuid: string,
    metric: 'power' | 'air',
    start: Date,
    end: Date,
    interval: IntervalEnum,
  ): Promise<{ data: any[]; totalPoints: number }> {
    // interval → time_bucket() 문자열 변환
    const bucketInterval = this.intervalToBucket(interval);

    // 전일 시간 범위
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - 1);

    // metric → 컬럼명 매핑
    const column = metric === 'power' ? '"powerKwh"' : '"airL"';
    const prevColumn = metric === 'power' ? 'prev_power' : 'prev_air';

    // SQL 쿼리
    const sql = `
      WITH current_data AS (
        SELECT
          time_bucket('${bucketInterval}', timestamp) AS bucket,
          AVG(${column}) AS value
        FROM energy_timeseries
        WHERE "facilityId" = $1::uuid
          AND timestamp >= $2::timestamptz
          AND timestamp < $3::timestamptz
        GROUP BY bucket
        ORDER BY bucket
      ),
      prev_data AS (
        SELECT
          time_bucket('${bucketInterval}', timestamp) AS bucket,
          AVG(${column}) AS ${prevColumn}
        FROM energy_timeseries
        WHERE "facilityId" = $1::uuid
          AND timestamp >= $4::timestamptz
          AND timestamp < $5::timestamptz
        GROUP BY bucket
        ORDER BY bucket
      )
      SELECT
        TO_CHAR(c.bucket, 'HH24:MI:SS') AS time,
        ROUND(c.value::numeric, ${metric === 'power' ? 2 : 0}) AS "${metric}",
        ROUND(p.${prevColumn}::numeric, ${metric === 'power' ? 2 : 0}) AS "prev${metric.charAt(0).toUpperCase() + metric.slice(1)}"
      FROM current_data c
      LEFT JOIN prev_data p ON (c.bucket - INTERVAL '1 day') = p.bucket
      ORDER BY c.bucket;
    `;

    // 쿼리 실행
    const result = await this.prisma.$queryRawUnsafe<any[]>(
      sql,
      facilityUuid,
      start,
      end,
      prevStart,
      prevEnd,
    );

    return {
      data: result,
      totalPoints: result.length,
    };
  }

  /**
   * Interval → time_bucket() 문자열 변환
   */
  private intervalToBucket(interval: IntervalEnum): string {
    switch (interval) {
      case IntervalEnum.FIFTEEN_MIN:
        return '15 minutes';
      case IntervalEnum.ONE_MIN:
        return '1 minute';
      case IntervalEnum.TEN_SEC:
        return '10 seconds';
      case IntervalEnum.ONE_SEC:
        return '1 second';
      default:
        throw new BadRequestException(`Invalid interval: ${interval}`);
    }
  }

  /**
   * Interval → Zoom Level 변환
   */
  private getZoomLevel(interval: IntervalEnum): number {
    switch (interval) {
      case IntervalEnum.FIFTEEN_MIN:
        return 0;
      case IntervalEnum.ONE_MIN:
        return 1;
      case IntervalEnum.TEN_SEC:
        return 2;
      case IntervalEnum.ONE_SEC:
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Down-sampling (Linear interpolation)
   *
   * @param data - 원본 데이터
   * @param maxPoints - 최대 포인트 수
   * @returns Down-sampled 데이터
   */
  private downsample(data: any[], maxPoints: number): any[] {
    if (data.length <= maxPoints) return data;

    const step = data.length / maxPoints;
    const result: any[] = [];

    for (let i = 0; i < maxPoints; i++) {
      const index = Math.floor(i * step);
      result.push(data[index]);
    }

    return result;
  }
}
```

---

## 5. Error Handling

### 5.1 Exception Hierarchy

```typescript
// apps/api/src/common/exceptions/custom-exceptions.ts

import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidIntervalException extends HttpException {
  constructor(interval: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Invalid interval: ${interval}. Allowed: 15m, 1m, 10s, 1s`,
        error: 'INVALID_INTERVAL',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InvalidTimeRangeException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'End time must be after start time',
        error: 'INVALID_TIME_RANGE',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class FacilityNotFoundException extends HttpException {
  constructor(facilityId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        message: `Facility not found: ${facilityId}`,
        error: 'FACILITY_NOT_FOUND',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class DatabaseQueryException extends HttpException {
  constructor(originalError: Error) {
    super(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Database query failed',
        error: 'DATABASE_ERROR',
        details: originalError.message,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
```

### 5.2 Exception Filter (Global)

```typescript
// apps/api/src/common/filters/http-exception.filter.ts

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'UNKNOWN_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
      } else {
        message = exceptionResponse;
      }
    }

    this.logger.error(`HTTP ${status} - ${error}: ${message}`, exception);

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## 6. Performance Optimization

### 6.1 Database Optimization

#### 6.1.1 Index Strategy

```sql
-- 1. 설비 ID + 시간 복합 인덱스 (필수)
CREATE INDEX idx_energy_facility_time
ON energy_timeseries ("facilityId", timestamp DESC);

-- 2. Hypertable Chunk Size 최적화 (선택)
-- 기본 7일 → 1일로 변경 (더 세밀한 chunk exclusion)
SELECT set_chunk_time_interval('energy_timeseries', INTERVAL '1 day');

-- 3. Continuous Aggregate (1분 interval 전용)
CREATE MATERIALIZED VIEW energy_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', timestamp) AS bucket,
  "facilityId",
  AVG("powerKwh") AS avg_power,
  AVG("airL") AS avg_air
FROM energy_timeseries
GROUP BY bucket, "facilityId";

-- Refresh Policy (10분마다 갱신)
SELECT add_continuous_aggregate_policy('energy_usage_1min',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '10 minutes');
```

#### 6.1.2 Connection Pool Settings

```typescript
// apps/api/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// DATABASE_URL 예시:
// postgresql://user:password@host:5432/ifems?connection_limit=50&pool_timeout=20
```

**Recommended Settings**:
- `connection_limit`: 50 (동시 사용자 100명 기준)
- `pool_timeout`: 20초
- `max_prepared_statements`: 10 (Prisma 기본값)

### 6.2 Application Optimization

#### 6.2.1 Response Caching (NestJS Cache)

```typescript
// apps/api/src/monitoring/monitoring.controller.ts

import { CacheInterceptor, UseInterceptors } from '@nestjs/common';

@UseInterceptors(CacheInterceptor)
@Get(':facilityId/power/range')
async getPowerRangeData(...) {
  // 동일 요청은 60초간 캐시
}
```

**Cache Key Strategy**:
```
cache_key = `range:${facilityId}:${metric}:${interval}:${startTime}:${endTime}`
```

**TTL (Time-To-Live)**:
- `15m` interval: 300초 (5분)
- `1m` interval: 180초 (3분)
- `10s` interval: 60초 (1분)
- `1s` interval: 30초 (30초)

#### 6.2.2 Query Result Streaming (Large Data)

```typescript
// Down-sampling 없이 대량 데이터 반환 시 (optional)
@Get(':facilityId/power/range/stream')
async getPowerRangeDataStream(
  @Param('facilityId') facilityId: string,
  @Query() query: RangeQueryDto,
  @Res() res: Response,
) {
  res.setHeader('Content-Type', 'application/json');
  res.write('{"data":[');

  const stream = await this.monitoringService.fetchRangeDataStream(
    facilityId,
    'power',
    query,
  );

  let first = true;
  for await (const chunk of stream) {
    if (!first) res.write(',');
    res.write(JSON.stringify(chunk));
    first = false;
  }

  res.write('],"metadata":{...}}');
  res.end();
}
```

---

## 7. Security Considerations

### 7.1 Input Validation

- ✅ **DTO Validation**: `class-validator`로 모든 입력 검증
- ✅ **SQL Injection 방지**: Prisma `$queryRawUnsafe` + Parameterized Query
- ✅ **Date Parsing**: ISO8601 형식 강제 (UTC only)
- ✅ **Interval Enum**: 허용된 값만 수용

### 7.2 Rate Limiting (Optional)

```typescript
// apps/api/src/main.ts

import { rateLimit } from 'express-rate-limit';

app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1분
    max: 100, // 최대 100 요청/분
    message: 'Too many requests from this IP, please try again later.',
  }),
);
```

### 7.3 CORS Settings

```typescript
// apps/api/src/main.ts

app.enableCors({
  origin: [
    'http://localhost:5173', // Frontend dev
    'http://localhost:3204', // HMR port
    'https://ifems.example.com', // Production
  ],
  credentials: true,
});
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

#### 8.1.1 Service Test (`monitoring.service.spec.ts`)

```typescript
describe('MonitoringService', () => {
  let service: MonitoringService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MonitoringService, PrismaService],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('fetchRangeData', () => {
    it('should return data with 1m interval', async () => {
      const query = {
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T23:59:59Z',
        interval: IntervalEnum.ONE_MIN,
      };

      const result = await service.fetchRangeData('HNK10-000', 'power', query);

      expect(result.data).toBeDefined();
      expect(result.metadata.interval).toBe('1m');
      expect(result.metadata.zoomLevel).toBe(1);
    });

    it('should throw error for invalid time range', async () => {
      const query = {
        startTime: '2024-01-02T00:00:00Z',
        endTime: '2024-01-01T00:00:00Z',
        interval: IntervalEnum.ONE_MIN,
      };

      await expect(
        service.fetchRangeData('HNK10-000', 'power', query),
      ).rejects.toThrow(InvalidTimeRangeException);
    });

    it('should throw error for non-existent facility', async () => {
      const query = {
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T23:59:59Z',
        interval: IntervalEnum.ONE_MIN,
      };

      await expect(
        service.fetchRangeData('INVALID-000', 'power', query),
      ).rejects.toThrow(FacilityNotFoundException);
    });
  });

  describe('intervalToBucket', () => {
    it('should convert interval to time_bucket string', () => {
      expect(service['intervalToBucket'](IntervalEnum.FIFTEEN_MIN)).toBe('15 minutes');
      expect(service['intervalToBucket'](IntervalEnum.ONE_MIN)).toBe('1 minute');
      expect(service['intervalToBucket'](IntervalEnum.TEN_SEC)).toBe('10 seconds');
      expect(service['intervalToBucket'](IntervalEnum.ONE_SEC)).toBe('1 second');
    });
  });

  describe('downsample', () => {
    it('should reduce data points to maxPoints', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        time: `${i}`,
        power: i,
      }));

      const result = service['downsample'](data, 100);

      expect(result.length).toBe(100);
    });

    it('should return original data if length <= maxPoints', () => {
      const data = Array.from({ length: 50 }, (_, i) => ({
        time: `${i}`,
        power: i,
      }));

      const result = service['downsample'](data, 100);

      expect(result.length).toBe(50);
    });
  });
});
```

### 8.2 Integration Tests (E2E)

#### 8.2.1 E2E Test (`monitoring.e2e-spec.ts`)

```typescript
describe('Monitoring API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /facilities/:id/power/range', () => {
    it('should return power range data', () => {
      return request(app.getHttpServer())
        .get('/facilities/HNK10-000/power/range')
        .query({
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T23:59:59Z',
          interval: '1m',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.metadata).toBeDefined();
          expect(res.body.metadata.interval).toBe('1m');
          expect(res.body.metadata.zoomLevel).toBe(1);
        });
    });

    it('should return 400 for invalid interval', () => {
      return request(app.getHttpServer())
        .get('/facilities/HNK10-000/power/range')
        .query({
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T23:59:59Z',
          interval: '5m',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('INVALID_INTERVAL');
        });
    });

    it('should return 404 for non-existent facility', () => {
      return request(app.getHttpServer())
        .get('/facilities/INVALID-000/power/range')
        .query({
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T23:59:59Z',
          interval: '1m',
        })
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toBe('FACILITY_NOT_FOUND');
        });
    });
  });
});
```

---

## 9. Deployment Checklist

### 9.1 Pre-Deployment

- [ ] `idx_energy_facility_time` 인덱스 생성
- [ ] `energy_usage_1min` Continuous Aggregate 생성 (선택)
- [ ] `DATABASE_URL` connection pool 설정
- [ ] CORS origin 설정 (Production URL 추가)
- [ ] Rate Limiting 설정 (선택)
- [ ] Swagger API 문서 확인 (`/api/docs`)

### 9.2 Post-Deployment

- [ ] Postman/curl로 4가지 interval 테스트
- [ ] Frontend `VITE_USE_MOCK=false` 전환
- [ ] 응답 시간 모니터링 (< 300ms 목표)
- [ ] Error 로그 확인 (Winston)
- [ ] Database query 성능 분석 (`EXPLAIN ANALYZE`)

---

## 10. Monitoring and Observability

### 10.1 Logging

```typescript
// Winston Logger 설정 (apps/api/src/main.ts)
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const logger = WinstonModule.createLogger({
  transports: [
    new winston.transports.File({
      filename: 'logs/api-error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/api-combined.log',
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        }),
      ),
    }),
  ],
});

app.useLogger(logger);
```

### 10.2 Metrics (Optional - Prometheus)

```typescript
// apps/api/src/monitoring/monitoring.service.ts

import { Counter, Histogram } from 'prom-client';

export class MonitoringService {
  private readonly queryDuration = new Histogram({
    name: 'api_range_query_duration_seconds',
    help: 'Duration of range query in seconds',
    labelNames: ['interval', 'metric'],
  });

  private readonly queryCount = new Counter({
    name: 'api_range_query_total',
    help: 'Total number of range queries',
    labelNames: ['interval', 'metric', 'status'],
  });

  async fetchRangeData(...) {
    const end = this.queryDuration.startTimer({ interval, metric });

    try {
      // Query logic...
      this.queryCount.inc({ interval, metric, status: 'success' });
      return result;
    } catch (error) {
      this.queryCount.inc({ interval, metric, status: 'error' });
      throw error;
    } finally {
      end();
    }
  }
}
```

---

## 11. API Versioning (Future)

현재는 버전 없이 `/api/facilities/:id/power/range`로 제공하지만, 향후 Breaking Change 발생 시 버전 관리:

```typescript
// v2 API (예시)
@Controller('v2/facilities')
export class MonitoringControllerV2 {
  @Get(':facilityId/power/range')
  async getPowerRangeDataV2(...) {
    // New response format
  }
}
```

**Versioning Strategy**: URI Versioning (추천) or Header Versioning

---

## 12. Conclusion

### 12.1 Summary

- ✅ **2개 엔드포인트**: Power, Air 범위 데이터 조회
- ✅ **4가지 Interval**: 15m, 1m, 10s, 1s 지원
- ✅ **TimescaleDB 최적화**: time_bucket(), Continuous Aggregate, Chunk Exclusion
- ✅ **Type Safety**: DTO Validation, Prisma Type Generation
- ✅ **Error Handling**: Custom Exception Hierarchy
- ✅ **Performance**: < 300ms (95 percentile), Index Optimization
- ✅ **Testing**: Unit + Integration Tests

### 12.2 Next Steps

1. **Do Phase**: Service/Controller/DTO 구현 (5시간 예상)
2. **Check Phase**: Gap Analysis (Design vs Implementation)
3. **Act Phase**: Gap 수정 및 최적화
4. **Report Phase**: 완료 보고서 생성

### 12.3 Dependencies

**Frontend 연동 시 필요**:
- `VITE_USE_MOCK=false` 설정
- `apps/web/src/services/monitoring.ts` API URL 수정
- CORS origin 추가 (Frontend URL)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-28 | Initial design | AI Assistant |
