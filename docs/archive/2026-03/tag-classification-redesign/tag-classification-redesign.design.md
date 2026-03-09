# 태그 분류 체계 재설계 (Tag Classification Redesign)

> **Version**: 1.0
> **작성일**: 2026-03-04
> **상태**: Design Phase
> **선행 문서**: TAG-DATA-SPEC.md, TAG_MANAGEMENT_DESIGN.md, schema.prisma

---

## 1. 배경 및 문제 정의

### 1.1 현재 분류 체계의 한계

현재 태그 분류는 **2축** 구조이나 의미가 모호합니다:

```
현재:
  TagType  = TREND | USAGE | SENSOR       (3개 — Prisma enum)
  DataType = T (Trend) | Q (Quality)      (2개 — Prisma enum)
```

**문제점:**

| 문제 | 설명 |
|------|------|
| **TREND 과부하** | TREND가 "에너지 순시"와 "품질 순시"를 모두 포함 → 2,547개 중 어떤 것이 에너지이고 품질인지 TagType만으로 구분 불가 |
| **DataType 숨겨진 역할** | T/Q가 실질적으로 에너지/품질을 구분하지만, 이름(Trend/Quality)이 물리적 의미와 불일치 |
| **OPERATE/CONTROL 부재** | 가동 태그, 제어 태그가 Prisma enum에 없음 (TAG-DATA-SPEC.md에만 정의) |
| **사용량 계산 로직 혼재** | "사용량"이 태그 속성(USAGE)인지 계산 결과(적산의 차분)인지 불명확 |
| **순시→사용량 추정 불가** | 적산 태그 없는 설비에서 순시 태그로 사용량을 추정하는 경로가 없음 |

### 1.2 목표

1. **물리적 측정 방식**과 **도메인 용도**를 분리하여 명확한 2축 분류 체계 구축
2. **사용량 계산**을 태그 속성이 아닌 **쿼리 시점 계산**으로 분리
3. **설비별 에너지 사용량 계산 소스**를 명시적으로 관리하는 매핑 테이블 도입
4. 기존 엑셀 데이터(3,107개)와 **100% 호환**되는 마이그레이션 경로 확보

---

## 2. 신규 분류 체계 설계

### 2.1 2-Layer 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: 태그 속성 (Tag Attributes)                         │
│  ─ 태그 자체의 물리적 특성. DB에 저장, 변경 드뭄              │
│                                                              │
│  measureType  : 측정 방식 (어떻게 측정하는가?)               │
│  category     : 도메인 용도 (왜 측정하는가?)                 │
│  energyType   : 에너지원 (무엇을 측정하는가?)               │
│  unit         : 단위 (어떤 단위인가?)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Layer 2: 계산 규칙 (Calculation Rules)                      │
│  ─ API 쿼리 시점에 적용. 태그에 저장하지 않음                 │
│                                                              │
│  집계 방식   : LAST, DIFF, AVG, SUM, MAX, MIN, RAW          │
│  사용량 소스 : facility_energy_config 매핑 테이블로 관리      │
│  적용 시점   : API 파라미터 (interval, calcMethod)           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Layer 1 — 태그 속성 상세

#### 2.2.1 measureType (측정 방식)

| 값 | 한국어 | 설명 | 집계 기본값 | 예시 |
|----|--------|------|-------------|------|
| `INSTANTANEOUS` | 순시 | 특정 시점의 즉시값 | LAST (마지막 값) | 전력(kW), 유량(m³/min), 불평형률(%), 역률(%) |
| `CUMULATIVE` | 적산 | 시간에 따라 누적되는 값 | DIFF (차분) | 전력량(kWh), 에어 적산량(m³) |
| `DISCRETE` | 이산 | 0/1 또는 유한 상태값 | SUM (합산) | 가동(0/1), 알람(0/1) |

#### 2.2.2 category (도메인 용도)

