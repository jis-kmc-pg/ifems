# i-FEMS CLAUDE.md
> Intelligence Facility & Energy Management System — 화성 PT4공장
> Claude Code 협업 지침서 (2026-02-19 작성, 2026-03-06 최종 갱신)

---

## 📁 프로젝트 위치
```
d:\AI_PJ\IFEMS\
```

## 🏗 아키텍처
```
IFEMS/ (pnpm monorepo)
├── apps/
│   ├── web/          # Frontend (React 19 + Vite 6 + TypeScript, :3200+)
│   └── api/          # Backend (NestJS 11 + Prisma, :4001)  [79 APIs 완료, 91% Match Rate]
├── shared/           # 공통 타입 (@ifems/shared)
└── docs/             # 설계 문서
```

## 🛠 기술 스택
| 영역 | 기술 |
|------|------|
| Frontend | React 19, Vite 6, TypeScript 5.7 |
| 라우팅 | React Router v7 (createBrowserRouter) |
| 서버 상태 | TanStack Query v6 |
| 전역 상태 | Zustand v5 (persist middleware) |
| 스타일 | Tailwind CSS v4 (@tailwindcss/vite) |
| 아이콘 | Lucide React |
| 차트 | uPlot 1.6.32 (Canvas, ~50KB) — ~~Recharts~~ 마이그레이션 완료 |
| 패키지 | pnpm workspace |
| Backend | NestJS 11, Prisma ORM |
| DB | PostgreSQL 16 + TimescaleDB (localhost:5432/ifems) |

## 🎨 디자인 시스템

### 색상 팔레트
```
GNB 배경:    #1A1A2E (네이비 다크)
GNB 라이트:  #16213E
액센트:      #E94560 (레드)
사이드바:    white (라이트) / #16213E (다크)
활성 사이드바: #1A1A2E 배경, white 텍스트
```

### 신호등 색상 (절대 변경 금지)
```
정상(NORMAL):  #27AE60 (초록)
주의(WARNING): #F39C12 (황색)
위험(DANGER):  #E74C3C (빨강)
오프라인:      #7F8C8D (회색)
```

### 차트 색상 규칙 (기존 시스템 기준)
- 전력 당일: #F39C12 (노란 막대/선)
- 전력 전일: rgba(156,163,175,0.5) (회색 영역)
- 에어 당일: #3B82F6 (파란 막대/선)
- 에어 전일: rgba(156,163,175,0.5) (회색 영역)
- 현재 시각 기준선: #E74C3C (빨간 수직선)

## 📐 화면 구조 (32개)

### GNB 메뉴 → 사이드바 → 화면
```
모니터링
  ├── 종합 현황 (MON-001)
  ├── 라인별 상세 (MON-002)
  ├── 에너지 사용 순위 (MON-003)
  ├── 에너지 알림 현황 (MON-004)
  ├── 전력 품질 순위 (MON-005)
  └── 에어 누기 순위 (MON-006)

대시보드
  ├── 에너지 사용 추이 (DSH-001)
  ├── 설비별 추이 (DSH-002)
  ├── 사용량 분포 (DSH-003)
  ├── 공정별 순위 (DSH-004)
  ├── 싸이클당 순위 (DSH-005)
  ├── 전력 품질 순위 (DSH-006)
  ├── 에어 누기 순위 (DSH-007)
  └── 에너지 변화 TOP N (DSH-008)

알림
  ├── 전력 품질 통계 (ALT-001)
  ├── 에어 누기 통계 (ALT-002)
  ├── 싸이클 이상 통계 (ALT-003)
  ├── 전력 품질 이력 (ALT-004)
  ├── 에어 누기 이력 (ALT-005)
  └── 싸이클 이상 이력 (ALT-006)

분석
  ├── 비교 분석 (ANL-001)
  ├── 상세 비교 분석 (ANL-002)
  ├── 싸이클 분석 (ANL-003)
  ├── 싸이클 타임 지연 (ANL-004)
  └── 전력 품질 분석 (ANL-005)

설정
  ├── 전력 품질 설정 (SET-001)
  ├── 에어 누기 설정 (SET-002)
  ├── 기준 싸이클 파형 (SET-003)
  ├── 싸이클 알림 설정 (SET-004)
  ├── 에너지 사용량 알림 (SET-005)
  └── 싸이클당 에너지 알림 (SET-006)
```

