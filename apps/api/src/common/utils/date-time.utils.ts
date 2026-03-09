// ============================================================
// 날짜/숫자 공통 유틸리티
// ============================================================
// 5개 서비스(monitoring, dashboard, alerts, analysis, usage-aggregate)에서
// 반복되는 날짜 계산, UTC 변환, 반올림, 변화율 계산을 한 곳에서 관리.

import { Prisma } from '@prisma/client';

// ──────────────────────────────────────────────
// 날짜 유틸리티
// ──────────────────────────────────────────────

/** 오늘 00:00:00.000 */
export function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 내일 00:00:00.000 */
export function tomorrowStart(): Date {
  const d = todayStart();
  d.setDate(d.getDate() + 1);
  return d;
}

/** n일 전 00:00:00.000 */
export function daysAgo(n: number, base?: Date): Date {
  const d = base ? new Date(base) : todayStart();
  d.setDate(d.getDate() - n);
  return d;
}

/** n개월 전 00:00:00.000 */
export function monthsAgo(n: number, base?: Date): Date {
  const d = base ? new Date(base) : todayStart();
  d.setMonth(d.getMonth() - n);
  return d;
}

/** 특정 날짜의 다음날 00:00:00.000 */
export function nextDay(base: Date): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ──────────────────────────────────────────────
// Prisma/SQL 유틸리티
// ──────────────────────────────────────────────

/** KST 오프셋 (cagg bucket은 UTC → 한국시간 변환용) */
export const KST_OFFSET = Prisma.raw(`INTERVAL '9 hours'`);

/**
 * JS Date를 UTC timestamp SQL 리터럴로 변환
 * Prisma timestamptz→timestamp 비교 시 TZ 오류 방지
 */
export function toUtcSql(d: Date): Prisma.Sql {
  return Prisma.raw(`'${d.toISOString().slice(0, 19)}'::timestamp`);
}

// ──────────────────────────────────────────────
// 숫자 유틸리티
// ──────────────────────────────────────────────

/** 소수점 n자리 반올림 (기본 2자리) */
export function roundTo(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** 전일/전월 대비 변화율 (%) — 0-safe */
export function changeRate(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}
