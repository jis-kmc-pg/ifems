# [Plan] i-FEMS Backend API

> Feature: ifems-backend
> Created: 2026-02-20
> PDCA Phase: Plan
> Status: Draft

---

## 1. 프로젝트 개요

### 배경
- i-FEMS 프론트엔드 32화면 완성 (2026-02-19)
- 현재 Mock 데이터 기반 (`VITE_USE_MOCK=true`)
- 실제 PostgreSQL + TimescaleDB 기반 Backend API 필요

### 목표
화성 PT4공장 설비·에너지 데이터를 실시간으로 수집·저장·제공하는 RESTful API 서버 구축

### 범위
| 구분 | 내용 |
|------|------|
| API 엔드포인트 | 6개 모듈 (Monitoring, Dashboard, Alerts, Analysis, Settings, **Tags**) |
| 데이터베이스 | PostgreSQL 15 + TimescaleDB 확장 |
| 태그 시스템 | 계층 구조 (공장→라인→설비→태그) + 실시간 key-value 수집 |
| 인증 | JWT 기반 (향후 확장) |
| 실시간 | WebSocket (Socket.io) - 선택적 구현 |
| 배포 | Docker Compose (개발/운영 분리) |

---

## 2. 기술 스택

### Backend Framework
```
NestJS 11 (TypeScript 5.7)
  ├── @nestjs/platform-express (HTTP)
  ├── @nestjs/platform-socket.io (WebSocket, 선택)
  ├── @nestjs/config (환경 변수)
  ├── @nestjs/swagger (API 문서)
  └── class-validator + class-transformer (DTO 검증)
```

### Database
```
PostgreSQL 15.x
  └── TimescaleDB 2.x (시계열 최적화)
Prisma 6 (ORM)
  ├── Prisma Client (쿼리)
  ├── Prisma Migrate (마이그레이션)
  └── Prisma Studio (GUI)
```

### 개발 도구
```
pnpm (패키지 관리자, monorepo 공유)
Docker + Docker Compose (로컬 DB 환경)
ESLint + Prettier (코드 스타일)
Jest (테스트)
```

---

## 3. API 모듈 설계

### 3.1 Monitoring Module (`/api/monitoring/*`)

**화면 지원**: MON-001 ~ MON-006 (6화면)

| 엔드포인트 | Method | 설명 | 화면 |
|-----------|--------|------|------|
| `/monitoring/overview` | GET | 종합 현황 (KPI + 라인 요약 + 시간대별 차트 + 알림 목록) | MON-001 |
| `/monitoring/line/detail` | GET | 라인별 상세 (전력/에어 차트, 당일/전일 비교) | MON-002 |
| `/monitoring/energy/ranking` | GET | 에너지 사용 순위 (설비별 전력/에어 랭킹) | MON-003 |
| `/monitoring/energy/alert` | GET | 에너지 알림 현황 (실시간 알림 목록 + 심각도별 집계) | MON-004 |
| `/monitoring/power-quality` | GET | 전력 품질 순위 (불평형/역률 이상 설비) | MON-005 |
| `/monitoring/air-leak` | GET | 에어 누기 순위 (누기율 높은 설비) | MON-006 |

**Query Parameters**:
- `line?: 'block' | 'head' | 'crank' | 'assembly'`
- `date?: YYYY-MM-DD` (기본값: 오늘)
- `interval?: '15min' | '1hour' | '1day'`

---

### 3.2 Dashboard Module (`/api/dashboard/*`)

**화면 지원**: DSH-001 ~ DSH-008 (8화면)

| 엔드포인트 | Method | 설명 | 화면 |
|-----------|--------|------|------|
| `/dashboard/energy/trend` | GET | 에너지 사용 추이 (월별/일별 전력/에어) | DSH-001 |
| `/dashboard/facility/trend` | GET | 설비별 추이 (14일간 설비별 트렌드) | DSH-002 |
| `/dashboard/usage/distribution` | GET | 사용량 분포 (가공/비가공 비율, 전력/에어) | DSH-003 |
| `/dashboard/process/ranking` | GET | 공정별 순위 (당일/전일 비교) | DSH-004 |
| `/dashboard/cycle/ranking` | GET | 싸이클당 순위 (에너지 효율 랭킹) | DSH-005 |
| `/dashboard/power-quality/ranking` | GET | 전력 품질 순위 (불평형/역률) | DSH-006 |
| `/dashboard/air-leak/ranking` | GET | 에어 누기 순위 (누기율) | DSH-007 |
| `/dashboard/energy/change` | GET | 에너지 변화 TOP N (증가/감소율 상위) | DSH-008 |

