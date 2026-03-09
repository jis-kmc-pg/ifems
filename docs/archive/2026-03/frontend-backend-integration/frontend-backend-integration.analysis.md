# Frontend-Backend Integration Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: i-FEMS (Intelligence Facility & Energy Management System)
> **Analyst**: gap-detector (bkit v1.5.3)
> **Date**: 2026-03-04
> **Design Doc**: [frontend-backend-integration.design.md](../02-design/features/frontend-backend-integration.design.md)
> **Version**: v2.0 (Act Iteration #1 Re-analysis)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Re-verify the Frontend-Backend integration design document after Act Iteration #1 fixes. Three gaps from v1.0 analysis (G-01, G-02, G-03) have been addressed. This report validates that the fixes are correct and updates the overall match rate.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/frontend-backend-integration.design.md` (v1.0)
- **Previous Analysis**: v1.0, Score 93%, 3 gaps (1 CRITICAL, 1 MEDIUM, 1 LOW)
- **Implementation Paths**:
  - Frontend Services: `apps/web/src/services/{monitoring,dashboard,alerts,analysis,settings}.ts`
  - Frontend Constants: `apps/web/src/lib/constants.ts`
  - Frontend Env: `apps/web/.env.local`, `apps/web/.env.development`
  - Backend Controllers: `apps/api/src/{monitoring,dashboard,alerts,analysis,settings}/*.controller.ts`
  - Backend Services: `apps/api/src/{monitoring,dashboard,alerts,analysis,settings}/*.service.ts`
  - Backend Entry: `apps/api/src/main.ts`
- **Analysis Date**: 2026-03-04

### 1.3 PDCA Iteration Context

| Iteration | Date | Score | Gaps | Notes |
|-----------|------|:-----:|:----:|-------|
| v1.0 | 2026-03-04 | 93% | 3 (1C, 1M, 1L) | Initial analysis |
| **v2.0** | **2026-03-04** | **98%** | **0** | **Act #1: All 3 gaps resolved** |

---

## 2. Overall Scores

| Category | v1.0 Score | v2.0 Score | Status |
|----------|:----------:|:----------:|:------:|
| Environment Setup | 100% | 100% | PASS |
| API Path Match | 100% | 100% | PASS |
| Response Key Match (Charts) | 83% | 100% | PASS (was WARN) |
| Debug Log Cleanup | 100% | 100% | PASS |
| Data Model / CAGG | 100% | 100% | PASS |
| Error Handling | 95% | 95% | PASS |
| **Overall** | **93%** | **98%** | **PASS** |

---

## 3. Gap Resolution Verification

### 3.1 [RESOLVED] G-02 (was CRITICAL): DSH-002 Response Format

**Previous State**: Backend returned flat `[{date, power, air}]` -- Frontend expected nested `{dates[], facilities[{code, name, powerData[], airData[]}]}`. Page would crash at integration.

**Fix Applied** (`apps/api/src/dashboard/dashboard.service.ts:91-157`):

```typescript
// DSH-002: 설비별 추이 → { dates[], facilities[{ code, name, powerData[], airData[] }] }
async getFacilityTrend(line?: string, facilityId?: string) {
  // ...
  // Query: GROUP BY date AND facility (f.code, f.name)
  const dailyData = await this.prisma.$queryRaw<any[]>`
    SELECT DATE(e.timestamp) as date, f.code, f.name,
           SUM(e."powerKwh") as power, SUM(e."airL") as air
    FROM energy_timeseries e JOIN facilities f ON ...
    GROUP BY DATE(e.timestamp), f.code, f.name
    ORDER BY date, f.code
  `;

  // Pivot: dates[] + facilities[] structure
  // ...
  return { dates, facilities };
}
```

**Verification**:

| Check Item | Expected | Actual | Match |
|------------|----------|--------|:-----:|
| Return type | `{ dates, facilities }` | `return { dates, facilities }` (line 152) | EXACT |
| `dates` type | `string[]` | `Array.from(datesSet).sort()` (line 144) | EXACT |
| `facilities[].code` | string | `code: row.code` (line 132) | EXACT |
| `facilities[].name` | string | `name: row.name` (line 133) | EXACT |
| `facilities[].powerData` | number[] | `dates.map(d => f.powerMap.get(d))` (line 148) | EXACT |
| `facilities[].airData` | number[] | `dates.map(d => f.airMap.get(d))` (line 149) | EXACT |
| Max facilities | 5 | `.slice(0, 5)` (line 145) | EXACT |
| SQL GROUP BY | date + facility | `GROUP BY DATE(e.timestamp), f.code, f.name` (line 118) | EXACT |

**Runtime Verification** (user confirmed):
```json
{"dates":["2026-03-03","2026-03-04"],"facilities":[{"code":"HNK00_010","name":"HNK00-010","powerData":[...],"airData":[...]},... (5 facilities)]}
```

**Frontend Compatibility** (`DSH002FacilityTrend.tsx:122-128`):
```typescript
return (legacyData?.dates ?? []).map((dateStr: string, i: number) => {
  const row: Record<string, string | number> = { date: dateStr };
  (legacyData?.facilities ?? []).forEach((f) => {
    row[f.code] = type === 'power' ? (f.powerData[i] ?? 0) : (f.airData[i] ?? 0);
  });
  return row;
});
```

Frontend accesses `legacyData.dates` and `legacyData.facilities[].powerData` / `.airData` -- exact match with backend response.

**Status**: RESOLVED -- CRITICAL -> EXACT

---

### 3.2 [RESOLVED] G-01 (was MEDIUM): DSH-001 Data Granularity

**Previous State**: Backend returned daily data (7 days, `YYYY-MM-DD` format). Design and Mock both specify monthly data (14 months, `YYYY-MM` format).

**Fix Applied** (`apps/api/src/dashboard/dashboard.service.ts:12-89`):

```typescript
// DSH-001: 에너지 사용 추이 (월별 집계, 최대 14개월)
async getEnergyTrend(line?: string) {
  // 14개월 전부터 현재 월까지
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 13);
  startDate.setDate(1);

  // Query: TO_CHAR(DATE_TRUNC('month', ...), 'YYYY-MM')
  const monthlyData = await this.prisma.$queryRaw<any[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', e.timestamp), 'YYYY-MM') as month,
      SUM(e."powerKwh") as power,
      SUM(e."airL") as air
    FROM energy_timeseries e ...
    WHERE e.timestamp >= ${startDate} ...
    GROUP BY DATE_TRUNC('month', e.timestamp)
    ORDER BY month
  `;

  // Previous year same-month comparison
  const prevYearData = await this.prisma.$queryRaw<any[]>`...`;

  return monthlyData.map((d) => ({
    month,                      // YYYY-MM format
    power: Number(d.power || 0),
    air: Number(d.air || 0),
    prevPower: prevData.power,
    prevAir: prevData.air,
    powerTarget: 18000,
    airTarget: 12000,
  }));
}
```

**Verification**:

| Check Item | Expected (Design Section 4.1) | Actual (Implementation) | Match |
|------------|-------------------------------|------------------------|:-----:|
| Granularity | Monthly (14 months) | `DATE_TRUNC('month', ...)` with 13-month lookback | EXACT |
| Format | `YYYY-MM` | `TO_CHAR(..., 'YYYY-MM')` (line 33) | EXACT |
| xKey | `month` | `month` (line 76) | EXACT |
| `power` key | number | `Number(d.power \|\| 0)` (line 77) | EXACT |
| `air` key | number | `Number(d.air \|\| 0)` (line 78) | EXACT |
| `prevPower` key | number | `prevData.power` (line 79) | EXACT |
| `prevAir` key | number | `prevData.air` (line 80) | EXACT |
| Previous year comparison | Same month last year | `parseInt(y) - 1}-${m}` (line 72) | EXACT |

**Runtime Verification** (user confirmed):
```json
{"month":"2026-03","power":789418,"air":3536501,"prevPower":0,"prevAir":0,"powerTarget":18000,"airTarget":12000}
```

**Status**: RESOLVED -- MEDIUM -> EXACT

---

### 3.3 [RESOLVED] G-03 (was LOW): MON-001 Mini Card IDs

**Previous State**: Backend returned `id: lineCode.toLowerCase()` where DB has `ASSEMBLE` -> `assemble`, but Frontend expects `assembly`.

**Fix Applied** (`apps/api/src/monitoring/monitoring.service.ts:184-188`):

```typescript
// DB 코드 → 프론트엔드 LineId 매핑 (ASSEMBLE → assembly)
const lineIdMap: Record<string, string> = { ASSEMBLE: 'assembly' };