| 값 | 한국어 | 설명 | 하위 항목 예시 |
|----|--------|------|---------------|
| `ENERGY` | 에너지 | 에너지 생산/소비 관련 | 전력(kW/kWh), 에어(m³/min, m³), 가스, 태양광 |
| `QUALITY` | 품질 | 에너지 품질 지표 | 불평형률(%), 역률(%), 고조파(%), 주파수(Hz), 에어 누기율(%) |
| `ENVIRONMENT` | 환경 | 설비 주변 환경 | 온도(℃), 습도(%), 압력(bar), 진동(mm/s) |
| `OPERATION` | 가동 | 설비 운전 상태 | 가동(0/1), 가동시간(s), 가동률(%) |
| `CONTROL` | 제어 | 설정/제어값 | 목표온도, 설정압력, 속도 설정값 |

#### 2.2.3 energyType (에너지원)

기존과 동일, 확장 가능:

| 값 | 한국어 | 단위 (순시/적산) |
|----|--------|-----------------|
| `elec` | 전력 | kW / kWh |
| `air` | 에어 | m³/min / m³ |
| `gas` | 가스 | m³/min / m³ |
| `solar` | 태양광 | kW / kWh |

> **규칙**: `category = ENERGY`인 경우에만 `energyType` 필수. 나머지는 null.

### 2.3 Layer 2 — 계산 규칙 상세

#### 2.3.1 집계 방식 (Aggregation Method)

API 쿼리 파라미터로 전달. 태그에 저장하지 않음.

| 방식 | 설명 | 적용 대상 | API 파라미터 |
|------|------|----------|-------------|
| `RAW` | 원본값 그대로 | 모든 태그 | `calc=raw` |
| `LAST` | 구간 마지막 값 | INSTANTANEOUS | `calc=last` (기본값) |
| `DIFF` | 구간 차분 (end - start) | CUMULATIVE | `calc=diff` (기본값) |
| `AVG` | 구간 평균 | INSTANTANEOUS (환경) | `calc=avg` |
| `SUM` | 구간 합산 | DISCRETE | `calc=sum` (기본값) |
| `MAX` | 구간 최대값 | INSTANTANEOUS | `calc=max` |
| `MIN` | 구간 최소값 | INSTANTANEOUS | `calc=min` |
| `INTEGRAL_TRAP` | 사다리꼴 적분 (순시→사용량) | INSTANTANEOUS (에너지) | `calc=integral` |

> **기본값 규칙**: measureType별 기본 집계 방식이 자동 적용됨. 명시적 요청 시 다른 방식도 가능.

#### 2.3.2 사용량 계산 우선순위

설비의 에너지 사용량(kWh, m³)을 계산할 때의 소스 태그 결정 순서:

```
우선순위 1: CUMULATIVE 태그 → DIFF 계산 (가장 정확)
우선순위 2: INSTANTANEOUS 태그 → INTEGRAL_TRAP 추정 (적산 태그 없는 설비용)
```

> **핵심**: 이 결정은 자동 판단하지 않음. `facility_energy_config` 매핑 테이블에 관리자가 명시적으로 지정.

---

## 3. 데이터베이스 스키마 변경

### 3.1 Enum 변경

```prisma
// ─── 변경 전 (현재) ───
enum TagType {
  TREND
  USAGE
  SENSOR
}

enum TagDataType {
  T
  Q
}

// ─── 변경 후 (신규) ───
enum MeasureType {
  INSTANTANEOUS   // 순시값 (특정 시점의 즉시 측정)
  CUMULATIVE      // 적산값 (시간에 따라 누적)
  DISCRETE        // 이산값 (0/1, 유한 상태)
}

enum TagCategory {
  ENERGY          // 에너지 생산/소비
  QUALITY         // 에너지 품질 지표
  ENVIRONMENT     // 설비 주변 환경
  OPERATION       // 설비 운전 상태
  CONTROL         // 설정/제어값
}
```

### 3.2 Tag 모델 변경

