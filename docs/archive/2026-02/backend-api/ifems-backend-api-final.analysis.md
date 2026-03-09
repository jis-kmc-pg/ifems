# i-FEMS Backend API Final Gap Analysis Report (v3.0)

> **Analysis Type**: Gap Analysis (Design vs Implementation) - Post-Fix Verification
>
> **Project**: i-FEMS (Intelligence Facility & Energy Management System)
> **Version**: v3.0 (final verification after 7 claimed fixes)
> **Analyst**: Claude Code (gap-detector)
> **Date**: 2026-02-28
> **Previous Report**: `ifems-backend-api-74.analysis.md` (v1.0, Score: 68%)
> **Design Doc**: `docs/02-design/features/backend-api.design.md`
> **Implementation Path**: `apps/api/src/`

---

## 1. Fix Verification Results

### 1.1 C-01: GlobalExceptionFilter -- VERIFIED

| Item | Status |
|------|--------|
| File created | `common/filters/http-exception.filter.ts` EXISTS |
| Class implements `ExceptionFilter` | YES (`@Catch()` decorator, implements `ExceptionFilter`) |
| Handles HttpException | YES (line 24-33: extracts status + message) |
| Handles generic Error | YES (line 34-37: logs stack trace) |
| Handles unknown exception | YES (line 38-41: String(exception)) |
| Standard response format | YES: `{ statusCode, timestamp, path, method, message, error }` |
| Dev stack trace | YES (line 53-55: includes stack in non-production) |
| Severity-based logging | YES (500+ error, 400+ warn) |
| Registered in main.ts | YES (line 26: `app.useGlobalFilters(new GlobalExceptionFilter())`) |

**Verdict**: FULLY RESOLVED. Exceeds design spec (design had basic filter; implementation adds Logger, severity-based logging, dev stack traces, method field).

---

### 1.2 C-02: AlertsService uses alerts table -- PARTIALLY RESOLVED

| Method | Table Used | Status |
|--------|-----------|--------|
| `getAlertStatsKpi()` | `prisma.alert.count()` (line 24, 35, 47) | DB QUERY (alerts table) |
| `getAlertTrend()` | `energy_timeseries` (line 81-91) | STILL USES energy_timeseries |
| `getAlertHeatmap()` | `energy_timeseries` (line 117-128) | STILL USES energy_timeseries |
| `getAlertHistory()` | `energy_timeseries` (line 184-206) | STILL USES energy_timeseries |
| `saveAlertAction()` | `prisma.alert.update()` (line 260-267) | DB QUERY (alerts table) |
| `getCycleWaveformForAlert()` | Math.random() generated (line 292-293) | NO DB QUERY |

**Verdict**: PARTIALLY RESOLVED. `getAlertStatsKpi()` and `saveAlertAction()` now correctly use the alerts table. However, `getAlertTrend()`, `getAlertHeatmap()`, and `getAlertHistory()` still query `energy_timeseries` instead of `alerts`. The `getCycleWaveformForAlert()` still uses Math.random().

---

### 1.3 C-03: CycleData/ReferenceCycle tables used -- VERIFIED

| Method | Table Used | Status |
|--------|-----------|--------|
| `getCycleList()` (analysis.service.ts:175) | `prisma.cycleData.findMany()` | DB QUERY |
| `getCycleWaveform()` (analysis.service.ts:220-234) | `prisma.referenceCycle.findUnique()` + `prisma.cycleData.findUnique()` | DB QUERY |
| `getCycleDelay()` (analysis.service.ts:270) | `prisma.cycleData.findUnique()` with facility+referenceCycle include | DB QUERY |
| `getCycleRanking()` (dashboard.service.ts:301) | `prisma.cycleData.findMany()` | DB QUERY |
| `getReferenceCycles()` (settings.service.ts:76-82) | `prisma.facility.findMany({ include: { referenceCycle: true } })` | DB QUERY |

**Verdict**: FULLY RESOLVED. All cycle-related methods now query CycleData and ReferenceCycle tables. The dashboard's `getCycleRanking()` also uses `prisma.cycleData.findMany()` for actual statistics.

---

### 1.4 C-04: saveThresholdSettings() actual DB save -- NOT RESOLVED

**File**: `settings.service.ts` line 48-68

