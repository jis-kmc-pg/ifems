# Backend API 구현 계획서 (Plan)

> i-FEMS Backend API Implementation Plan
> Feature: backend-api
> 작성일: 2026-02-25
> 담당: Claude Code

---

## 1. 기능 개요 (Feature Overview)

### 목적 (Purpose)
i-FEMS 프론트엔드 32화면에 대응하는 NestJS 기반 REST API 구현. 실시간 에너지 데이터 수집, TimescaleDB 기반 시계열 데이터 저장, 통계 분석 API 제공.

### 배경 (Background)
- **Frontend 완료**: 32화면 + Login (100% 완료)
- **Backend 현황**:
  - ✅ Infrastructure (NestJS 11, Prisma 6.19.2, PostgreSQL + TimescaleDB)
  - ✅ Tag Management System (Factory, Line, Facility, Tag CRUD - 27 endpoints)
  - ❌ 4개 도메인 API (Monitoring, Dashboard, Alerts, Analysis) - Mock 데이터만 존재
  - ❌ 시계열 데이터 수집/저장 로직
  - ❌ 실시간 데이터 조회 API

### 우선순위 (Priority)
**P0 (Critical)**: Frontend가 완료되었으므로 Backend API 구현이 최우선 과제

---

## 2. 범위 (Scope)

### 포함 (In Scope)

#### 2.1 도메인 API (4개 모듈)

**A. Monitoring API** (실시간 모니터링 - MON-001~006)
- [ ] GET `/api/monitoring/overview` - 종합 현황 (KPI 카드 4개 + 라인별 요약)
- [ ] GET `/api/monitoring/line/:lineCode` - 라인별 상세 현황 (시계열 차트)
- [ ] GET `/api/monitoring/energy/ranking` - 에너지 사용 순위 (설비별 TOP 10)
- [ ] GET `/api/monitoring/energy/alerts` - 에너지 알림 현황 (실시간)
- [ ] GET `/api/monitoring/power-quality/ranking` - 전력 품질 순위 (불평형률, 역률)
- [ ] GET `/api/monitoring/air-leak/ranking` - 에어 누기 순위 (누기량, 압력)

**B. Dashboard API** (통계 대시보드 - DSH-001~008)
- [ ] GET `/api/dashboard/energy/trend` - 월별 에너지 추세 (전력, 에어)
- [ ] GET `/api/dashboard/facility/trend` - 설비별 추세 (다중 선택 설비)
- [ ] GET `/api/dashboard/line/comparison` - 라인 비교 (블록/헤드/크랭크/조립)
- [ ] GET `/api/dashboard/peak-demand` - 피크 수요 현황 (시간대별 피크)
- [ ] GET `/api/dashboard/energy-cost` - 에너지 비용 분석 (계산식 적용)
- [ ] GET `/api/dashboard/efficiency` - 에너지 효율 지표 (kWh/생산량)
- [ ] GET `/api/dashboard/baseline` - 기준선 비교 (목표 vs 실제)
- [ ] GET `/api/dashboard/summary` - 대시보드 요약 (KPI 집계)

**C. Alerts API** (알림 관리 - ALT-001~006)
- [ ] GET `/api/alerts/statistics` - 알림 통계 (막대 + 파이 차트)
- [ ] GET `/api/alerts/trend` - 알림 추세 (시계열 통계)
- [ ] GET `/api/alerts/severity` - 심각도별 알림 (Normal/Warning/Danger 분포)
- [ ] GET `/api/alerts/power-quality/history` - 전력 품질 알림 이력 (테이블 + 상세)
- [ ] GET `/api/alerts/air-leak/history` - 에어 누기 알림 이력
- [ ] GET `/api/alerts/cycle/history` - 싸이클 이상 알림 이력
- [ ] POST `/api/alerts/:id/action` - 조치사항 저장 (모달에서 입력)
- [ ] PUT `/api/alerts/:id/acknowledge` - 알림 확인 처리

