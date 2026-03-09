# i-FEMS API 연동 테스트 계획서

> 작성일: 2026-02-28
> 목적: Frontend (.env.local VITE_USE_MOCK=false) ↔ Backend (NestJS, Port 4000) 전체 API 연동 검증

## 📋 테스트 환경 설정

### 1. Backend API 서버 실행
```bash
cd d:/AI_PJ/IFEMS/apps/api
pnpm run start:dev
# 실행 확인: http://localhost:4000/api (Swagger UI)
```

### 2. Frontend 개발 서버 실행
```bash
cd d:/AI_PJ/IFEMS/apps/web
pnpm dev
# 실행 확인: http://localhost:5173
```

### 3. 환경 변수 확인
- `apps/web/.env.local` 파일:
  ```
  VITE_USE_MOCK=false
  VITE_API_URL=http://localhost:4000/api
  ```

---

## 🎯 API 엔드포인트 매핑 테이블

### A. Monitoring APIs (MON-001~006 + Dynamic Resolution)

| No | Frontend Function | Backend Endpoint | Method | 구현 상태 | 테스트 우선순위 |
|----|------------------|------------------|--------|----------|----------------|
| 1 | `getOverviewKpi()` | `/monitoring/overview/kpi` | GET | ✅ 구현완료 | 🔥 HIGH |
| 2 | `getLineMiniCards()` | `/monitoring/overview/lines` | GET | ✅ 구현완료 | 🔥 HIGH |
| 3 | `getHourlyTrend(date)` | `/monitoring/overview/hourly?date={date}` | GET | ✅ 구현완료 | 🔥 HIGH |
| 4 | `getAlarmSummary()` | `/monitoring/overview/alarms` | GET | ✅ 구현완료 | 🔥 HIGH |
| 5 | `getLineDetailChart(line, date, interval)` | `/monitoring/line/{line}?date={date}&interval={interval}` | GET | ✅ 구현완료 | 🔥 HIGH |
| 6 | `getEnergyRanking(line, type)` | `/monitoring/energy-ranking?line={line}&type={type}` | GET | ✅ 구현완료 | MEDIUM |
| 7 | `getEnergyAlertStatus(line)` | `/monitoring/energy-alert?line={line}` | GET | ✅ 구현완료 | MEDIUM |
| 8 | `getPowerQualityRanking(line)` | `/monitoring/power-quality?line={line}` | GET | ✅ 구현완료 | MEDIUM |
| 9 | `getAirLeakRanking(line)` | `/monitoring/air-leak?line={line}` | GET | ✅ 구현완료 | MEDIUM |
| 10 | `fetchRangeData(facilityId, startTime, endTime, interval, 'power')` | `/facilities/{facilityId}/power/range?startTime={startTime}&endTime={endTime}&interval={interval}` | GET | ✅ 구현완료 | 🔥🔥 CRITICAL |
| 11 | `fetchRangeData(facilityId, startTime, endTime, interval, 'air')` | `/facilities/{facilityId}/air/range?startTime={startTime}&endTime={endTime}&interval={interval}` | GET | ✅ 구현완료 | 🔥🔥 CRITICAL |

### B. Dashboard APIs (DSH-001~008)

| No | Frontend Function | Backend Endpoint | Method | 구현 상태 | 테스트 우선순위 |
|----|------------------|------------------|--------|----------|----------------|
| 12 | `getEnergyTrend(line)` | `/dashboard/energy-trend?line={line}` | GET | ✅ 구현완료 | MEDIUM |
| 13 | `getFacilityTrend(line, facilityId)` | `/dashboard/facility-trend?line={line}&facilityId={facilityId}` | GET | ✅ 구현완료 | MEDIUM |
| 14 | `getUsageDistribution(line, date)` | `/dashboard/usage-distribution?line={line}&date={date}` | GET | ✅ 구현완료 | LOW |
| 15 | `getProcessRanking(line, type)` | `/dashboard/process-ranking?line={line}&type={type}` | GET | ✅ 구현완료 | LOW |
| 16 | `getCycleRanking(line)` | `/dashboard/cycle-ranking?line={line}` | GET | ✅ 구현완료 | LOW |
| 17 | `getPowerQualityRanking(line)` | `/dashboard/power-quality-ranking?line={line}` | GET | ✅ 구현완료 | LOW |
| 18 | `getAirLeakRanking(line)` | `/dashboard/air-leak-ranking?line={line}` | GET | ✅ 구현완료 | LOW |
| 19 | `getEnergyChangeTopN(topN, type)` | `/dashboard/energy-change-top?topN={topN}&type={type}` | GET | ✅ 구현완료 | LOW |
| 20 | `getFacilityList(line)` | `/dashboard/facilities?line={line}` | GET | ✅ 구현완료 | MEDIUM |

