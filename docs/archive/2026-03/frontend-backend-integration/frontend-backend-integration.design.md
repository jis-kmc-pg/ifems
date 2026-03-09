# Frontend-Backend Integration Design

> **Version**: 1.0
> **Date**: 2026-03-04
> **Feature**: frontend-backend-integration
> **Status**: Design Phase
> **Plan Reference**: `docs/01-plan/features/frontend-backend-integration.plan.md`

---

## 1. 개요

Frontend 32개 화면(Mock 기반)을 Backend 83개 API 엔드포인트와 실제 연동하기 위한 상세 설계서.

### 1.1 핵심 발견사항

| 항목 | 분석 결과 | 리스크 |
|------|----------|--------|
| API 경로 매핑 | **100% 일치** (Frontend ↔ Backend 경로 동일) | LOW |
| CORS | 개발 환경 `origin: true` (모든 origin 허용) | NONE |
| 포트 | Backend 기본 4500, Frontend 기본 4500/api | 확인 필요 |
| 인증 | Auth Guard 없음 (401 미발생) | LOW |
| USE_MOCK 분기 | 5개 파일, **83개 분기** (settings 52개로 재확인) | LOW |
| API 키 매핑 | CLAUDE.md 문서화 완료, 런타임 검증 필요 | **HIGH** |

### 1.2 수정 대상 파일

| 파일 | 변경 내용 | 영향도 |
|------|----------|--------|
| `.env.local` | `VITE_USE_MOCK=false` + 포트 확인 | 전체 |
| 서비스 레이어 5개 | 수정 불필요 (경로 이미 일치) | NONE |
| Backend `main.ts` | 수정 불필요 (CORS 이미 허용) | NONE |

---

## 2. 환경 설정 상세 설계

### 2.1 포트 매핑 분석

**Backend (`apps/api/src/main.ts:51`)**:
```typescript
const port = process.env.PORT || 4500;
```

**Frontend (`apps/web/src/lib/constants.ts:132`)**:
```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4500/api';
```

- Backend 기본 포트: **4500**
- Frontend 기본 API URL: **http://localhost:4500/api**
- CLAUDE.md/MEMORY.md 기록: **:4001** (PORT 환경변수 설정 의심)

**설계 결정**: Backend의 `.env`에 `PORT=4001`이 있으면 Frontend에도 `VITE_API_URL=http://localhost:4001/api` 설정. 없으면 기본값 4500으로 동일 → 추가 설정 불필요.

### 2.2 `.env.local` 설정

```env
# Frontend 환경 변수 (.env.local)
VITE_USE_MOCK=false
# 포트 확인 후 필요 시:
# VITE_API_URL=http://localhost:4001/api
```

### 2.3 CORS 설정 (수정 불필요)

```typescript
// apps/api/src/main.ts:17-22
app.enableCors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'])
    : true, // 개발 환경: 모든 origin 허용 ✅
  credentials: true,
});
```

---

## 3. API 경로 매핑 검증 (Frontend → Backend)

### 3.1 Monitoring (10개 함수 → 11개 API)

| # | Frontend 함수 | Frontend 경로 | Backend 라우트 | 일치 |
|---|--------------|-------------|--------------|:----:|
| 1 | `getOverviewKpi()` | `/monitoring/overview/kpi` | `GET /api/monitoring/overview/kpi` | ✅ |
| 2 | `getLineMiniCards()` | `/monitoring/overview/lines` | `GET /api/monitoring/overview/lines` | ✅ |
| 3 | `getHourlyTrend(date?)` | `/monitoring/overview/hourly` | `GET /api/monitoring/overview/hourly` | ✅ |
| 4 | `getAlarmSummary()` | `/monitoring/overview/alarms` | `GET /api/monitoring/overview/alarms` | ✅ |
| 5 | `getLineDetailChart(line)` | `/monitoring/line/${line}` | `GET /api/monitoring/line/:line` | ✅ |
| 6 | `getEnergyRanking(line,type)` | `/monitoring/energy-ranking` | `GET /api/monitoring/energy-ranking` | ✅ |
| 7 | `getEnergyAlertStatus(line)` | `/monitoring/energy-alert` | `GET /api/monitoring/energy-alert` | ✅ |
| 8 | `getPowerQualityRanking(line)` | `/monitoring/power-quality` | `GET /api/monitoring/power-quality` | ✅ |
| 9 | `getAirLeakRanking(line)` | `/monitoring/air-leak` | `GET /api/monitoring/air-leak` | ✅ |
| 10 | `fetchRangeData(id,start,end,interval,metric)` | `/facilities/${id}/${metric}/range` | `GET /api/facilities/:id/power/range` | ✅ |

