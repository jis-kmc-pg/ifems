# i-FEMS Backend API Gap Analysis Report (v5.1)

> **Analysis Type**: Gap Analysis (Design v5.1 vs Implementation) - 5th Iteration
>
> **Project**: i-FEMS (Intelligence Facility & Energy Management System)
> **Version**: v5.1 (19 discrepancy fixes applied to design document)
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-28
> **Previous Report**: `ifems-backend-api-v5.analysis.md` (v5.0, Score: 82%)
> **Design Doc**: `docs/02-design/features/backend-api.design.md` (v5.1, 23 `<!-- (v5.1) -->` markers)
> **Implementation Path**: `apps/api/src/`

---

## 1. Analysis Overview

### 1.1 What Changed Since v5.0

The design document v5.1 applies 19 targeted corrections:

| Change Category | Count | Description |
|----------------|:-----:|-------------|
| MISMATCH fixed (G-01~G-04) | 4 | Response structure completely rewritten |
| PARTIAL fixed (P-01~P-13) | 13 | Field names aligned to actual Service returns |
| Parameter fixed (F-01~F-02) | 2 | `power_quality` underscore, `elec` type unified |
| **Total v5.1 markers** | **23** | All marked with `<!-- (v5.1 - ...) -->` |

### 1.2 Previous v5.0 Score Breakdown

| Category | v5.0 Score | Issue |
|----------|:---------:|-------|
| Endpoint Coverage | 100% (77/77) | All endpoints exist |
| Endpoint URL Match | 100% (77/77) | All URLs match |
| Response Format Match | 86% (60 exact + 13 partial + 4 mismatch) | Field name diffs |
| Request Match | 88% | 2 parameter format gaps |
| DTO/Validation | 85% | Monitoring 7/8 raw `@Query` |
| Error Handling | 78% | GlobalExceptionFilter + custom exceptions |
| Test Coverage | 5% | Skeleton tests only |
| Convention Compliance | 90% | Good |
| **Overall** | **82%** | WARN |

---

## 2. v5.1 Fix Verification (19 Items)

### 2.1 MISMATCH Fixes (G-01 to G-04)

#### G-01: `monitoring/overview/alarms` -- VERIFIED - RESOLVED with CAVEAT

**Design v5.1** (line 469-477):
```typescript
[{ line: string; powerQuality: number; airLeak: number; total: number; }]
```

**Implementation** (`monitoring.service.ts:291-296`):
```typescript
return lineAlarms.map((line) => ({
  line: line.line,           // line.name (lineName)
  powerQuality: Number(line.powerQuality || 0),
  airLeak: Number(line.airLeak || 0),
  total: Number(line.powerQuality || 0) + Number(line.airLeak || 0),
}));
```

**Result**: EXACT MATCH on fields `{line, powerQuality, airLeak, total}`.

**Caveat**: Design says `line: "BLOCK", "HEAD", "CRANK", "ASSEMBLE"` (line codes), but implementation uses `l.name` (line names like "Block Line", "Head Line"). The **value format** differs but the **field name** matches.

**Status**: PARTIAL (field names match, value source differs -- `l.name` vs `l.code`)

---

#### G-02: `alerts/:id/waveform` -- VERIFIED - RESOLVED

**Design v5.1** (line 1208-1214):
```typescript
[{ time: string; current: number; prev: number; }]
```

**Implementation** (`alerts.service.ts:288-299`):
```typescript
return Array.from({ length: points }, (_, i) => {
  ...
  return {
    time: timeStr,             // "HH:mm" format
    current: Math.max(0, baseValue + noise),
    prev: Math.max(0, baseValue + prevNoise),
  };
});
```

**Result**: EXACT MATCH on fields `{time, current, prev}`.

**Note**: Data is deterministic sine wave (not real DB query), acceptable for development.

**Status**: EXACT MATCH

---

#### G-03: `analysis/cycle/delay` -- VERIFIED - RESOLVED

**Design v5.1** (line 1397-1402):
```typescript
{ cycleId: string; totalEnergy: number; similarity: number; delay: number; }
```

**Implementation** (`analysis.service.ts:291-296` and `304-309`):
```typescript
return {
  cycleId,
  totalEnergy: Math.round(totalEnergy * 100) / 100,
  similarity: Math.round(similarity * 100) / 100,
  delay: Math.round(delay * 10) / 10,
};
```

