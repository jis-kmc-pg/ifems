# Backend Dynamic Resolution API Plan

> **Summary**: Frontend 동적 차트 해상도(Progressive Resolution)에 필요한 시계열 데이터를 제공하는 Backend API 구현
>
> **Project**: i-FEMS (설비·에너지 관리시스템)
> **Version**: 1.0.0
> **Author**: AI Assistant
> **Date**: 2026-02-28
> **Status**: Draft
> **Related Frontend**: [동적-차트-해상도](../../../02-design/features/동적-차트-해상도.design.md)

---

## 1. Overview

### 1.1 Background

Frontend "동적-차트-해상도" 기능이 완성되어 Mock 데이터로 동작 중입니다. 4단계 Progressive Resolution (15분→1분→10초→1초)을 지원하는 실제 Backend API가 필요합니다.

**현재 상태**:
- ✅ Frontend 완성: Mock 데이터로 4단계 zoom 동작
- ❌ Backend 미구현: `VITE_USE_MOCK=true` 상태
- 🎯 목표: 실제 TimescaleDB 시계열 데이터 제공

### 1.2 Goals

#### Primary Goals
1. **동적 Interval 지원**: 4가지 interval (15m, 1m, 10s, 1s)로 집계된 데이터 반환
2. **TimescaleDB 연동**: `time_bucket()` 함수로 효율적인 시계열 집계
3. **Metadata 제공**: interval, totalPoints, zoomLevel 등 메타정보 반환
4. **성능 보장**: interval별 인덱스 최적화, 응답 시간 < 300ms

#### Secondary Goals
- Down-sampling 지원 (maxPoints 파라미터)
- 전일 비교 데이터 (prevPower, prevAir) 제공
- Error handling 및 validation

### 1.3 Out of Scope (제외 사항)

- Frontend 수정 (이미 완성)
- 실시간 데이터 스트리밍 (WebSocket)
- 데이터 쓰기 API (조회 전용)
- 권한 인증 (내부 시스템)

---

## 2. Feature Requirements

### 2.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | GET `/api/facilities/:id/power/range` 엔드포인트 | P0 | Pending |
| FR-02 | GET `/api/facilities/:id/air/range` 엔드포인트 | P0 | Pending |
| FR-03 | Query param: startTime (ISO8601) | P0 | Pending |
| FR-04 | Query param: endTime (ISO8601) | P0 | Pending |
| FR-05 | Query param: interval ("15m"\|"1m"\|"10s"\|"1s") | P0 | Pending |
| FR-06 | Query param: maxPoints (optional, down-sampling) | P2 | Pending |
| FR-07 | Response: data (배열, time + power/air) | P0 | Pending |
| FR-08 | Response: metadata (interval, totalPoints, zoomLevel) | P0 | Pending |
| FR-09 | TimescaleDB time_bucket() 집계 | P0 | Pending |
| FR-10 | 전일 비교 데이터 (prevPower, prevAir) | P1 | Pending |
| FR-11 | Error: INVALID_INTERVAL (400) | P1 | Pending |
| FR-12 | Error: INVALID_TIME_RANGE (400) | P1 | Pending |
| FR-13 | Error: FACILITY_NOT_FOUND (404) | P1 | Pending |

### 2.2 Non-Functional Requirements

| ID | Requirement | Target | Status |
|----|-------------|--------|--------|
| NFR-01 | API 응답 시간 | < 300ms (95 percentile) | Pending |
| NFR-02 | Concurrent requests | 100 req/s (동시 사용자 50명) | Pending |
| NFR-03 | Data accuracy | 100% (소수점 2자리) | Pending |
| NFR-04 | Database connection pool | 10~50 connections | Pending |
| NFR-05 | Error logging | Winston + 파일 저장 | Pending |

---

## 3. Technical Specification

### 3.1 API Endpoints

#### Endpoint 1: Power Range Data

```
GET /api/facilities/:facilityId/power/range

Path Parameters:
- facilityId: string (예: "HNK10-000")

Query Parameters:
- startTime: string (ISO8601, 예: "2024-01-01T00:00:00Z")
- endTime: string (ISO8601, 예: "2024-01-01T23:59:59Z")
- interval: "15m" | "1m" | "10s" | "1s"
- maxPoints?: number (optional, 기본: 무제한)

Response (200 OK):
{
  "data": [
    { "time": "08:00:00", "power": 3.4, "prevPower": 3.2 },
    { "time": "08:01:00", "power": 3.5, "prevPower": 3.3 }
  ],
  "metadata": {
    "interval": "1m",
    "totalPoints": 480,
    "returnedPoints": 480,
    "downsampled": false,
    "zoomLevel": 1
  }
}

Error Responses:
- 400 INVALID_INTERVAL: interval이 허용 값 아님
- 400 INVALID_TIME_RANGE: endTime < startTime
- 404 FACILITY_NOT_FOUND: 설비 ID 없음
- 500 DATABASE_ERROR: DB 조회 실패
```