## 🏭 설비 데이터 규칙

### 설비명 명명 규칙
```
HNK{라인번호}-{공정번호}{선택-서브번호}
예: HNK10-000, HNK10-010/020, HNK10-010-1, HNK10-010-G/L
```

### 라인 코드
```
블록: HNK10-xxx
헤드: HNK20-xxx
크랭크: HNK30-xxx
조립: HNK40-xxx
```

### 공정 그룹 (블록 라인 기준)
```
OP00: 메인 (HNK10-000)
OP10: 소재투입 (HNK10-010, 010-1~5, 010/020, 010-G/L)
OP20: 가공 (HNK10-020-1~5)
OP30: 중간 검사 (HNK10-030)
OP40: 후가공 (HNK10-040)
UTL: 유틸리티 (컴프레서, 쿨링타워, 집진기)
```

## 🔧 개발 규칙

### 1. Mock ↔ API 전환 패턴
```typescript
// USE_MOCK = true(기본) → 목업 데이터
// USE_MOCK = false → 실제 API 호출
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
```

### 2. 서비스 레이어 위치
```
apps/web/src/services/
├── api.ts              # axios 인스턴스
├── monitoring.ts       # MON 화면 API
├── dashboard.ts        # DSH 화면 API
├── alert.ts            # ALT 화면 API
├── analysis.ts         # ANL 화면 API
├── settings.ts         # SET 화면 API
└── mock/               # 목업 데이터
    ├── facilities.ts   # 설비 마스터
    ├── monitoring.ts   # 모니터링 데이터
    ├── dashboard.ts    # 대시보드 데이터
    ├── alerts.ts       # 알림 데이터
    ├── analysis.ts     # 분석 데이터
    └── settings.ts     # 설정 데이터
```

### 3. 공통 컴포넌트 경로
```
apps/web/src/components/
├── layout/
│   ├── AppLayout.tsx    # 전체 레이아웃 (GNB + Sidebar + Content)
│   ├── GNB.tsx          # 상단 전역 네비게이션
│   ├── Sidebar.tsx      # 좌측 사이드바 (GNB 선택에 따라 메뉴 변경)
│   └── PageHeader.tsx   # 페이지 제목 + 액션 버튼
└── ui/
    ├── KpiCard.tsx      # KPI 카드 (값 + 증감율 배지)
    ├── FilterBar.tsx    # 필터바 (동적 필터 + Search 버튼)
    ├── TrafficLight.tsx # 신호등 + StatusBadge
    ├── SortableTable.tsx # 정렬 + 페이징 테이블
    ├── ChartCard.tsx    # 차트 래퍼 (제목 + Export 버튼)
    ├── TreeCheckbox.tsx # 계층 체크박스 트리
    └── Modal.tsx        # 모달 + ConfirmModal
```

### 4. TrendChart 높이 측정 방식 (2026-03-06)
- ChartCard 내부의 `p-3` padding으로 인해 `parentElement` 높이에서 padding을 차감해야 x축 라벨이 잘리지 않음
- `getComputedStyle(parent)`로 paddingTop/paddingBottom 계산 후 차감
- `ResizeObserver` + `hasData` 의존성으로 데이터 로드 시점 재측정 보장
- **width는 `dims.width - 40` 유지** (기존 테스트 결과 반영, 변경 금지)

