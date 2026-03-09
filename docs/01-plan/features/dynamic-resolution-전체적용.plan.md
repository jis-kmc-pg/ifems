# Dynamic Chart Resolution 전체 적용 Planning Document (v2.0)

> **Summary**: i-FEMS 모든 시간축 차트에 4단계 Progressive Resolution 적용
>
> **Project**: i-FEMS (Intelligence Facility & Energy Management System)
> **Version**: 2.0.0 (재작성)
> **Author**: AI Assistant (Claude) + User
> **Date**: 2026-02-28
> **Last Modified**: 2026-02-28
> **Status**: Ready for Review

---

## 1. Overview

### 1.1 Purpose

i-FEMS의 **모든 시간축 차트**에 Dynamic Chart Resolution (Progressive Resolution)을 적용하여, 사용자가 차트를 줌할 때 자동으로 최적의 데이터 해상도를 제공합니다.

**핵심 원칙**: **X축이 시간인 모든 차트에 적용** (트렌드 차트 + 싸이클 파형 포함)

### 1.2 Background

**현재 상황**:
- **MON-002 (라인별 상세)**에만 Dynamic Resolution 적용됨 ✅
- 나머지 11개 화면은 고정 interval 사용
- 싸이클 파형 화면도 시간축을 가지지만 확대 기능 없음

**필요성**:
- 모든 시간축 차트에 동일한 줌 경험 제공
- 싸이클 파형에서도 1초 단위 상세 분석 필요
- 일관된 UX 제공

---

## 2. Scope

### 2.1 In Scope

#### 12개 화면 (모든 시간축 차트)

**그룹 A: 시간 범위 트렌드 차트** (9개)
- MON-001: 종합 현황 (maxDepth: 2, 15m → 1m)
- MON-002: 라인별 상세 (maxDepth: 3, 15m → 1m → 10s → 1s) **✅ 이미 완료**
- DSH-001: 에너지 사용 추이 (maxDepth: 1, 15m 고정)
- DSH-002: 설비별 추이 (maxDepth: 2, 15m → 1m)
- ANL-001: 비교 분석 (maxDepth: 2, 15m → 1m)
- ANL-002: 상세 비교 분석 (maxDepth: 3, 15m → 1m → 10s)
- ANL-005: 전력 품질 분석 (maxDepth: 2, 15m → 1m)
- ALT-004: 전력 품질 이력 (maxDepth: 1, 15m 고정)
- ALT-006: 싸이클 이상 이력 (maxDepth: 2, 15m → 10s)

**그룹 B: 싸이클 파형 차트** (3개) - **X축 = 시간 (sec)**
- ANL-003: 싸이클 분석 (maxDepth: 3, 10s → 1s)
  - 싸이클 파형 오버레이 (기준/비교1/비교2)
  - X축 = sec (0~360초)
- ANL-004: 싸이클 타임 지연 (maxDepth: 3, 10s → 1s)
  - 싸이클별 전력 파형
  - X축 = sec
- SET-003: 기준 싸이클 파형 (maxDepth: 3, 1s 고정, **줌 비활성화**)
  - 기준 파형 설정
  - X축 = sec

#### Frontend 작업

- [ ] **useDynamicResolution 훅 적용** (또는 커스텀 interval 상태 관리)
- [ ] **TrendChart에 onZoomChange, isLoading props 전달**
- [ ] **화면별 maxDepth 설정** (SCREEN_MAX_DEPTH 사용)
- [ ] **화면별 initialInterval 설정** (SCREEN_INITIAL_INTERVAL 사용)

#### Backend 작업

**그룹 A (시간 범위 API)** - 이미 완료 ✅
```typescript
GET /api/monitoring/range/:facilityId/power
  ?start={ISO8601}&end={ISO8601}&interval={15m|1m|10s|1s}
```

**그룹 B (싸이클 파형 API)** - **interval 파라미터 추가 필요** ⚠️
```typescript
GET /api/analysis/cycle/waveform
  ?cycleId={id}&isReference={bool}&interval={10s|1s}
```

**변경사항**:
- `getCycleWaveform(cycleId, isReference)` → `getCycleWaveform(cycleId, isReference, interval)`
- interval에 따라 파형 데이터 해상도 변경 (360개 포인트 → 3600개 포인트)

### 2.2 Out of Scope