```prisma
// ─── 변경 전 ───
model Tag {
  id          String      @id @default(uuid())
  facilityId  String
  facility    Facility    @relation(...)
  tagName     String      @unique
  displayName String
  tagType     TagType               // TREND | USAGE | SENSOR
  energyType  EnergyType?           // elec | air
  dataType    TagDataType           // T | Q
  unit        String?
  order       Int         @default(0)
  isActive    Boolean     @default(true)
  // ...
}

// ─── 변경 후 ───
model Tag {
  id            String        @id @default(uuid())
  facilityId    String
  facility      Facility      @relation(...)
  tagName       String        @unique
  displayName   String
  measureType   MeasureType             // INSTANTANEOUS | CUMULATIVE | DISCRETE
  category      TagCategory             // ENERGY | QUALITY | ENVIRONMENT | OPERATION | CONTROL
  energyType    EnergyType?             // elec | air | gas | solar (category=ENERGY일 때만)
  unit          String?
  order         Int           @default(0)
  isActive      Boolean       @default(true)

  // ─── 삭제 ───
  // tagType     TagType      → measureType으로 대체
  // dataType    TagDataType  → category로 대체

  // ...기존 relation 유지
}
```

### 3.3 EnergyType Enum 확장

```prisma
// ─── 변경 전 ───
enum EnergyType {
  elec
  air
}

// ─── 변경 후 ───
enum EnergyType {
  elec    // 전력
  air     // 에어
  gas     // 가스 (향후)
  solar   // 태양광 (향후)
}
```

### 3.4 facility_energy_config (신규 테이블)

설비별 에너지 사용량 계산 소스를 명시적으로 관리:

```prisma
enum CalcMethod {
  DIFF            // 적산 태그의 차분 (end - start)
  INTEGRAL_TRAP   // 순시 태그의 사다리꼴 적분
}

model FacilityEnergyConfig {
  id            String      @id @default(uuid())
  facilityId    String
  facility      Facility    @relation(fields: [facilityId], references: [id], onDelete: Cascade)
  energyType    EnergyType  // elec | air

  // 사용량 계산 소스 태그
  usageTagId    String
  usageTag      Tag         @relation("UsageSourceTag", fields: [usageTagId], references: [id])
  calcMethod    CalcMethod  // DIFF(적산) | INTEGRAL_TRAP(순시)

  // 관리
  description   String?     @db.Text   // 설정 사유
  configuredBy  String?     @db.VarChar(100) // 설정자
  since         DateTime    @default(now())  // 적용 시작일
  isActive      Boolean     @default(true)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([facilityId, energyType])   // 설비당 에너지타입별 1개
  @@index([facilityId])
  @@index([usageTagId])
  @@map("facility_energy_configs")
}
```

### 3.5 facility_energy_config_history (변경 이력)

사용량 계산 소스 변경 시 이력 관리 (데이터 연속성 추적):

```prisma
model FacilityEnergyConfigHistory {
  id              String      @id @default(uuid())
  facilityId      String
  energyType      EnergyType

  // 변경 내용
  prevTagId       String?     // 이전 소스 태그
  prevCalcMethod  CalcMethod? // 이전 계산 방식
  newTagId        String      // 새 소스 태그
  newCalcMethod   CalcMethod  // 새 계산 방식

  // 메타
  reason          String?     @db.Text
  changedBy       String?     @db.VarChar(100)
  changedAt       DateTime    @default(now())

  @@index([facilityId, changedAt])
  @@map("facility_energy_config_histories")
}
```

### 3.6 Facility 모델 relation 추가

```prisma
model Facility {
  // ... 기존 필드 유지 ...

  // 추가 relation
  energyConfigs FacilityEnergyConfig[]
}

model Tag {
  // ... 기존 relation 유지 ...

  // 추가 relation
  usageConfigs  FacilityEnergyConfig[] @relation("UsageSourceTag")
}
```

### 3.7 전체 스키마 변경 요약

