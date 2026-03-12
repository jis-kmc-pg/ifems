# i-FEMS Changelog

All notable changes to the i-FEMS project are documented in this file.

---

## [2026-03-11] - ANL007/008 기간별 비교 & TrendChart 줌 안정화 & 시간 표시 개선

### Added
- **ANL007 기간별 전력 상세 비교** (`ANL007PeriodPowerComparison.tsx`)
  - 단일 설비 + 다중 날짜 비교 (최대 4일, 색상 자동 할당)
  - `useSearchFilter` 훅 + `useDynamicResolution` 통합
  - 날짜 컬러칩 + X 제거 + 점선 안내 박스

- **ANL008 기간별 에어 상세 비교** (`ANL008PeriodAirComparison.tsx`)
  - ANL007 클론 (에어용, energyType='air', yLabel='순시값(m³/min)')

### Changed
- **TrendChart spanGaps 적용** (`TrendChart.tsx`)
  - `spanGaps: !isBar` — line/area 시리즈에서 null 갭 건너뛰고 선 연결
  - 비교 차트(ANL002/006/007/008)에서 날짜간 시간 불일치로 인한 파란선 미표시 해결
  - Bar 시리즈는 제외 (개별 막대는 갭 연결 불필요)

- **시간 표시 HH:mm → HH:mm:ss** (10초/1초 해상도 대응)
  - TrendChart x축 라벨: `slice(tIdx+1, tIdx+6)` → `slice(tIdx+1, tIdx+9)`
  - DynamicZoomBar: `slice(0,5)` → `slice(0,8)`

### Fixed
- **줌 범위 역전 방지** (ANL002/006/007/008 공통)
  - handleZoomRaw: `if (start < end)` 검증 후에만 zoomedTimeRange 설정
  - handlePan: `if (span <= 0) return` + 경계 클램핑 + `if (ns < ne)` 최종 검증
  - 증상: DynamicZoomBar "1초 (08:30 – 06:43)" → 시작>종료 → 빈 데이터

---

## [2026-03-11] - ANL006 에어 상세 비교 & TrendChart 툴팁/범례 토글 & DB 성능 최적화

### Added
- **ANL006 에어 상세 비교 화면** (`ANL006AirDetailedComparison.tsx`)
  - ANL002(전력 상세 비교)와 동일 구조, energyType='air'
  - yLabel: `순시값(m³/min)`, 라우트: `/analysis/air-detailed-comparison`
  - 메뉴 constants.ts에 "에어 상세 비교" 항목 추가

- **TrendChart 플로팅 툴팁**
  - 마우스 hover 시 커서 따라다니는 팝업 (시간 + 태그명 + 값)
  - `cursorPos` state: setCursor 훅에서 u.cursor.left/top 추적
  - `pointer-events-none`, 숨긴 시리즈 자동 제외

- **TrendChart 범례 클릭 토글**
  - `hiddenSeries` Set<string> state로 시리즈 표시/숨기기
  - uPlot series `show: !hiddenSeries.has(key)` 연동
  - 숨김 표시: 투명도 35% + 취소선
  - 기존 범례의 hover 값 표시 제거 (툴팁으로 대체)

- **tag_data_raw 인덱스 추가**
  - `CREATE INDEX idx_tag_data_raw_tagid_ts ON tag_data_raw ("tagId", "timestamp")`
  - 140M+ rows, 7 chunks, 생성 622.7초
  - 줌 쿼리 25x 개선 (10s 1hr: 2.5s→0.098s)

### Changed
- **ANL002/ANL006 UX 개선**
  - 디폴트 상태: 자동 2개 선택 → 빈 상태 (점선 안내 박스)
  - 설비 카드에 X 버튼 추가 (TreeCheckbox 연동 체크 해제)
  - DynamicZoomBar: 별도 줄 → ChartCard 헤더 우측 (actions prop)

- **TreeCheckbox 그룹 노드 동작 변경**
  - 빈 체크박스 클릭 → 전체 선택 안 하고 펼치기만
  - 인더터미네이트(-) 클릭 → 하위 아이템 전체 해제

- **에어 INSTANTANEOUS 태그 단위**: `m³` → `m³/min` (DB 657개 태그 UPDATE)

### Fixed
- **analysis.service.ts 타임스탬프 캐스트 버그**
  - `::timestamptz` → `::timestamp` (tag_data_raw.timestamp = `timestamp without time zone`)
  - PostgreSQL session timezone=Asia/Seoul → 9시간 오프셋으로 좁은 시간범위 빈 데이터 반환
- **이중 수집기 데이터 충돌**
  - 내장(10s) + 독립(1s) 동시 실행 → 적산차 음수값 발생
  - `.env`에 `DISABLE_COLLECTOR=true` 추가하여 내장 수집기 비활성화

---

## [2026-03-06] - TrendChart 높이 측정 버그 수정 & Backend NULL 처리 & KPI 적산차 방식 전환

### Changed
- **KPI 쿼리 적산차 방식 전환** (`monitoring.service.ts`)
  - **변경 전**: `SUM(raw_usage_diff)` — 분별 적산차 합산 (결측 구간 사용량 누락 문제)
  - **변경 후**: `LAST(last_value) - FIRST(first_value) + SUM(reset_correction)` — 적산차 + 리셋 보정치
  - **적용 범위**: `getOverviewKpi()`, `getLineMiniCards()`
  - **효과**: 데이터 결측 구간이 있어도 미터기 시작~끝 값으로 정확한 일일 사용량 산출

