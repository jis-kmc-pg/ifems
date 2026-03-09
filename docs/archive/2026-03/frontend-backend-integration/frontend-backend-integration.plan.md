# Frontend-Backend Integration Plan

> **Version**: 1.0
> **Date**: 2026-03-04
> **Feature**: frontend-backend-integration
> **Status**: Plan Phase

---

## 1. 목표

`VITE_USE_MOCK=false`로 전환하여 Frontend 32개 화면이 Backend 77개 API와 실제 연동되도록 통합한다.

### 1.1 현재 상태

| 영역 | 상태 |
|------|------|
| Frontend | 32개 화면 완료 (Mock 데이터 기반) |
| Backend | 77개 API 엔드포인트 완료 (91% Match Rate) |
| 통합 | 미진행 (USE_MOCK=true 고정) |

### 1.2 완료 기준

- [ ] `VITE_USE_MOCK=false` 상태에서 32개 화면 모두 렌더링 성공
- [ ] API 응답 키와 Frontend series/data 키 매핑 100% 일치
- [ ] 에러 상태 (네트워크/401/404/500) 처리 정상
- [ ] Dynamic Resolution 전환이 실제 API에서 동작

---

## 2. 범위 분석

### 2.1 서비스 레이어 (5개 파일, 79개 USE_MOCK 분기)

| 파일 | USE_MOCK 수 | API 호출 수 | 담당 화면 |
|------|:-----------:|:-----------:|----------|
| `monitoring.ts` | 10 | 9 | MON-001~006 |
| `dashboard.ts` | 9 | 9 | DSH-001~008 |
| `alerts.ts` | 7 | 6 | ALT-001~006 |
| `analysis.ts` | 7 | 7 | ANL-001~005 |
| `settings.ts` | 46 | 46 | SET-001~006, SET-011~014 |

### 2.2 환경 설정

| 항목 | 현재 | 목표 |
|------|------|------|
| `VITE_USE_MOCK` | `true` (기본) | `false` |
| `VITE_API_URL` | `http://localhost:4500/api` | `http://localhost:4001/api` |
| Backend port | :4001 | :4001 (변경 없음) |
| CORS | localhost 허용 필요 | 확인 필요 |

### 2.3 API 경로 매핑 (Frontend → Backend)

#### Monitoring

| Frontend 서비스 함수 | API 경로 | Backend Controller |
|---------------------|----------|-------------------|
| `getOverviewKPI()` | `/monitoring/overview/kpi` | `monitoring.controller` |
| `getOverviewHourly()` | `/monitoring/overview/hourly` | `monitoring.controller` |
| `getLineMiniCards()` | `/monitoring/line/mini-cards` | `monitoring.controller` |
| `getLineDetail(lineCode)` | `/monitoring/line/:lineCode/detail` | `monitoring.controller` |
| `getEnergyRanking()` | `/monitoring/energy/ranking` | `monitoring.controller` |
| `getAlarmSummary()` | `/monitoring/alarm-summary` | `monitoring.controller` |
| `getEnergyAlertStatus()` | `/monitoring/energy-alert-status` | `monitoring.controller` |
| `getPowerQualityRanking()` | `/monitoring/power-quality/ranking` | `monitoring.controller` |
| `getAirLeakRanking()` | `/monitoring/air-leak/ranking` | `monitoring.controller` |
| `getDynamicRange(id, metric)` | `/monitoring/range/:id/:metric` | `monitoring.controller` |

#### Dashboard

| Frontend 서비스 함수 | API 경로 | Backend Controller |
|---------------------|----------|-------------------|
| `getEnergyTrend()` | `/dashboard/energy/trend` | `dashboard.controller` |
| `getFacilityTrend()` | `/dashboard/facility/trend` | `dashboard.controller` |
| `getUsageDistribution()` | `/dashboard/usage/distribution` | `dashboard.controller` |
| `getProcessRanking()` | `/dashboard/process/ranking` | `dashboard.controller` |
| `getCycleRanking()` | `/dashboard/cycle/ranking` | `dashboard.controller` |
| `getPowerQualityRanking()` | `/dashboard/power-quality/ranking` | `dashboard.controller` |
| `getAirLeakRanking()` | `/dashboard/air-leak/ranking` | `dashboard.controller` |
| `getEnergyChangeTopN()` | `/dashboard/energy-change/top-n` | `dashboard.controller` |
| `getFacilityList()` | `/dashboard/facility/list` | `dashboard.controller` |