### 5. 차트 작성 패턴 (uPlot + TrendChart)
```tsx
// TrendChart 컴포넌트 사용 (uPlot 래퍼)
import TrendChart, { TrendSeries } from '../../components/charts/TrendChart';

// series 정의 — key가 데이터 객체의 프로퍼티명과 정확히 일치해야 함!
const series: TrendSeries[] = [
  { key: 'prev', label: '전일', color: 'rgba(128,128,128,0.3)', type: 'area', fillOpacity: 0.25 },
  { key: 'current', label: '당일 전력(kWh)', color: COLORS.energy.power, type: 'bar', fillOpacity: 1 },
];

// data 배열의 각 항목에 series.key와 동일한 프로퍼티가 있어야 함
// 예: [{ time: '04:00', current: 18.5, prev: 17.2 }, ...]
<TrendChart
  data={data}
  series={series}
  xKey="time"
  yLabel="kWh"
  currentTime={CURRENT_TIME}  // 빨간 수직 기준선
/>
```
**⚠️ 키 일치 규칙**: `series[].key`와 `data[].{key}` 프로퍼티명 불일치 시 빈 차트 발생

### 6. 페이지 파일명 규칙
```
pages/monitoring/MON001Overview.tsx
pages/dashboard/DSH001EnergyTrend.tsx
pages/alert/ALT001PowerQualityStats.tsx
pages/analysis/ANL001Comparison.tsx
pages/settings/SET001PowerQuality.tsx
```

## 🔌 Backend API 규칙

### Dynamic Chart Resolution (Progressive Resolution)
**⚡ 전체 적용 범위**: i-FEMS의 **모든 라인 차트 및 바 차트**에 Dynamic Chart Resolution이 적용됩니다.

**4단계 해상도 자동 전환** - 차트 범위에 따라 최적 데이터 밀도 제공

```
15m interval → energy_timeseries (기본, 7일 이상)
1m interval  → energy_usage_1min (1시간~7일)
10s interval → tag_data_raw (10분~1시간)
1s interval  → tag_data_raw (10분 이하)
```

**📊 화면별 Dynamic Resolution 적용 및 Depth 제한**

| 화면 ID | 차트 종류 | 최대 Depth | 허용 Interval | 비고 |
|---------|----------|-----------|--------------|------|
| **MON-001** | 복합 (막대+영역) | Level 2 (1m) | 15m, 1m | 종합 현황, 시간별 트렌드 |
| **MON-002** | 복합 (막대+영역) | **Level 3 (10s)** | 15m, 1m, 10s, 1s | 라인별 상세 (Dynamic Resolution 테스트 화면) |
| **DSH-001** | 라인 (월별 추이) | Level 1 (15m) | 15m만 | 월간 트렌드, 줌 불필요 |
| **DSH-002** | 라인 (설비별) | Level 2 (1m) | 15m, 1m | 설비 비교 분석 |
| **ANL-001** | 영역 (비교 분석) | Level 2 (1m) | 15m, 1m | 다중 설비 비교 |
| **ANL-002** | 라인 (상세 비교) | Level 3 (10s) | 15m, 1m, 10s | 2개 조건 상세 비교 |
| **ANL-003** | 라인 (싸이클) | **Level 3 (1s)** | 10s, 1s | 싸이클 파형 분석 (초 단위 필수) |
| **ANL-004** | 라인 (싸이클 지연) | Level 3 (1s) | 10s, 1s | 3패널 비교 (초 단위) |
| **ANL-005** | 라인 (전력 품질) | Level 2 (1m) | 15m, 1m | 불평형률 + 역률 분석 |
| **ALT-004** | 라인 (모달) | Level 1 (15m) | 15m | 전력 품질 이력 차트 |
| **ALT-006** | 라인 (모달) | Level 2 (10s) | 15m, 10s | 싸이클 이상 파형 |
| **SET-003** | 라인 (모달) | Level 3 (1s) | 1s만 | 기준 싸이클 파형 (초 단위 고정) |

**🎯 Depth Level 정의**:
- **Level 0 (15m)**: 기본 해상도, 월간/주간 트렌드
- **Level 1 (1m)**: 1차 줌, 일간/시간 상세
- **Level 2 (10s)**: 2차 줌, 분 단위 상세
- **Level 3 (1s)**: 최대 줌, 초 단위 파형 분석

**⚠️ 화면별 제한 이유**:
- **MON-001**: 종합 현황 → 1분까지만 (전체 라인 동시 표시)
- **DSH-001**: 월간 추이 → 15분 고정 (줌 불필요)
- **ANL-003, ANL-004, SET-003**: 싸이클 분석 → 1초 필수 (파형 분석용)
- **기타 분석**: 1분 또는 10초까지 (데이터 양 vs 성능 균형)