**파라미터 변환 주의**:
- `monitoring.ts:13`: `toApiType('power') → 'elec'` (Frontend 'power' → Backend 'elec')
- `fetchRangeData`의 `metric` 파라미터는 변환 없이 'power'/'air' 직접 전달 (facilities 컨트롤러는 'power'/'air' 사용)

### 3.2 Dashboard (9개 함수 → 9개 API)

| # | Frontend 함수 | Frontend 경로 | Backend 라우트 | 일치 |
|---|--------------|-------------|--------------|:----:|
| 1 | `getEnergyTrend(line?)` | `/dashboard/energy-trend` | `GET /api/dashboard/energy-trend` | ✅ |
| 2 | `getFacilityTrend(line?,facilityId?)` | `/dashboard/facility-trend` | `GET /api/dashboard/facility-trend` | ✅ |
| 3 | `getUsageDistribution(line?,date?)` | `/dashboard/usage-distribution` | `GET /api/dashboard/usage-distribution` | ✅ |
| 4 | `getProcessRanking(line?,type)` | `/dashboard/process-ranking` | `GET /api/dashboard/process-ranking` | ✅ |
| 5 | `getCycleRanking(line?)` | `/dashboard/cycle-ranking` | `GET /api/dashboard/cycle-ranking` | ✅ |
| 6 | `getPowerQualityRanking(line?)` | `/dashboard/power-quality-ranking` | `GET /api/dashboard/power-quality-ranking` | ✅ |
| 7 | `getAirLeakRanking(line?)` | `/dashboard/air-leak-ranking` | `GET /api/dashboard/air-leak-ranking` | ✅ |
| 8 | `getEnergyChangeTopN(topN,type)` | `/dashboard/energy-change-top` | `GET /api/dashboard/energy-change-top` | ✅ |
| 9 | `getFacilityList(line?)` | `/dashboard/facilities` | `GET /api/dashboard/facilities` | ✅ |

**파라미터 변환**: `dashboard.ts:14`: `toApiType('power') → 'elec'`

### 3.3 Alerts (7개 함수 → 7개 API)

| # | Frontend 함수 | Frontend 경로 | HTTP | Backend 라우트 | 일치 |
|---|--------------|-------------|------|--------------|:----:|
| 1 | `getAlertStatsKpi(category)` | `/alerts/stats/kpi` | GET | `GET /api/alerts/stats/kpi` | ✅ |
| 2 | `getAlertTrend(category)` | `/alerts/stats/trend` | GET | `GET /api/alerts/stats/trend` | ✅ |
| 3 | `getAlertHeatmap(category)` | `/alerts/stats/heatmap` | GET | `GET /api/alerts/stats/heatmap` | ✅ |
| 4 | `getAlertHistory(category,line?,facilityCode?)` | `/alerts/history` | GET | `GET /api/alerts/history` | ✅ |
| 5 | `saveAlertAction(id, action)` | `/alerts/${id}/action` | PATCH | `PATCH /api/alerts/:id/action` | ✅ |
| 6 | `getCycleWaveformForAlert(alertId,interval?)` | `/alerts/${alertId}/waveform` | GET | `GET /api/alerts/:id/waveform` | ✅ |
| 7 | `getCycleAnomalyTypes()` | `/alerts/cycle-anomaly/types` | GET | `GET /api/alerts/cycle-anomaly/types` | ✅ |

### 3.4 Analysis (7개 함수 → 7개 API)

| # | Frontend 함수 | Frontend 경로 | Backend 라우트 | 일치 |
|---|--------------|-------------|--------------|:----:|
| 1 | `getFacilityTree()` | `/analysis/facilities/tree` | `GET /api/analysis/facilities/tree` | ✅ |
| 2 | `getFacilityHourlyData(facilityId,type,date?)` | `/analysis/facility/hourly` | `GET /api/analysis/facility/hourly` | ✅ |
| 3 | `getDetailedComparison(cond1,cond2)` | `/analysis/comparison/detailed` | `GET /api/analysis/comparison/detailed` | ✅ |
| 4 | `getCycleList(facilityId?)` | `/analysis/cycles` | `GET /api/analysis/cycles` | ✅ |
| 5 | `getCycleWaveformData(cycleId,isRef,interval)` | `/analysis/cycle/waveform` | `GET /api/analysis/cycle/waveform` | ✅ |
| 6 | `getCycleDelayInfo(cycleId?)` | `/analysis/cycle/delay` | `GET /api/analysis/cycle/delay` | ✅ |
| 7 | `getPowerQualityAnalysis(facilityIds,date?)` | `/analysis/power-quality` | `GET /api/analysis/power-quality` | ✅ |

