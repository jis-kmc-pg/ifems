# i-FEMS 부대설비(Auxiliary) Phase 1 — Planning Document

> **Summary**: 화성 PT4공장 i-FEMS에 공조(HVAC)·조명(Lighting)·환경(ENV) 부대설비 도메인을 신설.
>
> **Project**: i-FEMS (Intelligence Facility & Energy Management System)
> **Version**: 1.0.0
> **Author**: AI Assistant (Claude) + User
> **Date**: 2026-05-19
> **Status**: Implemented (3848f1f, 3322f05) — `ifems_dev` 검증 완료 + 운영 적용 완료

---

## 1. Overview

### 1.1 Purpose
i-FEMS 핵심 도메인이 본설비(HNK10~40 라인) + 생산 유틸리티(컴프레서/쿨링타워/집진기)에 집중되어 있어, **공장 운영 에너지의 큰 비중을 차지하는 공조·조명**이 사각지대였습니다. Phase 1에서는 부대설비 영역을 i-FEMS 내부 도메인으로 정식 신설하고, 마스터·룰 엔진·감사 이력의 기반을 마련합니다.

### 1.2 Background
**자동차 부품 공장 에너지 분포 (일반적 비율)**
- 본설비(가공·조립): 60-70%
- 생산 유틸리티(컴프레서/쿨링): 10-15%
- **공조(HVAC): 15-25%** ← 사각지대
- **조명(Lighting): 5-10%** ← 사각지대
- 기타: 2-5%

Phase 1만으로 **조명 야간/주말 잔존 점등 제거로 15-30% 즉시 절감** 가능 (대표 ROI 영역).

### 1.3 Naming
- 도메인명: **Auxiliary (부대설비)**
- DB 스키마: **`fems`** (FEMS 시스템 컨벤션 일치)
- URL prefix: **`/api/aux`** (간결성)
- 디렉터리/파일: **`auxiliary`** (Windows reserved name 'AUX' 회피)

---

## 2. Scope

### 2.1 In Scope (Phase 1 — 완료)

**DB**
- `fems` 스키마 신설
- 5개 테이블: `zones` / `schedule_rules` / `control_commands` / `lux_standards` / `energy_baselines`
- `public.facilities.zoneId` 컬럼 (cross-schema FK to `fems.zones`)
- KS A 3011 작업조도 시드 10건

**Backend (NestJS)**
- `AuxModule` 모듈 + `/api/aux/*` 12개 라우트
  - zones: list / tree / get / create / patch / delete
  - lux-standards: list
  - schedule-rules: list / get / create / patch / delete
  - control-commands: list (감사 이력 조회)
- `listZones` 응답에 facility 통계 + 24h 누적 사용량 통합

**Frontend (React + TanStack Query)**
- 6번째 GNB: **"부대설비"**
- 7개 사이드바 메뉴 (공조 종합 / 조명 종합 / Zones / 스케줄 룰 / 조도기준 / 제어 이력)
- 6개 화면:
  - HVC-001 공조 종합 현황 (KPI 4 + Zone 카드)
  - LGT-001 조명 종합 현황 (KPI 4 + Zone 카드 + LPD 계산)
  - SET 공간 마스터 (CRUD + 트리)
  - SET 스케줄 룰 (목록 + 토글 + 삭제)
  - SET 작업조도 기준
  - 제어 명령 이력
- 모의 시계열 데이터 (개발 환경): zone별 24h kWh 표시

**시드 데이터 (PT4공장 기준)**
- zones 15개 (작업장 4 + 사무 3 + 부대 8)
- HVAC 6대 + LIGHTING 11회로
- aux tags 34개 (각 facility 2개 — 운전상태/소비전력)
- schedule_rules 8개 (조명 야간/점심 + 공조 주말)

