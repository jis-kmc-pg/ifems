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
