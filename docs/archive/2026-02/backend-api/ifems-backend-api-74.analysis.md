# i-FEMS Backend API 74 Endpoints - Gap Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: i-FEMS (Intelligence Facility & Energy Management System)
> **Version**: v1.0
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-28
> **Design Docs**:
>   - `docs/02-design/features/backend-api.design.md`
>   - `docs/API-TEST-PLAN.md`
>   - `docs/BACKEND-API-CHECKLIST.md`
> **Implementation Path**: `apps/api/src/`

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

74개 Backend API endpoint 구현 완료 선언 후, 설계 문서 대비 실제 구현의 일치도를 검증.
엔드포인트 존재 여부, 요청/응답 스펙 일치, 에러 처리 적절성, TypeScript 타입 안정성을 종합 분석.

### 1.2 Analysis Scope

- **Design Documents**:
  - `backend-api.design.md` (원본 설계 - 2026-02-25)
  - `API-TEST-PLAN.md` (실제 구현 매핑 테이블 - 2026-02-28)
  - `BACKEND-API-CHECKLIST.md` (검증 체크리스트)
- **Implementation Files**:
  - `apps/api/src/monitoring/` (controller + service + DTOs)
  - `apps/api/src/dashboard/` (controller + service)
  - `apps/api/src/alerts/` (controller + service)
  - `apps/api/src/analysis/` (controller + service)
  - `apps/api/src/settings/` (controller + service + DTOs)
  - `apps/api/src/data-collection/` (tag data collector + energy aggregator)
  - `apps/api/prisma/schema.prisma`

---

## 2. Endpoint Gap Analysis (74 Endpoints)

### 2.1 A. Monitoring API (11 endpoints)

| No | Design Endpoint | Implementation Endpoint | Method | Status | Notes |
|----|----------------|------------------------|--------|--------|-------|
| 1 | `/monitoring/overview` (combined) | `/monitoring/overview/kpi` | GET | CHANGED | Design: 1 combined endpoint, Impl: 4 split endpoints |
| 2 | - | `/monitoring/overview/lines` | GET | ADDED | Split from overview |
| 3 | - | `/monitoring/overview/hourly` | GET | ADDED | Split from overview |
| 4 | - | `/monitoring/overview/alarms` | GET | ADDED | Split from overview |
| 5 | `/monitoring/line/:lineCode` | `/monitoring/line/:line` | GET | MATCH | Param name differs (lineCode vs line) |
| 6 | `/monitoring/energy/ranking` | `/monitoring/energy-ranking` | GET | CHANGED | URL path structure differs (/ vs -) |
| 7 | `/monitoring/energy/alerts` | `/monitoring/energy-alert` | GET | CHANGED | URL path structure differs |
| 8 | `/monitoring/power-quality/ranking` | `/monitoring/power-quality` | GET | CHANGED | /ranking suffix removed |
| 9 | `/monitoring/air-leak/ranking` | `/monitoring/air-leak` | GET | CHANGED | /ranking suffix removed |
| 10 | - | `/facilities/:facilityId/power/range` | GET | MATCH | Dynamic Resolution API |
| 11 | - | `/facilities/:facilityId/air/range` | GET | MATCH | Dynamic Resolution API |

**Monitoring Score**: 11/11 implemented (100%), URL 변경 4건

---

### 2.2 B. Dashboard API (9 endpoints)

| No | Design Endpoint | Implementation Endpoint | Method | Status | Notes |
|----|----------------|------------------------|--------|--------|-------|
| 12 | `/dashboard/energy/trend` | `/dashboard/energy-trend` | GET | CHANGED | Path: / to - |
| 13 | `/dashboard/facility/trend` | `/dashboard/facility-trend` | GET | CHANGED | Path: / to - |
| 14 | `/dashboard/line/comparison` | `/dashboard/usage-distribution` | GET | CHANGED | Completely different endpoint name & logic |
| 15 | `/dashboard/peak-demand` | `/dashboard/process-ranking` | GET | CHANGED | Completely different endpoint |
| 16 | `/dashboard/energy-cost` | `/dashboard/cycle-ranking` | GET | CHANGED | Completely different endpoint |
| 17 | `/dashboard/efficiency` | `/dashboard/power-quality-ranking` | GET | CHANGED | Completely different endpoint |
| 18 | `/dashboard/baseline` | `/dashboard/air-leak-ranking` | GET | CHANGED | Completely different endpoint |
| 19 | `/dashboard/summary` | `/dashboard/energy-change-top` | GET | CHANGED | Completely different endpoint |
| 20 | - | `/dashboard/facilities` | GET | ADDED | Not in original design |