**Query Parameters**:
- `line?: string`
- `startDate?: YYYY-MM-DD`
- `endDate?: YYYY-MM-DD`
- `top?: number` (TOP N, 기본값: 10)

---

### 3.3 Alerts Module (`/api/alerts/*`)

**화면 지원**: ALT-001 ~ ALT-006 (6화면)

| 엔드포인트 | Method | 설명 | 화면 |
|-----------|--------|------|------|
| `/alerts/power-quality/stats` | GET | 전력 품질 통계 (KPI + 트렌드 + 히트맵) | ALT-001 |
| `/alerts/air-leak/stats` | GET | 에어 누기 통계 (KPI + 트렌드 + 히트맵) | ALT-002 |
| `/alerts/cycle-anomaly/stats` | GET | 싸이클 이상 통계 (KPI + 트렌드 + 타입별 분포) | ALT-003 |
| `/alerts/power-quality/history` | GET | 전력 품질 이력 (마스터-디테일) | ALT-004 |
| `/alerts/air-leak/history` | GET | 에어 누기 이력 | ALT-005 |
| `/alerts/cycle-anomaly/history` | GET | 싸이클 이상 이력 | ALT-006 |
| `/alerts/:id/action` | PUT | 조치사항 저장 | ALT-004~006 |
| `/alerts/:id/waveform` | GET | 싸이클 파형 데이터 (ALT-006 모달용) | ALT-006 |

**Query Parameters**:
- `alertType: 'power_quality' | 'air_leak' | 'cycle_anomaly'`
- `line?: string`
- `startDate?, endDate?: YYYY-MM-DD`
- `status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'`

---

### 3.4 Analysis Module (`/api/analysis/*`)

**화면 지원**: ANL-001 ~ ANL-005 (5화면)

| 엔드포인트 | Method | 설명 | 화면 |
|-----------|--------|------|------|
| `/analysis/facilities/tree` | GET | 설비 트리 구조 | ANL-001, ANL-005 |
| `/analysis/facility/hourly` | GET | 설비별 시간대별 데이터 (전력/에어) | ANL-001 |
| `/analysis/comparison/detailed` | POST | 상세 비교 분석 (조건1 vs 조건2) | ANL-002 |
| `/analysis/cycles` | GET | 싸이클 목록 | ANL-003, ANL-004 |
| `/analysis/cycle/waveform` | GET | 싸이클 파형 데이터 (초 단위) | ANL-003, ANL-004 |
| `/analysis/cycle/delay` | GET | 싸이클 타임 지연 정보 | ANL-004 |
| `/analysis/power-quality` | GET | 전력 품질 분석 (불평형/역률 시계열) | ANL-005 |

**Query Parameters**:
- `facilityId: string | string[]` (다중 선택 가능)
- `type: 'elec' | 'air'`
- `date?: YYYY-MM-DD`
- `isReference?: boolean` (기준 파형 여부)

---

### 3.5 Settings Module (`/api/settings/*`)

**화면 지원**: SET-001 ~ SET-006 (6화면)

| 엔드포인트 | Method | 설명 | 화면 |
|-----------|--------|------|------|
| `/settings/power-quality` | GET | 전력 품질 설정 조회 | SET-001 |
| `/settings/power-quality` | PUT | 전력 품질 설정 저장 | SET-001 |
| `/settings/air-leak` | GET | 에어 누기 설정 조회 | SET-002 |
| `/settings/air-leak` | PUT | 에어 누기 설정 저장 | SET-002 |
| `/settings/reference-cycles` | GET | 기준 싸이클 파형 목록 | SET-003 |
| `/settings/reference-cycles/:id/waveform` | GET | 기준 파형 데이터 | SET-003 |
| `/settings/cycle-alert` | GET | 싸이클 알림 설정 조회 | SET-004 |
| `/settings/cycle-alert` | PUT | 싸이클 알림 설정 저장 | SET-004 |
| `/settings/energy-alert` | GET | 에너지 사용량 알림 조회 | SET-005 |
| `/settings/energy-alert` | PUT | 에너지 사용량 알림 저장 | SET-005 |
| `/settings/cycle-energy-alert` | GET | 싸이클당 에너지 알림 조회 | SET-006 |
| `/settings/cycle-energy-alert` | PUT | 싸이클당 에너지 알림 저장 | SET-006 |

---

