# i-FEMS Backend API Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: i-FEMS (Intelligence Facility & Energy Management System)
> **Version**: 1.0
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-20
> **Design Doc**: [ifems-backend.plan.md](../01-plan/features/ifems-backend.plan.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

i-FEMS Backend API 구현이 완료 보고되었으므로, 설계 문서(Plan)에 정의된 22개 API 엔드포인트 대비 실제 구현의 완성도를 검증하고, 데이터베이스 연동, 응답 형식, 에러 처리, 타입 안정성을 종합 평가한다.

### 1.2 Analysis Scope

- **Design Document**: `docs/01-plan/features/ifems-backend.plan.md`
- **Implementation Path**: `apps/api/src/`
- **Schema Definition**: `apps/api/prisma/schema.prisma` + `prisma/schema.sql`
- **Analysis Date**: 2026-02-20

---

## 2. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| API Endpoint Match | 52% | CRITICAL |
| Database Integration | 65% | WARNING |
| Response Format | 55% | CRITICAL |
| Error Handling | 72% | WARNING |
| Type Safety | 60% | CRITICAL |
| Architecture Compliance | 80% | WARNING |
| Convention Compliance | 78% | WARNING |
| **Overall** | **62%** | **CRITICAL** |

---

## 3. API Endpoint Gap Analysis

### 3.1 Monitoring Module (Design: 6 endpoints / Implementation: 8 endpoints)

| # | Design Endpoint | Implementation Endpoint | Status | Notes |
|---|----------------|------------------------|--------|-------|
| 1 | GET `/monitoring/overview` | GET `/monitoring/overview/kpi` | CHANGED | 단일 endpoint가 4개로 분할됨 |
| 1b | (포함) | GET `/monitoring/overview/lines` | ADDED | overview에서 분리 |
| 1c | (포함) | GET `/monitoring/overview/hourly` | ADDED | overview에서 분리 |
| 1d | (포함) | GET `/monitoring/overview/alarms` | ADDED | overview에서 분리 |
| 2 | GET `/monitoring/line/detail` | GET `/monitoring/line/:line` | CHANGED | URL 구조 변경 (path param) |
| 3 | GET `/monitoring/energy/ranking` | GET `/monitoring/energy-ranking` | CHANGED | URL 형식 변경 (slash -> dash) |
| 4 | GET `/monitoring/energy/alert` | GET `/monitoring/energy-alert` | CHANGED | URL 형식 변경 |
| 5 | GET `/monitoring/power-quality` | GET `/monitoring/power-quality` | MATCH | |
| 6 | GET `/monitoring/air-leak` | GET `/monitoring/air-leak` | MATCH | |

**평가**: MON-001 overview가 4개 하위 엔드포인트로 분할된 것은 합리적인 결정이지만, URL 네이밍 불일치가 존재 (`energy/ranking` vs `energy-ranking`). 기능적으로 6개 화면 모두 지원 가능.

### 3.2 Dashboard Module (Design: 8 endpoints / Implementation: 9 endpoints)

| # | Design Endpoint | Implementation Endpoint | Status | Notes |
|---|----------------|------------------------|--------|-------|
| 1 | GET `/dashboard/energy/trend` | GET `/dashboard/energy-trend` | CHANGED | URL 형식 변경 |
| 2 | GET `/dashboard/facility/trend` | GET `/dashboard/facility-trend` | CHANGED | URL 형식 변경 |
| 3 | GET `/dashboard/usage/distribution` | GET `/dashboard/usage-distribution` | CHANGED | URL 형식 변경 |
| 4 | GET `/dashboard/process/ranking` | GET `/dashboard/process-ranking` | CHANGED | URL 형식 변경 |
| 5 | GET `/dashboard/cycle/ranking` | GET `/dashboard/cycle-ranking` | CHANGED | URL 형식 변경 |
| 6 | GET `/dashboard/power-quality/ranking` | GET `/dashboard/power-quality-ranking` | CHANGED | URL 형식 변경 |
| 7 | GET `/dashboard/air-leak/ranking` | GET `/dashboard/air-leak-ranking` | CHANGED | URL 형식 변경 |
| 8 | GET `/dashboard/energy/change` | GET `/dashboard/energy-change-top` | CHANGED | URL 및 이름 변경 |
| - | (없음) | GET `/dashboard/facilities` | ADDED | 설비 목록 (추가) |

**평가**: 모든 엔드포인트가 URL 네이밍 규칙 불일치. 설계는 RESTful 계층 구조(`/energy/trend`)를 사용하지만 구현은 flat dash 형식(`/energy-trend`). 기능적으로 8개 화면 모두 지원 가능하며 설비 목록 API가 추가됨.

### 3.3 Alerts Module (Design: 8 endpoints / Implementation: 3 endpoints)

| # | Design Endpoint | Implementation Endpoint | Status | Notes |
|---|----------------|------------------------|--------|-------|
| 1 | GET `/alerts/power-quality/stats` | GET `/alerts/stats/kpi?category=power_quality` | CHANGED | 통합 엔드포인트로 변경 |
| 2 | GET `/alerts/air-leak/stats` | GET `/alerts/stats/kpi?category=air_leak` | CHANGED | category 파라미터로 통합 |
| 3 | GET `/alerts/cycle-anomaly/stats` | GET `/alerts/stats/kpi?category=cycle_anomaly` | CHANGED | category 파라미터로 통합 |
| 4 | GET `/alerts/power-quality/history` | GET `/alerts/history?category=power_quality` | CHANGED | 통합 엔드포인트 |
| 5 | GET `/alerts/air-leak/history` | GET `/alerts/history?category=air_leak` | CHANGED | 통합 엔드포인트 |
| 6 | GET `/alerts/cycle-anomaly/history` | GET `/alerts/history?category=cycle_anomaly` | CHANGED | 통합 엔드포인트 |
| 7 | PUT `/alerts/:id/action` | (없음) | MISSING | 조치사항 저장 미구현 |
| 8 | GET `/alerts/:id/waveform` | (없음) | MISSING | 파형 데이터 미구현 |
| - | (없음) | GET `/alerts/stats/trend?category=` | ADDED | 주간 트렌드 추가 |

**평가**: 6개의 개별 통계/이력 엔드포인트가 3개 통합 엔드포인트(KPI, trend, history)로 변경됨. 이는 기능적으로 수용 가능하나, **조치사항 저장(PUT)과 파형 데이터(GET) 2개 엔드포인트가 완전 누락**되어 ALT-004~006 화면의 조치사항/모달 기능이 동작하지 않음.

### 3.4 Analysis Module (Design: 7 endpoints / Implementation: 3 endpoints)

| # | Design Endpoint | Implementation Endpoint | Status | Notes |
|---|----------------|------------------------|--------|-------|
| 1 | GET `/analysis/facilities/tree` | GET `/analysis/facilities/tree` | MATCH | |
| 2 | GET `/analysis/facility/hourly` | GET `/analysis/facility/hourly` | MATCH | |
| 3 | POST `/analysis/comparison/detailed` | (없음) | MISSING | ANL-002 상세 비교 미구현 |
| 4 | GET `/analysis/cycles` | GET `/analysis/cycles` | MATCH | |
| 5 | GET `/analysis/cycle/waveform` | (없음) | MISSING | ANL-003/004 파형 데이터 미구현 |
| 6 | GET `/analysis/cycle/delay` | (없음) | MISSING | ANL-004 지연 정보 미구현 |
| 7 | GET `/analysis/power-quality` | (없음) | MISSING | ANL-005 전력 품질 분석 미구현 |

**평가**: 7개 중 3개만 구현 (43%). ANL-002(상세 비교), ANL-003/004(파형), ANL-005(전력 품질) 4개 핵심 분석 기능이 누락. 분석 모듈은 가장 구현도가 낮음.

### 3.5 Settings Module (Design: 12 endpoints / Implementation: 3 endpoints)

| # | Design Endpoint | Implementation Endpoint | Status | Notes |
|---|----------------|------------------------|--------|-------|
| 1 | GET `/settings/power-quality` | (없음) | MISSING | SET-001 전력 품질 설정 |
| 2 | PUT `/settings/power-quality` | (없음) | MISSING | SET-001 저장 |
| 3 | GET `/settings/air-leak` | (없음) | MISSING | SET-002 에어 누기 설정 |
| 4 | PUT `/settings/air-leak` | (없음) | MISSING | SET-002 저장 |
| 5 | GET `/settings/reference-cycles` | (없음) | MISSING | SET-003 기준 싸이클 |
| 6 | GET `/settings/reference-cycles/:id/waveform` | (없음) | MISSING | SET-003 파형 |
| 7 | GET `/settings/cycle-alert` | (없음) | MISSING | SET-004 |
| 8 | PUT `/settings/cycle-alert` | (없음) | MISSING | SET-004 저장 |
| 9 | GET `/settings/energy-alert` | (없음) | MISSING | SET-005 |
| 10 | PUT `/settings/energy-alert` | (없음) | MISSING | SET-005 저장 |
| 11 | GET `/settings/cycle-energy-alert` | (없음) | MISSING | SET-006 |
| 12 | PUT `/settings/cycle-energy-alert` | (없음) | MISSING | SET-006 저장 |
| - | (없음) | GET `/settings/general` | ADDED | 하드코딩 일반 설정 |
| - | (없음) | PUT `/settings/general` | ADDED | 일반 설정 저장 |
| - | (없음) | GET `/settings/thresholds` | ADDED | 하드코딩 임계값 |

**평가**: 설계된 12개 엔드포인트 중 0개 구현. 대신 하드코딩된 3개의 일반 엔드포인트만 존재. `FacilitySetting` 테이블이 Prisma 스키마에 정의되지 않아 설비별 설정 CRUD가 불가능. Settings 모듈 구현도 0%.

### 3.6 Tags Module (Design: 11 endpoints / Implementation: 11 endpoints)

| # | Design Endpoint | Implementation Endpoint | Status | Notes |
|---|----------------|------------------------|--------|-------|
| 1 | GET `/tags` | GET `/tags` | MATCH | 페이징 지원 |
| 2 | GET `/tags/:id` | GET `/tags/:id` | MATCH | |
| 3 | POST `/tags` | POST `/tags` | MATCH | DTO 검증 포함 |
| 4 | PUT `/tags/:id` | PUT `/tags/:id` | MATCH | |
| 5 | DELETE `/tags/:id` | DELETE `/tags/:id` | CHANGED | soft delete 대신 hard delete 사용 |
| 6 | POST `/tags/import` | POST `/tags/import/excel` | CHANGED | URL 약간 변경 |
| 7 | GET `/tags/export` | GET `/tags/export/excel` | CHANGED | URL 약간 변경 |
| 8 | GET `/tags/tree` | GET `/tags/tree/all` | CHANGED | URL 약간 변경 |
| 9 | GET `/tags/data/latest` | (없음) | MISSING | 최신 데이터 조회 미구현 |
| 10 | POST `/tags/data/timeseries` | (없음) | MISSING | 시계열 데이터 미구현 |
| 11 | POST `/tags/data/ingest` | POST `/tags/ingest` | CHANGED | URL 변경, 단일+배치 분리 |
| - | (없음) | POST `/tags/ingest/batch` | ADDED | 배치 수집 추가 |
| - | (없음) | GET `/tags/code/:code` | ADDED | 코드 검색 추가 |

**평가**: 기본 CRUD 구현이 충실하나, `tags/data/latest`와 `tags/data/timeseries` 2개 데이터 조회 API가 누락. 이 2개는 모니터링/분석 화면에서 태그 데이터를 직접 조회하는 핵심 기능.

### 3.7 Endpoint Summary

| Module | Design | Implemented | Match | Changed | Missing | Added | Match Rate |
|--------|:------:|:-----------:|:-----:|:-------:|:-------:|:-----:|:----------:|
| Monitoring | 6 | 8 | 2 | 4 | 0 | 2 | 100% (기능) |
| Dashboard | 8 | 9 | 0 | 8 | 0 | 1 | 100% (기능) |
| Alerts | 8 | 3 | 0 | 6 | **2** | 1 | 75% |
| Analysis | 7 | 3 | 3 | 0 | **4** | 0 | 43% |
| Settings | 12 | 3 | 0 | 0 | **12** | 3 | 0% |
| Tags | 11 | 11 | 4 | 5 | **2** | 2 | 82% |
| **Total** | **52** | **37** | **9** | **23** | **20** | **9** | **62%** |

---

## 4. Database Integration Analysis

### 4.1 Schema Design vs Implementation

| Design Entity | Prisma Schema | SQL Schema | Status | Notes |
|--------------|:-------------:|:----------:|--------|-------|
| Facility | O | O | MATCH | 완전 일치 |
| Tag | O | O | MATCH | 계층 구조 포함 |
| TagDataRaw | O | O | MATCH | Hypertable 설정 |
| EnergyTimeseries | O | O | MATCH | Hypertable 설정 |
| Cycle | X | X | MISSING | 싸이클 테이블 미생성 |
| CycleWaveform | X | X | MISSING | 싸이클 파형 미생성 |
| Alert | X | X | MISSING | 알림 테이블 미생성 |
| FacilitySetting | X | X | MISSING | 설정 테이블 미생성 |

**평가**: 설계 문서에 8개 모델이 정의되었으나, 실제 Prisma 스키마에는 4개만 구현 (50%). Cycle, CycleWaveform, Alert, FacilitySetting 4개 테이블이 누락되어 관련 모듈의 DB 연동이 불가능. `schema.prisma` 162행의 주석에 "Cycles, Alerts, Settings 테이블은 Design 단계에서 추가"라고 명시.

### 4.2 Prisma DB Query 실사용 분석

| Module | Service | Prisma 사용 | Raw SQL | 하드코딩 | 실제 DB 연동 |
|--------|---------|:----------:|:-------:|:--------:|:-----------:|
| Monitoring | MonitoringService | O | O | 일부 | O (energyTimeseries) |
| Dashboard | DashboardService | O | O | 일부 | O (energyTimeseries) |
| Alerts | AlertsService | O | O | - | O (energyTimeseries) |
| Analysis | AnalysisService | O | O | - | O (facility, energyTimeseries) |
| Settings | SettingsService | X | X | **전부** | X (100% 하드코딩) |
| Tags | TagsService | O | X | - | O (tag, tagDataRaw) |

**평가**: Settings 모듈은 DB 연동 없이 100% 하드코딩. Monitoring/Dashboard/Alerts는 energyTimeseries 테이블만 사용하며, 전용 Alert 테이블이 없어 energyTimeseries의 status 필드로 대체. Analysis의 cycle 데이터도 energyTimeseries에서 추정값으로 반환.

### 4.3 TODO/하드코딩 목록

| File | Line | 내용 | 영향도 |
|------|------|------|--------|
| `monitoring.service.ts` | 52 | `airEfficiency: 88.7` (하드코딩) | MEDIUM |
| `monitoring.service.ts` | 335 | `threshold = 120.0` (TODO: 설정에서 가져오기) | HIGH |
| `dashboard.service.ts` | 41-42 | `powerTarget: 18000, airTarget: 12000` (하드코딩) | MEDIUM |
| `dashboard.service.ts` | 226-227, 252-253 | `cycleTime`, `efficiency` (Math.random) | CRITICAL |
| `settings.service.ts` | 전체 | 모든 메서드 하드코딩 (TODO 주석) | CRITICAL |

---

## 5. Response Format Analysis

### 5.1 Standard Response Wrapper

설계 문서에 명시된 표준 응답 형식이 없으므로, 실제 구현에서의 패턴을 분석함.

| Module | Success 형식 | Pagination | Error 형식 |
|--------|-------------|:----------:|-----------|
| Monitoring | 직접 data 반환 (래퍼 없음) | X | NestJS 기본 |
| Dashboard | 직접 data 반환 | X | NestJS 기본 |
| Alerts | 직접 data 반환 | X | NestJS 기본 |
| Analysis | 직접 data 반환 | X | NestJS 기본 |
| Settings | 직접 data 반환 | X | NestJS 기본 |
| Tags | `{ data, total, page, limit }` | O | BadRequest/NotFound |

**평가**: Tags 모듈만 페이지네이션 래퍼가 있고, 나머지 5개 모듈은 raw data를 직접 반환. 표준 응답 래퍼 `{ data, meta? }` 또는 `{ error: { code, message } }` 패턴이 적용되지 않음.

### 5.2 Frontend Mock 데이터 구조와의 호환성

Frontend 서비스 레이어(`apps/web/src/services/`)에서 기대하는 응답 구조와 실제 API 응답을 비교해야 하지만, Frontend 서비스는 현재 Mock 데이터를 직접 반환하므로 API 호출 코드가 미작성 상태. `VITE_USE_MOCK=false` 전환 시 서비스 레이어 수정이 필요.

---

## 6. Error Handling Analysis

### 6.1 Module별 에러 처리 패턴

| Module | try-catch | Logger | 사용자 에러 | HTTP Exception |
|--------|:---------:|:------:|:----------:|:--------------:|
| Monitoring | O (모든 메서드) | O (`this.logger.error`) | throw error (raw) | X |
| Dashboard | O (모든 메서드) | O | throw error (raw) | X |
| Alerts | O (모든 메서드) | O | throw error (raw) | X |
| Analysis | O (모든 메서드) | O | throw error (raw) | X |
| Settings | X (하드코딩) | O (log만) | X | X |
| Tags | O (모든 메서드) | O | BadRequest/NotFound | O |

**평가**: Monitoring~Analysis는 try-catch + Logger는 있으나, Prisma 에러를 raw로 throw하여 클라이언트에 DB 에러 메시지가 노출될 수 있음. Tags 모듈만 NestJS Exception 클래스를 적절히 사용. Global Exception Filter가 미적용.

### 6.2 권장 패턴 미적용 목록

- [ ] Global Exception Filter (HttpExceptionFilter)
- [ ] Standard error response format `{ error: { code, message, details? } }`
- [ ] Prisma Error → HTTP Error 매핑 (P2025 -> 404, P2002 -> 409 등)
- [ ] Request/Response 로깅 미들웨어 (morgan 또는 NestJS Interceptor)

---

## 7. Type Safety Analysis

### 7.1 DTO 정의 현황

| Module | Request DTO | Response DTO | class-validator | Status |
|--------|:-----------:|:------------:|:---------------:|--------|
| Monitoring | X | X | X | MISSING |
| Dashboard | X | X | X | MISSING |
| Alerts | X | X | X | MISSING |
| Analysis | X | X | X | MISSING |
| Settings | X (any 사용) | X | X | MISSING |
| Tags | O (5개 DTO) | O | O | COMPLETE |

**평가**: Tags 모듈만 완전한 DTO 체계를 갖추고 있음. 나머지 5개 모듈은 DTO가 전혀 없어 요청 파라미터 검증이 불가능. Settings 모듈의 `saveGeneralSettings(@Body() settings: any)`는 `any` 타입 사용으로 TypeScript strict 규칙 위반.

### 7.2 any 타입 사용

| File | Line(s) | 변수/타입 | 심각도 |
|------|---------|----------|--------|
| `settings.controller.ts` | 18 | `@Body() settings: any` | HIGH |
| `settings.service.ts` | 23 | `settings: any` | HIGH |
| `monitoring.service.ts` | 70, 110, 122, 161 | `$queryRaw<any[]>` | MEDIUM |
| `dashboard.service.ts` | 24, 61, 83, 120, 142, 196, 234, 271, 310, 352 | `$queryRaw<any[]>` | MEDIUM |
| `alerts.service.ts` | 20, 56, 89, 119 | `$queryRaw<any[]>`, `getCategoryCondition` | MEDIUM |
| `analysis.service.ts` | 64, 98 | `$queryRaw<any[]>` | MEDIUM |

**평가**: `$queryRaw` 반환값은 TypeScript에서 제네릭으로 타입 지정이 필요하지만, 모두 `any[]`로 선언되어 타입 안전성이 떨어짐. interface 정의 후 `$queryRaw<RankingResult[]>` 형식으로 사용해야 함.

---

## 8. Architecture Compliance

### 8.1 Module Structure

| Module | Controller | Service | Module | DTOs | Spec | Status |
|--------|:----------:|:-------:|:------:|:----:|:----:|--------|
| Monitoring | O | O | O | X | O (skeleton) | PARTIAL |
| Dashboard | O | O | O | X | O (skeleton) | PARTIAL |
| Alerts | O | O | O | X | O (skeleton) | PARTIAL |
| Analysis | O | O | O | X | O (skeleton) | PARTIAL |
| Settings | O | O | O | X | O (skeleton) | PARTIAL |
| Tags | O | O | O | O (5개) | O (skeleton) | COMPLETE |

### 8.2 PrismaService 중복 등록

PrismaService가 AppModule의 providers에 등록되면서, 각 모듈(MonitoringModule, DashboardModule 등)에서도 개별적으로 providers에 등록되어 중복 인스턴스가 생성됨.

**권장**: PrismaModule을 별도 Global Module로 분리하거나, AppModule에서 exports한 PrismaService를 각 모듈에서 import하는 방식으로 변경 필요.

### 8.3 Test Files

모든 spec 파일이 NestJS CLI가 자동 생성한 skeleton 상태. PrismaService 의존성이 제공되지 않아 실제 테스트 실행 시 DI 오류 발생 예상.

---

## 9. Environment Variable Analysis

### 9.1 Design vs Implementation

| Design 변수 | .env 파일 | 사용 여부 | Status |
|-------------|:---------:|:---------:|--------|
| `DATABASE_URL` | O | O (PrismaService) | MATCH |
| `PORT` | O (6000) | O (main.ts) | CHANGED (4000->6000) |
| `NODE_ENV` | O | X (미사용) | WARNING |
| `ALLOWED_ORIGINS` | O | O (main.ts) | MATCH |
| `JWT_SECRET` | O | X (미사용) | WARNING |
| `JWT_EXPIRES_IN` | O | X (미사용) | WARNING |
| `TIMESCALE_ENABLED` | O | X (미사용) | WARNING |
| `TIMESCALE_CHUNK_INTERVAL` | O | X (미사용) | WARNING |
| `LOG_LEVEL` | O | X (미사용) | WARNING |

### 9.2 Missing Files

- [ ] `.env.example` 파일 없음 (Git에 커밋할 템플릿)
- [ ] `.env.local` 분리 없음 (`.env`에 실제 비밀번호 포함)
- [ ] 환경 변수 검증 로직 없음 (Zod 또는 Joi 스키마)

---

## 10. Docker/Infrastructure Analysis

| Design 항목 | Implementation | Status |
|------------|:--------------:|--------|
| Docker Compose + TimescaleDB | Docker Compose (PostgreSQL 16만) | PARTIAL |
| TimescaleDB 이미지 | postgres:16 (TimescaleDB 미포함) | MISSING |
| Hypertable 생성 SQL | schema.sql에 정의됨 | MATCH |
| 압축/리텐션 정책 SQL | schema.sql에 정의됨 | MATCH |

**평가**: docker-compose.yml에서 `postgres:16` 이미지를 사용하지만 TimescaleDB 확장이 포함되지 않음. `timescale/timescaledb:latest-pg16` 이미지로 변경 필요. schema.sql의 `create_hypertable()` 호출이 TimescaleDB 없이는 실패함.

---

## 11. Differences Found

### 11.1 CRITICAL - Missing Features (Design O, Implementation X)

| # | Item | Design Location | Description | Impact |
|---|------|-----------------|-------------|--------|
| C-01 | Cycle 테이블 | plan.md:420-461 | Cycle, CycleWaveform 모델 미생성 | ANL-003/004, ALT-006 기능 불가 |
| C-02 | Alert 테이블 | plan.md:466-518 | Alert 모델 미생성 | ALT 모듈 전체 기능 제한 |
| C-03 | FacilitySetting 테이블 | plan.md:525-554 | 설비별 설정 모델 미생성 | SET 모듈 전체 기능 불가 |
| C-04 | Settings 12 API | plan.md:158-172 | 6화면 설정 CRUD 미구현 | SET-001~006 동작 불가 |
| C-05 | Analysis 4 API | plan.md:138-144 | 비교분석/파형/지연/품질 미구현 | ANL-002~005 동작 불가 |
| C-06 | Alert Action API | plan.md:121 | PUT /alerts/:id/action 미구현 | 조치사항 저장 불가 |
| C-07 | Tag Data APIs | plan.md:197-199 | latest/timeseries 2개 API 미구현 | 태그 데이터 조회 불가 |

### 11.2 MAJOR - Changed Features (Design != Implementation)

| # | Item | Design | Implementation | Impact |
|---|------|--------|----------------|--------|
| M-01 | URL 네이밍 규칙 | RESTful 계층 (`/energy/ranking`) | Flat dash (`/energy-ranking`) | Frontend URL 수정 필요 |
| M-02 | Settings DB 연동 | Prisma ORM 사용 | 100% 하드코딩 | 데이터 영속성 없음 |
| M-03 | Alert 데이터 소스 | Alert 전용 테이블 | energyTimeseries status로 대체 | 알림 상세 정보 제한 |
| M-04 | Cycle 데이터 | cycles 테이블 | energyTimeseries 추정값 | 싸이클 분석 정확도 0% |
| M-05 | Math.random 사용 | 실제 계산 로직 | Math.random() 더미값 | cycleRanking 데이터 무의미 |
| M-06 | Tags delete | soft delete (isActive=false) | hard delete (Prisma delete) | 데이터 복구 불가 |
| M-07 | Docker TimescaleDB | TimescaleDB 이미지 | 순수 PostgreSQL 16 | Hypertable 기능 미사용 |
| M-08 | PORT | 4000 | 6000 | 연결 설정 불일치 |

### 11.3 MINOR - Added Features (Design X, Implementation O)

| # | Item | Implementation Location | Description |
|---|------|------------------------|-------------|
| m-01 | Overview 분할 | monitoring.controller.ts:11-37 | overview가 4개 하위 엔드포인트로 세분화 |
| m-02 | Facilities API | dashboard.controller.ts:79-84 | 설비 목록 조회 추가 |
| m-03 | Alert Trend | alerts.controller.ts:17-20 | 알림 주간 트렌드 추가 |
| m-04 | Tag Batch Ingest | tags.controller.ts:147-153 | 배치 데이터 수집 추가 |
| m-05 | Tag Code Search | tags.controller.ts:91-96 | 태그 코드 검색 추가 |

---

## 12. Convention Compliance

### 12.1 Naming Convention

| Category | Convention | Compliance | Violations |
|----------|-----------|:----------:|------------|
| Controllers | PascalCase | 100% | - |
| Services | PascalCase | 100% | - |
| DTOs | PascalCase | 100% | - |
| Functions | camelCase | 100% | - |
| Files (module) | kebab-case | 100% | - |
| Folders | kebab-case | 100% | - |

### 12.2 Import Order

- [x] External libraries first (@nestjs/*)
- [x] Internal absolute imports (../prisma.service)
- [x] Type imports (enums from @prisma/client)
- [x] DTOs last

### 12.3 Code Quality Issues

| Type | File | Description | Severity |
|------|------|-------------|----------|
| SQL Injection Risk | dashboard.service.ts:22-23 | `Prisma.raw(lineCondition)` - string interpolation in raw SQL | HIGH |
| SQL Injection Risk | dashboard.service.ts:81, 117, 193, 232, 269, 308 | 동일 패턴 반복 | HIGH |
| SQL Injection Risk | alerts.service.ts:29, 64, 100 | `Prisma.raw(categoryCondition)` | HIGH |
| Duplicate Code | MonitoringService + DashboardService | getLineEnum() 헬퍼 중복 | MEDIUM |
| Duplicate Code | DashboardService | 거의 동일한 쿼리 패턴 7회 반복 | MEDIUM |
| Missing Validation | All controllers except Tags | Query Parameter 검증 없음 | MEDIUM |

---

## 13. Recommended Actions

### 13.1 Immediate Actions (CRITICAL)

| # | Priority | Action | Files | Expected Impact |
|---|----------|--------|-------|-----------------|
| 1 | P0 | Cycle, Alert, FacilitySetting Prisma 모델 추가 | schema.prisma | DB 스키마 완성 |
| 2 | P0 | Settings 모듈 12개 API 구현 (CRUD) | settings.controller.ts, settings.service.ts | SET-001~006 동작 |
| 3 | P0 | Analysis 모듈 4개 API 구현 | analysis.controller.ts, analysis.service.ts | ANL-002~005 동작 |
| 4 | P0 | Alerts PUT /alerts/:id/action 구현 | alerts.controller.ts, alerts.service.ts | 조치사항 저장 가능 |
| 5 | P0 | SQL Injection 취약점 수정 | dashboard.service.ts, alerts.service.ts | Prisma parameterized query 사용 |

### 13.2 Short-term Actions (MAJOR)

| # | Priority | Action | Files | Expected Impact |
|---|----------|--------|-------|-----------------|
| 6 | P1 | Tags data/latest, data/timeseries API 구현 | tags.controller.ts, tags.service.ts | 태그 데이터 조회 가능 |
| 7 | P1 | Docker TimescaleDB 이미지 변경 | docker-compose.yml | Hypertable 기능 활성화 |
| 8 | P1 | Math.random 제거, 실제 로직 구현 | dashboard.service.ts:252-253 | 싸이클 순위 데이터 정확성 |
| 9 | P1 | Monitoring~Analysis 모듈 DTO 추가 | 각 모듈 dto/ 폴더 | 타입 안전성 확보 |
| 10 | P1 | PrismaService 전역 모듈화 | prisma.module.ts | 중복 인스턴스 방지 |
| 11 | P1 | .env.example 파일 생성 | .env.example | Git 커밋 가능한 템플릿 |
| 12 | P1 | Tags soft delete 변경 | tags.service.ts | isActive=false로 변경 |

### 13.3 Long-term Actions (IMPROVEMENT)

| # | Action | Files | Notes |
|---|--------|-------|-------|
| 13 | Global Exception Filter 적용 | app.module.ts | 표준 에러 응답 형식 |
| 14 | Response Interceptor 적용 | | `{ data, meta? }` 래퍼 |
| 15 | 환경 변수 검증 (Zod/Joi) | env.ts | 앱 시작 시 검증 |
| 16 | Test 파일 실제 로직 작성 | *.spec.ts | PrismaService mock 포함 |
| 17 | URL 네이밍 통일 | 전체 controller | RESTful 또는 flat 중 택1 |
| 18 | getLineEnum() 등 공통 유틸 분리 | common/utils.ts | 중복 코드 제거 |

---

## 14. Match Rate Calculation

### API Endpoint Match Rate

```
Total Design Endpoints: 52
Fully Matched:           9  (17%)
Functionally Matched:   14  (27%)  -- URL 다르지만 기능 동일
Missing:                20  (38%)
Added (not in design):   9  (17%)

Functional Coverage = (9 + 14) / 52 = 44%
Including Changed:    (9 + 23) / 52 = 62%
```

### DB Schema Match Rate

```
Total Design Models: 8
Implemented:         4  (50%)
Missing:             4  (50%)

Schema Coverage = 4 / 8 = 50%
```

### Module Completion Rate

```
Monitoring:  95%  (기능 완전, 일부 하드코딩)
Dashboard:   85%  (기능 완전, cycle 데이터 추정)
Alerts:      50%  (통합 API 사용, 2개 누락)
Analysis:    43%  (3/7 구현)
Settings:     0%  (하드코딩만)
Tags:        82%  (CRUD 완전, data API 2개 누락)

Average Module Completion = 59%
```

### Overall Score

```
+---------------------------------------------+
|  Overall Score: 62/100                      |
+---------------------------------------------+
|  API Endpoint Match:      52%  (27/52)      |
|  DB Schema Coverage:      50%  (4/8)        |
|  DB Query Integration:    67%  (5/6 모듈)    |
|  Error Handling:          72%  (try-catch O) |
|  Type Safety:             60%  (1/6 DTO)    |
|  Architecture:            80%               |
|  Convention:              78%               |
+---------------------------------------------+
|  Status: CRITICAL (< 70%)                   |
|  Action Required: 설계-구현 동기화 필요        |
+---------------------------------------------+
```

---

## 15. Synchronization Recommendation

Match Rate가 62%이므로, 설계와 구현 간 상당한 차이가 존재합니다. 다음 선택지를 제안합니다:

### Option 1: 구현을 설계에 맞추기 (Recommended)
- Cycle, Alert, FacilitySetting 테이블 추가
- Settings 12개 API 구현
- Analysis 4개 API 구현
- 예상 작업량: 5-7일

### Option 2: 설계를 구현에 맞추기
- Settings를 general/thresholds 2개로 축소
- Alerts를 통합 API 구조로 변경
- Analysis를 3개 기본 API로 축소
- 예상 작업량: 1일 (문서 수정만)

### Option 3: 하이브리드 (Phased Approach)
- Phase A: 핵심 누락 기능 구현 (Alert action, Tags data)
- Phase B: Settings/Analysis 모듈 완성
- Phase C: 품질 개선 (DTO, Exception Filter, Test)
- 예상 작업량: 3-5일

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-20 | Initial gap analysis | gap-detector |