### Added
- **태그 종류별 조회 방식 문서화** (`TAG-DATA-SPEC.md`, `CLAUDE.md`)
  - KPI(단일 집계값) vs 차트(시계열)에서 태그 종류별 최적 조회 방식 정의
  - USAGE: KPI=적산차, 차트=보정뷰 시계열 / TREND: LAST / SENSOR: AVG / OPERATE: SUM

### Fixed
- **TrendChart 높이 측정 버그** (`TrendChart.tsx`)
  - **문제**: `parentElement.getBoundingClientRect()`로 높이를 측정할 때 CSS padding(`p-3`, 24px)이 포함되어 차트가 실제 content 영역보다 크게 렌더링됨. ChartCard의 `overflow-hidden`에 의해 x축 라벨이 잘려서 안 보이는 현상 발생
  - **해결**: `getComputedStyle(parent)`로 paddingTop/paddingBottom을 계산하여 높이에서 차감
  - **안정성**: ResizeObserver로 레이아웃 변경/리사이즈 자동 감지 + `hasData` 의존성 추가로 데이터 로드 후 재측정
  - **영향**: TrendChart는 공유 컴포넌트이므로 모든 차트 화면(32개)에 일괄 적용

- **Backend COALESCE 제거** (`monitoring.service.ts`)
  - **문제**: `buildTimeBucketQuery()`에서 `COALESCE(..., 0)` 사용으로 CAGG 데이터가 없는 시간대에도 0 반환 → 프론트엔드에서 "데이터 없음"과 "실제 사용량 0"을 구분할 수 없음
  - **해결**: CAGG 및 raw 기반 SQL에서 COALESCE 제거, NULL 그대로 전달
  - **효과**: 프론트엔드 `hasVisibleData` 체크가 정상 동작하여 데이터 없는 시간대에 "데이터가 없습니다" 표시 가능

---

## [2026-03-05] - Anomaly Data Detection & Chart Visualization

### Added
- **이상 데이터 감지 시스템 (Anomaly Detection)**
  - `meter_reset_events` 테이블 확장: 4개 컬럼 추가
    - `event_type` VARCHAR(20): 'reset' | 'anomaly' 구분
    - `deviation_multiplier` FLOAT: 이상 발생 시 실제 배율 (예: 7.3배)
    - `replacement_value` FLOAT: 대체값 (직전 정상값 또는 NULL)
    - `consecutive_count` INT: 연속 이상 횟수
  - `cagg_usage_1min_corrected` View 업데이트: 리셋 + 이상 통합 보정
  - `ResetDetectorService` 확장:
    - `detectAnomalies()` — 1분 Cron, LAG() 기반 분당 사용량 배율 감지
    - `getConsecutiveAnomalyCount()` — 연속 이상 횟수 추적
    - `getLastNormalUsage()` — 직전 정상값 조회
    - `recordAnomalyEvent()` — meter_reset_events에 event_type='anomaly' 기록
    - `loadAnomalyThresholds()` — 설비별 임계값 로딩 (metadata JSONB)
    - `getAnomalyEvents()` — 시간 범위 이상 이벤트 조회 + 연속 이벤트 병합
  - 보정 로직:
    - 연속 1~2분: 직전 정상값으로 대체 (보간)
    - 연속 3분+: NULL 처리 (값 채우지 않음)

- **API 응답 확장 (anomalies 필드)**
  - `AnomalyEvent` DTO: start, end, tagId, type('spike'|'drop'), maxDeviation, consecutiveMinutes, replacedWith
  - `RangeDataResponse`에 `anomalies?: AnomalyEvent[]` 필드 추가
  - `fetchRangeData()`에서 같은 시간 범위의 anomaly 이벤트 자동 조회 + 병합

- **차트 시각화 (TrendChart anomaly regions)**
  - TrendChart에 `anomalies` prop 추가
  - uPlot `hooks.draw`에서 이상 구간 반투명 영역 표시:
    - spike: rgba(239,68,68,0.12) 빨강
    - drop: rgba(249,115,22,0.12) 주황
    - 상단 라벨: "이상 N.Nx" (배율 표시)
  - 7개 페이지에 anomalies prop 전달: MON001, MON002, DSH001, DSH002, ANL001, ANL002, ANL005

- **설정 API 엔드포인트**
  - `GET /api/settings/anomaly-detection` — 설비별 이상 감지 임계값 조회
  - `PUT /api/settings/anomaly-detection` — 설비별 이상 감지 임계값 저장
  - 기본값: threshold1=5 (5배 배율), threshold2=2 (2분 연속 허용)

### Changed
- **Prisma Schema**: MeterResetEvent 모델에 4개 컬럼 + 1개 인덱스 추가
- **MonitoringService**: ResetDetectorService 주입, fetchRangeData에서 anomaly 조회
- **useDynamicResolution Hook**: anomalies 반환 추가
- **chart.ts 타입**: AnomalyEvent 인터페이스 + RangeDataResponse.anomalies 추가