**D. Analysis API** (분석 - ANL-001~005)
- [ ] GET `/api/analysis/comparison` - 설비 비교 분석 (다중 설비 오버레이)
- [ ] GET `/api/analysis/detailed-comparison` - 상세 비교 (조건1 vs 조건2)
- [ ] GET `/api/analysis/cycle` - 싸이클 분석 (파형 3개 오버레이)
- [ ] GET `/api/analysis/cycle-delay` - 싸이클 지연 분석 (기준/비교/차이 3패널)
- [ ] GET `/api/analysis/power-quality` - 전력 품질 분석 (불평형률, 역률 이중 Y축)

#### 2.2 시계열 데이터 수집/저장

**E. Data Collection System**
- [ ] `TagDataCollector` Service - 1초 단위 태그 데이터 수집 (PLC/SCADA 연동 준비)
- [ ] `EnergyAggregator` Service - 15분 단위 집계 (avg, sum, min, max, count)
- [ ] `TimescaleHypertable` Setup - tag_data_raw, energy_timeseries 하이퍼테이블 생성
- [ ] Retention Policy - 원본 데이터 3개월, 집계 데이터 2년 보관

#### 2.3 공통 기능

**F. Common Features**
- [ ] DTO Validation - class-validator 기반 입력 검증 (모든 endpoint)
- [ ] Error Handling - GlobalExceptionFilter (표준화된 에러 응답)
- [ ] Logging - Winston Logger (파일 + Console)
- [ ] Swagger Documentation - @ApiTags, @ApiOperation 완전 문서화
- [ ] CORS Configuration - Frontend 허용 (localhost:3200)
- [ ] Health Check - `/api/health` (DB 연결, TimescaleDB 상태 체크)

### 제외 (Out of Scope)
- ❌ 인증/인가 시스템 (Phase 2로 연기 - 현재 Mock 인증 사용)
- ❌ WebSocket 실시간 푸시 (Phase 2)
- ❌ 실제 PLC/SCADA 연동 (현재는 Mock 데이터 생성기 사용)
- ❌ Excel/Image Export API (프론트엔드에서 처리)
- ❌ 모바일 최적화 API (Desktop 우선)

---

## 3. 요구사항 (Requirements)

### 3.1 기능 요구사항 (Functional Requirements)

| ID | 요구사항 | 우선순위 | 비고 |
|----|----------|----------|------|
| FR-01 | Monitoring API 6개 endpoint 구현 | P0 | MON-001~006 화면 대응 |
| FR-02 | Dashboard API 8개 endpoint 구현 | P0 | DSH-001~008 화면 대응 |
| FR-03 | Alerts API 8개 endpoint 구현 | P1 | ALT-001~006 화면 대응 |
| FR-04 | Analysis API 5개 endpoint 구현 | P1 | ANL-001~005 화면 대응 |
| FR-05 | TimescaleDB Hypertable 설정 | P0 | 성능 필수 |
| FR-06 | 1초 단위 태그 데이터 수집 | P0 | Mock 데이터 생성기 |
| FR-07 | 15분 단위 자동 집계 | P0 | Cron Job |
| FR-08 | Swagger 완전 문서화 | P1 | API 스펙 공유 |
| FR-09 | Global Error Handling | P0 | 안정성 |
| FR-10 | Health Check API | P1 | 모니터링 |

### 3.2 비기능 요구사항 (Non-Functional Requirements)

| ID | 요구사항 | 목표 | 측정 방법 |
|----|----------|------|-----------|
| NFR-01 | API 응답 시간 | < 500ms (95%ile) | `/api/monitoring/*` 기준 |
| NFR-02 | 시계열 쿼리 성능 | < 1s (1주일 데이터) | TimescaleDB 인덱스 활용 |
| NFR-03 | 데이터 수집 주기 | 1초 (실시간) | Mock 데이터 생성기 |
| NFR-04 | 집계 정확도 | 100% (오차 없음) | sum, avg 검증 |
| NFR-05 | 동시 요청 처리 | 100 req/s | Artillery 부하 테스트 |
| NFR-06 | 데이터 보관 기간 | Raw 3개월, Agg 2년 | Retention Policy |
| NFR-07 | API 문서화 완성도 | 100% | Swagger UI 검증 |
| NFR-08 | 에러 복구 시간 | < 30초 | Auto Restart |