### 2.2 Out of Scope (Phase 2 이후)
- 실제 BMS·DDC·게이트웨이 연동 (현재는 모의 데이터)
- HVAC/Lighting 상세 트렌드 차트 (TrendChart 통합)
- 룰 엔진 실행 백그라운드 워커 (현재는 룰 등록만)
- 제어 명령 실제 송신 (현재는 이력 테이블만)
- M&V(energy_baselines) 회귀모델 학습 워크플로
- 외기 온도 연동 (이코노마이저)
- 조도 센서 실측 + 작업조도 컴플라이언스 알림

---

## 3. Architecture

### 3.1 Schema 격리 전략
```
i-FEMS DB (PostgreSQL + TimescaleDB)
├── public 스키마 (기존)
│   ├── 본설비       HNK10/20/30/40 라인
│   ├── 생산 유틸리티 UTL: 컴프레서/쿨링타워/집진기
│   ├── 태그·시계열   tags / tag_data_raw / cagg_*
│   ├── 알림·싸이클   alerts / cycle_data / ...
│   └── facilities.zoneId (NULL 허용 — Phase 1에서 추가)
└── fems 스키마 (Phase 1 신설)
    ├── zones             공간 단위 마스터 (계층 구조)
    ├── schedule_rules    자동 운전 룰 엔진
    ├── control_commands  제어 명령 이력 (감사)
    ├── lux_standards     KS A 3011 작업조도 기준
    └── energy_baselines  절감효과 검증 베이스라인
```

### 3.2 cross-schema FK 정책
| FK | 정책 | 이유 |
|----|------|------|
| `fems.zones.factoryId → public.factories.id` | `ON DELETE SET NULL` | 공장 삭제 시 zone은 보존 (재할당 가능) |
| `public.facilities.zoneId → fems.zones.id` | `ON DELETE SET NULL` | zone 삭제 시 설비는 보존 |
| `fems.control_commands.facilityId → public.facilities.id` | `ON DELETE CASCADE` | 설비 삭제 시 이력 함께 삭제 |
| `fems.schedule_rules.targetId` | **논리적 FK (DB 차원 없음)** | polymorphic — `targetScope` 따라 facilities 또는 zones 참조 |

### 3.3 Prisma 통합 보류
`schema.prisma`의 기존 35개 모델이 모두 `public` 기본 스키마를 사용 중. `multiSchema` preview 활성화 시 전체 모델에 `@@schema("public")` 명시 의무 → 광범위 변경 위험. 따라서 Phase 1은 **raw SQL (`$queryRaw`/`$executeRaw`) 로만 접근**하고, 안정화 후 Prisma 모델 통합을 별도 마이그레이션으로 진행.

---

## 4. Data Model

### 4.1 `fems.zones`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT (PK) | gen_random_uuid()::text |
| code | VARCHAR(50) UNIQUE | 'HW4-PROD-A' |
| name | VARCHAR(100) | '블록 라인 작업장' |
| parentId | TEXT NULL | 자기참조 — 계층 구조 |
| factoryId | TEXT NULL | `public.factories.id` 참조 |
| areaSqm | DOUBLE NULL | 면적(㎡) — LPD 계산용 |
| zoneType | VARCHAR(20) | PRODUCTION / OFFICE / CORRIDOR / WAREHOUSE / UTILITY / OUTDOOR / PARKING / LOUNGE |
| metadata | JSONB | 확장용 |

### 4.2 `fems.schedule_rules`
- 시간 조건: `dayOfWeek INT[]`, `startTime TIME`, `endTime TIME`, `effectiveFrom/To DATE`
- 추가 조건: `condition JSONB` (예: `{"oaTempLt": 18, "occupancy": false}`)
- 액션: `action ENUM(ON/OFF/SETPOINT)`, `actionValue JSONB`
- 대상: `targetScope ENUM(FACILITY/ZONE)`, `targetId TEXT` (논리적 FK)
- 운영: `enabled BOOLEAN`, `priority INT`

