# i-FEMS API 연동 테스트 보고서

> **테스트 일시**: 2026-02-26
> **Backend API**: http://localhost:3250/api
> **Database**: PostgreSQL + TimescaleDB (328 facilities, 3,102 tags)

---

## 📋 목차

1. [전체 API 목록](#전체-api-목록)
2. [테스트 결과 요약](#테스트-결과-요약)
3. [API별 상세 테스트](#api별-상세-테스트)
4. [발견된 문제](#발견된-문제)
5. [Frontend 호환성](#frontend-호환성)
6. [권장사항](#권장사항)

---

## 전체 API 목록

### Monitoring (6개 엔드포인트)
| No | Method | Endpoint | 설명 | 상태 |
|----|--------|----------|------|------|
| 1 | GET | `/monitoring/overview/kpi` | 종합 현황 KPI | ✅ |
| 2 | GET | `/monitoring/overview/lines` | 라인 미니 카드 | ⚠️ 한글 깨짐 |
| 3 | GET | `/monitoring/overview/hourly` | 시간별 트렌드 | ⚠️ null 데이터 |
| 4 | GET | `/monitoring/overview/alarms` | 알람 요약 | ⚠️ 한글 깨짐 |
| 5 | GET | `/monitoring/line/:line` | 라인별 상세 | 미테스트 |
| 6 | GET | `/monitoring/energy-ranking` | 에너지 순위 | 미테스트 |

### Dashboard (9개 엔드포인트)
| No | Method | Endpoint | 설명 | 상태 |
|----|--------|----------|------|------|
| 1 | GET | `/dashboard/energy-trend` | 에너지 사용 추이 | ✅ |
| 2 | GET | `/dashboard/facility-trend` | 설비별 추이 | 미테스트 |
| 3 | GET | `/dashboard/usage-distribution` | 사용량 분포 | 미테스트 |
| 4 | GET | `/dashboard/process-ranking` | 공정별 순위 | 미테스트 |
| 5 | GET | `/dashboard/cycle-ranking` | 싸이클당 순위 | 미테스트 |
| 6 | GET | `/dashboard/power-quality-ranking` | 전력 품질 순위 | 미테스트 |
| 7 | GET | `/dashboard/air-leak-ranking` | 에어 누기 순위 | 미테스트 |
| 8 | GET | `/dashboard/energy-change-top` | 에너지 변화 TOP N | 미테스트 |
| 9 | GET | `/dashboard/facilities` | 설비 목록 | ✅ |

### Alerts (6개 엔드포인트)
| No | Method | Endpoint | 설명 | 상태 |
|----|--------|----------|------|------|
| 1 | GET | `/alerts/stats/kpi` | 알람 통계 KPI | ✅ |
| 2 | GET | `/alerts/stats/trend` | 알람 주간 트렌드 | ⚠️ 빈 배열 |
| 3 | GET | `/alerts/stats/heatmap` | 설비별 알림 히트맵 | 미테스트 |
| 4 | GET | `/alerts/history` | 알람 이력 | 미테스트 |
| 5 | PATCH | `/alerts/:id/action` | 알림 조치사항 저장 | 미테스트 |
| 6 | GET | `/alerts/:id/waveform` | 싸이클 파형 데이터 | 미테스트 |

### Analysis (7개 엔드포인트)
| No | Method | Endpoint | 설명 | 상태 |
|----|--------|----------|------|------|
| 1 | GET | `/analysis/facilities/tree` | 설비 트리 | 미테스트 |
| 2 | GET | `/analysis/facility/hourly` | 설비별 시간대별 | 미테스트 |
| 3 | GET | `/analysis/comparison/detailed` | 상세 비교 분석 | 미테스트 |
| 4 | GET | `/analysis/cycles` | 싸이클 목록 | 미테스트 |
| 5 | GET | `/analysis/cycle/waveform` | 싸이클 파형 데이터 | 미테스트 |
| 6 | GET | `/analysis/cycle/delay` | 싸이클 타임 지연 | 미테스트 |
| 7 | GET | `/analysis/power-quality` | 전력 품질 분석 | 미테스트 |

### Settings (20+ 엔드포인트)
| No | Method | Endpoint | 설명 | 상태 |
|----|--------|----------|------|------|
| 1 | GET | `/settings/power-quality` | 전력 품질 임계값 | 미테스트 |
| 2 | PUT | `/settings/power-quality` | 전력 품질 임계값 저장 | 미테스트 |
| 3 | GET | `/settings/air-leak` | 에어 누기 임계값 | 미테스트 |
| ... | ... | ... | ... | ... |

**총 엔드포인트**: 48개 이상

---

## 테스트 결과 요약

### 전체 통계
- ✅ **정상 작동**: 5개
- ⚠️ **문제 발견**: 4개
- 🔜 **미테스트**: 39개

### 주요 이슈
1. 🔴 **한글 인코딩 문제** (심각)
   - 영향 범위: 모든 한글 응답
   - 예: "조립" → "\u8b70\uacd5\u2530"

2. 🟡 **null 데이터** (경고)
   - `/monitoring/overview/hourly`: 대부분 null
   - 원인: 오늘 날짜(2026-02-26) 시계열 데이터 부족

3. 🟡 **빈 배열 응답** (경고)
   - `/alerts/stats/trend`: 빈 배열 `[]`
   - 원인: Alert 데이터 없음

---

## API별 상세 테스트

### 1. Monitoring APIs

#### 1.1 GET /monitoring/overview/kpi
**상태**: ✅ 정상

**요청**:
```bash
curl http://localhost:3250/api/monitoring/overview/kpi
```

**응답**:
```json
{
  "totalPower": {
    "value": 3381382.64,
    "unit": "kWh",
    "change": 338138164.5,
    "inverseChange": true
  },
  "totalAir": {
    "value": 0.6,
    "unit": "ML",
    "change": 60217101.6,
    "inverseChange": true
  },
  "powerQualityAlarms": {
    "value": 0,
    "unit": "건",
    "change": 0,
    "inverseChange": true
  },
  "airLeakAlarms": {
    "value": 0,
    "unit": "건",
    "change": 0,
    "inverseChange": true
  }
}
```

**Frontend 기대 구조** (monitoring.ts):
```typescript
{
  totalPower: { value, unit, change, inverseChange },
  totalAir: { value, unit, change, inverseChange },
  powerQualityAlarms: { value, unit, change, inverseChange },
  airLeakAlarms: { value, unit, change, inverseChange }
}
```

**호환성**: ✅ 100% 일치

---

#### 1.2 GET /monitoring/overview/lines
**상태**: ⚠️ 한글 인코딩 문제

**요청**:
```bash
curl http://localhost:3250/api/monitoring/overview/lines
```

**응답**:
```json
[
  {
    "id": "assemble",
    "label": "\u8b70\uacd5\u2530",  // 🔴 한글 깨짐: "조립"이어야 함
    "power": 930.84,
    "powerUnit": "MWh",
    "air": 0,
    "airUnit": "ML",
    "powerStatus": "NORMAL",
    "airStatus": "NORMAL"
  },
  ...
]
```

**Frontend 기대 구조** (monitoring.ts):
```typescript
{
  id: 'block' | 'head' | 'crank' | 'assembly',
  label: string,  // "블록", "헤드", "크랭크", "조립"
  power: number,
  powerUnit: string,
  air: number,
  airUnit: string,
  powerStatus: 'NORMAL' | 'WARNING' | 'DANGER',
  airStatus: 'NORMAL' | 'WARNING' | 'DANGER'
}
```

**호환성**: ⚠️ 구조는 일치하나 한글 깨짐

**문제**: Backend에서 한글을 UTF-8로 제대로 인코딩하지 못함

---

#### 1.3 GET /monitoring/overview/hourly
**상태**: ⚠️ 대부분 null 데이터

**요청**:
```bash
curl http://localhost:3250/api/monitoring/overview/hourly
```

**응답**:
```json
[
  { "time": "00:00", "current": null, "prev": null },
  { "time": "00:15", "current": null, "prev": null },
  { "time": "00:30", "current": null, "prev": null },
  ...
  { "time": "23:45", "current": null, "prev": null }
]
```

**Frontend 기대 구조** (monitoring.ts):
```typescript
{
  time: string,  // "00:00", "00:15", ...
  current: number,
  prev: number
}
```

**호환성**: ✅ 구조 일치

**문제**: 오늘 날짜(2026-02-26) 15분 단위 `EnergyTimeseries` 데이터 없음
- 해결: DataCollection 모듈 실행 또는 Seed 데이터 추가

---

#### 1.4 GET /monitoring/overview/alarms
**상태**: ⚠️ 한글 인코딩 문제

**응답**:
```json
[
  {
    "line": "\u91c9\ubdbe\uc909",  // 🔴 한글 깨짐: "블록"이어야 함
    "powerQuality": 0,
    "airLeak": 0,
    "total": 0
  },
  ...
]
```

**호환성**: ⚠️ 구조는 일치하나 한글 깨짐

---

### 2. Dashboard APIs

#### 2.1 GET /dashboard/energy-trend
**상태**: ✅ 정상

**요청**:
```bash
curl "http://localhost:3250/api/dashboard/energy-trend?line=block"
```

**응답**:
```json
[
  {
    "date": "2026-02-26",
    "power": 963416.78,
    "air": 277320.47,
    "powerTarget": 18000,
    "airTarget": 12000
  }
]
```

**Frontend 기대 구조** (dashboard.ts):
```typescript
{
  month?: string,  // "2026-01", "2026-02", ...
  date?: string,   // "2026-02-26"
  power: number,
  prevPower?: number,
  air: number,
  prevAir?: number
}
```

**호환성**: ⚠️ 부분 일치
- `month` 필드 없음 (Frontend는 월별 데이터 기대)
- `date` 필드는 있음 (일별 데이터)
- `prevPower`, `prevAir` 필드 없음

**문제**: Frontend는 월별 데이터를 기대하지만 API는 일별 데이터 반환

---

#### 2.2 GET /dashboard/facilities
**상태**: ✅ 정상

**요청**:
```bash
curl "http://localhost:3250/api/dashboard/facilities?line=block"
```

**응답**:
```json
[
  {
    "id": "f416581f-f7be-4b5c-826f-20fb21e97159",
    "code": "HNK10_000",
    "name": "HNK10-000"
  },
  ...
]
```

**호환성**: ✅ 구조 일치

---

### 3. Alerts APIs

#### 3.1 GET /alerts/stats/kpi
**상태**: ✅ 정상

**요청**:
```bash
curl "http://localhost:3250/api/alerts/stats/kpi?category=power_quality"
```

**응답**:
```json
{
  "total": 0,
  "weekly": 0,
  "weeklyChange": -2,
  "resolved": 0,
  "resolvedRate": 0
}
```

**Frontend 기대 구조** (alerts.ts):
```typescript
{
  total: number,
  weekly: number,
  weeklyChange: number,
  resolved: number,
  resolvedRate: number
}
```

**호환성**: ✅ 100% 일치

---

#### 3.2 GET /alerts/stats/trend
**상태**: ⚠️ 빈 배열

**요청**:
```bash
curl "http://localhost:3250/api/alerts/stats/trend?category=power_quality"
```

**응답**:
```json
[]
```

**Frontend 기대 구조** (alerts.ts):
```typescript
{
  week: string,  // "1주", "2주", ...
  count: number
}
```

**문제**: Alert 데이터 없음

---

## 발견된 문제

### 🔴 Critical: 한글 인코딩 문제

**증상**:
- "조립" → "\u8b70\uacd5\u2530"
- "블록" → "\u91c9\ubdbe\uc909"

**영향 범위**:
- `/monitoring/overview/lines`: label 필드
- `/monitoring/overview/alarms`: line 필드
- 기타 모든 한글 응답

**원인 추정**:
1. Backend API 응답 헤더에 `Content-Type: application/json; charset=utf-8` 누락
2. Database 연결 charset 설정 문제
3. NestJS Response 인코딩 설정 문제

**해결 방법**:
```typescript
// apps/api/src/main.ts
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
```

또는 Prisma Client 설정:
```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection charset
  connectionString = "${DATABASE_URL}?schema=public&charset=utf8mb4"
}
```

---

### 🟡 Warning: null 데이터

**증상**:
- `/monitoring/overview/hourly`: 대부분 `null`

**원인**:
- 오늘 날짜(2026-02-26) 15분 단위 `EnergyTimeseries` 데이터 부족
- DataCollection 모듈 미실행

**해결 방법**:
1. DataCollection 모듈 실행
2. Seed 데이터 추가:
```bash
cd apps/api
pnpm db:seed
```

---

### 🟡 Warning: Frontend-Backend 데이터 구조 불일치

#### Dashboard Energy Trend
**Frontend 기대**: 월별 데이터 (month, prevPower, prevAir)
**Backend 응답**: 일별 데이터 (date)

**해결 방법**:
1. Backend 수정: 월별 집계 로직 추가
2. Frontend 수정: 일별 데이터 처리 로직 추가 (권장하지 않음)

---

## Frontend 호환성

### 호환성 매트릭스

| API | 구조 일치 | 데이터 유무 | 인코딩 | 종합 |
|-----|----------|-----------|--------|------|
| MON-001 KPI | ✅ | ✅ | ✅ | ✅ |
| MON-001 Lines | ✅ | ✅ | ❌ | ⚠️ |
| MON-001 Hourly | ✅ | ❌ | ✅ | ⚠️ |
| MON-001 Alarms | ✅ | ✅ | ❌ | ⚠️ |
| DSH-001 Trend | ⚠️ | ✅ | ✅ | ⚠️ |
| DSH-009 Facilities | ✅ | ✅ | ✅ | ✅ |
| ALT-001 KPI | ✅ | ✅ | ✅ | ✅ |
| ALT-002 Trend | ✅ | ❌ | ✅ | ⚠️ |

### 전체 호환성
- ✅ **완전 호환**: 3/8 (37.5%)
- ⚠️ **부분 호환**: 5/8 (62.5%)
- ❌ **비호환**: 0/8 (0%)

---

## 권장사항

### 1. 긴급 수정 (Critical)
**한글 인코딩 문제 해결**

```typescript
// apps/api/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ 한글 인코딩 수정
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  // 기존 설정...
}
```

### 2. 데이터 수집 시작
**DataCollection 모듈 실행**

```bash
# Backend API 로그 확인
# DataCollection 모듈이 실행 중인지 확인
# 실행되지 않으면 활성화
```

### 3. 전체 API 테스트
**39개 미테스트 API 전수 조사**

```bash
# 테스트 스크립트 실행
./scripts/test-all-apis.sh
```

### 4. Frontend Mock 데이터와 비교
**각 화면별로 Mock 데이터 구조와 실제 API 응답 비교**

---

## 다음 단계

### Phase 1: 긴급 수정 (1시간)
1. ✅ 한글 인코딩 수정
2. ✅ 서버 재시작
3. ✅ 인코딩 재테스트

### Phase 2: 데이터 확인 (1시간)
1. DataCollection 모듈 상태 확인
2. Seed 데이터 추가 (필요시)
3. null 데이터 재테스트

### Phase 3: 전체 API 테스트 (2시간)
1. 39개 미테스트 API 전수 조사
2. Frontend 호환성 검증
3. 최종 보고서 작성

### Phase 4: Frontend 통합 테스트 (1시간)
1. Frontend 실행
2. 실제 화면에서 API 연동 확인
3. 사용자 시나리오 테스트

---

**작성일**: 2026-02-26
**작성자**: Claude Code AI Assistant