**Dashboard Score**: 9/9 implemented (100%), but **7/8 original design endpoints replaced with different ones**.
The implementation matches the Frontend mock service functions rather than the original design document.

---

### 2.3 C. Alerts API (7 endpoints)

| No | Design Endpoint | Implementation Endpoint | Method | Status | Notes |
|----|----------------|------------------------|--------|--------|-------|
| 21 | `/alerts/statistics` | `/alerts/stats/kpi` | GET | CHANGED | Split + renamed |
| 22 | `/alerts/trend` | `/alerts/stats/trend` | GET | CHANGED | Path prefix added |
| 23 | `/alerts/severity` | `/alerts/stats/heatmap` | GET | CHANGED | Different concept |
| 24 | `/alerts/power-quality/history` + `/alerts/air-leak/history` + `/alerts/cycle/history` | `/alerts/history` | GET | CHANGED | Design: 3 separate endpoints, Impl: 1 unified with category param |
| 25 | `POST /alerts/:id/action` | `PATCH /alerts/:id/action` | PATCH | CHANGED | Method differs (POST vs PATCH) |
| 26 | - | `/alerts/:id/waveform` | GET | ADDED | Not in original design |
| 27 | `PUT /alerts/:id/acknowledge` | `/alerts/cycle-anomaly/types` | GET | CHANGED | acknowledge removed, cycle-anomaly/types added |

**Alerts Score**: 7/7 implemented (100%), significant structural changes from design.

---

### 2.4 D. Analysis API (7 endpoints)

| No | Design Endpoint | Implementation Endpoint | Method | Status | Notes |
|----|----------------|------------------------|--------|--------|-------|
| 28 | `/analysis/comparison` | `/analysis/facilities/tree` | GET | CHANGED | Different function |
| 29 | - | `/analysis/facility/hourly` | GET | ADDED | Not in design |
| 30 | `/analysis/detailed-comparison` | `/analysis/comparison/detailed` | GET | MATCH | Path reordered |
| 31 | `/analysis/cycle` | `/analysis/cycles` | GET | CHANGED | Plural form |
| 32 | - | `/analysis/cycle/waveform` | GET | ADDED | Split from cycle |
| 33 | `/analysis/cycle-delay` | `/analysis/cycle/delay` | GET | CHANGED | Path structure |
| 34 | `/analysis/power-quality` | `/analysis/power-quality` | GET | MATCH | |

**Analysis Score**: 7/7 implemented (100%), several path changes and additions.

---

### 2.5 E. Settings API (40 endpoints)

| No | Design/Implementation Endpoint | Method | Status | Notes |
|----|-------------------------------|--------|--------|-------|
| 35 | `/settings/power-quality` | GET | MATCH | Threshold GET |
| 36 | `/settings/power-quality` | PUT | MATCH | Threshold PUT |
| 37 | `/settings/air-leak` | GET | MATCH | |
| 38 | `/settings/air-leak` | PUT | MATCH | |
| 39 | `/settings/reference-cycles` | GET | MATCH | |
| 40 | `/settings/cycle-alert` | GET | MATCH | |
| 41 | `/settings/cycle-alert` | PUT | MATCH | |
| 42 | `/settings/energy-alert` | GET | MATCH | |
| 43 | `/settings/energy-alert` | PUT | MATCH | |
| 44 | `/settings/cycle-energy-alert` | GET | MATCH | |
| 45 | `/settings/cycle-energy-alert` | PUT | MATCH | |
| 46 | `/settings/facility-master` | GET | MATCH | |
| 47 | `/settings/facility-master/:id` | PUT | MATCH | |
| 48 | `/settings/facility-master` | POST | MATCH | |
| 49 | `/settings/facility-master/:id` | DELETE | MATCH | |
| 50 | `/settings/factory` | GET | MATCH | |
| 51 | `/settings/factory` | POST | MATCH | |
| 52 | `/settings/factory/:id` | PUT | MATCH | |
| 53 | `/settings/factory/:id` | DELETE | MATCH | |
| 54 | `/settings/line` | GET | MATCH | |
| 55 | `/settings/line` | POST | MATCH | |
| 56 | `/settings/line/:id` | PUT | MATCH | |
| 57 | `/settings/line/:id` | DELETE | MATCH | |
| 58 | `/settings/tag` | GET | MATCH | |
| 59 | `/settings/tag/:id` | GET | MATCH | |
| 60 | `/settings/tag` | POST | MATCH | |
| 61 | `/settings/tag/:id` | PUT | MATCH | |
| 62 | `/settings/tag/:id` | DELETE | MATCH | |
| 63 | `/settings/hierarchy` | GET | MATCH | |
| 64 | `/settings/hierarchy/factory/:factoryId` | GET | MATCH | |
| 65 | `/settings/hierarchy/line/:lineId` | GET | MATCH | |
| 66 | `/settings/hierarchy/facility/:facilityId` | GET | MATCH | |
| 67 | `/settings/facility-type` | GET | MATCH | |
| 68 | `/settings/facility-type` | POST | MATCH | |
| 69 | `/settings/facility-type/:id` | PUT | MATCH | |
| 70 | `/settings/facility-type/:id` | DELETE | MATCH | |
| 71 | `/settings/tag/bulk-upload` | POST | MATCH | |
| 72 | `/settings/tag/bulk-template` | GET | MATCH | |
| 73 | `/settings/tag/reassign` | POST | MATCH | |
| 74 | `/settings/tag/:id/reassignment-history` | GET | MATCH | |