### 3.5 Settings (52개 함수 → 48+ 개 API)

| # | Frontend 함수 | Frontend 경로 | HTTP | Backend 라우트 | 일치 |
|---|--------------|-------------|------|--------------|:----:|
| 1 | `getPowerQualitySettings()` | `/settings/power-quality` | GET | `GET /api/settings/power-quality` | ✅ |
| 2 | `savePowerQualitySettings(rows)` | `/settings/power-quality` | PUT | `PUT /api/settings/power-quality` | ✅ |
| 3 | `getAirLeakSettings()` | `/settings/air-leak` | GET | `GET /api/settings/air-leak` | ✅ |
| 4 | `saveAirLeakSettings(rows)` | `/settings/air-leak` | PUT | `PUT /api/settings/air-leak` | ✅ |
| 5 | `getReferenceCycles()` | `/settings/reference-cycles` | GET | `GET /api/settings/reference-cycles` | ✅ |
| 6 | `getCycleAlertSettings()` | `/settings/cycle-alert` | GET | `GET /api/settings/cycle-alert` | ✅ |
| 7 | `saveCycleAlertSettings(rows)` | `/settings/cycle-alert` | PUT | `PUT /api/settings/cycle-alert` | ✅ |
| 8 | `getEnergyAlertSettings()` | `/settings/energy-alert` | GET | `GET /api/settings/energy-alert` | ✅ |
| 9 | `saveEnergyAlertSettings(rows)` | `/settings/energy-alert` | PUT | `PUT /api/settings/energy-alert` | ✅ |
| 10 | `getCycleEnergyAlertSettings()` | `/settings/cycle-energy-alert` | GET | `GET /api/settings/cycle-energy-alert` | ✅ |
| 11 | `saveCycleEnergyAlertSettings(rows)` | `/settings/cycle-energy-alert` | PUT | `PUT /api/settings/cycle-energy-alert` | ✅ |
| 12 | `getFacilityMasterList()` | `/settings/facility-master` | GET | `GET /api/settings/facility-master` | ✅ |
| 13 | `saveFacilityMaster(facility)` | `/settings/facility-master/${id}` | PUT | `PUT /api/settings/facility-master/:id` | ✅ |
| 14 | `createFacilityMaster(facility)` | `/settings/facility-master` | POST | `POST /api/settings/facility-master` | ✅ |
| 15 | `deleteFacilityMaster(id)` | `/settings/facility-master/${id}` | DELETE | `DELETE /api/settings/facility-master/:id` | ✅ |
| 16 | `getFactoryList()` | `/settings/factory` | GET | `GET /api/settings/factory` | ✅ |
| 17 | `createFactory(data)` | `/settings/factory` | POST | `POST /api/settings/factory` | ✅ |
| 18 | `updateFactory(id,data)` | `/settings/factory/${id}` | PUT | `PUT /api/settings/factory/:id` | ✅ |
| 19 | `deleteFactory(id)` | `/settings/factory/${id}` | DELETE | `DELETE /api/settings/factory/:id` | ✅ |
| 20 | `getLineList(factoryId?)` | `/settings/line` | GET | `GET /api/settings/line` | ✅ |
| 21 | `createLine(data)` | `/settings/line` | POST | `POST /api/settings/line` | ✅ |
| 22 | `updateLine(id,data)` | `/settings/line/${id}` | PUT | `PUT /api/settings/line/:id` | ✅ |
| 23 | `deleteLine(id)` | `/settings/line/${id}` | DELETE | `DELETE /api/settings/line/:id` | ✅ |
| 24 | `getTagList(filters?)` | `/settings/tag` | GET | `GET /api/settings/tag` | ✅ |
| 25 | `getTag(id)` | `/settings/tag/${id}` | GET | `GET /api/settings/tag/:id` | ✅ |
| 26 | `createTag(data)` | `/settings/tag` | POST | `POST /api/settings/tag` | ✅ |
| 27 | `updateTag(id,data)` | `/settings/tag/${id}` | PUT | `PUT /api/settings/tag/:id` | ✅ |
| 28 | `deleteTag(id)` | `/settings/tag/${id}` | DELETE | `DELETE /api/settings/tag/:id` | ✅ |
| 29 | `getHierarchy()` | `/settings/hierarchy` | GET | `GET /api/settings/hierarchy` | ✅ |
| 30 | `getFactoryHierarchy(factoryId)` | `/settings/hierarchy/factory/${id}` | GET | `GET /api/settings/hierarchy/factory/:id` | ✅ |
| 31 | `getLineHierarchy(lineId)` | `/settings/hierarchy/line/${id}` | GET | `GET /api/settings/hierarchy/line/:id` | ✅ |
| 32 | `getFacilityTags(facilityId)` | `/settings/hierarchy/facility/${id}` | GET | `GET /api/settings/hierarchy/facility/:id` | ✅ |
| 33 | `getFacilityTypeList()` | `/settings/facility-type` | GET | `GET /api/settings/facility-type` | ✅ |
| 34 | `createFacilityType(data)` | `/settings/facility-type` | POST | `POST /api/settings/facility-type` | ✅ |
| 35 | `updateFacilityType(id,data)` | `/settings/facility-type/${id}` | PUT | `PUT /api/settings/facility-type/:id` | ✅ |
| 36 | `deleteFacilityType(id)` | `/settings/facility-type/${id}` | DELETE | `DELETE /api/settings/facility-type/:id` | ✅ |
| 37 | `uploadTagBulk(file)` | `/settings/tag/bulk-upload` | POST | `POST /api/settings/tag/bulk-upload` | ✅ |
| 38 | `downloadTagBulkTemplate()` | `/settings/tag/bulk-template` | GET | `GET /api/settings/tag/bulk-template` | ✅ |
| 39 | `reassignTags(data)` | `/settings/tag/reassign` | POST | `POST /api/settings/tag/reassign` | ✅ |
| 40 | `getTagReassignmentHistory(tagId)` | `/settings/tag/${id}/reassignment-history` | GET | `GET /api/settings/tag/:id/reassignment-history` | ✅ |
| 41 | `getEnergyConfigList(filters?)` | `/settings/energy-config` | GET | `GET /api/settings/energy-config` | ✅ |
| 42 | `getEnergyConfig(id)` | `/settings/energy-config/${id}` | GET | `GET /api/settings/energy-config/:id` | ✅ |
| 43 | `updateEnergyConfig(id,data)` | `/settings/energy-config/${id}` | PUT | `PUT /api/settings/energy-config/:id` | ✅ |
| 44 | `getEnergyConfigHistory(filters?)` | `/settings/energy-config/history` | GET | `GET /api/settings/energy-config/history` | ✅ |
| 45 | `getEnergyConfigSummary()` | `/settings/energy-config/summary` | GET | `GET /api/settings/energy-config/summary` | ✅ |
| 46 | `autoGenerateEnergyConfigs()` | `/settings/energy-config/auto-generate` | POST | `POST /api/settings/energy-config/auto-generate` | ✅ |