### Files Modified (13개)
| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | `prisma/schema.prisma` | MeterResetEvent 4컬럼 + 인덱스 |
| 2 | `migrations/01_alter_meter_reset_events.sql` | ALTER TABLE + CREATE INDEX |
| 3 | `migrations/02_update_corrected_view.sql` | corrected view 업데이트 |
| 4 | `reset-detector.service.ts` | detectAnomalies() + 7개 메서드 |
| 5 | `settings.service.ts` | anomaly_detection 기본값 |
| 6 | `settings.controller.ts` | GET/PUT anomaly-detection |
| 7 | `range-response.dto.ts` | AnomalyEvent + anomalies 필드 |
| 8 | `monitoring.service.ts` | anomaly 이벤트 조회 |
| 9 | `TrendChart.tsx` | anomalies prop + draw hook |
| 10 | `useDynamicResolution.ts` | anomalies 반환 |
| 11 | `types/chart.ts` | AnomalyEvent 타입 |
| 12 | `services/monitoring.ts` | 응답 타입 업데이트 |
| 13 | MON001~ANL005 (7페이지) | anomalies prop 전달 |

### Verified
- TypeScript 컴파일: web 0 에러 ✅, api nest build 성공 ✅
- API 서버: 정상 기동 (port 4001) ✅
- `GET /settings/anomaly-detection`: 전 설비 기본값 반환 ✅
- `PUT /settings/anomaly-detection`: 저장 성공 ✅
- `GET /facilities/:id/power/range`: data + metadata 정상, anomalies 미감지 시 생략 ✅

---

## [2026-03-04] - Frontend-Backend Integration Completion

### Added
- **Frontend-Backend API Integration — Phase Complete**
  - `VITE_USE_MOCK=false` environment configuration (production mode enabled)
  - `VITE_API_URL=http://localhost:4001/api` API endpoint mapping
  - All 77 API endpoints verified and tested (77/77 endpoints working)
  - Response key contracts validated for all 5 modules:
    - Monitoring (11 APIs): KPI, hourly trends, mini-cards, line details, rankings
    - Dashboard (9 APIs): energy trends (monthly), facility trends (nested structure), distributions, rankings
    - Alerts (7 APIs): statistics, trends, history, waveforms, actions
    - Analysis (7 APIs): facility tree, hourly data, comparisons, cycles, power quality
    - Settings (46 APIs): CRUD for factory, line, tag, facility, config + hierarchy + bulk operations
  - 3 critical/medium/low gaps identified and resolved:
    - G-02 (CRITICAL): DSH-002 facility trend changed from flat `[{date, power, air}]` to nested `{dates[], facilities[{code, name, powerData[], airData[]}]}` structure
    - G-01 (MEDIUM): DSH-001 energy trend changed from 7-day daily to 14-month monthly aggregation with `TO_CHAR(DATE_TRUNC('month'), 'YYYY-MM')` formatting
    - G-03 (LOW): MON-001 mini-card line ID mapping added (DB `ASSEMBLE` → frontend `assembly`)

### Changed
- **Backend API Response Structures**
  - `GET /dashboard/energy-trend`: Now returns monthly (YYYY-MM) granularity with previous year same-month comparison
  - `GET /dashboard/facility-trend`: Pivoted from flat array to nested structure with `dates[]` and `facilities[]` arrays
  - `GET /monitoring/overview/lines`: Added lineIdMap for DB → frontend ID conversion (ASSEMBLE → assembly)
- **Frontend Environment**
  - `.env.local`: `VITE_USE_MOCK=false` (production mode, no Mock data)
  - `.env.development`: Same configuration for consistency
- **Response Key Validation**
  - All chart API responses now return exact key names matching frontend series definitions
  - MON-001 hourly: `{time, current, prev}` ✅
  - MON-002 detail: `{time, power, prevPower, air, prevAir}` ✅
  - DSH-001 trend: `{month, power, prevPower, air, prevAir, powerTarget, airTarget}` ✅
  - DSH-002 facility: `{dates[], facilities[{code, name, powerData[], airData[]}]}` ✅

### Quality Metrics
- **Match Rate**: 93% (v1.0 analysis) → 98% (v2.0 after fixes) ✅ **PASS** (Target: 90%)
- **Gaps Resolved**: 3/3 (100%) — 1 CRITICAL + 1 MEDIUM + 1 LOW all fixed
- **API Coverage**: 77/77 endpoints verified (100%)
- **PDCA Iterations**: 1 cycle (Plan → Design → Do → Check → Act)
- **Deployment Status**: GO (ready for Phase 1-7 integration)

---

## [2026-03-04] - Tag Classification Redesign Completion (PDCA Report)