**Additional (not in 74 count)**:
- `/settings/general` GET/PUT (2 extra endpoints)
- `/settings/thresholds` GET (1 extra endpoint)

**Settings Score**: 40/40 implemented (100%), perfect match with API-TEST-PLAN.md

---

## 3. Design Document vs Implementation - Request/Response Spec Analysis

### 3.1 Monitoring Module - Response Format Gaps

| Endpoint | Design Response | Impl Response | Gap Level |
|----------|----------------|---------------|-----------|
| overview/kpi | `{ kpi: { totalPower, totalAir, powerQualityAlerts, airLeakAlerts } }` | `{ totalPower: {value,unit,change}, totalAir: {...}, powerQualityAlarms: {...}, airLeakAlarms: {...} }` | MEDIUM - Different structure (flat vs nested, "Alerts" vs "Alarms") |
| overview/lines | Part of overview combined response | Separate `LineCard[]` with `{id, label, power, powerUnit, air, airUnit, powerStatus, airStatus}` | LOW - Better granularity in impl |
| overview/hourly | `chart: { timestamps[], prevPower[], currentPower[], prevAir[], currentAir[], currentTime }` | `Array<{ time, current, prev }>` | MEDIUM - Array of objects vs parallel arrays |
| line/:line | `{ line, powerChart, airChart, facilities }` | `{ power: [{time, current, prev}], air: [{time, current, prev}] }` | MEDIUM - Simplified structure |
| energy-ranking | `[{ rank, facilityCode, ... }]` | `[{ facilityId, code, name, dailyElec, weeklyElec, rankElec, ... }]` | MEDIUM - More fields, different field names |
| power-quality | `[{ rank, imbalance, powerFactor, ... }]` | `[{ facilityId, code, unbalanceRate, powerFactor, status, rankUnbalance, ... }]` | LOW - More detailed |
| Dynamic Resolution | `{ data: DataPoint[], metadata: {...} }` | `{ data: RangeDataPoint[], metadata: RangeMetadata }` | MATCH - Full DTO match |

### 3.2 Dashboard Module - Response Format Gaps

| Endpoint | Design Response | Impl Response | Gap Level |
|----------|----------------|---------------|-----------|
| energy-trend | `{ months[], powerData[], airData[] }` (monthly) | `[{ date, power, air, prevPower, prevAir, powerTarget, airTarget }]` (daily) | HIGH - Monthly vs Daily granularity |
| facility-trend | `{ timestamps[], series[{facility, color, data[]}] }` | `[{ date, power, air }]` | HIGH - Series structure completely different |
| process-ranking | N/A (not in original design) | `[{ process, power, air, prevPower, prevAir }]` | N/A - New endpoint |
| cycle-ranking | N/A (not in original design) | `[{ rank, code, cycleEnergy, cycleTime, deviation, status }]` | N/A - New endpoint |
| power-quality-ranking | N/A (not in original design) | Same format as Monitoring power-quality | N/A |
| air-leak-ranking | N/A (not in original design) | Same format as Monitoring air-leak | N/A |
| energy-change-top | N/A (not in original design) | `[{ code, name, prevMonthChange, prevYearChange }]` | N/A |