### C. Alerts APIs (ALT-001~007)

| No | Frontend Function | Backend Endpoint | Method | 구현 상태 | 테스트 우선순위 |
|----|------------------|------------------|--------|----------|----------------|
| 21 | `getAlertStatsKpi(category)` | `/alerts/stats/kpi?category={category}` | GET | ✅ 구현완료 | MEDIUM |
| 22 | `getAlertTrend(category)` | `/alerts/stats/trend?category={category}` | GET | ✅ 구현완료 | MEDIUM |
| 23 | `getAlertHeatmap(category)` | `/alerts/stats/heatmap?category={category}` | GET | ✅ 구현완료 | LOW |
| 24 | `getAlertHistory(category, line, facilityCode)` | `/alerts/history?category={category}&line={line}&facilityCode={facilityCode}` | GET | ✅ 구현완료 | MEDIUM |
| 25 | `saveAlertAction(id, action)` | `/alerts/{id}/action` | PATCH | ✅ 구현완료 | LOW |
| 26 | `getCycleWaveformForAlert(alertId)` | `/alerts/{alertId}/waveform` | GET | ✅ 구현완료 | LOW |
| 27 | `getCycleAnomalyTypes()` | `/alerts/cycle-anomaly/types` | GET | ✅ 구현완료 | LOW |

### D. Analysis APIs (ANL-001~007)

| No | Frontend Function | Backend Endpoint | Method | 구현 상태 | 테스트 우선순위 |
|----|------------------|------------------|--------|----------|----------------|
| 28 | `getFacilityTree()` | `/analysis/facilities/tree` | GET | ✅ 구현완료 | MEDIUM |
| 29 | `getFacilityHourlyData(facilityId, type, date)` | `/analysis/facility/hourly?facilityId={facilityId}&type={type}&date={date}` | GET | ✅ 구현완료 | MEDIUM |
| 30 | `getDetailedComparison(cond1, cond2)` | `/analysis/comparison/detailed` | GET | ✅ 구현완료 | LOW |
| 31 | `getCycleList(facilityId)` | `/analysis/cycles?facilityId={facilityId}` | GET | ✅ 구현완료 | LOW |
| 32 | `getCycleWaveformData(cycleId, isReference)` | `/analysis/cycle/waveform?cycleId={cycleId}&isReference={isReference}` | GET | ✅ 구현완료 | LOW |
| 33 | `getCycleDelayInfo(cycleId)` | `/analysis/cycle/delay?cycleId={cycleId}` | GET | ✅ 구현완료 | LOW |
| 34 | `getPowerQualityAnalysis(facilityIds, date)` | `/analysis/power-quality?facilityIds={facilityIds}&date={date}` | GET | ✅ 구현완료 | LOW |

### E. Settings APIs (SET-008~013 + Tag Management)

