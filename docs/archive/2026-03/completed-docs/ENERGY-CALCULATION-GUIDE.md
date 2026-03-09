# 전력 계산 가이드 (Energy Calculation Guide)

## 개요

i-FEMS 시스템에서 전력 데이터를 올바르게 처리하기 위한 가이드입니다.

---

## 1. 기본 개념

### KW (전력, Power) - 순시값
- **정의**: 특정 시점의 전력 사용률
- **단위**: kW (킬로와트)
- **특징**: 순간적인 전기 소비 속도
- **비유**: 자동차의 현재 속도 (km/h)

### KWH (전력량, Energy) - 적산값
- **정의**: 일정 시간 동안 누적된 전력 사용량
- **단위**: kWh (킬로와트시)
- **특징**: 시간에 따라 누적되는 값
- **비유**: 자동차의 주행 거리 (km)

---

## 2. 계산 방식

### ✅ 적산(KWH) 사용량 계산 - **차분값 방식**

**올바른 방법:**
```
시작 시각 (0분):  120 kWh
종료 시각 (15분): 160 kWh

사용량 = 종료값 - 시작값 = 160 - 120 = 40 kWh
```

**특징:**
- 적산 전력량계는 누적값을 저장
- 사용량은 두 시점의 **차이**로 계산
- 전기 요금 청구서에 사용되는 값

### ✅ 순시(KW) 값 처리 - **마지막 값(LAST) 방식**

**i-FEMS 표준:**
```
15분 동안 측정된 순시 전력:
- 0분: 45 kW
- 5분: 52 kW
- 10분: 48 kW
- 15분: 50 kW

대표값 = 50 kW (마지막 값, LAST)
참고: AVG/MIN/MAX는 통계용으로 별도 저장
```

**특징:**
- 순시값은 실시간 전력 사용률
- **i-FEMS에서는 LAST (마지막 값)를 대표값으로 사용**
- CA(cagg_trend_10sec)에서 LAST + AVG/MIN/MAX 모두 저장하되, `value` 필드는 LAST
- 수요 전력(Demand) 관리에도 활용

---

## 3. ❌ 잘못된 계산 방식

### 잘못된 예시 1: KW로 KWH 추정
```typescript
// ❌ 잘못된 방식
const avgKw = 50;
const kwh = avgKw * 0.25; // 15분 = 0.25시간
```

**문제점:**
- 순시값(KW)으로 적산값(KWH)을 추정하는 것은 부정확
- 전력 사용 패턴이 일정하지 않기 때문
- 적산 전력량계의 값을 직접 사용해야 함

### 잘못된 예시 2: 적산값을 합계로 처리
```typescript
// ❌ 잘못된 방식
const sum = 120 + 125 + 130 + ... + 160; // 모든 값을 합산
```

**문제점:**
- 적산값은 이미 누적된 값
- 합계가 아닌 차분(차이)을 계산해야 함

---

## 4. i-FEMS 구현 방식

### 태그 유형 구분

```typescript
// DB 스키마 (2026-03-04 재설계)
enum MeasureType {
  CUMULATIVE = 'CUMULATIVE',       // 적산값 (kWh, m³) — 차분 계산
  INSTANTANEOUS = 'INSTANTANEOUS', // 순시값 (kW, m³/min) — 마지막 값
  DISCRETE = 'DISCRETE',           // 이산값 (가동 0/1)
}
enum TagCategory {
  ENERGY = 'ENERGY',         // 에너지 (전력, 에어)
  QUALITY = 'QUALITY',       // 전력 품질 (역률, 불평형률)
  ENVIRONMENT = 'ENVIRONMENT', // 환경 (온도, 압력)
  OPERATION = 'OPERATION',   // 가동 상태
  CONTROL = 'CONTROL',       // 제어 명령
}
```

### 올바른 집계 로직

#### 적산(USAGE) 처리
```typescript
// 15분 집계 시
const startValue = await getTagValue(tagId, startTime); // 0분 적산값
const endValue = await getTagValue(tagId, endTime);     // 15분 적산값

const usage = endValue - startValue; // 차분 계산
```