- ❌ **바 차트, 파이 차트** - 시간축 없음
- ❌ **화면 UI 구조 변경** - 기존 레이아웃 유지
- ❌ **신규 Backend 엔드포인트** - 기존 API에 파라미터만 추가

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Applies To |
|----|-------------|----------|------------|
| FR-01 | X축 시간 차트에 zoom 기능 추가 | High | 12개 화면 |
| FR-02 | zoom 시 interval 자동 전환 | High | 12개 화면 |
| FR-03 | 화면별 maxDepth 제한 | High | 12개 화면 |
| FR-04 | TrendChart onZoomChange 핸들러 | High | 12개 화면 |
| FR-05 | interval 전환 시 Loading 표시 | Medium | 12개 화면 |
| FR-06 | 브라우저 콘솔 에러 0개 | High | 12개 화면 |
| FR-07 | 싸이클 파형 interval 파라미터 지원 | High | ANL-003, ANL-004, SET-003 |
| FR-08 | SET-003 줌 비활성화 | Medium | SET-003만 |

### 3.2 Non-Functional Requirements

| Category | Criteria | Target |
|----------|----------|--------|
| Performance | 차트 렌더링 60 FPS | MON-002 수준 |
| Performance | API 응답 시간 < 1초 | 모든 interval |
| UX | interval 전환 딜레이 < 500ms | 사용자 체감 |
| Quality | TypeScript strict 모드 통과 | 0 에러 |
| Quality | 브라우저 콘솔 에러 0개 | Chrome DevTools |

---

## 4. Technical Design

### 4.1 Progressive Resolution Levels

```
Level 0 (15m): 전체 범위 (95~100%)
Level 1 (1m):  중간 범위 (70~95%)
Level 2 (10s): 상세 범위 (40~70%)
Level 3 (1s):  초상세 범위 (0~40%)
```

### 4.2 화면별 maxDepth 설정

| 화면 | maxDepth | 허용 Interval | 사유 |
|------|----------|--------------|------|
| MON-001 | 2 | 15m, 1m | 종합 현황 (상세 불필요) |
| MON-002 | 3 | 15m, 1m, 10s, 1s | 라인별 상세 (최상세) ✅ |
| DSH-001 | 1 | 15m | 일별 추이 (1분 불필요) |
| DSH-002 | 2 | 15m, 1m | 설비별 추이 |
| ANL-001 | 2 | 15m, 1m | 비교 분석 |
| ANL-002 | 3 | 15m, 1m, 10s | 상세 비교 (10초까지) |
| ANL-003 | 3 | **10s, 1s** | 싸이클 분석 (10초부터 시작) |
| ANL-004 | 3 | **10s, 1s** | 싸이클 타임 (10초부터) |
| ANL-005 | 2 | 15m, 1m | 전력 품질 |
| ALT-004 | 1 | 15m | 이력 조회 |
| ALT-006 | 2 | 15m, 10s | 싸이클 이상 이력 |
| SET-003 | 3 | **1s** (고정) | 기준 파형 (줌 비활성화) |

### 4.3 Implementation Pattern

#### 패턴 A: 시간 범위 트렌드 (9개 화면)

```typescript
// MON-002 패턴 사용
const dynamicResolution = useDynamicResolution({
  initialInterval: '15m',
  startTime: `${date}T00:00:00Z`,
  endTime: `${date}T23:59:59Z`,
  facilityId: selectedFacility,
  metric: 'power',
  enabled: true,
});

<TrendChart
  data={dynamicResolution.data}
  onZoomChange={dynamicResolution.handleZoom}
  isLoading={dynamicResolution.isLoading}
  loadingMessage={`현재: ${formatInterval(dynamicResolution.currentInterval)}`}
/>
```

#### 패턴 B: 싸이클 파형 (3개 화면)

```typescript
// 커스텀 interval 상태 관리
const [currentInterval, setCurrentInterval] = useState<Interval>('10s');

const { data: waveData } = useQuery({
  queryKey: ['cycle-wave', cycleId, currentInterval],
  queryFn: () => getCycleWaveformData(cycleId, false, currentInterval),
});

const handleZoomChange = useCallback((zoomRatio: number) => {
  const newInterval = getIntervalForZoomRatio(zoomRatio, currentInterval, '10s');
  if (newInterval !== currentInterval) {
    setCurrentInterval(newInterval);
  }
}, [currentInterval]);

<TrendChart
  data={waveData}
  xKey="sec"  // 싸이클 파형은 sec 사용
  onZoomChange={handleZoomChange}
  isLoading={isLoading}
/>
```

---

## 5. Backend API Changes

### 5.1 싸이클 파형 API 확장

**현재**:
```typescript
export async function getCycleWaveformData(cycleId: string, isReference = false) {
  if (USE_MOCK) return mockDelay(getCycleWaveform(cycleId, isReference));
  return apiClient.get('/analysis/cycle/waveform', {
    params: { cycleId, isReference }
  }).then((r) => r.data);
}
```

