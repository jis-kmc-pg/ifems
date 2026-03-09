# i-FEMS 태그 데이터 사양서 (Tag Data Specification)

> **필독**: 이 문서는 i-FEMS 시스템의 핵심 도메인 지식입니다.
> Mock 데이터 생성, 집계 로직, 화면 표시 등 모든 데이터 처리에 적용됩니다.

## 📋 개요

화성PT4공장 태그 목록 (`Tag/화성PT4공장_TagList.xlsx`)을 기반으로 한 태그 데이터 구조 및 계산 로직 정의.

### 용어 매핑 (2026-03-04 재설계)

> **DB 스키마**에서는 아래 enum을 사용합니다. 이 문서의 TREND/USAGE 등은 **도메인 개념명**입니다.

| 도메인 개념 | DB MeasureType | DB TagCategory | 태그 수 |
|------------|---------------|----------------|---------|
| TREND (순시) | `INSTANTANEOUS` | `ENERGY` | 767 |
| USAGE (적산) | `CUMULATIVE` | `ENERGY` | 510 |
| OPERATE (가동) | `DISCRETE` | `OPERATION` | - |
| SENSOR (센서) | `INSTANTANEOUS` | `ENVIRONMENT` | 30 |
| CONTROL (제어) | `DISCRETE` | `CONTROL` | - |
| 품질 (전력품질) | `INSTANTANEOUS` | `QUALITY` | 1,800 |

**CalcMethod** (사용량 계산 방식): `DIFF` (적산 차분) | `INTEGRAL_TRAP` (순시 적분)

---

## 🏷️ 태그 종류 (Tag Type)

### 1. TREND (순시값)
**정의**: 특정 시점의 즉시 측정값 (Instantaneous Value)

**계산 로직**:
- **1초 데이터**: 측정된 값 그대로 저장
- **1분 집계**: **60초 시점의 마지막 값** 사용
- **예시**: 60초 데이터 = 3.45 kW → 1분 데이터 = 3.45 kW

**용도**: 전력(kW), 에어 유량(m³/min) 등 실시간 모니터링

```typescript
// 1분 집계 로직
const aggregatedValue = rawData[59]; // 60초 시점 (인덱스 59)
```

---

### 2. USAGE (적산값)
**정의**: 누적 사용량 (Cumulative Value)

**계산 로직**:
- **1초 데이터**: 누적 증가하는 값 (예: 100.00 kWh → 100.01 kWh → 100.02 kWh)
- **1분 집계**: **차분 계산** (60초 값 - 0초 값)
- **예시**:
  - 0초 = 100.00 kWh
  - 60초 = 100.50 kWh
  - 1분 사용량 = **0.50 kWh**

**용도**: 전력량(kWh), 에어 사용량(m³) 등 에너지 소비량 측정

**⚠️ 주의사항**:
- USAGE 태그는 **절대 리셋되지 않음** (계속 증가)
- 음수 차분은 무시 (센서 오류 또는 리셋)
- 차분값이 비정상적으로 크면 데이터 검증 필요

```typescript
// 1분 집계 로직
const startValue = rawData[0];   // 0초 시점
const endValue = rawData[59];    // 60초 시점
const usage = endValue - startValue; // 차분 계산

if (usage < 0 || usage > MAX_THRESHOLD) {
  return null; // 비정상 데이터
}
```

---

### 3. OPERATE (가동)
**정의**: 설비 가동 상태 (0=정지, 1=가동)

**계산 로직**:
- **1초 데이터**: 0 또는 1
- **1분 집계**: **0초~60초 사이의 합산** (가동 시간)
- **예시**:
  - 40초 동안 1, 20초 동안 0
  - 1분 가동 시간 = **40초**

**용도**: 가동률 계산, 비가동 시간 분석

```typescript
// 1분 집계 로직
const operatingSeconds = rawData.reduce((sum, val) => sum + (val ? 1 : 0), 0);
const operatingRate = (operatingSeconds / 60) * 100; // %
```

---

### 4. SENSOR (센서)
**정의**: 센서 측정값 (온도, 압력, 습도 등)

**계산 로직**:
- **1초 데이터**: 측정된 값 그대로 저장
- **1분 집계**: **0초~60초 사이의 평균값**
- **예시**: 60개 데이터의 평균 = 25.3°C

**용도**: 환경 모니터링, 이상 탐지

```typescript
// 1분 집계 로직
const validData = rawData.filter(v => v !== null && !isNaN(v));
const average = validData.reduce((sum, v) => sum + v, 0) / validData.length;
```

---

### 5. CONTROL (제어)
**정의**: 제어 명령값 (설정값, 목표값 등)

