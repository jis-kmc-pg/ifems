// ============================================================
// 날짜/숫자 공통 유틸리티 — date-time.utils.ts
// ============================================================
//
// [목적]
//   5개 서비스(monitoring, dashboard, alerts, analysis, usage-aggregate)에서
//   반복되는 날짜 계산, UTC 변환, 반올림, 변화율 계산을 한 곳에서 관리.
//
// [사용 서비스]
//   monitoring.service.ts  : todayStart, daysAgo, nextDay, startOfDay, toDateStr, kstNow, toUtcSql, KST_OFFSET, roundTo
//   dashboard.service.ts   : todayStart, tomorrowStart, daysAgo, monthsAgo, startOfDay, toDateStr, kstNow, toUtcSql, KST_OFFSET, roundTo, changeRate
//   alerts.service.ts      : todayStart, daysAgo, roundTo, changeRate
//   analysis.service.ts    : todayStart, daysAgo, startOfDay, roundTo, toUtcSql, KST_OFFSET
//   usage-aggregate.service: todayStart, daysAgo, nextDay
//   settings.service.ts    : toDateStr
//
// [날짜 관련 주의사항]
//   - DB의 tag_data_raw.timestamp 컬럼은 `timestamp without time zone` (UTC 저장)
//   - PostgreSQL session timezone = Asia/Seoul
//   - `::timestamptz` 캐스트 시 9시간 오프셋이 자동 적용되므로 `::timestamp` 사용 필수
//   - toUtcSql()은 이 문제를 방지하기 위해 `::timestamp` 캐스트를 사용
//   - kstNow()는 UTC 기준 + 9시간 오프셋으로 한국 시간 계산

import { Prisma } from '@prisma/client';

// ──────────────────────────────────────────────
// 날짜 유틸리티
// ──────────────────────────────────────────────

/**
 * 오늘 자정 (00:00:00.000)
 *
 * 현재 날짜의 시작 시점을 반환.
 * 일일 집계 쿼리의 시작 범위로 자주 사용됨.
 *
 * @example
 * ```ts
 * const today = todayStart();
 * // 2026-03-12T00:00:00.000 (로컬 타임존)
 * ```
 */
export function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 내일 자정 (00:00:00.000)
 *
 * 오늘의 종료 시점 = 내일의 시작.
 * 하루 범위 쿼리의 endTime으로 사용 (exclusive).
 *
 * @example
 * ```ts
 * // WHERE timestamp >= todayStart() AND timestamp < tomorrowStart()
 * ```
 */