**변경 후**:
```typescript
export async function getCycleWaveformData(
  cycleId: string,
  isReference = false,
  interval: '15m' | '1m' | '10s' | '1s' = '10s'
) {
  if (USE_MOCK) return mockDelay(getCycleWaveform(cycleId, isReference, interval));
  return apiClient.get('/analysis/cycle/waveform', {
    params: { cycleId, isReference, interval }
  }).then((r) => r.data);
}
```

### 5.2 Mock 데이터 생성

```typescript
export function getCycleWaveform(
  cycleId: string,
  isReference = false,
  interval: '10s' | '1s' = '10s'
) {
  const pointCount = interval === '1s' ? 3600 : 360; // 1초: 3600개, 10초: 360개
  const base = isReference ? 850 : (cycleId === 'c004' ? 1050 : 880);
  const variance = isReference ? 80 : (cycleId === 'c004' ? 220 : 90);

  return Array.from({ length: pointCount }, (_, i) => ({
    sec: i * (interval === '1s' ? 0.1 : 1), // 1초: 0.1초 간격, 10초: 1초 간격
    value: Math.max(0, base + Math.sin(i * 0.087) * variance * 0.8 + (Math.random() - 0.5) * variance * 0.4),
  }));
}
```

---

## 6. Success Criteria

### 6.1 Definition of Done

- [ ] 12개 화면 모두 interval 상태 관리 (useState or useDynamicResolution)
- [ ] 12개 화면 모두 TrendChart에 onZoomChange props 전달
- [ ] 화면별 maxDepth 설정 완료 (SCREEN_MAX_DEPTH 사용)
- [ ] TypeScript 컴파일 에러 0개
- [ ] 브라우저 콘솔 에러 0개 (12개 화면 각각 확인)
- [ ] 차트 줌 동작 확인 (interval 전환 확인)
- [ ] Mock 데이터 정상 동작 확인
- [ ] Backend API interval 파라미터 추가 (싸이클 파형 3개)
- [ ] Real API 연동 테스트 (`VITE_USE_MOCK=false`)
- [ ] Gap Analysis >= 90%

### 6.2 Quality Criteria

- [ ] MON-002 수준 품질 (브라우저 콘솔 깨끗, 60 FPS, SWR 캐싱)
- [ ] TODO 주석 0개 (임시 코드 금지)
- [ ] 단계별 검증 완료 (11단계 프로세스)

---

## 7. Implementation Plan

### Phase 1: 기준 코드 검증 (0.5시간)

- [x] MON-002 코드 분석 완료 ✅
- [x] constants.ts 추가 (SCREEN_MAX_DEPTH, SCREEN_INITIAL_INTERVAL) ✅
- [ ] Backend API 함수 시그니처 확인

### Phase 2: 싸이클 파형 3개 화면 (2시간)

**우선순위 최상**: 가장 복잡한 화면 먼저

1. **ANL-003: 싸이클 분석**
   - 싸이클 파형 오버레이 (기준/비교1/비교2)
   - interval 상태 관리 + onZoomChange
   - getCycleWaveformData(cycleId, isRef, interval) 호출

2. **ANL-004: 싸이클 타임 지연**
   - ANL-003과 유사 패턴

3. **SET-003: 기준 싸이클 파형**
   - onZoomChange={undefined} (줌 비활성화)

### Phase 3: 시간 범위 트렌드 8개 화면 (3시간)

**MON-002 패턴 복사**

- MON-001, DSH-001, DSH-002
- ANL-001, ANL-002, ANL-005
- ALT-004, ALT-006

### Phase 4: 검증 (2시간)

- [ ] 브라우저 콘솔 검증 (12개 화면)
- [ ] TypeScript 컴파일
- [ ] Mock → Real API 전환
- [ ] Gap Analysis

**총 예상 시간**: 7.5시간

---

## 8. Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| 싸이클 파형 interval 미구현 | High | Mock 데이터 먼저 구현, Backend는 Phase 4 |
| 12개 화면 동시 수정 에러 | Medium | 한 화면씩 검증 후 진행 |
| 브라우저 콘솔 에러 | Medium | 각 화면 완료 시 즉시 확인 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-28 | Initial draft | Claude |
| 1.1~1.4 | 2026-02-28 | User feedback iterations (Backend, Console, MON-002 기준) | Claude |
| 2.0 | 2026-02-28 | **재작성**: 모든 시간축 차트 적용 명확화 | Claude |