**결론**: Frontend 서비스 레이어의 API 경로가 Backend 컨트롤러 라우트와 **100% 일치**. 코드 수정 불필요.

---

## 4. API 응답 키 매핑 상세 설계

> **핵심 리스크**: Mock 데이터의 키와 Backend API 응답의 키가 일치하지 않으면 빈 차트/빈 테이블 발생.

### 4.1 차트 화면 키 매핑 (검증 필수)

#### MON-001 종합 현황 — Hourly Trend

| 항목 | 값 |
|------|-----|
| **API** | `GET /monitoring/overview/hourly` |
| **Frontend series** | `current` (bar), `prev` (area) |
| **Mock 데이터** | `computeHourlyTrend()` → `{ time, current, prev }` |
| **Backend 응답** | `{ time, current, prev }` (확인 필요) |
| **xKey** | `time` |
| **불일치 시 증상** | 빈 막대 차트 |

#### MON-002 라인별 상세 — Power/Air Chart

| 항목 | 값 |
|------|-----|
| **API** | `GET /monitoring/line/:line` |
| **Frontend series (power)** | `power` (bar), `prevPower` (area) |
| **Frontend series (air)** | `air` (bar), `prevAir` (area) |
| **Mock 데이터** | `computeLineDetailChart()` → `{ time, power, prevPower, air, prevAir }` |
| **Backend 응답** | `{ time, power, prevPower, air, prevAir }` (확인 필요) |
| **불일치 시 증상** | 빈 차트 (2026-03-04 버그 경험) |