### 3.6 Tags Module (`/api/tags/*`)

**화면 지원**: TAG-001 (태그 관리) + 실시간 데이터 수집

**태그 시스템 구조**:
```
공장 (Plant)
 └── 라인 (Line: block, head, crank, assembly)
      └── 설비 (Facility: HNK10-020, ...)
           └── 태그 (Tag: 센서/계측 포인트)
```

| 엔드포인트 | Method | 설명 | 화면 |
|-----------|--------|------|------|
| `/tags` | GET | 태그 목록 조회 (계층 구조, DEPTH 포함) | TAG-001 |
| `/tags/:id` | GET | 태그 상세 조회 | TAG-001 |
| `/tags` | POST | 태그 생성 (수동 추가) | TAG-001 |
| `/tags/:id` | PUT | 태그 수정 (이름, 단위, 활성화 상태) | TAG-001 |
| `/tags/:id` | DELETE | 태그 삭제 (soft delete, isActive=false) | TAG-001 |
| `/tags/import` | POST | 엑셀 일괄 임포트 (`화성PT4공장_TagList.xlsx`) | TAG-001 |
| `/tags/export` | GET | 태그 목록 엑셀 내보내기 | TAG-001 |
| `/tags/tree` | GET | 태그 트리 구조 (계층형 JSON) | Frontend |
| `/tags/data/latest` | GET | 태그별 최신 데이터 조회 (key-value) | Monitoring |
| `/tags/data/timeseries` | POST | 태그 시계열 데이터 조회 (복수 태그, 기간 지정) | Analysis |
| `/tags/data/ingest` | POST | 태그 데이터 수집 (PLC/SCADA → API) | Data Collector |

**Query Parameters**:
- `line?: string` (라인 필터)
- `facilityId?: string` (설비 필터)
- `isActive?: boolean` (활성 태그만)
- `depth?: number` (계층 깊이: 1=라인, 2=설비, 3=태그)
- `tagIds?: string[]` (복수 태그 조회)
- `startTime?, endTime?: ISO8601` (시계열 데이터 기간)

**태그 데이터 수집 Flow**:
```
PLC/SCADA → POST /tags/data/ingest (key-value pairs)
           → tag_data_raw (TimescaleDB Hypertable)
           → Aggregation (15분 단위)
           → energy_timeseries (집계 데이터)
```

---

## 4. 데이터베이스 스키마

### 4.1 마스터 테이블

#### facilities (설비 마스터)
```prisma
model Facility {
  id           String   @id @default(uuid())
  code         String   @unique  // HNK10-020
  name         String              // HNK10-020 OP20
  line         Line                // block | head | crank | assembly
  process      String?             // OP10, OP20, etc.
  type         FacilityType        // PROCESSING | COMPRESSOR | UTILITY
  isProcessing Boolean  @default(true)
  latitude     Float?
  longitude    Float?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  energyData   EnergyTimeseries[]
  alerts       Alert[]
  settings     FacilitySetting[]
  cycles       Cycle[]
}

enum Line {
  BLOCK
  HEAD
  CRANK
  ASSEMBLY
}

enum FacilityType {
  PROCESSING
  COMPRESSOR
  UTILITY
}
```

#### tags (태그 마스터)
```prisma
model Tag {
  id           String   @id @default(uuid())
  code         String   @unique      // 태그 코드 (예: HNK10-020.POWER.KW)
  name         String                // 태그 명칭
  description  String?               // 설명

  // 계층 구조
  depth        Int                   // 1=라인, 2=설비, 3=태그
  parentId     String?               // 상위 태그 ID (계층 구조)
  parent       Tag?     @relation("TagHierarchy", fields: [parentId], references: [id])
  children     Tag[]    @relation("TagHierarchy")

  // 설비 연결
  facilityId   String?
  facility     Facility? @relation(fields: [facilityId], references: [id])

  // 태그 속성
  unit         String?               // 단위 (kW, L, %, etc.)
  dataType     TagDataType           // NUMERIC | STRING | BOOLEAN
  minValue     Float?                // 최소값 (검증용)
  maxValue     Float?                // 최대값 (검증용)

  // 관리 정보
  isActive     Boolean  @default(true)  // 활성화 상태
  samplingRate Int?                 // 샘플링 주기 (초 단위)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  dataPoints   TagDataRaw[]

  @@index([facilityId, isActive])
  @@index([parentId, depth])
}

enum TagDataType {
  NUMERIC
  STRING
  BOOLEAN
}

model Facility {
  // ... (기존 필드)
  tags         Tag[]     // 추가
}
```