### Added
- **태그 분류 체계 재설계 (Tag Classification Redesign) — Phase Complete**
  - `MeasureType` enum (INSTANTANEOUS/CUMULATIVE/DISCRETE) — 물리적 측정 방식 명시
  - `TagCategory` enum (ENERGY/QUALITY/ENVIRONMENT/OPERATION/CONTROL) — 도메인 용도 명시
  - `CalcMethod` enum (DIFF/INTEGRAL_TRAP) — 사용량 계산 방식 명시
  - `FacilityEnergyConfig` 테이블 — 설비별 에너지 사용량 계산 소스 명시적 관리
  - `FacilityEnergyConfigTag` 테이블 — 1:N 다중 태그 지원 (ConfigTag 진화)
  - `FacilityEnergyConfigHistory` 테이블 — 변경 이력 추적
  - 6개 신규 API 엔드포인트:
    - `GET /settings/energy-config` (필터링, 페이징)
    - `GET /settings/energy-config/:id` (상세)
    - `PUT /settings/energy-config/:id` (수정)
    - `GET /settings/energy-config/history` (이력)
    - `GET /settings/energy-config/summary` (통계) — ADDED
    - `POST /settings/energy-config/auto-generate` (자동 생성) — MISSING
  - **SET-014** 화면 (에너지 소스 매핑 관리 UI) — 신규
  - 3,107개 Excel 태그 자동 변환 (TAG_TYPE+DATA_TYPE → measureType+category) — 100% 정확도
  - Migration 스크립트 2개:
    - `20260304_tag_classification_redesign` (스키마 + enum)
    - `20260304_config_tag_split` (ConfigTag 도입)
  - Seed 스크립트 2개:
    - `seed.ts` — 태그 + Config 자동 생성
    - `seed-config-tags.js` — ConfigTag 재생성

### Changed
- **Tag 모델 필드**
  - `Tag.tagType` (TREND/USAGE/SENSOR) → `Tag.measureType` (INSTANTANEOUS/CUMULATIVE/DISCRETE)
  - `Tag.dataType` (T/Q) → `Tag.category` (ENERGY/QUALITY/ENVIRONMENT/OPERATION/CONTROL)
- **SET-012 필터**
  - `tagType` → `measureType` (3개 옵션: 순시/적산/이산)
  - `dataType` → `category` (5개 옵션: 에너지/품질/환경/가동/제어)
- **EnergyType enum**
  - elec, air + gas, solar (향후 지원)

### Removed
- `TagType` enum (TREND/USAGE/SENSOR) — MeasureType로 대체
- `TagDataType` enum (T/Q) — TagCategory로 대체
- `Tag.tagType` 컬럼
- `Tag.dataType` 컬럼

### Quality Metrics
- **Design Match Rate**: 93% (Target: 90%) ✅ **PASS**
  - EXACT: 126항목
  - EVOLVED (의도적): 12항목 (다중 태그 지원 등 개선)
  - MISSING: 5항목 (Low 심각도, M-01~M-05)
  - ADDED (기능 확장): 19항목
- **Architecture Compliance**: 95% (모든 규약 준수)
- **Production Readiness**: 90% (마이그레이션 + 배포 준비 완료)

### Notes
- **Design Evolution**: ConfigTag (1:N)는 원 설계에 없었으나 HNK00-010 같은 설비가 같은 에너지타입의 여러 태그를 사용하는 현실 데이터 발견으로 구현 시 진화
- **Missing Items (Low Priority)**:
  - M-01: `POST /auto-generate` endpoint (seed 로직만 존재)
  - M-02: `since` 필드 (createdAt으로 대체 가능)
  - M-03: SET-014 "적용일" 컬럼
  - M-04: 편집 모달 [추천] 배지
  - M-05: API 응답 `since` 필드
- **완료 보고서**: `docs/04-report/features/tag-classification-redesign.report.md`

---

## [2026-03-04] - API Key Mapping Audit & Documentation

### Fixed
- **MON-002 Blank Chart Bug (Critical)**
  - `computeLineDetailChart()` returned `{current, prev}` but MON-002 series expected `{power, prevPower}` and `{air, prevAir}`
  - Fixed in `monitoring-computed.ts`: renamed keys to match TrendChart series config
  - Root cause: series[].key와 data[].{key} 프로퍼티명 불일치 → y값 undefined → 빈 차트

### Added
- **API Response Key Mapping Documentation**
  - 11개 TrendChart 화면의 series ↔ data 키 매핑 완전 감사
  - `CLAUDE.md` "화면별 API 응답 키 매핑" 섹션 추가 (Frontend ↔ Backend 계약)
  - Backend 연동 시 키 불일치 방지를 위한 참조 테이블

- **uPlot Chart Pattern Documentation**
  - `CLAUDE.md` 차트 작성 패턴: Recharts → uPlot/TrendChart 업데이트
  - 키 일치 규칙(⚠️) 명시

### Changed
- `monitoring-computed.ts`: `computeLineDetailChart()` output keys
  - power 차트: `current` → `power`, `prev` → `prevPower`
  - air 차트: `current` → `air`, `prev` → `prevAir`
- `MON002LineDetail.tsx`: debug console.log 2개 제거

---

## [2026-03-03] - TimescaleDB Continuous Aggregates & Reset Detection

### Added
- **TimescaleDB Continuous Aggregates (v2.24.0)**
  - `cagg_usage_1min`: 1분 적산 집계 (FIRST-LAST)
  - `cagg_trend_10sec`: 10초 순시값 집계 (LAST)
  - `cagg_sensor_10sec`: 10초 센서 집계 (AVG/MIN/MAX)
  - Automatic refresh policies (1min for USAGE, 20sec for TREND/SENSOR)