#### Endpoint 2: Air Range Data

```
GET /api/facilities/:facilityId/air/range

(Power와 동일 구조, field명만 air/prevAir)
```

### 3.2 Database Schema

**기존 Hypertable 활용**:
```sql
-- 시계열 데이터 테이블 (이미 존재)
CREATE TABLE energy_timeseries (
  time TIMESTAMPTZ NOT NULL,
  facility_id VARCHAR(50),
  power DOUBLE PRECISION,  -- kWh
  air DOUBLE PRECISION,    -- L
  PRIMARY KEY (time, facility_id)
);

-- Hypertable 설정 (이미 적용됨)
SELECT create_hypertable('energy_timeseries', 'time');

-- 인덱스 (추가 필요)
CREATE INDEX idx_energy_facility_time ON energy_timeseries (facility_id, time DESC);
```

### 3.3 TimescaleDB Aggregation Query

```sql
-- Example: 1분 간격 집계
WITH current_data AS (
  SELECT
    time_bucket('1 minute', time) AS bucket,
    AVG(power) AS power
  FROM energy_timeseries
  WHERE facility_id = 'HNK10-000'
    AND time >= '2024-01-01 00:00:00'
    AND time < '2024-01-02 00:00:00'
  GROUP BY bucket
  ORDER BY bucket
),
prev_data AS (
  SELECT
    time_bucket('1 minute', time) AS bucket,
    AVG(power) AS prev_power
  FROM energy_timeseries
  WHERE facility_id = 'HNK10-000'
    AND time >= '2023-12-31 00:00:00'
    AND time < '2024-01-01 00:00:00'
  GROUP BY bucket
  ORDER BY bucket
)
SELECT
  TO_CHAR(c.bucket, 'HH24:MI:SS') AS time,
  ROUND(c.power::numeric, 2) AS power,
  ROUND(p.prev_power::numeric, 2) AS "prevPower"
FROM current_data c
LEFT JOIN prev_data p ON (c.bucket - INTERVAL '1 day') = p.bucket;
```

### 3.4 Interval Mapping

| Interval | time_bucket() | 예상 포인트 수 (1일) |
|----------|---------------|---------------------|
| `"15m"` | `'15 minutes'` | 96 |
| `"1m"` | `'1 minute'` | 1,440 |
| `"10s"` | `'10 seconds'` | 8,640 |
| `"1s"` | `'1 second'` | 86,400 |

---

## 4. Architecture

### 4.1 Layer Structure

```
Client (Frontend)
      ↓
┌─────────────────────────────────────────┐
│ NestJS Backend API                      │
│                                         │
│  MonitoringController                   │
│    ├─ getPowerRangeData()               │
│    └─ getAirRangeData()                 │
│                  ↓                      │
│  MonitoringService                      │
│    ├─ fetchRangeData()                  │
│    ├─ buildTimeBucketQuery()            │
│    └─ mapToResponse()                   │
│                  ↓                      │
│  PrismaService                          │
│    └─ $queryRaw()                       │
└─────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────┐
│ TimescaleDB / PostgreSQL                │
│  └─ energy_timeseries (Hypertable)      │
└─────────────────────────────────────────┘
```

### 4.2 File Structure

```
apps/api/src/
├── monitoring/
│   ├── monitoring.controller.ts   // 수정: 2개 엔드포인트 추가
│   ├── monitoring.service.ts      // 수정: fetchRangeData() 구현
│   ├── dto/
│   │   ├── range-query.dto.ts     // 신규: Query validation
│   │   └── range-response.dto.ts  // 신규: Response type
│   └── types/
│       └── interval.enum.ts       // 신규: Interval enum
├── prisma/
│   └── prisma.service.ts          // 기존 활용
└── common/
    └── exceptions/
        └── custom-exceptions.ts    // 수정: Custom error types
```

---

## 5. Implementation Plan

### 5.1 Phase Breakdown

#### Phase 1: DTO 및 타입 정의 (30분)
- [ ] `range-query.dto.ts`: Query param validation
- [ ] `range-response.dto.ts`: Response type
- [ ] `interval.enum.ts`: Interval enum
- [ ] Custom exceptions (INVALID_INTERVAL, INVALID_TIME_RANGE)

