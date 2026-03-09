# i-FEMS UI/UX Design Guidelines (Compact)

> 실시간 에너지 모니터링 시스템 - i-FEMS 고유 디자인 규칙
> **Last Updated**: 2026-03-05
> **Note**: 일반적인 React/Tailwind 패턴은 생략. i-FEMS 고유 규칙만 기술.

---

## 색상 체계

> 상세 CSS 변수 및 차트 색상은 [CLAUDE.md](../CLAUDE.md) "색상 체계" 섹션 참조

### 핵심 규칙

| 용도 | 색상 | HEX |
|------|------|-----|
| GNB 배경 | 다크 네이비 | `#1A1A2E` |
| 액센트 | 빨강 | `#E94560` |
| 전력 차트 | 노란 막대 | `#FDB813` |
| 에어 차트 | 파란 막대 | `#2E86DE` |
| 전일 비교 | 회색 영역 | `rgba(128,128,128,0.3)` |
| 현재 시각선 | 빨간 수직선 | `#E74C3C` |
| 정상 | 초록 | `#27AE60` |
| 경고 | 노랑 | `#F39C12` |
| 위험 | 빨강 | `#E74C3C` |

---

## 레이아웃 상수

```
GNB Height: 60px
Sidebar Width: 240px (collapsed: 60px)
Content Max Width: 1920px
Content Padding: 24px
Grid: 12-column (Tailwind)
```

---

## 차트 규칙

### 차트 라이브러리: uPlot 1.6.32

> ~~Recharts~~ → **uPlot** 마이그레이션 완료 (2026-02-25)

- **TrendChart.tsx**: 공통 래퍼 (bar/area/line, 동적 해상도 지원)
- **CycleChart.tsx**: 싸이클 분석 전용
- ResizeObserver 자동 크기 조절 (고정 크기 금지)
- `syncKey` prop으로 멀티 차트 커서 동기화

### 차트 타입별 용도

| 타입 | 용도 | 컴포넌트 |
|------|------|---------|
| bar + area | 시간대별 전력/에어 트렌드 (MON-001, MON-002) | TrendChart |
| line (multi) | 설비별 추이 비교 (DSH-002, ANL-001) | TrendChart |
| line (3-panel) | 싸이클 분석 (ANL-003, ANL-004) | CycleChart |

### 차트 데이터 키 규칙 (중요)

> `series[].key` ↔ `data[].{key}` 불일치 시 빈 차트 발생

상세 매핑은 [CLAUDE.md](../CLAUDE.md) "화면별 API 응답 키 매핑" 섹션 참조

---

## 단위 표시 규칙

```typescript
const units = {
  power: 'kW',       // 순시 전력
  energy: 'kWh',     // 적산 전력량
  air: 'm³',         // 에어 사용량
  airFlow: 'm³/min', // 에어 유량
  temp: '℃',
  pressure: 'bar',
  percentage: '%',
};
```

- 숫자: 등폭 폰트 (`font-mono`)
- 단위: 숫자 옆 작은 회색 텍스트로 분리 표시
- KPI 카드: 숫자 `text-4xl font-bold` + 단위 `text-sm text-gray-500`

---

## 알람 시스템

### 심각도 순서

DANGER (빨강) > WARNING (노랑) > NORMAL (초록)

### 알람 유형

- `POWER_QUALITY`: 전력 품질 (불평형률, 역률)
- `AIR_LEAK`: 에어 누기
- `CYCLE_ANOMALY`: 싸이클 이상
- `ENERGY_SPIKE`: 에너지 급증
- `THRESHOLD`: 임계값 초과

### UI 규칙

- Toast: 최대 3개 동시 표시, 위험 우선
- 확인된 알람: 불투명도 50%
- 필터: 심각도, 설비, 상태 (미확인/확인)

---

## 24시간 모니터링 환경

- 배경: 순수 검정 대신 다크 네이비(`#0A0E27`) — 눈의 피로 감소
- 과도한 애니메이션 자제 — 위급 알람만 점멸 (1초 간격)
- 연결 상태 표시 (Connected / Disconnected) + 마지막 업데이트 시간
- 데이터 갱신 인디케이터 (페이드 인/아웃)

---

## 성능 최적화 요약

- 차트 데이터: 최대 500 포인트로 다운샘플링
- API: React Query (SWR) 캐싱 + 5초 갱신 + 2초 중복 방지
- 코드 스플리팅: `React.lazy()` 라우트 기반
- 가상화: 100개+ 항목 시 `react-window` 사용

---

## 참고 자료

### 프로젝트 내부
- [CLAUDE.md](../CLAUDE.md): 색상 체계, 차트 키 매핑, 설비명 규칙
- [TAG-DATA-SPEC.md](TAG-DATA-SPEC.md): 태그 데이터 사양 (단위, 집계 로직)

### 외부 SCADA/HMI 디자인
- [SCADA System Design Tips | Inductive Automation](https://inductiveautomation.com/resources/webinar/top-10-design-security-tips-to-elevate-your-scada-system)
- [HMI Design Best Practices | AufaitUX](https://www.aufaitux.com/blog/hmi-design-best-practices/)
- [Energy Dashboard Examples | Bold BI](https://www.boldbi.com/dashboard-examples/energy/)

---

**축소 이력**: 2026-03-05 — 1,717줄 → ~130줄 (일반 React/CSS 패턴 제거, i-FEMS 고유 규칙만 보존)