### 3.3 Alerts Module - Response Format Gaps

| Endpoint | Design Response | Impl Response | Gap Level |
|----------|----------------|---------------|-----------|
| stats/kpi | `{ byType, bySeverity, byLine, total }` | `{ total, weekly, weeklyChange, resolved, resolvedRate }` | HIGH - Completely different KPI structure |
| stats/trend | `{ dates[], countsByType, totalCounts[] }` | `[{ week, count }]` | MEDIUM - Simplified |
| stats/heatmap | Not in design | `[{ facility, week1..week8 }]` | N/A - New |
| history | 3 separate endpoints by type | 1 unified with category filter | MEDIUM - Consolidation |
| :id/action | `POST { actionTaken, actionTakenBy }` | `PATCH { action }` | MEDIUM - Simplified body, different HTTP method |
| cycle-anomaly/types | Not in design | `[{ value, label }]` | N/A - New |
| :id/waveform | Not in design | `[{ time, current, prev }]` | N/A - New |

### 3.4 Analysis Module - Response Format Gaps

| Endpoint | Design Response | Impl Response | Gap Level |
|----------|----------------|---------------|-----------|
| facilities/tree | Not in design | `[{ id, label, children }]` (tree structure) | N/A - New |
| facility/hourly | Not in design | `[{ time, current, prev }]` | N/A - New |
| comparison/detailed | `{ origin, compare, diff }` | `[{ time, origin, compare, diff }]` | LOW - Array vs nested |
| cycles | `{ referenceCycle, cycles[] }` | `[{ id, label, energy, similarity, status }]` | MEDIUM - Different structure |
| cycle/waveform | Part of cycle analysis | `[{ sec, value }]` | N/A - Split endpoint |
| cycle/delay | `{ ref, current, diff, delay }` | `{ cycleId, totalEnergy, similarity, delay }` | MEDIUM - Different fields |
| power-quality | `{ timestamps[], imbalanceSeries[], powerFactorSeries[] }` | `Array<Array<{ time, current, prev }>>` | HIGH - Completely different |

---

## 4. Error Handling Analysis

### 4.1 Custom Exception Coverage

| Exception Class | HTTP Status | Used In | Status |
|----------------|-------------|---------|--------|
| `InvalidIntervalException` | 400 | Defined but unused (DTO @IsEnum validates first) | PARTIAL |
| `InvalidTimeRangeException` | 400 | `MonitoringService.fetchRangeData()` | ACTIVE |
| `FacilityNotFoundException` | 404 | `MonitoringService.fetchRangeData()` | ACTIVE |
| `DatabaseQueryException` | 500 | `MonitoringService.buildTimeBucketQuery()` | ACTIVE |

### 4.2 Global Exception Filter

| Design Requirement | Implementation | Status |
|-------------------|----------------|--------|
| `GlobalExceptionFilter` class in `common/filters/` | NOT IMPLEMENTED | MISSING |
| Standardized error response `{ statusCode, timestamp, path, message }` | Each service has try-catch with `throw error` | PARTIAL |
| Global filter registration via APP_FILTER or `main.ts` | Not registered | MISSING |

### 4.3 Validation Pipe

| Item | Status | Notes |
|------|--------|-------|
| `ValidationPipe` in `main.ts` | ACTIVE | `whitelist: true, forbidNonWhitelisted: true, transform: true` |
| DTO validation for Monitoring (Dynamic Resolution) | ACTIVE | `RangeQueryDto` with class-validator |
| DTO validation for Dashboard endpoints | MISSING | No DTO classes, raw Query params |
| DTO validation for Alerts endpoints | MISSING | No DTO classes |
| DTO validation for Analysis endpoints | MISSING | No DTO classes |
| DTO validation for Settings endpoints | PARTIAL | Factory/Line/Tag DTOs exist, others use `any` |

---

## 5. Data Quality Issues

### 5.1 Math.random() Usage (Hardcoded/Mock Data in Production Code)