**계층 구조 예시**:
```
depth=1: "4공장" (plant)
  depth=2: "블록" (line)
    depth=3: "HNK10-020" (facility)
      depth=4: "HNK10-020.POWER.KW" (tag)
      depth=4: "HNK10-020.AIR.FLOW" (tag)
```

### 4.2 시계열 테이블 (TimescaleDB Hypertable)

#### energy_timeseries
```prisma
model EnergyTimeseries {
  id           String   @id @default(uuid())
  timestamp    DateTime              // 15분 단위 기록
  facilityId   String
  facility     Facility @relation(fields: [facilityId], references: [id])

  // 전력 데이터
  powerKwh     Float                 // 전력 사용량 (kWh)
  powerPeak    Float?                // 피크 전력 (kW)
  voltage      Float?                // 전압 (V)
  current      Float?                // 전류 (A)
  imbalance    Float?                // 전압 불평형률 (%)
  powerFactor  Float?                // 역률 (%)
  frequency    Float?                // 주파수 (Hz)

  // 에어 데이터
  airL         Float?                // 에어 사용량 (L)
  airPressure  Float?                // 압력 (bar)
  airFlow      Float?                // 유량 (L/min)

  // 상태
  status       FacilityStatus @default(NORMAL)

  @@index([timestamp, facilityId])
  @@map("energy_timeseries")
}

enum FacilityStatus {
  NORMAL
  WARNING
  DANGER
  OFFLINE
}
```

**TimescaleDB 설정** (마이그레이션 후 수동 실행):
```sql
SELECT create_hypertable('energy_timeseries', 'timestamp');
CREATE INDEX ON energy_timeseries (facilityId, timestamp DESC);
```

#### tag_data_raw (태그 원본 데이터 - key-value)
```prisma
model TagDataRaw {
  id           String   @id @default(uuid())
  timestamp    DateTime              // 수집 시각 (실시간)
  tagId        String
  tag          Tag      @relation(fields: [tagId], references: [id])

  // Key-Value 데이터
  numericValue Float?                // 숫자형 데이터
  stringValue  String?               // 문자형 데이터
  booleanValue Boolean?              // 불린형 데이터

  // 품질 지표
  quality      DataQuality @default(GOOD)  // GOOD | BAD | UNCERTAIN
  collectorId  String?               // 수집기 ID (PLC/SCADA 구분)

  @@index([timestamp, tagId])
  @@map("tag_data_raw")
}

enum DataQuality {
  GOOD         // 정상
  BAD          // 불량 (센서 오류)
  UNCERTAIN    // 불확실 (통신 장애)
}
```

**TimescaleDB 설정**:
```sql
SELECT create_hypertable('tag_data_raw', 'timestamp');
CREATE INDEX ON tag_data_raw (tagId, timestamp DESC);
CREATE INDEX ON tag_data_raw (timestamp DESC) WHERE quality = 'GOOD';

-- 압축 정책 (7일 이후 데이터 압축)
SELECT add_compression_policy('tag_data_raw', INTERVAL '7 days');

-- 리텐션 정책 (90일 이후 데이터 삭제)
SELECT add_retention_policy('tag_data_raw', INTERVAL '90 days');
```

**데이터 수집 → 집계 Flow**:
```
1. PLC/SCADA → POST /tags/data/ingest
   → tag_data_raw (1초~1분 단위 원본)

2. Scheduler (매 15분)
   → Aggregate tag_data_raw (AVG, MAX, MIN)
   → energy_timeseries (15분 집계)

3. Cleanup
   → tag_data_raw (90일 보관)
   → energy_timeseries (5년 보관)
```

### 4.3 싸이클 데이터

#### cycles
```prisma
model Cycle {
  id           String   @id @default(uuid())
  facilityId   String
  facility     Facility @relation(fields: [facilityId], references: [id])

  startTime    DateTime
  endTime      DateTime
  duration     Int                   // 싸이클 타임 (초)

  totalEnergy  Float                 // 총 에너지 (kWh)
  peakPower    Float?                // 피크 전력 (kW)
  similarity   Float?                // 기준 파형 유사도 (%)
  delay        Int?                  // 타임 지연 (싸이클 수)

  status       CycleStatus @default(NORMAL)
  isReference  Boolean  @default(false)  // 기준 파형 여부

  waveform     CycleWaveform[]
  createdAt    DateTime @default(now())

  @@index([facilityId, startTime])
}

enum CycleStatus {
  NORMAL
  ANOMALY
  PENDING
}

model CycleWaveform {
  id        String @id @default(uuid())
  cycleId   String
  cycle     Cycle  @relation(fields: [cycleId], references: [id], onDelete: Cascade)

  second    Int               // 초 단위 (0~360)
  power     Float             // 전력 (W)

  @@index([cycleId, second])
  @@unique([cycleId, second])
}
```

