# i-FEMS 프론트엔드 Gap 분석 보고서

> **Summary**: 프론트엔드 32+1 화면 품질 분석 및 PLAN.md 대비 구현 일치율 검증
>
> **Author**: Gap Detector Agent
> **Created**: 2026-02-24
> **Last Modified**: 2026-02-24
> **Status**: Draft

---

## 분석 개요
- **분석 대상**: i-FEMS 프론트엔드 (apps/web/)
- **기준 문서**: PLAN.md, CLAUDE.md
- **구현 경로**: `d:\AI_PJ\IFEMS\apps\web\src\`
- **분석일**: 2026-02-24

---

## Overall Match Rate: 72%

| 카테고리 | 점수 | 상태 |
|----------|:----:|:----:|
| 화면 완성도 (32+1) | 100% | PASS |
| 서비스 레이어 패턴 | 90% | PASS |
| RAW 데이터 아키텍처 | 25% | CRITICAL |
| 디자인 시스템 일관성 | 65% | WARN |
| TypeScript 타입 안전성 | 88% | WARN |
| 컨벤션 준수 | 80% | WARN |
| **종합** | **72%** | WARN |

---

## 1. 오늘 작업 적용 상태 (2026-02-24) 검증

### 1-1. 폰트 3px 증가 -- PASS
- `index.css` 라인 28~34: `--font-size-xs` ~ `--font-size-2xl` 모두 +3px 적용 확인
- `html, body, #root` 기본 font-size: 19px (16px + 3px) 확인

### 1-2. 하드코딩 제거 (ALT003CycleAnomalyStats.tsx) -- PASS
- ALT003은 `getAlertStatsKpi`, `getAlertTrend`, `getCycleAnomalyTypes` 서비스 함수를 통해 모든 데이터를 가져옴
- 컴포넌트 내부에 하드코딩된 데이터 배열 없음
- `useQuery`를 통한 비동기 데이터 로딩 패턴 적용됨

### 1-3. RAW 데이터 구조 생성 -- PARTIAL (구조만 존재, 미사용)
- `services/mock/raw-data.ts`: TimeSeriesTag 인터페이스, 생성 유틸리티, 집계 함수 (231줄) 확인
- `services/mock/monitoring-computed.ts`: RAW 데이터 기반 연산 함수 4개 확인
  - `computeOverviewKpi()`, `computeLineMiniCards()`, `computeHourlyTrend()`, `computeLineDetailChart()`

**CRITICAL**: 두 파일 모두 어디에서도 import되지 않음
```
Grep 결과: import.*from.*raw-data|import.*from.*monitoring-computed → 0건
```
- 서비스 레이어(`services/monitoring.ts`)는 여전히 기존 `mock/monitoring.ts`의 하드코딩 상수를 사용
- `monitoring-computed.ts`의 `computeLineMiniCards()`도 헤드/크랭크/조립 데이터는 하드코딩(라인 103~130)

---

## 2. 화면별 하드코딩 데이터 검증

### 2-1. 페이지 내부 인라인 데이터 없음 -- PASS
- `Math.random`, `TODO`, `FIXME`, `HACK` 키워드: 페이지 파일 내 **0건**
- 모든 32+1 페이지가 서비스 레이어를 통해 데이터를 가져옴

### 2-2. 서비스 레이어 → Mock 의존 -- 문제 있음
모든 서비스 함수는 `USE_MOCK` 분기를 통해 `mock/*.ts`의 **사전 정의된 상수(하드코딩)**를 반환:

| 서비스 파일 | 참조 Mock | 데이터 패턴 |
|------------|-----------|------------|
| monitoring.ts | mock/monitoring.ts, mock/facilities.ts | 상수 배열 (OVERVIEW_KPI, LINE_MINI_CARDS 등) |
| dashboard.ts | mock/dashboard.ts, mock/facilities.ts | 상수 배열 + 약간의 연산 (ENERGY_TREND_MONTHLY 등) |
| alerts.ts | mock/alerts.ts | 상수 배열 (ALERT_STATS_KPI, ALERT_TRENDS 등) |
| analysis.ts | mock/analysis.ts | 상수 + 파라미터 기반 필터링 |
| settings.ts | mock/settings.ts, mock/facilities.ts | 상수 배열 |