---

## 4. 기술 스택 (Technology Stack)

### 4.1 Backend Framework
- **NestJS 11.0.1**: Enterprise-grade Node.js framework
- **TypeScript 5.7.3**: 타입 안전성
- **Class Validator 0.14.3**: DTO 검증
- **Class Transformer 0.5.1**: 데이터 변환

### 4.2 Database
- **PostgreSQL 16.11**: RDBMS
- **TimescaleDB 2.x**: 시계열 데이터 확장
- **Prisma 6.19.2**: ORM (Schema First)

### 4.3 API Documentation
- **Swagger (OpenAPI 3.0)**: `@nestjs/swagger 11.2.6`
- **API Route**: `/api/docs` (Swagger UI)

### 4.4 Logging & Monitoring
- **Winston**: 구조화된 로깅
- **Nest Logger**: 기본 로거 (개발 환경)

### 4.5 Testing
- **Jest 30.0.0**: Unit + Integration Test
- **Supertest 7.0.0**: E2E API Test

---

## 5. 데이터 모델 (Data Model)

### 5.1 기존 Schema (Prisma)

```prisma
// 계층 구조
Factory (공장)
  └─ Line (라인: BLOCK, HEAD, CRANK, ASSEMBLE)
      └─ Facility (설비: HNK10-020)
          └─ Tag (태그: HNK10_020_POWER_1)

// 시계열 데이터
TagDataRaw (1초 단위 원본 데이터)
EnergyTimeseries (15분 단위 집계 데이터)
```

### 5.2 추가 필요 모델 (Design 단계에서 상세 설계)

```prisma
// 알림 시스템
model Alert {
  id           String       @id @default(uuid())
  facilityId   String
  severity     String       // NORMAL, WARNING, DANGER
  type         String       // POWER_QUALITY, AIR_LEAK, CYCLE_ANOMALY
  message      String
  value        Float?
  threshold    Float?
  actionTaken  String?      // 조치사항
  acknowledgedAt DateTime?
  createdAt    DateTime     @default(now())
}

// 싸이클 데이터 (ANL-003, ANL-004)
model CycleData {
  id          String   @id @default(uuid())
  facilityId  String
  cycleNumber Int
  timestamp   DateTime
  waveform    Json     // [{sec: 0.0, power: 12.5}, ...]
  duration    Float    // 초
  peakPower   Float
  status      String   // NORMAL, DELAYED, ANOMALY
}

// 기준 싸이클 (SET-003)
model ReferenceCycle {
  id          String   @id @default(uuid())
  facilityId  String
  waveform    Json
  createdAt   DateTime @default(now())
  updatedBy   String?
}
```

---

## 6. API 엔드포인트 설계 (Endpoint Design)

### 6.1 Monitoring API

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/monitoring/overview` | 종합 현황 | `{ kpi: {...}, lines: [...], chart: [...], alerts: [...] }` |
| GET | `/api/monitoring/line/:lineCode` | 라인 상세 | `{ line: {...}, powerChart: [...], airChart: [...], facilities: [...] }` |
| GET | `/api/monitoring/energy/ranking` | 에너지 순위 | `[{ facility, powerKwh, airL, rank }]` |
| GET | `/api/monitoring/energy/alerts` | 알림 현황 | `[{ id, facility, severity, message, createdAt }]` |
| GET | `/api/monitoring/power-quality/ranking` | 전력 품질 순위 | `[{ facility, imbalance, powerFactor, rank }]` |
| GET | `/api/monitoring/air-leak/ranking` | 에어 누기 순위 | `[{ facility, leakRate, pressure, rank }]` |

**공통 Query Parameters:**
- `startTime`: ISO 8601 (기본: 현재시각 - 24h)
- `endTime`: ISO 8601 (기본: 현재시각)
- `interval`: `1m` | `5m` | `15m` | `1h` (기본: `15m`)

### 6.2 Dashboard API

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/dashboard/energy/trend` | 월별 추세 | `{ months: [...], power: [...], air: [...] }` |
| GET | `/api/dashboard/facility/trend` | 설비 추세 | `{ timestamps: [...], series: [{facility, data: [...]}] }` |
| GET | `/api/dashboard/line/comparison` | 라인 비교 | `{ lines: [...], powerByLine: {...}, airByLine: {...} }` |
| GET | `/api/dashboard/peak-demand` | 피크 수요 | `{ hours: [...], peak: [...], avg: [...] }` |
| GET | `/api/dashboard/energy-cost` | 에너지 비용 | `{ total, breakdown: [...] }` |
| GET | `/api/dashboard/efficiency` | 효율 지표 | `{ kwhPerUnit: ..., trend: [...] }` |
| GET | `/api/dashboard/baseline` | 기준선 비교 | `{ target: ..., actual: ..., variance: ... }` |
| GET | `/api/dashboard/summary` | 요약 | `{ totalPower, totalAir, alerts, efficiency }` |