| File | Line(s) | Context | Severity |
|------|---------|---------|----------|
| `dashboard.service.ts` | L235-236 | `prevPower/prevAir` uses `Math.random()` instead of actual previous period query | HIGH |
| `dashboard.service.ts` | L272, L278 | `deviation` and `cycleTime` are random values | HIGH |
| `alerts.service.ts` | L48 | `weeklyChange` is `Math.round((Math.random() - 0.3) * 10)` | HIGH |
| `alerts.service.ts` | L266-267 | Waveform data completely generated with random | MEDIUM |
| `analysis.service.ts` | L186 | Cycle `similarity` is random | MEDIUM |
| `analysis.service.ts` | L213 | Waveform data generated with sin + random | MEDIUM |
| `analysis.service.ts` | L238-239 | Delay info `similarity` and `delay` are random | MEDIUM |
| `settings.service.ts` | L75-76 | Reference cycle `energy` and `cycleTime` are random | LOW |

**Total**: 8 locations with `Math.random()` in service layer (excluding data-collection which is explicitly mock data generation).

### 5.2 SQL Injection Concerns

| File | Line | Pattern | Severity |
|------|------|---------|----------|
| `dashboard.service.ts` | L27, L120 | `Prisma.raw(lineCondition)` with string interpolation | MEDIUM |
| `alerts.service.ts` | L169-170 | `Prisma.raw(lineCondition)`, `Prisma.raw(facilityCondition)` | MEDIUM |
| `analysis.service.ts` | L79-81, L163 | `Prisma.raw(facilityCondition)` | MEDIUM |
| `monitoring.service.ts` | L1021-1022, L1042-1043 | String interpolation in SQL for `energyType` | LOW (enum-derived) |

Note: `Prisma.raw()` is used for dynamic WHERE conditions. Input validation at controller layer mitigates risk, but parameterized queries are preferred.

### 5.3 TODO Stubs

| File | Method | Description | Impact |
|------|--------|-------------|--------|
| `settings.service.ts` | `saveThresholdSettings()` | Returns `{ success: true }` without actual DB save | HIGH |
| `settings.service.ts` | `getGeneralSettings()` | Hardcoded return values | MEDIUM |
| `settings.service.ts` | `saveGeneralSettings()` | Returns input without saving | MEDIUM |
| `settings.service.ts` | `getThresholds()` | Hardcoded threshold values | MEDIUM |
| `alerts.service.ts` | `saveAlertAction()` | Returns success without DB update (no Alert table data) | HIGH |

---

## 6. Data Model Compliance

### 6.1 Prisma Schema vs Design

| Model | Design Doc | Prisma Schema | Status |
|-------|-----------|---------------|--------|
| Factory | Defined in Plan | Implemented with all fields | MATCH |
| Line | Defined in Plan | Implemented with all fields | MATCH |
| Facility | Extended with relations | All relations present (alerts, cycles, referenceCycle) | MATCH |
| Tag | Defined in Plan | Implemented | MATCH |
| TagDataRaw | Hypertable candidate | Defined, composite PK `[timestamp, tagId]` | MATCH |
| EnergyTimeseries | Hypertable candidate | Defined with power/air/quality fields | MATCH |
| Alert | Defined in Design | All fields present (severity, type, action, acknowledge) | MATCH |
| CycleData | Defined in Design | All fields present (waveform, status, delay) | MATCH |
| ReferenceCycle | Defined in Design | All fields present | MATCH |
| FacilityType | Phase 2 addition | Implemented with color/icon fields | MATCH |
| TagReassignmentLog | Phase 2 addition | Implemented | MATCH |

**Schema Score**: 11/11 models match (100%)

### 6.2 Unused Models (Schema exists but not queried in Services)

| Model | Used in Services | Status |
|-------|-----------------|--------|
| Alert | NOT queried (alerts.service uses EnergyTimeseries instead) | GAP |
| CycleData | NOT queried (analysis.service uses EnergyTimeseries instead) | GAP |
| ReferenceCycle | NOT queried (settings.service generates mock data instead) | GAP |

---

## 7. Architecture Compliance

### 7.1 Module Structure

| Module | Controller | Service | Module File | DTOs | Status |
|--------|-----------|---------|-------------|------|--------|
| Monitoring | MonitoringController + DynamicResolutionController | MonitoringService | monitoring.module.ts | RangeQueryDto, RangeResponseDto, IntervalEnum | GOOD |
| Dashboard | DashboardController | DashboardService | dashboard.module.ts | None | PARTIAL (no DTOs) |
| Alerts | AlertsController | AlertsService | alerts.module.ts | None | PARTIAL (no DTOs) |
| Analysis | AnalysisController | AnalysisService | analysis.module.ts | None | PARTIAL (no DTOs) |
| Settings | SettingsController | SettingsService | settings.module.ts | factory.dto, line.dto, tag.dto, facility-type.dto, tag-bulk.dto, tag-reassignment.dto | GOOD |
| DataCollection | - | TagDataCollectorService, EnergyAggregatorService | data-collection.module.ts | None | GOOD (background service) |