| 항목 | 변경 유형 | 상세 |
|------|----------|------|
| `TagType` enum | **삭제** | → `MeasureType` enum으로 대체 |
| `TagDataType` enum | **삭제** | → `TagCategory` enum으로 대체 |
| `MeasureType` enum | **신규** | INSTANTANEOUS, CUMULATIVE, DISCRETE |
| `TagCategory` enum | **신규** | ENERGY, QUALITY, ENVIRONMENT, OPERATION, CONTROL |
| `CalcMethod` enum | **신규** | DIFF, INTEGRAL_TRAP |
| `EnergyType` enum | **수정** | gas, solar 추가 |
| `Tag` 모델 | **수정** | tagType→measureType, dataType→category |
| `FacilityEnergyConfig` | **신규** | 설비별 사용량 계산 소스 매핑 |
| `FacilityEnergyConfigHistory` | **신규** | 변경 이력 |
| `Facility` 모델 | **수정** | energyConfigs relation 추가 |

---

## 4. 엑셀 데이터 마이그레이션

### 4.1 매핑 규칙

기존 엑셀 데이터(3,107개)는 아래 규칙으로 **100% 자동 변환** 가능:

| 엑셀 TAG_TYPE | 엑셀 DATA_TYPE | → measureType | → category | 태그 수 |
|---|---|---|---|---|
| TREND | T (Trend) | `INSTANTANEOUS` | `ENERGY` | ~1,275 |
| TREND | Q (Quality) | `INSTANTANEOUS` | `QUALITY` | ~1,272 |
| USAGE | T (Trend) | `CUMULATIVE` | `ENERGY` | 530 |
| SENSOR | * | `INSTANTANEOUS` | `ENVIRONMENT` | 30 |

> **검증**: 1,275 + 1,272 + 530 + 30 = **3,107** (전체 매핑 완료)

### 4.2 energyType 매핑

기존 `energyType` 필드는 그대로 유지:

| 엑셀 ENERGY_TYPE | → energyType | 태그 수 |
|---|---|---|
| elec | `elec` | 2,307 |
| air | `air` | 800 |

### 4.3 unit 자동 추론

```
INSTANTANEOUS + ENERGY + elec → kW
CUMULATIVE    + ENERGY + elec → kWh
INSTANTANEOUS + ENERGY + air  → m³/min
CUMULATIVE    + ENERGY + air  → m³
INSTANTANEOUS + QUALITY       → % (불평형률, 역률 등)
INSTANTANEOUS + ENVIRONMENT   → ℃, %, bar (태그명에서 추론)
```

### 4.4 facility_energy_config 자동 생성

태그 적재 후 매핑 테이블을 자동 초기 생성:

```
규칙:
1. 설비에 CUMULATIVE + elec 태그 존재 → calcMethod: DIFF
2. 설비에 CUMULATIVE + air 태그 존재  → calcMethod: DIFF
3. CUMULATIVE 없고 INSTANTANEOUS만 → calcMethod: INTEGRAL_TRAP (⚠️ 관리자 확인 필요 플래그)
4. 에너지 태그 없는 설비 → 매핑 생성 안 함
```

### 4.5 마이그레이션 스크립트 흐름

```
Step 1: Prisma Schema 변경 → migrate dev
   - MeasureType, TagCategory, CalcMethod enum 생성
   - FacilityEnergyConfig, FacilityEnergyConfigHistory 테이블 생성
   - Tag 모델: tagType→measureType, dataType→category 컬럼 변경

Step 2: 기존 Tag 데이터 변환 (0건이므로 단순)
   - 현재 tags 테이블 0행 → 컬럼 변경만으로 완료

Step 3: Excel 파싱 → tags 3,107건 INSERT
   - TAG_TYPE + DATA_TYPE → measureType + category 변환
   - energyType, unit 그대로
   - facilityId: 설비코드 → UUID 조회

Step 4: facility_energy_config 자동 생성
   - 설비별 CUMULATIVE 태그 탐색 → DIFF 매핑 생성
   - CUMULATIVE 없는 설비 → INTEGRAL_TRAP 매핑 생성 + needsReview 플래그

Step 5: 검증
   - tags: 3,107건
   - facility_energy_configs: ~650건 (325설비 × 2에너지타입, 태그 있는 것만)
   - 매핑 누락 설비 리포트 출력
```

---

## 5. API 영향 분석

### 5.1 기존 API 변경 필요 사항