**핵심 원칙 위반**: "DB의 시계열 데이터에 각 태그의 값들이 담겨 있고 각 화면에서 이 RAW 데이터를 가지고 표현"
- 실제 구현: 페이지 → 서비스 → mock 상수 (하드코딩)
- 기대 구현: 페이지 → 서비스 → RAW 데이터 → 연산 → 표시
- `raw-data.ts` + `monitoring-computed.ts`가 생성되었으나 연결 안 됨

### 2-3. Mock 데이터 내 `Math.random()` 사용
- `lib/utils.ts` 라인 87~88: `generateTimeSeriesData()` 함수에 `Math.random()` 사용
- `mock/raw-data.ts` 라인 35: `generateTimeSeriesTags()` 함수에 `Math.random()` 사용
- 이는 Mock 데이터 생성기에서 기대되는 동작이므로 심각하지 않음 (Mock 전용)

---

## 3. PLAN.md 요구사항 vs 구현 비교

### 3-1. 화면 수 -- PASS (초과 달성)

| 구분 | PLAN 기준 | 실제 구현 | 상태 |
|------|:---------:|:---------:|:----:|
| 로그인 | 1 | 1 | PASS |
| 모니터링 (MON) | 6 | 6 | PASS |
| 대시보드 (DSH) | 8 | 8 | PASS |
| 알림 (ALT) | 6 | 6 | PASS |
| 분석 (ANL) | 5 | 5 | PASS |
| 설정 (SET) | 6 | 12 | +6 추가 |
| **합계** | **32+1** | **38+1** | +6 |

**추가된 설정 화면 (PLAN 미포함)**:
- SET007 설비 마스터 관리
- SET008 공장 관리
- SET009 라인 설정
- SET011 설비 유형 관리
- SET012 태그 마스터 관리
- SET013 태그 계층 구조

이들은 PLAN에 없지만 Backend 연동 준비를 위해 추가된 관리 화면으로 양성적 추가 사항.

### 3-2. 라우팅 등록 -- PASS
- `App.tsx`에 38+1개 모든 라우트 등록 확인
- `createBrowserRouter` 사용, `AppLayout` 하위 children으로 구성

### 3-3. GNB/사이드바 메뉴 구조 -- PASS
`constants.ts` 메뉴 구조가 PLAN과 일치:
- GNB: 모니터링 | 대시보드 | 알림 | 분석 | 설정 (5개)
- 사이드바: 각 GNB 항목별 하위 메뉴 정의됨
- 추가 설정 메뉴 6개 포함 (factory, line, facility-master, facility-type, tag, hierarchy)

### 3-4. 설비명 형식 -- PASS
`mock/facilities.ts`에서 확인:
- HNK10-000, HNK10-010/020, HNK10-010-1 ~ HNK10-010-5, HNK10-010-G/L 등
- 92개 블록 라인 설비가 실제 TagList.xlsx 기반으로 정확하게 등록
- `HNK{라인번호}-{공정번호}{선택-서브번호}` 패턴 준수

### 3-5. 차트 패턴 -- PASS (일부 색상 변경)
MON001Overview.tsx 확인:
- 당일 막대 + 전일 영역 오버레이 패턴 적용
- 현재 시각 빨간 수직 기준선 (`ReferenceLine`)
- `ComposedChart` + `Area`(전일) + `Bar`(당일) 구조

### 3-6. 색상 테마 -- 변경됨 (설계 문서 업데이트 필요)

| 항목 | CLAUDE.md 기준 | 실제 구현 | 상태 |
|------|:--------------:|:---------:|:----:|
| GNB 배경 | #1A1A2E | #188fa7 (틸) | CHANGED |
| 액센트 | #E94560 | #9dbbae (세이지) | CHANGED |
| 정상(NORMAL) | #27AE60 | #9dbbae (세이지) | CHANGED |
| 주의(WARNING) | #F39C12 | #d5d6aa (올리브) | CHANGED |
| 위험(DANGER) | #E74C3C | #769fb6 (블루) | CHANGED |
| 오프라인 | #7F8C8D | #e2dbbe (베이지) | CHANGED |

**분석**: 전체 색상 체계가 "차분한 파스텔 톤"으로 완전 교체됨.
- 5개 파스텔 색상: #e2dbbe, #d5d6aa, #9dbbae, #769fb6, #188fa7 적용
- `index.css`, `constants.ts` 모두 새 팔레트 적용
- CLAUDE.md의 "신호등 색상 (절대 변경 금지)" 규칙은 실질적으로 무시됨
- **CLAUDE.md 업데이트가 필요** (실제 구현이 의도적 변경이라면)