#### DSH-001 에너지 사용 추이

| 항목 | 값 |
|------|-----|
| **API** | `GET /dashboard/energy-trend` |
| **Frontend series** | `power`/`prevPower` (전력), `air`/`prevAir` (에어) |
| **Mock 데이터** | `ENERGY_TREND_MONTHLY` → `{ month, power, prevPower, air, prevAir }` |
| **Backend 응답** | `{ month, power, prevPower, air, prevAir }` (확인 필요) |
| **xKey** | `month` |

#### DSH-002 설비별 추이

| 항목 | 값 |
|------|-----|
| **API** | `GET /dashboard/facility-trend` |
| **Frontend series** | 동적 `[facilityCode]` |
| **Mock 데이터** | `FACILITY_TREND_DATA` → `{ dates[], facilities[].code, .powerData[], .airData[] }` |
| **Backend 응답** | 동일 구조 필요 (확인 필요) |
| **불일치 시 증상** | 빈 라인 |

#### ANL-001 비교 분석

| 항목 | 값 |
|------|-----|
| **API** | `GET /analysis/facility/hourly` |
| **Frontend series** | 동적 `[facilityId]` — 페이지에서 `row[facilityId] = data[i].current` 변환 |
| **Mock 데이터** | `getFacilityElecData()` → `{ time, timestamp, current }` |
| **Backend 응답** | `{ time, timestamp, current }` (확인 필요) |

#### ANL-002 상세 비교

| 항목 | 값 |
|------|-----|
| **API** | `GET /analysis/comparison/detailed` |
| **Frontend series** | `origin`, `compare`, `diff` |
| **Mock 데이터** | 직접 생성 → `{ time, timestamp, origin, compare, diff }` |
| **Backend 응답** | `{ time, timestamp, origin, compare, diff }` (확인 필요) |

#### ANL-003 싸이클 파형

| 항목 | 값 |
|------|-----|
| **API** | `GET /analysis/cycle/waveform` |
| **Frontend series** | `ref`, `cycle1`, `cycle2` (페이지 인라인 변환) |
| **Mock 데이터** | `getCycleWaveform()` → `{ sec, value }` |
| **Backend 응답** | `{ sec, value }` (확인 필요) |

#### ANL-005 전력 품질

| 항목 | 값 |
|------|-----|
| **API** | `GET /analysis/power-quality` |
| **Frontend series** | `${id}_imb`, `${id}_pf` (페이지 인라인 변환) |
| **Mock 데이터** | `getFacilityElecData()` → `{ time, current }` |
| **Backend 응답** | `{ time, current }` (확인 필요) |

#### SET-003 기준 싸이클 파형

| 항목 | 값 |
|------|-----|
| **API** | `GET /settings/reference-cycles` + `GET /analysis/cycle/waveform` |
| **Frontend series** | `value` |
| **Mock 데이터** | `getCycleWaveform()` → `{ sec, value }` |

### 4.2 테이블/KPI 화면 키 매핑

#### MON-001 KPI 카드

```typescript
// 필수 응답 키
{
  totalPower: { value: number, change: number },
  totalAir: { value: number, change: number },
  powerQualityAlarms: { value: number, change: number },
  airLeakAlarms: { value: number, change: number }
}
```

#### MON-001 라인 미니카드

```typescript
// 필수 응답 키 (배열)
[{
  id: string,        // 'block' | 'head' | 'crank' | 'assembly'
  label: string,     // '블록' | '헤드' | ...
  power: number,
  powerUnit: string, // 'kWh'
  air: number,
  airUnit: string,   // 'Nm³'
  powerStatus: 'NORMAL' | 'WARNING' | 'DANGER',
  airStatus: 'NORMAL' | 'WARNING' | 'DANGER'
}]
```

#### MON-003 에너지 순위 테이블

```typescript
// 필수 응답 키 (배열)
[{
  code: string,        // 'HNK10-010-1'
  process: string,     // 'OP10'
  dailyElec: number,
  weeklyElec: number,
  rankChangeElec: number,
  status: 'NORMAL' | 'WARNING' | 'DANGER'
}]
```