#### 5.1.1 사용량 조회 API (영향 큼)

현재 사용량 계산은 `EnergyTimeseries.powerKwh` 등 집계 테이블 값을 직접 사용.
재설계 후에는 `facility_energy_config`를 참조하여 계산 방식 결정.

```typescript
// 변경 전: 집계 테이블 직접 조회
const usage = await prisma.energyTimeseries.findMany({
  where: { facilityId, timestamp: { gte: start, lte: end } },
  select: { powerKwh: true, airL: true }
});

// 변경 후: 매핑 테이블 → 소스 태그 → 계산 방식 적용
async function getUsage(facilityId: string, energyType: EnergyType, start: Date, end: Date) {
  const config = await prisma.facilityEnergyConfig.findUnique({
    where: { facilityId_energyType: { facilityId, energyType } },
    include: { usageTag: true }
  });

  if (!config) return null;

  switch (config.calcMethod) {
    case 'DIFF':
      return calcDiff(config.usageTag.tagName, start, end);
    case 'INTEGRAL_TRAP':
      return calcIntegralTrap(config.usageTag.tagName, start, end);
  }
}
```

#### 5.1.2 태그 조회 API (영향 중간)

| 엔드포인트 | 변경 사항 |
|-----------|----------|
| `GET /settings/tag` | Query 파라미터: `tagType` → `measureType`, `dataType` → `category` |
| `GET /settings/tag/bulk` | Excel 파싱 시 신규 매핑 규칙 적용 |
| `GET /analysis/facility/tree` | 태그 분류 기준 변경 |

#### 5.1.3 Frontend 서비스 레이어 (영향 낮음)

서비스 레이어는 API 응답만 소비하므로, 백엔드가 기존 응답 키를 유지하면 변경 불필요.
단, 필터 UI에서 `tagType` → `measureType`, `dataType` → `category` 변경 필요.

### 5.2 신규 API

#### 5.2.1 사용량 계산 소스 관리 API

```
GET    /api/settings/energy-config                  // 전체 매핑 목록
GET    /api/settings/energy-config/:facilityId      // 설비별 매핑
PUT    /api/settings/energy-config/:facilityId      // 매핑 수정
GET    /api/settings/energy-config/history/:facilityId  // 변경 이력
POST   /api/settings/energy-config/auto-generate    // 자동 생성 (태그 기반)
```

#### 5.2.2 사용량 계산 소스 관리 DTO

```typescript
// GET 응답
interface FacilityEnergyConfigResponse {
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  configs: {
    energyType: 'elec' | 'air';
    usageTag: {
      id: string;
      tagName: string;
      displayName: string;
      measureType: 'INSTANTANEOUS' | 'CUMULATIVE';
    };
    calcMethod: 'DIFF' | 'INTEGRAL_TRAP';
    since: string; // ISO8601
    needsReview: boolean; // INTEGRAL_TRAP인 경우 true
  }[];
}

// PUT 요청
interface UpdateEnergyConfigDto {
  energyType: 'elec' | 'air';
  usageTagId: string;
  calcMethod: 'DIFF' | 'INTEGRAL_TRAP';
  reason?: string;
}
```

---

## 6. 관리 UI 설계

### 6.1 SET-014: 에너지 사용량 소스 관리 (신규)

**URL**: `/settings/energy-source`

**레이아웃**:

```
┌─────────────────────────────────────────────────────────────┐
│  에너지 사용량 소스 관리                           [자동 설정] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  필터: [라인 ▼] [에너지원 ▼] [계산방식 ▼] [확인필요 ☑]     │
│                                                              │
│  ┌─────────┬──────┬──────────────┬──────────┬──────┬─────┐  │
│  │ 설비코드 │에너지│ 소스 태그     │ 계산 방식 │ 적용일│ 상태│  │
│  ├─────────┼──────┼──────────────┼──────────┼──────┼─────┤  │
│  │HNK10-010│ 전력 │ *_KWH_1      │ 차분(적산)│03-04 │ ✅  │  │
│  │HNK10-010│ 에어 │ *_AIR_L_1    │ 차분(적산)│03-04 │ ✅  │  │
│  │HNK10-020│ 전력 │ *_POWER_1    │ 적분(순시)│03-04 │ ⚠️  │  │
│  │HNK10-020│ 에어 │ ─            │ ─        │ ─   │ ❌  │  │
│  └─────────┴──────┴──────────────┴──────────┴──────┴─────┘  │
│                                                              │
│  상태: ✅ 적산(정확) │ ⚠️ 순시추정(확인필요) │ ❌ 미설정    │
└─────────────────────────────────────────────────────────────┘
```