---

## 4. 아키텍처 원칙 준수

### 4-1. 레이어 구조 -- PASS (Dynamic Level)

```
src/
  components/   (Presentation - layout, ui)
  pages/        (Presentation - 화면)
  services/     (Application - 서비스 레이어)
  stores/       (Application - 상태 관리)
  lib/          (Infrastructure - 상수, 유틸)
```

Dynamic Level 구조에 부합. 의존성 방향도 올바름:
- pages → services (PASS)
- pages → components (PASS)
- pages → lib/constants (PASS)
- services → mock (PASS)
- services → lib/constants (PASS)

### 4-2. 의존성 방향 위반 -- MINOR

7개 페이지가 `services/mock/*`에서 **타입만** 직접 import:
```
ALT004PowerQualityHistory.tsx → import { AlertHistoryItem } from '../../services/mock/alerts'
ALT005AirLeakHistory.tsx      → import { AlertHistoryItem } from '../../services/mock/alerts'
ALT006CycleAnomalyHistory.tsx → import { AlertHistoryItem } from '../../services/mock/alerts'
MON003EnergyRanking.tsx       → import type { FacilityEnergy } from '../../services/mock/facilities'
MON004EnergyAlert.tsx         → import type { EnergyAlertData } from '../../services/mock/facilities'
MON005PowerQuality.tsx        → import type { PowerQualityData } from '../../services/mock/facilities'
MON006AirLeak.tsx             → import type { AirLeakData } from '../../services/mock/facilities'
```
페이지가 mock 데이터 모듈에서 타입을 직접 가져오는 것은 아키텍처 위반.
타입은 `types/` 또는 서비스 레이어에서 re-export 되어야 함.

### 4-3. RAW 데이터 → 연산 → 표시 플로우 -- CRITICAL

**기대 아키텍처**:
```
TimescaleDB (RAW tags) → Backend API → Service Layer → 연산 → 화면
```

**현재 구현**:
```
하드코딩 상수 (mock/*.ts) → Service Layer (그대로 반환) → 화면
```

**RAW 데이터 연산 파이프라인 상태**:
- `raw-data.ts`: TimeSeriesTag 생성기 + 집계 함수 (aggregateAvg, aggregateSum, aggregateMax 등) 존재
- `monitoring-computed.ts`: RAW 데이터 기반 연산 함수 4개 존재
- **문제**: 어느 서비스 함수도 이 파일들을 사용하지 않음 (import 0건)

**RAW 데이터 커버리지** (raw-data.ts에 정의된 태그):
- POWER: 10개 설비 (1초 간격, 1시간 + 24시간)
- AIR: 10개 설비
- POWER_FACTOR: 10개 설비
- CYCLE_TIME: 8개 설비
- CYCLE_ENERGY: 8개 설비
- **커버리지**: MON-001/002만 연산 함수 존재, 나머지 30개 화면은 RAW 연산 미구현

---

## 5. 코드 품질 검증

### 5-1. TypeScript 타입 안전성

| 항목 | 건수 | 상태 |
|------|:----:|:----:|
| `any` 사용 (.tsx) | 13건 (4파일) | WARN |
| `any` 사용 (.ts) | 1건 (1파일) | MINOR |
| `as const` 활용 | 광범위 | GOOD |
| `type`/`interface` 정의 | 충분 | GOOD |

`any` 사용 상세:
- SET011FacilityTypeManagement.tsx: 4건
- SET012TagMaster.tsx: 7건
- SET008FactoryManagement.tsx: 1건
- SET009LineSettings.tsx: 1건
- settings.ts: 1건 (BulkUploadResult의 `data?: any`)

### 5-2. console.log 디버깅 코드 잔류

| 파일 | 건수 | 유형 |
|------|:----:|------|
| services/settings.ts | 11건 | 디버깅 로그 (이모지 포함) |
| lib/utils.ts | 2건 | placeholder export 함수 |
| components/ui/CascadeSelect.tsx | 4건 | error catch 로그 |

`settings.ts`의 디버깅 로그는 프로덕션 전 반드시 제거 필요.

### 5-3. 컴포넌트 구조 일관성 -- GOOD

모든 페이지가 동일한 구조를 따름:
```tsx
export default function XXXYYY() {
  // 1. useState (필터, 선택 상태)
  // 2. useQuery (서비스 함수 호출)
  // 3. 파생 데이터 계산
  // 4. JSX 반환
  //    - PageHeader
  //    - KPI 카드 그리드
  //    - FilterBar
  //    - ChartCard + 테이블
}
```