| No | Frontend Function | Backend Endpoint | Method | 구현 상태 | 테스트 우선순위 |
|----|------------------|------------------|--------|----------|----------------|
| 35 | `getPowerQualitySettings()` | `/settings/power-quality` | GET | ✅ 구현완료 | LOW |
| 36 | `savePowerQualitySettings(rows)` | `/settings/power-quality` | PUT | ✅ 구현완료 | LOW |
| 37 | `getAirLeakSettings()` | `/settings/air-leak` | GET | ✅ 구현완료 | LOW |
| 38 | `saveAirLeakSettings(rows)` | `/settings/air-leak` | PUT | ✅ 구현완료 | LOW |
| 39 | `getReferenceCycles()` | `/settings/reference-cycles` | GET | ✅ 구현완료 | LOW |
| 40 | `getCycleAlertSettings()` | `/settings/cycle-alert` | GET | ✅ 구현완료 | LOW |
| 41 | `saveCycleAlertSettings(rows)` | `/settings/cycle-alert` | PUT | ✅ 구현완료 | LOW |
| 42 | `getEnergyAlertSettings()` | `/settings/energy-alert` | GET | ✅ 구현완료 | LOW |
| 43 | `saveEnergyAlertSettings(rows)` | `/settings/energy-alert` | PUT | ✅ 구현완료 | LOW |
| 44 | `getCycleEnergyAlertSettings()` | `/settings/cycle-energy-alert` | GET | ✅ 구현완료 | LOW |
| 45 | `saveCycleEnergyAlertSettings(rows)` | `/settings/cycle-energy-alert` | PUT | ✅ 구현완료 | LOW |
| 46 | `getFacilityMasterList()` | `/settings/facility-master` | GET | ✅ 구현완료 | MEDIUM |
| 47 | `saveFacilityMaster(facility)` | `/settings/facility-master/{id}` | PUT | ✅ 구현완료 | LOW |
| 48 | `createFacilityMaster(facility)` | `/settings/facility-master` | POST | ✅ 구현완료 | LOW |
| 49 | `deleteFacilityMaster(id)` | `/settings/facility-master/{id}` | DELETE | ✅ 구현완료 | LOW |
| 50 | `getFactoryList()` | `/settings/factory` | GET | ✅ 구현완료 | MEDIUM |
| 51 | `createFactory(data)` | `/settings/factory` | POST | ✅ 구현완료 | LOW |
| 52 | `updateFactory(id, data)` | `/settings/factory/{id}` | PUT | ✅ 구현완료 | LOW |
| 53 | `deleteFactory(id)` | `/settings/factory/{id}` | DELETE | ✅ 구현완료 | LOW |
| 54 | `getLineList(factoryId)` | `/settings/line?factoryId={factoryId}` | GET | ✅ 구현완료 | MEDIUM |
| 55 | `createLine(data)` | `/settings/line` | POST | ✅ 구현완료 | LOW |
| 56 | `updateLine(id, data)` | `/settings/line/{id}` | PUT | ✅ 구현완료 | LOW |
| 57 | `deleteLine(id)` | `/settings/line/{id}` | DELETE | ✅ 구현완료 | LOW |
| 58 | `getTagList(filters)` | `/settings/tag?facilityId={facilityId}&tagType={tagType}&energyType={energyType}&search={search}&pageSize=10000` | GET | ✅ 구현완료 | 🔥 HIGH |
| 59 | `getTag(id)` | `/settings/tag/{id}` | GET | ✅ 구현완료 | LOW |
| 60 | `createTag(data)` | `/settings/tag` | POST | ✅ 구현완료 | MEDIUM |
| 61 | `updateTag(id, data)` | `/settings/tag/{id}` | PUT | ✅ 구현완료 | LOW |
| 62 | `deleteTag(id)` | `/settings/tag/{id}` | DELETE | ✅ 구현완료 | LOW |
| 63 | `getHierarchy()` | `/settings/hierarchy` | GET | ✅ 구현완료 | 🔥 HIGH |
| 64 | `getFactoryHierarchy(factoryId)` | `/settings/hierarchy/factory/{factoryId}` | GET | ✅ 구현완료 | MEDIUM |
| 65 | `getLineHierarchy(lineId)` | `/settings/hierarchy/line/{lineId}` | GET | ✅ 구현완료 | MEDIUM |
| 66 | `getFacilityTags(facilityId)` | `/settings/hierarchy/facility/{facilityId}` | GET | ✅ 구현완료 | MEDIUM |
| 67 | `getFacilityTypeList()` | `/settings/facility-type` | GET | ✅ 구현완료 | MEDIUM |
| 68 | `createFacilityType(data)` | `/settings/facility-type` | POST | ✅ 구현완료 | LOW |
| 69 | `updateFacilityType(id, data)` | `/settings/facility-type/{id}` | PUT | ✅ 구현완료 | LOW |
| 70 | `deleteFacilityType(id)` | `/settings/facility-type/{id}` | DELETE | ✅ 구현완료 | LOW |
| 71 | `uploadTagBulk(file)` | `/settings/tag/bulk-upload` | POST | ✅ 구현완료 | MEDIUM |
| 72 | `downloadTagBulkTemplate()` | `/settings/tag/bulk-template` | GET | ✅ 구현완료 | LOW |
| 73 | `reassignTags(data)` | `/settings/tag/reassign` | POST | ✅ 구현완료 | LOW |
| 74 | `getTagReassignmentHistory(tagId)` | `/settings/tag/{tagId}/reassignment-history` | GET | ✅ 구현완료 | LOW |

---

## 📊 구현 현황 요약