**API 엔드포인트 패턴**:
```
GET /api/monitoring/range/:facilityId/power?start={ISO8601}&end={ISO8601}&interval={15m|1m|10s|1s}
GET /api/monitoring/range/:facilityId/air?start={ISO8601}&end={ISO8601}&interval={15m|1m|10s|1s}
```

**응답 구조**:
```typescript
{
  current: {
    data: Array<{ timestamp: string; value: number }>;
    startTime: string;
    endTime: string;
  };
  previous: {
    data: Array<{ timestamp: string; value: number }>;
    startTime: string;
    endTime: string;
  };
}
```

**캐싱 전략** (In-Memory Cache):
- 15m: TTL 15분
- 1m: TTL 1분
- 10s/1s: TTL 10초

**⚠️ 중요 규칙**:
1. interval 파라미터는 필수 (누락 시 400 에러)
2. start/end는 ISO 8601 형식 (UTC)
3. previous 데이터는 동일 길이의 이전 기간 (예: 1시간 범위 → 1시간 전 데이터)
4. 데이터 없음은 빈 배열 반환 (null 아님)
5. **각 화면의 최대 Depth를 초과하는 줌은 비활성화** (UI에서 제한)

### 태그 종류별 조회 방식 (KPI vs 차트, 2026-03-06)

> **⚠️ 중요**: USAGE(적산) 태그는 KPI와 차트에서 조회 방식이 다릅니다.

| 태그 종류 | KPI (단일 집계값) | 차트 (시계열) |
|----------|-----------------|-------------|
| **USAGE** (적산) | 적산차: `LAST(last_value) - FIRST(first_value) + SUM(reset_correction)` | 보정 뷰 `corrected_usage_diff` 시계열 |
| **TREND** (순시) | `LAST` (최신 값) 또는 `MAX` (피크) | 버킷별 `last_value` 시계열 |
| **SENSOR** (센서) | `AVG` (평균) | 버킷별 `avg_value` 시계열 |
| **OPERATE** (가동) | `SUM` (가동 시간) | 버킷별 `SUM` 시계열 |

- KPI(일일 총 사용량)에 `SUM(raw_usage_diff)`를 쓰면 결측 구간 사용량이 누락됨
- 적산차는 미터기의 시작~끝 값만 보므로 중간 결측과 무관하게 정확한 총량 산출
- 상세: `docs/TAG-DATA-SPEC.md` → "용도별 조회 방식" 섹션 참조

### 이상 데이터 감지 시스템 (Anomaly Detection, 2026-03-05)

**목적**: 적산 전력계 센서 글리치, 통신 오류 등으로 발생하는 비정상 사용량 자동 감지 및 보정

**감지 로직**:
- 1분 Cron으로 `cagg_usage_1min`에서 LAG() 기반 직전 분 대비 배율 계산
- 배율 >= threshold (기본 5배) → 이상 판정
- 연속 1~2분: 직전 정상값으로 대체 (보간)
- 연속 3분+: NULL 처리 (값 채우지 않음)

**DB 구조**: `meter_reset_events` 테이블 확장 (기존 리셋 이벤트와 통합)
```
event_type: 'reset' | 'anomaly'
deviation_multiplier: 실제 배율 (예: 7.3)
replacement_value: 대체값
consecutive_count: 연속 횟수
```

**API 응답**: `RangeDataResponse.anomalies?: AnomalyEvent[]`
```typescript
interface AnomalyEvent {
  start: string;         // ISO8601 시작
  end: string;           // ISO8601 종료
  tagId: string;
  type: 'spike' | 'drop';
  maxDeviation: number;  // 최대 배율
  consecutiveMinutes: number;
  replacedWith: 'lastNormal' | 'null';
}
```

**차트 시각화**: TrendChart `anomalies` prop → 반투명 영역 (spike=빨강, drop=주황) + 배율 라벨