```typescript
async saveThresholdSettings(category: string, rows: any[]) {
    // ...
    const updatePromises = rows.map((row) => {
        // facility 테이블에 임계값 필드가 없으므로, metadata JSON 필드를 사용하거나
        // 별도 테이블이 필요함. 현재는 메모리에 저장된 것으로 간주하고 성공 응답 반환
        this.logger.debug(`Threshold for ${row.code}: ${row.threshold1}, ${row.threshold2}`);
        return Promise.resolve({ facilityId: row.facilityId, updated: true }); // <-- NO DB WRITE
    });
    await Promise.all(updatePromises);
    return { success: true, count: rows.length, message: 'Threshold settings saved successfully' };
}
```

**Verdict**: NOT RESOLVED. The method still returns `Promise.resolve()` without any Prisma write operation. The comment explicitly states "현재는 메모리에 저장된 것으로 간주" (currently assumed stored in memory). No `threshold_settings` table exists, and no `prisma.update()` is called.

---

### 1.5 C-05: saveAlertAction() actual DB update -- VERIFIED

**File**: `alerts.service.ts` line 256-273

```typescript
async saveAlertAction(id: string, action: string, actionBy?: string) {
    const updatedAlert = await this.prisma.alert.update({
        where: { id },
        data: {
            actionTaken: action,
            actionTakenBy: actionBy || 'system',
            actionTakenAt: new Date(),
        },
    });
    return { success: true, id, action, updatedAt: updatedAlert.updatedAt };
}
```

**Verdict**: FULLY RESOLVED. Uses `prisma.alert.update()` with proper fields (actionTaken, actionTakenBy, actionTakenAt). Returns actual DB response.

---

### 1.6 Math.random() removal -- PARTIALLY RESOLVED

| Previous Location | Current Status | Details |
|-------------------|---------------|---------|
| dashboard.service.ts L235-236 (prevPower/prevAir) | RESOLVED | Now queries actual previous day data via separate SQL query (line 235-247) |
| dashboard.service.ts L272,278 (cycleTime/deviation) | RESOLVED | Now uses `prisma.cycleData.findMany()` for actual statistics (line 301-318) |
| alerts.service.ts L48 (weeklyChange) | RESOLVED | Now calculates from actual `prisma.alert.count()` comparison (line 35-43) |
| alerts.service.ts L266-267 (waveform) | NOT RESOLVED | `getCycleWaveformForAlert()` line 292-293: `Math.random()` still used |
| analysis.service.ts L186 (similarity) | NOT RESOLVED | `getCycleList()` line 192-194: `Math.random()` still used for similarity |
| analysis.service.ts L213 (waveform) | NOT RESOLVED | `generateDefaultWaveform()` line 258: `Math.random()` used as fallback |
| analysis.service.ts L238-239 (delay similarity) | NOT RESOLVED | `getCycleDelay()` line 287-289: `Math.random()` still used for similarity |
| settings.service.ts L75-76 (energy/cycleTime) | RESOLVED | Now uses `calculateWaveformEnergy()` and actual `referenceCycle.duration` (line 87-88) |

**Summary**: 4/8 resolved, 4/8 remaining.

Remaining Math.random() locations in service files (excluding data-collection which is legitimate mock data generation):

| File | Line | Context | Severity |
|------|------|---------|----------|
| `alerts.service.ts` | 292-293 | Waveform noise generation | MEDIUM |
| `analysis.service.ts` | 192-194 | Cycle similarity estimation | MEDIUM |
| `analysis.service.ts` | 258 | Default waveform fallback | LOW (fallback only) |
| `analysis.service.ts` | 287-289 | Cycle delay similarity | MEDIUM |

---

### 1.7 DTO/Type Safety improvements -- VERIFIED (NEW)

| Module | DTO File | Classes | Used in Controller? |
|--------|----------|---------|:-------------------:|
| Dashboard | `dashboard/dto/dashboard-query.dto.ts` | DashboardQueryDto, FacilityTrendQueryDto, UsageDistributionQueryDto, ProcessRankingQueryDto, EnergyChangeQueryDto (5 classes) | NO - Controller uses raw `@Query()` params |
| Alerts | `alerts/dto/alerts-query.dto.ts` | AlertCategoryDto, AlertHistoryQueryDto, SaveAlertActionDto (3 classes) | NO - Controller uses raw `@Query()` and `@Body()` |
| Analysis | `analysis/dto/analysis-query.dto.ts` | FacilityHourlyQueryDto, DetailedComparisonDto, CycleListQueryDto, CycleWaveformQueryDto, PowerQualityAnalysisDto (5 classes) | NO - Controller uses raw `@Query()` |
| Monitoring | `monitoring/dto/range-query.dto.ts` | RangeQueryDto (with class-validator) | YES |
| Settings | Multiple DTOs | All properly typed | YES |