### 4.4 알림 테이블

#### alerts
```prisma
model Alert {
  id           String   @id @default(uuid())
  type         AlertType
  facilityId   String
  facility     Facility @relation(fields: [facilityId], references: [id])

  timestamp    DateTime @default(now())
  severity     Severity
  status       AlertStatus @default(ACTIVE)

  // 전력 품질
  imbalance    Float?
  powerFactor  Float?
  voltage      Float?

  // 에어 누기
  baseline     Float?
  current      Float?
  ratio        Float?

  // 싸이클 이상
  cycleId      String?
  similarity   Float?
  deviation    Float?

  // 조치사항
  action       String?
  acknowledgedAt DateTime?
  resolvedAt   DateTime?

  @@index([type, facilityId, timestamp])
}

enum AlertType {
  POWER_QUALITY
  AIR_LEAK
  CYCLE_ANOMALY
  ENERGY_THRESHOLD
}

enum Severity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum AlertStatus {
  ACTIVE
  ACKNOWLEDGED
  RESOLVED
}
```

### 4.5 설정 테이블

#### facility_settings
```prisma
model FacilitySetting {
  id           String   @id @default(uuid())
  facilityId   String
  facility     Facility @relation(fields: [facilityId], references: [id])

  // 전력 품질 임계값
  imbalanceThreshold    Float?  // 불평형률 임계(%)
  powerFactorThreshold  Float?  // 역률 기준(%)

  // 에어 누기 기준
  airBaseline           Float?  // 비생산 에어 기준(L)
  airLeakThreshold      Float?  // 누기율 임계(%)

  // 싸이클 알림
  similarityThreshold   Float?  // 유사도 임계(%)
  delayThreshold        Int?    // 지연 허용(싸이클)

  // 에너지 알림
  monthlyThreshold      Float?  // 전월 대비 임계(%)
  yearlyThreshold       Float?  // 전년 대비 임계(%)

  // 싸이클당 에너지 알림
  cycleEnergyBaseline   Float?  // 싸이클당 기준(kWh)
  cycleEnergyThreshold  Float?  // 초과 임계(%)

  enabled      Boolean  @default(true)
  updatedAt    DateTime @updatedAt

  @@unique([facilityId])
}
```

---

## 5. 구현 우선순위

### Phase 1: Infrastructure (1일)
- [x] NestJS 프로젝트 초기화 (`apps/api/`)
- [x] Prisma 설정 + PostgreSQL 연결
- [x] Docker Compose (PostgreSQL + TimescaleDB)
- [x] 환경 변수 설정 (`.env`)
- [x] Swagger 설정 (`/api/docs`)

### Phase 2: Database Schema (2일)
- [x] Prisma 스키마 작성 (facilities, tags, tag_data_raw, energy_timeseries, cycles, alerts, settings)
- [x] 마이그레이션 생성 및 실행
- [x] TimescaleDB Hypertable 설정 (tag_data_raw, energy_timeseries)
- [x] Seed 데이터 (설비 마스터 13개)
- [x] 태그 임포트 (`화성PT4공장_TagList.xlsx` → tags 테이블)

### Phase 3: Monitoring Module (2일)
- [x] GET `/monitoring/overview`
- [x] GET `/monitoring/line/detail`
- [x] GET `/monitoring/energy/ranking`
- [x] GET `/monitoring/energy/alert`
- [x] GET `/monitoring/power-quality`
- [x] GET `/monitoring/air-leak`

### Phase 4: Dashboard Module (2일)
- [x] 8개 엔드포인트 구현
- [x] 집계 쿼리 최적화 (TimescaleDB 활용)

### Phase 5: Alerts Module (2일)
- [x] 통계 API 3개 (ALT-001~003)
- [x] 이력 API 3개 (ALT-004~006)
- [x] 조치사항 저장 (`PUT /alerts/:id/action`)

### Phase 6: Analysis Module (2일)
- [x] 설비 트리 + 비교 분석 API
- [x] 싸이클 분석 API (파형 데이터 포함)

### Phase 7: Settings Module (1일)
- [x] 6개 설정 CRUD API