### 6.3 Alerts API

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/alerts/statistics` | 통계 | `{ byType: {...}, bySeverity: {...}, byLine: {...} }` |
| GET | `/api/alerts/trend` | 추세 | `{ dates: [...], counts: [...] }` |
| GET | `/api/alerts/severity` | 심각도별 | `{ normal: ..., warning: ..., danger: ... }` |
| GET | `/api/alerts/power-quality/history` | 전력 품질 이력 | `[{ id, facility, imbalance, timestamp, actionTaken }]` |
| GET | `/api/alerts/air-leak/history` | 에어 누기 이력 | `[{ id, facility, leakRate, timestamp, actionTaken }]` |
| GET | `/api/alerts/cycle/history` | 싸이클 이상 이력 | `[{ id, facility, cycleNumber, delay, timestamp }]` |
| POST | `/api/alerts/:id/action` | 조치사항 저장 | `{ success: true, alert: {...} }` |
| PUT | `/api/alerts/:id/acknowledge` | 확인 처리 | `{ success: true, acknowledgedAt: ... }` |

### 6.4 Analysis API

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/analysis/comparison` | 설비 비교 | `{ timestamps: [...], series: [{facility, power: [...]}] }` |
| GET | `/api/analysis/detailed-comparison` | 상세 비교 | `{ origin: {...}, compare: {...}, diff: [...] }` |
| GET | `/api/analysis/cycle` | 싸이클 분석 | `{ ref: [...], cycle1: [...], cycle2: [...] }` |
| GET | `/api/analysis/cycle-delay` | 싸이클 지연 | `{ ref: [...], current: [...], diff: [...] }` |
| GET | `/api/analysis/power-quality` | 전력 품질 분석 | `{ imbalance: [...], powerFactor: [...] }` |

**Query Parameters (Analysis):**
- `facilityIds`: 쉼표 구분 UUID 목록 (예: `abc,def,ghi`)
- `startTime`, `endTime`: ISO 8601
- `cycleNumbers`: 싸이클 번호 목록 (예: `1,2,3`)

---

## 7. 구현 순서 (Implementation Order)

### Phase 1: 데이터 인프라 (1-2일)
1. **TimescaleDB Hypertable 설정**
   - `tag_data_raw` 하이퍼테이블 생성 (timestamp 기준)
   - `energy_timeseries` 하이퍼테이블 생성
   - Retention Policy 설정 (3개월, 2년)
   - Continuous Aggregate (집계 뷰) 생성

2. **Mock 데이터 생성기**
   - `TagDataGenerator` Service - 1초 단위 랜덤 데이터 생성
   - `EnergyAggregator` Cron Job - 15분 단위 집계
   - Seed Script - 초기 태그 데이터 생성 (1주일치)

### Phase 2: Core API - Monitoring (2-3일)
3. **Monitoring API 구현**
   - `monitoring.service.ts` 비즈니스 로직
   - `monitoring.controller.ts` REST endpoint
   - DTO 정의 및 Validation
   - Swagger Documentation

4. **E2E 테스트**
   - `monitoring.e2e-spec.ts` 작성
   - Frontend 연동 테스트 (CORS 확인)