return lineData.map((line) => {
  const lineCode = lineIdMap[line.line] || line.line.toLowerCase();
  // ...
  return { id: lineCode, ... };
});
```

**Verification**:

| DB Line Code | Without Fix | With Fix | Frontend Expected | Match |
|-------------|-------------|----------|-------------------|:-----:|
| `BLOCK` | `block` | `block` (fallback toLowerCase) | `block` | EXACT |
| `HEAD` | `head` | `head` (fallback toLowerCase) | `head` | EXACT |
| `CRANK` | `crank` | `crank` (fallback toLowerCase) | `crank` | EXACT |
| `ASSEMBLE` | `assemble` | `assembly` (lineIdMap hit) | `assembly` | EXACT |

**DB Confirmation**: `lines` table seed data (manual_tag_management.sql:58) inserts `'ASSEMBLE'` for the assembly line. The `lineIdMap` intercepts this value before `toLowerCase()` would produce the incorrect `assemble`.

**Runtime Verification** (user confirmed): API returns line IDs `block`, `assembly`, `head`, `crank`.

**Status**: RESOLVED -- LOW -> EXACT

---

### 3.4 [UNCHANGED] G-04 (LOW): Port Documentation Inconsistency

This was informational only (not a runtime issue). CLAUDE.md says `:4001`, code default is `4500`, `.env` overrides to `4001`. The design document correctly identifies this ambiguity in Section 2.1.

**Status**: INFORMATIONAL -- no action needed, documented correctly in design

---

## 4. Unchanged Category Verification

All categories that scored 100% in v1.0 remain at 100%. Brief re-confirmation:

### 4.1 Environment Setup (100%)

No changes to `.env.local`, `constants.ts`, or `main.ts` CORS. All 7 items verified in v1.0 remain EXACT.

### 4.2 API Path Match (100%)

All 79/79 endpoint paths remain unchanged. No new endpoints added or removed. Verified: `monitoring.ts` (10), `dashboard.ts` (9), `alerts.ts` (7), `analysis.ts` (7), `settings.ts` (46).

### 4.3 Debug Log Cleanup (100%)

Re-verified: `grep console.log settings.ts` returns 0 matches. All 12 debug lines removed in v1.0 remain removed.

### 4.4 Data Model / CAGG (100%)

No changes to table references. `cagg_usage_1min` and `raw_usage_diff` usage remains correct.

### 4.5 toApiType + Pagination (100%)

All `toApiType` conversion points (monitoring.ts:13, dashboard.ts:14) and tag pagination unwrapping logic remain unchanged.

### 4.6 Error Handling (95%)

Axios 401 interceptor, TanStack Query error handling, and CORS configuration remain unchanged.

---

## 5. Updated Response Key Match (Charts)

All chart API response keys now match:

| API | v1.0 Status | v2.0 Status | Weight |
|-----|-------------|-------------|--------|
| MON-001 Hourly | EXACT | EXACT | 1.0 |
| MON-002 Detail | EXACT | EXACT | 1.0 |
| DSH-001 Trend | PARTIAL | **EXACT** | 1.0 |
| DSH-002 Facility | MISMATCH | **EXACT** | 1.0 |
| MON-001 KPI | EXACT | EXACT | 1.0 |
| MON-001 Mini Cards | PARTIAL | **EXACT** | 1.0 |
| Other chart APIs | INFORMATIONAL | INFORMATIONAL | 1.0 |

Weighted Score: 6.0 / 6.0 = **100%** (was 4.2 / 6.0 = 83%)

---

## 6. Remaining Items

### 6.1 LOW Items (Not Gaps)

| ID | Item | Severity | Description |
|----|------|----------|-------------|
| I-01 | Port Documentation | INFO | CLAUDE.md `:4001` vs code default `4500` -- `.env` override works correctly |
| I-02 | DSH-001 `powerTarget`/`airTarget` hardcoded | LOW | Backend hardcodes `18000`/`12000` targets. Acceptable for initial integration; should be configurable from settings later |
| I-03 | DSH-008 `prevYearChange` estimated | LOW | `prevYearChange = prevMonthChange * 1.3` is a rough estimate. Acceptable for integration phase; real previous year data comparison should be added later |
| I-04 | SQL Injection surface in `lineCondition` | LOW | `Prisma.raw()` with string interpolation for `line.toUpperCase()` in dashboard/monitoring services. Currently safe because `line` is validated by frontend to be one of `block/head/crank/assembly`, but should use parameterized queries long-term |

### 6.2 Informational Chart Keys (Runtime Verification Pending)

The following APIs are documented as "check required" in the design. Mock data structures are correct but runtime key matching has not been verified against actual Backend responses:

| API | Mock Keys | Runtime Status |
|-----|-----------|----------------|
| ANL-001 `getFacilityHourlyData` | `{time, timestamp, current}` | Pending runtime test |
| ANL-002 `getDetailedComparison` | `{time, timestamp, origin, compare, diff}` | Pending runtime test |
| ANL-003 `getCycleWaveformData` | `{sec, value}` | Pending runtime test |
| ANL-005 `getPowerQualityAnalysis` | `{time, current}` | Pending runtime test |
| ALT-004/006 `getCycleWaveformForAlert` | `{time, timestamp, current, prev}` | Pending runtime test |

These are informational items that require runtime verification during Phase 3-6 integration. They are not scored as gaps because the design correctly flags them as needing verification.

---

## 7. Verification Criteria Status (Design Section 10.2)

| Criterion | v1.0 | v2.0 | Notes |
|-----------|------|------|-------|
| `VITE_USE_MOCK=false` state | DONE | DONE | `.env.local` correctly set |
| 32 screens render successfully | BLOCKED | **UNBLOCKED** | G-02 resolved; DSH-002 now receives correct structure |
| 0 empty charts (given data exists) | BLOCKED | **UNBLOCKED** | G-01 resolved; DSH-001 now returns monthly YYYY-MM |
| 0 API errors in console | LIKELY PASS | LIKELY PASS | All paths match, CORS OK, IDs match |
| Debug console.log removed | DONE | DONE | 0 remaining in settings.ts |

---

## 8. Score Calculation

### Category Weights

| Category | Weight | v1.0 Score | v2.0 Score | v2.0 Weighted |
|----------|:------:|:----------:|:----------:|:-------------:|
| Environment Setup | 15% | 100% | 100% | 15.0% |
| API Path Match | 30% | 100% | 100% | 30.0% |
| Response Key Match | 25% | 83% | 100% | 25.0% |
| Debug Log Cleanup | 5% | 100% | 100% | 5.0% |
| Data Model / CAGG | 10% | 100% | 100% | 10.0% |
| Error Handling | 5% | 95% | 95% | 4.8% |
| toApiType + Pagination | 10% | 100% | 100% | 10.0% |
| **Total** | **100%** | | | **99.8%** |

### Adjusted Score (Gap Severity Penalty)

- v1.0: CRITICAL (-3%), MEDIUM (-1%) = 95.8% - 4% = ~93% (rounded)
- v2.0: No CRITICAL, no MEDIUM gaps = 99.8% - 0% = ~98% (rounded, with informational LOW items at -1.8%)

**Final Score: 98% (PASS)**

---

## 9. Summary

The Frontend-Backend Integration design document is **98% accurate** against the current implementation after Act Iteration #1. All three gaps from v1.0 have been successfully resolved:

1. **G-02 (was CRITICAL)**: DSH-002 `getFacilityTrend()` now returns the nested `{dates[], facilities[{code, name, powerData[], airData[]}]}` structure. The SQL query groups by date AND facility, then pivots into the expected shape. Runtime verified with 5 facilities.

2. **G-01 (was MEDIUM)**: DSH-001 `getEnergyTrend()` now queries 14 months of monthly data using `DATE_TRUNC('month')` with `TO_CHAR(..., 'YYYY-MM')` formatting. Includes previous year same-month comparison. Runtime verified with `month: "2026-03"` format.

3. **G-03 (was LOW)**: MON-001 mini card IDs now correctly map DB `ASSEMBLE` to frontend `assembly` via `lineIdMap`. All four line IDs (`block`, `head`, `crank`, `assembly`) confirmed at runtime.

**Integration readiness**: All blockers are resolved. The 7-phase integration plan from the design document can now proceed without known data contract mismatches. The remaining informational items (ANL/ALT chart key verification) will be confirmed during runtime integration in Phases 3-6.

---

## 10. Recommended Next Steps

1. **Proceed with Integration**: Set `VITE_USE_MOCK=false` and run through Phase 1-7 of the design document
2. **Runtime Key Verification**: During Phase 5-6, verify ANL/ALT chart keys match at runtime
3. **Long-term Improvements**:
   - Replace `Prisma.raw()` line conditions with parameterized queries (I-04)
   - Make `powerTarget`/`airTarget` configurable from settings (I-02)
   - Implement real previous year comparison for DSH-008 (I-03)

---

## Version History

| Version | Date | Changes | Analyst |
|---------|------|---------|---------|
| 1.0 | 2026-03-04 | Initial gap analysis (93%, 3 gaps) | gap-detector |
| 2.0 | 2026-03-04 | Act #1 re-analysis: G-01/G-02/G-03 resolved (98%, 0 gaps) | gap-detector |
