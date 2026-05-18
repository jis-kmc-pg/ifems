# i-FEMS 부대설비 스키마 초기 마이그레이션 (2026-05-18)

> 화성 PT4공장 i-FEMS의 **부대설비** 영역(공조·조명·환경) 도입용 별도 스키마 `fems` 신설.
> 기존 `public` 스키마(본설비 + 생산유틸리티 + 태그/시계열)와 격리하여 핵심 데이터에 영향 없도록 설계.

---

## 🏭 i-FEMS 도메인 위치

```
i-FEMS (전체)
├── public 스키마 (기존)
│   ├── 본설비       HNK10(블록) / HNK20(헤드) / HNK30(크랭크) / HNK40(조립)
│   ├── 생산 유틸리티 컴프레서 / 쿨링타워 / 집진기 (UTL)
│   ├── 태그·시계열   tags / tag_data_raw / cagg_*
│   └── 알림·싸이클   alerts / cycle_data / ...
└── fems 스키마 (신규 — 이 마이그레이션)
    ├── 공조 (HVAC)
    ├── 조명 (Lighting)
    └── 환경 (ENV)
```

---

## 📦 무엇이 만들어지나

### 신규 스키마
- `fems` (i-FEMS 부대설비 영역)

### 신규 테이블 (5개, 모두 `fems` 스키마)

| 테이블 | 역할 |
|--------|------|
| `fems.zones` | 공간 단위 마스터 (공장 → 동 → 층 → 존 계층) |
| `fems.schedule_rules` | 부대설비 자동 운전 스케줄 룰 엔진 (시간/요일/조건부 ON·OFF·SETPOINT) |
| `fems.control_commands` | 제어 명령 이력 (감사 추적용) |
| `fems.lux_standards` | KS A 3011 작업조도 기준 (10개 영역 시드 포함) |
| `fems.energy_baselines` | 에너지 절감효과 검증 베이스라인 (회귀모델 기반 사전/사후 비교) |

### `public` 스키마 변경 (최소)
- `public.facilities` 에 `zoneId UUID NULL` 컬럼 + FK → `fems.zones.id` 추가
- **NULL 허용**이므로 기존 325개 설비 데이터 영향 없음

### 시드 데이터
- `fems.lux_standards` 10행 (KS A 3011 작업조도 기준)

---

## 🚀 실행 방법

### ⚠️ 사전 확인 (필수)

이 worktree(`romantic-mirzakhani-ca1186`)는 루트의 `.env`를 공유합니다.
**실행 시 운영 DB(`localhost:5432/ifems`)에 직접 적용됩니다.**

```powershell
# 1) 백업 (강력 권장)
pg_dump -h localhost -U postgres -d ifems -F c -f ifems_pre_fems_aux_20260518.dump

# 2) fems 스키마 사전 확인 (없어야 함)
psql -h localhost -U postgres -d ifems -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name='fems';"
```

### 방법 A — Prisma 마이그레이션 시스템 사용 (권장)

```powershell
cd apps/api; pnpm prisma migrate deploy
```

> `migrate deploy`는 **drift 감지 없이** 적용된 마이그레이션을 순차 실행합니다.
> 개발 환경에서 `prisma migrate dev`를 쓰면 schema.prisma에 fems 모델이 없어 drift 경고가 발생할 수 있으므로 `deploy` 사용을 권장합니다.

### 방법 B — psql 직접 실행 (완전 격리)

```powershell
psql -h localhost -U postgres -d ifems -f apps/api/prisma/migrations/20260518_fems_schema_init/migration.sql
```

---

## 🔄 롤백

```powershell
psql -h localhost -U postgres -d ifems -f apps/api/prisma/migrations/20260518_fems_schema_init/rollback.sql
```

`rollback.sql`은 트랜잭션으로 묶여 있고, 의존성 역순으로 다음을 수행합니다:
1. `public.facilities.zoneId` 컬럼/FK 제거
2. 트리거 4개 제거
3. `fems.*` 테이블 5개 제거 (CASCADE)
4. `fems.set_updated_at()` 함수 제거
5. `fems` 스키마 자체 제거