**설정 API**:
- `GET /api/settings/anomaly-detection` — 설비별 임계값 조회
- `PUT /api/settings/anomaly-detection` — 설비별 임계값 저장
- 기본값: threshold1=5 (5배), threshold2=2 (2분)

**관련 파일**:
- Backend: `reset-detector.service.ts`, `monitoring.service.ts`, `range-response.dto.ts`
- Frontend: `TrendChart.tsx`, `useDynamicResolution.ts`, `types/chart.ts`
- DB: `prisma/schema.prisma`, `prisma/migrations/20260305_anomaly_detection/`

### Backend API 엔드포인트 (79개)

```
Monitoring (11개):
  - GET /overview/kpi                    # 전체 KPI
  - GET /overview/hourly                 # 시간별 트렌드
  - GET /line/mini-cards                 # 라인별 미니카드
  - GET /line/:lineCode/detail           # 라인 상세 차트
  - GET /energy/ranking                  # 에너지 순위
  - GET /range/:facilityId/power         # 전력 동적 해상도 ⚡
  - GET /range/:facilityId/air           # 에어 동적 해상도 ⚡
  - GET /range/:facilityId/gas           # 가스 동적 해상도 ⚡
  - GET /range/:facilityId/solar         # 태양광 동적 해상도 ⚡

Dashboard (9개):
  - GET /energy/trend                    # 에너지 사용 추이
  - GET /process/ranking                 # 공정별 순위
  - GET /cycle/ranking                   # 싸이클당 순위
  - GET /facility/list                   # 설비 목록

Alerts (7개):
  - GET /stats/kpi                       # 알림 KPI 통계
  - GET /trend                           # 알림 추이
  - GET /history                         # 알림 이력
  - POST /:id/action                     # 조치사항 저장

Analysis (7개):
  - GET /facility/tree                   # 설비 트리
  - GET /facility/hourly                 # 설비별 시간 데이터
  - GET /comparison/detailed             # 상세 비교
  - GET /cycle/list                      # 싸이클 목록
  - GET /power-quality                   # 전력 품질 분석

Settings (45개):
  - GET /general                         # 일반 설정
  - POST /general                        # 일반 설정 저장
  - GET /power-quality/thresholds        # 전력 품질 임계값
  - POST /power-quality/thresholds       # 전력 품질 임계값 저장
  - GET /anomaly-detection               # 이상 감지 임계값 조회 (2026-03-05)
  - PUT /anomaly-detection               # 이상 감지 임계값 저장 (2026-03-05)
  ... (38개 더)
```

### 공통 응답 규칙
```typescript
// 성공 응답: 데이터 직접 반환
{ field1: value1, field2: value2, ... }

// 에러 응답: NestJS 표준 포맷
{
  statusCode: 400 | 404 | 500,
  message: "에러 메시지",
  error: "Bad Request" | "Not Found" | "Internal Server Error"
}
```

### 화면별 API 응답 키 매핑 (Frontend ↔ Backend 계약)

> **⚠️ 중요**: 백엔드 API 응답의 키 이름이 아래와 정확히 일치해야 프론트엔드 수정 없이 동작합니다.
> 키 불일치 시 TrendChart에서 y값이 undefined → null → 빈 차트가 됩니다. (2026-03-04 MON-002 버그 원인)

#### 모니터링 (MON)

| API 엔드포인트 | 소비 화면 | 필수 응답 키 | 비고 |
|---------------|----------|-------------|------|
| `GET /overview/kpi` | MON-001 | `totalPower{value,change}`, `totalAir{value,change}`, `powerQualityAlarms{value,change}`, `airLeakAlarms{value,change}` | KPI 카드 4개 |
| `GET /overview/hourly` | MON-001 | `time`, **`current`**, **`prev`** | TrendChart: current=당일(bar), prev=전일(area) |
| `GET /line/mini-cards` | MON-001 | `id`, `label`, `power`, `powerUnit`, `air`, `airUnit`, `powerStatus`, `airStatus` | 라인별 미니카드 |
| `GET /line/:lineCode/detail` | MON-002 | power: `time`, **`power`**, **`prevPower`** / air: `time`, **`air`**, **`prevAir`** | TrendChart: power/air=당일(bar), prevPower/prevAir=전일(area) |
| `GET /energy/ranking` | MON-003 | `code`, `process`, `dailyElec`, `weeklyElec`, `rankChangeElec`, `status` | 테이블 |
| `GET /alarm-summary` | MON-001 | `line`, `powerQuality`, `airLeak`, `total` | 알림 테이블 |

