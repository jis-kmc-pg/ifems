// ============================================================
// SQL 쿼리 공통 헬퍼
// ============================================================
// 문자열 보간 SQL Injection 방지: Prisma.sql 파라미터화 사용
// dashboard, alerts, analysis 서비스의 lineCondition 패턴 통합

import { Prisma } from '@prisma/client';

/**
 * 안전한 라인 필터 (SQL Injection 방지)
 * Before: `AND l.code = '${line.toUpperCase()}'` ← 취약
 * After:  Prisma.sql`AND l.code = ${line}` ← 안전
 */
export function lineFilter(line?: string): Prisma.Sql {
  if (!line) return Prisma.empty;
  return Prisma.sql`AND l.code = ${line.toUpperCase()}`;
}

/**
 * 안전한 설비 필터 (SQL Injection 방지)
 * Before: Prisma.raw(`AND f.id = '${facilityId}'`) ← 취약
 * After:  Prisma.sql`AND f.id = ${facilityId}` ← 안전
 */
export function facilityFilter(facilityId?: string): Prisma.Sql {
  if (!facilityId) return Prisma.empty;
  return Prisma.sql`AND f.id = ${facilityId}`;
}

/**
 * 안전한 설비 코드 필터
 */
export function facilityCodeFilter(facilityId?: string): Prisma.Sql {
  if (!facilityId) return Prisma.empty;
  return Prisma.sql`AND f.code = ${facilityId}`;
}

// ──────────────────────────────────────────────
// TimescaleDB time_bucket 헬퍼
// ──────────────────────────────────────────────

/** 지원하는 모든 집계 간격 */
export type BucketInterval =
  | '1s' | '10sec' | '1min' | '5min' | '1hour' | '1day';

/**
 * interval 문자열을 PostgreSQL time_bucket INTERVAL 리터럴로 변환
 *
 * trend-aggregate, usage-aggregate, monitoring 서비스의
 * 동일 getBucketSize() 함수를 통합한 단일 소스
 */
export function getBucketSize(interval: BucketInterval): string {
  const map: Record<BucketInterval, string> = {
    '1s':    "INTERVAL '1 second'",
    '10sec': "INTERVAL '10 seconds'",
    '1min':  "INTERVAL '1 minute'",
    '5min':  "INTERVAL '5 minutes'",
    '1hour': "INTERVAL '1 hour'",
    '1day':  "INTERVAL '1 day'",
  };
  return map[interval];
}

// ──────────────────────────────────────────────
// 에너지 타입 / 상태 필터
// ──────────────────────────────────────────────

/**
 * 에너지 타입 필터 (elec | air)
 */
export function energyTypeFilter(type?: string): Prisma.Sql {
  if (!type) return Prisma.empty;
  return Prisma.sql`AND energy_type = ${type}`;
}

/**
 * 날짜 범위 필터 (bucket 기준)
 */
export function dateRangeFilter(startTime: string, endTime: string): Prisma.Sql {
  return Prisma.sql`AND bucket >= ${startTime}::timestamp AND bucket < ${endTime}::timestamp`;
}

/**
 * 알림 상태 필터 (ACTIVE | ACKNOWLEDGED | RESOLVED)
 */
export function alertStatusFilter(status?: string): Prisma.Sql {
  if (!status) return Prisma.empty;
  return Prisma.sql`AND status = ${status}`;
}