---

## ✅ 적용 후 검증 쿼리

```sql
-- 1. 스키마 존재
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'fems';

-- 2. 테이블 5개 모두 생성됐는지
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'fems' ORDER BY table_name;
-- 기대: control_commands, energy_baselines, lux_standards, schedule_rules, zones

-- 3. 시드 데이터 (KS A 3011)
SELECT "zoneType", "requiredLux" FROM fems.lux_standards ORDER BY "requiredLux" DESC;
-- 기대: 10행 (검사 1000 → 주차장 75)

-- 4. cross-schema FK 동작
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='facilities' AND column_name='zoneId';
-- 기대: zoneId / uuid

-- 5. zones 자기참조 + factories 참조 FK
SELECT conname FROM pg_constraint
 WHERE conrelid = 'fems.zones'::regclass;
-- 기대: zones_pkey, zones_code_key, zones_parent_fk, zones_factory_fk, zones_zoneType_check
```

---

## 🧠 Prisma 모델 통합 (선택 / 후속 작업)

이 마이그레이션은 **raw SQL**로만 작성되어 있고 `schema.prisma`에는 모델을 추가하지 않았습니다.
이유:
- `schema.prisma`에 기존 35개 모델이 모두 `public` 스키마 기본값을 사용 중
- `multiSchema` preview feature 활성화 시 모든 기존 모델에 `@@schema("public")` 명시 의무 → 광범위 변경 위험
- 부대설비 도메인은 PoC 단계라 우선 raw SQL로 격리 운영 후, 안정화되면 Prisma 통합

### Prisma 통합이 필요해질 때
1. `schema.prisma`의 `generator`에 `previewFeatures = ["multiSchema"]` 추가
2. `datasource`에 `schemas = ["public","fems"]` 추가
3. 기존 모델 35개에 `@@schema("public")` 추가
4. 신규 부대설비 모델 5개를 `@@schema("fems")` 와 함께 정의
5. `prisma db pull` 로 introspection 후 정합성 확인

### Prisma 미통합 상태에서 부대설비 데이터 접근
- NestJS 서비스 레이어에서 `prisma.$queryRaw`/`$executeRaw` 사용
- 또는 `pg` 라이브러리 직접 사용 (이미 devDependency에 있음)

```typescript
// 예시: NestJS 서비스
const zones = await this.prisma.$queryRaw<Zone[]>`
  SELECT id, code, name, "zoneType", "areaSqm"
    FROM fems.zones
   WHERE "isActive" = true
   ORDER BY code
`;
```

---

## 🔗 cross-schema FK 정책

| 참조 방향 | 정책 | 이유 |
|----------|------|------|
| `fems.zones.factoryId → public.factories.id` | `ON DELETE SET NULL` | 공장 삭제 시 zone은 보존 (재할당 가능) |
| `public.facilities.zoneId → fems.zones.id` | `ON DELETE SET NULL` | zone 삭제 시 설비는 보존 |
| `fems.control_commands.facilityId → public.facilities.id` | `ON DELETE CASCADE` | 설비 삭제 시 이력도 함께 삭제 |
| `fems.schedule_rules.targetId` | **논리적 FK (DB FK 없음)** | targetScope에 따라 facilities 또는 zones를 참조하므로 DB 차원 FK 불가 — 서비스 레이어에서 검증 |

---

## 📋 다음 단계

1. **시드 보강** — PT4공장 실제 구역 매핑 (현장 도면 기준 `fems.zones` 데이터 입력)
2. **NestJS 모듈 신설** — `apps/api/src/aux/` (zones, schedule, control 컨트롤러/서비스)
3. **Frontend GNB 확장** — 부대설비(공조/조명/환경) 메뉴 추가
4. **PDCA Plan 문서** — `docs/01-plan/features/aux-phase1.plan.md` (조명 우선)

---

## 🔖 관련 표준

- 작업조도 기준: KS A 3011 (한국산업표준)
- 에너지 베이스라인 회귀모델: 생산량·외기온도 보정 회귀식 (i-FEMS 자체 정의)