#### 대시보드 (DSH)

| API 엔드포인트 | 소비 화면 | 필수 응답 키 | 비고 |
|---------------|----------|-------------|------|
| `GET /energy/trend` | DSH-001 | `month`, **`power`**, **`prevPower`**, **`air`**, **`prevAir`** | TrendChart: 월별 추이 |
| `GET /facility/trend` | DSH-002 | `dates[]`, `facilities[].code`, `.powerData[]`, `.airData[]` | 페이지에서 `row[f.code]`로 동적 키 생성 |

#### 분석 (ANL)

| API 엔드포인트 | 소비 화면 | 필수 응답 키 | 비고 |
|---------------|----------|-------------|------|
| `GET /facility/hourly` | ANL-001 | `time`, `timestamp`, **`current`** | 페이지에서 `row[facilityId] = data[i].current`로 변환 |
| `GET /comparison/detailed` | ANL-002 | `time`, `timestamp`, **`origin`**, **`compare`**, **`diff`** | TrendChart: 오버레이 + 차이 |
| `GET /cycle/waveform` | ANL-003 | `sec`, **`value`** (기준파형) | 페이지에서 `ref`/`cycle1`/`cycle2`로 매핑 |
| `GET /power-quality` | ANL-005 | `time`, **`current`** | 페이지에서 `imbalance`/`powerFactor` 변환 후 `${id}_imb`/`${id}_pf` 키 생성 |

#### 알림 (ALT)

| API 엔드포인트 | 소비 화면 | 필수 응답 키 | 비고 |
|---------------|----------|-------------|------|
| `GET /:id/waveform` | ALT-004 | `time`, `timestamp`, **`current`**, `prev` | TrendChart: current=불평형률(line) |
| `GET /:id/waveform` | ALT-006 | `time`, `timestamp`, **`current`**, **`prev`** | TrendChart: prev=기준파형, current=이상파형 |

#### 설정 (SET)

| API 엔드포인트 | 소비 화면 | 필수 응답 키 | 비고 |
|---------------|----------|-------------|------|
| `GET /cycle/waveform` | SET-003 | `sec`, **`value`** | TrendChart: 기준 파형(line) |

#### 동적 해상도 (Dynamic Resolution) — 공통

| API 엔드포인트 | 필수 응답 키 | 비고 |
|---------------|-------------|------|
| `GET /range/:facilityId/:metric` | `current.data[]{timestamp, value}`, `previous.data[]{timestamp, value}` | useDynamicResolution 훅이 `{time, value, power, prevPower}` 등으로 변환 |

#### 키 매핑 요약 (generateTimeSeriesData 기반 Mock)

`generateTimeSeriesData()` 유틸이 반환하는 기본 키는 `{time, timestamp, current, prev}`.
화면별로 다른 키가 필요한 경우 **Mock 데이터 또는 서비스 레이어에서 키를 변환**하여 series와 일치시켜야 함.

```
MON-001 series: current, prev        ← Mock: computeHourlyTrend() → {time, current, prev}
MON-002 series: power, prevPower     ← Mock: computeLineDetailChart() → {time, power, prevPower}
         series: air, prevAir        ← Mock: computeLineDetailChart() → {time, air, prevAir}
DSH-001 series: power, prevPower     ← Mock: ENERGY_TREND_MONTHLY → {month, power, prevPower, air, prevAir}
         series: air, prevAir
DSH-002 series: [facilityCode]       ← Mock: FACILITY_TREND_DATA → row[f.code] 동적 변환
ANL-001 series: [facilityId]         ← Mock: getFacilityElecData() → row[id] = data[i].current
ANL-002 series: origin, compare, diff ← Mock: getDetailedComparison() 직접 매핑
ANL-003 series: ref, cycle1, cycle2  ← 페이지 인라인 변환
ANL-005 series: ${id}_imb, ${id}_pf  ← 페이지 인라인 변환
ALT-004 series: current              ← Mock: generateTimeSeriesData() → {current, prev}
ALT-006 series: prev, current        ← Mock: generateTimeSeriesData() → {current, prev}
SET-003 series: value                ← Mock: getCycleWaveform() → {sec, value}
```

