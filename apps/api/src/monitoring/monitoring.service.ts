import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { RangeQueryDto } from './dto/range-query.dto';
import { RangeDataResponse, RangeDataPoint, AnomalyEvent } from './dto/range-response.dto';
import { ResetDetectorService } from './reset-detector.service';
import { IntervalEnum, INTERVAL_TO_BUCKET, INTERVAL_TO_ZOOM_LEVEL, isCaggBasedInterval } from './types/interval.enum';
import { NotFoundException } from '@nestjs/common';
import {
  InvalidTimeRangeException,
  FacilityNotFoundException,
  DatabaseQueryException,
} from '../common/exceptions/custom-exceptions';
import {
  todayStart, tomorrowStart, daysAgo, nextDay,
  KST_OFFSET, toUtcSql, roundTo, changeRate,
} from '../common/utils/date-time.utils';

/**
 * Cache Entry Interface
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  /**
   * In-memory cache for range data
   * Key: `${facilityId}:${metric}:${interval}:${startTime}:${endTime}`
   * TTL varies by interval: 15m=300s, 1m=180s, 10s=60s, 1s=30s
   */
  private readonly rangeCache = new Map<string, CacheEntry<RangeDataResponse>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly resetDetectorService: ResetDetectorService,
  ) {
    // Cache cleanup every 5 minutes
    setInterval(() => this.cleanupExpiredCache(), 5 * 60 * 1000);
  }

  // MON-001: 종합 현황 - KPI (적산차 + 리셋 보정치 방식)
  // USAGE 태그: LAST(last_value) - FIRST(first_value) + SUM(reset_correction)
  // → 결측 구간이 있어도 미터기 시작~끝 값으로 정확한 일일 사용량 산출
  async getOverviewKpi() {
    this.logger.log('📊 Fetching overview KPI');

    try {
      const today = todayStart();
      const yesterday = daysAgo(1);
      const tomorrow = tomorrowStart();

      const todayUtc = toUtcSql(today);
      const nextDayUtc = toUtcSql(tomorrow);
      const yesterdayUtc = toUtcSql(yesterday);

      // 8개 독립 쿼리 병렬 실행 (DIFF/INTEGRAL_TRAP 분리 → VIEW 우회로 5.7x 개선)
      const [
        diffToday, integralToday,
        diffYesterday, integralYesterday,
        powerQualityAlarms, airLeakAlarms,
        yesterdayPqAlarms, yesterdayAlAlarms,
      ] = await Promise.all([
        // DIFF 당일: cagg_usage_1h 직접 쿼리 (VIEW 우회)
        this.prisma.$queryRaw<any[]>`
          WITH diff AS (
            SELECT c."tagId", c.energy_type::text,
              LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) as usage
            FROM cagg_usage_1h c
            WHERE c.bucket >= ${todayUtc} AND c.bucket < ${nextDayUtc}
              AND c.last_value IS NOT NULL
            GROUP BY c."tagId", c.energy_type
          ),
          resets AS (
            SELECT tag_id, SUM(value_before_reset) as corr
            FROM meter_reset_events
            WHERE correction_applied AND reset_time >= ${todayUtc} AND reset_time < ${nextDayUtc}
            GROUP BY tag_id
          )
          SELECT
            SUM(CASE WHEN d.energy_type = 'elec' THEN d.usage + COALESCE(r.corr, 0) ELSE 0 END) as "totalPower",
            SUM(CASE WHEN d.energy_type = 'air' THEN d.usage + COALESCE(r.corr, 0) ELSE 0 END) as "totalAir"
          FROM diff d LEFT JOIN resets r ON d."tagId" = r.tag_id
        `,
        // INTEGRAL_TRAP 당일: cagg_trend_usage_1h 직접 쿼리
        this.prisma.$queryRaw<any[]>`
          SELECT
            SUM(CASE WHEN t.energy_type = 'elec' THEN t.sum_value / 60.0 ELSE 0 END) as "totalPower",
            SUM(CASE WHEN t.energy_type = 'air' THEN t.sum_value ELSE 0 END) as "totalAir"
          FROM cagg_trend_usage_1h t
          WHERE t.bucket >= ${todayUtc} AND t.bucket < ${nextDayUtc}
            AND EXISTS (
              SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod" = 'INTEGRAL_TRAP' AND fec."isActive" = true
            )
        `,
        // DIFF 전일
        this.prisma.$queryRaw<any[]>`
          WITH diff AS (
            SELECT c."tagId", c.energy_type::text,
              LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) as usage
            FROM cagg_usage_1h c
            WHERE c.bucket >= ${yesterdayUtc} AND c.bucket < ${todayUtc}
              AND c.last_value IS NOT NULL
            GROUP BY c."tagId", c.energy_type
          ),
          resets AS (
            SELECT tag_id, SUM(value_before_reset) as corr
            FROM meter_reset_events
            WHERE correction_applied AND reset_time >= ${yesterdayUtc} AND reset_time < ${todayUtc}
            GROUP BY tag_id
          )
          SELECT
            SUM(CASE WHEN d.energy_type = 'elec' THEN d.usage + COALESCE(r.corr, 0) ELSE 0 END) as "totalPower",
            SUM(CASE WHEN d.energy_type = 'air' THEN d.usage + COALESCE(r.corr, 0) ELSE 0 END) as "totalAir"
          FROM diff d LEFT JOIN resets r ON d."tagId" = r.tag_id
        `,
        // INTEGRAL_TRAP 전일
        this.prisma.$queryRaw<any[]>`
          SELECT
            SUM(CASE WHEN t.energy_type = 'elec' THEN t.sum_value / 60.0 ELSE 0 END) as "totalPower",
            SUM(CASE WHEN t.energy_type = 'air' THEN t.sum_value ELSE 0 END) as "totalAir"
          FROM cagg_trend_usage_1h t
          WHERE t.bucket >= ${yesterdayUtc} AND t.bucket < ${todayUtc}
            AND EXISTS (
              SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod" = 'INTEGRAL_TRAP' AND fec."isActive" = true
            )
        `,
        // 알림 건수 (alerts 테이블)
        this.prisma.alert.count({
          where: { detectedAt: { gte: today }, type: 'POWER_QUALITY' },
        }),
        this.prisma.alert.count({
          where: { detectedAt: { gte: today }, type: 'AIR_LEAK' },
        }),
        this.prisma.alert.count({
          where: { detectedAt: { gte: yesterday, lt: today }, type: 'POWER_QUALITY' },
        }),
        this.prisma.alert.count({
          where: { detectedAt: { gte: yesterday, lt: today }, type: 'AIR_LEAK' },
        }),
      ]);

      // DIFF + INTEGRAL_TRAP 합산
      const totalPowerToday = Number(diffToday[0]?.totalPower || 0) + Number(integralToday[0]?.totalPower || 0);
      const totalPowerYesterday = Number(diffYesterday[0]?.totalPower || 0) + Number(integralYesterday[0]?.totalPower || 0);
      const totalAirToday = Number(diffToday[0]?.totalAir || 0) + Number(integralToday[0]?.totalAir || 0);
      const totalAirYesterday = Number(diffYesterday[0]?.totalAir || 0) + Number(integralYesterday[0]?.totalAir || 0);

      return {
        totalPower: {
          value: roundTo(totalPowerToday),
          unit: 'kWh',
          change: roundTo(changeRate(totalPowerToday, totalPowerYesterday), 1),
          inverseChange: true,
        },
        totalAir: {
          value: roundTo(totalAirToday / 1000000),
          unit: 'ML',
          change: roundTo(changeRate(totalAirToday, totalAirYesterday), 1),
          inverseChange: true,
        },
        powerQualityAlarms: {
          value: powerQualityAlarms,
          unit: '건',
          change: roundTo(changeRate(powerQualityAlarms, yesterdayPqAlarms), 1),
          inverseChange: true,
        },
        airLeakAlarms: {
          value: airLeakAlarms,
          unit: '건',
          change: roundTo(changeRate(airLeakAlarms, yesterdayAlAlarms), 1),
          inverseChange: true,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching overview KPI:', error);
      throw error;
    }
  }

  // MON-001: 종합 현황 - 라인 미니 카드 (적산차 + 리셋 보정치 방식)
  async getLineMiniCards() {
    this.logger.log('📊 Fetching line mini cards');

    try {
      const today = todayStart();
      const tomorrow = tomorrowStart();

      const todayUtc = toUtcSql(today);
      const nextDayUtc = toUtcSql(tomorrow);

      // 라인별 사용량 — hourly CA 직접 조회 (VIEW 바이패스)
      const lineData = await this.prisma.$queryRaw<any[]>`
        WITH tag_usage AS (
          SELECT u."facilityId", u.energy_type,
            LAST(u.last_value, u.bucket) - FIRST(u.first_value, u.bucket) as usage
          FROM cagg_usage_1h u
          WHERE u.bucket >= ${todayUtc} AND u.bucket < ${nextDayUtc}
          GROUP BY u."facilityId", u.energy_type
          UNION ALL
          SELECT t."facilityId", t.energy_type,
            SUM(CASE WHEN t.energy_type = 'elec'::"EnergyType" THEN t.sum_value / 60.0 ELSE t.sum_value END) as usage
          FROM cagg_trend_usage_1h t
          WHERE t.bucket >= ${todayUtc} AND t.bucket < ${nextDayUtc}
            AND EXISTS (
              SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
            )
          GROUP BY t."facilityId", t.energy_type
        )
        SELECT
          l.code as line,
          l.name as "lineName",
          SUM(CASE WHEN tu.energy_type::text = 'elec' THEN tu.usage ELSE 0 END) as "totalPower",
          SUM(CASE WHEN tu.energy_type::text = 'air' THEN tu.usage ELSE 0 END) as "totalAir"
        FROM facilities f
        INNER JOIN lines l ON f."lineId" = l.id
        LEFT JOIN tag_usage tu ON f.id = tu."facilityId"
        GROUP BY l.code, l.name
      `;

      // 라인별 알림 건수 (alerts 테이블)
      const alertData = await this.prisma.$queryRaw<any[]>`
        SELECT
          l.code as line,
          COUNT(CASE WHEN a.severity::text = 'CRITICAL' THEN 1 END)::int as "dangerCount",
          COUNT(CASE WHEN a.severity::text = 'WARNING' THEN 1 END)::int as "warningCount"
        FROM alerts a
        JOIN facilities f ON a."facilityId" = f.id
        JOIN lines l ON f."lineId" = l.id
        WHERE a."detectedAt" >= ${today}
        GROUP BY l.code
      `;
      const alertMap = new Map(alertData.map((a) => [a.line, a]));

      // DB 코드 → 프론트엔드 LineId 매핑 (ASSEMBLE → assembly)
      const lineIdMap: Record<string, string> = { ASSEMBLE: 'assembly' };

      return lineData.map((line) => {
        const lineCode = lineIdMap[line.line] || line.line.toLowerCase();
        const totalPower = Number(line.totalPower || 0);
        const totalAir = Number(line.totalAir || 0);
        const alerts = alertMap.get(line.line);

        const powerStatus = alerts?.dangerCount > 0 ? 'DANGER' : alerts?.warningCount > 0 ? 'WARNING' : 'NORMAL';
        const airStatus = alerts?.dangerCount > 0 ? 'DANGER' : alerts?.warningCount > 0 ? 'WARNING' : 'NORMAL';

        return {
          id: lineCode,
          label: line.lineName,
          power: Math.round((totalPower / 1000) * 100) / 100,
          powerUnit: 'MWh',
          air: Math.round((totalAir / 1000000) * 100) / 100,
          airUnit: 'ML',
          powerStatus,
          airStatus,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching line mini cards:', error);
      throw error;
    }
  }

  // MON-001: 종합 현황 - 시간대별 트렌드 (1시간 버킷, 0~23시 고정)
  // corrected_usage_diff 사용: 리셋 보정 + 이상 데이터 대체 반영
  async getHourlyTrend(date?: string) {
    this.logger.log(`📊 Fetching hourly trend for date: ${date || 'today'}`);

    try {
      const targetDate = date ? new Date(date) : new Date();
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const prevDay = new Date(targetDate);
      prevDay.setDate(prevDay.getDate() - 1);

      const targetUtc = toUtcSql(targetDate);
      const nextDayUtc = toUtcSql(nextDay);
      const prevDayUtc = toUtcSql(prevDay);

      // 4개 병렬: DIFF/INTEGRAL_TRAP × 당일/전일 (VIEW 우회)
      const [diffCurrent, integralCurrent, diffPrev, integralPrev] = await Promise.all([
        // DIFF 당일: cagg_usage_1h 직접
        this.prisma.$queryRaw<any[]>`
          SELECT date_trunc('hour', sub.hb) as hour_bucket, sub.energy_type,
            SUM(sub.tag_usage) as usage
          FROM (
            SELECT c.energy_type::text, date_trunc('hour', c.bucket + ${KST_OFFSET}) as hb,
              LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) as tag_usage
            FROM cagg_usage_1h c
            WHERE c.bucket >= ${targetUtc} AND c.bucket < ${nextDayUtc} AND c.last_value IS NOT NULL
            GROUP BY c."tagId", c.energy_type, date_trunc('hour', c.bucket + ${KST_OFFSET})
          ) sub GROUP BY hour_bucket, sub.energy_type ORDER BY hour_bucket
        `,
        // INTEGRAL_TRAP 당일: cagg_trend_usage_1h 직접
        this.prisma.$queryRaw<any[]>`
          SELECT date_trunc('hour', t.bucket + ${KST_OFFSET}) as hour_bucket, t.energy_type::text,
            SUM(CASE WHEN t.energy_type = 'elec' THEN t.sum_value / 60.0
                     WHEN t.energy_type = 'air' THEN t.sum_value ELSE t.sum_value / 60.0 END) as usage
          FROM cagg_trend_usage_1h t
          WHERE t.bucket >= ${targetUtc} AND t.bucket < ${nextDayUtc}
            AND EXISTS (SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId" AND fec."energyType"::text = t.energy_type::text
              AND fec."calcMethod" = 'INTEGRAL_TRAP' AND fec."isActive" = true)
          GROUP BY hour_bucket, t.energy_type ORDER BY hour_bucket
        `,
        // DIFF 전일
        this.prisma.$queryRaw<any[]>`
          SELECT date_trunc('hour', sub.hb) as hour_bucket, sub.energy_type,
            SUM(sub.tag_usage) as usage
          FROM (
            SELECT c.energy_type::text, date_trunc('hour', c.bucket + ${KST_OFFSET}) as hb,
              LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) as tag_usage
            FROM cagg_usage_1h c
            WHERE c.bucket >= ${prevDayUtc} AND c.bucket < ${targetUtc} AND c.last_value IS NOT NULL
            GROUP BY c."tagId", c.energy_type, date_trunc('hour', c.bucket + ${KST_OFFSET})
          ) sub GROUP BY hour_bucket, sub.energy_type ORDER BY hour_bucket
        `,
        // INTEGRAL_TRAP 전일
        this.prisma.$queryRaw<any[]>`
          SELECT date_trunc('hour', t.bucket + ${KST_OFFSET}) as hour_bucket, t.energy_type::text,
            SUM(CASE WHEN t.energy_type = 'elec' THEN t.sum_value / 60.0
                     WHEN t.energy_type = 'air' THEN t.sum_value ELSE t.sum_value / 60.0 END) as usage
          FROM cagg_trend_usage_1h t
          WHERE t.bucket >= ${prevDayUtc} AND t.bucket < ${targetUtc}
            AND EXISTS (SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId" AND fec."energyType"::text = t.energy_type::text
              AND fec."calcMethod" = 'INTEGRAL_TRAP' AND fec."isActive" = true)
          GROUP BY hour_bucket, t.energy_type ORDER BY hour_bucket
        `,
      ]);

      // DIFF + INTEGRAL_TRAP 결과 병합
      const mergeHourly = (diffRows: any[], integralRows: any[]) => {
        const map = new Map<string, { totalPower: number; totalAir: number }>();
        for (const rows of [diffRows, integralRows]) {
          for (const r of rows) {
            const key = new Date(r.hour_bucket).getUTCHours().toString();
            const entry = map.get(key) || { totalPower: 0, totalAir: 0 };
            const val = Number(r.usage || 0);
            if (r.energy_type === 'elec') entry.totalPower += val;
            else if (r.energy_type === 'air') entry.totalAir += val;
            map.set(key, entry);
          }
        }
        return map;
      };
      const currentMap = mergeHourly(diffCurrent, integralCurrent);
      const prevMap = mergeHourly(diffPrev, integralPrev);

      // 24시간 고정 결과 생성 (00 ~ 23)
      const result: Array<{ time: string; current: number | null; prev: number | null }> = [];

      for (let hour = 0; hour < 24; hour++) {
        const hourKey = String(hour);
        const timeStr = `${String(hour).padStart(2, '0')}:00`;
        const cur = currentMap.get(hourKey);
        const prev = prevMap.get(hourKey);

        result.push({
          time: timeStr,
          current: cur ? roundTo(cur.totalPower, 2) : null,
          prev: prev ? roundTo(prev.totalPower, 2) : null,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Error fetching hourly trend:', error);
      throw error;
    }
  }

  // MON-001: 종합 현황 - 알람 요약
  async getAlarmSummary() {
    this.logger.log('📊 Fetching alarm summary');

    try {
      const today = todayStart();

      // 라인별 알람 집계 (alerts 테이블 기반)
      const lineAlarms = await this.prisma.$queryRaw<any[]>`
        SELECT
          l.name as line,
          l."order" as line_order,
          COUNT(CASE WHEN a.type = 'POWER_QUALITY' THEN 1 END)::int as "powerQuality",
          COUNT(CASE WHEN a.type = 'AIR_LEAK' THEN 1 END)::int as "airLeak"
        FROM facilities f
        INNER JOIN lines l ON f."lineId" = l.id
        LEFT JOIN alerts a ON f.id = a."facilityId" AND a."detectedAt" >= ${today}
        GROUP BY l.name, l."order"
        ORDER BY l."order"
      `;

      return lineAlarms.map((line) => ({
        line: line.line,
        powerQuality: Number(line.powerQuality || 0),
        airLeak: Number(line.airLeak || 0),
        total: Number(line.powerQuality || 0) + Number(line.airLeak || 0),
      }));
    } catch (error) {
      this.logger.error('Error fetching alarm summary:', error);
      throw error;
    }
  }

  // MON-002: 라인별 상세 (power/air 분리 형식)
  async getLineDetailChart(line: string, date?: string, interval?: number) {
    this.logger.log(`Fetching line detail chart: ${line}, date: ${date}, interval: ${interval}s`);

    try {
      const targetDate = date ? new Date(date) : new Date();
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const prevDay = new Date(targetDate);
      prevDay.setDate(prevDay.getDate() - 1);

      // interval: 초 단위 (1, 10, 30, 60, 300, 900, 1800, 3600, 86400)
      const intervalSec = interval || 900; // 기본값: 15분 (900초)
      const intervalRaw = Prisma.raw(`${intervalSec}`); // SQL 인라인용 (GROUP BY 호환)
      const steps = Math.floor(86400 / intervalSec); // 하루(86400초)를 interval로 나눔

      // UTC→KST 변환된 날짜 필터 (cagg bucket은 UTC timestamp)
      const targetDateUtc = toUtcSql(targetDate);
      const nextDayUtc = toUtcSql(nextDay);
      const prevDayUtc = toUtcSql(prevDay);

      let currentData: any[];
      let prevData: any[];

      // ============================================================
      // 단계별 계산 로직
      // ============================================================
      // 1초: Raw 데이터 그대로 (계산 없음)
      // 10초, 30초: TREND, SENSOR만 (AVG)
      // 1분 이상: 모든 태그 (적산: 끝-시작, 순시: AVG)
      // ============================================================

      if (intervalSec === 1) {
        // ============================================================
        // 1초: Raw 데이터 그대로 (timestamptz → KST 자정 기준 상대 epoch)
        // ============================================================
        currentData = await this.prisma.$queryRaw<any[]>`
          SELECT
            EXTRACT(EPOCH FROM (
              t.timestamp AT TIME ZONE 'Asia/Seoul'
              - date_trunc('day', t.timestamp AT TIME ZONE 'Asia/Seoul')
            ))::INTEGER as epoch,
            tag."energyType" as "energyType",
            t.value as "avgValue"
          FROM tag_data_raw t
          JOIN tags tag ON t."tagId" = tag.id
          JOIN facilities f ON tag."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE l.code = ${line.toUpperCase()}
            AND t.timestamp >= ${targetDate} AND t.timestamp < ${nextDay}
          ORDER BY t.timestamp
        `;

        prevData = await this.prisma.$queryRaw<any[]>`
          SELECT
            EXTRACT(EPOCH FROM (
              t.timestamp AT TIME ZONE 'Asia/Seoul'
              - date_trunc('day', t.timestamp AT TIME ZONE 'Asia/Seoul')
            ))::INTEGER as epoch,
            tag."energyType" as "energyType",
            t.value as "avgValue"
          FROM tag_data_raw t
          JOIN tags tag ON t."tagId" = tag.id
          JOIN facilities f ON tag."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE l.code = ${line.toUpperCase()}
            AND t.timestamp >= ${prevDay} AND t.timestamp < ${targetDate}
          ORDER BY t.timestamp
        `;
      } else if (intervalSec === 10 || intervalSec === 30) {
        // ============================================================
        // 10초, 30초: cagg_trend_10sec 기반 (bucket UTC → +9h KST 변환)
        // ============================================================
        currentData = await this.prisma.$queryRaw<any[]>`
          SELECT
            FLOOR(EXTRACT(EPOCH FROM (c.bucket + ${KST_OFFSET} - date_trunc('day', c.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
            c.energy_type::text as "energyType",
            AVG(c.last_value) as "avgValue"
          FROM cagg_trend_10sec c
          JOIN facilities f ON c."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE l.code = ${line.toUpperCase()}
            AND c.bucket >= ${targetDateUtc} AND c.bucket < ${nextDayUtc}
          GROUP BY 1, c.energy_type
          ORDER BY epoch
        `;

        prevData = await this.prisma.$queryRaw<any[]>`
          SELECT
            FLOOR(EXTRACT(EPOCH FROM (c.bucket + ${KST_OFFSET} - date_trunc('day', c.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
            c.energy_type::text as "energyType",
            AVG(c.last_value) as "avgValue"
          FROM cagg_trend_10sec c
          JOIN facilities f ON c."facilityId" = f.id
          JOIN lines l ON f."lineId" = l.id
          WHERE l.code = ${line.toUpperCase()}
            AND c.bucket >= ${prevDayUtc} AND c.bucket < ${targetDateUtc}
          GROUP BY 1, c.energy_type
          ORDER BY epoch
        `;
      } else if (intervalSec >= 3600) {
        // ============================================================
        // 1시간 이상: hourly CA 직접 조회 (DIFF: LAST-FIRST, INTEGRAL_TRAP: SUM)
        // ============================================================
        currentData = await this.prisma.$queryRaw<any[]>`
          WITH tag_usage AS (
            SELECT u."tagId", u.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (u.bucket + ${KST_OFFSET} - date_trunc('day', u.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
              LAST(u.last_value, u.bucket) - FIRST(u.first_value, u.bucket) as usage
            FROM cagg_usage_1h u
            JOIN facilities f ON u."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE l.code = ${line.toUpperCase()}
              AND u.bucket >= ${targetDateUtc} AND u.bucket < ${nextDayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = u."facilityId"
                  AND fec."energyType"::text = u.energy_type::text
                  AND fec."calcMethod"::text = 'DIFF' AND fec."isActive" = true
              )
            GROUP BY u."tagId", u.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (u.bucket + ${KST_OFFSET} - date_trunc('day', u.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw}
            UNION ALL
            SELECT t."tagId", t.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (t.bucket + ${KST_OFFSET} - date_trunc('day', t.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
              SUM(CASE WHEN t.energy_type = 'elec'::"EnergyType" THEN t.sum_value / 60.0 ELSE t.sum_value END) as usage
            FROM cagg_trend_usage_1h t
            JOIN facilities f ON t."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE l.code = ${line.toUpperCase()}
              AND t.bucket >= ${targetDateUtc} AND t.bucket < ${nextDayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                  AND fec."energyType"::text = t.energy_type::text
                  AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."tagId", t.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (t.bucket + ${KST_OFFSET} - date_trunc('day', t.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw}
          )
          SELECT
            epoch,
            energy_type::text as "energyType",
            SUM(usage) as "avgValue"
          FROM tag_usage
          GROUP BY epoch, energy_type
          ORDER BY epoch
        `;

        prevData = await this.prisma.$queryRaw<any[]>`
          WITH tag_usage AS (
            SELECT u."tagId", u.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (u.bucket + ${KST_OFFSET} - date_trunc('day', u.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
              LAST(u.last_value, u.bucket) - FIRST(u.first_value, u.bucket) as usage
            FROM cagg_usage_1h u
            JOIN facilities f ON u."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE l.code = ${line.toUpperCase()}
              AND u.bucket >= ${prevDayUtc} AND u.bucket < ${targetDateUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = u."facilityId"
                  AND fec."energyType"::text = u.energy_type::text
                  AND fec."calcMethod"::text = 'DIFF' AND fec."isActive" = true
              )
            GROUP BY u."tagId", u.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (u.bucket + ${KST_OFFSET} - date_trunc('day', u.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw}
            UNION ALL
            SELECT t."tagId", t.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (t.bucket + ${KST_OFFSET} - date_trunc('day', t.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
              SUM(CASE WHEN t.energy_type = 'elec'::"EnergyType" THEN t.sum_value / 60.0 ELSE t.sum_value END) as usage
            FROM cagg_trend_usage_1h t
            JOIN facilities f ON t."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE l.code = ${line.toUpperCase()}
              AND t.bucket >= ${prevDayUtc} AND t.bucket < ${targetDateUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                  AND fec."energyType"::text = t.energy_type::text
                  AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."tagId", t.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (t.bucket + ${KST_OFFSET} - date_trunc('day', t.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw}
          )
          SELECT
            epoch,
            energy_type::text as "energyType",
            SUM(usage) as "avgValue"
          FROM tag_usage
          GROUP BY epoch, energy_type
          ORDER BY epoch
        `;
      } else if (intervalSec >= 900) {
        // ============================================================
        // 15분~30분: 15min CA 직접 조회 (DIFF: LAST-FIRST, INTEGRAL_TRAP: SUM)
        // ============================================================
        currentData = await this.prisma.$queryRaw<any[]>`
          WITH tag_usage AS (
            SELECT u."tagId", u.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (u.bucket + ${KST_OFFSET} - date_trunc('day', u.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
              LAST(u.last_value, u.bucket) - FIRST(u.first_value, u.bucket) as usage
            FROM cagg_usage_15min u
            JOIN facilities f ON u."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE l.code = ${line.toUpperCase()}
              AND u.bucket >= ${targetDateUtc} AND u.bucket < ${nextDayUtc}
            GROUP BY u."tagId", u.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (u.bucket + ${KST_OFFSET} - date_trunc('day', u.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw}
            UNION ALL
            SELECT t."tagId", t.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (t.bucket + ${KST_OFFSET} - date_trunc('day', t.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
              SUM(CASE WHEN t.energy_type = 'elec'::"EnergyType" THEN t.sum_value / 60.0 ELSE t.sum_value END) as usage
            FROM cagg_trend_usage_15min t
            JOIN facilities f ON t."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE l.code = ${line.toUpperCase()}
              AND t.bucket >= ${targetDateUtc} AND t.bucket < ${nextDayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                  AND fec."energyType"::text = t.energy_type::text
                  AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."tagId", t.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (t.bucket + ${KST_OFFSET} - date_trunc('day', t.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw}
          )
          SELECT
            epoch,
            energy_type::text as "energyType",
            SUM(usage) as "avgValue"
          FROM tag_usage
          GROUP BY epoch, energy_type
          ORDER BY epoch
        `;

        prevData = await this.prisma.$queryRaw<any[]>`
          WITH tag_usage AS (
            SELECT u."tagId", u.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (u.bucket + ${KST_OFFSET} - date_trunc('day', u.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
              LAST(u.last_value, u.bucket) - FIRST(u.first_value, u.bucket) as usage
            FROM cagg_usage_15min u
            JOIN facilities f ON u."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE l.code = ${line.toUpperCase()}
              AND u.bucket >= ${prevDayUtc} AND u.bucket < ${targetDateUtc}
            GROUP BY u."tagId", u.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (u.bucket + ${KST_OFFSET} - date_trunc('day', u.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw}
            UNION ALL
            SELECT t."tagId", t.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (t.bucket + ${KST_OFFSET} - date_trunc('day', t.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
              SUM(CASE WHEN t.energy_type = 'elec'::"EnergyType" THEN t.sum_value / 60.0 ELSE t.sum_value END) as usage
            FROM cagg_trend_usage_15min t
            JOIN facilities f ON t."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE l.code = ${line.toUpperCase()}
              AND t.bucket >= ${prevDayUtc} AND t.bucket < ${targetDateUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                  AND fec."energyType"::text = t.energy_type::text
                  AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."tagId", t.energy_type,
              FLOOR(EXTRACT(EPOCH FROM (t.bucket + ${KST_OFFSET} - date_trunc('day', t.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw}
          )
          SELECT
            epoch,
            energy_type::text as "energyType",
            SUM(usage) as "avgValue"
          FROM tag_usage
          GROUP BY epoch, energy_type
          ORDER BY epoch
        `;
      } else {
        // ============================================================
        // 1분~5분: VIEW 기반 (cagg_usage_combined_1min) — 병렬 실행 최적
        // ============================================================
        currentData = await this.prisma.$queryRaw<any[]>`
          WITH tag_usage AS (
            SELECT
              c."tagId", c.energy_type, c.calc_method,
              FLOOR(EXTRACT(EPOCH FROM (c.bucket + ${KST_OFFSET} - date_trunc('day', c.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
              CASE WHEN c.calc_method = 'DIFF'
                THEN LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) + SUM(COALESCE(c.reset_correction, 0))
                ELSE SUM(c.usage_diff)
              END as usage
            FROM cagg_usage_combined_1min c
            JOIN facilities f ON c."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE l.code = ${line.toUpperCase()}
              AND c.bucket >= ${targetDateUtc} AND c.bucket < ${nextDayUtc}
            GROUP BY c."tagId", c.energy_type, c.calc_method,
              FLOOR(EXTRACT(EPOCH FROM (c.bucket + ${KST_OFFSET} - date_trunc('day', c.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw}
          )
          SELECT epoch, energy_type as "energyType", SUM(usage) as "avgValue"
          FROM tag_usage
          GROUP BY epoch, energy_type
          ORDER BY epoch
        `;

        prevData = await this.prisma.$queryRaw<any[]>`
          WITH tag_usage AS (
            SELECT
              c."tagId", c.energy_type, c.calc_method,
              FLOOR(EXTRACT(EPOCH FROM (c.bucket + ${KST_OFFSET} - date_trunc('day', c.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw} as epoch,
              CASE WHEN c.calc_method = 'DIFF'
                THEN LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) + SUM(COALESCE(c.reset_correction, 0))
                ELSE SUM(c.usage_diff)
              END as usage
            FROM cagg_usage_combined_1min c
            JOIN facilities f ON c."facilityId" = f.id
            JOIN lines l ON f."lineId" = l.id
            WHERE l.code = ${line.toUpperCase()}
              AND c.bucket >= ${prevDayUtc} AND c.bucket < ${targetDateUtc}
            GROUP BY c."tagId", c.energy_type, c.calc_method,
              FLOOR(EXTRACT(EPOCH FROM (c.bucket + ${KST_OFFSET} - date_trunc('day', c.bucket + ${KST_OFFSET}))) / ${intervalRaw})::INTEGER * ${intervalRaw}
          )
          SELECT epoch, energy_type as "energyType", SUM(usage) as "avgValue"
          FROM tag_usage
          GROUP BY epoch, energy_type
          ORDER BY epoch
        `;
      }

      this.logger.debug(`🔍 Raw data fetched - Current: ${currentData.length} rows, Prev: ${prevData.length} rows`);

      // 데이터 맵 생성 (TagDataRaw 형식: energyType, avgValue)
      const currentPowerMap = new Map<number, number>();
      const currentAirMap = new Map<number, number>();
      const prevPowerMap = new Map<number, number>();
      const prevAirMap = new Map<number, number>();

      currentData.forEach((d) => {
        const epoch = Number(d.epoch);
        if (d.energyType === 'elec') {
          currentPowerMap.set(epoch, Number(d.avgValue || 0));
        } else if (d.energyType === 'air') {
          currentAirMap.set(epoch, Number(d.avgValue || 0));
        }
      });

      prevData.forEach((d) => {
        const epoch = Number(d.epoch);
        if (d.energyType === 'elec') {
          prevPowerMap.set(epoch, Number(d.avgValue || 0));
        } else if (d.energyType === 'air') {
          prevAirMap.set(epoch, Number(d.avgValue || 0));
        }
      });

      // 결과 배열 생성 (Frontend series key: power/prevPower, air/prevAir)
      const powerResult: Array<{ time: string; power: number; prevPower: number }> = [];
      const airResult: Array<{ time: string; air: number; prevAir: number }> = [];

      for (let i = 0; i < steps; i++) {
        const currentEpoch = i * intervalSec; // 자정 기준 초 (0 = 00:00:00)
        const totalSec = i * intervalSec;
        const hour = Math.floor(totalSec / 3600);
        const minute = Math.floor((totalSec % 3600) / 60);
        const second = totalSec % 60;

        // 시:분:초 형식
        let timeStr: string;
        if (intervalSec < 60) {
          timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        } else {
          timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        }

        powerResult.push({
          time: timeStr,
          power: Math.round((currentPowerMap.get(currentEpoch) || 0) * 100) / 100,
          prevPower: Math.round((prevPowerMap.get(currentEpoch) || 0) * 100) / 100,
        });

        airResult.push({
          time: timeStr,
          air: Math.round(currentAirMap.get(currentEpoch) || 0),
          prevAir: Math.round(prevAirMap.get(currentEpoch) || 0),
        });
      }

      this.logger.debug(`📊 Result - Power: ${powerResult.length} points, Air: ${airResult.length} points`);
      this.logger.debug(`📈 Sample data - Power[0]: ${JSON.stringify(powerResult[0])}, Air[0]: ${JSON.stringify(airResult[0])}`);

      return {
        power: powerResult,
        air: airResult,
      };
    } catch (error) {
      this.logger.error('Error fetching line detail chart:', error);
      throw error;
    }
  }

  // MON-003: 에너지 순위 (FacilityEnergy 형식 반환)
  async getEnergyRanking(line: string, type: string) {
    this.logger.log(`Fetching energy ranking: ${line}, type: ${type}`);

    try {
      const today = todayStart();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const lineCode = line.toUpperCase();
      const todayUtc = toUtcSql(today);
      const weekAgoUtc = toUtcSql(weekAgo);
      const yesterdayUtc = toUtcSql(yesterday);

      // 설비별 당일/주간/전일 집계 (VIEW 바이패스 — CA 직접 조회)
      // Today: minute CAs, Weekly/Yesterday: hourly CAs
      const ranking = await this.prisma.$queryRaw<any[]>`
        WITH daily_usage AS (
          SELECT sub."facilityId", sub.energy_type, SUM(sub.usage) AS usage FROM (
            SELECT u."facilityId", u.energy_type::text AS energy_type, SUM(u.raw_usage_diff) AS usage
            FROM cagg_usage_1min u
            WHERE u.bucket >= ${todayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = u."facilityId"
                AND fec."energyType"::text = u.energy_type::text
                AND fec."calcMethod"::text = 'DIFF' AND fec."isActive" = true
              )
            GROUP BY u."facilityId", u.energy_type
            UNION ALL
            SELECT t."facilityId", t.energy_type::text AS energy_type,
              SUM(CASE WHEN t.energy_type::text = 'elec' THEN t.avg_value / 60.0 ELSE t.avg_value END) AS usage
            FROM cagg_trend_usage_1min t
            WHERE t.bucket >= ${todayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."facilityId", t.energy_type
          ) sub GROUP BY sub."facilityId", sub.energy_type
        ),
        daily_agg AS (
          SELECT "facilityId",
            SUM(CASE WHEN energy_type = 'elec' THEN usage ELSE 0 END) AS "dailyElec",
            SUM(CASE WHEN energy_type = 'air' THEN usage ELSE 0 END) AS "dailyAir"
          FROM daily_usage GROUP BY "facilityId"
        ),
        weekly_usage AS (
          SELECT sub."facilityId", sub.energy_type, SUM(sub.usage) AS usage FROM (
            SELECT u."facilityId", u.energy_type::text AS energy_type, SUM(u.raw_usage_diff) AS usage
            FROM cagg_usage_1h u
            WHERE u.bucket >= ${weekAgoUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = u."facilityId"
                AND fec."energyType"::text = u.energy_type::text
                AND fec."calcMethod"::text = 'DIFF' AND fec."isActive" = true
              )
            GROUP BY u."facilityId", u.energy_type
            UNION ALL
            SELECT t."facilityId", t.energy_type::text AS energy_type,
              SUM(CASE WHEN t.energy_type::text = 'elec' THEN t.sum_value / 60.0 ELSE t.sum_value END) AS usage
            FROM cagg_trend_usage_1h t
            WHERE t.bucket >= ${weekAgoUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."facilityId", t.energy_type
          ) sub GROUP BY sub."facilityId", sub.energy_type
        ),
        weekly_agg AS (
          SELECT "facilityId",
            SUM(CASE WHEN energy_type = 'elec' THEN usage ELSE 0 END) AS "weeklyElec",
            SUM(CASE WHEN energy_type = 'air' THEN usage ELSE 0 END) AS "weeklyAir"
          FROM weekly_usage GROUP BY "facilityId"
        ),
        prev_daily_usage AS (
          SELECT sub."facilityId", sub.energy_type, SUM(sub.usage) AS usage FROM (
            SELECT u."facilityId", u.energy_type::text AS energy_type, SUM(u.raw_usage_diff) AS usage
            FROM cagg_usage_1h u
            WHERE u.bucket >= ${yesterdayUtc} AND u.bucket < ${todayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = u."facilityId"
                AND fec."energyType"::text = u.energy_type::text
                AND fec."calcMethod"::text = 'DIFF' AND fec."isActive" = true
              )
            GROUP BY u."facilityId", u.energy_type
            UNION ALL
            SELECT t."facilityId", t.energy_type::text AS energy_type,
              SUM(CASE WHEN t.energy_type::text = 'elec' THEN t.sum_value / 60.0 ELSE t.sum_value END) AS usage
            FROM cagg_trend_usage_1h t
            WHERE t.bucket >= ${yesterdayUtc} AND t.bucket < ${todayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."facilityId", t.energy_type
          ) sub GROUP BY sub."facilityId", sub.energy_type
        ),
        prev_daily_agg AS (
          SELECT "facilityId",
            SUM(CASE WHEN energy_type = 'elec' THEN usage ELSE 0 END) AS "prevDailyElec",
            SUM(CASE WHEN energy_type = 'air' THEN usage ELSE 0 END) AS "prevDailyAir"
          FROM prev_daily_usage GROUP BY "facilityId"
        )
        SELECT
          f.id AS "facilityId", f.code, f.name, f.process, f.status, f."isProcessing",
          COALESCE(d."dailyElec", 0) AS "dailyElec",
          COALESCE(d."dailyAir", 0) AS "dailyAir",
          COALESCE(w."weeklyElec", 0) AS "weeklyElec",
          COALESCE(w."weeklyAir", 0) AS "weeklyAir",
          COALESCE(p."prevDailyElec", 0) AS "prevDailyElec",
          COALESCE(p."prevDailyAir", 0) AS "prevDailyAir"
        FROM facilities f
        JOIN lines l ON f."lineId" = l.id
        LEFT JOIN daily_agg d ON f.id = d."facilityId"
        LEFT JOIN weekly_agg w ON f.id = w."facilityId"
        LEFT JOIN prev_daily_agg p ON f.id = p."facilityId"
        WHERE (${lineCode} = 'ALL' OR l.code = ${lineCode})
      `;

      // 순위 계산 + 순위 변동
      const sortedByElec = [...ranking].sort((a, b) => Number(b.dailyElec) - Number(a.dailyElec));
      const sortedByAir = [...ranking].sort((a, b) => Number(b.dailyAir) - Number(a.dailyAir));
      const prevSortedByElec = [...ranking].sort((a, b) => Number(b.prevDailyElec) - Number(a.prevDailyElec));
      const prevSortedByAir = [...ranking].sort((a, b) => Number(b.prevDailyAir) - Number(a.prevDailyAir));

      return ranking.map((r) => {
        const rankElec = sortedByElec.findIndex((s) => s.facilityId === r.facilityId) + 1;
        const rankAir = sortedByAir.findIndex((s) => s.facilityId === r.facilityId) + 1;
        const prevRankElec = prevSortedByElec.findIndex((s) => s.facilityId === r.facilityId) + 1;
        const prevRankAir = prevSortedByAir.findIndex((s) => s.facilityId === r.facilityId) + 1;

        return {
          facilityId: r.facilityId,
          code: r.code,
          name: r.name,
          process: r.process || 'OP00',
          dailyElec: Number(r.dailyElec),
          weeklyElec: Number(r.weeklyElec),
          dailyAir: Number(r.dailyAir),
          weeklyAir: Number(r.weeklyAir),
          prevDailyElec: Number(r.prevDailyElec),
          prevDailyAir: Number(r.prevDailyAir),
          rankElec,
          rankAir,
          rankChangeElec: prevRankElec - rankElec,
          rankChangeAir: prevRankAir - rankAir,
          status: r.status,
          isProcessing: r.isProcessing,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching energy ranking:', error);
      throw error;
    }
  }

  // MON-004: 에너지 알림 현황 (EnergyAlertData 형식 반환)
  async getEnergyAlertStatus(line: string) {
    this.logger.log(`Fetching energy alert status: ${line}`);

    try {
      const today = todayStart();
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastYear = new Date(today);
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      const lastYearEnd = new Date(lastYear);
      lastYearEnd.setDate(lastYearEnd.getDate() + 30);

      const lineCode = line.toUpperCase();
      const todayUtc = toUtcSql(today);
      const lastMonthUtc = toUtcSql(lastMonth);

      // 설비별 당월/전월 에너지 집계 (VIEW 바이패스 — CA 직접 조회)
      // Current(today): minute CAs, Prev month: hourly CAs
      const data = await this.prisma.$queryRaw<any[]>`
        WITH current_usage AS (
          SELECT sub."facilityId", sub.energy_type, SUM(sub.usage) AS usage FROM (
            SELECT u."facilityId", u.energy_type::text AS energy_type, SUM(u.raw_usage_diff) AS usage
            FROM cagg_usage_1min u
            WHERE u.bucket >= ${todayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = u."facilityId"
                AND fec."energyType"::text = u.energy_type::text
                AND fec."calcMethod"::text = 'DIFF' AND fec."isActive" = true
              )
            GROUP BY u."facilityId", u.energy_type
            UNION ALL
            SELECT t."facilityId", t.energy_type::text AS energy_type,
              SUM(CASE WHEN t.energy_type::text = 'elec' THEN t.avg_value / 60.0 ELSE t.avg_value END) AS usage
            FROM cagg_trend_usage_1min t
            WHERE t.bucket >= ${todayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."facilityId", t.energy_type
          ) sub GROUP BY sub."facilityId", sub.energy_type
        ),
        current_agg AS (
          SELECT "facilityId",
            SUM(CASE WHEN energy_type = 'elec' THEN usage ELSE 0 END) AS "currentElec",
            SUM(CASE WHEN energy_type = 'air' THEN usage ELSE 0 END) AS "currentAir"
          FROM current_usage GROUP BY "facilityId"
        ),
        prev_month_usage AS (
          SELECT sub."facilityId", sub.energy_type, SUM(sub.usage) AS usage FROM (
            SELECT u."facilityId", u.energy_type::text AS energy_type, SUM(u.raw_usage_diff) AS usage
            FROM cagg_usage_1h u
            WHERE u.bucket >= ${lastMonthUtc} AND u.bucket < ${todayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = u."facilityId"
                AND fec."energyType"::text = u.energy_type::text
                AND fec."calcMethod"::text = 'DIFF' AND fec."isActive" = true
              )
            GROUP BY u."facilityId", u.energy_type
            UNION ALL
            SELECT t."facilityId", t.energy_type::text AS energy_type,
              SUM(CASE WHEN t.energy_type::text = 'elec' THEN t.sum_value / 60.0 ELSE t.sum_value END) AS usage
            FROM cagg_trend_usage_1h t
            WHERE t.bucket >= ${lastMonthUtc} AND t.bucket < ${todayUtc}
              AND EXISTS (
                SELECT 1 FROM facility_energy_configs fec
                WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
              )
            GROUP BY t."facilityId", t.energy_type
          ) sub GROUP BY sub."facilityId", sub.energy_type
        ),
        prev_month_agg AS (
          SELECT "facilityId",
            SUM(CASE WHEN energy_type = 'elec' THEN usage ELSE 0 END) AS "prevMonthElec",
            SUM(CASE WHEN energy_type = 'air' THEN usage ELSE 0 END) AS "prevMonthAir"
          FROM prev_month_usage GROUP BY "facilityId"
        )
        SELECT
          f.id AS "facilityId", f.code, f.name, f.process, f.status,
          COALESCE(cu."currentElec", 0) AS "currentElec",
          COALESCE(cu."currentAir", 0) AS "currentAir",
          COALESCE(pm."prevMonthElec", 0) AS "prevMonthElec",
          COALESCE(pm."prevMonthAir", 0) AS "prevMonthAir"
        FROM facilities f
        JOIN lines l ON f."lineId" = l.id
        LEFT JOIN current_agg cu ON f.id = cu."facilityId"
        LEFT JOIN prev_month_agg pm ON f.id = pm."facilityId"
        WHERE l.code = ${lineCode}
      `;

      return data.map((d) => {
        const currentElec = Number(d.currentElec);
        const prevMonthElec = Number(d.prevMonthElec) || 1;
        const currentAir = Number(d.currentAir);
        const prevMonthAir = Number(d.prevMonthAir) || 1;

        const prevMonthChangeElec = ((currentElec - prevMonthElec) / prevMonthElec) * 100;
        const prevYearChangeElec = prevMonthChangeElec * 1.3; // 전년 대비 추정
        const prevMonthChangeAir = ((currentAir - prevMonthAir) / prevMonthAir) * 100;
        const prevYearChangeAir = prevMonthChangeAir * 1.2;

        const elecStatus = Math.abs(prevMonthChangeElec) > 15 ? 'DANGER' : Math.abs(prevMonthChangeElec) > 10 ? 'WARNING' : 'NORMAL';
        const airStatus = Math.abs(prevMonthChangeAir) > 15 ? 'DANGER' : Math.abs(prevMonthChangeAir) > 10 ? 'WARNING' : 'NORMAL';

        return {
          facilityId: d.facilityId,
          code: d.code,
          name: d.name,
          process: d.process || 'OP00',
          prevMonthChangeElec: Math.round(prevMonthChangeElec * 10) / 10,
          prevYearChangeElec: Math.round(prevYearChangeElec * 10) / 10,
          prevMonthChangeAir: Math.round(prevMonthChangeAir * 10) / 10,
          prevYearChangeAir: Math.round(prevYearChangeAir * 10) / 10,
          elecStatus,
          airStatus,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching energy alert status:', error);
      throw error;
    }
  }

  // MON-005: 전력 품질 순위 (PowerQualityData 형식 반환)
  async getPowerQualityRanking(line: string, startDate?: string, endDate?: string) {
    this.logger.log(`Fetching power quality ranking: ${line}, ${startDate}~${endDate}`);

    try {
      // 날짜 범위 결정: 파라미터 없으면 오늘
      const start = startDate ? new Date(`${startDate}T00:00:00+09:00`) : todayStart();
      const end = endDate ? new Date(`${endDate}T23:59:59+09:00`) : new Date(start.getTime() + 86400000);

      const lineCode = line.toUpperCase();
      const startUtc = toUtcSql(start);
      const endUtc = toUtcSql(end);

      // cagg_quality_1min: 1분 버킷 품질 집계
      // tag_name 패턴으로 3상 전류(A/B/C)와 역률(PF) 구분
      // 불평형률 = (MAX상 - MIN상) / AVG상 × 100
      const ranking = await this.prisma.$queryRaw<any[]>`
        WITH quality_agg AS (
          SELECT
            q."facilityId",
            AVG(CASE WHEN q.tag_name ~ '_A$' AND q.tag_name !~ 'PF' THEN q.avg_value END) AS "phaseA",
            AVG(CASE WHEN q.tag_name ~ '_B$' AND q.tag_name !~ 'PF' THEN q.avg_value END) AS "phaseB",
            AVG(CASE WHEN q.tag_name ~ '_C$' AND q.tag_name !~ 'PF' THEN q.avg_value END) AS "phaseC",
            AVG(CASE WHEN q.tag_name ~ 'PF' THEN q.avg_value END) AS "avgPf",
            MIN(CASE WHEN q.tag_name ~ 'PF' THEN q.min_value END) AS "minPf"
          FROM cagg_quality_1min q
          WHERE q.bucket >= ${startUtc} AND q.bucket < ${endUtc}
          GROUP BY q."facilityId"
        )
        SELECT
          f.id AS "facilityId",
          f.code,
          f.name,
          f.process,
          f.status,
          COALESCE(qd."phaseA", 0) AS "phaseA",
          COALESCE(qd."phaseB", 0) AS "phaseB",
          COALESCE(qd."phaseC", 0) AS "phaseC",
          CASE
            WHEN qd."phaseA" IS NOT NULL AND qd."phaseB" IS NOT NULL AND qd."phaseC" IS NOT NULL
                 AND (qd."phaseA" + qd."phaseB" + qd."phaseC") > 0
            THEN (GREATEST(qd."phaseA", qd."phaseB", qd."phaseC") - LEAST(qd."phaseA", qd."phaseB", qd."phaseC"))
                 / ((qd."phaseA" + qd."phaseB" + qd."phaseC") / 3.0) * 100
            ELSE 0
          END AS "unbalanceRate",
          COALESCE(qd."avgPf", 0) AS "powerFactor",
          COALESCE(qd."minPf", 0) AS "minPowerFactor"
        FROM facilities f
        JOIN lines l ON f."lineId" = l.id
        LEFT JOIN quality_agg qd ON f.id = qd."facilityId"
        WHERE l.code = ${lineCode}
      `;

      // 순위 계산
      const sortedByUnbalance = [...ranking].sort((a, b) => Number(b.unbalanceRate) - Number(a.unbalanceRate));
      const sortedByPowerFactor = [...ranking].sort((a, b) => Number(a.powerFactor) - Number(b.powerFactor));

      return ranking.map((r) => {
        const phaseA = roundTo(Number(r.phaseA), 1);
        const phaseB = roundTo(Number(r.phaseB), 1);
        const phaseC = roundTo(Number(r.phaseC), 1);
        const unbalanceRate = roundTo(Number(r.unbalanceRate), 1);
        const powerFactor = roundTo(Number(r.powerFactor), 1);
        const minPowerFactor = roundTo(Number(r.minPowerFactor), 1);
        const unbalanceLimit = 5.0;
        const powerFactorLimit = 90;

        // 불평형률 상태 (낮을수록 좋음: 기준 5% 이하)
        const unbalanceStatus = unbalanceRate > unbalanceLimit * 1.5 ? 'DANGER'
          : unbalanceRate > unbalanceLimit ? 'WARNING' : 'NORMAL';

        // 역률 상태 (높을수록 좋음: 기준 90% 이상)
        const powerFactorStatus = powerFactor < powerFactorLimit * 0.9 ? 'DANGER'
          : powerFactor < powerFactorLimit ? 'WARNING' : 'NORMAL';

        // 종합: 둘 중 나쁜 쪽
        const statusPriority = { NORMAL: 0, WARNING: 1, DANGER: 2 } as const;
        const status = statusPriority[unbalanceStatus] >= statusPriority[powerFactorStatus]
          ? unbalanceStatus : powerFactorStatus;

        return {
          facilityId: r.facilityId,
          code: r.code,
          name: r.name,
          process: r.process || 'OP00',
          phaseA,
          phaseB,
          phaseC,
          unbalanceRate,
          unbalanceLimit,
          powerFactor,
          minPowerFactor,
          powerFactorLimit,
          status,
          unbalanceStatus,
          powerFactorStatus,
          rankUnbalance: sortedByUnbalance.findIndex((s) => s.facilityId === r.facilityId) + 1,
          rankPowerFactor: sortedByPowerFactor.findIndex((s) => s.facilityId === r.facilityId) + 1,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching power quality ranking:', error);
      throw error;
    }
  }

  // MON-006: 에어 누기 순위 (비생산시간 + 설비별 기준값 기반)
  async getAirLeakRanking(line: string) {
    this.logger.log(`Fetching air leak ranking: ${line}`);

    try {
      const lineCode = line.toUpperCase();

      // 1) 라인 조회
      const lineRecord = await this.prisma.line.findUnique({ where: { code: lineCode } });
      if (!lineRecord) return [];

      // 2) 오늘 dayType 결정 (ProductionCalendar 예외 우선)
      const now = new Date();
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayStr = kstNow.toISOString().slice(0, 10);

      const calEntry = await this.prisma.productionCalendar.findFirst({
        where: {
          date: new Date(todayStr + 'T00:00:00'),
          OR: [{ lineId: lineRecord.id }, { lineId: null }],
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

      // 3) 비생산 스케줄 조회
      const schedule = await this.prisma.nonProductionSchedule.findUnique({
        where: { lineId_dayType: { lineId: lineRecord.id, dayType: dayType as any } },
      });

      // 4) 비생산 시간 범위 → UTC SQL 조건
      let timeFilter: Prisma.Sql;
      if (!schedule) {
        // 스케줄 미설정 → 오늘 전체 (폴백)
        const todayUtc = toUtcSql(todayStart());
        timeFilter = Prisma.sql`c.bucket >= ${todayUtc}`;
      } else {
        const kstToUtcTs = (time: string) => {
          const d = new Date(`${todayStr}T${time}:00+09:00`);
          return d.toISOString().slice(0, 19);
        };

        if (schedule.startTime > schedule.endTime) {
          // 야간 스팬: [00:00~endTime] + [startTime~24:00]
          const r1Start = kstToUtcTs('00:00');
          const r1End = kstToUtcTs(schedule.endTime);
          const r2Start = kstToUtcTs(schedule.startTime);
          const r2End = kstToUtcTs('23:59');
          timeFilter = Prisma.sql`(
            (c.bucket >= ${Prisma.raw(`'${r1Start}'::timestamp`)} AND c.bucket < ${Prisma.raw(`'${r1End}'::timestamp`)})
            OR
            (c.bucket >= ${Prisma.raw(`'${r2Start}'::timestamp`)} AND c.bucket <= ${Prisma.raw(`'${r2End}'::timestamp`)})
          )`;
        } else {
          // 주간: [startTime~endTime]
          const rStart = kstToUtcTs(schedule.startTime);
          const rEnd = kstToUtcTs(schedule.endTime);
          timeFilter = Prisma.sql`(c.bucket >= ${Prisma.raw(`'${rStart}'::timestamp`)} AND c.bucket < ${Prisma.raw(`'${rEnd}'::timestamp`)})`;
        }
      }

      // 버킷 간격(초) — cagg_trend_10sec = 10초, 단위 환산 상수
      const BUCKET_SEC = 10;
      const BUCKET_MIN_FACTOR = BUCKET_SEC / 60; // 10/60 = 0.1667

      // 5) 집계 쿼리 (전체 + 초과 분리)
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
        LEFT JOIN cagg_trend_10sec c ON f.id = c."facilityId"
          AND c.energy_type::text = 'air'
          AND ${timeFilter}
        WHERE l.code = ${lineCode}
        GROUP BY f.id, f.code, f.name, f.process, f.metadata
        ORDER BY "sumFlow" DESC NULLS LAST
      `;

      // 에어 단가 (원/L) — system_settings 테이블에서 조회
      const costRow = await this.prisma.$queryRaw<{ value: any }[]>`
        SELECT value FROM system_settings WHERE key = 'air_cost_per_liter'
      `;
      const AIR_COST_PER_LITER = Number(costRow[0]?.value) || 0.5;

      // 6) 적산 기반 계산
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

        // 시간 (분)
        const nonProdMinutes = Math.round(totalBuckets * BUCKET_SEC / 60 * 10) / 10;
        const exceedMinutes = Math.round(exceedBuckets * BUCKET_SEC / 60 * 10) / 10;

        // 누기율 = 초과시간 / 비생산시간 × 100
        const leakRate = totalBuckets > 0 ? Math.round((exceedBuckets / totalBuckets) * 1000) / 10 : 0;

        // 에어사용량 (L) = SUM(순시유량 L/min) × (버킷간격 / 60)
        const nonProdUsage = Math.round(sumFlow * BUCKET_MIN_FACTOR);
        const baselineUsage = Math.round(baseline * nonProdMinutes);
        const excessUsage = Math.max(0, nonProdUsage - baselineUsage);

        // 추정 누기비용
        const estimatedCost = Math.round(excessUsage * AIR_COST_PER_LITER);

        // 상태
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

  // ===== Helper Methods =====

  private getLineLabel(line: string): string {
    const labels: Record<string, string> = {
      BLOCK: '블록',
      HEAD: '헤드',
      CRANK: '크랭크',
      ASSEMBLY: '조립',
    };
    return labels[line] || line;
  }

  // ===== Dynamic Resolution API Methods =====

  /**
   * 동적 해상도 데이터 조회 (Progressive Resolution)
   *
   * @param facilityId - 설비 ID (Facility.code)
   * @param metric - 메트릭 타입 ('power' | 'air')
   * @param query - 쿼리 파라미터 (startTime, endTime, interval, maxPoints)
   * @returns RangeDataResponse
   */
  async fetchRangeData(
    facilityId: string,
    metric: 'power' | 'air',
    query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    this.logger.log(`📊 Fetching ${metric} range data: ${facilityId}, ${query.interval}`);

    // 0. Check cache first
    const cacheKey = this.getCacheKey(facilityId, metric, query);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug(`✅ Cache HIT: ${cacheKey}`);
      return cached;
    }

    // 1. Validation
    const { startTime, endTime, interval, maxPoints } = query;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO8601 UTC format (YYYY-MM-DDTHH:mm:ssZ).');
    }

    if (start >= end) {
      throw new InvalidTimeRangeException(startTime, endTime);
    }

    // 2. Facility 존재 확인 (all = 공장 전체 합산, 설비 필터 생략)
    let facilityUuid: string | null = null;
    if (facilityId !== 'all') {
      const facility = await this.prisma.facility.findUnique({
        where: { code: facilityId },
      });
      if (!facility) {
        throw new FacilityNotFoundException(facilityId);
      }
      facilityUuid = facility.id;
    }

    // 3. TimescaleDB 쿼리 생성 및 실행
    const { data, totalPoints } = await this.buildTimeBucketQuery(
      facilityUuid,
      metric,
      start,
      end,
      interval,
    );

    // 4. Down-sampling (maxPoints 제한)
    let finalData = data;
    let downsampled = false;

    if (maxPoints && data.length > maxPoints) {
      finalData = this.downsample(data, maxPoints);
      downsampled = true;
      this.logger.debug(`🔽 Down-sampled: ${data.length} → ${finalData.length} points`);
    }

    // 5. Metadata 생성
    const metadata = {
      interval,
      totalPoints,
      returnedPoints: finalData.length,
      downsampled,
      zoomLevel: INTERVAL_TO_ZOOM_LEVEL[interval],
      startTime,
      endTime,
      facilityId,
      metric,
    };

    this.logger.log(`✅ Returned ${finalData.length} points (zoom level: ${metadata.zoomLevel})`);

    // 6. 이상 이벤트 조회 (같은 시간 범위)
    let anomalies: AnomalyEvent[] = [];
    try {
      anomalies = await this.resetDetectorService.getAnomalyEvents({
        facilityId: facilityUuid ?? undefined,
        startTime: start,
        endTime: end,
      });
    } catch (err) {
      this.logger.warn('Failed to fetch anomaly events (non-critical):', err);
    }

    const response: RangeDataResponse = {
      data: finalData,
      metadata,
      ...(anomalies.length > 0 && { anomalies }),
    };

    // 7. Store in cache
    this.setToCache(cacheKey, response, interval);

    return response;
  }

  /**
   * 라인별 범위 데이터 조회 (동적 해상도)
   *
   * 해당 라인에 속한 모든 설비의 에너지 데이터를 합산하여 반환
   *
   * @param lineCode - 라인 코드 (BLOCK, HEAD, CRANK, ASSEMBLE 등)
   * @param metric - 메트릭 타입 ('power' | 'air')
   * @param query - 쿼리 파라미터
   * @returns RangeDataResponse
   */
  async fetchLineRangeData(
    lineCode: string,
    metric: 'power' | 'air',
    query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    this.logger.log(`📊 Fetching ${metric} line range data: lineCode=${lineCode}, interval=${query.interval}`);

    // 0. Cache check
    const cacheKey = `line:${lineCode}:${metric}:${query.startTime}:${query.endTime}:${query.interval}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug(`✅ Cache HIT: ${cacheKey}`);
      return cached;
    }

    // 1. Validation
    const { startTime, endTime, interval, maxPoints } = query;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO8601 UTC format (YYYY-MM-DDTHH:mm:ssZ).');
    }

    if (start >= end) {
      throw new InvalidTimeRangeException(startTime, endTime);
    }

    // 2. Line 존재 확인
    const line = await this.prisma.line.findUnique({
      where: { code: lineCode.toUpperCase() },
    });
    if (!line) {
      throw new NotFoundException(`Line not found: ${lineCode}`);
    }

    // 3. TimescaleDB 쿼리 실행 (라인 UUID 기반 서브쿼리 필터링)
    const { data, totalPoints } = await this.buildTimeBucketQuery(
      line.id,
      metric,
      start,
      end,
      interval,
      'line', // entityType
    );

    // 4. Down-sampling
    let finalData = data;
    let downsampled = false;
    if (maxPoints && data.length > maxPoints) {
      finalData = this.downsample(data, maxPoints);
      downsampled = true;
    }

    // 5. Metadata
    const metadata = {
      interval,
      totalPoints,
      returnedPoints: finalData.length,
      downsampled,
      zoomLevel: INTERVAL_TO_ZOOM_LEVEL[interval],
      startTime,
      endTime,
      facilityId: `line:${lineCode}`,
      metric,
    };

    // 6. 이상 이벤트 조회 (라인 소속 설비 전체)
    let anomalies: AnomalyEvent[] = [];
    try {
      anomalies = await this.resetDetectorService.getAnomalyEvents({
        lineId: line.id,
        startTime: start,
        endTime: end,
      });
    } catch (err) {
      this.logger.warn('Failed to fetch anomaly events for line (non-critical):', err);
    }

    const response: RangeDataResponse = {
      data: finalData,
      metadata,
      ...(anomalies.length > 0 && { anomalies }),
    };

    // 7. Cache
    this.setToCache(cacheKey, response, interval);

    this.logger.log(`✅ Line ${lineCode}: returned ${finalData.length} points (zoom level: ${metadata.zoomLevel})`);
    return response;
  }

  /**
   * 공장별 범위 데이터 조회 (동적 해상도)
   *
   * 해당 공장에 속한 모든 라인의 모든 설비 에너지 데이터를 합산하여 반환
   *
   * @param factoryCode - 공장 코드 (예: 'hw4')
   * @param metric - 메트릭 타입 ('power' | 'air')
   * @param query - 쿼리 파라미터
   * @returns RangeDataResponse
   */
  async fetchFactoryRangeData(
    factoryCode: string,
    metric: 'power' | 'air',
    query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    this.logger.log(`📊 Fetching ${metric} factory range data: factoryCode=${factoryCode}, interval=${query.interval}`);

    // 0. Cache check
    const cacheKey = `factory:${factoryCode}:${metric}:${query.startTime}:${query.endTime}:${query.interval}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug(`✅ Cache HIT: ${cacheKey}`);
      return cached;
    }

    // 1. Validation
    const { startTime, endTime, interval, maxPoints } = query;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO8601 UTC format (YYYY-MM-DDTHH:mm:ssZ).');
    }

    if (start >= end) {
      throw new InvalidTimeRangeException(startTime, endTime);
    }

    // 2. Factory 존재 확인
    const factory = await this.prisma.factory.findUnique({
      where: { code: factoryCode },
    });
    if (!factory) {
      throw new NotFoundException(`Factory not found: ${factoryCode}`);
    }

    // 3. TimescaleDB 쿼리 실행 (공장 UUID 기반 서브쿼리 필터링)
    const { data, totalPoints } = await this.buildTimeBucketQuery(
      factory.id,
      metric,
      start,
      end,
      interval,
      'factory',
    );

    // 4. Down-sampling
    let finalData = data;
    let downsampled = false;
    if (maxPoints && data.length > maxPoints) {
      finalData = this.downsample(data, maxPoints);
      downsampled = true;
    }

    // 5. Metadata
    const metadata = {
      interval,
      totalPoints,
      returnedPoints: finalData.length,
      downsampled,
      zoomLevel: INTERVAL_TO_ZOOM_LEVEL[interval],
      startTime,
      endTime,
      facilityId: `factory:${factoryCode}`,
      metric,
    };

    // 6. 이상 이벤트 조회 (공장 소속 전체)
    let anomalies: AnomalyEvent[] = [];
    try {
      anomalies = await this.resetDetectorService.getAnomalyEvents({
        startTime: start,
        endTime: end,
      });
    } catch (err) {
      this.logger.warn('Failed to fetch anomaly events for factory (non-critical):', err);
    }

    const response: RangeDataResponse = {
      data: finalData,
      metadata,
      ...(anomalies.length > 0 && { anomalies }),
    };

    // 7. Cache
    this.setToCache(cacheKey, response, interval);

    this.logger.log(`✅ Factory ${factoryCode}: returned ${finalData.length} points (zoom level: ${metadata.zoomLevel})`);
    return response;
  }

  /**
   * TimescaleDB time_bucket() 쿼리 생성 및 실행
   *
   * @param entityUuid - Facility UUID, Line UUID, Factory UUID, 또는 null (전체)
   * @param metric - 메트릭 타입
   * @param start - 시작 시간
   * @param end - 종료 시간
   * @param interval - 간격
   * @param entityType - 엔터티 타입 ('facility' | 'line' | 'factory' | 'all')
   * @returns 데이터 배열 및 총 포인트 수
   */
  private async buildTimeBucketQuery(
    entityUuid: string | null,
    metric: 'power' | 'air',
    start: Date,
    end: Date,
    interval: IntervalEnum,
    entityType: 'facility' | 'line' | 'factory' | 'all' = 'facility',
  ): Promise<{ data: RangeDataPoint[]; totalPoints: number }> {
    // interval → time_bucket() 문자열 변환
    const bucketInterval = INTERVAL_TO_BUCKET[interval];

    if (!bucketInterval) {
      throw new BadRequestException(`Invalid interval: ${interval}`);
    }

    // 전일 시간 범위
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - 1);

    // metric → 컬럼명/에너지타입 매핑
    const prevColumn = metric === 'power' ? 'prev_power' : 'prev_air';
    const fieldName = metric;
    const prevFieldName = metric === 'power' ? 'prevPower' : 'prevAir';
    const energyType = metric === 'power' ? 'elec' : 'air';

    // 소수점 자리수 (power: 2자리, air: 0자리)
    const decimalPlaces = metric === 'power' ? 2 : 0;

    // ✅ M-01 Fix: Interval-based data source routing
    // entityType에 따라 WHERE 절 동적 생성
    // - facility: 단일 설비 UUID → "facilityId" = $1
    // - line: 라인 UUID → "facilityId" IN (서브쿼리)
    // - all: 전체 공장 합산 → 필터 없음
    const hasEntity = entityUuid !== null && entityType !== 'all';
    let facWhere: string;
    let tagFacWhere: string;
    if (entityType === 'factory' && entityUuid) {
      facWhere = '"facilityId" IN (SELECT f.id FROM facilities f JOIN lines l ON f."lineId" = l.id WHERE l."factoryId" = $1) AND ';
      tagFacWhere = 'tag."facilityId" IN (SELECT f.id FROM facilities f JOIN lines l ON f."lineId" = l.id WHERE l."factoryId" = $1) AND ';
    } else if (entityType === 'line' && entityUuid) {
      facWhere = '"facilityId" IN (SELECT id FROM facilities WHERE "lineId" = $1) AND ';
      tagFacWhere = 'tag."facilityId" IN (SELECT id FROM facilities WHERE "lineId" = $1) AND ';
    } else if (entityType === 'facility' && entityUuid) {
      facWhere = '"facilityId" = $1 AND ';
      tagFacWhere = 'tag."facilityId" = $1 AND ';
    } else {
      facWhere = '';
      tagFacWhere = '';
    }
    const pS = hasEntity ? '$2' : '$1';   // start
    const pE = hasEntity ? '$3' : '$2';   // end
    const pPS = hasEntity ? '$4' : '$3';  // prev start
    const pPE = hasEntity ? '$5' : '$4';  // prev end

    let sql: string;
    const rawEnergyType = metric === 'power' ? 'elec' : 'air';

    if (isCaggBasedInterval(interval)) {
      // INTEGRAL_TRAP 변환: elec kW→kWh (/60), air L/min→L (그대로)
      const integralConvHourly = rawEnergyType === 'elec' ? 'sum_value / 60.0' : 'sum_value';
      const integralConvMinute = rawEnergyType === 'elec' ? 'avg_value / 60.0' : 'avg_value';

      if (interval === '1h' || interval === '1d') {
        // ── Hourly/Daily CA 직접 조회 (cagg_usage_combined_1min VIEW 우회) ──
        // 1h: cagg_usage_1h + cagg_trend_usage_1h → 24행/태그 (1분 CA 1440행 대비 60배 감소)
        // 1d: cagg_usage_1d + cagg_trend_usage_1d
        const diffTable = interval === '1h' ? 'cagg_usage_1h' : 'cagg_usage_1d';
        const integralTable = interval === '1h' ? 'cagg_trend_usage_1h' : 'cagg_trend_usage_1d';

        sql = `
          WITH time_slots AS (
            SELECT generate_series(
              ${pS}::timestamp,
              time_bucket('${bucketInterval}'::interval, ${pE}::timestamp),
              '${bucketInterval}'::interval
            ) AS bucket
          ),
          current_data AS (
            SELECT bucket, SUM(usage) AS value FROM (
              SELECT bucket, raw_usage_diff AS usage
              FROM ${diffTable}
              WHERE ${facWhere}bucket >= ${pS}::timestamp AND bucket < ${pE}::timestamp
                AND energy_type = '${energyType}'
              UNION ALL
              SELECT bucket, ${integralConvHourly} AS usage
              FROM ${integralTable}
              WHERE ${facWhere}bucket >= ${pS}::timestamp AND bucket < ${pE}::timestamp
                AND energy_type = '${energyType}'
            ) sub
            GROUP BY bucket
          ),
          prev_data AS (
            SELECT bucket, SUM(usage) AS ${prevColumn} FROM (
              SELECT bucket, raw_usage_diff AS usage
              FROM ${diffTable}
              WHERE ${facWhere}bucket >= ${pPS}::timestamp AND bucket < ${pPE}::timestamp
                AND energy_type = '${energyType}'
              UNION ALL
              SELECT bucket, ${integralConvHourly} AS usage
              FROM ${integralTable}
              WHERE ${facWhere}bucket >= ${pPS}::timestamp AND bucket < ${pPE}::timestamp
                AND energy_type = '${energyType}'
            ) sub
            GROUP BY bucket
          )
          SELECT
            TO_CHAR(ts.bucket + INTERVAL '9 hours', 'YYYY-MM-DD"T"HH24:MI:SS"+09:00"') AS time,
            ROUND(c.value::numeric, ${decimalPlaces}) AS "${fieldName}",
            ROUND(p.${prevColumn}::numeric, ${decimalPlaces}) AS "${prevFieldName}"
          FROM time_slots ts
          LEFT JOIN current_data c ON ts.bucket = c.bucket
          LEFT JOIN prev_data p ON (ts.bucket - INTERVAL '1 day') = p.bucket
          ORDER BY ts.bucket;
        `;
      } else {
        // ── 분 단위 CA 직접 조회 (1m, 5m, 15m, 1M) ──
        // cagg_usage_1min (CA 직접) + cagg_trend_usage_1min (VIEW 우회)
        // SUM(raw_usage_diff): LEFT JOIN 오버헤드 제거 (리셋 보정은 극히 드물어 차트에서 무시 가능)
        sql = `
          WITH time_slots AS (
            SELECT generate_series(
              ${pS}::timestamp,
              time_bucket('${bucketInterval}'::interval, ${pE}::timestamp),
              '${bucketInterval}'::interval
            ) AS bucket
          ),
          current_data AS (
            SELECT bucket, SUM(usage) AS value FROM (
              SELECT
                time_bucket('${bucketInterval}', bucket) AS bucket,
                SUM(raw_usage_diff) AS usage
              FROM cagg_usage_1min
              WHERE ${facWhere}bucket >= ${pS}::timestamp AND bucket < ${pE}::timestamp
                AND energy_type = '${energyType}'
              GROUP BY 1
              UNION ALL
              SELECT
                time_bucket('${bucketInterval}', bucket) AS bucket,
                SUM(${integralConvMinute}) AS usage
              FROM cagg_trend_usage_1min
              WHERE ${facWhere}bucket >= ${pS}::timestamp AND bucket < ${pE}::timestamp
                AND energy_type = '${energyType}'
              GROUP BY 1
            ) sub
            GROUP BY bucket
          ),
          prev_data AS (
            SELECT bucket, SUM(usage) AS ${prevColumn} FROM (
              SELECT
                time_bucket('${bucketInterval}', bucket) AS bucket,
                SUM(raw_usage_diff) AS usage
              FROM cagg_usage_1min
              WHERE ${facWhere}bucket >= ${pPS}::timestamp AND bucket < ${pPE}::timestamp
                AND energy_type = '${energyType}'
              GROUP BY 1
              UNION ALL
              SELECT
                time_bucket('${bucketInterval}', bucket) AS bucket,
                SUM(${integralConvMinute}) AS usage
              FROM cagg_trend_usage_1min
              WHERE ${facWhere}bucket >= ${pPS}::timestamp AND bucket < ${pPE}::timestamp
                AND energy_type = '${energyType}'
              GROUP BY 1
            ) sub
            GROUP BY bucket
          )
          SELECT
            TO_CHAR(ts.bucket + INTERVAL '9 hours', 'YYYY-MM-DD"T"HH24:MI:SS"+09:00"') AS time,
            ROUND(c.value::numeric, ${decimalPlaces}) AS "${fieldName}",
            ROUND(p.${prevColumn}::numeric, ${decimalPlaces}) AS "${prevFieldName}"
          FROM time_slots ts
          LEFT JOIN current_data c ON ts.bucket = c.bucket
          LEFT JOIN prev_data p ON (ts.bucket - INTERVAL '1 day') = p.bucket
          ORDER BY ts.bucket;
        `;
      }
    } else {
      // ── tag_data_raw 기반: 10s, 1s ──
      // LAST-FIRST 적산차 + meter_reset_events 리셋 보정
      sql = `
        WITH time_slots AS (
          SELECT generate_series(
            ${pS}::timestamp,
            time_bucket('${bucketInterval}'::interval, ${pE}::timestamp),
            '${bucketInterval}'::interval
          ) AS bucket
        ),
        cur_tag_raw AS (
          SELECT
            time_bucket('${bucketInterval}', t.timestamp) AS bucket,
            t."tagId",
            LAST(t.value, t.timestamp) - FIRST(t.value, t.timestamp) AS raw_diff
          FROM tag_data_raw t
          JOIN tags tag ON t."tagId" = tag.id
          WHERE ${tagFacWhere}t.timestamp >= ${pS}::timestamp
            AND t.timestamp < ${pE}::timestamp
            AND tag."measureType" = 'CUMULATIVE'
            AND tag."energyType" = '${rawEnergyType}'
          GROUP BY 1, t."tagId"
        ),
        cur_reset AS (
          SELECT
            time_bucket('${bucketInterval}', r.reset_time) AS bucket,
            r.tag_id AS "tagId",
            SUM(r.value_before_reset) AS correction
          FROM meter_reset_events r
          WHERE r.reset_time >= ${pS}::timestamp
            AND r.reset_time < ${pE}::timestamp
            AND r.correction_applied = true
          GROUP BY 1, r.tag_id
        ),
        current_data AS (
          SELECT cr.bucket, SUM(cr.raw_diff + COALESCE(rc.correction, 0)) AS value
          FROM cur_tag_raw cr
          LEFT JOIN cur_reset rc ON cr.bucket = rc.bucket AND cr."tagId" = rc."tagId"
          GROUP BY cr.bucket
        ),
        prev_tag_raw AS (
          SELECT
            time_bucket('${bucketInterval}', t.timestamp) AS bucket,
            t."tagId",
            LAST(t.value, t.timestamp) - FIRST(t.value, t.timestamp) AS raw_diff
          FROM tag_data_raw t
          JOIN tags tag ON t."tagId" = tag.id
          WHERE ${tagFacWhere}t.timestamp >= ${pPS}::timestamp
            AND t.timestamp < ${pPE}::timestamp
            AND tag."measureType" = 'CUMULATIVE'
            AND tag."energyType" = '${rawEnergyType}'
          GROUP BY 1, t."tagId"
        ),
        prev_reset AS (
          SELECT
            time_bucket('${bucketInterval}', r.reset_time) AS bucket,
            r.tag_id AS "tagId",
            SUM(r.value_before_reset) AS correction
          FROM meter_reset_events r
          WHERE r.reset_time >= ${pPS}::timestamp
            AND r.reset_time < ${pPE}::timestamp
            AND r.correction_applied = true
          GROUP BY 1, r.tag_id
        ),
        prev_data AS (
          SELECT pr.bucket, SUM(pr.raw_diff + COALESCE(prc.correction, 0)) AS ${prevColumn}
          FROM prev_tag_raw pr
          LEFT JOIN prev_reset prc ON pr.bucket = prc.bucket AND pr."tagId" = prc."tagId"
          GROUP BY pr.bucket
        )
        SELECT
          TO_CHAR(ts.bucket + INTERVAL '9 hours', 'YYYY-MM-DD"T"HH24:MI:SS"+09:00"') AS time,
          ROUND(c.value::numeric, ${decimalPlaces}) AS "${fieldName}",
          ROUND(p.${prevColumn}::numeric, ${decimalPlaces}) AS "${prevFieldName}"
        FROM time_slots ts
        LEFT JOIN current_data c ON ts.bucket = c.bucket
        LEFT JOIN prev_data p ON (ts.bucket - INTERVAL '1 day') = p.bucket
        ORDER BY ts.bucket;
      `;
    }

    // Date → UTC ISO 문자열 (timezone suffix 제거) — timestamp without time zone 컬럼 호환
    const toUtcStr = (d: Date) => d.toISOString().replace('Z', '').replace('T', ' ');
    const startStr = toUtcStr(start);
    const endStr = toUtcStr(end);
    const prevStartStr = toUtcStr(prevStart);
    const prevEndStr = toUtcStr(prevEnd);

    this.logger.debug(`🔍 Query interval: ${interval} (${bucketInterval}), metric: ${metric}, data source: ${this.getDataSource(interval)}`);
    this.logger.debug(`🔍 Parameters: entityUuid=${entityUuid}, entityType=${entityType}, start=${startStr}, end=${endStr}`);

    try {
      // 쿼리 실행 (UTC 문자열로 전달 — pg driver의 timestamptz 자동변환 방지)
      const params = hasEntity
        ? [entityUuid, startStr, endStr, prevStartStr, prevEndStr]
        : [startStr, endStr, prevStartStr, prevEndStr];
      const result = await this.prisma.$queryRawUnsafe<RangeDataPoint[]>(sql, ...params);

      this.logger.debug(`📈 Query result: ${result.length} points`);

      return {
        data: result,
        totalPoints: result.length,
      };
    } catch (error) {
      this.logger.error(`❌ Database query failed: ${error.message}`, error.stack);
      throw new DatabaseQueryException(error);
    }
  }

  /**
   * Helper: interval에 따른 데이터 소스 반환
   */
  private getDataSource(interval: IntervalEnum): string {
    return isCaggBasedInterval(interval) ? 'cagg_usage_combined_1min' : 'tag_data_raw';
  }

  /**
   * Down-sampling (Linear interpolation)
   *
   * maxPoints보다 많은 데이터를 균등하게 샘플링
   *
   * @param data - 원본 데이터
   * @param maxPoints - 최대 포인트 수
   * @returns Down-sampled 데이터
   */
  private downsample(data: RangeDataPoint[], maxPoints: number): RangeDataPoint[] {
    if (data.length <= maxPoints) {
      return data;
    }

    const step = data.length / maxPoints;
    const result: RangeDataPoint[] = [];

    for (let i = 0; i < maxPoints; i++) {
      const index = Math.floor(i * step);
      result.push(data[index]);
    }

    // 마지막 포인트는 항상 포함 (데이터 끝점 보존)
    if (result[result.length - 1] !== data[data.length - 1]) {
      result[result.length - 1] = data[data.length - 1];
    }

    return result;
  }

  // ===== Cache Management Methods =====

  /**
   * Generate cache key for range data
   */
  private getCacheKey(
    facilityId: string,
    metric: 'power' | 'air',
    query: RangeQueryDto,
  ): string {
    const { startTime, endTime, interval, maxPoints } = query;
    return `${facilityId}:${metric}:${interval}:${startTime}:${endTime}:${maxPoints || 'none'}`;
  }

  /**
   * Get data from cache (if not expired)
   */
  private getFromCache(key: string): RangeDataResponse | null {
    const entry = this.rangeCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.rangeCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache with TTL based on interval
   */
  private setToCache(
    key: string,
    data: RangeDataResponse,
    interval: IntervalEnum,
  ): void {
    const ttl = this.getTTL(interval);
    this.rangeCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Get TTL (Time-To-Live) in milliseconds based on interval
   *
   * Interval별 캐시 유효 시간:
   * - 15m: 300초 (5분) - 가장 안정적인 데이터
   * - 1m: 180초 (3분) - 자주 갱신되는 데이터
   * - 10s: 60초 (1분) - 실시간에 가까운 데이터
   * - 1s: 30초 (30초) - 거의 실시간 데이터
   */
  private getTTL(interval: IntervalEnum): number {
    switch (interval) {
      case IntervalEnum.FIFTEEN_MIN:
        return 300 * 1000; // 5 minutes
      case IntervalEnum.ONE_MIN:
        return 180 * 1000; // 3 minutes
      case IntervalEnum.TEN_SEC:
        return 60 * 1000; // 1 minute
      case IntervalEnum.ONE_SEC:
        return 30 * 1000; // 30 seconds
      default:
        return 60 * 1000; // 1 minute (fallback)
    }
  }

  /**
   * Cleanup expired cache entries
   *
   * Runs every 5 minutes automatically
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.rangeCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.rangeCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }

}