**Verdict**: PARTIALLY RESOLVED. DTO classes were created for Dashboard (5), Alerts (3), and Analysis (5) modules, with proper `class-validator` decorators. However, **none of the new DTOs are imported or used in their respective controllers**. The controllers still use raw `@Query()` parameter extraction, bypassing the validation pipe. Only Monitoring (Dynamic Resolution) and Settings modules actually use their DTOs in controllers.

---

## 2. Remaining Gaps After Fixes

### 2.1 CRITICAL Remaining Items

| ID | Item | Description | Impact |
|----|------|-------------|--------|
| CR-01 | saveThresholdSettings() still a stub | Returns success without DB write | Settings changes not persisted across restarts |
| CR-02 | DTOs created but not used in controllers | Dashboard/Alerts/Analysis controllers don't import DTOs | No request validation on 15+ endpoints |

### 2.2 HIGH Remaining Items

| ID | Item | Description | Impact |
|----|------|-------------|--------|
| H-01 | alerts.service getCycleWaveformForAlert() uses Math.random() | Waveform data entirely random | Alert detail modal shows fake data |
| H-02 | analysis.service similarity calculations use Math.random() | Cycle similarity is random regardless of actual data | Incorrect anomaly detection display |
| H-03 | Alert trend/heatmap/history still use energy_timeseries | Should query alerts table for alert-specific data | Data comes from energy readings, not actual alerts |
| H-04 | SQL injection patterns in 3 services | String interpolation in Prisma.raw() (18 occurrences) | Security concern for user-supplied params |

### 2.3 MEDIUM Remaining Items

| ID | Item | Description | Impact |
|----|------|-------------|--------|
| M-01 | getGeneralSettings() hardcoded (settings.service.ts:140-149) | Returns static values, TODO comment present | General settings not configurable |
| M-02 | saveGeneralSettings() no-op (settings.service.ts:153-157) | Returns input without saving, TODO comment present | General settings changes lost |
| M-03 | getThresholds() hardcoded (settings.service.ts:160-185) | Static threshold values, TODO comment present | Global thresholds not configurable |
| M-04 | generateDefaultWaveform() uses Math.random() as fallback | Only triggered when DB has no waveform data | Shows noisy data instead of empty/null |
| M-05 | PrismaService re-registered in every module | 6 modules register PrismaService independently | Architecture smell (should use @Global()) |
| M-06 | Test coverage 0% (11 skeleton spec files) | All tests contain only `toBeDefined()` | No regression protection |

### 2.4 LOW Remaining Items

| ID | Item | Description | Impact |
|----|------|-------------|--------|
| L-01 | prevYearChange in getEnergyChangeTopN() is estimated | Line 512: `prevMonthChange * 1.3` instead of actual query | Approximate year-over-year comparison |
| L-02 | Alert history status cycling | Line 232-244: Status is `statuses[idx % 3]` not from DB | Alert status display is deterministic but not real |
| L-03 | Alert history action hardcoded | Line 245: Action text based on index, not DB | Action display is fake |

---

## 3. Score Calculation

### 3.1 Category Scores

| Category | Previous (v1.0) | Current (v3.0) | Change | Rationale |
|----------|:---------------:|:--------------:|:------:|-----------|
| **Endpoint Coverage** | 100% | 100% | -- | All 74 endpoints still present |
| **Endpoint URL Match** | 68% | 68% | -- | No URL changes made |
| **Response Format Match** | 52% | 52% | -- | No response format changes |
| **Error Handling** | 45% | 72% | +27 | GlobalExceptionFilter + custom exceptions + alert.update error handling |
| **Data Model Schema** | 100% | 100% | -- | No schema changes |
| **Data Model Usage** | 73% | 85% | +12 | CycleData/ReferenceCycle now queried; Alert partially queried |
| **Architecture** | 78% | 80% | +2 | Custom exceptions added; PrismaService still per-module |
| **DTO/Type Safety** | 40% | 55% | +15 | DTOs created (13 new classes), but 3/5 modules don't use them in controllers |
| **Test Coverage** | 5% | 5% | -- | No test changes |
| **Convention Compliance** | 90% | 90% | -- | No convention changes |
| **Data Quality** | 65% | 78% | +13 | 4/8 Math.random() removed; 3/5 TODO stubs remain |