### 4.3 키 매핑 검증 방법

```
1단계: Backend 서버 기동
2단계: curl/Swagger로 주요 API 호출
3단계: 응답 키가 4.1/4.2 테이블과 일치하는지 확인
4단계: 불일치 발견 시 → Backend 서비스 수정 (키 이름 변경)
```

---

## 5. 구현 순서 상세 설계

### Phase 1: 환경 설정 + 연결 확인 (LOW risk)

**작업 목록**:

1. Backend `.env` 파일에서 PORT 확인
2. `.env.local` 수정:
   ```env
   VITE_USE_MOCK=false
   VITE_API_URL=http://localhost:{확인된 포트}/api
   ```
3. Backend 서버 기동: `pnpm dev:api` (또는 `cd apps/api && pnpm start:dev`)
4. 연결 테스트: `curl http://localhost:{port}/api/settings/hierarchy`
5. Vite dev 서버 재시작: `pnpm dev:web`

**검증 기준**:
- [x] Backend 서버 정상 기동 (콘솔에 "i-FEMS API Server running" 출력)
- [x] Swagger 문서 접근 가능 (`/api/docs`)
- [x] 단순 GET API 200 응답

### Phase 2: Settings 화면 통합 (46개 API, LOW risk)

Settings는 주로 CRUD 테이블로 키 매핑 리스크 낮음. 이미 tag-classification-redesign에서 일부 연동 경험.

**구현 순서**:

| 순서 | 화면 | 주요 API | 검증 포인트 |
|:----:|------|---------|-----------|
| 1 | SET-011 공장 관리 | `getFactoryList` | 목록 렌더링 |
| 2 | SET-012 라인 설정 | `getLineList` | factoryId 필터 |
| 3 | SET-013 설비 마스터 | `getFacilityMasterList` | 전체 CRUD |
| 4 | SET-014 설비 유형 | `getFacilityTypeList` | 전체 CRUD |
| 5 | SET-015 태그 마스터 | `getTagList` | 페이지네이션 응답 `{data, pagination}` |
| 6 | SET-016 계층 구조 | `getHierarchy` | 트리 구조 렌더링 |
| 7 | SET-017 에너지 소스 매핑 | `getEnergyConfigList` | Config+ConfigTag 구조 |
| 8 | SET-001~006 | 설정값 GET/PUT | SettingRow[] 매핑 |

**주의사항**:
- `getTagList`: Backend 응답이 `{ data: [...], pagination: {...} }` → settings.ts에 이미 처리 로직 있음 (line 221-226)
- `getFacilityMasterList`: 디버그 console.log 제거 권장 (settings.ts:71-83)

### Phase 3: Monitoring 화면 통합 (11개 API, HIGH risk)

**핵심 리스크**: 차트 키 매핑 불일치 → 빈 차트

**구현 순서**:

| 순서 | 화면 | 주요 API | 위험도 | 검증 포인트 |
|:----:|------|---------|:-----:|-----------|
| 1 | MON-001 | `getOverviewKpi` | LOW | KPI 4장 렌더링 |
| 2 | MON-001 | `getLineMiniCards` | LOW | 미니카드 4개 |
| 3 | MON-001 | `getAlarmSummary` | LOW | 알림 테이블 |
| 4 | MON-001 | `getHourlyTrend` | **HIGH** | `current`/`prev` 키 |
| 5 | MON-002 | `getLineDetailChart` | **HIGH** | `power`/`prevPower`/`air`/`prevAir` 키 |
| 6 | MON-003 | `getEnergyRanking` | MEDIUM | 테이블 + `toApiType` 변환 |
| 7 | MON-004 | `getEnergyAlertStatus` | LOW | 테이블 |
| 8 | MON-005 | `getPowerQualityRanking` | LOW | 테이블 |
| 9 | MON-006 | `getAirLeakRanking` | LOW | 테이블 |
| 10 | 공통 | `fetchRangeData` | MEDIUM | Dynamic Resolution |

**Phase 3 검증 체크리스트**:
- [ ] MON-001 KPI 카드에 실제 수치 표시
- [ ] MON-001 시간별 트렌드 차트에 막대(current) + 영역(prev) 표시
- [ ] MON-002 전력 차트: 노란 막대(power) + 회색 영역(prevPower)
- [ ] MON-002 에어 차트: 파란 막대(air) + 회색 영역(prevAir)
- [ ] MON-003~006 테이블 데이터 정상 렌더링

