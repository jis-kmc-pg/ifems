# i-FEMS 도메인 모델 — Site/Factory/Line/Facility + 공장 3대 파트 (유틸리티/공조/조명)

> **Status**: 📝 Draft — 사용자 승인 후 단계적 구현
> **Date**: 2026-05-22
> **Background**: 사용자 정의 도메인 기준 명문화 ("기준을 정해야 할 것 같은데...")

---

## 1. 계층 구조 (4단계)

```
Site (사이트, 신규)
  └─ Factory (공장, 기존)
      └─ Line (라인, 기존)
          └─ Facility (설비, 기존)
```

| 계층 | 정의 | 예시 (화성 PT4) |
|------|------|---------------|
| **Site** | 지리·법인 단위 사이트 (1 site = N factories) | "화성 사업장" |
| **Factory** | 단일 공장 (생산 단위) | PT4공장 (`hw4`) |
| **Line** | 공정 라인 | BLOCK / HEAD / CRANK / ASSEMBLE / UTILITY |
| **Facility** | 개별 설비 | HNK10-020 (블록 가공기), HW4-HVAC-A 등 |

---

## 2. 공장 운영 3대 파트 (모니터링·제어 1차 분류 단위) ⭐

각 Factory는 **유틸리티 / 공조 / 조명** 3개 파트로 운영 관점이 갈린다.
모든 모니터링·대시보드·설정 화면은 이 3개 파트 구분을 기준으로 그룹화.

### 2.1 유틸리티 (Utility)
**관점**: "생산 라인이 얼마나 에너지를 쓰는가"
| 항목 | 데이터 소스 | 비고 |
|------|----------|------|
| 라인별 전력 사용량 (MWh) | `Line` ↔ `Facility` ↔ `Tag(energyType=elec, measureType=CUMULATIVE)` | LAST-FIRST 차분 |
| 라인별 에어 사용량 (Sft³, m³) | 동일 (`energyType=air`) | |
| 라인별 가스 사용량 (선택) | 동일 (`energyType=gas`) | 적용 라인만 |
| 라인별 수도 사용량 (선택) | 동일 (`energyType=water`) | |
| 라인별 사용량 추이 | TimescaleDB `cagg_usage_*` 활용 | 기존 인프라 그대로 |
| 라인별 피크/원단위 | 후속 작업 (M&V) | Phase 4 |

### 2.2 공조 (HVAC)
**관점**: "공장 내 어느 공간(Zone)의 온도가 어떻고, 어느 공조기가 얼마나 쓰는가"
| 항목 | 데이터 소스 | 비고 |
|------|----------|------|
| Zone 트리 (Factory → Zone) | `fems.zones` (`zoneType=PRODUCTION/OFFICE/...`) | 기존 |
| Zone 실내 온도 | `Tag(measureType=INSTANTANEOUS, category=ENVIRONMENT, unit=°F/°C)` | 신규 등록 필요 |
| Zone 설정 온도 (SetPoint) | `Tag(category=CONTROL)` | 신규 |
| Zone별 공조기 (1:N) | `facilities(type='HVAC').zoneId` | 기존 |
| 공조기별 운전 상태 / 전력 사용량 / 인버터 Hz | `tags` | HVAC 6대 등록됨 (모의) |
| 공조기 자동 제어 룰 | `fems.schedule_rules` (targetType=HVAC) | 기존 룰엔진 |

### 2.3 조명 (Lighting)
**관점**: "어느 공간의 어느 회로(Relay)가 켜져 있고, 얼마나 쓰는가"
| 항목 | 데이터 소스 | 비고 |
|------|----------|------|
| Lighting Zone 트리 | `fems.zones` | 기존 |
| Zone별 Relay N개 | **`fems.lighting_relays` (신규)** | LIGHTING facility 안에 Relay 배열 |
| Relay별 ON/OFF | `Tag(measureType=DISCRETE)` 또는 Relay metadata | 게이트웨이 신호 |
| Relay별 스케줄 제어 | `fems.schedule_rules` (targetType=LIGHTING) | 기존 룰엔진, target=Zone 또는 Relay |
| Zone별 전력 사용량 합 | facility/Relay 단위 합산 | |
| Zone별 점등률 (%) | (ON Relay 수 / 전체 Relay 수) | KPI |

---

## 3. DB 변경 계획 (3단계 마이그레이션)