#### Alerts

| Frontend 서비스 함수 | API 경로 | Backend Controller |
|---------------------|----------|-------------------|
| `getAlertStatsKPI()` | `/alerts/stats/kpi` | `alerts.controller` |
| `getAlertTrend()` | `/alerts/trend` | `alerts.controller` |
| `getAlertHistory()` | `/alerts/history` | `alerts.controller` |
| `getAlertDetail(id)` | `/alerts/:id/detail` | `alerts.controller` |
| `getAlertWaveform(id)` | `/alerts/:id/waveform` | `alerts.controller` |
| `saveAlertAction(id, data)` | `/alerts/:id/action` | `alerts.controller` |

#### Analysis

| Frontend 서비스 함수 | API 경로 | Backend Controller |
|---------------------|----------|-------------------|
| `getFacilityTree()` | `/analysis/facility/tree` | `analysis.controller` |
| `getFacilityHourly()` | `/analysis/facility/hourly` | `analysis.controller` |
| `getDetailedComparison()` | `/analysis/comparison/detailed` | `analysis.controller` |
| `getCycleList()` | `/analysis/cycle/list` | `analysis.controller` |
| `getCycleWaveform()` | `/analysis/cycle/waveform` | `analysis.controller` |
| `getCycleTimeDelay()` | `/analysis/cycle/time-delay` | `analysis.controller` |
| `getPowerQualityAnalysis()` | `/analysis/power-quality` | `analysis.controller` |

#### Settings (주요)

| Frontend 서비스 함수 | API 경로 | Backend Controller |
|---------------------|----------|-------------------|
| `getPowerQualitySettings()` | `/settings/power-quality` | `settings.controller` |
| `getTagList()` | `/settings/tag` | `settings.controller` |
| `getEnergyConfigList()` | `/settings/energy-config` | `settings.controller` |
| `getFacilityMasterList()` | `/settings/facility-master` | `settings.controller` |
| `getHierarchy()` | `/settings/hierarchy` | `settings.controller` |
| ... (38개 더) | | |

---

## 3. 핵심 리스크

### 3.1 API 응답 키 불일치 (HIGH)

CLAUDE.md에 문서화된 키 매핑이 정확한지 실제 API 호출로 검증 필요.

| 위험 화면 | series.key | 예상 API 키 | 불일치 시 증상 |
|-----------|-----------|-------------|--------------|
| MON-001 | `current`, `prev` | `current`, `prev` | 빈 차트 |
| MON-002 | `power`, `prevPower`, `air`, `prevAir` | `power`, `prevPower`, `air`, `prevAir` | 빈 차트 |
| DSH-001 | `power`, `prevPower`, `air`, `prevAir` | `power`, `prevPower`, `air`, `prevAir` | 빈 차트 |
| ANL-001 | 동적 (`row[facilityId]`) | `current` | 데이터 미표시 |

### 3.2 API_BASE_URL 불일치 (MEDIUM)

- 현재 기본값: `http://localhost:4500/api`
- 실제 Backend: `http://localhost:4001/api`
- `.env.local`에 `VITE_API_URL=http://localhost:4001/api` 설정 필요

### 3.3 CORS (MEDIUM)

Backend `main.ts`에서 `localhost:3200+` (Vite 개발 서버) 허용 필요.

### 3.4 인증 (LOW)

`apiClient` 인터셉터가 `localStorage.ifems_token`을 읽음. 로그인 화면이 없으면 토큰 없이 401 에러 발생 가능. Backend에서 auth guard가 활성화되어 있는지 확인 필요.

---

## 4. 구현 전략

### Phase 1: 환경 설정 + 연결 확인

1. `.env.local` 파일 수정 (`VITE_USE_MOCK=false`, `VITE_API_URL`)
2. Backend CORS 설정 확인/수정
3. Backend 서버 기동 확인 (`:4001`)
4. 단순 API 1개 호출 테스트 (예: `GET /api/settings/hierarchy`)

### Phase 2: Settings 화면 통합 (43개 API)