### Phase 4: Dashboard 화면 통합 (9개 API, MEDIUM risk)

| 순서 | 화면 | 주요 API | 위험도 | 검증 포인트 |
|:----:|------|---------|:-----:|-----------|
| 1 | DSH-001 | `getEnergyTrend` | **HIGH** | `month`/`power`/`prevPower`/`air`/`prevAir` |
| 2 | DSH-002 | `getFacilityTrend` | **HIGH** | 동적 `[facilityCode]` 키 |
| 3 | DSH-003 | `getUsageDistribution` | LOW | 분포 차트 |
| 4 | DSH-004 | `getProcessRanking` | MEDIUM | `toApiType` 변환 |
| 5 | DSH-005 | `getCycleRanking` | LOW | 테이블 |
| 6 | DSH-006 | `getPowerQualityRanking` | LOW | 테이블 |
| 7 | DSH-007 | `getAirLeakRanking` | LOW | 테이블 |
| 8 | DSH-008 | `getEnergyChangeTopN` | MEDIUM | `topN`+`toApiType` |
| 9 | 공통 | `getFacilityList` | LOW | 드롭다운 |

### Phase 5: Alerts 화면 통합 (7개 API, MEDIUM risk)

| 순서 | 화면 | 주요 API | 위험도 | 검증 포인트 |
|:----:|------|---------|:-----:|-----------|
| 1 | ALT-001~003 | `getAlertStatsKpi` | LOW | KPI 카드 |
| 2 | ALT-001~003 | `getAlertTrend` | LOW | 주간 트렌드 |
| 3 | ALT-001 | `getAlertHeatmap` | LOW | 히트맵 |
| 4 | ALT-003 | `getCycleAnomalyTypes` | LOW | 유형 분포 |
| 5 | ALT-004~006 | `getAlertHistory` | LOW | 이력 테이블 |
| 6 | ALT-004~006 | `saveAlertAction` | LOW | PATCH 저장 |
| 7 | ALT-004,006 | `getCycleWaveformForAlert` | **HIGH** | `current`/`prev` 키 |

### Phase 6: Analysis 화면 통합 (7개 API, HIGH risk)

| 순서 | 화면 | 주요 API | 위험도 | 검증 포인트 |
|:----:|------|---------|:-----:|-----------|
| 1 | ANL-001 | `getFacilityTree` | LOW | 트리 구조 |
| 2 | ANL-001 | `getFacilityHourlyData` | **HIGH** | `current` → `row[id]` 변환 |
| 3 | ANL-002 | `getDetailedComparison` | **HIGH** | `origin`/`compare`/`diff` |
| 4 | ANL-003 | `getCycleList` | LOW | 목록 |
| 5 | ANL-003 | `getCycleWaveformData` | **HIGH** | `sec`/`value` + interval |
| 6 | ANL-004 | `getCycleDelayInfo` | MEDIUM | 3패널 비교 |
| 7 | ANL-005 | `getPowerQualityAnalysis` | **HIGH** | 동적 `${id}_imb`/`${id}_pf` |

### Phase 7: 통합 검증

1. **전체 32 화면 순회**: 각 화면 로딩 → 데이터 표시 확인
2. **에러 핸들링**: Backend 중단 시 에러 표시 확인
3. **console.log 정리**: settings.ts의 디버그 로그 제거

---

## 6. 에러 처리 설계

### 6.1 기존 에러 처리 (수정 불필요)

```typescript
// api.ts:18-27 — 이미 구현됨
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ifems_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
```

### 6.2 화면별 에러 처리 패턴

TanStack Query 사용 화면:
```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['overview-kpi'],
  queryFn: getOverviewKpi,
});
// error 시 자동 에러 바운더리 또는 컴포넌트 내 에러 표시
```

직접 호출 화면:
```typescript
try {
  const data = await getXxx();
  setState(data);
} catch (err) {
  // toast 또는 에러 상태 표시
}
```

---

## 7. 데이터 고려사항

### 7.1 DB 데이터 현황