### Migration 1: `20260522_sites_init` — Site 계층 신설
```sql
CREATE TABLE public.sites (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "code"      VARCHAR(50) UNIQUE NOT NULL,
    "name"      VARCHAR(100) NOT NULL,
    "fullName"  TEXT,
    "address"   TEXT,
    "isActive"  BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

ALTER TABLE public.factories ADD COLUMN "siteId" TEXT;
ALTER TABLE public.factories ADD CONSTRAINT "factories_site_fk"
    FOREIGN KEY ("siteId") REFERENCES public.sites("id") ON DELETE SET NULL;

-- 시드: 현재 1개 공장을 단일 site로 묶기
INSERT INTO public.sites (code, name, fullName, address)
VALUES ('hwasung', '화성 사업장', '화성PT4 사업장', '경기도 화성시');

UPDATE public.factories SET "siteId" = (SELECT id FROM public.sites WHERE code='hwasung')
 WHERE "siteId" IS NULL;
```

### Migration 2: `20260522_lighting_relays` — 조명 Relay 세분화
```sql
CREATE TABLE fems.lighting_relays (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "facilityId"    TEXT NOT NULL,                    -- public.facilities (LIGHTING)
    "zoneId"        TEXT,                              -- fems.zones
    "code"          VARCHAR(50) UNIQUE NOT NULL,       -- HW4-LGT-PROD-A-R1
    "name"          VARCHAR(100) NOT NULL,
    "ratedW"        DOUBLE PRECISION,
    "fixtureCount"  INT,
    "fixtureType"   VARCHAR(50),                       -- LED, FL, HID 등
    "onOffTagId"    TEXT,                              -- public.tags (DISCRETE)
    "powerTagId"    TEXT,                              -- public.tags (CUMULATIVE)
    "metadata"      JSONB,
    "order"         INT DEFAULT 0,
    "isActive"      BOOLEAN DEFAULT true,
    "createdAt"     TIMESTAMPTZ DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "lighting_relays_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lighting_relays_facility_fk"
        FOREIGN KEY ("facilityId") REFERENCES public.facilities("id") ON DELETE CASCADE,
    CONSTRAINT "lighting_relays_zone_fk"
        FOREIGN KEY ("zoneId") REFERENCES fems.zones("id") ON DELETE SET NULL
);

CREATE INDEX "lighting_relays_facility_idx" ON fems.lighting_relays("facilityId");
CREATE INDEX "lighting_relays_zone_idx"     ON fems.lighting_relays("zoneId");
```

### Migration 3: `20260522_facility_part_view` — 3대 파트 분류 view (선택)
```sql
CREATE OR REPLACE VIEW public.v_facility_part AS
SELECT
    f.id,
    f.code,
    f.name,
    f."lineId",
    f."zoneId",
    f.type,
    CASE
        WHEN f.type = 'HVAC'                              THEN 'HVAC'
        WHEN f.type = 'LIGHTING'                          THEN 'LIGHTING'
        WHEN f.type IN ('COMPRESSOR','COOLING','DUST_COLLECTOR') THEN 'UTILITY'
        WHEN f.type IN ('MC','MACHINE','LATHE','...')     THEN 'UTILITY'
        ELSE 'UTILITY'
    END AS part
FROM public.facilities f;
```

---

## 4. 사이드바 재구성 안 (3대 파트 일관 적용)

기존 GNB 6개는 그대로 유지, **각 GNB 사이드바 안에서 "유틸리티/공조/조명" 3대 파트가 일관된 그룹으로 등장**.

### 4.1 모니터링 (실시간 현황)
```
종합
  ▸ 종합 현황 (MON-001)
  ▸ 공장 평면도 (MON-007)
유틸리티
  ▸ 라인별 상세 (MON-002)
  ▸ 에너지 사용 순위 (MON-003)
  ▸ 전력 품질 순위 (MON-005)
  ▸ 에어 누기 순위 (MON-006)
  ▸ 에너지 알림 현황 (MON-004)
공조
  ▸ 공조 종합 현황 (HVC-001) ← 기존
  ▸ RTU 평면도 상태 (HVC-002)
조명
  ▸ 조명 종합 현황 (LGT-001)
  ▸ 조명 제어 평면도 (LGT-002)
```

