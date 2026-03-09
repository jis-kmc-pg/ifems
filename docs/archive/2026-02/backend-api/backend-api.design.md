# Backend API 상세 설계 (Design)

> i-FEMS Backend API Detailed Design Document
> Feature: backend-api
> 작성일: 2026-02-25
> 담당: Claude Code
> Plan: [backend-api.plan.md](../../01-plan/features/backend-api.plan.md)

---

## 목차 (Table of Contents)

1. [시스템 아키텍처](#1-시스템-아키텍처)
2. [데이터베이스 설계](#2-데이터베이스-설계)
3. [API 상세 스펙](#3-api-상세-스펙)
4. [DTO 정의](#4-dto-정의)
5. [서비스 레이어 설계](#5-서비스-레이어-설계)
6. [TimescaleDB 설정](#6-timescaledb-설정)
7. [에러 처리](#7-에러-처리)
8. [파일 구조](#8-파일-구조)
9. [구현 체크리스트](#9-구현-체크리스트)

---

## 1. 시스템 아키텍처

### 1.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                      │
│  MON(6) + DSH(8) + ALT(6) + ANL(5) + SET(6) + Login(1)     │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST (Port 3200 → 4000)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (NestJS 11)                    │
│  ┌─────────────┬──────────────┬─────────┬─────────────┐    │
│  │ Monitoring  │  Dashboard   │ Alerts  │  Analysis   │    │
│  │   Module    │    Module    │ Module  │   Module    │    │
│  └──────┬──────┴──────┬───────┴────┬────┴──────┬──────┘    │
│         │             │            │           │            │
│         └─────────────┴────────────┴───────────┘            │
│                       ↓                                      │
│              ┌────────────────┐                             │
│              │ Prisma Service │                             │
│              └────────┬───────┘                             │
└───────────────────────┼─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│         PostgreSQL 16 + TimescaleDB 2.x (Port 5432)         │
│  ┌──────────────────┬─────────────────┬──────────────────┐ │
│  │   Master Tables  │  Timeseries     │  Alert/Cycle     │ │
│  │  (Factory, Line, │  (TagDataRaw,   │  (Alert,         │ │
│  │   Facility, Tag) │  EnergyTimeseries)│  CycleData)    │ │
│  └──────────────────┴─────────────────┴──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                        ↑
                        │ Mock Data (Development)
            ┌───────────┴──────────┐
            │  TagDataCollector    │
            │  (1초 주기 생성)      │
            └──────────────────────┘
```

### 1.2 모듈 의존성

```
AppModule
├── MonitoringModule
│   ├── MonitoringController
│   ├── MonitoringService
│   └── PrismaService (Shared)
├── DashboardModule
│   ├── DashboardController
│   ├── DashboardService
│   └── PrismaService
├── AlertsModule
│   ├── AlertsController
│   ├── AlertsService
│   └── PrismaService
├── AnalysisModule
│   ├── AnalysisController
│   ├── AnalysisService
│   └── PrismaService
├── SettingsModule (기존)
│   └── ... (Tag Management)
└── DataCollectionModule (신규)
    ├── TagDataCollectorService
    ├── EnergyAggregatorService
    └── PrismaService
```

### 1.3 레이어 구조

```
┌──────────────────────────────────────────────┐
│         Controller Layer (REST API)           │
│  - Request Validation (class-validator)      │
│  - Swagger Documentation (@ApiTags)          │
│  - Error Handling (try-catch)                │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│          Service Layer (Business Logic)       │
│  - Data Aggregation (sum, avg, min, max)    │
│  - Ranking Calculation                        │
│  - Time Range Filtering                       │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│       Repository Layer (Prisma ORM)           │
│  - Database Queries (findMany, aggregate)    │
│  - TimescaleDB Functions (time_bucket)       │
│  - Transaction Management                     │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│      PostgreSQL + TimescaleDB (Database)      │
└──────────────────────────────────────────────┘
```

---

## 2. 데이터베이스 설계

### 2.1 추가 모델 (Prisma Schema)

```prisma
// ============================================================
// 4. 알림 시스템 (Alerts)
// ============================================================

enum AlertSeverity {
  NORMAL
  WARNING
  DANGER
}

enum AlertType {
  POWER_QUALITY    // 전력 품질 (불평형률, 역률)
  AIR_LEAK         // 에어 누기
  CYCLE_ANOMALY    // 싸이클 이상
  ENERGY_SPIKE     // 에너지 급증
  THRESHOLD        // 임계값 초과
}

model Alert {
  id             String        @id @default(uuid())
  facilityId     String
  facility       Facility      @relation(fields: [facilityId], references: [id], onDelete: Cascade)

  severity       AlertSeverity
  type           AlertType
  message        String        @db.Text

  // 측정값
  value          Float?
  threshold      Float?
  unit           String?       // kWh, %, m³

  // 상세 데이터 (JSON)
  metadata       Json?         // { imbalance: 5.2, powerFactor: 0.85, ... }

  // 조치사항
  actionTaken    String?       @db.Text
  actionTakenBy  String?       @db.VarChar(100)
  actionTakenAt  DateTime?

  // 확인 처리
  acknowledgedBy String?       @db.VarChar(100)
  acknowledgedAt DateTime?

  // 타임스탬프
  detectedAt     DateTime      @default(now())
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([facilityId, detectedAt])
  @@index([severity, type])
  @@index([detectedAt])
  @@map("alerts")
}

// ============================================================
// 5. 싸이클 분석 (Cycle Analysis)
// ============================================================

enum CycleStatus {
  NORMAL
  DELAYED
  ANOMALY
  INCOMPLETE
}

// 싸이클 데이터
model CycleData {
  id           String       @id @default(uuid())
  facilityId   String
  facility     Facility     @relation(fields: [facilityId], references: [id], onDelete: Cascade)

  cycleNumber  Int          // 싸이클 번호 (1, 2, 3, ...)
  startTime    DateTime
  endTime      DateTime?
  duration     Float?       // 초 (실제 소요 시간)

  // 파형 데이터 (JSON Array)
  waveform     Json         // [{sec: 0.0, power: 12.5}, {sec: 0.1, power: 13.2}, ...]

  // 통계
  peakPower    Float?       // kW (최대 전력)
  avgPower     Float?       // kW (평균 전력)
  totalEnergy  Float?       // kWh (총 에너지)

  // 상태
  status       CycleStatus  @default(NORMAL)
  delay        Float?       // 지연 시간 (초, 기준 대비)

  // 메타데이터
  metadata     Json?        // { temp: 85.3, pressure: 6.5, ... }

  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([facilityId, startTime])
  @@index([cycleNumber])
  @@index([status])
  @@map("cycle_data")
}

// 기준 싸이클 (Reference Cycle)
model ReferenceCycle {
  id           String       @id @default(uuid())
  facilityId   String       @unique
  facility     Facility     @relation(fields: [facilityId], references: [id], onDelete: Cascade)

  // 기준 파형 데이터
  waveform     Json         // [{sec: 0.0, power: 12.5}, ...]
  duration     Float        // 기준 소요 시간 (초)

  // 메타데이터
  description  String?      @db.Text
  uploadedBy   String?      @db.VarChar(100)
  uploadedAt   DateTime     @default(now())

  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@map("reference_cycles")
}

// ============================================================
// 6. Facility 모델 확장 (Relations 추가)
// ============================================================

// 기존 Facility 모델에 Relations 추가
model Facility {
  // ... 기존 필드 생략 ...

  // Relations (추가)
  alerts           Alert[]
  cycles           CycleData[]
  referenceCycle   ReferenceCycle?
}
```

### 2.2 TimescaleDB Hypertable 설정

```sql
-- 1. TagDataRaw 하이퍼테이블 생성
SELECT create_hypertable(
  'tag_data_raw',
  'timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- 2. EnergyTimeseries 하이퍼테이블 생성
SELECT create_hypertable(
  'energy_timeseries',
  'timestamp',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- 3. Retention Policy 설정
-- TagDataRaw: 3개월 보관
SELECT add_retention_policy(
  'tag_data_raw',
  INTERVAL '3 months',
  if_not_exists => TRUE
);

-- EnergyTimeseries: 2년 보관
SELECT add_retention_policy(
  'energy_timeseries',
  INTERVAL '2 years',
  if_not_exists => TRUE
);

-- 4. Continuous Aggregate (15분 집계 뷰)
CREATE MATERIALIZED VIEW energy_15min_agg
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', timestamp) AS bucket,
  "facilityId",
  AVG("numericValue") AS avg_value,
  MAX("numericValue") AS max_value,
  MIN("numericValue") AS min_value,
  COUNT(*) AS sample_count
FROM tag_data_raw
WHERE "numericValue" IS NOT NULL
GROUP BY bucket, "facilityId"
WITH NO DATA;

-- Refresh Policy 설정 (5분마다 갱신)
SELECT add_continuous_aggregate_policy(
  'energy_15min_agg',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes'
);

-- 5. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_tag_data_raw_tag_time
  ON tag_data_raw ("tagId", timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_energy_ts_facility_time
  ON energy_timeseries ("facilityId", timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_facility_detected
  ON alerts ("facilityId", "detectedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_cycle_facility_start
  ON cycle_data ("facilityId", "startTime" DESC);
```

### 2.3 ER Diagram (주요 관계)

```
Factory (1) ──< (N) Line (1) ──< (N) Facility (1) ──< (N) Tag
                                      │
                                      ├──< (N) Alert
                                      ├──< (N) CycleData
                                      ├──< (1) ReferenceCycle
                                      └──< (N) EnergyTimeseries

Tag (1) ──< (N) TagDataRaw
```

---

## 3. API 상세 스펙

> 이 섹션은 실제 구현된 77개 API의 상세 스펙을 문서화합니다. (2026-02-28 업데이트)

### 3.1 Monitoring API (11개)

#### 3.1.1 GET `/api/monitoring/overview/kpi`

**설명**: 종합 현황 KPI (MON-001)

**Query Parameters**: 없음

**Response**:
```typescript
{
  totalPower: {
    value: number;           // kWh (소수점 2자리)
    unit: "kWh";
    change: number;          // 전일 대비 변화율 (%)
    inverseChange: true;     // 감소가 좋음
  },
  totalAir: {
    value: number;           // ML (L에서 변환, 소수점 2자리)
    unit: "ML";
    change: number;
    inverseChange: true;
  },
  powerQualityAlarms: {
    value: number;           // 건수
    unit: "건";
    change: number;
    inverseChange: true;
  },
  airLeakAlarms: {
    value: number;
    unit: "건";
    change: number;
    inverseChange: true;
  }
}
```

**비즈니스 로직**:
- 금일 자정부터 현재까지 집계
- 전일 동일 시간대 데이터와 비교하여 변화율 계산
- WARNING, DANGER 상태만 알람으로 집계

---

#### 3.1.2 GET `/api/monitoring/overview/lines`

**설명**: 라인 미니 카드 (MON-001)

**Query Parameters**: 없음

**Response**:
```typescript
[
  {
    id: string;              // "block", "head", "crank", "assemble"
    label: string;           // "블록", "헤드", ...
    power: number;           // MWh (kWh에서 변환, 소수점 2자리)
    powerUnit: "MWh";
    air: number;             // ML (L에서 변환, 소수점 2자리)
    airUnit: "ML";
    powerStatus: "NORMAL" | "WARNING" | "DANGER";
    airStatus: "NORMAL" | "WARNING" | "DANGER";
  }
]
```

**비즈니스 로직**:
- 라인별 설비 집계 (JOIN facilities + lines + energy_timeseries)
- DANGER 설비 1개 이상 → DANGER
- WARNING 설비 1개 이상 → WARNING
- 그 외 → NORMAL

---

#### 3.1.3 GET `/api/monitoring/overview/hourly`

**설명**: 시간별 트렌드 (MON-001)

**Query Parameters**:
```typescript
{
  date?: string;             // YYYY-MM-DD (기본: 오늘)
}
```

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
[
  {
    time: string;            // "00:00", "01:00", ...
    current: number;         // 당일 전력 (kWh)
    prev: number;            // 전일 전력
  }
]
```

**비즈니스 로직**:
- 24시간 시간대별 전력 사용량 집계
- 전일 동일 시각 데이터와 비교
- 시간별로 정렬된 배열 반환 (0시~23시)

---

#### 3.1.4 GET `/api/monitoring/overview/alarms`

**설명**: 알람 요약 (MON-001)

**Query Parameters**: 없음

**Response**: <!-- (v5.2 - PARTIAL 해결: line 필드는 한글명) -->
```typescript
[
  {
    line: string;              // 라인명 (한글): "블록", "헤드", "크랭크", "조립"
    powerQuality: number;      // 전력 품질 알림 건수
    airLeak: number;           // 에어 누기 알림 건수
    total: number;             // 총 알림 건수
  }
]
```

**비즈니스 로직**:
- 라인별로 알림 건수를 집계
- powerQuality: power_quality 카테고리 알림 수
- airLeak: air_leak 카테고리 알림 수
- total: powerQuality + airLeak

---

#### 3.1.5 GET `/api/monitoring/line/:line`

**설명**: 라인별 상세 차트 (MON-002)

**Path Parameters**:
- `line`: "block" | "head" | "crank" | "assemble"

**Query Parameters**:
```typescript
{
  date?: string;             // YYYY-MM-DD (기본: 오늘)
  interval?: number;         // 데이터 간격(초) (기본: 900 = 15분)
}
```

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
{
  power: [
    {
      time: string;          // "00:00", "00:15", ...
      current: number;       // 당일 전력
      prev: number;          // 전일 전력
    }
  ],
  air: [
    {
      time: string;
      current: number;       // 당일 에어
      prev: number;          // 전일 에어
    }
  ]
}
```

**비즈니스 로직**:
- 지정된 라인의 전력 및 에어 사용량을 시간별로 집계
- interval 파라미터에 따라 데이터 간격 조정 (기본 15분)
- 전일 동일 시각 데이터와 비교

---

#### 3.1.6 GET `/api/monitoring/energy-ranking`

**설명**: 에너지 순위 (MON-003)

**Query Parameters**: <!-- (v5.3 - Parameter 통일성: power → elec) -->
```typescript
{
  line: string;              // 필수 (예: "block")
  type: "elec" | "air";      // 필수
}
```

**Response**: <!-- (v5.2 - PARTIAL 해결: 실제 구현 필드 정확히 반영) -->
```typescript
[
  {
    facilityId: string;
    code: string;            // "HNK10-000"
    name: string;
    process: string;         // "OP00", "OP10", ...
    status: string;          // "ONLINE", "OFFLINE", "MAINTENANCE"
    isProcessing: boolean;   // 가공 설비 여부
    dailyElec: number;       // 금일 전력 사용량
    weeklyElec: number;      // 주간 전력 사용량
    prevDailyElec: number;   // 전일 전력 사용량
    dailyAir: number;        // 금일 에어 사용량
    weeklyAir: number;       // 주간 에어 사용량
    prevDailyAir: number;    // 전일 에어 사용량
    rankElec: number;        // 전력 순위 (금일 기준)
    rankAir: number;         // 에어 순위 (금일 기준)
    rankChangeElec: number;  // 전력 순위 변동 (전일 대비)
    rankChangeAir: number;   // 에어 순위 변동 (전일 대비)
  }
]
```

**비즈니스 로직**:
- 지정된 라인의 모든 설비에 대해 에너지 사용량 집계
- 금일/주간, 전일/전주 데이터를 모두 포함
- 각 메트릭별 순위 정보 포함

---

#### 3.1.7 GET `/api/monitoring/energy-alert`

**설명**: 에너지 알림 현황 (MON-004)

**Query Parameters**:
```typescript
{
  line: string;              // 필수
}
```

**Response**: <!-- (v5.2 - PARTIAL 해결: 불필요 필드 제거) -->
```typescript
[
  {
    facilityId: string;
    code: string;
    name: string;
    process: string;               // "OP00", "OP10", ...
    prevMonthChangeElec: number;   // 전월 대비 전력 증감율 (%)
    prevYearChangeElec: number;    // 전년 대비 전력 증감율 (%)
    prevMonthChangeAir: number;    // 전월 대비 에어 증감율 (%)
    prevYearChangeAir: number;     // 전년 대비 에어 증감율 (%)
    elecStatus: string;            // "NORMAL", "WARNING", "DANGER"
    airStatus: string;             // "NORMAL", "WARNING", "DANGER"
  }
]
```

---

#### 3.1.8 GET `/api/monitoring/power-quality`

**설명**: 전력 품질 순위 (MON-005)

**Query Parameters**:
```typescript
{
  line: string;              // 필수
}
```

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
[
  {
    facilityId: string;
    code: string;
    name: string;
    unbalanceRate: number;       // 불평형률 (%)
    powerFactor: number;         // 역률 (%)
    unbalanceLimit: number;      // 불평형률 임계값
    powerFactorLimit: number;    // 역률 임계값
    rankUnbalance: number;       // 불평형률 순위
    rankPowerFactor: number;     // 역률 순위
  }
]
```

**비즈니스 로직**:
- 지정된 라인의 설비별 전력 품질 지표 조회
- unbalanceRate: 3상 불평형률
- powerFactor: 역률
- 각 지표별 임계값 및 순위 정보 포함

---

#### 3.1.9 GET `/api/monitoring/air-leak`

**설명**: 에어 누기 순위 (MON-006)

**Query Parameters**:
```typescript
{
  line: string;              // 필수
}
```

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
[
  {
    facilityId: string;
    code: string;
    name: string;
    baseline: number;        // 기준 에어 사용량 (L)
    current: number;         // 현재 에어 사용량 (L)
    leakRate: number;        // 누기율 (%)
    rank: number;            // 누기율 순위
  }
]
```

**비즈니스 로직**:
- 지정된 라인의 설비별 에어 누기 현황 조회
- baseline: 정상 운전 시 기준 사용량
- current: 현재 측정된 사용량
- leakRate: (current - baseline) / baseline * 100
- 누기율 기준 내림차순 정렬

---

#### 3.1.10 GET `/api/facilities/:facilityId/power/range`

**설명**: 설비별 전력 범위 데이터 조회 (동적 해상도)

**Path Parameters**:
- `facilityId`: 설비 코드 (예: "HNK10-000")

**Query Parameters**:
```typescript
{
  startTime: string;         // ISO 8601 (필수)
  endTime: string;           // ISO 8601 (필수)
  interval: "15m" | "1m" | "10s" | "1s"; // 필수
}
```

**Response** (`RangeDataResponse`):
```typescript
{
  data: [
    {
      time: string;          // "HH:MM:SS" or "HH:MM:SS.mmm"
      power: number;         // kWh (소수점 2자리)
      prevPower: number;     // 전일 전력
    }
  ],
  metadata: {
    interval: string;        // "1m"
    totalPoints: number;     // 집계된 총 포인트 수
    returnedPoints: number;  // 실제 반환된 포인트 수
    downsampled: boolean;    // Down-sampling 적용 여부
    zoomLevel: 0 | 1 | 2 | 3; // Zoom Level (0: 15m, 1: 1m, 2: 10s, 3: 1s)
    startTime: string;       // ISO 8601
    endTime: string;
    facilityId: string;
    metric: "power";
  }
}
```

**비즈니스 로직**:
- Progressive Resolution 지원 (4가지 interval)
- TimescaleDB time_bucket 활용
- 당일 + 전일 데이터 병렬 조회
- In-memory 캐싱 (TTL: 15m=300s, 1m=180s, 10s=60s, 1s=30s)

---

#### 3.1.11 GET `/api/facilities/:facilityId/air/range`

**설명**: 설비별 에어 범위 데이터 조회 (동적 해상도)

**Path Parameters**:
- `facilityId`: 설비 코드

**Query Parameters**: (3.1.10과 동일)

**Response**:
```typescript
{
  data: [
    {
      time: string;
      air: number;           // L (정수)
      prevAir: number;
    }
  ],
  metadata: {
    // ... (3.1.10과 동일, metric: "air")
  }
}
```

---

### 3.2 Dashboard API (9개)

#### 3.2.1 GET `/api/dashboard/energy-trend`

**설명**: 에너지 사용 추이 (DSH-001)

**Query Parameters**:
```typescript
{
  line?: string;             // 선택 (기본: 전체)
}
```

**Response**:
```typescript
[
  {
    date: string;            // YYYY-MM-DD
    power: number;           // 당일 전력
    air: number;             // 당일 에어
    prevPower: number;       // 전월 동일 일자 전력
    prevAir: number;         // 전월 동일 일자 에어
    powerTarget: number;     // 전력 목표 (기본: 18000)
    airTarget: number;       // 에어 목표 (기본: 12000)
  }
]
```

**비즈니스 로직**:
- 최근 7일 데이터 조회
- 전월 동일 기간 (30일 전) 데이터와 비교
- DATE(timestamp) 기준 GROUP BY

---

#### 3.2.2 GET `/api/dashboard/facility-trend`

**설명**: 설비별 추이 (DSH-002)

**Query Parameters**:
```typescript
{
  line?: string;
  facilityId?: string;       // facilityId 우선, 없으면 라인별 평균
}
```

**Response**:
```typescript
[
  {
    date: string;            // YYYY-MM-DD
    power: number;           // 당일 전력
    air: number;             // 당일 에어
  }
]
```

**비즈니스 로직**:
- 최근 7일 데이터
- facilityId 지정: 해당 설비만 집계 (SUM)
- facilityId 미지정: 라인별 평균 (AVG)

---

#### 3.2.3 GET `/api/dashboard/usage-distribution`

**설명**: 사용량 분포 (DSH-003)

**Query Parameters**:
```typescript
{
  line?: string;
  date?: string;             // YYYY-MM-DD (기본: 오늘)
}
```

**Response**:
```typescript
{
  powerProcessing: [         // 가공 설비 전력
    { name: string; value: number }  // 공정명, 전력(kWh)
  ],
  powerNonProcessing: [      // 비가공 설비 전력
    { name: string; value: number }
  ],
  airProcessing: [           // 가공 설비 에어
    { name: string; value: number }  // 공정명, 에어(L)
  ],
  airNonProcessing: [        // 비가공 설비 에어
    { name: string; value: number }
  ]
}
```

**비즈니스 로직**:
- facilities.isProcessing 기준 가공/비가공 분류
- facilities.process 기준 공정별 그룹핑
- 파이 차트용 데이터 (가공 내부 분포 + 비가공 합계)

---

#### 3.2.4 GET `/api/dashboard/process-ranking`

**설명**: 공정별 순위 (DSH-004)

**Query Parameters**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
{
  line?: string;
  type?: "elec" | "air";     // 기본: "elec"
}
```

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
[
  {
    process: string;         // "OP10", "OP20", "OP30", ...
    power: number;           // 전력 사용량 (kWh)
    air: number;             // 에어 사용량 (L)
    prevPower: number;       // 전일 전력 사용량
    prevAir: number;         // 전일 에어 사용량
  }
]
```

**비즈니스 로직**:
- 공정(process)별로 에너지 사용량 집계
- 금일 및 전일 데이터 모두 포함
- 공정 코드 순서대로 정렬 (OP10, OP20, OP30, ...)

---

#### 3.2.5 GET `/api/dashboard/cycle-ranking`

**설명**: 싸이클당 순위 (DSH-005)

**Query Parameters**:
```typescript
{
  line?: string;
}
```

**Response**: <!-- (v5.2 - PARTIAL 해결: facilityId/name 제거, process/cycleStatus 추가) -->
```typescript
[
  {
    rank: number;            // 순위
    code: string;            // "HNK10-000"
    process: string;         // "OP00", "OP10", ...
    cycleEnergy: number;     // 싸이클당 에너지 사용량 (kWh)
    cycleTime: number;       // 싸이클 시간 (초)
    deviation: number;       // 기준 대비 편차 (%)
    status: string;          // "NORMAL", "WARNING", "DANGER"
  }
]
```

**비즈니스 로직**:
- 싸이클 데이터를 기반으로 설비별 싸이클 성능 분석
- cycleEnergy: 싸이클당 평균 에너지 소비량
- cycleTime: 싸이클 완료 시간
- deviation: 기준 싸이클 대비 편차율
- 에너지 소비량 기준 내림차순 정렬

---

#### 3.2.6 GET `/api/dashboard/power-quality-ranking`

**설명**: 전력 품질 순위 (DSH-006)

**Query Parameters**:
```typescript
{
  line?: string;
}
```

**Response**: (MON-005와 동일 구조)

---

#### 3.2.7 GET `/api/dashboard/air-leak-ranking`

**설명**: 에어 누기 순위 (DSH-007)

**Query Parameters**:
```typescript
{
  line?: string;
}
```

**Response**: (MON-006과 동일 구조)

---

#### 3.2.8 GET `/api/dashboard/energy-change-top`

**설명**: 에너지 변화 TOP N (DSH-008)

**Query Parameters**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
{
  topN?: number;             // 기본: 8
  type?: "elec" | "air";     // 기본: "elec"
}
```

**Response**: <!-- (v5.2 - PARTIAL 해결: 불필요 필드 제거, 4개만 반환) -->
```typescript
[
  {
    code: string;                // "HNK10-000"
    name: string;                // 설비명
    prevMonthChange: number;     // 전월 대비 변화율 (%)
    prevYearChange: number;      // 전년 대비 변화율 (%)
  }
]
```

**비즈니스 로직**:
- 에너지 사용량 변화가 큰 설비 TOP N 조회
- type 파라미터에 따라 전력 또는 에어 기준 정렬
- 전월/전년 대비 변화율 계산
- 변화율 절대값 기준 내림차순 정렬

---

#### 3.2.9 GET `/api/dashboard/facilities`

**설명**: 설비 목록 조회 (공통)

**Query Parameters**:
```typescript
{
  line?: string;
}
```

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
[
  {
    id: string;              // UUID
    code: string;            // "HNK10-000"
    name: string;
  }
]
```

---

### 3.3 Alerts API (7개)

#### 3.3.1 GET `/api/alerts/stats/kpi`

**설명**: 알람 통계 KPI (ALT-001~003 공통)

**Query Parameters**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
{
  category: "power_quality" | "air_leak" | "cycle_anomaly"; // 필수
}
```

**Response**:
```typescript
{
  total: number;             // 총 알림 수 (최근 7일)
  weekly: number;            // 주간 알림 수 (total과 동일)
  weeklyChange: number;      // 전주 대비 변화율 (%)
  resolved: number;          // 조치 완료 수
  resolvedRate: number;      // 조치율 (%)
}
```

**비즈니스 로직**:
- category → AlertType 매핑 (power_quality → POWER_QUALITY)
- 최근 7일 vs 이전 7일 비교
- actionTaken IS NOT NULL → resolved

---

#### 3.3.2 GET `/api/alerts/stats/trend`

**설명**: 알람 주간 트렌드 (ALT-001~003 공통)

**Query Parameters**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
{
  category: "power_quality" | "air_leak" | "cycle_anomaly"; // 필수
}
```

**Response**:
```typescript
[
  {
    week: string;            // "MM/DD" (주 시작일)
    count: number;
  }
]
```

**비즈니스 로직**:
- 최근 8주 데이터
- date_trunc('week', detectedAt) 기준 GROUP BY

---

#### 3.3.3 GET `/api/alerts/stats/heatmap`

**설명**: 설비별 알림 히트맵 (ALT-001~003 공통)

**Query Parameters**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
{
  category: "power_quality" | "air_leak" | "cycle_anomaly"; // 필수
}
```

**Response**:
```typescript
[
  {
    facility: string;        // 설비 코드
    week1: number;           // 1주차 알림 수
    week2: number;           // 2주차 알림 수
    week3: number;
    week4: number;
    week5: number;
    week6: number;
    week7: number;
    week8: number;
  }
]
```

**비즈니스 로직**:
- 최근 8주 데이터
- 설비별 + 주차별 GROUP BY
- 상위 5개 설비만 반환 (총 알림 수 기준)

---

#### 3.3.4 GET `/api/alerts/history`

**설명**: 알람 이력 (ALT-004~006 공통)

**Query Parameters**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
{
  category: "power_quality" | "air_leak" | "cycle_anomaly"; // 필수
  line?: string;             // 선택
  facilityCode?: string;     // 선택
}
```

**Response**:
```typescript
[
  {
    id: string;              // Alert UUID
    no: number;              // 순번 (자동 생성)
    timestamp: string;       // ISO 8601
    line: string;            // 라인명
    facilityCode: string;
    facilityName: string;
    baseline: number;        // 기준값 (임계치 등)
    current: number;         // 현재값
    ratio: number;           // 비율 (%)
    status: "WARNING" | "DANGER";
    action: string | null;   // 조치사항
    category: string;        // category 그대로 반환
  }
]
```

**비즈니스 로직**:
- 최근 7일 데이터
- metadata JSON 필드에서 baseline, current, ratio 추출
- detectedAt DESC 정렬

---

#### 3.3.5 PATCH `/api/alerts/:id/action`

**설명**: 알림 조치사항 저장

**Path Parameters**:
- `id`: Alert UUID

**Request Body**:
```typescript
{
  action: string;            // 조치 내용
  actionBy: string;          // 담당자 이름
}
```

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
{
  success: true;
  id: string;                // 업데이트된 Alert ID
  action: string;            // 저장된 조치 내용
  updatedAt: string;         // ISO 8601 형식 업데이트 시각
}
```

**비즈니스 로직**:
- alerts 테이블의 actionTaken, actionTakenBy, actionTakenAt 필드 업데이트
- 업데이트 결과 정보 반환

---

#### 3.3.6 GET `/api/alerts/cycle-anomaly/types`

**설명**: 싸이클 이상 유형 목록

**Query Parameters**: 없음

**Response**: <!-- (v5.2 - PARTIAL 해결: CycleStatus enum 실제 값) -->
```typescript
[
  {
    value: string;           // "NORMAL", "DELAYED", "ANOMALY", "INCOMPLETE" (UPPERCASE)
    label: string;           // "정상", "지연", "이상", "미완료"
  }
]
```

---

#### 3.3.7 GET `/api/alerts/:id/waveform`

**설명**: 싸이클 파형 데이터 (이력 상세 모달용)

**Path Parameters**:
- `id`: Alert UUID

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
[
  {
    time: string;            // "HH:mm:ss" 형식
    current: number;         // 현재 싸이클 전력값
    prev: number;            // 기준 싸이클 전력값
  }
]
```

**비즈니스 로직**:
- 알림 ID로 연관된 싸이클 데이터 조회
- 기준 싸이클과 현재 싸이클을 시계열 배열로 반환
- 시간 축은 싸이클 시작부터의 경과 시간

---

### 3.4 Analysis API (7개)

#### 3.4.1 GET `/api/analysis/facilities/tree`

**설명**: 설비 트리 조회 (ANL-001)

**Query Parameters**: 없음

**Response**:
```typescript
[
  {
    id: "plant";
    label: "4공장";
    children: [
      {
        id: string;          // Line UUID
        label: string;       // "블록", "헤드", ...
        children: [
          {
            id: string;      // Facility code
            label: string;   // "HNK10-000"
          }
        ]
      }
    ]
  }
]
```

**비즈니스 로직**:
- 공장 → 라인 → 설비 3단 계층 구조
- facilities + lines JOIN
- 트리 체크박스 컴포넌트용 데이터

---

#### 3.4.2 GET `/api/analysis/facility/hourly`

**설명**: 설비별 시간대별 데이터 (ANL-001)

**Query Parameters**:
```typescript
{
  facilityId: string;        // 필수 (code or UUID)
  type: "elec" | "air";      // 필수
  date?: string;             // YYYY-MM-DD (기본: 오늘)
}
```

**Response**:
```typescript
[
  {
    time: string;            // "00:00", "01:00", ...
    current: number;         // 당일 값
    prev: number;            // 전일 값
  }
]
```

**비즈니스 로직**:
- 24시간 전체를 채워서 반환 (데이터 없는 시간은 0)
- facilityId가 "HNK"로 시작하면 code로 조회, 아니면 UUID로 조회
- EXTRACT(HOUR FROM timestamp) 기준 GROUP BY

---

#### 3.4.3 GET `/api/analysis/comparison/detailed`

**설명**: 상세 비교 분석 (ANL-002)

**Query Parameters**:
```typescript
{
  facilityId: string;        // 기준 설비
  date: string;              // 기준 날짜 (YYYY-MM-DD)
  facilityId2?: string;      // 비교 설비 (기본: facilityId와 동일)
  date2?: string;            // 비교 날짜 (기본: date와 동일)
}
```

**Response**:
```typescript
[
  {
    time: string;            // "00:00", "01:00", ...
    origin: number;          // 기준 값
    compare: number;         // 비교 값
    diff: number;            // origin - compare
  }
]
```

**비즈니스 로직**:
- getFacilityHourlyData() 2회 호출하여 병합
- 24시간 align하여 차이 계산

---

#### 3.4.4 GET `/api/analysis/cycles`

**설명**: 싸이클 목록 (ANL-003)

**Query Parameters**:
```typescript
{
  facilityId?: string;       // 선택 (기본: 전체)
}
```

**Response**:
```typescript
[
  {
    id: string;              // CycleData UUID
    label: string;           // "02/28 08:30~08:36"
    energy: number;          // 에너지 (kWh)
    similarity: number;      // 유사도 (%)
    status: "NORMAL" | "DELAYED" | "ANOMALY" | "INCOMPLETE";
  }
]
```

**비즈니스 로직**:
- 금일 싸이클 조회 (startTime >= 오늘 자정)
- 최근 20개 반환 (startTime DESC)
- status에 따라 similarity 계산 (NORMAL=95, DELAYED=80, ANOMALY=65)

---

#### 3.4.5 GET `/api/analysis/cycle/waveform`

**설명**: 싸이클 파형 데이터 (ANL-003)

**Query Parameters**:
```typescript
{
  cycleId: string;           // 필수
  isReference?: "true" | "false"; // 기준 싸이클 여부
}
```

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
[
  {
    sec: number;             // 싸이클 시작 후 경과 시간 (초)
    value: number;           // 해당 시점의 전력값 (kW)
  }
]
```

**비즈니스 로직**:
- 싸이클 ID로 파형 데이터 조회
- isReference 파라미터에 따라 기준 싸이클 또는 실제 싸이클 조회
- 시간순 정렬된 파형 데이터 배열 반환

---

#### 3.4.6 GET `/api/analysis/cycle/delay`

**설명**: 싸이클 타임 지연 정보 (ANL-004)

**Query Parameters**:
```typescript
{
  facilityId: string;        // 필수
}
```

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
{
  cycleId: string;           // 싸이클 ID
  totalEnergy: number;       // 총 에너지 사용량 (kWh)
  similarity: number;        // 기준 싸이클과의 유사도 (0~100)
  delay: number;             // 지연 시간 (초)
}
```

**비즈니스 로직**:
- 지정된 설비의 최신 싸이클 데이터 조회
- 기준 싸이클과 비교하여 유사도 및 지연 시간 계산
- 단일 싸이클의 메트릭 정보 반환

---

#### 3.4.7 GET `/api/analysis/power-quality`

**설명**: 전력 품질 분석 (ANL-005)

**Query Parameters**:
```typescript
{
  facilityIds: string;       // 쉼표 구분 (최대 4개)
  date?: string;             // YYYY-MM-DD (기본: 오늘)
}
```

**Response**: <!-- (v5.1 - 실제 구현 반영) -->
```typescript
Array<Array<{
  time: string;              // "HH:mm" 형식
  current: number;           // 현재 값 (불평형률 또는 역률 %)
  prev: number;              // 이전 값
}>>
```

**비즈니스 로직**:
- facilityIds를 쉼표로 분리하여 각 설비별 시계열 데이터 조회
- 각 설비마다 24시간 hourly 데이터를 배열로 반환
- 반환값은 설비 개수만큼의 배열을 포함하는 2차원 배열
- 각 내부 배열은 시간별 {time, current, prev} 객체 포함

---

### 3.5 Settings API (43개)

#### 임계값 설정 API (13개)

#### 3.5.1 GET `/api/settings/power-quality`

**설명**: 전력 품질 임계값 설정 조회 (SET-001)

**Query Parameters**: 없음

**Response**:
```typescript
[
  {
    id: string;              // Facility UUID
    facilityId: string;
    code: string;            // "HNK10-000"
    name: string;
    process: string;         // "OP10"
    modelCode: string;       // 모델명
    threshold1: number;      // 불평형률 임계 (%) - 기본: 5.0
    threshold2: number;      // 역률 기준 (%) - 기본: 85
    enabled: boolean;
  }
]
```

#### 3.5.2 PUT `/api/settings/power-quality`

**설명**: 전력 품질 임계값 설정 저장

**Request Body**:
```typescript
[
  {
    facilityId: string;
    threshold1: number;
    threshold2: number;
  }
]
```

**Response**:
```typescript
{
  success: true;
  count: number;
  message: "Threshold settings saved successfully";
}
```

**비즈니스 로직**:
- facilities.metadata JSON 필드에 thresholds 저장
- 설비별 개별 임계값 관리

#### 3.5.3 GET `/api/settings/air-leak`

**설명**: 에어 누기 임계값 설정 조회 (SET-002)

**Response**:
```typescript
[
  {
    // ... (3.5.1과 동일 구조)
    threshold1: number;      // 비생산 에어 기준 (L) - 기본: 5000
    threshold2: number;      // 누기율 임계 (%) - 기본: 20
  }
]
```

#### 3.5.4 PUT `/api/settings/air-leak`

**설명**: 에어 누기 임계값 설정 저장

(3.5.2와 동일 구조)

#### 3.5.5 GET `/api/settings/reference-cycles`

**설명**: 기준 싸이클 파형 조회 (SET-003)

**Response**:
```typescript
[
  {
    id: string;              // Facility UUID
    code: string;
    name: string;
    process: string;
    modelCode: string;
    registeredAt: string | null; // YYYY-MM-DD
    energy: number | null;   // 에너지 (kWh, 파형 적분 계산)
    cycleTime: number | null; // 싸이클 타임 (초)
    active: boolean;         // 기준 파형 등록 여부
  }
]
```

**비즈니스 로직**:
- isProcessing=true 설비만 조회 (가공 설비만 대상)
- reference_cycles 테이블 LEFT JOIN
- 파형 데이터에서 에너지 적분 계산

#### 3.5.6 GET `/api/settings/cycle-alert`

**설명**: 싸이클 알림 임계값 설정 조회 (SET-004)

**Response**:
```typescript
[
  {
    // ... (기본 구조)
    threshold1: number;      // 유사도 임계 (%) - 기본: 90
    threshold2: number;      // 지연 허용 (싸이클) - 기본: 3
  }
]
```

#### 3.5.7 PUT `/api/settings/cycle-alert`

**설명**: 싸이클 알림 임계값 설정 저장

(3.5.2와 동일 구조)

#### 3.5.8 GET `/api/settings/energy-alert`

**설명**: 에너지 사용량 알림 설정 조회 (SET-005)

**Response**:
```typescript
[
  {
    // ... (기본 구조)
    threshold1: number;      // 전월 대비 임계 (%) - 기본: 15
    threshold2: number;      // 전년 대비 임계 (%) - 기본: 20
  }
]
```

#### 3.5.9 PUT `/api/settings/energy-alert`

**설명**: 에너지 사용량 알림 설정 저장

(3.5.2와 동일 구조)

#### 3.5.10 GET `/api/settings/cycle-energy-alert`

**설명**: 싸이클당 에너지 알림 설정 조회 (SET-006)

**Response**:
```typescript
[
  {
    // ... (기본 구조)
    threshold1: number;      // 싸이클당 기준 (kWh) - 기본: 8.5
    threshold2: number;      // 초과 임계 (%) - 기본: 15
  }
]
```

#### 3.5.11 PUT `/api/settings/cycle-energy-alert`

**설명**: 싸이클당 에너지 알림 설정 저장

(3.5.2와 동일 구조)

#### 3.5.12 GET `/api/settings/general`

**설명**: 일반 설정 조회

**Response**:
```typescript
{
  powerRate: {
    baseRate: number;        // 기본 요금 (원/계약전력)
    usageRate: number;       // 사용 요금 (원/kWh)
  },
  airCostPerM3: number;      // 에어 생산 비용 (원/m³)
  workingHours: {
    start: string;           // "08:00"
    end: string;             // "18:00"
  },
  holidaySchedule: string[]; // ["2026-01-01", "2026-01-24", ...]
}
```

#### 3.5.13 PUT `/api/settings/general`

**설명**: 일반 설정 저장

**Request Body**: (3.5.12 Response와 동일)

---

#### 설비 마스터 관리 API (4개)

#### 3.5.14 GET `/api/settings/facility-master`

**설명**: 설비 마스터 목록 조회

**Query Parameters**:
```typescript
{
  line?: string;
  process?: string;
  type?: string;
  search?: string;
}
```

**Response**:
```typescript
[
  {
    id: string;              // UUID
    code: string;
    name: string;
    process: string;
    type: string;            // 모델명
    isProcessing: boolean;
    lineCode: string;
    lineName: string;
    tags: number;            // 연결된 태그 수
    createdAt: string;       // ISO 8601
    updatedAt: string;
  }
]
```

#### 3.5.15 POST `/api/settings/facility-master`

**설명**: 설비 마스터 생성

**Request Body**:
```typescript
{
  code: string;              // 필수
  name: string;              // 필수
  lineId: string;            // 필수 (Line UUID)
  process: string;           // 필수
  type: string;              // 필수
  isProcessing: boolean;     // 필수
}
```

**Response**:
```typescript
{
  id: string;                // 생성된 Facility UUID
  code: string;
  name: string;
  // ... (3.5.14와 동일)
}
```

#### 3.5.16 PUT `/api/settings/facility-master/:id`

**설명**: 설비 마스터 수정

**Request Body**: (3.5.15와 동일, 모든 필드 선택)

**Response**: (3.5.15와 동일)

#### 3.5.17 DELETE `/api/settings/facility-master/:id`

**설명**: 설비 마스터 삭제

**Response**:
```typescript
{
  success: true;
  message: "Facility deleted successfully";
}
```

---

#### 공장 관리 API (4개)

#### 3.5.18 GET `/api/settings/factory`

**설명**: 공장 목록 조회

**Response**:
```typescript
[
  {
    id: string;              // UUID
    code: string;            // "PT4"
    name: string;            // "화성 PT4공장"
    location: string;
    isActive: boolean;
    createdAt: string;
  }
]
```

#### 3.5.19 POST `/api/settings/factory`

**설명**: 공장 생성

**Request Body** (`CreateFactoryDto`):
```typescript
{
  code: string;              // 필수
  name: string;              // 필수
  location?: string;
  isActive?: boolean;        // 기본: true
}
```

#### 3.5.20 PUT `/api/settings/factory/:id`

**설명**: 공장 수정

**Request Body** (`UpdateFactoryDto`): (3.5.19와 동일, 모든 필드 선택)

#### 3.5.21 DELETE `/api/settings/factory/:id`

**설명**: 공장 삭제

---

#### 라인 관리 API (4개)

#### 3.5.22 GET `/api/settings/line`

**설명**: 라인 목록 조회

**Query Parameters**:
```typescript
{
  factoryId?: string;        // Factory UUID 필터
}
```

**Response**:
```typescript
[
  {
    id: string;              // UUID
    code: string;            // "BLOCK", "HEAD", ...
    name: string;            // "블록", "헤드", ...
    factoryId: string;
    factoryName: string;
    description: string;
    isActive: boolean;
    createdAt: string;
  }
]
```

#### 3.5.23 POST `/api/settings/line`

**설명**: 라인 생성

**Request Body** (`CreateLineDto`):
```typescript
{
  code: string;              // 필수
  name: string;              // 필수
  factoryId: string;         // 필수
  description?: string;
  isActive?: boolean;        // 기본: true
}
```

#### 3.5.24 PUT `/api/settings/line/:id`

**설명**: 라인 수정

#### 3.5.25 DELETE `/api/settings/line/:id`

**설명**: 라인 삭제

---

#### 태그 관리 API (6개)

#### 3.5.26 GET `/api/settings/tag`

**설명**: 태그 목록 조회

**Query Parameters**:
```typescript
{
  facilityId?: string;
  tagType?: "TREND" | "USAGE" | "OPERATE" | "SENSOR" | "CONTROL";
  energyType?: "elec" | "air" | "gas" | "solar";
  search?: string;
  page?: number;             // 기본: 1
  pageSize?: number;         // 기본: 50
}
```

**Response**:
```typescript
{
  total: number;
  page: number;
  pageSize: number;
  items: [
    {
      id: string;            // UUID
      tagName: string;       // "HNK10-000_POWER"
      description: string;
      tagType: string;
      energyType: string;
      unit: string;          // "kWh", "L", ...
      facilityId: string;
      facilityCode: string;
      facilityName: string;
      isActive: boolean;
      createdAt: string;
    }
  ]
}
```

#### 3.5.27 GET `/api/settings/tag/:id`

**설명**: 태그 상세 조회

**Response**:
```typescript
{
  id: string;
  tagName: string;
  description: string;
  tagType: string;
  energyType: string;
  unit: string;
  facilityId: string;
  facility: {
    code: string;
    name: string;
    lineId: string;
    lineName: string;
  };
  isActive: boolean;
  metadata: any;             // JSON (추가 설정)
  createdAt: string;
  updatedAt: string;
}
```

#### 3.5.28 POST `/api/settings/tag`

**설명**: 태그 생성

**Request Body** (`CreateTagDto`):
```typescript
{
  tagName: string;           // 필수
  description: string;       // 필수
  tagType: "TREND" | "USAGE" | "OPERATE" | "SENSOR" | "CONTROL"; // 필수
  energyType: "elec" | "air" | "gas" | "solar"; // 필수
  unit: string;              // 필수
  facilityId: string;        // 필수
  isActive?: boolean;        // 기본: true
  metadata?: any;            // JSON (선택)
}
```

#### 3.5.29 PUT `/api/settings/tag/:id`

**설명**: 태그 수정

**Request Body** (`UpdateTagDto`): (3.5.28과 동일, 모든 필드 선택)

#### 3.5.30 DELETE `/api/settings/tag/:id`

**설명**: 태그 삭제

---

#### 계층 구조 API (4개)

#### 3.5.31 GET `/api/settings/hierarchy`

**설명**: 전체 계층 구조 조회

**Response**:
```typescript
[
  {
    id: string;              // Factory UUID
    code: string;
    name: string;
    type: "factory";
    children: [
      {
        id: string;          // Line UUID
        code: string;
        name: string;
        type: "line";
        children: [
          {
            id: string;      // Facility UUID
            code: string;
            name: string;
            type: "facility";
            tags: [
              {
                id: string;  // Tag UUID
                tagName: string;
                type: "tag";
              }
            ]
          }
        ]
      }
    ]
  }
]
```

#### 3.5.32 GET `/api/settings/hierarchy/factory/:factoryId`

**설명**: 공장별 계층 구조 조회

**Response**: (3.5.31의 단일 공장 구조)

#### 3.5.33 GET `/api/settings/hierarchy/line/:lineId`

**설명**: 라인별 계층 구조 조회

**Response**: (3.5.31의 단일 라인 구조)

#### 3.5.34 GET `/api/settings/hierarchy/facility/:facilityId`

**설명**: 설비별 태그 목록 조회

**Response**:
```typescript
[
  {
    id: string;              // Tag UUID
    tagName: string;
    description: string;
    tagType: string;
    energyType: string;
    unit: string;
    isActive: boolean;
  }
]
```

---

#### 설비 유형 관리 API (4개)

#### 3.5.35 GET `/api/settings/facility-type`

**설명**: 설비 유형 목록 조회

**Query Parameters**:
```typescript
{
  search?: string;
  isActive?: "true" | "false";
}
```

**Response**:
```typescript
[
  {
    id: string;              // UUID
    code: string;            // "M-001"
    name: string;            // "사출기 1호"
    description: string;
    isActive: boolean;
    createdAt: string;
  }
]
```

#### 3.5.36 POST `/api/settings/facility-type`

**설명**: 설비 유형 생성

**Request Body** (`CreateFacilityTypeDto`):
```typescript
{
  code: string;              // 필수
  name: string;              // 필수
  description?: string;
  isActive?: boolean;        // 기본: true
}
```

#### 3.5.37 PUT `/api/settings/facility-type/:id`

**설명**: 설비 유형 수정

#### 3.5.38 DELETE `/api/settings/facility-type/:id`

**설명**: 설비 유형 삭제

---

#### 태그 일괄 업로드 API (2개)

#### 3.5.39 POST `/api/settings/tag/bulk-upload`

**설명**: 태그 일괄 업로드 (Excel/CSV)

**Request** (multipart/form-data):
```typescript
{
  file: File;                // .xlsx, .xls, .csv
}
```

**Response** (`BulkUploadResponseDto`):
```typescript
{
  success: boolean;
  total: number;             // 총 행 수
  successCount: number;      // 성공 수
  errorCount: number;        // 실패 수
  errors: [
    {
      row: number;           // 행 번호
      tagName: string;
      error: string;         // 에러 메시지
    }
  ]
}
```

**비즈니스 로직**:
- XLSX 파싱 (xlsx 라이브러리)
- 행별 유효성 검사 (tagName, facilityId 필수)
- 설비 존재 여부 확인
- 일괄 INSERT (트랜잭션)

#### 3.5.40 GET `/api/settings/tag/bulk-template`

**설명**: 태그 일괄 업로드 템플릿 다운로드

**Response**: Excel 파일 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

**파일명**: `tag-bulk-upload-template.xlsx`

**템플릿 구조**:
| tagName | description | tagType | energyType | unit | facilityCode | isActive |
|---------|-------------|---------|------------|------|--------------|----------|
| (예시)  | (예시)      | TREND   | elec       | kWh  | HNK10-000    | true     |

---

#### 태그 재할당 API (2개)

#### 3.5.41 POST `/api/settings/tag/reassign`

**설명**: 태그 재할당

**Request Body** (`TagReassignmentDto`):
```typescript
{
  tagIds: string[];          // Tag UUID 배열
  targetFacilityId: string;  // 새로운 설비 UUID
  reason?: string;           // 재할당 사유
}
```

**Response** (`TagReassignmentResponseDto`):
```typescript
{
  success: true;
  reassignedCount: number;
  timestamp: string;         // ISO 8601
}
```

**비즈니스 로직**:
- 트랜잭션으로 tags 테이블 UPDATE
- reassignment_history 테이블에 이력 INSERT
- 재할당 이력 자동 기록

#### 3.5.42 GET `/api/settings/tag/:id/reassignment-history`

**설명**: 태그 재할당 이력 조회

**Response**:
```typescript
[
  {
    id: string;              // History UUID
    tagId: string;
    tagName: string;
    previousFacilityId: string;
    previousFacilityCode: string;
    newFacilityId: string;
    newFacilityCode: string;
    reason: string | null;
    reassignedBy: string;
    reassignedAt: string;    // ISO 8601
  }
]
```

---

#### 기타 설정 API (1개)

#### 3.5.43 GET `/api/settings/thresholds`

**설명**: 임계값 설정 조회 (통합)

**Response**:
```typescript
{
  powerQuality: [...],       // 전력 품질 설정 (3.5.1)
  airLeak: [...],            // 에어 누기 설정 (3.5.3)
  cycleAlert: [...],         // 싸이클 알림 설정 (3.5.6)
  energyAlert: [...],        // 에너지 사용량 알림 설정 (3.5.8)
  cycleEnergyAlert: [...],   // 싸이클당 에너지 알림 설정 (3.5.10)
}
```

**비즈니스 로직**:
- 5개 임계값 설정을 한 번에 조회
- 프론트엔드 초기화 시 사용

---

## 4. DTO 정의

### 4.1 공통 DTO

```typescript
// apps/api/src/common/dto/pagination.dto.ts
export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

// apps/api/src/common/dto/time-range.dto.ts
export class TimeRangeDto {
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @IsOptional()
  @IsISO8601()
  endTime?: string;
}
```

### 4.2 Monitoring DTO

```typescript
// apps/api/src/monitoring/dto/overview-query.dto.ts
export class OverviewQueryDto extends TimeRangeDto {}

// apps/api/src/monitoring/dto/overview-response.dto.ts
export class MonitoringOverviewDto {
  @ApiProperty()
  kpi: {
    totalPower: number;
    totalAir: number;
    powerQualityAlerts: number;
    airLeakAlerts: number;
  };

  @ApiProperty({ type: [LineStatusDto] })
  lines: LineStatusDto[];

  @ApiProperty()
  chart: {
    timestamps: string[];
    prevPower: number[];
    currentPower: number[];
    prevAir: number[];
    currentAir: number[];
    currentTime: string;
  };

  @ApiProperty({ type: [RecentAlertDto] })
  recentAlerts: RecentAlertDto[];
}

// ... 기타 DTO 생략 (총 30+ DTO)
```

### 4.3 DTO 파일 구조

```
apps/api/src/
├── common/
│   └── dto/
│       ├── pagination.dto.ts
│       └── time-range.dto.ts
├── monitoring/
│   └── dto/
│       ├── overview-query.dto.ts
│       ├── overview-response.dto.ts
│       ├── line-detail-query.dto.ts
│       ├── line-detail-response.dto.ts
│       ├── energy-ranking-query.dto.ts
│       ├── energy-ranking-response.dto.ts
│       ├── energy-alerts-query.dto.ts
│       └── energy-alerts-response.dto.ts
├── dashboard/
│   └── dto/
│       ├── energy-trend-query.dto.ts
│       ├── energy-trend-response.dto.ts
│       └── ... (8개 Query/Response)
├── alerts/
│   └── dto/
│       ├── alert-statistics-query.dto.ts
│       ├── alert-statistics-response.dto.ts
│       ├── save-action.dto.ts
│       ├── acknowledge-alert.dto.ts
│       └── ... (6개 Query/Response)
└── analysis/
    └── dto/
        ├── comparison-query.dto.ts
        ├── comparison-response.dto.ts
        └── ... (5개 Query/Response)
```

---

## 5. 서비스 레이어 설계

### 5.1 MonitoringService

```typescript
// apps/api/src/monitoring/monitoring.service.ts
@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 종합 현황 조회 (MON-001)
   */
  async getOverview(query: OverviewQueryDto): Promise<MonitoringOverviewDto> {
    const { startTime, endTime } = this.parseTimeRange(query);

    // 1. KPI 집계 (전체 라인)
    const kpi = await this.getKpiMetrics(startTime, endTime);

    // 2. 라인별 현황
    const lines = await this.getLineStatuses(startTime, endTime);

    // 3. 시계열 차트 데이터
    const chart = await this.getChartData(startTime, endTime);

    // 4. 최근 알림
    const recentAlerts = await this.getRecentAlerts(20);

    return { kpi, lines, chart, recentAlerts };
  }

  /**
   * KPI 메트릭 계산
   */
  private async getKpiMetrics(startTime: Date, endTime: Date) {
    // TimescaleDB Aggregate 활용
    const energyAgg = await this.prisma.$queryRaw`
      SELECT
        SUM("powerKwh") as total_power,
        SUM("airL") as total_air
      FROM energy_timeseries
      WHERE timestamp >= ${startTime}
        AND timestamp < ${endTime}
    `;

    const alertsAgg = await this.prisma.alert.groupBy({
      by: ['type'],
      where: {
        detectedAt: { gte: startTime, lt: endTime },
      },
      _count: true,
    });

    return {
      totalPower: energyAgg[0].total_power || 0,
      totalAir: energyAgg[0].total_air || 0,
      powerQualityAlerts: alertsAgg.find(a => a.type === 'POWER_QUALITY')?._count || 0,
      airLeakAlerts: alertsAgg.find(a => a.type === 'AIR_LEAK')?._count || 0,
    };
  }

  /**
   * 라인별 현황
   */
  private async getLineStatuses(startTime: Date, endTime: Date) {
    const lines = await this.prisma.line.findMany({
      include: {
        facilities: {
          include: {
            energyData: {
              where: {
                timestamp: { gte: startTime, lt: endTime },
              },
            },
          },
        },
      },
    });

    return lines.map(line => ({
      code: line.code,
      name: line.name,
      powerKwh: line.facilities.reduce((sum, f) =>
        sum + f.energyData.reduce((s, e) => s + e.powerKwh, 0), 0
      ),
      airL: line.facilities.reduce((sum, f) =>
        sum + f.energyData.reduce((s, e) => s + (e.airL || 0), 0), 0
      ),
      facilitiesCount: line.facilities.length,
      alertsCount: 0, // 별도 쿼리
      status: this.calculateLineStatus(line),
    }));
  }

  /**
   * 차트 데이터 생성
   */
  private async getChartData(startTime: Date, endTime: Date) {
    // 15분 단위 time_bucket 활용
    const data = await this.prisma.$queryRaw`
      SELECT
        time_bucket('15 minutes', timestamp) as bucket,
        SUM("powerKwh") as power,
        SUM("airL") as air
      FROM energy_timeseries
      WHERE timestamp >= ${startTime}
        AND timestamp < ${endTime}
      GROUP BY bucket
      ORDER BY bucket
    `;

    // 전일 동시간대 데이터
    const prevData = await this.getPreviousDayData(startTime, endTime);

    return {
      timestamps: data.map(d => this.formatTime(d.bucket)),
      prevPower: prevData.map(d => d.power),
      currentPower: data.map(d => d.power),
      prevAir: prevData.map(d => d.air),
      currentAir: data.map(d => d.air),
      currentTime: this.getCurrentTimeLabel(),
    };
  }

  /**
   * 시간 범위 파싱
   */
  private parseTimeRange(query: TimeRangeDto) {
    const endTime = query.endTime ? new Date(query.endTime) : new Date();
    const startTime = query.startTime
      ? new Date(query.startTime)
      : new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24시간 전

    return { startTime, endTime };
  }

  /**
   * 라인 상태 계산
   */
  private calculateLineStatus(line: any): 'NORMAL' | 'WARNING' | 'DANGER' {
    const dangerCount = line.facilities.filter(f => f.status === 'DANGER').length;
    const warningCount = line.facilities.filter(f => f.status === 'WARNING').length;

    if (dangerCount > 0) return 'DANGER';
    if (warningCount > 0) return 'WARNING';
    return 'NORMAL';
  }

  // ... 기타 헬퍼 메서드
}
```

### 5.2 DashboardService

```typescript
// apps/api/src/dashboard/dashboard.service.ts
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 월별 에너지 추세 (DSH-001)
   */
  async getEnergyTrend(query: EnergyTrendQueryDto): Promise<EnergyTrendDto> {
    const year = query.year || new Date().getFullYear();
    const months = query.months || 12;

    // 월별 집계
    const currentData = await this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', timestamp) as month,
        SUM("powerKwh") as power,
        SUM("airL") as air
      FROM energy_timeseries
      WHERE EXTRACT(YEAR FROM timestamp) = ${year}
      GROUP BY month
      ORDER BY month
      LIMIT ${months}
    `;

    // 전년 동월 데이터
    const prevYearData = await this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', timestamp) as month,
        SUM("powerKwh") as power,
        SUM("airL") as air
      FROM energy_timeseries
      WHERE EXTRACT(YEAR FROM timestamp) = ${year - 1}
      GROUP BY month
      ORDER BY month
      LIMIT ${months}
    `;

    return this.mergeYearlyData(currentData, prevYearData);
  }

  // ... 기타 메서드
}
```

### 5.3 AlertsService

```typescript
// apps/api/src/alerts/alerts.service.ts
@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 조치사항 저장 (POST /alerts/:id/action)
   */
  async saveAction(id: string, dto: SaveActionDto) {
    const alert = await this.prisma.alert.update({
      where: { id },
      data: {
        actionTaken: dto.actionTaken,
        actionTakenBy: dto.actionTakenBy,
        actionTakenAt: new Date(),
      },
    });

    return {
      success: true,
      alert: {
        id: alert.id,
        actionTaken: alert.actionTaken,
        actionTakenBy: alert.actionTakenBy,
        actionTakenAt: alert.actionTakenAt,
      },
    };
  }

  /**
   * 알림 확인 처리 (PUT /alerts/:id/acknowledge)
   */
  async acknowledgeAlert(id: string, dto: AcknowledgeAlertDto) {
    const acknowledgedAt = new Date();

    await this.prisma.alert.update({
      where: { id },
      data: {
        acknowledgedBy: dto.acknowledgedBy,
        acknowledgedAt,
      },
    });

    return {
      success: true,
      acknowledgedAt: acknowledgedAt.toISOString(),
    };
  }

  // ... 기타 메서드
}
```

### 5.4 AnalysisService

```typescript
// apps/api/src/analysis/analysis.service.ts
@Injectable()
export class AnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 싸이클 분석 (ANL-003)
   */
  async getCycleAnalysis(query: CycleAnalysisQuery): Promise<CycleAnalysisDto> {
    const { facilityId, cycleNumbers } = query;
    const cycles = cycleNumbers.split(',').map(n => parseInt(n, 10));

    // 기준 싸이클 조회
    const referenceCycle = await this.prisma.referenceCycle.findUnique({
      where: { facilityId },
    });

    if (!referenceCycle) {
      throw new NotFoundException('Reference cycle not found');
    }

    // 실제 싸이클 데이터 조회
    const cycleData = await this.prisma.cycleData.findMany({
      where: {
        facilityId,
        cycleNumber: { in: cycles },
      },
      orderBy: { cycleNumber: 'asc' },
    });

    return {
      referenceCycle: referenceCycle.waveform as any,
      cycles: cycleData.map((c, idx) => ({
        cycleNumber: c.cycleNumber,
        ...(c.waveform as any),
        color: idx === 0 ? '#F39C12' : '#3B82F6',
      })),
    };
  }

  // ... 기타 메서드
}
```

---

## 6. TimescaleDB 설정

### 6.1 초기화 스크립트

```sql
-- apps/api/prisma/timescaledb-init.sql

-- 1. TimescaleDB Extension 활성화
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2. Hypertable 생성
SELECT create_hypertable(
  'tag_data_raw',
  'timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

SELECT create_hypertable(
  'energy_timeseries',
  'timestamp',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- 3. Compression 설정 (1주일 이후 데이터 압축)
ALTER TABLE tag_data_raw SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"tagId"'
);

SELECT add_compression_policy(
  'tag_data_raw',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

ALTER TABLE energy_timeseries SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"facilityId"'
);

SELECT add_compression_policy(
  'energy_timeseries',
  INTERVAL '30 days',
  if_not_exists => TRUE
);

-- 4. Retention Policy
SELECT add_retention_policy(
  'tag_data_raw',
  INTERVAL '3 months',
  if_not_exists => TRUE
);

SELECT add_retention_policy(
  'energy_timeseries',
  INTERVAL '2 years',
  if_not_exists => TRUE
);

-- 5. Continuous Aggregate (15분 집계)
CREATE MATERIALIZED VIEW IF NOT EXISTS energy_15min_agg
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', timestamp) AS bucket,
  "facilityId",
  AVG("powerKwh") AS avg_power,
  MAX("powerKwh") AS max_power,
  MIN("powerKwh") AS min_power,
  SUM("powerKwh") AS sum_power,
  AVG("airL") AS avg_air,
  SUM("airL") AS sum_air,
  COUNT(*) AS sample_count
FROM energy_timeseries
GROUP BY bucket, "facilityId"
WITH NO DATA;

-- Refresh Policy (5분마다)
SELECT add_continuous_aggregate_policy(
  'energy_15min_agg',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);

-- 6. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_tag_data_raw_tag_time
  ON tag_data_raw ("tagId", timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_energy_ts_facility_time
  ON energy_timeseries ("facilityId", timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_facility_detected
  ON alerts ("facilityId", "detectedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_severity_type
  ON alerts (severity, type);

CREATE INDEX IF NOT EXISTS idx_cycle_facility_start
  ON cycle_data ("facilityId", "startTime" DESC);

CREATE INDEX IF NOT EXISTS idx_cycle_status
  ON cycle_data (status);
```

### 6.2 실행 방법

```bash
# Docker Compose로 PostgreSQL + TimescaleDB 실행
docker-compose up -d

# Prisma Migration 실행
pnpm prisma migrate dev

# TimescaleDB 초기화 스크립트 실행
psql -U postgres -d ifems -f prisma/timescaledb-init.sql

# Prisma Client 생성
pnpm prisma generate
```

---

## 7. 에러 처리

### 7.1 Global Exception Filter

```typescript
// apps/api/src/common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
```

### 7.2 에러 응답 형식

```typescript
{
  "statusCode": 400,
  "timestamp": "2026-02-25T10:30:00.000Z",
  "path": "/api/monitoring/overview",
  "message": "Validation failed: startTime must be ISO 8601"
}
```

---

## 8. 파일 구조

```
apps/api/src/
├── app.module.ts
├── main.ts
├── prisma.service.ts
├── common/
│   ├── dto/
│   │   ├── pagination.dto.ts
│   │   └── time-range.dto.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── pipes/
│       └── validation.pipe.ts
├── monitoring/
│   ├── monitoring.module.ts
│   ├── monitoring.controller.ts
│   ├── monitoring.service.ts
│   └── dto/
│       ├── overview-query.dto.ts
│       ├── overview-response.dto.ts
│       └── ... (12개 DTO)
├── dashboard/
│   ├── dashboard.module.ts
│   ├── dashboard.controller.ts
│   ├── dashboard.service.ts
│   └── dto/
│       └── ... (16개 DTO)
├── alerts/
│   ├── alerts.module.ts
│   ├── alerts.controller.ts
│   ├── alerts.service.ts
│   └── dto/
│       └── ... (14개 DTO)
├── analysis/
│   ├── analysis.module.ts
│   ├── analysis.controller.ts
│   ├── analysis.service.ts
│   └── dto/
│       └── ... (10개 DTO)
├── data-collection/ (신규)
│   ├── data-collection.module.ts
│   ├── tag-data-collector.service.ts
│   └── energy-aggregator.service.ts
└── settings/ (기존)
    └── ... (Tag Management)
```

---

## 9. 구현 체크리스트

### Phase 1: 데이터 인프라 (1-2일)

- [ ] **Prisma Schema 확장**
  - [ ] Alert 모델 추가
  - [ ] CycleData 모델 추가
  - [ ] ReferenceCycle 모델 추가
  - [ ] Facility Relations 추가
  - [ ] `prisma migrate dev --name add-alert-cycle-models` 실행

- [ ] **TimescaleDB 설정**
  - [ ] `timescaledb-init.sql` 스크립트 작성
  - [ ] Hypertable 생성 (tag_data_raw, energy_timeseries)
  - [ ] Compression Policy 설정
  - [ ] Retention Policy 설정
  - [ ] Continuous Aggregate 생성 (energy_15min_agg)
  - [ ] 인덱스 생성

- [ ] **Mock 데이터 생성기**
  - [ ] `TagDataCollectorService` 구현 (1초 주기)
  - [ ] `EnergyAggregatorService` 구현 (15분 Cron)
  - [ ] Seed Script 작성 (1주일치 데이터)
  - [ ] `pnpm db:seed` 실행

### Phase 2: Core API - Monitoring (2-3일)

- [ ] **Monitoring Module**
  - [ ] MonitoringModule 생성
  - [ ] MonitoringController 생성
  - [ ] MonitoringService 구현
  - [ ] DTO 정의 (12개)

- [ ] **Endpoints 구현**
  - [ ] GET /monitoring/overview
  - [ ] GET /monitoring/line/:lineCode
  - [ ] GET /monitoring/energy/ranking
  - [ ] GET /monitoring/energy/alerts
  - [ ] GET /monitoring/power-quality/ranking
  - [ ] GET /monitoring/air-leak/ranking

- [ ] **Swagger 문서화**
  - [ ] @ApiTags('Monitoring')
  - [ ] @ApiOperation() 전체 endpoint
  - [ ] @ApiResponse() 정의

- [ ] **E2E 테스트**
  - [ ] monitoring.e2e-spec.ts 작성
  - [ ] Frontend 연동 테스트

### Phase 3: Dashboard & Alerts API (2-3일)

- [ ] **Dashboard Module**
  - [ ] DashboardModule 생성
  - [ ] DashboardController 생성
  - [ ] DashboardService 구현
  - [ ] DTO 정의 (16개)

- [ ] **Dashboard Endpoints**
  - [ ] GET /dashboard/energy/trend
  - [ ] GET /dashboard/facility/trend
  - [ ] GET /dashboard/line/comparison
  - [ ] GET /dashboard/peak-demand
  - [ ] GET /dashboard/energy-cost
  - [ ] GET /dashboard/efficiency
  - [ ] GET /dashboard/baseline
  - [ ] GET /dashboard/summary

- [ ] **Alerts Module**
  - [ ] AlertsModule 생성
  - [ ] AlertsController 생성
  - [ ] AlertsService 구현
  - [ ] DTO 정의 (14개)

- [ ] **Alerts Endpoints**
  - [ ] GET /alerts/statistics
  - [ ] GET /alerts/trend
  - [ ] GET /alerts/severity
  - [ ] GET /alerts/power-quality/history
  - [ ] GET /alerts/air-leak/history
  - [ ] GET /alerts/cycle/history
  - [ ] POST /alerts/:id/action
  - [ ] PUT /alerts/:id/acknowledge

### Phase 4: Analysis API (2-3일)

- [ ] **Analysis Module**
  - [ ] AnalysisModule 생성
  - [ ] AnalysisController 생성
  - [ ] AnalysisService 구현
  - [ ] DTO 정의 (10개)

- [ ] **Analysis Endpoints**
  - [ ] GET /analysis/comparison
  - [ ] GET /analysis/detailed-comparison
  - [ ] GET /analysis/cycle
  - [ ] GET /analysis/cycle-delay
  - [ ] GET /analysis/power-quality

- [ ] **Performance Tuning**
  - [ ] Query 성능 측정
  - [ ] 인덱스 추가 (필요 시)
  - [ ] Caching 전략 (Optional)

### Phase 5: 통합 테스트 & 문서화 (1-2일)

- [ ] **통합 테스트**
  - [ ] 전체 API E2E 테스트
  - [ ] Artillery 부하 테스트 (100 req/s)
  - [ ] Frontend 완전 연동 테스트
  - [ ] Mock → API 전환 검증

- [ ] **최종 문서화**
  - [ ] Swagger UI 100% 완성
  - [ ] README.md 업데이트
  - [ ] Postman Collection Export
  - [ ] API 사용 가이드 작성

- [ ] **배포 준비**
  - [ ] Docker Compose 최종 확인
  - [ ] .env 설정 검증
  - [ ] Health Check API 구현
  - [ ] Global Exception Filter 적용

---

## 10. 예상 일정

| Phase | 작업 | 예상 시간 | 담당 |
|-------|------|-----------|------|
| Phase 1 | 데이터 인프라 | 1-2일 | Backend |
| Phase 2 | Monitoring API | 2-3일 | Backend |
| Phase 3 | Dashboard & Alerts API | 2-3일 | Backend |
| Phase 4 | Analysis API | 2-3일 | Backend |
| Phase 5 | 통합 테스트 & 문서화 | 1-2일 | Backend + Frontend |
| **Total** | | **10-13일** | |

---

## 11. 참고 자료

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [i-FEMS Plan Document](../../01-plan/features/backend-api.plan.md)
- [Frontend Mock Services](../../../apps/web/src/services/)
- [Existing Prisma Schema](../../../apps/api/prisma/schema.prisma)

---

**작성 완료**: 2026-02-25
**다음 단계**: Implementation (Do Phase)
**Plan Document**: [backend-api.plan.md](../../01-plan/features/backend-api.plan.md)
**담당**: Claude Code