### Phase 3: Dashboard & Alerts API (2-3일)
5. **Dashboard API 구현**
   - 집계 쿼리 최적화 (TimescaleDB 함수 활용)
   - Swagger Documentation

6. **Alerts API 구현**
   - Alert 모델 추가 (Prisma Migration)
   - 조치사항 저장 로직
   - Swagger Documentation

### Phase 4: Analysis API (2-3일)
7. **Analysis API 구현**
   - 싸이클 데이터 모델 추가
   - 기준 싸이클 CRUD
   - 복잡한 쿼리 최적화

8. **Performance Tuning**
   - Query 성능 측정 (< 500ms 목표)
   - 인덱스 추가
   - 캐싱 전략 (Redis - Optional)

### Phase 5: 통합 테스트 & 문서화 (1-2일)
9. **통합 테스트**
   - 전체 API E2E 테스트
   - Artillery 부하 테스트 (100 req/s)
   - Frontend 완전 연동 테스트

10. **최종 문서화**
    - Swagger 100% 완성
    - README.md 업데이트 (API 사용 가이드)
    - Postman Collection Export

---

## 8. 성공 기준 (Success Criteria)

### 필수 조건 (Must Have)
- ✅ Monitoring API 6개 endpoint 정상 동작
- ✅ Dashboard API 8개 endpoint 정상 동작
- ✅ Alerts API 8개 endpoint 정상 동작
- ✅ Analysis API 5개 endpoint 정상 동작
- ✅ TimescaleDB Hypertable 설정 완료
- ✅ Mock 데이터 생성기 1초 주기 동작
- ✅ 15분 단위 자동 집계 Cron Job 동작
- ✅ API 응답 시간 < 500ms (95%ile)
- ✅ Swagger 문서화 100% 완료
- ✅ Frontend 32화면 완전 연동 (Mock → API 전환)

### 선택 조건 (Nice to Have)
- 🔲 Redis 캐싱 (응답 시간 < 100ms)
- 🔲 WebSocket 실시간 푸시
- 🔲 실제 PLC/SCADA 연동 준비
- 🔲 API 버저닝 (/api/v1/)
- 🔲 Rate Limiting (100 req/min per IP)

---

## 9. 리스크 & 대응 (Risks & Mitigation)

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| TimescaleDB 성능 이슈 | High | 인덱스 최적화, Continuous Aggregate 활용 |
| 데이터 모델 불일치 | Medium | Frontend와 DTO 스키마 사전 합의 |
| API 응답 지연 | High | 쿼리 최적화, 페이지네이션, 캐싱 |
| Mock 데이터 정확도 | Low | Frontend Mock 데이터 참조하여 일치시킴 |
| Swagger 문서 누락 | Medium | Design 단계에서 API 스펙 먼저 정의 |

---

## 10. 다음 단계 (Next Steps)

1. **Design 문서 작성** (`/pdca design backend-api`)
   - API 상세 스펙 (Request/Response DTO)
   - 데이터베이스 스키마 확장 (Alert, CycleData, ReferenceCycle)
   - TimescaleDB 설정 스크립트
   - 구현 체크리스트

2. **Do Phase 진입** (`/pdca do backend-api`)
   - Phase 1~5 순차 구현
   - Frontend 연동 테스트

3. **Check Phase** (`/pdca analyze backend-api`)
   - Gap Analysis (Design vs Implementation)
   - 성능 테스트 결과 검증

---

## 11. 참고 자료 (References)

- [i-FEMS PLAN.md](../PLAN.md) - 전체 프로젝트 계획
- [CHANGELOG.md](../CHANGELOG.md) - Tag Management System 구현 사례
- [Prisma Schema](../../apps/api/prisma/schema.prisma) - 현재 데이터 모델
- [Frontend Services](../../apps/web/src/services/) - Mock 데이터 구조 참조
- [TimescaleDB Docs](https://docs.timescale.com/) - Hypertable 설정 가이드

---

**작성 완료**: 2026-02-25
**다음 문서**: `backend-api.design.md` (Design Phase)
**담당**: Claude Code