### 5-4. 서비스 레이어 패턴 일관성 -- GOOD

모든 서비스 함수가 동일한 패턴:
```typescript
export async function getXxx(params) {
  if (USE_MOCK) return mockDelay(MOCK_DATA);
  return apiClient.get('/endpoint', { params }).then(r => r.data);
}
```

### 5-5. TanStack Query 사용 -- GOOD

| 항목 | 상태 |
|------|------|
| useQuery 사용 | 104건 / 37파일 (모든 페이지) |
| queryKey 고유성 | 확인됨 |
| refetchInterval | MON001에 60000ms 적용 |
| 필터 변경 시 refetch | FilterBar onSearch에 연결 |

---

## 6. Mock 데이터 vs RAW 데이터 사용 비율

| 항목 | 수량 | 비율 |
|------|:----:|:----:|
| Mock 상수 사용 화면 | 38 | 100% |
| RAW 데이터 연산 사용 화면 | 0 | 0% |
| RAW 데이터 연산 함수 (정의됨) | 4 | - |
| RAW 데이터 연산 함수 (사용됨) | 0 | 0% |

---

## Gap 리스트

### [HIGH] 심각한 문제

| # | 항목 | 위치 | 설명 | 영향 |
|---|------|------|------|------|
| H-01 | RAW 데이터 미연결 | services/mock/raw-data.ts, monitoring-computed.ts | 생성된 RAW 데이터 구조와 연산 함수가 어디에서도 import/사용되지 않음 | 아키텍처 원칙 위반 |
| H-02 | 색상 체계 설계 문서 불일치 | CLAUDE.md vs index.css, constants.ts | 신호등 색상 포함 전체 색상이 변경되었으나 CLAUDE.md는 원본 색상 기재 | 설계-구현 괴리 |
| H-03 | Mock 전용 하드코딩 KPI | services/mock/monitoring.ts:9-14 | `OVERVIEW_KPI`가 고정값 (487 kWh, 23.47 ML 등) | RAW 연산 미적용 |
| H-04 | monitoring-computed.ts 부분 하드코딩 | services/mock/monitoring-computed.ts:103-130 | `computeLineMiniCards()`에서 헤드/크랭크/조립 데이터가 하드코딩 | 블록만 RAW 연산 |

### [MEDIUM] 개선 필요

| # | 항목 | 위치 | 설명 |
|---|------|------|------|
| M-01 | 타입 직접 mock import | MON003~006, ALT004~006 (7파일) | 페이지가 mock 모듈에서 타입을 직접 import (types/ 분리 필요) |
| M-02 | `any` 타입 사용 | SET011, SET012, SET008, SET009 | 14건의 any 타입 사용 (strict 모드 위반) |
| M-03 | console.log 잔류 | services/settings.ts (11건) | 디버깅용 이모지 로그 프로덕션 배포 전 제거 필요 |
| M-04 | USE_MOCK 하드코딩 | lib/constants.ts:112 | `USE_MOCK = false`로 하드코딩 (환경변수 무시) |
| M-05 | Export 함수 미구현 | lib/utils.ts:113-122 | exportToExcel, exportToImage가 alert() placeholder |
| M-06 | PLAN.md 미업데이트 | docs/PLAN.md | SET007~013 화면 추가가 PLAN에 반영 안 됨 |

### [LOW] 사소한 개선

| # | 항목 | 위치 | 설명 |
|---|------|------|------|
| L-01 | 설비 옵션 하드코딩 | ANL004CycleDelay.tsx:15-18 | FACILITY_OPTIONS 3개만 고정 (서비스에서 조회 권장) |
| L-02 | 연도 옵션 하드코딩 | DSH001EnergyTrend.tsx:23-26 | YEAR_OPTIONS에 2025/2026 고정 |
| L-03 | CascadeSelect error catch | components/ui/CascadeSelect.tsx | console.error만 사용, 사용자 피드백 없음 |
| L-04 | 다크모드 색상 인라인 | MON001Overview.tsx:40 등 | `dark:bg-[#769fb6]` 인라인 사용 (토큰화 권장) |

---

## 우수 사항