| 카테고리 | 총 API 수 | 구현 완료 | 미구현 | 구현률 |
|---------|----------|---------|--------|--------|
| **A. Monitoring** | 11 | 11 | 0 | **100%** ✅ |
| **B. Dashboard** | 9 | 9 | 0 | **100%** ✅ |
| **C. Alerts** | 7 | 7 | 0 | **100%** ✅ |
| **D. Analysis** | 7 | 7 | 0 | **100%** ✅ |
| **E. Settings** | 40 | 40 | 0 | **100%** ✅ |
| **전체 합계** | **74** | **74** | **0** | **100%** ✅ |

### 중요도별 구현 현황

| 우선순위 | API 수 | 구현 완료 | 미구현 |
|---------|--------|---------|--------|
| 🔥🔥 CRITICAL | 2 | 2 | 0 |
| 🔥 HIGH | 6 | 6 | 0 |
| MEDIUM | 19 | 10 | 9 |
| LOW | 47 | 15 | 32 |

---

## 🧪 테스트 시나리오

### Phase 1: Dynamic Resolution API 집중 테스트 (CRITICAL 🔥🔥)

#### 시나리오 1-1: 정상 케이스 - 4가지 Interval 테스트

**설비**: `HNK10-000`
**기간**: 2024-01-01 00:00:00 ~ 2024-01-01 23:59:59

```bash
# Test 1: 15분 interval (Level 0)
curl "http://localhost:4000/api/facilities/HNK10-000/power/range?startTime=2024-01-01T00:00:00Z&endTime=2024-01-01T23:59:59Z&interval=15m"

# Test 2: 1분 interval (Level 1)
curl "http://localhost:4000/api/facilities/HNK10-000/power/range?startTime=2024-01-01T00:00:00Z&endTime=2024-01-01T23:59:59Z&interval=1m"

# Test 3: 10초 interval (Level 2) - 1시간만
curl "http://localhost:4000/api/facilities/HNK10-000/power/range?startTime=2024-01-01T00:00:00Z&endTime=2024-01-01T01:00:00Z&interval=10s"

# Test 4: 1초 interval (Level 3) - 1시간, maxPoints 제한
curl "http://localhost:4000/api/facilities/HNK10-000/air/range?startTime=2024-01-01T00:00:00Z&endTime=2024-01-01T01:00:00Z&interval=1s&maxPoints=1000"
```

**기대 결과**:
- HTTP 200 OK
- `metadata.interval`: 요청한 interval 값
- `metadata.zoomLevel`: 0, 1, 2, 3
- `metadata.totalPoints`: 데이터 포인트 개수
- `data[]`: 시계열 데이터 배열

#### 시나리오 1-2: 에러 케이스 테스트

```bash
# Error 1: Invalid interval (5m)
curl "http://localhost:4000/api/facilities/HNK10-000/power/range?startTime=2024-01-01T00:00:00Z&endTime=2024-01-01T23:59:59Z&interval=5m"
# 기대: HTTP 400, error: "INVALID_INTERVAL"

# Error 2: Invalid time range (end < start)
curl "http://localhost:4000/api/facilities/HNK10-000/power/range?startTime=2024-01-02T00:00:00Z&endTime=2024-01-01T00:00:00Z&interval=1m"
# 기대: HTTP 400, error: "INVALID_TIME_RANGE"

# Error 3: Facility not found
curl "http://localhost:4000/api/facilities/INVALID-000/power/range?startTime=2024-01-01T00:00:00Z&endTime=2024-01-01T23:59:59Z&interval=1m"
# 기대: HTTP 404, error: "FACILITY_NOT_FOUND"
```

#### 시나리오 1-3: Frontend 브라우저 테스트

1. Frontend 개발 서버 실행: `http://localhost:5173`
2. Chrome DevTools 열기 → Network 탭
3. MON-002 라인별 상세 화면 접속
4. 차트 Zoom In/Out 수행
5. Network 탭에서 API 호출 확인:
   - 요청 URL: `/facilities/{facilityId}/power/range?...`
   - 요청 파라미터: `startTime`, `endTime`, `interval`
   - 응답 상태: 200 OK
   - 응답 데이터: `{data: [...], metadata: {...}}`

**검증 항목**:
- [ ] API 호출 성공 (HTTP 200)
- [ ] 응답 시간 < 3초
- [ ] 차트에 데이터 정상 표시
- [ ] Zoom Level 변경 시 interval 자동 전환 (15m → 1m → 10s → 1s)
- [ ] 전일 데이터 비교선 표시 (회색 영역)
- [ ] 현재 시각 수직선 표시 (빨간선)