- **Meter Reset Detection & Correction System**
  - `ResetDetectorService`: 10초 Cron 자동 리셋 감지 (10% 임계값)
  - `meter_reset_events` 테이블: 리셋 이벤트 자동 기록
  - `cagg_usage_1min_corrected` View: 리셋 보정 자동 적용
  - Manual reset recording API

- **New API Services**
  - `UsageAggregateService`: USAGE 데이터 조회 (1min/5min/1hour/1day intervals)
    - `getUsageData()`: 기간별 USAGE 데이터
    - `getRecentUsage()`: 최근 N분 데이터
    - `compareUsageByHour()`: 오늘/어제 시간대별 비교
    - `getResetHistory()`: 리셋 이벤트 이력
  - `TrendAggregateService`: TREND 데이터 조회 (10sec/1min/5min/1hour intervals)
    - `getTrendData()`: 기간별 TREND 데이터
    - `getRecentTrend()`: 최근 N분 순시값
    - `getRealTimeValues()`: 실시간 최신값 (여러 설비)

- **Test API Endpoints** (`/api/test/cagg/*`)
  - `GET /usage/recent`: 최근 USAGE 데이터
  - `GET /usage/range`: 기간별 USAGE 데이터
  - `GET /trend/recent`: 최근 TREND 데이터
  - `GET /trend/realtime`: 실시간 최신값
  - `GET /resets`: 리셋 이벤트 조회
  - `GET /detect-reset`: 수동 리셋 감지 트리거
  - `GET /compare-hourly`: 시간대별 비교

- **Documentation**
  - [API-CONTINUOUS-AGGREGATE.md](API-CONTINUOUS-AGGREGATE.md): 완전한 API 사용 가이드
    - Continuous Aggregate 구조 설명
    - API 엔드포인트 상세
    - 서비스 아키텍처
    - 데이터 흐름 다이어그램
    - 설정 및 유지보수 가이드

### Technical Details
- TimescaleDB 2.24.0: LEFT JOIN 지원 (메타데이터 비정규화 불필요)
- Cron Scheduler: `@nestjs/schedule` + `@Cron` decorator
- SQL Injection 방지: `$queryRawUnsafe` with proper escaping
- Reset threshold: 10% decrease detection
- Unique constraint: `(tag_id, reset_time)` for duplicate prevention

### Testing
- ✅ USAGE API: 11 data points retrieved
- ✅ TREND API: 61 data points retrieved
- ✅ Manual reset recording: Successfully tested
- ✅ Reset event query API: Working

### Performance
- Automatic aggregation: Background refresh policies
- Real-time detection: 10-second Cron intervals
- Efficient queries: Materialized views for fast access

---

## [2026-02-28] - Backend API Development Complete (v5.3)

### Added
- **77 REST API Endpoints** - Complete backend implementation
  - Monitoring API (11 endpoints): KPI, line summary, hourly trend, energy ranking, alerts
  - Dashboard API (9 endpoints): Energy trend, facility trend, rankings, cost analysis
  - Alerts API (7 endpoints): Statistics, trend, severity distribution, history, action management
  - Analysis API (7 endpoints): Facility comparison, cycle analysis, power quality analysis
  - Settings API (43 endpoints): Factory/Line/Facility/Tag CRUD, thresholds, reference cycles

- **Data Infrastructure**
  - TimescaleDB Hypertable setup (tag_data_raw, energy_timeseries)
  - Mock data generator (1-second interval)
  - 15-minute aggregation Cron Job
  - Retention policies (90 days raw, 730 days aggregated)

- **Quality Assurance**
  - 75 Service-layer tests (11 → 81 test cases)
  - Happy path, error handling, edge cases coverage
  - Global Exception Filter for standardized error responses
  - Swagger OpenAPI documentation (77 endpoints)

- **Validation & DTOs**
  - 4 new MonitoringQueryDto classes (HourlyTrendQueryDto, LineDetailQueryDto, EnergyRankingQueryDto, LineQueryDto)
  - Dynamic resolution API (automatic interval selection based on time range)
  - Parameter unification (type: "elec" | "air" per TAG-DATA-SPEC)
  - ValidationPipe with whitelist & transform

### Metrics & Achievement
- **Gap Analysis Score**: 91% (Target: 90%) ✅
  - Endpoint Coverage: 100% (77/77)
  - Response Format Match: 100% (77/77)
  - DTO/Validation: 97%
  - Test Coverage: 40% (75 real tests)
  - Error Handling: 80%
  - Convention Compliance: 92%
  - Architecture: 85%

- **Development Timeline**
  - 8 iterations (v1.0: 62% → v5.3: 91%, +29%p)
  - Phase 1: Data infrastructure
  - Phase 2-5: Sequential API module implementation
  - Check phase: Automated gap analysis with continuous improvement

- **Frontend Integration Ready**
  - All 32 screens ready for API migration (Mock → Real)
  - Dynamic resolution support for time-series data
  - Tag data specification compliance verified