**Result**: EXACT MATCH on fields `{cycleId, totalEnergy, similarity, delay}`.

**Status**: EXACT MATCH

---

#### G-04: `analysis/power-quality` -- VERIFIED - RESOLVED

**Design v5.1** (line 1426-1430):
```typescript
Array<Array<{ time: string; current: number; prev: number; }>>
```

**Implementation** (`analysis.service.ts:314-323`):
```typescript
const results = [];
for (const facilityId of facilityIds) {
  const data = await this.getFacilityHourlyData(facilityId, 'elec', date);
  results.push(data);  // each element is Array<{time, current, prev}>
}
return results;  // returns Array<Array<{time, current, prev}>>
```

**Result**: EXACT MATCH. `getFacilityHourlyData` returns `Array<{time, current, prev}>`, and this wraps N of them.

**Status**: EXACT MATCH

---

### 2.2 PARTIAL Fixes (P-01 to P-13)

| ID | Endpoint | Design Field | Impl Field | v5.1 Fix | Status |
|----|----------|-------------|------------|----------|--------|
| P-01 | monitoring/overview/hourly | `current, prev` | `current, prev` | Aligned | EXACT |
| P-02 | monitoring/line/:line | `{power:[], air:[]}` with `{time, current, prev}` | Same | Aligned | EXACT |
| P-03 | monitoring/energy-ranking | `prevWeeklyElec, prevWeeklyAir, rankDailyElec, ...` | `prevDailyElec, prevDailyAir, rankElec, rankAir, rankChangeElec, rankChangeAir, process, status, isProcessing` | **NOT FULLY ALIGNED** | PARTIAL |
| P-04 | monitoring/energy-alert | `dailyElec, weeklyElec, ... + changes + status` | `process, prevMonthChangeElec/Air, prevYearChangeElec/Air, elecStatus, airStatus` (NO dailyElec/weeklyElec) | **NOT FULLY ALIGNED** | PARTIAL |
| P-05 | monitoring/power-quality | `unbalanceRate, powerFactor, unbalanceLimit, powerFactorLimit, rankUnbalance, rankPowerFactor` | Same + `process, status` extra fields | Aligned (core fields) | EXACT |
| P-06 | monitoring/air-leak | `baseline, current, leakRate, rank` | Same + `process, status` extra fields | Aligned (core fields) | EXACT |
| P-07 | dashboard/process-ranking | `{process, power, air, prevPower, prevAir}` | Same | Aligned | EXACT |
| P-08 | dashboard/cycle-ranking | `{facilityId, code, name, cycleEnergy, cycleTime, deviation, rank}` | `{rank, code, process, cycleEnergy, cycleTime, deviation, status}` -- NO facilityId/name | PARTIAL |
| P-09 | dashboard/energy-change-top | `{facilityId, code, name, dailyElec, weeklyElec, ..., prevMonthChange, prevYearChange}` | `{code, name, prevMonthChange, prevYearChange}` -- NO facilityId/dailyElec/weeklyElec fields | PARTIAL |
| P-10 | dashboard/facilities | `{id, code, name}` | Same | Aligned | EXACT |
| P-11 | alerts/:id/action | `{success, id, action, updatedAt}` | Same | Aligned | EXACT |
| P-12 | alerts/cycle-anomaly/types | `{value, label}` | `{value, label}` but values differ (Design: "delayed"/"low-similarity"/"energy-spike", Impl: "NORMAL"/"DELAYED"/"ANOMALY"/"INCOMPLETE") | PARTIAL |
| P-13 | analysis/cycle/waveform | `{sec, value}` | Same | Aligned | EXACT |

---

### 2.3 Parameter Fixes (F-01 to F-02)