### 7.2 NestJS Best Practices

| Practice | Status | Notes |
|----------|--------|-------|
| Global prefix `/api` | ACTIVE | Set in `main.ts` |
| CORS configuration | ACTIVE | Dev: all origins, Prod: configurable |
| Swagger documentation | ACTIVE | Available at `/api/docs` |
| ValidationPipe global | ACTIVE | `whitelist, forbidNonWhitelisted, transform` |
| ConfigModule | ACTIVE | `.env` file support |
| PrismaService | ACTIVE | Shared across modules |
| UTF-8 encoding middleware | ACTIVE | `Content-Type: charset=utf-8` |

### 7.3 PrismaService Registration Pattern

| Module | PrismaService Provided? | Status |
|--------|------------------------|--------|
| AppModule | providers + exports | OK |
| MonitoringModule | providers | SMELL (should use global) |
| DashboardModule | providers | SMELL |
| AlertsModule | providers | SMELL |
| AnalysisModule | providers | SMELL |
| SettingsModule | providers | SMELL |
| DataCollectionModule | providers | SMELL |

Note: PrismaService is re-registered in every module. Better pattern: use `@Global()` module or import from AppModule.

---

## 8. Test Coverage

### 8.1 Test File Status

| Test File | Content | Status |
|-----------|---------|--------|
| `app.controller.spec.ts` | Basic `toBeDefined()` test | SKELETON |
| `monitoring.controller.spec.ts` | Basic `toBeDefined()` test | SKELETON |
| `monitoring.service.spec.ts` | Basic `toBeDefined()` test | SKELETON |
| `dashboard.controller.spec.ts` | Basic `toBeDefined()` test | SKELETON |
| `dashboard.service.spec.ts` | Basic `toBeDefined()` test | SKELETON |
| `alerts.controller.spec.ts` | Basic `toBeDefined()` test | SKELETON |
| `alerts.service.spec.ts` | Basic `toBeDefined()` test | SKELETON |
| `analysis.controller.spec.ts` | Basic `toBeDefined()` test | SKELETON |
| `analysis.service.spec.ts` | Basic `toBeDefined()` test | SKELETON |
| `settings.controller.spec.ts` | Basic `toBeDefined()` test | SKELETON |
| `settings.service.spec.ts` | Basic `toBeDefined()` test | SKELETON |

**Test Score**: 0% meaningful coverage. All 11 test files contain only skeleton `toBeDefined()` assertions.

---

## 9. Convention Compliance

### 9.1 Naming Convention

| Category | Convention | Compliance | Violations |
|----------|-----------|:----------:|------------|
| Controllers | PascalCase class name | 100% | None |
| Services | PascalCase class name | 100% | None |
| Methods | camelCase | 100% | None |
| DTOs | PascalCase + `.dto.ts` | 95% | Some `any` types used instead of proper DTOs |
| Files | kebab-case | 100% | None |
| Modules | PascalCase + `.module.ts` | 100% | None |

### 9.2 TypeScript Type Safety

| Category | Count | Type Safety | Notes |
|----------|-------|:-----------:|-------|
| Controller params with proper DTO | 2 | GOOD | RangeQueryDto, CreateFactoryDto, etc. |
| Controller params with `any` | 6 | BAD | Most threshold save endpoints use `any[]` |
| Service return types annotated | 2 | PARTIAL | Only fetchRangeData has return type |
| Service params with `any` | 12 | BAD | Widespread use of `any` in service methods |
| `$queryRaw<any[]>` usage | 25+ | BAD | All raw queries return `any[]` |

### 9.3 Import Order

| Rule | Compliance | Notes |
|------|:----------:|-------|
| External libs first | 95% | Consistent |
| Internal imports second | 95% | Consistent |
| Type imports separate | 80% | Some mixed imports |

---

## 10. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| **Endpoint Coverage** | 100% (74/74) | OK |
| **Endpoint URL Match** | 68% | WARN |
| **Response Format Match** | 52% | CRITICAL |
| **Error Handling** | 45% | CRITICAL |
| **Data Model Schema** | 100% | OK |
| **Data Model Usage** | 73% | WARN |
| **Architecture** | 78% | WARN |
| **DTO/Type Safety** | 40% | CRITICAL |
| **Test Coverage** | 5% | CRITICAL |
| **Convention Compliance** | 90% | OK |
| **Data Quality (no mock in production)** | 65% | WARN |
| **Overall** | **68%** | WARN |