export function tomorrowStart(): Date {
  const d = todayStart();
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * N일 전 자정 (00:00:00.000)
 *
 * @param n    - 이전 일수 (1 = 어제, 7 = 일주일 전)
 * @param base - 기준 날짜 (생략 시 오늘)
 *
 * @example
 * ```ts
 * const weekAgo = daysAgo(7);            // 7일 전 00:00
 * const twoDaysBeforeDate = daysAgo(2, specificDate); // 특정일 기준 2일 전
 * ```
 */
export function daysAgo(n: number, base?: Date): Date {
  const d = base ? new Date(base) : todayStart();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * N개월 전 자정 (00:00:00.000)
 *
 * 월별 트렌드 쿼리의 시작 범위 계산에 사용.
 * JavaScript의 setMonth()가 월말 오버플로우를 자동 처리함에 주의.
 *
 * @param n    - 이전 개월 수
 * @param base - 기준 날짜 (생략 시 오늘)
 *
 * @example
 * ```ts
 * const yearAgo = monthsAgo(12);   // 12개월 전 00:00
 * const start = monthsAgo(13);     // DSH-001 에너지 트렌드: 14개월 범위
 * ```
 */
export function monthsAgo(n: number, base?: Date): Date {
  const d = base ? new Date(base) : todayStart();
  d.setMonth(d.getMonth() - n);
  return d;
}

/**
 * 특정 날짜의 다음날 자정 (00:00:00.000)
 *
 * 단일 일자 범위 쿼리의 endTime 계산에 사용.
 *
 * @param base - 기준 날짜
 *
 * @example
 * ```ts
 * // 특정 날짜 하루 범위: startTime = base, endTime = nextDay(base)
 * const start = new Date('2026-03-10');
 * const end = nextDay(start); // 2026-03-11T00:00:00.000
 * ```
 */
export function nextDay(base: Date): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 임의 날짜의 자정 (00:00:00.000) — todayStart()의 범용 버전
 *
 * API에서 받은 날짜 문자열을 해당일 00:00으로 정규화할 때 사용.
 * todayStart()는 항상 '오늘'이지만, 이 함수는 임의 날짜를 처리.
 *
 * [기존 패턴]
 *   const targetDate = date ? new Date(date) : new Date();
 *   targetDate.setHours(0, 0, 0, 0);
 *   → 4개 서비스에서 6회 반복
 *
 * [개선]
 *   const targetDate = startOfDay(date);
 *   → 1줄로 동일 결과
 *
 * @param date - 날짜 (Date 객체 또는 ISO 문자열, 생략 시 현재 시각)
 *
 * @example
 * ```ts
 * startOfDay('2026-03-12')        // 2026-03-12T00:00:00.000
 * startOfDay(new Date())          // 오늘 00:00:00.000
 * startOfDay()                    // 오늘 00:00:00.000 (인자 없음)
 * ```
 */
export function startOfDay(date?: Date | string): Date {
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Date 객체를 'YYYY-MM-DD' 문자열로 변환
 *
 * ISO 8601 문자열의 앞 10자리를 추출하여 날짜만 반환.
 *
 * [기존 패턴]
 *   date.toISOString().split('T')[0]
 *   date.toISOString().slice(0, 10)
 *   → 3개 서비스에서 5회 반복
 *
 * @param date - 변환할 Date 객체
 * @returns 'YYYY-MM-DD' 형식 문자열
 *
 * @example
 * ```ts
 * toDateStr(new Date('2026-03-12T15:30:00Z')) // '2026-03-12'
 * ```
 */
export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 현재 한국 표준시 (KST, UTC+9)
 *
 * 서버가 UTC 기준으로 동작할 때 한국 날짜/요일을 판단하기 위해 사용.
 * 주로 ProductionCalendar 조회나 dayType(weekday/saturday/sunday) 판별에 필요.
 *
 * [기존 패턴]
 *   const now = new Date();
 *   const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
 *   → 2개 서비스에서 동일 코드 반복
 *
 * [주의]
 *   이 함수는 Date 객체를 반환하지만, 실제로는 UTC 시각에 9시간을 더한 값.
 *   .toISOString()으로 문자열 변환 시 KST 날짜의 YYYY-MM-DD를 얻을 수 있음.
 *   하지만 .getHours() 등은 로컬 타임존의 영향을 받으므로 주의 필요.
 *
 * @returns UTC+9 시각의 Date 객체
 *
 * @example
 * ```ts
 * const kst = kstNow();
 * const todayStr = toDateStr(kst);   // 한국 시간 기준 오늘 날짜
 * const dow = kst.getDay();           // 한국 시간 기준 요일 (0=일, 6=토)
 * ```
 */
export function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

// ──────────────────────────────────────────────
// Prisma/SQL 유틸리티
// ──────────────────────────────────────────────

/**
 * KST 오프셋 SQL 리터럴 — `INTERVAL '9 hours'`
 *
 * TimescaleDB의 Continuous Aggregate(cagg) bucket은 UTC 기준.
 * 한국 시간(KST) 기준으로 일자를 구분하려면 bucket에 9시간을 더해야 함.
 *
 * @example
 * ```sql
 * DATE(c.bucket + INTERVAL '9 hours') as day_bucket
 * -- Prisma:
 * DATE(c.bucket + ${KST_OFFSET}) as day_bucket
 * ```
 */
export const KST_OFFSET = Prisma.raw(`INTERVAL '9 hours'`);

/**
 * JS Date를 UTC timestamp SQL 리터럴로 변환
 *
 * tag_data_raw.timestamp 컬럼이 `timestamp without time zone`이므로
 * Prisma에서 비교할 때 `::timestamptz`가 아닌 `::timestamp`로 캐스트해야 함.
 * `::timestamptz` 사용 시 PostgreSQL이 session timezone(Asia/Seoul)을 적용하여
 * 9시간 오프셋이 발생하는 버그가 있었음 (2026-03-11 수정).
 *
 * @param d - 변환할 Date 객체
 * @returns `'2026-03-12T00:00:00'::timestamp` 형식의 Prisma.Sql
 *
 * @example
 * ```ts
 * const targetUtc = toUtcSql(todayStart());
 * // → Prisma.raw("'2026-03-12T00:00:00'::timestamp")
 * // SQL: WHERE bucket >= '2026-03-12T00:00:00'::timestamp
 * ```
 */
export function toUtcSql(d: Date): Prisma.Sql {
  return Prisma.raw(`'${d.toISOString().slice(0, 19)}'::timestamp`);
}

// ──────────────────────────────────────────────
// 숫자 유틸리티
// ──────────────────────────────────────────────

/**
 * 소수점 N자리 반올림
 *
 * 부동소수점 연산 오차를 방지하기 위해 10^n 곱셈 → 반올림 → 나눗셈 방식 사용.
 * 에너지 사용량, 변화율, 비용 등 표시 데이터의 정밀도 제어에 사용.
 *
 * @param value    - 반올림할 숫자
 * @param decimals - 소수점 자릿수 (기본: 2)
 * @returns 반올림된 숫자
 *
 * @example
 * ```ts
 * roundTo(3.14159)       // 3.14
 * roundTo(3.14159, 3)    // 3.142
 * roundTo(100.5, 0)      // 101
 * ```
 */
export function roundTo(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * 전일/전월 대비 변화율 (%) — 0-safe
 *
 * 이전 값이 0일 때 division by zero를 방지하기 위해 0을 반환.
 * 음수 이전 값도 정확히 처리하기 위해 Math.abs() 사용.
 *
 * @param current  - 현재 값
 * @param previous - 이전 값 (0이면 변화율 0 반환)
 * @returns 변화율 (%) — 양수=증가, 음수=감소
 *
 * @example
 * ```ts
 * changeRate(120, 100)  // 20 (%)
 * changeRate(80, 100)   // -20 (%)
 * changeRate(100, 0)    // 0 (division by zero 방지)
 * ```
 */
export function changeRate(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}