### 4.3 `fems.control_commands`
- 룰 자동 + 수동 제어 모두 기록
- `source ENUM(SCHEDULE/MANUAL/INTERLOCK/API)`
- `result ENUM(SUCCESS/FAILED/PENDING)`

### 4.4 `fems.lux_standards`
KS A 3011 한국산업표준 기준 (10건 시드):
```
정밀가공 750 / 검사 1000 / 일반가공 300 / 사무 500 / 회의실 500 /
복도 150 / 창고 200 / 주차장 75 / 휴게실 300 / 유틸리티 200
```

### 4.5 `fems.energy_baselines` (Phase 2 활용)
M&V 회귀모델 베이스라인:
- `modelType`: LINEAR / SEASONAL / LOOKUP / REGRESSION
- `coefficients JSONB`: `{"intercept": 12.5, "oaTemp": 0.8, "production": 0.05}`
- `rSquared`: 적합도

---

## 5. Frontend Architecture

### 5.1 GNB 6번째 메뉴
```
모니터링 / 대시보드 / 알림 / 분석 / [부대설비] / 설정
```

### 5.2 사이드바 (`/aux/*`)
```
공조 (HVAC)
  └─ 공조 종합 현황 (HVC-001)
조명 (Lighting)
  └─ 조명 종합 현황 (LGT-001)
설정
  ├─ 공간 마스터 (Zones)
  ├─ 운전 스케줄 룰
  └─ 작업조도 기준
제어 명령 이력
```

### 5.3 화면 라우팅
```
/aux/hvac/overview      → HVC-001
/aux/lighting/overview  → LGT-001
/aux/zones              → 공간 마스터 CRUD
/aux/schedule-rules     → 룰 엔진 관리
/aux/lux-standards      → KS A 3011 기준 조회
/aux/control-history    → 제어 명령 감사
```

---

## 6. KPI Definitions

### 6.1 공조 (HVC-001)
| KPI | 정의 | 산출 |
|-----|------|------|
| 공조 대상 영역 | HVAC가 운영되는 zone 수 | `zoneType IN ('PRODUCTION','OFFICE','CORRIDOR','LOUNGE')` |
| 등록 공조기 | HVAC type 설비 수 | `count(facilities WHERE type='HVAC')` |
| 총 냉방 능력 | metadata.capacityRT 합 | RT |
| 24h 사용량 | POWER tag MAX-MIN 차분 합 | kWh |

### 6.2 조명 (LGT-001)
| KPI | 정의 | 산출 |
|-----|------|------|
| 조명 대상 영역 | 옥외 제외 zone 수 | `zoneType <> 'OUTDOOR'` |
| 등록 회로 수 | LIGHTING facility 수 | count |
| 총 정격 전력 | metadata.ratedW 합 / 1000 | kW |
| 24h 사용량 | POWER tag 차분 합 | kWh |
| **LPD** (zone 카드) | `ratedW / areaSqm` | W/㎡ (12 초과 시 빨강 — LEED/G-SEED 기준) |

---

## 7. Implementation Status

### 7.1 완료
- ✅ DB 스키마 신설 (`20260518_fems_schema_init/migration.sql`)
- ✅ 시드 3종 (`seed.sql`, `seed-facilities.sql`, `seed-mock-timeseries.sql`)
- ✅ Backend NestJS `AuxModule` + 12 API
- ✅ Frontend 6개 화면 + GNB/Sidebar 통합
- ✅ ifems_dev DB 검증 (26 MB, 모든 검증 쿼리 통과)
- ✅ **운영 ifems DB 적용 완료** (59 GB, 백업 보관: `backups/20260519_prod_fems_pre/`)
- ✅ 모의 24h 시계열 + KPI 카드 실데이터 (HVAC 2,717 kWh / LIGHTING 1,339 kWh)
- ✅ 커밋: `3848f1f` (모듈 골격) + `3322f05` (실데이터 연결)