```
Overall Match Rate: 68% (WARN)

Endpoint Coverage:        100% (74/74 present)
Design Spec Compliance:    52% (URL + Response match)
Code Quality:              55% (type safety + error handling)
Test Coverage:              5% (skeleton only)
Architecture:              78% (NestJS patterns)
Convention:                90% (naming + structure)
```

---

## 11. Differences Found

### 11.1 CRITICAL - Missing Features (Design Present, Implementation Incomplete)

| ID | Item | Design Location | Description | Impact |
|----|------|-----------------|-------------|--------|
| C-01 | Global Exception Filter | design.md Section 7.1 | `GlobalExceptionFilter` class not implemented, not registered in main.ts | Unhandled exceptions may crash server |
| C-02 | Alert table not used | design.md Section 3.3 | Alert model exists in schema but alerts.service queries EnergyTimeseries, not Alert table | Alert CRUD non-functional |
| C-03 | CycleData table not used | design.md Section 3.4 | CycleData model exists but analysis.service uses EnergyTimeseries for cycle data | Cycle analysis returns approximated data |
| C-04 | Threshold save is stub | design.md Section 9 | `saveThresholdSettings()` returns success without DB save | Settings changes are not persisted |
| C-05 | Alert action save is stub | design.md Section 3.3.7 | `saveAlertAction()` returns success without DB update | Alert actions are not persisted |

### 11.2 HIGH - Math.random() in Production Services

| ID | Item | Implementation Location | Description | Impact |
|----|------|------------------------|-------------|--------|
| H-01 | Dashboard prevPower/prevAir random | `dashboard.service.ts:235-236` | Process ranking prev values are `value * (0.92 + Math.random() * 0.1)` | Frontend displays random comparison data |
| H-02 | Dashboard cycleTime/deviation random | `dashboard.service.ts:272,278` | Cycle ranking uses random cycleTime and deviation | Incorrect cycle analysis display |
| H-03 | Alerts weeklyChange random | `alerts.service.ts:48` | KPI weekly change is `Math.round((Math.random() - 0.3) * 10)` | Misleading trend indicator |
| H-04 | Alerts waveform random | `alerts.service.ts:266-267` | Alert detail waveform is entirely random generated | No actual measurement data |
| H-05 | Analysis similarity/delay random | `analysis.service.ts:186,238-239` | Cycle similarity and delay are random | Incorrect anomaly detection |

### 11.3 MEDIUM - URL Path Divergence from Design

| ID | Design URL | Impl URL | Notes |
|----|-----------|----------|-------|
| M-01 | `/monitoring/overview` (combined) | 4 split endpoints (`/kpi`, `/lines`, `/hourly`, `/alarms`) | Frontend-driven split; better for selective loading |
| M-02 | `/monitoring/energy/ranking` | `/monitoring/energy-ranking` | Kebab-case preferred in implementation |
| M-03 | `/monitoring/energy/alerts` | `/monitoring/energy-alert` | Singular form |
| M-04 | `/dashboard/energy/trend` | `/dashboard/energy-trend` | Flat path |
| M-05 | Dashboard 8 original endpoints | 8 completely different endpoints | Implements Frontend mock functions instead |
| M-06 | `POST /alerts/:id/action` | `PATCH /alerts/:id/action` | HTTP method change |
| M-07 | 3 separate alert history endpoints | 1 unified `/alerts/history?category=` | Consolidation |
| M-08 | No DTO validation for 4 modules | Only Monitoring (Dynamic Resolution) has proper DTOs | Risk of invalid input |

### 11.4 LOW - Added Features (Implementation has, Design does not)

| ID | Item | Implementation Location | Description |
|----|------|------------------------|-------------|
| L-01 | `/settings/general` GET/PUT | `settings.controller.ts:87-96` | General settings endpoints |
| L-02 | `/settings/thresholds` GET | `settings.controller.ts:98-102` | Unified thresholds endpoint |
| L-03 | `/dashboard/facilities` GET | `dashboard.controller.ts:79-84` | Facility list for dashboard |
| L-04 | `/alerts/cycle-anomaly/types` GET | `alerts.controller.ts:48-51` | Cycle anomaly type enum |
| L-05 | `/alerts/:id/waveform` GET | `alerts.controller.ts:54-58` | Waveform for alert detail |
| L-06 | `/analysis/facilities/tree` GET | `analysis.controller.ts:11-13` | Facility tree for analysis |
| L-07 | `/analysis/facility/hourly` GET | `analysis.controller.ts:16-26` | Hourly facility data |
| L-08 | In-memory caching for Dynamic Resolution | `monitoring.service.ts:30-31` | Cache with per-interval TTL |

