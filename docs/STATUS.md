# i-FEMS Project Status

**Last Updated**: 2026-03-05 KST

---

## 전체 진행률

| 영역 | 진행률 | 상태 |
|------|--------|------|
| Frontend (32화면) | **100%** | 32화면 + 로그인 전체 완료 |
| Backend API (79개) | **100%** | 91% Match Rate, PDCA 아카이브 완료 |
| Frontend ↔ Backend 통합 | **100%** | 98% Match Rate, `VITE_USE_MOCK=false` 전환 완료 |
| TimescaleDB CA | **100%** | cagg_usage_1min / cagg_trend_10sec / cagg_sensor_10sec |
| Dynamic Resolution | **MON-002만** | 전체 적용 Design 문서 준비 완료 |
| Tag Classification | **100%** | MeasureType + TagCategory + CalcMethod 재설계 완료 |
| **이상 데이터 감지** | **100%** | anomaly detection + 차트 시각화 완료 (2026-03-05) |
| 실시간 데이터 수집 | **대기** | TagDataCollectorService 활성화 필요 |

---

## 서버 정보

| 항목 | 값 |
|------|-----|
| Frontend | `pnpm dev:web` → http://localhost:3200+ |
| Backend | `pnpm dev:api` → http://localhost:4001/api |
| Swagger | http://localhost:4001/api/docs |
| DB | localhost:5432 / postgres / `1` / ifems |
| Mock Mode | `VITE_USE_MOCK=false` (API 직접 연결) |

---

## DB 현황 (2026-03-05)

| 테이블 | 행수 | 비고 |
|--------|------|------|
| tag_data_raw | 0 | TRUNCATED — 실시간 수집 서비스로 전환 예정 |
| cagg_usage_1min | 0 | CA 리프레시 완료 |
| cagg_trend_10sec | 0 | CA 리프레시 완료 |
| energy_timeseries | 7,872 | 레거시 (MON-003~006, DSH, ANL용) |
| meter_reset_events | 0 | 리셋+이상 이벤트 통합 (event_type 컬럼 추가) |
| tags | 3,107 | CUMULATIVE 510 + INSTANTANEOUS 767 + 기타 |
| facilities | 325 | 4개 라인 |

---

## 최근 완료 (2026-03-05)

- **이상 데이터 감지 시스템** — 13개 파일, 79 APIs
  - DB 스키마 확장 + corrected view 업데이트
  - ResetDetectorService: 1분 Cron 이상 감지
  - API: RangeDataResponse에 anomalies 필드
  - TrendChart: 이상 구간 반투명 영역 시각화
  - 설정: GET/PUT anomaly-detection 엔드포인트

## 다음 작업 (우선순위 순)

1. **TagDataCollectorService 활성화** — 실시간 데이터 수집 시작
2. **Dynamic Resolution 전체 적용** — MON-002 → 11개 화면 확대
3. **Controller E2E 테스트**
4. **Tag Management Phase 2** — SET-011, Bulk Upload

---

## Quick Links

| 문서 | 용도 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | 협업 지침 + API 키 매핑 |
| [PLAN.md](PLAN.md) | 개발 계획 |
| [TAG-DATA-SPEC.md](TAG-DATA-SPEC.md) | 태그 데이터 사양 |
| [API-CONTINUOUS-AGGREGATE.md](API-CONTINUOUS-AGGREGATE.md) | CA 가이드 |
| [CHANGELOG.md](CHANGELOG.md) | 변경 이력 |

---

## 실행 명령

```bash
pnpm dev:web          # Frontend
pnpm dev:api          # Backend
pnpm tsc --noEmit     # TypeScript 검증
```