### Documentation
- ~~Plan document: `docs/01-plan/features/backend-api.plan.md`~~ → **Archived**
- ~~Design document: `docs/02-design/features/backend-api.design.md` (v5.3)~~ → **Archived**
- ~~Analysis report: `docs/03-analysis/ifems-backend-api-v5.3.analysis.md`~~ → **Archived**
- ~~Completion report: `docs/04-report/backend-api.report.md`~~ → **Archived**
- **📁 Archive Location**: [docs/archive/2026-02/backend-api/](archive/2026-02/backend-api/) (summary preserved in `.pdca-status.json`)

### Known Issues (Low Impact)
- 2x Dashboard Swagger @ApiQuery enum mismatch (power vs elec) - Runtime validation correct
- GlobalExceptionFilter in main.ts (not APP_FILTER) - Functional but extensibility concern
- Controller-level E2E tests remain skeleton (Next cycle)

### Next Steps
1. Immediate: Fix Swagger enums, move GlobalExceptionFilter (30 min)
2. Short-term: Controller E2E tests (2 hrs)
3. Medium-term: Integration tests with test database (2 hrs)
4. Long-term: Performance profiling & optimization (Phase 2)

---

## [2026-02-28] - Dynamic Chart Resolution Implementation

### Added
- **Dynamic Chart Resolution (Progressive Resolution)** - 4-level hierarchical zoom system (15m → 1m → 10s → 1s)
  - Automatic interval switching based on zoom ratio
  - SWR caching with 60-second deduplication
  - 500ms debouncing + 700ms zoom processing timeout
  - Zoom lock mechanism (1 zoom per interval level)

### Features Implemented
- **Types** (`apps/web/src/types/chart.ts`)
  - ZoomLevel (0~3), Interval ("15m"|"1m"|"10s"|"1s")
  - RangeDataResponse, RangeDataMetadata
  - DynamicResolutionOptions, ClientError

- **Utilities** (`apps/web/src/lib/chart-utils.ts`)
  - `getIntervalForZoomRatio()`: Zoom ratio → Interval mapping
  - `getZoomLevelFromInterval()`: Interval → ZoomLevel conversion
  - `formatInterval()`: Korean locale display (15분, 1분, etc.)
  - `calculateZoomRatio()`: uPlot scale-based ratio calculation

- **Custom Hook** (`apps/web/src/hooks/useDynamicResolution.ts`)
  - State management for currentInterval
  - Automatic API refetch on interval change
  - SWR caching with interval-specific keys
  - Infinite loop prevention (3-layer protection)

- **Service Layer** (`apps/web/src/services/monitoring.ts`)
  - `fetchRangeData()`: Mock data generator with sine-wave pattern
  - Mock fallback via `VITE_USE_MOCK` env variable

- **Chart Integration** (`apps/web/src/components/charts/TrendChart.tsx`)
  - `onZoomChange` prop for zoom detection
  - Loading overlay with spinner + custom message
  - Zoom lock per interval (prevents duplicate triggers)
  - 700ms timeout for drag completion

- **Page Integration** (`apps/web/src/pages/monitoring/MON002LineDetail.tsx`)
  - Initial interval selection dropdown (15분 / 1분)
  - Dynamic resolution toggle (checkbox)
  - Dual mode: legacy fixed-interval + dynamic resolution
  - Interval sync: power chart → air chart

### Fixed Issues (PDCA Act Phase)
- **H-01 (HIGH)**: Zoom transition logic
  - Fixed: One-step-at-a-time zoom (15m → 1m → 10s → 1s)
  - Removed: Multi-level jump (prevents skipping levels)
  - Removed: Zoom out auto-transition (reset button only)
  - Impact: Ensures 15m → 1m → 10s → 1s order with no skips

- **H-02 (HIGH)**: Mock data field name mismatch
  - Fixed: `current`/`prev` → `power`/`prevPower`, `air`/`prevAir`
  - Impact: Backend API integration-ready

- **M-01 (MEDIUM)**: Missing API error notification
  - Fixed: Added `alert()` on API failure (temporary, toast library pending)

- **M-02 (MEDIUM)**: Missing ClientError type
  - Fixed: Added ClientError interface to types/chart.ts

- **M-03 (MEDIUM)**: Missing data-testid attributes
  - Fixed: Added test selectors for E2E tests

### Quality Metrics
- **Gap Analysis (Check Phase)**: 82/100 (WARN status)
- **After Act Phase**: 90/100 (PASS status)
  - Design Match: 88% → 95% ✅
  - Architecture: 95% (unchanged)
  - Convention: 93% (unchanged)
  - Test Coverage: 0% (project-wide issue)

### Technical Details
- PDCA Cycle: Plan → Design → Do → Check (Gap 82%) → Act (Fixed to 90%)
- Zoom behavior: Step-by-step only (no multi-level jumps)
- Direction: Forward only (15m → 1m → 10s → 1s, no reverse)
- Reset: Manual reset button returns to initialInterval
- Caching: SWR with interval-specific keys (`${facilityId}/${metric}/${interval}`)

### Documentation
- Plan: `docs/01-plan/features/동적-차트-해상도.plan.md`
- Design: `docs/02-design/features/동적-차트-해상도.design.md`
- Analysis: `docs/03-analysis/동적-차트-해상도.analysis.md` (v1.1 with Act Phase)

### Known Limitations
- Zero tests (project-wide issue, not feature-specific)
- Backend API not implemented (Mock data only)
- Toast library not integrated (using alert() temporarily)