### 3.2 Overall Score Calculation

```
Category Weights:
  Endpoint Coverage:      10%  x 100% = 10.0
  Endpoint URL Match:     10%  x  68% =  6.8
  Response Format Match:  15%  x  52% =  7.8
  Error Handling:         10%  x  72% =  7.2
  Data Model Schema:       5%  x 100% =  5.0
  Data Model Usage:       10%  x  85% =  8.5
  Architecture:            5%  x  80% =  4.0
  DTO/Type Safety:        10%  x  55% =  5.5
  Test Coverage:           5%  x   5% =  0.25
  Convention Compliance:   5%  x  90% =  4.5
  Data Quality:           15%  x  78% = 11.7

  TOTAL: 71.25 / 100 = 71% (rounded)
```

---

## 4. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Endpoint Coverage | 100% | OK |
| Endpoint URL Match | 68% | WARN |
| Response Format Match | 52% | CRITICAL |
| Error Handling | 72% | WARN |
| Data Model Schema | 100% | OK |
| Data Model Usage | 85% | WARN |
| Architecture | 80% | WARN |
| DTO/Type Safety | 55% | CRITICAL |
| Test Coverage | 5% | CRITICAL |
| Convention Compliance | 90% | OK |
| Data Quality (no mock in production) | 78% | WARN |
| **Overall** | **71%** | **WARN** |

```
Overall Match Rate: 71% (WARN)  [Previous: 68%]
Improvement: +3 percentage points

Fixed Items:     4 fully resolved, 3 partially resolved
Remaining Items: 2 CRITICAL, 4 HIGH, 6 MEDIUM, 3 LOW
```

---

## 5. What Improved (+3%)

| Fix | Category Impact | Score Impact |
|-----|----------------|-------------|
| GlobalExceptionFilter implemented | Error Handling 45% -> 72% | +2.7 |
| saveAlertAction() uses DB | Data Quality 65% -> 78% | +1.95 |
| CycleData/ReferenceCycle tables queried | Data Model Usage 73% -> 85% | +1.2 |
| getAlertStatsKpi() uses alerts table | Data Model Usage + Data Quality | +0.8 |
| Dashboard Math.random() removed (prevPower, cycleTime) | Data Quality | +0.6 |
| ReferenceCycle energy/cycleTime from DB | Data Quality | +0.3 |
| 13 new DTO classes created | DTO/Type Safety 40% -> 55% | +1.5 |
| **OFFSET** by DTOs not being used in controllers | DTO/Type Safety penalty | -1.0 |

---

## 6. What Blocks 90% Target

To reach 90%, the following items would have the highest impact:

| Priority | Action | Estimated Score Impact |
|----------|--------|:-----:|
| 1 | **Use DTOs in Dashboard/Alerts/Analysis controllers** (import + @Query(DTO) pattern) | +5% |
| 2 | **Fix remaining 4x Math.random()** (similarity calculation, waveform generation) | +3% |
| 3 | **Migrate alerts trend/heatmap/history to alerts table** | +3% |
| 4 | **Implement saveThresholdSettings() with actual DB write** | +2% |
| 5 | **Write real unit tests** (at least 1 test per service method) | +4% |
| 6 | **Sync design document or implementation** for URL/response mismatches | +5% |
| **Total potential** | | **+22%** (71% -> 93%) |

---

## 7. Detailed File-Level Verification Summary

### 7.1 Files Verified