1. **화면 완성도 100%+**: PLAN 대비 32화면 모두 구현 + 6개 관리 화면 추가 (38+1)
2. **서비스 레이어 분리 철저**: 모든 페이지가 서비스 함수를 통해 데이터를 가져옴 (직접 axios 호출 0건)
3. **Mock/API 전환 전략 구현**: 모든 서비스 함수에 `USE_MOCK` 분기 적용, API 엔드포인트 URL 사전 정의
4. **컴포넌트 재사용 우수**: KpiCard, FilterBar, ChartCard, SortableTable 등 7개 공통 컴포넌트가 전 화면에서 활용
5. **TanStack Query 일관 적용**: 37개 페이지, 104건의 useQuery 호출로 서버 상태 관리 통일
6. **설비 데이터 정확도**: 92개 블록 라인 설비가 실제 TagList.xlsx 기반으로 정확히 등록
7. **파스텔 색상 통일**: 5개 파스텔 톤(#e2dbbe, #d5d6aa, #9dbbae, #769fb6, #188fa7)이 247건으로 전체 코드에 일관 적용
8. **디자인 토큰 사용**: index.css @theme에서 CSS 변수로 색상/폰트 정의
9. **Zustand 상태 관리**: authStore, uiStore에 persist 미들웨어 적용
10. **RAW 데이터 구조 설계**: TimeSeriesTag 인터페이스, 집계 함수 등 향후 확장 가능한 구조 생성됨

---

## 개선 필요 사항 (우선순위순)

### 즉시 조치 (CRITICAL)

1. **RAW 데이터 연결**: `monitoring-computed.ts` 함수를 `services/monitoring.ts`에서 호출하도록 연결
   - `getOverviewKpi()` → Mock 분기에서 `computeOverviewKpi()` 호출
   - `getLineMiniCards()` → Mock 분기에서 `computeLineMiniCards()` 호출
   - 나머지 화면도 순차적으로 RAW 연산 함수 작성

2. **CLAUDE.md 색상 업데이트**: 현재 파스텔 톤 팔레트로 CLAUDE.md의 색상 섹션 갱신

3. **USE_MOCK 환경변수 복원**: `lib/constants.ts`의 `USE_MOCK = false` 하드코딩을 원래대로 복원
   ```typescript
   // 현재 (잘못됨)
   export const USE_MOCK = false;
   // 수정 필요
   export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
   ```

### 단기 개선 (1-2일)

4. **타입 분리**: mock 모듈의 타입을 `types/` 디렉토리 또는 서비스 레이어로 re-export
5. **any 타입 제거**: SET011, SET012, SET008, SET009의 14건 any 제거
6. **console.log 정리**: settings.ts의 디버깅 로그 11건 제거 또는 환경 분기 처리
7. **PLAN.md 업데이트**: SET007~013 추가 화면 반영

### 중기 개선 (Backend 연동 시)

8. **나머지 화면 RAW 연산 함수 작성**: DSH, ALT, ANL, SET 화면용 computed 함수
9. **Export 기능 실구현**: exportToExcel, exportToImage placeholder 대체
10. **다크모드 토큰화**: 인라인 `dark:bg-[#769fb6]` → CSS 변수 참조로 변경

---

## 점수 산출 근거

| 카테고리 | 배점 | 득점 | 근거 |
|----------|:----:|:----:|------|
| 화면 완성도 | 20 | 20 | 38+1/32+1 (초과 달성) |
| 서비스 레이어 | 15 | 13.5 | 패턴 일관 (90%), Mock-API 전환 준비 완료 |
| RAW 데이터 아키텍처 | 20 | 5 | 구조만 존재, 연결 0% (25% 인정) |
| 디자인 시스템 | 15 | 9.75 | 색상 통일 우수하나 설계 문서 불일치 (65%) |
| TypeScript | 15 | 13.2 | any 14건만 (88%) |
| 컨벤션 | 15 | 12 | 파일명/폴더 구조 우수, console.log 잔류 (80%) |
| **합계** | **100** | **73.45** | **약 72%** |

---

## 동기화 옵션

| 옵션 | 설명 | 권장 |
|------|------|:----:|
| 1 | RAW 데이터 연결 + CLAUDE.md 업데이트 | **권장** |
| 2 | CLAUDE.md를 구현에 맞게 업데이트만 | 부분적 |
| 3 | 구현을 CLAUDE.md 원본 색상으로 복원 | 비권장 |
| 4 | 현재 상태 유지 (차이 인정) | 비권장 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-24 | 초기 분석 (72%) | Gap Detector |