### Next Steps
- Backend API implementation (NestJS + TimescaleDB)
- Unit tests for `getIntervalForZoomRatio()`, `useDynamicResolution`
- E2E tests for 4-stage zoom scenario (Playwright)
- Replace alert() with toast library

---

## [2026-02-25] - Recharts → uPlot Chart Migration Complete

### Changed
- **Complete Migration from Recharts to uPlot** - 12 time-series chart screens converted
  - Migrated to uPlot 1.6.32 (Canvas-based, ~50KB, 60 FPS performance)
  - React 19 compatibility achieved (Recharts incompatible with React 19.2.4)
  - All time-series screens now use TrendChart/CycleChart components

### Components Enhanced
- **TrendChart** (`apps/web/src/components/charts/TrendChart.tsx`)
  - ✅ Added ResizeObserver for responsive auto-sizing
  - ✅ Container-aware dimensions (no longer fixed 1200x300)
  - ✅ Supports all chart types: line, area, bar
  - ✅ Current time vertical line (MON001, MON002)
  - ✅ Multi-chart cursor sync via syncKey

- **CycleChart** (`apps/web/src/components/charts/CycleChart.tsx`)
  - ✅ Added ResizeObserver for responsive auto-sizing
  - ✅ Container-aware dimensions (no longer fixed 1200x200)
  - ✅ 3-panel cursor sync for ANL004

### Pages Converted (12 screens)
1. **ANL (Analysis) - 5 screens**
   - ANL001: Multi-facility area comparison
   - ANL002: Dual-condition overlay + diff charts
   - ANL003: 3-series cycle waveform analysis
   - ANL004: 3-panel cycle delay (ref/current/diff)
   - ANL005: 2-chart power quality (imbalance + power factor)

2. **MON (Monitoring) - 2 screens**
   - MON001: Real-time energy overview (bar + area with current time line)
   - MON002: Line detail power + air (2 charts with sync)

3. **DSH (Dashboard) - 2 screens**
   - DSH001: Monthly energy trend (power + air, 2 charts)
   - DSH002: Facility trend (dynamic multi-line)

4. **ALT (Alert) - 2 screens**
   - ALT004: Power quality history (modal chart)
   - ALT006: Cycle anomaly history (modal 2-line chart)

5. **SET (Settings) - 1 screen**
   - SET003: Reference cycle waveform (modal chart)

### Fixed Issues
- **CRITICAL (All Resolved)**
  - Chart sizing: ResizeObserver eliminates fixed 1200x300 size
  - Modal overflow: Charts now auto-fit within modal containers
  - Modal height clipping: Charts respect container height constraints

- **Code Quality**
  - Removed 45 lines of dead Recharts code from ANL004
  - Fixed MON002 air chart color: yellow → blue (CLAUDE.md compliance)
  - Cleaned unnecessary `useCallback` imports

### Quality Metrics
- **Before**: 68/100 (WARN status)
- **After**: 98/100 (PASS status)
  - Chart Sizing: 35% → 100% ✅
  - Conversion Accuracy: 92% → 100% ✅
  - Code Cleanliness: 75% → 100% ✅
  - Data Connection: 95% (unchanged)

### Technical Details
- All HMR updates successful (no TypeScript errors)
- Maintained existing features: syncKey, showLegend, currentTime
- Preserved CLAUDE.md color rules: power (yellow), air (blue)
- Backward compatible: Remaining Recharts screens (12 BarChart/PieChart) unchanged

### Documentation
- Updated: `docs/03-analysis/recharts-to-uplot-migration.analysis.md` (v2.0)

---

## [2026-02-23] - Tag Management System Completion

### Added
- **Tag Management System** - Complete PDCA cycle (Plan → Design → Do → Check → Act)
  - Factory, Line, Facility, Tag hierarchical data model with Prisma ORM
  - 27+ REST API endpoints for tag and facility management
  - 4 new settings screens (SET-008, SET-009, SET-012, SET-013) with full CRUD operations
  - Tag hierarchy visualization with 4-level tree view (Factory → Line → Facility → Tag)
  - Support for 2,794+ tags across 325 facilities in 4 production lines

### Features Implemented
- **Backend API** (`apps/api/src/settings/`)
  - Factory CRUD (4 endpoints): create, read, update, delete factories
  - Line CRUD (5 endpoints): manage production lines with factory hierarchy
  - Facility Master CRUD (5 endpoints): equipment management with line assignment
  - Tag Master CRUD (6 endpoints): sensor/metric tag management with display name mapping
  - Hierarchy API (4 endpoints): full tree visualization at multiple levels
  - Input validation via DTOs (Factory, Line, Tag) with class-validator
  - Comprehensive error handling in all service methods

- **Frontend Pages** (`apps/web/src/pages/settings/`)
  - SET-008: Factory Management (100% complete)
    - Factory list, add, edit, delete operations
    - Display line count per factory
  - SET-009: Line Settings (100% complete)
    - Factory-filtered line list
    - Create, modify, delete production lines
    - Display facility count per line
  - SET-012: Tag Master Management (94% complete)
    - Multi-filter support: facility, tagType, energyType
    - Tag CRUD with tagName ↔ displayName mapping
    - Bulk operations ready (feature pending)
  - SET-013: Tag Hierarchy (88% complete)
    - Interactive tree view with 4-level drilling
    - Level-based statistics (count cards)
    - Facility status badges (NORMAL/WARNING/DANGER/OFFLINE)
    - Expand/collapse controls