**기능**:

1. **목록 조회**: 설비별 에너지 사용량 계산 소스 현황 (필터링, 페이징)
2. **소스 변경**: 행 클릭 → 모달에서 소스 태그/계산 방식 변경
3. **자동 설정**: 태그 기반으로 매핑 자동 생성 (기존 매핑 유지, 미설정만 추가)
4. **변경 이력**: 설비 클릭 시 하단에 변경 이력 표시
5. **대시보드**: 상단에 통계 카드 (총 설비 수, 적산 매핑, 순시 추정, 미설정)

**소스 변경 모달**:

```
┌────────────────────────────────────────┐
│  소스 태그 변경 — HNK10-020 (전력)     │
├────────────────────────────────────────┤
│                                        │
│  현재 설정:                            │
│    태그: HNK10_020_POWER_1 (순시, kW)  │
│    방식: 사다리꼴 적분 (INTEGRAL_TRAP)  │
│                                        │
│  사용 가능한 태그:                      │
│  ○ HNK10_020_KWH_1 (적산, kWh)  [추천] │
│  ● HNK10_020_POWER_1 (순시, kW)        │
│                                        │
│  계산 방식:                            │
│  ● 차분 (DIFF) — 적산 태그 선택 시     │
│  ○ 사다리꼴 적분 (INTEGRAL_TRAP)       │
│                                        │
│  변경 사유: [________________]          │
│                                        │
│           [취소]  [변경 저장]           │
└────────────────────────────────────────┘
```

### 6.2 기존 SET-012 (태그 마스터) 변경

| 현재 | 변경 후 |
|------|---------|
| tagType 필터 (TREND/USAGE/SENSOR) | measureType 필터 (순시/적산/이산) |
| dataType 필터 (T/Q) | category 필터 (에너지/품질/환경/가동/제어) |
| 태그 등록 시 tagType 선택 | measureType + category 선택 |

---

## 7. 설비당 태그 구성 예시

### 7.1 전형적인 가공 설비 (MC, HNK10-010-1)

```
HNK10-010-1
├── ENERGY (에너지)
│   ├── [INSTANTANEOUS] HNK10_010_1_POWER_1  → 전력 (kW)
│   ├── [CUMULATIVE]    HNK10_010_1_KWH_1    → 전력량 (kWh)  ← 사용량 소스
│   ├── [INSTANTANEOUS] HNK10_010_1_AIR_F_1  → 에어 유량 (m³/min)
│   └── [CUMULATIVE]    HNK10_010_1_AIR_L_1  → 에어 적산량 (m³) ← 사용량 소스
│
├── QUALITY (품질)
│   ├── [INSTANTANEOUS] HNK10_010_1_IMB_1    → 불평형률 (%)
│   ├── [INSTANTANEOUS] HNK10_010_1_PF_1     → 역률 (%)
│   └── [INSTANTANEOUS] HNK10_010_1_HARM_1   → 고조파 (%)
│
├── ENVIRONMENT (환경)
│   ├── [INSTANTANEOUS] HNK10_010_1_TEMP_1   → 온도 (℃)
│   └── [INSTANTANEOUS] HNK10_010_1_HUM_1    → 습도 (%)
│
├── OPERATION (가동)
│   └── [DISCRETE]      HNK10_010_1_RUN_1    → 가동 (0/1)
│
└── CONTROL (제어)
    └── [INSTANTANEOUS] HNK10_010_1_SPD_1    → 속도 설정 (rpm)
```

### 7.2 facility_energy_config

