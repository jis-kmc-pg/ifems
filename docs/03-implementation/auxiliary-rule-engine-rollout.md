# 부대설비 룰 엔진 — 운영 활성화 가이드

> Phase 2-② RuleEngineService 의 안전한 시범 운영 + 정식 활성화 절차

---

## 1. 활성화 단계 (3단계 권장)

### Stage 1 — DRY_RUN (1주일 권장)
**환경변수**
```
AUX_RULE_ENGINE_ENABLED=true
AUX_RULE_ENGINE_MODE=DRY_RUN
```

**동작**
- Cron(1분 간격)으로 룰 평가 + `fems.control_commands` INSERT 수행
- 단 `result='PENDING'`, `triggeredBy='rule-engine-dryrun'` 로 기록 → **외부 게이트웨이 전달 없음**
- 운영자는 `/aux/control-history` 에서 시뮬레이션 결과 검토 가능

**확인 SQL**
```sql
-- 최근 24h DRY_RUN 발행 통계
SELECT date_trunc('hour', "executedAt") AS hour,
       count(*) AS issued
  FROM fems.control_commands
 WHERE "triggeredBy" = 'rule-engine-dryrun'
   AND "executedAt" >= NOW() - interval '24 hours'
 GROUP BY hour ORDER BY hour DESC;
```

### Stage 2 — LIVE (PoC 기간 적용)
```
AUX_RULE_ENGINE_ENABLED=true
AUX_RULE_ENGINE_MODE=LIVE   # 또는 미설정 (기본=LIVE)
```

**전제 조건 (Stage 1 완료 후)**
- DRY_RUN 결과 시뮬레이션이 예상한 패턴과 일치
- `fems.schedule_rules.effectiveTo` 가 1주일 PoC 기간으로 설정됨 (자동 비활성화 보장)

### Stage 3 — 영구 운영
- Phase 3 작업 완료 후 (`condition` JSONB 평가, occupancy 외부 신호 연동)
- `schedule_rules.effectiveTo` NULL 로 갱신 (또는 장기간)
- 외부 BMS/DDC 게이트웨이 송신 모듈 추가

---

## 2. 안전 정책

### 2.1 PoC 기간
모든 룰은 `effectiveTo` 미설정 시 영원 동작하므로 시범 운영에 위험.
- 마이그레이션 `20260519_aux_rule_poc_window` 가 자동으로 **1주일(2026-05-19 ~ 2026-05-26)** PoC 기간 설정
- 기간 종료 후 룰 비활성화 → 효과 검증 후 갱신

### 2.2 condition JSONB 미평가 (Phase 2 PoC 한계)
현재 룰 엔진은 다음만 평가:
- ✅ `dayOfWeek` 매칭
- ✅ `startTime ~ endTime` (자정 넘김 지원)
- ✅ `effectiveFrom/To`
- ❌ `condition` JSONB (`{"occupancy": false}`, `{"oaTempLt": 18}` 등은 무시)

**시사점**:
- 야간 창고/주차장 룰의 `{"occupancy": false}` condition → 평가되지 않음
- 야간에 사람이 있어도 무조건 OFF 발행 (인터록 효과 없음)
- → **Phase 3에서 외부 occupancy 신호 연동까지 LIVE 전환 보류 권장**

### 2.3 중복 방지
- 같은 ruleId × facilityId × command 가 동일 분(`date_trunc('minute', NOW())`) 내 1회만 발행
- Cron 1분 간격 + 중복 방지 → 매 분 정확히 1개씩

---

## 3. 환경변수 매트릭스

| `ENABLED` | `MODE` | 동작 |
|-----------|--------|------|
| `false` 또는 미설정 | * | **Cron 비활성** (기본) |
| `true` | `DRY_RUN` | 평가 + INSERT(`result=PENDING`, `triggeredBy=rule-engine-dryrun`) — 외부 송신 X |
| `true` | `LIVE` 또는 미설정 | 평가 + INSERT(`result=SUCCESS`, `triggeredBy=rule-engine`) — 게이트웨이 송신 대기 |

`POST /api/aux/rule-engine/run` 은 ENABLED 여부와 무관하게 즉시 1회 실행 (MODE는 적용).

---

## 4. 트러블슈팅

### Q. 룰 엔진 활성화했는데 control_commands가 안 늘어남
1. 현재 시각이 어떤 룰의 시간 조건에도 매칭되지 않음 (대부분 평일 점심/주말/야간이라 빈 시간대 많음)
2. `effectiveFrom/To` 가 오늘 날짜 범위 밖
3. `enabled=false` 인 룰
4. `AUX_RULE_ENGINE_ENABLED` 환경변수 누락

### Q. DRY_RUN 결과 정리
```sql
DELETE FROM fems.control_commands
 WHERE "triggeredBy" = 'rule-engine-dryrun'
   AND "executedAt" < NOW() - interval '7 days';
```

### Q. 특정 룰을 일시 중단
```sql
UPDATE fems.schedule_rules SET enabled=false WHERE name = '평일 점심 사무동 조명 OFF';
```

---

## 5. 활성화 체크리스트

- [ ] `schedule_rules.effectiveTo` 가 적절한 시범 기간으로 설정됨
- [ ] DRY_RUN 모드 1주일 운영 + 결과 검토 완료
- [ ] `condition` JSONB 룰의 의미가 시간 조건만으로 안전한지 검토 (Phase 2 한계)
- [ ] 운영 백엔드 서버에 환경변수 추가 + 재시작
- [ ] 시범 종료 후 효과 분석 → Phase 3 진행 또는 영구 적용 결정

---

## 6. 관련 파일

- `apps/api/src/auxiliary/rule-engine.service.ts` — Cron 워커 본체
- `apps/api/src/auxiliary/auxiliary.controller.ts` — `POST /api/aux/rule-engine/run`
- `apps/api/prisma/migrations/20260519_aux_rule_poc_window/migration.sql` — PoC 기간 설정
- `apps/web/src/pages/auxiliary/AuxControlHistory.tsx` — 발행 이력 화면