### DTO Validation (class-validator)
```typescript
// 필수: 모든 Query/Body에 DTO 클래스 적용
export class EnergyRankingQueryDto {
  @ApiPropertyOptional({ example: 'block' })
  @IsOptional()
  @IsString()
  line?: string;

  @ApiPropertyOptional({ enum: ['elec', 'air'] })
  @IsOptional()
  @IsIn(['elec', 'air'])
  type?: string;
}
```

### Swagger 문서화
- 모든 엔드포인트: `@ApiOperation()` + `@ApiResponse()` 필수
- Query/Body: `@ApiQuery()` / `@ApiBody()` 명시
- Enum: `@ApiPropertyOptional({ enum: [...] })` 사용
- 예제: `example: 'block'` 제공

---

## 📘 문서 체계 (Documentation Index)

### 📖 프로젝트 메인 문서
| 문서 | 위치 | 용도 | 우선순위 |
|------|------|------|---------|
| **README.md** | 루트 | 프로젝트 개요, 빠른 시작, 문서 인덱스 | ⭐⭐⭐ |
| **CLAUDE.md** | 루트 | **협업 지침** (bkit 에이전트 참조, 모든 규칙) | ⭐⭐⭐⭐⭐ |

### 📋 개발 계획 및 현황
| 문서 | 위치 | 용도 |
|------|------|------|
| **PLAN.md** | docs/ | 프로젝트 개발 계획서 (32화면, Phase 1-7, PDCA 아카이브) |
| **CHANGELOG.md** | docs/ | 변경 이력 (Backend API, Dynamic Resolution, 마이그레이션) |
| **STATUS.md** | docs/ | 프로젝트 진행 현황 스냅샷 |

### 🏷️ 도메인 지식 (필독)
| 문서 | 위치 | 용도 |
|------|------|------|
| **TAG-DATA-SPEC.md** | docs/ | **태그 데이터 사양서** (5가지 태그 종류, 집계 로직, Null vs 0) |
| **ENERGY-CALCULATION-GUIDE.md** | docs/ | 에너지 계산 상세 가이드 (TREND/USAGE 차이, 차분 계산) |
| **TAG_MANAGEMENT_DESIGN.md** | docs/ | Tag Management System 상세 설계 |

### 🎨 UI/UX 가이드
| 문서 | 위치 | 용도 |
|------|------|------|
| **UI-UX-GUIDELINES.md** | docs/ | UI/UX 가이드라인 (색상, 차트 패턴, 레이아웃) |
| ~~UI-AUDIT-REPORT.md~~ | archive/2026-02/reports/ | 아카이브 |
| ~~UI-UX-IMPROVEMENT-REPORT.md~~ | archive/2026-02/reports/ | 아카이브 |

### 🔌 Backend 개발
| 문서 | 위치 | 용도 |
|------|------|------|
| **BACKEND-API-CHECKLIST.md** | docs/ | Backend API 완료 보고서 (77개 API, 91% Match Rate) |
| **API-CONTINUOUS-AGGREGATE.md** | docs/ | TimescaleDB Continuous Aggregate API 가이드 (2026-03-03) |
| **API-TEST-PLAN.md** | docs/ | API 테스트 계획서 |
| ~~API-INTEGRATION-TEST-REPORT.md~~ | archive/2026-02/reports/ | 아카이브 |

### 📁 PDCA 아카이브 (완료 프로젝트)
| 프로젝트 | 위치 | Match Rate |
|---------|------|-----------|
| backend-api | archive/2026-02/backend-api/ | 91% |
| backend-dynamic-resolution | archive/2026-02/backend-dynamic-resolution/ | 96% |
| tag-management | archive/2026-02/tag-management/ | 93% |
| 동적-차트-해상도 | archive/2026-02/dynamic-chart-resolution/ | 90% |
| frontend-backend-integration | archive/2026-03/frontend-backend-integration/ | 98% |
| tag-classification-redesign | archive/2026-03/tag-classification-redesign/ | 93% |

