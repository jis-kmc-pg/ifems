import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { todayStart, tomorrowStart, daysAgo, monthsAgo, roundTo, changeRate, toUtcSql, KST_OFFSET, startOfDay, toDateStr, kstNow } from '../common/utils/date-time.utils';
import { lineFilter, facilityFilter } from '../common/utils/query-helpers';

/** 간단한 TTL 캐시 엔트리 */
interface CacheEntry<T> {
  data: T;
  expires: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  /** 메서드별 TTL 캐시 (대시보드 — 느린 쿼리용) */
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly prisma: PrismaService) {}

  /** 캐시 조회/저장 헬퍼 (ttlMs 기본 60초) */
  private getCached<T>(key: string, ttlMs = 60_000): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (entry && entry.expires > Date.now()) return entry.data;
    return null;
  }
  private setCache<T>(key: string, data: T, ttlMs = 60_000): T {
    this.cache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  }

  // DSH-001: 에너지 사용 추이 (월별 집계, 최대 14개월)
  async getEnergyTrend(line?: string) {
    this.logger.log(`Fetching energy trend for line: ${line || 'all'}`);

    try {
      // 14개월 전부터 현재 월까지
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 13);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      // 전년 동기 비교 범위
      const prevYearStart = new Date(startDate);
      prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
      const prevYearEnd = new Date();
      prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);

      const lineCondition = lineFilter(line);
      const startDateUtc = toUtcSql(startDate);
      const prevYearStartUtc = toUtcSql(prevYearStart);
      const prevYearEndUtc = toUtcSql(prevYearEnd);

      // 4개 병렬: DIFF/INTEGRAL_TRAP × 현재14개월/전년 (VIEW 우회)
      const [diffMonthly, integralMonthly, diffPrevYear, integralPrevYear] = await Promise.all([
        // DIFF 현재 14개월: cagg_usage_1d (1min→1d CA 승격)
        this.prisma.$queryRaw<any[]>`
          SELECT TO_CHAR(sub.mb, 'YYYY-MM') as month, sub.energy_type,
            SUM(sub.tag_usage) as usage
          FROM (
            SELECT c.energy_type::text, DATE_TRUNC('month', c.bucket + ${KST_OFFSET}) as mb,
              GREATEST(0, LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket)) as tag_usage
            FROM cagg_usage_1d c
            JOIN facilities f ON c."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE c.bucket >= ${startDateUtc} AND c.last_value IS NOT NULL ${lineCondition}
            GROUP BY c."tagId", c.energy_type, DATE_TRUNC('month', c.bucket + ${KST_OFFSET})
          ) sub GROUP BY sub.mb, sub.energy_type ORDER BY sub.mb
        `,
        // INTEGRAL_TRAP 현재 14개월
        this.prisma.$queryRaw<any[]>`
          SELECT TO_CHAR(DATE_TRUNC('month', t.bucket + ${KST_OFFSET}), 'YYYY-MM') as month, t.energy_type::text,
            SUM(CASE WHEN t.energy_type = 'elec' THEN t.sum_value / 60.0
                     WHEN t.energy_type = 'air' THEN t.sum_value ELSE t.sum_value / 60.0 END) as usage
          FROM cagg_trend_usage_1d t
          JOIN facilities f ON t."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE t.bucket >= ${startDateUtc}
            AND EXISTS (SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId" AND fec."energyType"::text = t.energy_type::text
              AND fec."calcMethod" = 'INTEGRAL_TRAP' AND fec."isActive" = true)
            ${lineCondition}
          GROUP BY DATE_TRUNC('month', t.bucket + ${KST_OFFSET}), t.energy_type
          ORDER BY DATE_TRUNC('month', t.bucket + ${KST_OFFSET})
        `,
        // DIFF 전년
        this.prisma.$queryRaw<any[]>`
          SELECT TO_CHAR(sub.mb, 'YYYY-MM') as month, sub.energy_type,
            SUM(sub.tag_usage) as usage
          FROM (
            SELECT c.energy_type::text, DATE_TRUNC('month', c.bucket + ${KST_OFFSET}) as mb,
              GREATEST(0, LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket)) as tag_usage
            FROM cagg_usage_1d c
            JOIN facilities f ON c."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE c.bucket >= ${prevYearStartUtc} AND c.bucket < ${prevYearEndUtc}
              AND c.last_value IS NOT NULL ${lineCondition}
            GROUP BY c."tagId", c.energy_type, DATE_TRUNC('month', c.bucket + ${KST_OFFSET})
          ) sub GROUP BY sub.mb, sub.energy_type ORDER BY sub.mb
        `,
        // INTEGRAL_TRAP 전년
        this.prisma.$queryRaw<any[]>`
          SELECT TO_CHAR(DATE_TRUNC('month', t.bucket + ${KST_OFFSET}), 'YYYY-MM') as month, t.energy_type::text,
            SUM(CASE WHEN t.energy_type = 'elec' THEN t.sum_value / 60.0
                     WHEN t.energy_type = 'air' THEN t.sum_value ELSE t.sum_value / 60.0 END) as usage
          FROM cagg_trend_usage_1d t
          JOIN facilities f ON t."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE t.bucket >= ${prevYearStartUtc} AND t.bucket < ${prevYearEndUtc}
            AND EXISTS (SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId" AND fec."energyType"::text = t.energy_type::text
              AND fec."calcMethod" = 'INTEGRAL_TRAP' AND fec."isActive" = true)
            ${lineCondition}
          GROUP BY DATE_TRUNC('month', t.bucket + ${KST_OFFSET}), t.energy_type
          ORDER BY DATE_TRUNC('month', t.bucket + ${KST_OFFSET})
        `,
      ]);

      // DIFF + INTEGRAL_TRAP 병합 (월별)
      const mergeMonthly = (diffRows: any[], integralRows: any[]) => {
        const map = new Map<string, { power: number; air: number }>();
        for (const rows of [diffRows, integralRows]) {
          for (const r of rows) {
            const entry = map.get(r.month) || { power: 0, air: 0 };
            const val = Number(r.usage || 0);
            if (r.energy_type === 'elec') entry.power += val;
            else if (r.energy_type === 'air') entry.air += val;
            map.set(r.month, entry);
          }
        }
        return map;
      };
      const monthlyMap = mergeMonthly(diffMonthly, integralMonthly);
      const prevYearMap = mergeMonthly(diffPrevYear, integralPrevYear);

      // monthlyMap → monthlyData 형태로 변환
      const monthlyData = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, power: data.power, air: data.air }));
      const prevYearData = Array.from(prevYearMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, power: data.power, air: data.air }));

      // 전년 동월 매핑 (YYYY-MM → 동월)
      const prevDataMap = new Map(
        prevYearData.map((d) => [
          String(d.month),
          { power: Number(d.power || 0), air: Number(d.air || 0) },
        ])
      );

      return monthlyData.map((d) => {
        const month = String(d.month);
        // 전년 동월: '2026-02' → '2025-02'
        const [y, m] = month.split('-');
        const prevYearMonth = `${parseInt(y) - 1}-${m}`;
        const prevData = prevDataMap.get(prevYearMonth) || { power: 0, air: 0 };

        return {
          month,
          power: Number(d.power || 0),
          air: Number(d.air || 0),
          prevPower: prevData.power,
          prevAir: prevData.air,
          powerTarget: 18000,
          airTarget: 12000,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching energy trend:', error);
      throw error;
    }
  }

  // DSH-002: 설비별 추이 → { dates[], facilities[{ code, name, powerData[], airData[] }] }
  async getFacilityTrend(line?: string, facilityId?: string) {
    this.logger.log(`Fetching facility trend for line: ${line}, facilityId: ${facilityId}`);

    try {
      const today = todayStart();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const lineCondition = lineFilter(line);
      const facilityCondition = facilityFilter(facilityId);
      const sevenDaysAgoUtc = toUtcSql(sevenDaysAgo);

      // 2개 병렬: DIFF + INTEGRAL_TRAP (VIEW 우회)
      const [diffDaily, integralDaily] = await Promise.all([
        // DIFF: cagg_usage_1h 직접
        this.prisma.$queryRaw<any[]>`
          SELECT sub.day_bucket as date, f.code, f.name, sub.energy_type,
            SUM(sub.tag_usage) as usage
          FROM (
            SELECT c."facilityId", c.energy_type::text, DATE(c.bucket + ${KST_OFFSET}) as day_bucket,
              GREATEST(0, LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket)) as tag_usage
            FROM cagg_usage_1h c
            JOIN facilities f ON c."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE c.bucket >= ${sevenDaysAgoUtc} AND c.last_value IS NOT NULL
              ${lineCondition} ${facilityCondition}
            GROUP BY c."tagId", c."facilityId", c.energy_type, DATE(c.bucket + ${KST_OFFSET})
          ) sub
          JOIN facilities f ON sub."facilityId" = f.id
          GROUP BY sub.day_bucket, f.code, f.name, sub.energy_type
          ORDER BY date, f.code
        `,
        // INTEGRAL_TRAP: cagg_trend_usage_1h 직접
        this.prisma.$queryRaw<any[]>`
          SELECT DATE(t.bucket + ${KST_OFFSET}) as date, f.code, f.name, t.energy_type::text,
            SUM(CASE WHEN t.energy_type = 'elec' THEN t.sum_value / 60.0
                     WHEN t.energy_type = 'air' THEN t.sum_value ELSE t.sum_value / 60.0 END) as usage
          FROM cagg_trend_usage_1h t
          JOIN facilities f ON t."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE t.bucket >= ${sevenDaysAgoUtc}
            AND EXISTS (SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId" AND fec."energyType"::text = t.energy_type::text
              AND fec."calcMethod" = 'INTEGRAL_TRAP' AND fec."isActive" = true)
            ${lineCondition} ${facilityCondition}
          GROUP BY DATE(t.bucket + ${KST_OFFSET}), f.code, f.name, t.energy_type
          ORDER BY date, f.code
        `,
      ]);

      // DIFF + INTEGRAL_TRAP 병합 → dailyData 형태
      const dailyMerge = new Map<string, { date: any; code: string; name: string; power: number; air: number }>();
      for (const rows of [diffDaily, integralDaily]) {
        for (const r of rows) {
          const key = `${r.date}_${r.code}`;
          const entry = dailyMerge.get(key) || { date: r.date, code: r.code, name: r.name, power: 0, air: 0 };
          const val = Number(r.usage || 0);
          if (r.energy_type === 'elec') entry.power += val;
          else if (r.energy_type === 'air') entry.air += val;
          dailyMerge.set(key, entry);
        }
      }
      const dailyData = Array.from(dailyMerge.values())
        .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.code.localeCompare(b.code));

      // 피벗: dates[] + facilities[] 구조로 변환
      const datesSet = new Set<string>();
      const facilityMap = new Map<string, { code: string; name: string; powerMap: Map<string, number>; airMap: Map<string, number> }>();

      for (const row of dailyData) {
        const dateStr = row.date instanceof Date ? toDateStr(row.date) : String(row.date);
        datesSet.add(dateStr);

        if (!facilityMap.has(row.code)) {
          facilityMap.set(row.code, {
            code: row.code,
            name: row.name,
            powerMap: new Map(),
            airMap: new Map(),
          });
        }

        const f = facilityMap.get(row.code)!;
        f.powerMap.set(dateStr, Number(row.power || 0));
        f.airMap.set(dateStr, Number(row.air || 0));
      }

      const dates = Array.from(datesSet).sort();
      const facilities = Array.from(facilityMap.values()).slice(0, 5).map((f) => ({
        code: f.code,
        name: f.name,
        powerData: dates.map((d) => Math.round((f.powerMap.get(d) || 0) * 10) / 10),
        airData: dates.map((d) => Math.round(f.airMap.get(d) || 0)),
      }));

      return { dates, facilities };
    } catch (error) {
      this.logger.error('Error fetching facility trend:', error);
      throw error;
    }
  }

  // DSH-003: 사용량 분포
  // Frontend expects: { powerProcessing: [{name, value}], powerNonProcessing, airProcessing, airNonProcessing }
  async getUsageDistribution(line?: string, start?: string, end?: string, date?: string) {
    this.logger.log(`Fetching usage distribution for line: ${line}, start: ${start}, end: ${end}, date: ${date}`);

    try {
      let rangeStart: Date;
      let rangeEnd: Date;

      if (start && end) {
        // start/end 범위 쿼리 (우선)
        rangeStart = new Date(start);
        rangeEnd = new Date(end);
      } else {
        // 하위 호환: 단일 date → 해당일 00:00~익일 00:00
        rangeStart = startOfDay(date);
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + 1);
      }

      const lineCondition = lineFilter(line);
      const targetDateUtc = toUtcSql(rangeStart);
      const nextDayUtc = toUtcSql(rangeEnd);

      // 공정별 전력/에어 합계 — hourly CA 직접 조회 (VIEW 바이패스)
      const processData = await this.prisma.$queryRaw<any[]>`
        WITH tag_usage AS (
          SELECT u."facilityId", u.energy_type,
            GREATEST(0, LAST(u.last_value, u.bucket) - FIRST(u.first_value, u.bucket)) as usage
          FROM cagg_usage_1h u
          JOIN facilities f ON u."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE u.bucket >= ${targetDateUtc} AND u.bucket < ${nextDayUtc}
            ${lineCondition}
          GROUP BY u."facilityId", u.energy_type
          UNION ALL
          SELECT t."facilityId", t.energy_type,
            SUM(CASE WHEN t.energy_type = 'elec'::"EnergyType" THEN t.sum_value / 60.0 ELSE t.sum_value END) as usage
          FROM cagg_trend_usage_1h t
          JOIN facilities f ON t."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE t.bucket >= ${targetDateUtc} AND t.bucket < ${nextDayUtc}
            ${lineCondition}
            AND EXISTS (
              SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
            )
          GROUP BY t."facilityId", t.energy_type
        )
        SELECT
          f.process,
          f."isProcessing",
          SUM(CASE WHEN tu.energy_type::text = 'elec' THEN tu.usage ELSE 0 END) as power,
          SUM(CASE WHEN tu.energy_type::text = 'air' THEN tu.usage ELSE 0 END) as air
        FROM tag_usage tu
        JOIN facilities f ON tu."facilityId" = f.id
        GROUP BY f.process, f."isProcessing"
        ORDER BY power DESC
      `;

      const powerProcessing: { name: string; value: number }[] = [];
      const powerNonProcessing: { name: string; value: number }[] = [];
      const airProcessing: { name: string; value: number }[] = [];
      const airNonProcessing: { name: string; value: number }[] = [];

      for (const row of processData) {
        const processName = row.process || 'OP00';
        const power = Number(row.power || 0);
        const air = Number(row.air || 0);
        const isProc = row.isProcessing;

        if (isProc) {
          if (power > 0) powerProcessing.push({ name: processName, value: Math.round(power * 10) / 10 });
          if (air > 0) airProcessing.push({ name: processName, value: Math.round(air) });
        } else {
          if (power > 0) powerNonProcessing.push({ name: processName, value: Math.round(power * 10) / 10 });
          if (air > 0) airNonProcessing.push({ name: processName, value: Math.round(air) });
        }
      }

      // 빈 배열 방지
      if (powerNonProcessing.length === 0) powerNonProcessing.push({ name: '기타', value: 0 });
      if (airNonProcessing.length === 0) airNonProcessing.push({ name: '기타', value: 0 });

      return { powerProcessing, powerNonProcessing, airProcessing, airNonProcessing };
    } catch (error) {
      this.logger.error('Error fetching usage distribution:', error);
      throw error;
    }
  }

  // DSH-004: 공정별 순위
  async getProcessRanking(line?: string, type?: string) {
    this.logger.log(`Fetching process ranking for line: ${line}, type: ${type}`);

    try {
      const today = todayStart();

      const lineCondition = lineFilter(line);
      const todayUtc = toUtcSql(today);

      // 전일 데이터도 조회
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayUtc = toUtcSql(yesterday);

      // 4개 병렬: DIFF/INTEGRAL_TRAP × 당일/전일 (VIEW 우회)
      const [diffToday, integralToday, diffYesterday, integralYesterday] = await Promise.all([
        // DIFF 당일
        this.prisma.$queryRaw<any[]>`
          SELECT f.process, sub.energy_type, SUM(sub.tag_usage) as usage
          FROM (
            SELECT c."facilityId", c.energy_type::text,
              GREATEST(0, LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket)) as tag_usage
            FROM cagg_usage_1h c
            JOIN facilities f ON c."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE c.bucket >= ${todayUtc} AND c.last_value IS NOT NULL ${lineCondition}
            GROUP BY c."tagId", c."facilityId", c.energy_type
          ) sub
          JOIN facilities f ON sub."facilityId" = f.id
          GROUP BY f.process, sub.energy_type
        `,
        // INTEGRAL_TRAP 당일
        this.prisma.$queryRaw<any[]>`
          SELECT f.process, t.energy_type::text,
            SUM(CASE WHEN t.energy_type = 'elec' THEN t.sum_value / 60.0
                     WHEN t.energy_type = 'air' THEN t.sum_value ELSE t.sum_value / 60.0 END) as usage
          FROM cagg_trend_usage_1h t
          JOIN facilities f ON t."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE t.bucket >= ${todayUtc}
            AND EXISTS (SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId" AND fec."energyType"::text = t.energy_type::text
              AND fec."calcMethod" = 'INTEGRAL_TRAP' AND fec."isActive" = true)
            ${lineCondition}
          GROUP BY f.process, t.energy_type
        `,
        // DIFF 전일
        this.prisma.$queryRaw<any[]>`
          SELECT f.process, sub.energy_type, SUM(sub.tag_usage) as usage
          FROM (
            SELECT c."facilityId", c.energy_type::text,
              GREATEST(0, LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket)) as tag_usage
            FROM cagg_usage_1h c
            JOIN facilities f ON c."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE c.bucket >= ${yesterdayUtc} AND c.bucket < ${todayUtc}
              AND c.last_value IS NOT NULL ${lineCondition}
            GROUP BY c."tagId", c."facilityId", c.energy_type
          ) sub
          JOIN facilities f ON sub."facilityId" = f.id
          GROUP BY f.process, sub.energy_type
        `,
        // INTEGRAL_TRAP 전일
        this.prisma.$queryRaw<any[]>`
          SELECT f.process, t.energy_type::text,
            SUM(CASE WHEN t.energy_type = 'elec' THEN t.sum_value / 60.0
                     WHEN t.energy_type = 'air' THEN t.sum_value ELSE t.sum_value / 60.0 END) as usage
          FROM cagg_trend_usage_1h t
          JOIN facilities f ON t."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE t.bucket >= ${yesterdayUtc} AND t.bucket < ${todayUtc}
            AND EXISTS (SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId" AND fec."energyType"::text = t.energy_type::text
              AND fec."calcMethod" = 'INTEGRAL_TRAP' AND fec."isActive" = true)
            ${lineCondition}
          GROUP BY f.process, t.energy_type
        `,
      ]);

      // DIFF + INTEGRAL_TRAP 병합 (공정별)
      const mergeProcess = (diffRows: any[], integralRows: any[]) => {
        const map = new Map<string, { power: number; air: number }>();
        for (const rows of [diffRows, integralRows]) {
          for (const r of rows) {
            const entry = map.get(r.process) || { power: 0, air: 0 };
            const val = Number(r.usage || 0);
            if (r.energy_type === 'elec') entry.power += val;
            else if (r.energy_type === 'air') entry.air += val;
            map.set(r.process, entry);
          }
        }
        return map;
      };
      const todayMap = mergeProcess(diffToday, integralToday);
      const yesterdayMap = mergeProcess(diffYesterday, integralYesterday);

      const ranking = Array.from(todayMap.entries())
        .map(([process, data]) => ({ process, power: data.power, air: data.air }))
        .sort((a, b) => b.power - a.power);
      const prevRanking = yesterdayMap;

      return ranking.map((r) => {
        const prevData = yesterdayMap.get(r.process) || { power: 0, air: 0 };
        return {
          process: r.process || 'OP00',
          power: r.power,
          air: r.air,
          prevPower: prevData.power,
          prevAir: prevData.air,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching process ranking:', error);
      throw error;
    }
  }

  // DSH-005: 싸이클당 순위 (기간별, 기본 7일)
  // CYCLE_STD_MST_MMS + CYCLE_MMS_MAPPING 기반 실제 생산 싸이클 데이터
  // 기준(STAND_YN=1) 대비 편차(%)가 큰 설비 순으로 정렬
  async getCycleRanking(line?: string, startDate?: string, endDate?: string) {
    // 기간 계산 (기본: 최근 7일)
    const endStr = endDate || new Date().toISOString().slice(0, 10);
    const startStr = startDate || new Date(new Date(endStr).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const cacheKey = `cycle-ranking:${line || 'all'}:${startStr}:${endStr}`;
    const cached = this.getCached<any[]>(cacheKey, 300_000);
    if (cached) {
      this.logger.log(`Cycle ranking cache hit: ${cacheKey}`);
      return cached;
    }
    this.logger.log(`DSH-005 cycle ranking: ${startStr} ~ ${endStr}, line=${line || 'all'}`);

    try {
      // 날짜: CYCLE_STD_MST_MMS.START_DT는 varchar ('YYYY-MM-DD HH:mm:ss.SSS')
      const lineCode = line ? line.toUpperCase() : null;

      // ── 3개 쿼리를 병렬 실행 (9.5s → ~5s) ──
      // 1) 태그별 통계 (COUNT 집계, DISTINCT 불필요 → 1.2s)
      // 2) 기준 통계 (partial index → ~3ms)
      // 3) 설비별 싸이클 수 (COUNT DISTINCT → ~3.7s)
      type TagStats = { MACH_ID: number; TAG_NAME: string; avg_duration_ms: number | null; normal_cnt: number; anomaly_cnt: number; total_cnt: number };
      type RefRow = { code: string; ref_duration_ms: number | null };
      type CycleCountRow = { code: string; cycle_count: number };

      // endStr 다음 날 (START_DT < endNext → endStr 포함)
      const endNext = new Date(new Date(endStr).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const [tagStats, refStats, cycleCounts] = await Promise.all([
        // 태그별 집계 (GROUP BY MACH_ID, TAG_NAME → PK 최적화, 빠름)
        this.prisma.$queryRawUnsafe<TagStats[]>(`
          SELECT c."MACH_ID", c."TAG_NAME",
            AVG(c."DIFF_DESC")::float as avg_duration_ms,
            SUM(CASE WHEN c."STAND_YN" = 2 THEN 1 ELSE 0 END)::int as normal_cnt,
            SUM(CASE WHEN c."STAND_YN" = 3 THEN 1 ELSE 0 END)::int as anomaly_cnt,
            COUNT(*)::int as total_cnt
          FROM "CYCLE_STD_MST_MMS" c
          WHERE c."START_DT" >= $1 AND c."START_DT" < $2
          GROUP BY c."MACH_ID", c."TAG_NAME"
        `, startStr, endNext),

        // 기준값 (STAND_YN=1 partial index → 즉시)
        this.prisma.$queryRawUnsafe<RefRow[]>(`
          SELECT m."MCN_CD" as code, AVG(c."DIFF_DESC")::float as ref_duration_ms
          FROM "CYCLE_STD_MST_MMS" c
          JOIN "CYCLE_MMS_MAPPING" m ON c."MACH_ID" = m."MACH_ID" AND c."TAG_NAME" = m."TAG_NAME"
          WHERE c."STAND_YN" = 1
          GROUP BY m."MCN_CD"
        `),

        // 설비별 싸이클(소재) 수 (DISTINCT 필요)
        this.prisma.$queryRawUnsafe<CycleCountRow[]>(`
          SELECT code, COUNT(*)::int as cycle_count FROM (
            SELECT DISTINCT m."MCN_CD" as code, c."MATERIAL_ID"
            FROM "CYCLE_STD_MST_MMS" c
            JOIN "CYCLE_MMS_MAPPING" m ON c."MACH_ID" = m."MACH_ID" AND c."TAG_NAME" = m."TAG_NAME"
            WHERE c."START_DT" >= $1 AND c."START_DT" < $2
          ) sub
          GROUP BY code
        `, startStr, endNext),
      ]);

      // ── JS 매핑: MACH_ID+TAG_NAME → MCN_CD (mapping 테이블 캐시) ──
      const mappingCacheKey = 'cycle-mapping';
      let mapping = this.getCached<Array<{ MACH_ID: number; TAG_NAME: string; MCN_CD: string }>>(mappingCacheKey, 600_000);
      if (!mapping) {
        mapping = await this.prisma.$queryRawUnsafe<Array<{ MACH_ID: number; TAG_NAME: string; MCN_CD: string }>>(
          `SELECT "MACH_ID", "TAG_NAME", "MCN_CD" FROM "CYCLE_MMS_MAPPING"`,
        );
        this.setCache(mappingCacheKey, mapping, 600_000);
      }
      const tagToCode = new Map<string, string>();
      for (const m of mapping) tagToCode.set(`${m.MACH_ID}|${m.TAG_NAME}`, m.MCN_CD);

      // ── 설비별 통계 집계 (JS에서 MCN_CD 기준으로 merge) ──
      const facilityMap = new Map<string, { avgDuration: number[]; normalCnt: number; anomalyCnt: number; totalCnt: number }>();
      for (const ts of tagStats) {
        const code = tagToCode.get(`${ts.MACH_ID}|${ts.TAG_NAME}`);
        if (!code) continue;
        let entry = facilityMap.get(code);
        if (!entry) {
          entry = { avgDuration: [], normalCnt: 0, anomalyCnt: 0, totalCnt: 0 };
          facilityMap.set(code, entry);
        }
        if (ts.avg_duration_ms != null) entry.avgDuration.push(ts.avg_duration_ms);
        entry.normalCnt += ts.normal_cnt;
        entry.anomalyCnt += ts.anomaly_cnt;
        entry.totalCnt += ts.total_cnt;
      }

      // ref_stats → Map
      const refMap = new Map<string, number>();
      for (const r of refStats) if (r.ref_duration_ms != null) refMap.set(r.code, r.ref_duration_ms);

      // cycleCounts → Map
      const countMap = new Map<string, number>();
      for (const c of cycleCounts) countMap.set(c.code, c.cycle_count);

      // ── facilities + lines 조회 (캐시, 라인 필터 적용) ──
      const facCacheKey = 'facilities-with-lines';
      let facilities = this.getCached<Array<{ code: string; name: string; process: string; lineCode: string }>>(facCacheKey, 600_000);
      if (!facilities) {
        facilities = await this.prisma.$queryRawUnsafe<Array<{ code: string; name: string; process: string; lineCode: string }>>(`
          SELECT f.code, f.name, COALESCE(f.process, 'OP00') as process, l.code as "lineCode"
          FROM facilities f JOIN lines l ON f."lineId" = l.id
        `);
        this.setCache(facCacheKey, facilities, 600_000);
      }

      // ── 결과 조립 ──
      const results: Array<{
        code: string; name: string; process: string;
        cycleEnergy: number | null; cycleTime: number | null;
        refEnergy: number | null; refCycleTime: number | null;
        deviation: number; dailyTotal: number; cycleCount: number;
        status: 'NORMAL' | 'WARNING' | 'DANGER';
      }> = [];

      for (const f of facilities) {
        if (lineCode && f.lineCode !== lineCode) continue;
        const stats = facilityMap.get(f.code);
        if (!stats) continue;
        const cycleCount = countMap.get(f.code) || 0;
        if (cycleCount === 0) continue;

        const avgDuration = stats.avgDuration.length > 0
          ? stats.avgDuration.reduce((a, b) => a + b, 0) / stats.avgDuration.length
          : null;
        const cycleTime = avgDuration != null ? roundTo(avgDuration / 1000, 1) : null;
        const refDurationMs = refMap.get(f.code);
        const refCycleTime = refDurationMs != null ? roundTo(refDurationMs / 1000, 1) : null;

        let deviation = 0;
        if (cycleTime != null && refCycleTime != null && refCycleTime > 0) {
          deviation = roundTo(((cycleTime - refCycleTime) / refCycleTime) * 100, 1);
        }

        const absDev = Math.abs(deviation);
        const anomalyRate = stats.totalCnt > 0 ? stats.anomalyCnt / stats.totalCnt : 0;

        let status: 'NORMAL' | 'WARNING' | 'DANGER';
        if (absDev > 15 || anomalyRate > 0.8) status = 'DANGER';
        else if (absDev > 10 || anomalyRate > 0.5) status = 'WARNING';
        else status = 'NORMAL';

        results.push({
          code: f.code,
          name: f.name,
          process: f.process,
          cycleEnergy: null,
          cycleTime,
          refEnergy: null,
          refCycleTime,
          deviation,
          dailyTotal: 0,
          cycleCount,
          status,
        });
      }

      // |편차| 큰 순 정렬 + 순위
      results.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
      const ranked = results.map((r, i) => ({ rank: i + 1, ...r }));
      return this.setCache(cacheKey, ranked, 300_000); // 5분 캐시 (대용량 테이블 쿼리)
    } catch (error) {
      this.logger.error('Error fetching cycle ranking:', error);
      throw error;
    }
  }

  // DSH-006: 전력 품질 순위
  // Frontend expects: PowerQualityData[] = { facilityId, code, name, process, unbalanceRate, unbalanceLimit, powerFactor, powerFactorLimit, status, rankUnbalance, rankPowerFactor }
  async getPowerQualityRanking(line?: string) {
    this.logger.log(`Fetching power quality ranking for line: ${line}`);

    const cacheKey = `pq-ranking:${line || 'all'}`;
    const cached = this.getCached<any[]>(cacheKey, 300_000);
    if (cached) return cached;

    try {
      const today = todayStart();

      const lineCondition = lineFilter(line);
      const todayUtc = toUtcSql(today);

      // 센서 데이터 (cagg_sensor_10sec: imbalance, powerFactor)
      const ranking = await this.prisma.$queryRaw<any[]>`
        SELECT
          f.id as "facilityId",
          f.code,
          f.name,
          f.process,
          COALESCE(AVG(CASE WHEN s.sensor_name = 'imbalance' THEN s.avg_value END), 0) as "unbalanceRate",
          COALESCE(AVG(CASE WHEN s.sensor_name = 'powerFactor' THEN s.avg_value END), 0) as "powerFactor"
        FROM facilities f
        JOIN lines l ON f."lineId" = l.id
        LEFT JOIN cagg_sensor_10sec s ON f.id = s."facilityId" AND s.bucket >= ${todayUtc}
        WHERE 1=1
          ${lineCondition}
        GROUP BY f.id, f.code, f.name, f.process
        ORDER BY AVG(CASE WHEN s.sensor_name = 'imbalance' THEN s.avg_value END) DESC NULLS LAST
        LIMIT 20
      `;

      // 불평형률 순위 계산
      const sortedByUnbalance = [...ranking].sort((a, b) => Number(b.unbalanceRate || 0) - Number(a.unbalanceRate || 0));
      const sortedByPF = [...ranking].sort((a, b) => Number(a.powerFactor || 0) - Number(b.powerFactor || 0));

      const result = ranking.map((r) => {
        const unbalanceRate = Number(r.unbalanceRate || 0);
        const powerFactor = Number(r.powerFactor || 0) * 100; // DB에서 0~1 범위로 저장됨
        const pf = powerFactor > 100 ? powerFactor / 100 : powerFactor; // 이미 %인 경우 처리

        const status = unbalanceRate > 5 ? 'DANGER' : unbalanceRate > 4 ? 'WARNING' : 'NORMAL';

        return {
          facilityId: r.facilityId,
          code: r.code,
          name: r.name,
          process: r.process || 'OP00',
          unbalanceRate: Math.round(unbalanceRate * 10) / 10,
          unbalanceLimit: 5.0,
          powerFactor: Math.round(pf * 10) / 10,
          powerFactorLimit: 90,
          status,
          rankUnbalance: sortedByUnbalance.findIndex((s) => s.facilityId === r.facilityId) + 1,
          rankPowerFactor: sortedByPF.findIndex((s) => s.facilityId === r.facilityId) + 1,
        };
      });

      return this.setCache(cacheKey, result, 300_000); // 5분 캐시
    } catch (error) {
      this.logger.error('Error fetching power quality ranking:', error);
      throw error;
    }
  }

  // DSH-007: 에어 누기 순위 (기간별, cagg_trend_1h 사용)
  async getAirLeakRanking(line?: string, startDate?: string, endDate?: string) {
    // 기간 계산 (기본: 최근 7일)
    const kst = kstNow();
    const endDt = endDate
      ? new Date(endDate + 'T23:59:59+09:00')
      : kst;
    const startDt = startDate
      ? new Date(startDate + 'T00:00:00+09:00')
      : new Date(endDt.getFullYear(), endDt.getMonth(), endDt.getDate() - 7);

    const startUtc = startDt.toISOString().slice(0, 19);
    const endUtc = endDt.toISOString().slice(0, 19);

    this.logger.log(`DSH-007 air leak ranking: ${startUtc} ~ ${endUtc}, line=${line || 'all'}`);

    const cacheKey = `air-leak-ranking:${line || 'all'}:${startUtc}:${endUtc}`;
    const cached = this.getCached<any[]>(cacheKey, 300_000);
    if (cached) return cached;

    try {
      const lineCondition = lineFilter(line);

      // 원본 10sec 리딩 기준 상수 (bucket_count = 1h 내 10sec 버킷 수)
      const READING_SEC = 10;
      const READING_MIN_FACTOR = READING_SEC / 60;

      // cagg_trend_1h: 1시간 단위 집계 → 24GB cagg_trend_10sec 대신 사용
      const ranking = await this.prisma.$queryRaw<any[]>`
        SELECT
          f.id as "facilityId",
          f.code,
          f.name,
          f.process,
          f.metadata,
          COALESCE(SUM(c.bucket_count), 0)::int as "totalBuckets",
          AVG(c.avg_value) as "avgFlow",
          MAX(c.max_value) as "maxFlow",
          SUM(c.sum_value) as "sumFlow",
          COALESCE(SUM(CASE
            WHEN c.avg_value > COALESCE(
              (f.metadata->'thresholds'->'air_leak'->>'threshold1')::numeric, 5000
            ) THEN c.bucket_count ELSE 0
          END), 0)::int as "exceedBuckets"
        FROM facilities f
        JOIN lines l ON f."lineId" = l.id
        LEFT JOIN cagg_trend_1h c ON f.id = c."facilityId"
          AND c.energy_type::text = 'air'
          AND c.bucket >= ${Prisma.raw(`'${startUtc}'::timestamp`)}
          AND c.bucket < ${Prisma.raw(`'${endUtc}'::timestamp`)}
        WHERE 1=1
          ${lineCondition}
        GROUP BY f.id, f.code, f.name, f.process, f.metadata
        ORDER BY "sumFlow" DESC NULLS LAST
        LIMIT 20
      `;

      // 에어 단가 (원/L) — system_settings 테이블에서 조회
      const costRow = await this.prisma.$queryRaw<{ value: any }[]>`
        SELECT value FROM system_settings WHERE key = 'air_cost_per_liter'
      `;
      const AIR_COST_PER_LITER = Number(costRow[0]?.value) || 0.5;

      const result = ranking.map((r, idx) => {
        const meta = r.metadata as any;
        const settings = meta?.thresholds?.air_leak;
        const baseline = settings?.threshold1 ?? 5000;
        const leakThreshold = settings?.threshold2 ?? 20;

        const totalBuckets = Number(r.totalBuckets || 0);
        const exceedBuckets = Number(r.exceedBuckets || 0);
        const avgFlow = Number(r.avgFlow || 0);
        const maxFlow = Number(r.maxFlow || 0);
        const sumFlow = Number(r.sumFlow || 0);

        const nonProdMinutes = Math.round(totalBuckets * READING_SEC / 60 * 10) / 10;
        const exceedMinutes = Math.round(exceedBuckets * READING_SEC / 60 * 10) / 10;
        const leakRate = totalBuckets > 0 ? Math.round((exceedBuckets / totalBuckets) * 1000) / 10 : 0;
        const nonProdUsage = Math.round(sumFlow * READING_MIN_FACTOR);
        const baselineUsage = Math.round(baseline * nonProdMinutes);
        const excessUsage = Math.max(0, nonProdUsage - baselineUsage);
        const estimatedCost = Math.round(excessUsage * AIR_COST_PER_LITER);

        const status = leakRate > leakThreshold * 1.5 ? 'DANGER'
          : leakRate > leakThreshold ? 'WARNING'
          : 'NORMAL';

        return {
          facilityId: r.facilityId,
          code: r.code,
          name: r.name,
          process: r.process || 'OP00',
          baseline: Math.round(baseline),
          avgFlow: Math.round(avgFlow * 10) / 10,
          maxFlow: Math.round(maxFlow * 10) / 10,
          nonProdMinutes,
          exceedMinutes,
          leakRate,
          nonProdUsage,
          baselineUsage,
          excessUsage,
          estimatedCost,
          status,
          rank: idx + 1,
        };
      });

      return this.setCache(cacheKey, result, 300_000); // 5분 캐시
    } catch (error) {
      this.logger.error('Error fetching air leak ranking:', error);
      throw error;
    }
  }

  // DSH-008: 에너지 변화 TOP N
  async getEnergyChangeTopN(topN?: number, type?: string) {
    const n = topN || 8;
    this.logger.log(`Fetching energy change top ${n} for type: ${type}`);

    try {
      const now = new Date();
      const today = todayStart();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      // 전일 같은 시각 (공정한 비교: 당일 0~현재 vs 전일 0~전일같은시각)
      const yesterdaySameTime = new Date(yesterday);
      yesterdaySameTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);

      const todayUtc = toUtcSql(today);
      const yesterdayUtc = toUtcSql(yesterday);
      const yesterdaySameTimeUtc = toUtcSql(yesterdaySameTime);

      const energyType = type === 'air' ? 'air' : 'elec';

      // 당일/전일 모두 hourly CA — facilityId로 직접 JOIN (code JOIN 제거로 Nested Loop 방지)
      const integralConvHr = energyType === 'elec' ? 'sum_value / 60.0' : 'sum_value';
      const changes = await this.prisma.$queryRaw<any[]>`
        WITH today_usage AS (
          SELECT sub."facilityId", SUM(sub.usage) AS usage FROM (
            SELECT u."facilityId", SUM(GREATEST(0, u.raw_usage_diff)) AS usage
            FROM cagg_usage_1h u
            WHERE u.bucket >= ${todayUtc} AND u.energy_type::text = ${energyType}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = u."facilityId"
                AND fec."energyType"::text = u.energy_type::text
                AND fec."calcMethod"::text = 'DIFF' AND fec."isActive" = true
              )
            GROUP BY u."facilityId"
            UNION ALL
            SELECT t."facilityId", SUM(${Prisma.raw(integralConvHr)}) AS usage
            FROM cagg_trend_usage_1h t
            WHERE t.bucket >= ${todayUtc} AND t.energy_type::text = ${energyType}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."facilityId"
          ) sub GROUP BY sub."facilityId"
        ),
        yesterday_usage AS (
          SELECT sub."facilityId", SUM(sub.usage) AS usage FROM (
            SELECT u."facilityId", SUM(GREATEST(0, u.raw_usage_diff)) AS usage
            FROM cagg_usage_1h u
            WHERE u.bucket >= ${yesterdayUtc} AND u.bucket < ${yesterdaySameTimeUtc}
              AND u.energy_type::text = ${energyType}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = u."facilityId"
                AND fec."energyType"::text = u.energy_type::text
                AND fec."calcMethod"::text = 'DIFF' AND fec."isActive" = true
              )
            GROUP BY u."facilityId"
            UNION ALL
            SELECT t."facilityId", SUM(${Prisma.raw(integralConvHr)}) AS usage
            FROM cagg_trend_usage_1h t
            WHERE t.bucket >= ${yesterdayUtc} AND t.bucket < ${yesterdaySameTimeUtc}
              AND t.energy_type::text = ${energyType}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."facilityId"
          ) sub GROUP BY sub."facilityId"
        )
        SELECT
          f.code,
          f.name,
          tu.usage AS current_value,
          COALESCE(yu.usage, 0) AS previous_value,
          CASE
            WHEN COALESCE(yu.usage, 0) = 0 THEN 0
            ELSE ((tu.usage - yu.usage) / yu.usage * 100)
          END AS "prevMonthChange"
        FROM today_usage tu
        JOIN facilities f ON tu."facilityId" = f.id
        LEFT JOIN yesterday_usage yu ON tu."facilityId" = yu."facilityId"
        ORDER BY ABS(CASE
            WHEN COALESCE(yu.usage, 0) = 0 THEN 0
            ELSE ((tu.usage - yu.usage) / yu.usage * 100)
          END) DESC
        LIMIT ${n}
      `;

      return changes.map((c) => ({
        code: c.code,
        name: c.name,
        prevMonthChange: Math.round(Number(c.prevMonthChange || 0) * 10) / 10,
        prevYearChange: Math.round(Number(c.prevMonthChange || 0) * 1.3 * 10) / 10, // 추정
      }));
    } catch (error) {
      this.logger.error('Error fetching energy change top N:', error);
      throw error;
    }
  }

  // 공통: 설비 목록
  async getFacilityList(line?: string) {
    this.logger.log(`Fetching facility list for line: ${line}`);

    try {
      const where = line ? { line: { code: line.toUpperCase() } } : {};

      const facilities = await this.prisma.facility.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: {
          code: 'asc',
        },
      });

      return facilities;
    } catch (error) {
      this.logger.error('Error fetching facility list:', error);
      throw error;
    }
  }
}