---

### Phase 2: MON-001~006 API 테스트 (HIGH 🔥)

#### 시나리오 2-1: MON-001 종합 현황

**화면**: `http://localhost:5173/monitoring/overview`

```bash
# API 1: KPI 조회
curl "http://localhost:4000/api/monitoring/overview/kpi"

# API 2: 라인 미니 카드
curl "http://localhost:4000/api/monitoring/overview/lines"

# API 3: 시간별 트렌드
curl "http://localhost:4000/api/monitoring/overview/hourly?date=2026-02-20"

# API 4: 알람 요약
curl "http://localhost:4000/api/monitoring/overview/alarms"
```

**검증 항목**:
- [ ] 4개 API 모두 호출 성공
- [ ] KPI 카드 4개 표시 (총 전력, 총 에어, 전력품질, 에어누기)
- [ ] 4개 라인 미니 카드 표시
- [ ] 24시간 트렌드 차트 표시
- [ ] 알람 요약 표시

#### 시나리오 2-2: MON-002 라인별 상세

**화면**: `http://localhost:5173/monitoring/line/block`

```bash
curl "http://localhost:4000/api/monitoring/line/block?date=2026-02-20&interval=60"
```

**검증 항목**:
- [ ] 라인별 상세 차트 표시
- [ ] Dynamic Resolution API와 연동 확인

#### 시나리오 2-3: MON-003~006 순위 화면

```bash
# MON-003: 에너지 순위
curl "http://localhost:4000/api/monitoring/energy-ranking?line=block&type=power"

# MON-004: 에너지 알림 현황
curl "http://localhost:4000/api/monitoring/energy-alert?line=block"

# MON-005: 전력 품질 순위
curl "http://localhost:4000/api/monitoring/power-quality?line=block"

# MON-006: 에어 누기 순위
curl "http://localhost:4000/api/monitoring/air-leak?line=block"
```

**검증 항목**:
- [ ] 4개 API 모두 호출 성공
- [ ] 순위 데이터 정상 표시
- [ ] 신호등 색상 (초록/노랑/빨강) 정상 표시

---

### Phase 3: Settings (Tag Management) API 테스트 (HIGH 🔥)

#### 시나리오 3-1: Factory → Line → Facility → Tag 계층 구조

**화면**: `http://localhost:5173/settings/tag-management`

```bash
# API 1: 전체 계층 구조 조회
curl "http://localhost:4000/api/settings/hierarchy"

# API 2: Factory 목록
curl "http://localhost:4000/api/settings/factory"

# API 3: Line 목록 (특정 Factory)
curl "http://localhost:4000/api/settings/line?factoryId={factoryId}"

# API 4: Tag 목록 (특정 Facility)
curl "http://localhost:4000/api/settings/tag?facilityId={facilityId}&pageSize=10000"
```

**검증 항목**:
- [ ] 계층 구조 정상 표시 (Factory → Line → Facility → Tag)
- [ ] 2,794개 활성 태그 표시
- [ ] 필터링 기능 (tagType, energyType, search)
- [ ] CRUD 기능 (생성, 수정, 삭제)

#### 시나리오 3-2: Tag 일괄 업로드

```bash
# API: 템플릿 다운로드
curl "http://localhost:4000/api/settings/tag/bulk-template" -o template.xlsx

# API: 일괄 업로드
curl -X POST "http://localhost:4000/api/settings/tag/bulk-upload" \
  -F "file=@tags.xlsx"
```

**검증 항목**:
- [ ] 템플릿 다운로드 성공
- [ ] 일괄 업로드 성공
- [ ] 업로드 결과 통계 표시 (성공/실패/경고)

---

### Phase 4: 미구현 API Mock 모드 테스트 (MEDIUM/LOW)

**Dashboard, Alerts, Analysis API**는 현재 미구현 상태이므로, Mock 모드로 Frontend 동작 확인:

1. `.env.local` 파일 수정:
   ```
   VITE_USE_MOCK=true
   ```

2. Frontend 재실행:
   ```bash
   cd apps/web
   pnpm dev
   ```

3. 각 화면 접속하여 Mock 데이터 표시 확인:
   - DSH-001~008: Dashboard 화면
   - ALT-001~006: Alerts 화면
   - ANL-001~005: Analysis 화면
   - SET-008~013: Settings 화면