#### 순시(INSTANTANEOUS) 처리
```typescript
// 15분 집계 시 — i-FEMS 표준: LAST (마지막 값)
const lastValue = await getTagValue(tagId, endTime);  // 대표값 (LAST)

// CA(cagg_trend_10sec)에는 통계값도 함께 저장
const avgValue = await getAvgTagValue(tagId, startTime, endTime);  // 평균 (참고용)
const minValue = await getMinTagValue(tagId, startTime, endTime);  // 최소 (참고용)
const maxValue = await getMaxTagValue(tagId, startTime, endTime);  // 최대 (참고용)
```

---

## 5. 실제 적용 예시

### 시나리오: 15분 전력 사용량 계산

**데이터:**
```
11:00:00 - 적산 전력량: 1,250 kWh, 순시 전력: 45 kW
11:05:00 - 적산 전력량: 1,255 kWh, 순시 전력: 52 kW
11:10:00 - 적산 전력량: 1,260 kWh, 순시 전력: 48 kW
11:15:00 - 적산 전력량: 1,265 kWh, 순시 전력: 50 kW
```

**계산:**
```
✅ 11:00~11:15 사용량 (적산 차분, CUMULATIVE)
   = 1,265 - 1,250 = 15 kWh

✅ 순시 대표값 (LAST — 마지막 값, INSTANTANEOUS)
   = 50 kW

   참고 통계: AVG=48.75, MIN=45, MAX=52
```

---

## 6. 참고 자료

### 한국어 자료
- [전력 kW 와 전력량 kWh의 차이는?](https://www.a-ha.io/questions/45253e3a48f23e1ba9c03f1f45819fd2)
- [전력량 - 위키백과](https://ko.wikipedia.org/wiki/%EC%A0%84%EB%A0%A5%EB%9F%89)
- [kW와 kWh의 차이점은](https://m.ekn.kr/view.php?key=68374)

### 영문 자료
- [kW vs kWh on your meter: a guide](https://domesticlife.blog/en/potencia-instantanea-vs-energia-kw-vs-kwh-lo-que-muestra-tu-medidor/)
- [Understanding Your Utility Demand and Usage](https://www.santeecooper.com/rates/understanding-your-demand/)
- [Energy Meter vs Power Meter](https://www.electroind.com/energy-meter-vs-power-meter/)
- [Understanding kW vs kWh to Lower Your Utility Bills](https://cpowerenergy.com/understanding-kw-vs-kwh-meter-data-lower-utility-bills/)
- [Demand (kW) versus Consumption (kWh)](https://www.sucocoop.com/demand-kw-versus-consumption-kwh)

---

## 7. 요약

| 구분 | 적산 (KWH) | 순시 (KW) |
|------|-----------|----------|
| **의미** | 누적 전력 사용량 | 현재 전력 사용률 |
| **단위** | kWh | kW |
| **DB MeasureType** | `CUMULATIVE` | `INSTANTANEOUS` |
| **계산** | 차분 (끝값 - 시작값) | **마지막 값 (LAST)** |
| **CA 저장** | FIRST, LAST → diff | LAST (대표) + AVG/MIN/MAX (통계) |
| **용도** | 전기 요금, 사용량 통계 | 수요 관리, 부하 모니터링 |
| **비유** | 주행 거리 (km) | 속도 (km/h) |

**핵심 원칙:**
1. ✅ **적산값은 차분으로 계산** (끝 - 시작)
2. ✅ **순시값은 마지막 값(LAST) 사용** (AVG/MIN/MAX는 통계 참고용)
3. ❌ **순시값으로 적산값을 추정하지 않음**

---

## 변경 이력

- 2026-02-26: 초기 작성 (기존 잘못된 avg 기반 계산 방식 수정)
- 2026-03-05: MeasureType/TagCategory enum 반영, 순시값 "피크 또는 마지막" → "LAST (마지막)" 확정, CA 저장 구조 명시
