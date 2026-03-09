import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { todayStart, tomorrowStart, daysAgo, monthsAgo, roundTo, changeRate, toUtcSql, KST_OFFSET } from '../common/utils/date-time.utils';
import { lineFilter, facilityFilter } from '../common/utils/query-helpers';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

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
              LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) as tag_usage
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
              LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) as tag_usage
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
              LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) as tag_usage
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
        const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
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
        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        rangeStart = targetDate;
        rangeEnd = new Date(targetDate);
        rangeEnd.setDate(rangeEnd.getDate() + 1);
      }

      const lineCondition = lineFilter(line);
      const targetDateUtc = toUtcSql(rangeStart);
      const nextDayUtc = toUtcSql(rangeEnd);

      // 공정별 전력/에어 합계 — hourly CA 직접 조회 (VIEW 바이패스)
      const processData = await this.prisma.$queryRaw<any[]>`
        WITH tag_usage AS (
          SELECT u."facilityId", u.energy_type,
            LAST(u.last_value, u.bucket) - FIRST(u.first_value, u.bucket) as usage
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
              LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) as tag_usage
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
              LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) as tag_usage
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

  // DSH-005: 싸이클당 순위
  async getCycleRanking(line?: string) {
    this.logger.log(`Fetching cycle ranking for line: ${line}`);

    try {
      const today = todayStart();

      const lineCondition = lineFilter(line);
      const todayUtc = toUtcSql(today);

      // 설비별 전력 사용량 (FIRST/LAST: 태그별 적산차 → 설비 합산)
      const facilities = await this.prisma.$queryRaw<any[]>`
        WITH tag_usage AS (
          SELECT
            c."tagId",
            c."facilityId",
            c.calc_method,
            CASE WHEN c.calc_method = 'DIFF'
              THEN LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) + SUM(COALESCE(c.reset_correction, 0))
              ELSE SUM(c.usage_diff)
            END as usage
          FROM cagg_usage_combined_1min c
          JOIN facilities f ON c."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE c.bucket >= ${todayUtc}
            AND c.energy_type = 'elec'
            AND f."isProcessing" = true
            ${lineCondition}
          GROUP BY c."tagId", c."facilityId", c.calc_method
        )
        SELECT
          f.code,
          f.process,
          SUM(tu.usage) as avg_power
        FROM tag_usage tu
        JOIN facilities f ON tu."facilityId" = f.id
        GROUP BY f.id, f.code, f.process
        ORDER BY avg_power DESC
        LIMIT 10
      `;

      // 각 설비의 기준값과 편차 계산을 위한 통계 데이터 조회
      const results = [];
      for (const f of facilities) {
        const cycleEnergy = Number(f.avg_power || 0);

        // 실제 싸이클 데이터에서 평균 시간과 편차 조회
        const cycleStats = await this.prisma.cycleData.findMany({
          where: {
            facility: { code: f.code },
            startTime: { gte: today },
          },
          select: {
            duration: true,
            totalEnergy: true,
          },
        });

        const avgDuration = cycleStats.length > 0
          ? cycleStats.reduce((sum, c) => sum + (c.duration || 0), 0) / cycleStats.length
          : 360; // 기본 6분

        const avgCycleEnergy = cycleStats.length > 0
          ? cycleStats.reduce((sum, c) => sum + (c.totalEnergy || 0), 0) / cycleStats.length
          : cycleEnergy;

        const deviation = Math.abs(cycleEnergy - avgCycleEnergy);

        results.push({
          rank: results.length + 1,
          code: f.code,
          process: f.process || 'OP00',
          cycleEnergy: Math.round(cycleEnergy * 100) / 100,
          cycleTime: Math.round(avgDuration),
          deviation: Math.round(deviation * 10) / 10,
          status: deviation > 15 ? ('DANGER' as const) : deviation > 10 ? ('WARNING' as const) : ('NORMAL' as const),
        });
      }

      return results;
    } catch (error) {
      this.logger.error('Error fetching cycle ranking:', error);
      throw error;
    }
  }

  // DSH-006: 전력 품질 순위
  // Frontend expects: PowerQualityData[] = { facilityId, code, name, process, unbalanceRate, unbalanceLimit, powerFactor, powerFactorLimit, status, rankUnbalance, rankPowerFactor }
  async getPowerQualityRanking(line?: string) {
    this.logger.log(`Fetching power quality ranking for line: ${line}`);

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
          COALESCE(AVG(CASE WHEN s."sensorName" = 'imbalance' THEN s."avgValue" END), 0) as "unbalanceRate",
          COALESCE(AVG(CASE WHEN s."sensorName" = 'powerFactor' THEN s."avgValue" END), 0) as "powerFactor"
        FROM facilities f
        JOIN lines l ON f."lineId" = l.id
        LEFT JOIN cagg_sensor_10sec s ON f.id = s."facilityId" AND s.bucket >= ${todayUtc}
        WHERE 1=1
          ${lineCondition}
        GROUP BY f.id, f.code, f.name, f.process
        ORDER BY AVG(CASE WHEN s."sensorName" = 'imbalance' THEN s."avgValue" END) DESC NULLS LAST
        LIMIT 20
      `;

      // 불평형률 순위 계산
      const sortedByUnbalance = [...ranking].sort((a, b) => Number(b.unbalanceRate || 0) - Number(a.unbalanceRate || 0));
      const sortedByPF = [...ranking].sort((a, b) => Number(a.powerFactor || 0) - Number(b.powerFactor || 0));

      return ranking.map((r) => {
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
    } catch (error) {
      this.logger.error('Error fetching power quality ranking:', error);
      throw error;
    }
  }

  // DSH-007: 에어 누기 순위 (비생산시간 + 설비별 기준값 기반)
  async getAirLeakRanking(line?: string) {
    this.logger.log(`Fetching air leak ranking for line: ${line}`);

    try {
      const lineCondition = lineFilter(line);

      // 오늘 dayType 결정
      const now = new Date();
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayStr = kstNow.toISOString().slice(0, 10);

      const calEntry = await this.prisma.productionCalendar.findFirst({
        where: {
          date: new Date(todayStr + 'T00:00:00'),
          lineId: null, // 공장 전체 캘린더
        },
      });

      let dayType: string;
      if (calEntry?.type === 'holiday' || calEntry?.type === 'shutdown') {
        dayType = 'sunday';
      } else if (calEntry?.type === 'workday') {
        dayType = 'weekday';
      } else {
        const dow = kstNow.getDay();
        dayType = dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : 'weekday';
      }

      const todayUtc = toUtcSql(todayStart());

      const BUCKET_SEC = 10;
      const BUCKET_MIN_FACTOR = BUCKET_SEC / 60;

      // 집계 (per-line 비생산 스케줄 JOIN)
      const ranking = await this.prisma.$queryRaw<any[]>`
        SELECT
          f.id as "facilityId",
          f.code,
          f.name,
          f.process,
          f.metadata,
          COUNT(c.last_value)::int as "totalBuckets",
          AVG(c.last_value) as "avgFlow",
          MAX(c.last_value) as "maxFlow",
          SUM(c.last_value) as "sumFlow",
          COUNT(CASE
            WHEN c.last_value > COALESCE(
              (f.metadata->'thresholds'->'air_leak'->>'threshold1')::numeric, 5000
            ) THEN 1
          END)::int as "exceedBuckets"
        FROM facilities f
        JOIN lines l ON f."lineId" = l.id
        LEFT JOIN non_production_schedules nps
          ON nps."lineId" = l.id AND nps."dayType" = ${dayType}
        LEFT JOIN cagg_trend_10sec c ON f.id = c."facilityId"
          AND c.energy_type::text = 'air'
          AND (
            CASE
              WHEN nps.id IS NULL THEN
                c.bucket >= ${todayUtc}
              WHEN nps."startTime" > nps."endTime" THEN (
                (c.bucket >= ${Prisma.raw(`(CURRENT_DATE::timestamp - INTERVAL '9 hours')`)}
                 AND c.bucket < ${Prisma.raw(`(CURRENT_DATE::timestamp + nps."endTime"::interval - INTERVAL '9 hours')`)})
                OR
                (c.bucket >= ${Prisma.raw(`(CURRENT_DATE::timestamp + nps."startTime"::interval - INTERVAL '9 hours')`)}
                 AND c.bucket <= ${Prisma.raw(`(CURRENT_DATE::timestamp + INTERVAL '23 hours 59 minutes' - INTERVAL '9 hours')`)})
              )
              ELSE (
                c.bucket >= ${Prisma.raw(`(CURRENT_DATE::timestamp + nps."startTime"::interval - INTERVAL '9 hours')`)}
                AND c.bucket < ${Prisma.raw(`(CURRENT_DATE::timestamp + nps."endTime"::interval - INTERVAL '9 hours')`)}
              )
            END
          )
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

      return ranking.map((r, idx) => {
        const meta = r.metadata as any;
        const settings = meta?.thresholds?.air_leak;
        const baseline = settings?.threshold1 ?? 5000;
        const leakThreshold = settings?.threshold2 ?? 20;

        const totalBuckets = Number(r.totalBuckets || 0);
        const exceedBuckets = Number(r.exceedBuckets || 0);
        const avgFlow = Number(r.avgFlow || 0);
        const maxFlow = Number(r.maxFlow || 0);
        const sumFlow = Number(r.sumFlow || 0);

        const nonProdMinutes = Math.round(totalBuckets * BUCKET_SEC / 60 * 10) / 10;
        const exceedMinutes = Math.round(exceedBuckets * BUCKET_SEC / 60 * 10) / 10;
        const leakRate = totalBuckets > 0 ? Math.round((exceedBuckets / totalBuckets) * 1000) / 10 : 0;
        const nonProdUsage = Math.round(sumFlow * BUCKET_MIN_FACTOR);
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
            SELECT u."facilityId", SUM(u.raw_usage_diff) AS usage
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
            SELECT u."facilityId", SUM(u.raw_usage_diff) AS usage
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