**계산 로직**: 집계하지 않음 (화면에 표시되지 않음)

**용도**: PLC 제어, 내부 로직

---

## ⚡ 에너지 종류 (Energy Type)

### 1. elec (전력)
- **단위**: kW (순시), kWh (적산)
- **통계**: 2,307개 태그 (74%)
- **예시**: `30_140B_KWH` (USAGE, elec)

### 2. air (에어/압축공기)
- **단위**: m³/min (순시), m³ (적산)
- **통계**: 800개 태그 (26%)
- **예시**: `30_00_FL` (TREND, air)

### 3. gas (가스)
- **단위**: m³/min (순시), m³ (적산)
- **통계**: 0개 (미사용)

### 4. solar (태양광)
- **단위**: kW (순시), kWh (적산)
- **통계**: 0개 (미사용)

---

## 📊 집계 로직 요약표

| 태그 종류 | 1초 → 1분 집계 로직 | 사용 예시 |
|---------|-------------------|---------|
| **TREND** | 60초 시점의 **마지막 값** | 현재 전력(kW), 유량 |
| **USAGE** | **차분** (60초 값 - 0초 값) | 사용 전력량(kWh) |
| **OPERATE** | 0~60초의 **합** (가동 시간) | 가동률 계산 |
| **SENSOR** | 0~60초의 **평균** | 온도, 압력 모니터링 |
| **CONTROL** | (집계하지 않음) | 제어 명령 |

---

## 📈 용도별 조회 방식 (KPI vs 차트)

> **2026-03-06 추가**: 사용량(USAGE)은 KPI와 차트에서 조회 방식이 다릅니다.

### 조회 방식 결정 기준

| 태그 종류 | KPI (단일 집계값) | 차트 (시계열) |
|----------|-----------------|-------------|
| **USAGE** (적산) | `LAST(last_value) - FIRST(first_value) + SUM(reset_correction)` | 보정 뷰 `corrected_usage_diff` 시계열 |
| **TREND** (순시) | `LAST` (최신 값) 또는 `MAX` (피크) | 버킷별 `last_value` 시계열 |
| **SENSOR** (센서) | `AVG` (평균) | 버킷별 `avg_value` 시계열 |
| **OPERATE** (가동) | `SUM` (가동 시간) | 버킷별 `SUM` 시계열 |
| **CONTROL** (제어) | 집계 안 함 | 집계 안 함 |

### USAGE 조회 방식 상세

**KPI (일일 총 사용량)** — 적산차 방식:
```sql
-- 하루 첫 번째 분의 first_value와 마지막 분의 last_value로 적산차 계산
-- 결측 구간이 있어도 미터기의 시작~끝 값만 보므로 정확한 총량 산출
SELECT
  FIRST(first_value, bucket) as day_first,
  LAST(last_value, bucket) as day_last
FROM cagg_usage_1min_corrected
WHERE bucket >= 오늘 AND bucket < 내일
GROUP BY "tagId", energy_type;
-- 일일 사용량 = day_last - day_first + SUM(reset_correction)
```

**차트 (시계열 플롯)** — 보정 뷰 시계열:
```sql
-- 분/시간별 추이가 필요하므로 각 버킷의 보정된 사용량을 시계열로 조회
SELECT bucket, corrected_usage_diff
FROM cagg_usage_1min_corrected
WHERE bucket >= 시작 AND bucket < 끝
ORDER BY bucket;
```

**⚠️ 왜 KPI에 SUM을 쓰면 안 되는가?**
- `SUM(raw_usage_diff)`: 결측 구간의 사용량이 누락됨
- 적산차: 미터기의 시작~끝 두 값만 보므로 중간 결측과 무관하게 전체 사용량 포착
- 예: 00:00=2000, 12~19시 결측, 24:00=5000 → SUM=2300(누락), 적산차=3000(정확)

---

## 💾 Mock 데이터 생성 규칙

### TREND (순시)
```typescript
// 변동하는 값 생성
const baseValue = energyType === 'elec' ? 50 : 20; // kW 또는 m³/min
const variation = (Math.random() - 0.5) * 10; // ±5
const value = Math.max(0, baseValue + variation);
```

### USAGE (적산)
```typescript
// 누적 증가하는 값 생성
let cumulativeValue = 10000; // 초기값 (kWh 또는 m³)

setInterval(() => {
  const increment = energyType === 'elec'
    ? 0.01 + Math.random() * 0.04  // 0.01~0.05 kWh/초
    : 0.1 + Math.random() * 0.4;   // 0.1~0.5 m³/초

  cumulativeValue += increment;
  saveData(tagId, cumulativeValue);
}, 1000);
```