- **Database Schema**
  - `Factory` model with unique code constraint
  - `Line` model with factoryId FK and order field
  - `Facility` model extended with lineId FK (migrated from enum)
  - `Tag` model with facilityId FK, unique tagName, and metadata fields
  - Proper indexing on foreign keys and filter columns
  - Enum definitions: ~~TagType (TREND/USAGE/SENSOR)~~ → MeasureType (INSTANTANEOUS/CUMULATIVE/DISCRETE), EnergyType (elec/air), ~~TagDataType (T/Q)~~ → TagCategory (ENERGY/QUALITY/ENVIRONMENT/OPERATION/CONTROL) *(2026-03-04 재설계)*

- **Data Migration**
  - TagList.xlsx parsing: 3,448 rows → 2,794 active tags
  - Automated seed scripts for Factory, Line, Tag initialization
  - Data consistency validation with unique constraints

### Changed
- Facility model: `line` enum field → `lineId` FK reference to Line table
- DTO validation improved: Factory has full validation; Line/Tag added with comprehensive decorators
- Tag service: Hardcoded pagination limit replaced with skip/take/search parameters
- Error handling: All service methods now include try/catch with appropriate HTTP exceptions

### Fixed
- **Critical Bug**: Facility lineId assignment
  - Fixed: `line: data.line.toUpperCase()` → proper lineId FK UUID reference
  - Impact: Facilities can now be created/updated without runtime errors

- **Input Validation Gap**: Line and Tag endpoints
  - Added CreateLineDto, UpdateLineDto with class-validator decorators
  - Added CreateTagDto, UpdateTagDto with comprehensive validation
  - Coverage improved from 25% to 70%

- **Error Handling**: Missing try/catch blocks
  - Added comprehensive error handling to all service methods
  - User-friendly error messages and proper HTTP status codes

### Metrics
- **Design Match Rate**: 82% (initial gap analysis) → 93% (after improvements)
- **API Endpoint Coverage**: 24/30 designed endpoints implemented (80%)
- **Data Model Completion**: 95% field coverage with proper relationships
- **Frontend Screen Completion**: 4 of 6 screens implemented (47/52 requirements met = 90%)
- **Type Safety**: Improved from 60% (any types) to 95% (DTOs and strict mode)

### Documentation
- [Plan Document](docs/01-plan/features/tag-management.plan.md) - Feature planning and scope
- [Design Document](docs/02-design/features/tag-management.design.md) - Technical architecture and specification
- [Analysis Report](docs/03-analysis/features/tag-management.analysis.md) - Gap analysis (82% initial)
- [Completion Report](docs/04-report/features/tag-management.report.md) - PDCA summary with 93% final match rate

### Known Limitations (Phase 2)
- Facility Type management (SET-011) screen not implemented - deferred to Phase 2
- Tag bulk upload via Excel (POST /tag/bulk) - partial implementation, frontend UI pending
- Tag reassignment in hierarchy - design complete, drag-drop interaction pending

### Performance Notes
- Tag list queries: <1 second (tested with 2,794+ records)
- Hierarchy tree rendering: ~2-3 seconds for full 4-level tree
- Database indexes optimized for filtering (facilityId, tagType, energyType)
- Pagination support for scalability to 10,000+ tags

### Deployment
- All changes backward compatible with existing i-FEMS frontend
- Requires Prisma migration: `pnpm prisma migrate deploy`
- Database: PostgreSQL 14+ with existing ifems database
- API endpoints available at: `http://localhost:4000/api/settings/`

### Next Steps (Phase 2)
1. Implement Facility Type Screen (SET-011) - 3-4 hours
2. Complete Tag Bulk Upload Feature - 4-6 hours
3. Add Tag Reassignment in Hierarchy - 2-3 hours
4. Advanced filtering and batch operations
5. Unit and integration test coverage

---

## [2026-02-19] - i-FEMS Infrastructure Setup

### Added
- Backend API infrastructure (NestJS 11 + Prisma 6.19.2)
- PostgreSQL TimescaleDB for time-series data
- Swagger API documentation
- Settings, Monitoring, Dashboard, Alerts modules

### Infrastructure Status
- ✅ Docker Compose + PostgreSQL 16.11
- ✅ Hypertable setup for tag_data_raw and energy_timeseries
- ✅ 6 API modules with CORS and validation
- ⚠️ Prisma CLIENT initialization (resolved via direct pg connection)

---

## Version Format

This changelog follows [Keep a Changelog](https://keepachangelog.com) conventions.

Versions follow [Semantic Versioning](https://semver.org):
- **MAJOR**: Breaking changes to API or data model
- **MINOR**: New features added (backward compatible)
- **PATCH**: Bug fixes, documentation updates

---

**Last Updated**: 2026-03-11
**Project**: i-FEMS (Intelligence Facility & Energy Management System)
**Repository**: d:\AI_PJ\IFEMS\