| ID | Endpoint | Parameter | Design v5.1 | DTO (Impl) | Status |
|----|----------|-----------|-------------|------------|--------|
| F-01 | alerts/* | category | `"power_quality" \| "air_leak" \| "cycle_anomaly"` | `@IsIn(['power_quality', 'air_leak', 'cycle_anomaly'])` | EXACT MATCH |
| F-02 | dashboard/process-ranking | type | `"elec" \| "air"` | `@IsIn(['elec', 'air'])` | EXACT MATCH |
| F-02b | dashboard/energy-change-top | type | `"elec" \| "air"` | `@IsIn(['elec', 'air'])` | EXACT MATCH |

**Note**: The Controller `@ApiQuery` annotation still uses `enum: ['power', 'air']` for DSH-004 and DSH-008, but the DTO `@IsIn(['elec', 'air'])` is the actual validation. Swagger documentation is misleading but runtime behavior is correct.

---

## 3. Remaining Gaps After v5.1

### 3.1 Response Format Gaps (Still PARTIAL or MISMATCH)

#### R-01: `monitoring/energy-ranking` (3.1.6) -- PARTIAL

**Design v5.1** specifies:
```
prevWeeklyElec, prevWeeklyAir, rankDailyElec, rankWeeklyElec, rankDailyAir, rankWeeklyAir
```

**Implementation** returns:
```
prevDailyElec, prevDailyAir, rankElec, rankAir, rankChangeElec, rankChangeAir, process, status, isProcessing
```

**Differences**:
- Design has `prevWeeklyElec/Air` -- Impl has only `prevDailyElec/Air` (no weekly prev)
- Design has `rankDailyElec/WeeklyElec/DailyAir/WeeklyAir` (4 ranks) -- Impl has `rankElec/rankAir` (2 ranks) + `rankChangeElec/rankChangeAir`
- Impl has extra fields: `process`, `status`, `isProcessing` (not in design)
- Design lacks: `rankChangeElec`, `rankChangeAir` (impl-only fields)

**Impact**: MEDIUM -- Frontend may reference the wrong field names

---

#### R-02: `monitoring/energy-alert` (3.1.7) -- PARTIAL

**Design v5.1** specifies:
```
dailyElec, weeklyElec, prevDailyElec, prevWeeklyElec, dailyAir, weeklyAir, prevDailyAir, prevWeeklyAir,
prevMonthChangeElec, prevYearChangeElec, prevMonthChangeAir, prevYearChangeAir
```

**Implementation** returns:
```
facilityId, code, name, process,
prevMonthChangeElec, prevYearChangeElec, prevMonthChangeAir, prevYearChangeAir,
elecStatus, airStatus
```

**Differences**:
- Design has 8 energy fields (`dailyElec, weeklyElec, prevDailyElec, ...`) -- Impl has NONE of these
- Impl has `process` field -- not in design
- Impl has `elecStatus, airStatus` -- not in design

**Impact**: MEDIUM -- Design document lists fields that don't exist in response

---

#### R-03: `dashboard/cycle-ranking` (3.2.5) -- PARTIAL

**Design v5.1** specifies: `{facilityId, code, name, cycleEnergy, cycleTime, deviation, rank}`

**Implementation** returns: `{rank, code, process, cycleEnergy, cycleTime, deviation, status}`

**Differences**:
- Design has `facilityId, name` -- Impl does NOT return these
- Impl has `process, status` -- not in design

**Impact**: LOW -- Frontend uses `code` as primary identifier

---

#### R-04: `dashboard/energy-change-top` (3.2.8) -- PARTIAL

**Design v5.1** specifies: `{facilityId, code, name, dailyElec, weeklyElec, prevDailyElec, prevWeeklyElec, dailyAir, weeklyAir, prevDailyAir, prevWeeklyAir, prevMonthChange, prevYearChange}`

**Implementation** returns: `{code, name, prevMonthChange, prevYearChange}`

**Differences**:
- Design has 10 extra energy fields -- Impl has only `code, name, prevMonthChange, prevYearChange`
- Design has `facilityId` -- Impl does NOT return it

**Impact**: LOW -- `prevMonthChange/prevYearChange` are the core data; energy breakdown is aspirational

---

#### R-05: `alerts/cycle-anomaly/types` (3.3.6) -- PARTIAL

**Design v5.1**: `[{value: "delayed", label: "..."}, {value: "low-similarity", ...}, {value: "energy-spike", ...}]`

**Implementation**: `[{value: "NORMAL", label: "..."}, {value: "DELAYED", ...}, {value: "ANOMALY", ...}, {value: "INCOMPLETE", ...}]`

**Differences**: Design uses kebab-case descriptive values; Impl uses CycleStatus enum uppercase values. Item count differs (3 vs 4).

**Impact**: LOW -- Frontend maps these as filter values

---

#### R-06: `monitoring/overview/alarms` (3.1.4) -- PARTIAL (value format)

Design says `line: "BLOCK", "HEAD", "CRANK", "ASSEMBLE"` (line codes uppercase).
Implementation uses `l.name` (Korean line names or display labels).

**Impact**: LOW -- Field name matches, only value format differs.

---

### 3.2 DTO/Validation Gaps

#### D-01: Monitoring Controller raw `@Query` -- NOT RESOLVED

7 of 8 Monitoring endpoints still use raw `@Query('param')` instead of DTO classes:
- `getHourlyTrend(@Query('date') date?: string)`
- `getLineDetailChart(@Param('line'), @Query('date'), @Query('interval'))`
- `getEnergyRanking(@Query('line'), @Query('type'))`
- `getEnergyAlertStatus(@Query('line'))`
- `getPowerQualityRanking(@Query('line'))`
- `getAirLeakRanking(@Query('line'))`
- `getOverviewKpi()` -- no params needed

Only DynamicResolutionController uses proper DTO (`RangeQueryDto`).

**Impact**: MEDIUM -- No class-validator validation on Monitoring endpoints; only DynamicResolution gets validated.

---

#### D-02: Swagger `@ApiQuery` enum mismatch -- LOW

DSH-004 and DSH-008 controllers show `enum: ['power', 'air']` in Swagger, but DTO validates `['elec', 'air']`. Users reading Swagger docs will send `power` and get validation error.

**Impact**: LOW -- Documentation issue, not runtime behavior.

---

### 3.3 Architecture/Infrastructure Gaps

#### A-01: Test Coverage -- 5% (UNCHANGED)

All 11 spec files are skeleton tests with only `should be defined`:
```
monitoring.controller.spec.ts  -- 1 test (skeleton)
monitoring.service.spec.ts     -- 1 test (skeleton)
dashboard.controller.spec.ts   -- 1 test (skeleton)
dashboard.service.spec.ts      -- 1 test (skeleton)
alerts.controller.spec.ts      -- 1 test (skeleton)
alerts.service.spec.ts         -- 1 test (skeleton)
analysis.controller.spec.ts    -- 1 test (skeleton)
analysis.service.spec.ts       -- 1 test (skeleton)
settings.controller.spec.ts    -- 1 test (skeleton)
settings.service.spec.ts       -- 1 test (skeleton)
app.controller.spec.ts         -- 1 test (skeleton)
```

**Impact**: HIGH -- No unit test coverage for any business logic.

---

#### A-02: GlobalExceptionFilter in main.ts -- LOW

Design (Section 7) specifies GlobalExceptionFilter, which IS implemented at `common/filters/http-exception.filter.ts` and applied via `app.useGlobalFilters(new GlobalExceptionFilter())` in `main.ts`.

However, `useGlobalFilters()` in `main.ts` does not have DI context (cannot inject services). The recommended NestJS pattern is `APP_FILTER` in module providers. This is functional but architecturally suboptimal.

**Impact**: LOW -- Filter works; just not DI-aware.

---

#### A-03: SQL Injection Risk in Prisma.raw() -- INFO

Multiple services use `Prisma.raw()` with string interpolation for WHERE conditions:
- `dashboard.service.ts:27`: `AND l.code = '${line.toUpperCase()}'`
- `dashboard.service.ts:120`: Same pattern
- `alerts.service.ts:180-181`: Line and facilityCode conditions

These are controlled by frontend input (line codes, facility codes), but `Prisma.raw()` with string interpolation bypasses parameterized queries.

**Impact**: INFO -- Controlled inputs, but technically a SQL injection vector.

---

## 4. Score Calculation (v5.1)

### 4.1 Category Scores

| Category | Weight | v5.0 Score | v5.1 Score | Delta | Notes |
|----------|:------:|:---------:|:---------:|:-----:|-------|
| Endpoint Coverage | 15% | 100% | 100% | 0 | 77/77 all implemented |
| Endpoint URL Match | 10% | 100% | 100% | 0 | All URLs match |
| Response Format Match | 25% | 86% | 92% | +6 | 4 MISMATCH resolved, 6 PARTIAL remain |
| Request/Param Match | 10% | 88% | 97% | +9 | F-01/F-02 resolved, D-02 swagger minor |
| DTO/Validation | 10% | 85% | 85% | 0 | D-01 still unresolved |
| Error Handling | 5% | 78% | 78% | 0 | No change |
| Test Coverage | 10% | 5% | 5% | 0 | All skeleton |
| Convention Compliance | 10% | 90% | 90% | 0 | No change |
| Architecture | 5% | 85% | 85% | 0 | No change |

### 4.2 Response Format Match Detail (v5.1)

| Status | v5.0 Count | v5.1 Count | Delta |
|--------|:---------:|:---------:|:-----:|
| EXACT MATCH | 60 | 71 | +11 |
| PARTIAL | 13 | 6 | -7 |
| MISMATCH | 4 | 0 | -4 |
| **Total** | **77** | **77** | -- |

**Remaining 6 PARTIAL endpoints**:
1. R-01: `monitoring/energy-ranking` -- field name differences (rankElec vs rankDailyElec)
2. R-02: `monitoring/energy-alert` -- missing dailyElec/weeklyElec fields in impl
3. R-03: `dashboard/cycle-ranking` -- missing facilityId/name in impl
4. R-04: `dashboard/energy-change-top` -- missing energy breakdown fields in impl
5. R-05: `alerts/cycle-anomaly/types` -- different value format and count
6. R-06: `monitoring/overview/alarms` -- line value format (name vs code)

### 4.3 Overall Score Calculation

```
Overall = Sum(Category * Weight)

= (100% * 0.15) + (100% * 0.10) + (92% * 0.25) + (97% * 0.10)
  + (85% * 0.10) + (78% * 0.05) + (5% * 0.10) + (90% * 0.10) + (85% * 0.05)

= 15.0 + 10.0 + 23.0 + 9.7 + 8.5 + 3.9 + 0.5 + 9.0 + 4.25

= 83.85%

Rounded: 84%
```

---

## 5. Score Summary

| Metric | v4.0 | v5.0 | v5.1 | Target |
|--------|:----:|:----:|:----:|:------:|
| **Overall Score** | **77%** | **82%** | **84%** | 90% |
| Response Format Match | 52% | 86% | 92% | 95% |
| Request Match | 75% | 88% | 97% | 95% |
| Test Coverage | 5% | 5% | 5% | 50% |
| MISMATCH Count | 20+ | 4 | 0 | 0 |
| PARTIAL Count | 25+ | 13 | 6 | 0 |

### Score Progress

```
v1.0  62% [============================                          ] CRITICAL
v2.0  68% [================================                      ] WARN
v3.0  71% [==================================                    ] WARN
v4.0  77% [======================================                ] WARN
v5.0  82% [=========================================             ] WARN
v5.1  84% [==========================================            ] WARN
Target 90% [=============================================         ] OK
```

---

## 6. Gap to 90%: Action Plan

### 6.1 Quick Wins (+4%p, ~2 hours)

| Action | Impact | Effort |
|--------|:------:|:------:|
| Fix R-01: Update design doc `energy-ranking` response to match impl fields | +1%p | 15 min |
| Fix R-02: Update design doc `energy-alert` response to remove non-existent fields | +1%p | 15 min |
| Fix R-03: Update design doc `cycle-ranking` to match impl fields | +0.5%p | 10 min |
| Fix R-04: Update design doc `energy-change-top` to match impl fields | +0.5%p | 10 min |
| Fix R-05: Update design doc `cycle-anomaly/types` to match CycleStatus enum | +0.5%p | 10 min |
| Fix R-06: Update design doc `overview/alarms` line value description | +0.5%p | 10 min |
| **Subtotal** | **+4%p** | **~70 min** |

### 6.2 Medium Effort (+3%p, ~4 hours)

| Action | Impact | Effort |
|--------|:------:|:------:|
| D-01: Create Monitoring DTOs for 6 endpoints (line-query, energy-ranking-query, etc.) | +1.5%p | 2 hrs |
| D-02: Fix Swagger `@ApiQuery` enum to `['elec', 'air']` for DSH-004/DSH-008 | +0.5%p | 15 min |
| Basic unit tests: 2-3 tests per service (response structure, error cases) | +1%p | 2 hrs |
| **Subtotal** | **+3%p** | **~4.5 hrs** |

### 6.3 Summary to Reach 90%

```
Current:    84%
Quick Wins: +4%p  (design doc corrections for 6 PARTIAL endpoints)
Medium:     +3%p  (DTOs + Swagger fix + basic tests)
---------
Projected:  91%   (exceeds 90% target)
Total Time: ~6.5 hours
```

---

## 7. Detailed Endpoint Verification Matrix (77 APIs)

### 7.1 Monitoring API (11 endpoints)

| # | Endpoint | URL | Params | Response | Overall |
|---|----------|:---:|:------:|:--------:|:-------:|
| 1 | GET monitoring/overview/kpi | EXACT | EXACT | EXACT | EXACT |
| 2 | GET monitoring/overview/lines | EXACT | EXACT | EXACT | EXACT |
| 3 | GET monitoring/overview/hourly | EXACT | EXACT | EXACT | EXACT |
| 4 | GET monitoring/overview/alarms | EXACT | EXACT | PARTIAL (R-06) | PARTIAL |
| 5 | GET monitoring/line/:line | EXACT | EXACT | EXACT | EXACT |
| 6 | GET monitoring/energy-ranking | EXACT | EXACT | PARTIAL (R-01) | PARTIAL |
| 7 | GET monitoring/energy-alert | EXACT | EXACT | PARTIAL (R-02) | PARTIAL |
| 8 | GET monitoring/power-quality | EXACT | EXACT | EXACT | EXACT |
| 9 | GET monitoring/air-leak | EXACT | EXACT | EXACT | EXACT |
| 10 | GET facilities/:id/power/range | EXACT | EXACT | EXACT | EXACT |
| 11 | GET facilities/:id/air/range | EXACT | EXACT | EXACT | EXACT |

**Monitoring Score**: 8/11 EXACT = **73%**

### 7.2 Dashboard API (9 endpoints)

| # | Endpoint | URL | Params | Response | Overall |
|---|----------|:---:|:------:|:--------:|:-------:|
| 1 | GET dashboard/energy-trend | EXACT | EXACT | EXACT | EXACT |
| 2 | GET dashboard/facility-trend | EXACT | EXACT | EXACT | EXACT |
| 3 | GET dashboard/usage-distribution | EXACT | EXACT | EXACT | EXACT |
| 4 | GET dashboard/process-ranking | EXACT | EXACT | EXACT | EXACT |
| 5 | GET dashboard/cycle-ranking | EXACT | EXACT | PARTIAL (R-03) | PARTIAL |
| 6 | GET dashboard/power-quality-ranking | EXACT | EXACT | EXACT | EXACT |
| 7 | GET dashboard/air-leak-ranking | EXACT | EXACT | EXACT | EXACT |
| 8 | GET dashboard/energy-change-top | EXACT | EXACT | PARTIAL (R-04) | PARTIAL |
| 9 | GET dashboard/facilities | EXACT | EXACT | EXACT | EXACT |

**Dashboard Score**: 7/9 EXACT = **78%**

### 7.3 Alerts API (7 endpoints)

| # | Endpoint | URL | Params | Response | Overall |
|---|----------|:---:|:------:|:--------:|:-------:|
| 1 | GET alerts/stats/kpi | EXACT | EXACT | EXACT | EXACT |
| 2 | GET alerts/stats/trend | EXACT | EXACT | EXACT | EXACT |
| 3 | GET alerts/stats/heatmap | EXACT | EXACT | EXACT | EXACT |
| 4 | GET alerts/history | EXACT | EXACT | EXACT | EXACT |
| 5 | PATCH alerts/:id/action | EXACT | EXACT | EXACT | EXACT |
| 6 | GET alerts/cycle-anomaly/types | EXACT | EXACT | PARTIAL (R-05) | PARTIAL |
| 7 | GET alerts/:id/waveform | EXACT | EXACT | EXACT | EXACT |

**Alerts Score**: 6/7 EXACT = **86%**

### 7.4 Analysis API (7 endpoints)

| # | Endpoint | URL | Params | Response | Overall |
|---|----------|:---:|:------:|:--------:|:-------:|
| 1 | GET analysis/facilities/tree | EXACT | EXACT | EXACT | EXACT |
| 2 | GET analysis/facility/hourly | EXACT | EXACT | EXACT | EXACT |
| 3 | GET analysis/comparison/detailed | EXACT | EXACT | EXACT | EXACT |
| 4 | GET analysis/cycles | EXACT | EXACT | EXACT | EXACT |
| 5 | GET analysis/cycle/waveform | EXACT | EXACT | EXACT | EXACT |
| 6 | GET analysis/cycle/delay | EXACT | EXACT | EXACT | EXACT |
| 7 | GET analysis/power-quality | EXACT | EXACT | EXACT | EXACT |

**Analysis Score**: 7/7 EXACT = **100%**

### 7.5 Settings API (43 endpoints)

All 43 Settings endpoints verified as EXACT in v5.0 analysis. No changes in v5.1.

**Settings Score**: 43/43 EXACT = **100%**

---

## 8. Comparison with Expected Improvement

| Metric | Expected (User) | Actual (Measured) | Delta |
|--------|:---------------:|:-----------------:|:-----:|
| Response Format Match | 94% | 92% | -2%p |
| Request Match | 93% | 97% | +4%p |
| Overall Score | 88% | 84% | -4%p |

**Analysis**: The expected overall of 88% was optimistic because:
1. The 4 MISMATCH fixes were verified as resolved (+6%p Response Format)
2. However, 6 PARTIAL items remain that were NOT addressed by the v5.1 markers
3. Test coverage (5%) and DTO validation gap (85%) continue to weigh heavily on the overall score
4. The weighting system penalizes the Test Coverage category (10% weight at 5% score = only 0.5 contribution)

---

## 9. Recommendations

### 9.1 Immediate (before next iteration)

1. **Update design doc for 6 remaining PARTIAL endpoints** (R-01 through R-06)
   - Align `energy-ranking` response to actual `rankElec/rankAir/rankChangeElec/rankChangeAir` fields
   - Remove non-existent `dailyElec/weeklyElec` from `energy-alert` response
   - Update `cycle-ranking` to show actual `{rank, code, process, ...}` without `facilityId/name`
   - Simplify `energy-change-top` to actual `{code, name, prevMonthChange, prevYearChange}`
   - Update `cycle-anomaly/types` to use CycleStatus enum values
   - Clarify `overview/alarms` uses `l.name` not `l.code`

2. **Fix Swagger enum** in dashboard controller: Change `['power', 'air']` to `['elec', 'air']`

### 9.2 Short-term (1-2 days)

3. **Create Monitoring DTO classes** for validation:
   - `LineQueryDto` (line: string)
   - `EnergyRankingQueryDto` (line: string, type: 'power' | 'air')
   - `DateQueryDto` (date?: string)

4. **Add basic unit tests** (10-15 tests):
   - MonitoringService: getOverviewKpi returns correct structure
   - DashboardService: getEnergyTrend returns 7-day array
   - AlertsService: getAlertStatsKpi returns {total, weekly, weeklyChange, resolved, resolvedRate}
   - AnalysisService: getFacilityTree returns nested structure

### 9.3 Medium-term (3-5 days)

5. **Comprehensive test coverage** to reach 50%+ (currently 5%)
6. **APP_FILTER migration**: Move GlobalExceptionFilter from `main.ts` to Module provider for DI access
7. **Parameterized queries**: Replace `Prisma.raw()` string interpolation with parameterized alternatives

---

## 10. Version History

| Version | Date | Score | Key Change |
|---------|------|:-----:|------------|
| v1.0 | 2026-02-20 | 62% | Initial analysis |
| v2.0 | 2026-02-28 | 68% | First iteration fixes |
| v3.0 | 2026-02-28 | 71% | Second iteration fixes |
| v4.0 | 2026-02-28 | 77% | Third iteration (DTO + endpoints) |
| v5.0 | 2026-02-28 | 82% | Design document v5.0 rewrite (77 APIs) |
| v5.1 | 2026-02-28 | 84% | 19 discrepancy fixes (4 MISMATCH + 13 PARTIAL + 2 params) |

---

**Next Target**: v5.2 -- Fix 6 remaining PARTIAL items in design doc + Monitoring DTOs (projected: 91%)

**File Locations**:
- Design Document: `d:\AI_PJ\IFEMS\docs\02-design\features\backend-api.design.md`
- Implementation: `d:\AI_PJ\IFEMS\apps\api\src\`
- This Report: `d:\AI_PJ\IFEMS\docs\03-analysis\ifems-backend-api-v5.1.analysis.md`