### 4.2 대시보드 (분석 시각화)
```
종합·흐름
  ▸ 에너지 흐름도 (DSH-009)
  ▸ 에너지 사용 추이 (DSH-001)
  ▸ 사용량 분포 (DSH-003)
유틸리티
  ▸ 설비별 추이 (DSH-002)
  ▸ 공정별 순위 (DSH-004)
  ▸ 싸이클당 순위 (DSH-005)
  ▸ Shop 통합 사용량 (DSH-010)
  ▸ 에너지 변화 TOP N (DSH-008)
공조 / 조명 (Phase 4 신규 KPI)
  ▸ (Zone별 사용량 / 효율 등)
리포트
  ▸ 에너지 리포트 (DSH-011)
```

### 4.3 부대설비 GNB
```
공조 (HVAC)
  ▸ 종합 현황
  ▸ RTU 평면도 상태
  ▸ RTU 개별 제어
조명 (Lighting)
  ▸ 종합 현황
  ▸ 조명 제어 평면도
  ▸ Relay 목록 (신규)
이력
  ▸ 제어 명령 이력
```

### 4.4 설정
```
사이트·공장·라인·설비
  ▸ 사이트 관리 (신규)
  ▸ 공장 관리
  ▸ 라인 설정
  ▸ 설비 마스터 관리
  ▸ 설비 유형 관리
태그·에너지
  ▸ (기존)
공조·조명 (Auxiliary)
  ▸ 공간 마스터 (Zones)
  ▸ Lighting Relay 마스터 (신규)
  ▸ 운전 스케줄 룰
  ▸ RTU 운전 스케줄
  ▸ 작업조도 기준
알림·임계값
  ▸ (기존)
```

---

## 5. 핵심 신규 화면 (Phase 단위)

### Phase 1 — 도메인 기준 명문화 (현재 문서) ✅
- 도메인 모델 문서 + 사용자 승인

### Phase 2 — DB 마이그레이션
- `sites` 테이블 + `factories.siteId`
- `fems.lighting_relays` 테이블
- 시드 (PT4 → 단일 site, 11개 LIGHTING facility를 각각 1 Relay로 시드)

### Phase 3 — 사이드바 재구성 + 화면 보강
- 사이드바 4.1~4.4 적용
- **MON-002 라인별 상세 보강** — 라인별 전력/에어 KPI 명시
- **HVC-001 공조 종합 보강** — Zone 트리 + 온도 + 공조기 사용량
- **LGT-001 조명 종합 보강** — Zone 트리 + Relay 목록 + 점등률
- **신규**: SET 사이트 마스터, SET 조명 Relay 마스터

### Phase 4 — KPI 보강 (선택)
- 라인별 사용량 합산 view + KPI
- Zone별 사용량 합산 view + KPI
- 점등률 / 라인별 원단위 등

---

## 6. 기존 데이터 보존 영향도

| 변경 | 기존 데이터 영향 |
|------|--------------|
| `sites` 테이블 추가 | ✅ 0 (신규 객체) |
| `factories.siteId` 추가 | ✅ NULL 허용, 시드로 기본값 채움 |
| `fems.lighting_relays` 추가 | ✅ 0 (신규 객체) |
| `v_facility_part` view | ✅ 0 (view) |
| 사이드바 라벨/그룹 | ✅ 0 (UI만) |
| 기존 화면 (MON/DSH/ANL 등) | ✅ 0 (라우트/API 무변경) |

→ **운영 데이터 영향 0**. 모든 변경은 신규 추가 또는 NULL 허용.

---

## 7. 결정 사항 (사용자 확정)

- [x] **Site 계층**: DB에 sites 테이블 신설 (계층 완성)
- [x] **Lighting Relay**: fems.lighting_relays 신규 테이블
- [x] **GNB 구조**: 기존 6개 GNB 유지 + 3대 파트 그룹 명시화
- [x] **진행 방식**: 도메인 기준 문서 확정 → 단계적 구현

## 8. 다음 진행

이 문서 승인 후 **Phase 2 (DB 마이그레이션)** 부터 단계별로 구현. 각 Phase 마다 별도 PR로 분할.

```
Phase 2 PR: feat(domain): Site 계층 + Lighting Relay 마스터 신설
Phase 3 PR: refactor(ui): 사이드바 3대 파트 그룹화 + 핵심 화면 보강
Phase 4 PR: feat(kpi): 라인·Zone별 사용량 합산 + 점등률 KPI
```