| 테이블 | 데이터 | 비고 |
|--------|--------|------|
| `factories` | seed 데이터 | 1개 공장 (HNK) |
| `lines` | seed 데이터 | 4개 라인 (BLK, HD, CRK, ASM) |
| `facilities` | seed 데이터 | 325개 설비 |
| `tags` | seed 데이터 | 3,107개 태그 |
| `tag_data_raw` | **확인 필요** | 시계열 실데이터 유무 |
| `energy_timeseries` | **확인 필요** | 15분 집계 데이터 |
| `energy_usage_1min` | **확인 필요** | 1분 집계 데이터 |

### 7.2 빈 데이터 대응

시계열 데이터가 없을 경우:
- 차트: **빈 배열 → 차트 미표시 (데이터 없음 메시지)** — 이미 TrendChart에서 처리
- KPI: **0 또는 null 표시** — KpiCard에서 처리
- 테이블: **빈 배열 → "데이터 없음" 메시지** — SortableTable에서 처리

### 7.3 `toApiType` 변환 주의

Frontend `'power'` ↔ Backend `'elec'` 변환이 필요한 API:
- `monitoring.ts:13` — `getEnergyRanking(line, type)`: params에 `type: toApiType(type)` ✅
- `dashboard.ts:14` — `getProcessRanking(line, type)`: params에 `type: toApiType(type)` ✅
- `dashboard.ts:14` — `getEnergyChangeTopN(topN, type)`: params에 `type: toApiType(type)` ✅

`fetchRangeData`의 `metric`은 변환 **없이** 'power'/'air' 직접 전달 → facilities 컨트롤러 경로가 `/facilities/:id/power/range`이므로 정상.

---

## 8. 디버그 로그 정리 대상

`settings.ts`에 남아있는 디버그 console.log:

| 라인 | 함수 | 내용 |
|------|------|------|
| 71 | `getFacilityMasterList` | `console.log('🔍 getFacilityMasterList - USE_MOCK:', USE_MOCK)` |
| 73 | `getFacilityMasterList` | `console.log('📦 Using MOCK data...')` |
| 76 | `getFacilityMasterList` | `console.log('🌐 Calling API: /settings/facility-master')` |
| 78 | `getFacilityMasterList` | `console.log('✅ API Response:', ...)` |
| 82 | `getFacilityMasterList` | `console.error('❌ API Error:', ...)` |
| 117 | `getFactoryList` | `console.log('🔍 getFactoryList - USE_MOCK:', USE_MOCK)` |
| 119 | `getFactoryList` | `console.log('🌐 Calling API: /settings/factory')` |
| 156 | `getLineList` | `console.log('🔍 getLineList - factoryId:', factoryId)` |
| 208 | `getTagList` | `console.log('🔍 getTagList - filters:', filters)` |
| 283 | `getHierarchy` | `console.log('🔍 getHierarchy')` |
| 321 | `getFacilityTypeList` | `console.log('🔍 getFacilityTypeList - USE_MOCK:', USE_MOCK)` |
| 323 | `getFacilityTypeList` | `console.log('🌐 Calling API: /settings/facility-type')` |

**설계 결정**: Phase 7 (통합 검증) 완료 후 일괄 제거.

---

## 9. 산출물 목록

| 산출물 | 수정 필요 | 경로 |
|--------|:--------:|------|
| `.env.local` | ✅ | `apps/web/.env.local` |
| `settings.ts` console.log 정리 | ✅ | `apps/web/src/services/settings.ts` |
| Backend 응답 키 수정 (발견 시) | ⚠️ | `apps/api/src/*/service.ts` |
| 통합 검증 결과 | ✅ | `/pdca analyze` 시 생성 |

---

## 10. 검증 기준

### 10.1 Phase별 완료 기준

| Phase | 완료 기준 |
|-------|----------|
| Phase 1 | Backend 서버 기동 + API 1개 200 응답 |
| Phase 2 | Settings 10개 화면 데이터 렌더링 |
| Phase 3 | Monitoring 6개 화면 + 차트 데이터 표시 |
| Phase 4 | Dashboard 8개 화면 + 차트 데이터 표시 |
| Phase 5 | Alerts 6개 화면 + 이력/통계 표시 |
| Phase 6 | Analysis 5개 화면 + 차트 데이터 표시 |
| Phase 7 | 32개 화면 전체 순회 성공 |

### 10.2 전체 완료 기준

- [ ] `VITE_USE_MOCK=false` 상태에서 32개 화면 렌더링 성공
- [ ] 차트 화면에서 빈 차트 0건
- [ ] console에 API 에러 0건 (정상 데이터 기준)
- [ ] 디버그 console.log 제거 완료
