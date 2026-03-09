# i-FEMS 개발 계획서 (PLAN)
> 화성 PT4공장 Intelligence Facility & Energy Management System
> 작성일: 2026-02-19 | 최종 수정: 2026-03-05

---

## 1. 프로젝트 개요

기아 화성 PT4공장의 설비/에너지 데이터를 실시간 수집/분석하여, 에너지 낭비 조기 발견 및 설비 이상 자동 감지하는 i-FEMS 구축

### 참조 자료
- `img/be/` — 기존 운영 시스템 화면 (i-FEMS v1)
- `img/plan/` — 신규 화면 구성 계획서

---

## 2. 완료된 Phase 요약

| Phase | 내용 | 완료일 | 비고 |
|-------|------|--------|------|
| Phase 1 | 인프라 + 공통 컴포넌트 | 2026-02 | 라우팅, 레이아웃, UI 컴포넌트 |
| Phase 2 | 로그인 + 모니터링 (7화면) | 2026-02 | MON-001~006 + Login |
| Phase 3 | 대시보드 (8화면) | 2026-02 | DSH-001~008 |
| Phase 4 | 알림 (6화면) | 2026-02 | ALT-001~006 |
| Phase 5 | 분석 (5화면) | 2026-02 | ANL-001~005 |
| Phase 6 | 설정 (6화면) | 2026-02 | SET-001~006 |
| Phase 7 | Backend API (77개) | 2026-02-28 | 91% Match Rate, PDCA 8회 반복 |
| - | Recharts → uPlot 마이그레이션 | 2026-02-25 | 12화면 전환 |
| - | 색상 시스템 통일 | 2026-02-26 | CLAUDE.md 산업 표준 |
| - | Tag Management Phase 1 | 2026-02-23 | SET-008~013, 27+ API |
| - | Dynamic Resolution (MON-002) | 2026-02-28 | 4단계: 15m→1m→10s→1s |
| - | TimescaleDB CA | 2026-03-03 | cagg_usage_1min, cagg_trend_10sec |
| - | Tag Classification 재설계 | 2026-03-04 | MeasureType+TagCategory |
| - | Frontend-Backend 통합 | 2026-03-04 | 98% Match Rate |
| - | **이상 데이터 감지 + 차트 시각화** | 2026-03-05 | DB+Backend+Frontend 13파일 |

**32화면 + 로그인 전체 완료 ✅**
- MON (6) + DSH (8) + ALT (6) + ANL (5) + SET (6) = 32화면

---

## 3. 현재 진행 / 다음 작업

### 즉시
1. **실시간 데이터 수집** — TagDataCollectorService 활성화
2. **Dynamic Resolution 전체 적용** — MON-002 → 11개 화면 확대
   - [Plan](01-plan/features/dynamic-resolution-전체적용.plan.md)
   - [Design](02-design/features/dynamic-resolution-전체적용.design.md)

### 단기
3. **Controller E2E 테스트** — 현재 skeleton
4. **Swagger enum 수정** — Dashboard `power` → `elec` 2건

### 중기
5. **Tag Management Phase 2** — SET-011, Bulk Upload
   - [Plan](01-plan/features/tag-management-phase2.plan.md)
   - [Design](02-design/features/tag-management-phase2.design.md)
6. **WebSocket 실시간 데이터** — Phase 8

---

## 4. PDCA 아카이브

| 프로젝트 | Match Rate | 위치 |
|---------|-----------|------|
| backend-api | 91% | [archive/2026-02/backend-api/](archive/2026-02/backend-api/) |
| backend-dynamic-resolution | 96% | [archive/2026-02/backend-dynamic-resolution/](archive/2026-02/backend-dynamic-resolution/) |
| tag-management | 93% | [archive/2026-02/tag-management/](archive/2026-02/tag-management/) |
| frontend-backend-integration | 98% | [archive/2026-03/frontend-backend-integration/](archive/2026-03/frontend-backend-integration/) |
| tag-classification-redesign | 93% | [archive/2026-03/tag-classification-redesign/](archive/2026-03/tag-classification-redesign/) |

---

*마지막 업데이트: 2026-03-05*