### OPERATE (가동)
```typescript
// 0 또는 1 생성 (가동 확률 80%)
const isOperating = Math.random() < 0.8 ? 1 : 0;
```

### SENSOR (센서)
```typescript
// 평균 25, 표준편차 2의 정규분포
const baseTemp = 25;
const variation = (Math.random() - 0.5) * 4;
const temperature = baseTemp + variation; // 23~27°C
```

---

## 🎯 화면 표시 규칙

### 1. 트렌드 차트
- **TREND**: 시간대별 마지막 값 표시
- **USAGE**: 시간대별 차분값 표시 (사용량)
- **SENSOR**: 시간대별 평균값 표시

### 2. Y축 범위 설정
```typescript
// 전력량은 0 이하로 내려가지 않음
const yMin = Math.max(0, minValue - padding);
const yMax = maxValue + padding;
```

### 3. Null 처리
- **데이터 없음**: `null` 반환 (0이 아님!)
- **차트**: Null 값은 선 끊김으로 표시
- **집계**: Null이 포함된 구간은 집계하지 않음

```typescript
// ❌ 잘못된 예
return dataExists ? value : 0;

// ✅ 올바른 예
return dataExists ? value : null;
```

---

## 📁 관련 파일

### 데이터 소스
- `Tag/화성PT4공장_TagList.xlsx`: 태그 마스터 데이터 (3,107개)

### Backend API 구현 (2026-02-28 완료)
- **77개 REST API**: Monitoring, Dashboard, Alerts, Analysis, Settings
- **아카이브 위치**: [docs/archive/2026-02/backend-api/](../archive/2026-02/backend-api/)
- **설계 문서**: [backend-api.design.md](../archive/2026-02/backend-api/backend-api.design.md) (v5.3)
- **완료 보고서**: [backend-api.report.md](../archive/2026-02/backend-api/backend-api.report.md) (Match Rate: 91%)

### 코드
- `apps/api/src/data-collection/tag-data-collector.service.ts`: 실시간 데이터 수집
- `apps/api/src/data-collection/energy-aggregator.service.ts`: 15분 집계
- `apps/web/src/components/charts/TrendChart.tsx`: 차트 표시

### 문서
- `docs/archive/2026-03/completed-docs/ENERGY-CALCULATION-GUIDE.md`: 에너지 계산 상세 가이드 (아카이브, 핵심 내용은 본 문서에 통합됨)
- `CLAUDE.md`: 프로젝트 협업 규칙 (Backend API 규칙 포함)
- `docs/PLAN.md`: 프로젝트 개발 계획서 (Phase 7: Backend API 완료)

---

## 💡 kW (순시) vs kWh (적산) 기본 개념

| 구분 | 순시값 (kW) | 적산값 (kWh) |
|------|------------|-------------|
| **의미** | 현재 전력 사용률 | 누적 전력 사용량 |
| **DB MeasureType** | `INSTANTANEOUS` | `CUMULATIVE` |
| **집계** | **마지막 값 (LAST)** | **차분 (끝값 - 시작값)** |
| **CA 저장** | LAST (대표) + AVG/MIN/MAX (통계) | FIRST, LAST → diff |
| **비유** | 속도 (km/h) | 주행 거리 (km) |

### ❌ 잘못된 계산 방식

```typescript
// ❌ 잘못 1: KW로 KWH 추정 — 전력 사용 패턴이 일정하지 않아 부정확
const kwh = avgKw * 0.25; // 15분 = 0.25시간

// ❌ 잘못 2: 적산값을 합계로 처리 — 이미 누적된 값이므로 차분이 올바름
const sum = 120 + 125 + 130 + 160; // 모든 값을 합산
```

> 상세 설명 및 참고 자료: [ENERGY-CALCULATION-GUIDE.md](archive/2026-03/completed-docs/ENERGY-CALCULATION-GUIDE.md)

---

## ⚠️ 중요 주의사항

1. **USAGE 태그는 절대 합산하지 말 것**
   - ❌ `sum(usage)` → 잘못된 계산
   - ✅ `endValue - startValue` → 올바른 계산

2. **Null과 0을 구분할 것**
   - Null = 데이터 없음
   - 0 = 실제 0 값

3. **태그 종류별 로직을 혼용하지 말 것**
   - TREND는 마지막 값
   - USAGE는 차분
   - 각각 다른 물리적 의미

4. **음수 차분 처리**
   - USAGE 차분이 음수 → 센서 리셋 또는 오류
   - `null` 반환 또는 이전 값 유지

---

**작성일**: 2026-02-26
**최종 수정**: 2026-03-06 (태그 종류별 조회 방식 KPI vs 차트 추가)
**작성자**: AI Assistant (Claude)
**검토**: 사용자 도메인 전문가