---

## 12. Recommended Actions

### 12.1 Immediate Actions (CRITICAL)

| Priority | Item | File | Description |
|----------|------|------|-------------|
| 1 | Implement GlobalExceptionFilter | `common/filters/http-exception.filter.ts` | Create and register filter in `main.ts` or AppModule |
| 2 | Remove Math.random() from services | `dashboard.service.ts`, `alerts.service.ts`, `analysis.service.ts` | Replace with actual DB queries or null |
| 3 | Create DTOs for Dashboard/Alerts/Analysis | `dashboard/dto/`, `alerts/dto/`, `analysis/dto/` | Add class-validator decorators |

### 12.2 Short-term Actions (HIGH)

| Priority | Item | File | Description |
|----------|------|------|-------------|
| 4 | Use Alert table in AlertsService | `alerts.service.ts` | Query actual `alerts` table instead of `energy_timeseries` |
| 5 | Use CycleData table in AnalysisService | `analysis.service.ts` | Query `cycle_data` and `reference_cycles` tables |
| 6 | Implement threshold persistence | `settings.service.ts` | Create `threshold_settings` table or use existing model |
| 7 | Fix saveAlertAction to use DB | `alerts.service.ts` | Update Alert record in database |
| 8 | Fix SQL injection patterns | Multiple services | Use parameterized queries instead of `Prisma.raw()` |

### 12.3 Medium-term Actions

| Priority | Item | Description |
|----------|------|-------------|
| 9 | Write real unit tests | Replace all skeleton spec files with actual tests |
| 10 | Add return types to all service methods | TypeScript strict mode compliance |
| 11 | Make PrismaService global | Remove per-module registration |
| 12 | Sync design document with implementation | Update URL paths and response formats |

---

## 13. Design Document Update Recommendations

The original `backend-api.design.md` needs significant updates:

1. **Dashboard API**: Replace 8 endpoints (energy/trend, facility/trend, line/comparison, peak-demand, energy-cost, efficiency, baseline, summary) with actual implementation (energy-trend, facility-trend, usage-distribution, process-ranking, cycle-ranking, power-quality-ranking, air-leak-ranking, energy-change-top)
2. **Alerts API**: Document unified `/alerts/history?category=` pattern instead of 3 separate endpoints
3. **Monitoring API**: Document split overview endpoints (4 sub-endpoints)
4. **Analysis API**: Document new endpoints (facilities/tree, facility/hourly, cycle/waveform)
5. **Added endpoints**: Document general settings, thresholds, facilities list, cycle-anomaly types

---

## 14. Summary

### Strengths
- All 74 endpoints are implemented and accessible
- Settings module (40 endpoints) perfectly matches the API-TEST-PLAN
- Dynamic Resolution API has excellent implementation with proper DTOs, custom exceptions, caching, and data source routing
- Prisma schema matches design completely (11/11 models)
- Data collection system (tag-data-collector + energy-aggregator) operational
- Swagger documentation active for all endpoints
- NestJS best practices followed (modules, DI, controllers/services separation)

### Critical Gaps
- No Global Exception Filter (design specifies one)
- Alert and CycleData tables exist in schema but are not queried by services
- 8 locations with `Math.random()` in production service code (not data-collection)
- 5 TODO stubs that return success without actual DB persistence
- 0% meaningful test coverage (11 skeleton test files)
- DTOs missing for Dashboard, Alerts, and Analysis modules
- Dashboard API endpoints are completely different from original design document

### Conclusion

74/74 endpoints exist and return data, earning a **100% endpoint coverage** score. However, the **design specification compliance is 52%** due to significant URL path changes and response format differences, especially in the Dashboard module which was redesigned to match Frontend mock services. The code quality score of **55%** reflects Math.random() usage, missing DTOs, and TODO stubs. The overall match rate of **68%** places this in the WARN category, requiring design document synchronization and several code quality improvements before reaching the 90% threshold.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-28 | Initial analysis of 74 endpoints | Claude Code (gap-detector) |