```
facilityId: HNK10-010-1
├── elec → usageTag: HNK10_010_1_KWH_1, calcMethod: DIFF
└── air  → usageTag: HNK10_010_1_AIR_L_1, calcMethod: DIFF
```

### 7.3 적산 태그 없는 설비 예시 (HNK10-020)

```
HNK10-020
├── ENERGY
│   ├── [INSTANTANEOUS] HNK10_020_POWER_1  → 전력 (kW)
│   └── (적산 태그 없음)
│
└── facility_energy_config:
    └── elec → usageTag: HNK10_020_POWER_1, calcMethod: INTEGRAL_TRAP ⚠️
```

---

## 8. 화면별 데이터 흐름 (변경 전후 비교)

### 8.1 MON-001 종합 현황 — 사용량 KPI

```
변경 전:
  API → EnergyTimeseries.powerKwh (집계 테이블 직접)

변경 후:
  API → facility_energy_config 조회
      → config.calcMethod에 따라:
        DIFF: tag_data_raw에서 start/end 값 차분
        INTEGRAL_TRAP: tag_data_raw에서 사다리꼴 적분
      → 결과 반환 (기존 응답 키 유지: totalPower.value)
```

### 8.2 MON-002 라인별 상세 — 트렌드 차트

```
변경 없음:
  - 트렌드 차트는 순시값(INSTANTANEOUS) 표시
  - 기존 series key (power, prevPower, air, prevAir) 유지
  - 백엔드 내부에서 measureType=INSTANTANEOUS + category=ENERGY로 필터
```

### 8.3 DSH-001 에너지 사용 추이 — 월별 사용량

```
변경 전:
  API → EnergyTimeseries 월별 SUM(powerKwh)

변경 후:
  API → facility_energy_config 참조
      → 설비별 사용량 계산 (DIFF or INTEGRAL_TRAP)
      → 월별 집계
      → 응답 키 유지: { month, power, prevPower, air, prevAir }
```

---

## 9. 구현 우선순위

### Phase 1: 스키마 변경 + 마이그레이션 (1일)
1. Prisma enum 변경 (MeasureType, TagCategory, CalcMethod)
2. Tag 모델 필드 변경 (tagType→measureType, dataType→category)
3. FacilityEnergyConfig + History 테이블 생성
4. migrate dev 실행

### Phase 2: 데이터 적재 (1일)
1. Excel 파싱 스크립트 (TAG_TYPE+DATA_TYPE → measureType+category)
2. tags 3,107건 INSERT
3. facility_energy_config 자동 생성
4. 검증 스크립트 실행

### Phase 3: 백엔드 API 수정 (2일)
1. 기존 태그 조회 API 수정 (필터 파라미터 변경)
2. 사용량 계산 로직 변경 (config 참조 방식)
3. 신규 energy-config CRUD API
4. DTO + Swagger 문서화

### Phase 4: 프론트엔드 수정 (1일)
1. SET-012 태그 마스터 필터 UI 변경
2. SET-014 에너지 소스 관리 신규 화면
3. 서비스 레이어 파라미터 수정

### Phase 5: 검증 + 정리 (1일)
1. 전체 화면 동작 확인 (32화면)
2. Gap Analysis
3. 문서 업데이트

**총 예상**: ~6일

---

## 10. 참고: 삭제되는 Enum/필드

| 삭제 대상 | 이유 | 대체 |
|----------|------|------|
| `TagType` enum (TREND/USAGE/SENSOR) | `MeasureType`으로 대체 | INSTANTANEOUS/CUMULATIVE/DISCRETE |
| `TagDataType` enum (T/Q) | `TagCategory`로 대체 | ENERGY/QUALITY/ENVIRONMENT/OPERATION/CONTROL |
| `Tag.tagType` 필드 | 위와 동일 | `Tag.measureType` |
| `Tag.dataType` 필드 | 위와 동일 | `Tag.category` |

---

**다음 단계**: Phase 1 스키마 마이그레이션 시작 (`prisma migrate dev --name tag-classification-redesign`)