### 7.2 운영 적용 시 검증된 항목
- fems 스키마 + 5 테이블 생성
- public.facilities 345개 모두 zoneId 매핑
- cross-schema FK 5개 정상 작동
- KS A 3011 시드 10건
- HVAC 6대 + LIGHTING 11회로 + aux tags 34개

### 7.3 롤백 절차
```powershell
psql -h localhost -U postgres -d ifems -f apps/api/prisma/migrations/20260518_fems_schema_init/rollback.sql
```
- 트랜잭션 보호, 의존성 역순 (zones / FK / 트리거 / 테이블 / 함수 / 스키마)
- 운영 영향 0 — 신규 객체만 제거

---

## 8. Validation Criteria

| 항목 | 기준 | 결과 |
|------|------|------|
| Schema 생성 | `information_schema` 에 5 테이블 | ✅ |
| cross-schema FK | `pg_constraint` 에 5개 | ✅ |
| KS A 3011 시드 | `fems.lux_standards` 10행 | ✅ |
| 마이그레이션 멱등성 | 재실행 시 ON CONFLICT NO-OP | ✅ |
| Rollback | `rollback.sql` 1회 실행 → 원본 복원 | ✅ |
| Backend tsc | `auxiliary` 모듈 0 errors | ✅ |
| Frontend tsc | `pages/auxiliary` + `services/auxiliary` 0 errors | ✅ |
| API 라우트 | `/api/aux/*` 12개 매핑 | ✅ |
| Frontend build | vite 빌드 통과 | ✅ |

---

## 9. Risk & Mitigation

| 위험 | 영향 | 완화 |
|------|------|------|
| Windows reserved name 'AUX' | git add 실패 | 디렉터리/파일을 `auxiliary` 로 사용 |
| Prisma multi-schema 미활성화 | 모델 자동완성 없음 | raw SQL로 우회, 안정화 후 통합 |
| `targetId` polymorphic FK | DB 무결성 보장 안 됨 | 서비스 레이어에서 검증 |
| 운영 DB 변경 위험 | 시계열 데이터 영향 | 신규 객체만 추가, rollback.sql 준비 |
| 모의 시계열 데이터 | 운영 적용 시 혼란 | ifems_dev 에만 적용, seed-mock-timeseries.sql 명시 |

---

## 10. Next Phase Candidates

### Phase 2
1. **공조/조명 실시간 트렌드 차트** — `TrendChart` + `/api/aux/zones/:id/trend` 신규 API
2. **룰 엔진 실행 워커** — `@nestjs/schedule` Cron으로 룰 평가 → control_commands 발행
3. **외기 온도 연동** — 기상청 API 또는 옥외 센서 → 이코노마이저 조건부 룰
4. **알림 통합** — ALT-007/008/009 (공조/조명 이상 + 인터록 위반)
5. **Prisma 모델 통합** — `multiSchema` 활성화 + `@@schema("fems")` 모델 도입

### Phase 3
6. **M&V 베이스라인 회귀학습** — 일/주 단위 회귀모델 자동 갱신
7. **조도 센서 + 작업조도 컴플라이언스** — 실측 lux vs KS A 3011 기준 위반 알림
8. **출입통제 인터록** — 사람 없으면 자동 OFF (occupancy 조건)
9. **PDCA 절감효과 리포트** — 룰 적용 전/후 절감액 자동 리포트

---

## 11. References

- KS A 3011 (한국산업표준 작업조도)
- LEED/G-SEED LPD 기준 (12 W/㎡)
- IPMVP (M&V 표준)
- CLAUDE.md — i-FEMS 협업 지침
- TAG-DATA-SPEC.md — 태그 종류별 계산 로직

---

## 12. Commits

| Hash | 내용 |
|------|------|
| `3848f1f` | feat: i-FEMS 부대설비 영역(fems 스키마) 도입 + auxiliary 모듈 골격 |
| `3322f05` | feat(aux): HVAC/조명 샘플 시드 + zones 통계 + Frontend 실데이터 연결 |