Settings는 이미 일부 API 연동 경험이 있음 (tag-classification-redesign). 가장 먼저 안정화.

1. SET-011 (공장/라인/설비 계층)
2. SET-012 (태그 마스터)
3. SET-013 (설비 유형)
4. SET-014 (에너지 소스 매핑)
5. SET-001~006 (설정값 CRUD)

### Phase 3: Monitoring 화면 통합 (11개 API)

핵심 화면. 키 매핑 검증이 가장 중요.

1. MON-001 (종합 현황) - KPI + hourly + mini-cards + alarm-summary
2. MON-002 (라인별 상세) - lineDetail + Dynamic Resolution
3. MON-003~006 (순위 테이블)

### Phase 4: Dashboard 화면 통합 (9개 API)

1. DSH-001 (에너지 추이) - 월별 트렌드
2. DSH-002 (설비별 추이) - 동적 키 매핑
3. DSH-003~008 (분포/순위/TOP-N)

### Phase 5: Alerts 화면 통합 (7개 API)

1. ALT-001~003 (통계 화면)
2. ALT-004~006 (이력 + 모달 파형)

### Phase 6: Analysis 화면 통합 (7개 API)

1. ANL-001 (비교 분석) - 설비 트리 + 시간 데이터
2. ANL-002 (상세 비교) - 오버레이 차트
3. ANL-003~005 (싸이클/전력품질)

### Phase 7: 통합 검증

1. 전체 32개 화면 순회 테스트
2. 에러 핸들링 검증
3. 성능 확인 (API 응답 시간)

---

## 5. 검증 기준

### 5.1 화면별 체크리스트

각 화면에 대해:
- [ ] 페이지 로딩 시 API 호출 성공 (200)
- [ ] 데이터가 올바르게 렌더링됨
- [ ] 차트가 빈 상태가 아닌 실제 데이터 표시
- [ ] 필터/페이지네이션이 API 파라미터로 전달됨
- [ ] 에러 시 적절한 메시지 표시

### 5.2 핵심 매핑 검증

| 화면 | 차트 컴포넌트 | series.key | API 응답 key | 일치 여부 |
|------|-------------|-----------|-------------|:--------:|
| MON-001 | TrendChart | current, prev | ? | 확인 필요 |
| MON-002 | TrendChart | power, prevPower, air, prevAir | ? | 확인 필요 |
| DSH-001 | TrendChart | power, prevPower, air, prevAir | ? | 확인 필요 |
| ANL-001 | TrendChart | 동적 | current→변환 | 확인 필요 |

---

## 6. 의존성

| 항목 | 상태 | 비고 |
|------|:----:|------|
| Backend 77 APIs | ✅ | 91% Match Rate 완료 |
| Frontend 32 화면 | ✅ | Mock 기반 완료 |
| DB 데이터 | ✅ | seed.ts로 325개 설비, 3,107개 태그 |
| API 키 매핑 문서 | ✅ | CLAUDE.md에 전체 테이블 |
| TimescaleDB 연속 집계 | ⚠️ | energy_timeseries, energy_usage_1min 생성 여부 확인 필요 |
| tag_data_raw 실데이터 | ⚠️ | Mock API에서는 generateTimeSeriesData()로 생성, 실 DB에 데이터 있는지 확인 필요 |

---

## 7. 예상 작업량

| Phase | 화면 수 | API 수 | 예상 난이도 |
|-------|:------:|:------:|:---------:|
| Phase 1 (환경 설정) | - | - | LOW |
| Phase 2 (Settings) | 10 | 43 | LOW (기 연동 경험) |
| Phase 3 (Monitoring) | 6 | 11 | HIGH (키 매핑 핵심) |
| Phase 4 (Dashboard) | 8 | 9 | MEDIUM |
| Phase 5 (Alerts) | 6 | 7 | MEDIUM |
| Phase 6 (Analysis) | 5 | 7 | HIGH (동적 키/파형) |
| Phase 7 (통합 검증) | 32 | 77 | LOW |

---

## 8. 산출물

- `.env.local` 수정
- Frontend 서비스 레이어 API 경로 수정 (필요 시)
- Backend 응답 키 수정 (불일치 발견 시)
- 통합 테스트 결과 보고서