### Phase 8: Tags Module (2일)
- [x] 태그 CRUD API (생성/수정/삭제/조회)
- [x] 태그 트리 API (`GET /tags/tree`)
- [x] 엑셀 임포트/내보내기 (`POST /tags/import`, `GET /tags/export`)
- [x] 태그 데이터 수집 API (`POST /tags/data/ingest`)
- [x] 태그 시계열 조회 API (`POST /tags/data/timeseries`)
- [x] 태그 최신 데이터 API (`GET /tags/data/latest`)
- [x] 태그 관리 화면 (TAG-001) 구현

### Phase 9: Integration & Testing (1일)
- [x] Frontend `VITE_USE_MOCK=false` 전환
- [x] E2E 테스트 (32+1화면 동작 확인)
- [x] 성능 테스트 (응답 시간 < 200ms 목표)
- [x] 태그 데이터 수집 → 집계 → 화면 표시 End-to-End 검증

**총 예상 기간**: 15일

---

## 6. 비기능 요구사항

### 6.1 성능
- API 응답 시간: < 200ms (P95)
- TimescaleDB 집계 쿼리: < 100ms
- 동시 접속: 50명 지원

### 6.2 확장성
- 설비 추가 시 마이그레이션 없이 데이터만 추가
- 시계열 데이터 자동 파티셔닝 (월 단위)
- Hypertable 압축 정책 (30일 이후 데이터)

### 6.3 보안
- JWT 인증 (향후 추가)
- CORS 설정 (localhost:5173 허용)
- SQL Injection 방지 (Prisma ORM)

### 6.4 모니터링
- NestJS Logger (Winston)
- 요청/응답 로그 (morgan)
- 에러 추적 (Sentry, 선택)

---

## 7. 환경 변수 설계

`.env` 파일 구조:
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/ifems"

# Server
PORT=4000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:1420

# JWT (향후)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1d

# TimescaleDB
TIMESCALE_ENABLED=true
TIMESCALE_CHUNK_INTERVAL=7 days

# Logging
LOG_LEVEL=debug
```

---

## 8. 테스트 전략

### 8.1 Unit Tests (Jest)
- Service 로직 테스트 (비즈니스 로직)
- DTO 검증 테스트 (class-validator)

### 8.2 Integration Tests
- Controller + Service + Prisma (실제 DB 연결)
- API 엔드포인트 E2E 테스트

### 8.3 Performance Tests
- Apache Bench (간단한 부하 테스트)
- TimescaleDB 집계 쿼리 성능 측정

---

## 9. 리스크 및 대응

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| TimescaleDB 설정 복잡도 | 중 | 공식 문서 참조 + Docker Compose 예제 활용 |
| 시계열 데이터 볼륨 증가 | 고 | 압축 정책 + 파티셔닝 + 리텐션 자동화 (tag_data_raw 90일) |
| Frontend 통합 오류 | 중 | Mock 데이터 구조와 API 응답 스키마 일치 유지 |
| 성능 목표 미달 | 중 | 인덱스 최적화 + 쿼리 튜닝 |
| 태그 엑셀 임포트 오류 | 중 | 계층 구조(DEPTH) 검증 + 중복 체크 + 트랜잭션 처리 |
| PLC/SCADA 연동 복잡도 | 고 | 데이터 수집 API 표준화 + 에러 핸들링 강화 |

---

## 10. 다음 단계

1. **Design 문서 작성** (`/pdca design ifems-backend`)
   - 상세 API 명세 (Request/Response DTO)
   - Prisma 스키마 전체 작성
   - 폴더 구조 및 모듈 의존성 다이어그램

2. **구현 시작** (`/pdca do ifems-backend`)
   - NestJS 프로젝트 생성
   - Docker Compose 설정
   - Prisma 마이그레이션

3. **갭 분석** (`/pdca analyze ifems-backend`)
   - Design 문서 vs 실제 구현 비교

---

## 11. 참고 자료

- [PLAN.md](../../PLAN.md) — 전체 프로젝트 계획
- [CLAUDE.md](../../CLAUDE.md) — 협업 지침서
- `apps/web/src/services/mock/` — Mock 데이터 구조 참조
- **`Tag/화성PT4공장_TagList.xlsx`** — 실제 태그 목록 (DEPTH 계층 구조)
- [TimescaleDB Docs](https://docs.timescale.com/)
- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs)

---

*작성일: 2026-02-20*
*작성자: Claude Code + 사용자 협업*