#### Phase 2: Service 레이어 (2시간)
- [ ] `monitoring.service.ts`: fetchRangeData() 메서드
- [ ] TimescaleDB time_bucket 쿼리 생성 함수
- [ ] 전일 비교 데이터 LEFT JOIN
- [ ] Down-sampling 로직 (maxPoints)
- [ ] Metadata 생성 (interval, totalPoints, zoomLevel)

#### Phase 3: Controller 레이어 (1시간)
- [ ] `monitoring.controller.ts`: 2개 엔드포인트 추가
- [ ] Query param binding (@Query)
- [ ] Path param binding (@Param)
- [ ] Exception handling

#### Phase 4: 테스트 (1시간)
- [ ] Unit test: Service 레이어 (쿼리 생성)
- [ ] Integration test: E2E (실제 DB 조회)
- [ ] Postman/curl로 4가지 interval 테스트

#### Phase 5: Frontend 연동 (30분)
- [ ] `VITE_USE_MOCK=false` 설정
- [ ] Frontend 테스트: 15m → 1m → 10s → 1s 전환
- [ ] 에러 케이스 확인

**Total Estimate**: 5시간

### 5.2 Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| @nestjs/common | 11.x | Controller, Service |
| @nestjs/swagger | 8.x | API 문서화 |
| @prisma/client | 6.19.x | Database client |
| class-validator | 0.14.x | DTO validation |
| class-transformer | 0.5.x | DTO transformation |

(기존 설치됨, 추가 설치 불필요)

---

## 6. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| TimescaleDB 성능 저하 (1초 interval) | HIGH | LOW | 인덱스 최적화, maxPoints 제한 |
| Frontend-Backend 타입 불일치 | MEDIUM | MEDIUM | Design 문서 준수, Gap 분석 |
| 전일 데이터 없음 (신규 설비) | LOW | MEDIUM | NULL 처리, Frontend graceful handling |
| time_bucket 쿼리 오류 | HIGH | LOW | Unit test, SQL 검증 |

---

## 7. Success Criteria

### 7.1 MVP (Minimum Viable Product)

- [ ] 2개 엔드포인트 동작 (power, air)
- [ ] 4가지 interval 정상 동작 (15m, 1m, 10s, 1s)
- [ ] Frontend와 통합 (`VITE_USE_MOCK=false`)
- [ ] 응답 시간 < 500ms (1분 interval 기준)

### 7.2 Quality Gates

- [ ] Unit test coverage > 80%
- [ ] No TypeScript errors
- [ ] API 문서 (Swagger) 자동 생성
- [ ] Error handling 100% (모든 에러 케이스)

### 7.3 Performance Targets

| Interval | Expected Response Time | Max Data Points |
|----------|----------------------|----------------|
| 15m | < 100ms | 96 (1일) |
| 1m | < 200ms | 1,440 (1일) |
| 10s | < 300ms | 8,640 (1일) |
| 1s | < 500ms | 86,400 (1일) |

---

## 8. Dependencies and Prerequisites

### 8.1 Required

- ✅ TimescaleDB Hypertable: `energy_timeseries` (이미 존재)
- ✅ NestJS 11 + Prisma 6.19.2 (이미 설치)
- ✅ Frontend API 스펙 정의: [동적-차트-해상도.design.md](../../../02-design/features/동적-차트-해상도.design.md)

### 8.2 Optional

- [ ] 인덱스 추가: `CREATE INDEX idx_energy_facility_time`
- [ ] 성능 모니터링: Grafana + TimescaleDB 쿼리 분석

---

## 9. Timeline

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Plan | 1h | 2026-02-28 | 2026-02-28 |
| Design | 1h | 2026-02-28 | 2026-02-28 |
| Do (Implementation) | 5h | 2026-02-28 | 2026-02-28 |
| Check (Gap Analysis) | 30min | 2026-02-28 | 2026-02-28 |
| Act (Fix issues) | 1h | 2026-02-28 | 2026-02-28 |
| Report | 30min | 2026-02-28 | 2026-02-28 |

**Total**: 9시간 (1일 완료 예상)

---

## 10. Stakeholders

| Role | Name | Responsibility |
|------|------|----------------|
| Frontend Developer | (완료) | Mock 데이터 → 실제 API 전환 |
| Backend Developer | AI Assistant | API 구현, DB 쿼리 최적화 |
| DB Administrator | (선택) | TimescaleDB 인덱스 추가 |

---

## 11. Related Documents

- Frontend Design: [동적-차트-해상도.design.md](../../../02-design/features/동적-차트-해상도.design.md)
- Frontend Report: [동적-차트-해상도.report.md](../../../04-report/features/동적-차트-해상도.report.md)
- Backend Design: (다음 단계에서 생성)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-28 | Initial plan | AI Assistant |