| File | Path | Lines | Key Findings |
|------|------|:-----:|-------------|
| GlobalExceptionFilter | `common/filters/http-exception.filter.ts` | 73 | Fully implemented, exceeds design |
| main.ts | `main.ts` | 61 | Filter registered at line 26 |
| alerts.service.ts | `alerts/alerts.service.ts` | 342 | KPI uses alerts table; trend/heatmap/history still use energy_timeseries; waveform still random |
| analysis.service.ts | `analysis/analysis.service.ts` | 325 | CycleData/ReferenceCycle queried; similarity still random in 3 places |
| dashboard.service.ts | `dashboard/dashboard.service.ts` | 545 | Math.random() removed from processRanking/cycleRanking; actual DB queries for prev data |
| settings.service.ts | `settings/settings.service.ts` | 1107 | saveThresholdSettings() still stub; getReferenceCycles() uses DB |
| dashboard-query.dto.ts | `dashboard/dto/dashboard-query.dto.ts` | 51 | 5 DTO classes with class-validator, NOT used in controller |
| alerts-query.dto.ts | `alerts/dto/alerts-query.dto.ts` | 28 | 3 DTO classes with class-validator, NOT used in controller |
| analysis-query.dto.ts | `analysis/dto/analysis-query.dto.ts` | 62 | 5 DTO classes with class-validator, NOT used in controller |
| dashboard.controller.ts | `dashboard/dashboard.controller.ts` | 86 | Raw @Query() params, no DTO imports |
| alerts.controller.ts | `alerts/alerts.controller.ts` | 60 | Raw @Query() params, no DTO imports |
| analysis.controller.ts | `analysis/analysis.controller.ts` | 74 | Raw @Query() params, no DTO imports |
| custom-exceptions.ts | `common/exceptions/custom-exceptions.ts` | 85 | 4 custom exception classes |

### 7.2 SQL Injection Exposure

| File | Occurrences | Pattern | Risk Level |
|------|:-----------:|---------|:----------:|
| dashboard.service.ts | 10 | `\`AND l.code = '${line.toUpperCase()}'\`` | MEDIUM |
| alerts.service.ts | 5 | `\`AND l.code = '${line.toUpperCase()}'\``, `\`AND f.code = '${facilityCode}'\`` | MEDIUM |
| analysis.service.ts | 3 | `\`f.code = '${facilityId}'\``, `\`f.id = '${facilityId}'\`` | MEDIUM |
| monitoring.service.ts | 8 | `\`time_bucket('${bucketInterval}' ...)\``, `\`energyType = '${...}'\`` | LOW (enum-derived) |

Total: 26 string interpolation points in Prisma.raw(). Input validation at DTO level would mitigate this, but DTOs are not being applied to controllers (see CR-02).

---

## 8. Recommended Immediate Actions

### 8.1 Quick Wins (30 min each, +8% total)

1. **Wire DTOs to controllers** -- Import and use the already-created DTO classes in `@Query()` decorators for Dashboard, Alerts, and Analysis controllers. This is a 3-line change per controller.

2. **Fix similarity calculation** -- Replace `Math.random()` with a deterministic formula based on cycle status. Example: NORMAL=95%, DELAYED=80%, ANOMALY=65%.

### 8.2 Medium Effort (1-2 hours each, +5% total)

3. **Migrate alert trend/heatmap/history** to query the `alerts` table instead of `energy_timeseries`.

4. **Implement saveThresholdSettings()** -- Either add a `threshold_settings` table or use Facility metadata JSON field.

### 8.3 High Effort (1+ day, +9% total)

5. **Write real tests** -- Replace all 11 skeleton spec files with actual unit tests using mocked PrismaService.

6. **Sync design document** -- Update `backend-api.design.md` to reflect actual Dashboard/Alerts/Analysis endpoint URLs and response formats, or vice versa.

---

## 9. Synchronization Decision Required

The following items require a user decision:

| Item | Option A: Modify Implementation | Option B: Update Design |
|------|--------------------------------|------------------------|
| Dashboard 7/8 endpoints different | Rewrite all Dashboard endpoints | Update design to match Frontend-driven implementation |
| Alert history 3->1 consolidation | Split back into 3 endpoints | Document unified pattern |
| Monitoring overview 1->4 split | Merge back into 1 endpoint | Document split pattern |
| POST->PATCH for alert action | Change back to POST | Update design to PATCH |

**Recommendation**: Option B (Update Design) for all items. The implementation was designed to match the Frontend mock service functions, which is the correct approach for frontend-backend integration.

---

## Version History

| Version | Date | Score | Changes | Author |
|---------|------|:-----:|---------|--------|
| 1.0 | 2026-02-28 | 68% | Initial 74-endpoint analysis | Claude Code (gap-detector) |
| 3.0 | 2026-02-28 | 71% | Post-fix verification (7 claimed fixes) | Claude Code (gap-detector) |

---

## Related Documents

- Previous Analysis: [ifems-backend-api-74.analysis.md](ifems-backend-api-74.analysis.md)
- Design Document: [backend-api.design.md](../02-design/features/backend-api.design.md)
- Dynamic Resolution Analysis: [backend-dynamic-resolution.analysis.md](backend-dynamic-resolution.analysis.md)