**검증 항목**:
- [ ] Mock 데이터로 모든 화면 정상 표시
- [ ] 차트/그래프 렌더링 정상
- [ ] UI 인터랙션 정상

---

## ✅ 테스트 체크리스트

### Backend API 서버
- [ ] NestJS 서버 정상 실행 (Port 4000)
- [ ] Swagger UI 접근 가능 (`http://localhost:4000/api`)
- [ ] Database 연결 정상 (TimescaleDB + PostgreSQL)

### Frontend 개발 서버
- [ ] Vite 개발 서버 정상 실행 (Port 5173)
- [ ] `.env.local` 설정 확인 (`VITE_USE_MOCK=false`)
- [ ] API Base URL 확인 (`http://localhost:4000/api`)

### Dynamic Resolution API (CRITICAL 🔥🔥)
- [ ] 15m interval 정상 동작
- [ ] 1m interval 정상 동작
- [ ] 10s interval 정상 동작
- [ ] 1s interval 정상 동작
- [ ] Invalid interval 에러 처리
- [ ] Invalid time range 에러 처리
- [ ] Facility not found 에러 처리
- [ ] Response Caching 동작 확인
- [ ] Data Source Routing 확인 (energy_timeseries, energy_usage_1min, tag_data_raw)

### MON-001~006 APIs (HIGH 🔥)
- [ ] MON-001: 종합 현황 (4개 API)
- [ ] MON-002: 라인별 상세
- [ ] MON-003: 에너지 순위
- [ ] MON-004: 에너지 알림 현황
- [ ] MON-005: 전력 품질 순위
- [ ] MON-006: 에어 누기 순위

### Settings (Tag Management) APIs (HIGH 🔥)
- [ ] Factory 관리 (CRUD)
- [ ] Line 관리 (CRUD)
- [ ] Tag 관리 (CRUD)
- [ ] 계층 구조 조회
- [ ] Tag 일괄 업로드
- [ ] Tag 재할당

### 전체 화면 동작 확인 (32화면)
- [ ] 로그인 화면
- [ ] MON-001~006 (6화면)
- [ ] DSH-001~008 (8화면) - Mock 모드
- [ ] ALT-001~006 (6화면) - Mock 모드
- [ ] ANL-001~005 (5화면) - Mock 모드
- [ ] SET-008~013 (6화면) - 일부 실제 API, 일부 Mock

---

## 🐛 알려진 이슈 및 제약사항

### 1. 미구현 API (41개)
- Dashboard APIs (9개)
- Alerts APIs (7개)
- Analysis APIs (7개)
- Settings 일부 APIs (18개)

**해결 방안**: 우선 Mock 모드로 Frontend 동작 확인, 향후 Backend 구현 필요

### 2. Database 데이터 부족
- 실제 TimescaleDB에 충분한 시계열 데이터가 없을 경우 빈 응답 가능

**해결 방안**:
- 테스트 데이터 생성 스크립트 필요
- 또는 Mock 모드로 대체

### 3. 설비 ID (facilityId) 불일치
- Frontend Mock 데이터: `HNK10-000`, `HNK10-010-1` 등
- Backend Database: 실제 설비 ID 확인 필요

**해결 방안**: Database의 실제 facilityId 확인 후 Frontend에서 사용

---

## 📝 테스트 결과 기록

| 테스트 날짜 | 테스트 항목 | 결과 | 비고 |
|-----------|-----------|------|-----|
| 2026-02-28 | Dynamic Resolution API | ⏳ 진행중 | Phase 1 테스트 예정 |
| | MON-001~006 APIs | ⏳ 대기중 | Phase 2 테스트 예정 |
| | Settings APIs | ⏳ 대기중 | Phase 3 테스트 예정 |

---

## 🎯 다음 단계

1. **Backend API 서버 실행**
   ```bash
   cd d:/AI_PJ/IFEMS/apps/api
   pnpm run start:dev
   ```

2. **test-dynamic-resolution-api.sh 실행**
   ```bash
   cd d:/AI_PJ/IFEMS
   bash test-dynamic-resolution-api.sh
   ```

3. **Frontend 개발 서버 실행**
   ```bash
   cd d:/AI_PJ/IFEMS/apps/web
   pnpm dev
   ```

4. **브라우저에서 수동 테스트**
   - `http://localhost:5173`
   - Chrome DevTools → Network 탭 확인
   - 각 화면 접속 및 기능 테스트

5. **테스트 결과 기록 및 이슈 리포팅**

---

_Last updated: 2026-02-28_