### 📌 활성 PDCA 문서
| 프로젝트 | Plan | Design | Analysis | Report | 상태 |
|---------|------|--------|----------|--------|------|
| **dynamic-resolution-전체적용** | ✅ | ✅ | ✅ | ✅ | 구현 대기 |
| **tag-management-phase2** | ✅ | ✅ | ✅ | - | 중기 |
| **anomaly-detection** | - | - | - | - | 구현 완료 (2026-03-05) |

### 📐 구현 가이드
| 문서 | 위치 | 용도 |
|------|------|------|
| **group-a-pattern.md** | docs/03-implementation/ | Dynamic Resolution 전체적용 구현 패턴 가이드 |

### 📊 분석 보고서 (아카이브 완료)
- `ifems-frontend.analysis.md` → archive/2026-02/reports/
- `ifems-integration.analysis.md` → archive/2026-03/frontend-backend-integration/
- `recharts-to-uplot-migration.analysis.md` → archive/2026-02/reports/

---

## 📘 필수 참조 문서 상세

### TAG-DATA-SPEC.md (태그 데이터 사양서)
**위치**: `docs/TAG-DATA-SPEC.md`

**필독 사유**: 이 문서는 i-FEMS의 **핵심 도메인 지식**입니다. 모든 데이터 처리 로직에 적용됩니다.

**적용 범위**:
- Mock 데이터 생성 (`tag-data-collector.service.ts`)
- 집계 로직 (`energy-aggregator.service.ts`)
- 차트 표시 (`TrendChart.tsx`, `BarChart.tsx` 등)
- API 응답 포맷 (모든 컨트롤러)

**핵심 내용**:
1. **태그 종류 5가지**: TREND(순시), USAGE(적산), OPERATE(가동), SENSOR(센서), CONTROL(제어)
2. **에너지 종류 4가지**: elec(전력), air(에어), gas(가스), solar(태양광)
3. **집계 로직**:
   - TREND: 마지막 값
   - USAGE: **차분 계산** (endValue - startValue) ⚠️ 절대 합산 금지
   - OPERATE: 합 (가동 시간)
   - SENSOR: 평균
4. **Null vs 0**: 데이터 없음 = null (0 아님!)

**⚠️ 중요**: 코드 작성 시 반드시 이 문서를 참조하여 태그 종류별 올바른 로직을 적용할 것!

---

## ⚠️ 절대 규칙

### Frontend 규칙
1. **TAG-DATA-SPEC.md 준수** - 태그 종류별 계산 로직 반드시 따를 것
2. **신호등 색상 고정** - 정상/주의/위험 색상 변경 금지
3. **UI/UX 변경 전 허락** - 화면 구조/레이아웃 변경 시 먼저 보고
4. **Mock 데이터 분리** - 실제 API 연동 시 서비스 레이어만 수정
5. **TypeScript strict** - any 타입 사용 금지

### Backend 규칙
1. **Dynamic Resolution 준수** - 4단계 interval 규칙 반드시 따를 것
2. **DTO Validation 필수** - 모든 엔드포인트에 class-validator 적용
3. **Swagger 문서화 필수** - @ApiOperation, @ApiResponse 누락 금지
4. **에러 처리 통일** - GlobalExceptionFilter 사용 (커스텀 예외 금지)
5. **매개변수 통일성** - type은 `'elec' | 'air'` (power 사용 금지)

### 공통 규칙
1. **기능 로직 수정 금지** - 승인 없이 비즈니스 로직 변경 불가
2. **한국어 설명** - 수정 설명은 항상 한국어로 (무엇이/어떻게/효과)

## 🚀 실행 방법
```bash
# 의존성 설치
pnpm install

# 개발 서버 (Frontend만)
pnpm dev:web

# 전체 실행
pnpm dev
```

## 📊 개발 현황
→ `docs/PLAN.md` 참조
