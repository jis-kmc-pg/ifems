# i-FEMS Backend API

> NestJS 11 + Prisma ORM + PostgreSQL/TimescaleDB

## 실행

```bash
# 루트에서
pnpm dev:api

# 또는 직접
pnpm --filter @ifems/api start:dev
```

- API: http://localhost:4001/api
- Swagger: http://localhost:4001/api/docs

## DB 연결

```
Host: localhost:5432
User: postgres / Password: 1
Database: ifems
```

## 모듈 구조

| 모듈 | API 수 | 경로 |
|------|--------|------|
| Monitoring | 11 | `/api/monitoring/*` |
| Dashboard | 9 | `/api/dashboard/*` |
| Alerts | 7 | `/api/alerts/*` |
| Analysis | 7 | `/api/analysis/*` |
| Settings | 43 | `/api/settings/*` |
| **합계** | **77** | |

## 데이터 수집

- `data-collection/tag-data-collector.service.ts` — 10초 주기 태그 데이터 생성
- `data-collection/energy-aggregator.service.ts` — 15분 Cron 집계

## TimescaleDB

- Hypertable: `tag_data_raw` (90일)
- CA: `cagg_usage_1min`, `cagg_trend_10sec`, `cagg_sensor_10sec`
- 상세: [API-CONTINUOUS-AGGREGATE.md](../../docs/API-CONTINUOUS-AGGREGATE.md)
