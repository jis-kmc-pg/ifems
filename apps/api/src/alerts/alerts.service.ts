import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { todayStart } from '../common/utils/date-time.utils';
import { lineFilter } from '../common/utils/query-helpers';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────
  // 공통 API — 카테고리별 분기
  // ────────────────────────────────────────────────────────────

  async getAlertStatsKpi(category: string) {
    if (category === 'cycle_anomaly') return this.getCycleAnomalyKpi();
    if (category === 'air_leak') return this.getAirLeakKpi();

    this.logger.log(`Fetching alert stats KPI for category: ${category}`);

    try {
      const today = todayStart();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date(today);
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const alertType = this.getAlertType(category);

      const total = await this.prisma.alert.count({
        where: { type: alertType, detectedAt: { gte: sevenDaysAgo } },
      });
      const weekly = total;

      const previousWeekly = await this.prisma.alert.count({
        where: { type: alertType, detectedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      });

      const weeklyChange = previousWeekly > 0
        ? Math.round(((weekly - previousWeekly) / previousWeekly) * 100)
        : 0;

      const resolved = await this.prisma.alert.count({
        where: { type: alertType, detectedAt: { gte: sevenDaysAgo }, actionTaken: { not: null } },
      });

      const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      return { total, weekly, weeklyChange, resolved, resolvedRate };
    } catch (error) {
      this.logger.error('Error fetching alert stats KPI:', error);
      throw error;
    }
  }

  async getAlertTrend(category: string) {
    if (category === 'cycle_anomaly') return this.getCycleAnomalyTrend();
    if (category === 'air_leak') return this.getAirLeakTrend();

    this.logger.log(`Fetching alert trend for category: ${category}`);

    try {
      const today = todayStart();
      const eightWeeksAgo = new Date(today);
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      const alertType = this.getAlertType(category);

      const trend = await this.prisma.$queryRaw<any[]>`
        SELECT
          to_char(date_trunc('week', a."detectedAt"), 'MM/DD') as week,
          COUNT(*) as count
        FROM alerts a
        WHERE a."detectedAt" >= ${eightWeeksAgo}
          AND a.type::text = ${alertType}
        GROUP BY date_trunc('week', a."detectedAt")
        ORDER BY date_trunc('week', a."detectedAt")
      `;

      return trend.map((t) => ({
        week: t.week,
        count: Number(t.count || 0),
      }));
    } catch (error) {
      this.logger.error('Error fetching alert trend:', error);
      throw error;
    }
  }

  async getAlertHeatmap(category: string) {
    // ALT-003은 히트맵 미사용 (도넛 차트 사용)
    if (category === 'cycle_anomaly') return [];
    if (category === 'air_leak') return this.getAirLeakHeatmap();

    this.logger.log(`Fetching alert heatmap for category: ${category}`);

    try {
      const today = todayStart();
      const eightWeeksAgo = new Date(today);
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      const alertType = this.getAlertType(category);

      const data = await this.prisma.$queryRaw<any[]>`
        SELECT
          f.code as facility,
          EXTRACT(WEEK FROM a."detectedAt") - EXTRACT(WEEK FROM ${eightWeeksAgo}::timestamp) + 1 as week_num,
          COUNT(*) as count
        FROM alerts a
        JOIN facilities f ON a."facilityId" = f.id
        WHERE a."detectedAt" >= ${eightWeeksAgo}
          AND a.type::text = ${alertType}
        GROUP BY f.code, week_num
        ORDER BY SUM(COUNT(*)) OVER (PARTITION BY f.code) DESC
      `;

      const facilityMap = new Map<string, Record<string, number>>();
      for (const row of data) {
        const facility = row.facility;
        if (!facilityMap.has(facility)) {
          facilityMap.set(facility, {});
        }
        const weekKey = `week${Math.min(8, Math.max(1, Number(row.week_num)))}`;
        const map = facilityMap.get(facility)!;
        map[weekKey] = (map[weekKey] || 0) + Number(row.count || 0);
      }

      const result = Array.from(facilityMap.entries())
        .map(([facility, weeks]) => ({
          facility,
          week1: weeks['week1'] || 0,
          week2: weeks['week2'] || 0,
          week3: weeks['week3'] || 0,
          week4: weeks['week4'] || 0,
          week5: weeks['week5'] || 0,
          week6: weeks['week6'] || 0,
          week7: weeks['week7'] || 0,
          week8: weeks['week8'] || 0,
        }))
        .sort((a, b) => {
          const sumA = a.week1 + a.week2 + a.week3 + a.week4 + a.week5 + a.week6 + a.week7 + a.week8;
          const sumB = b.week1 + b.week2 + b.week3 + b.week4 + b.week5 + b.week6 + b.week7 + b.week8;
          return sumB - sumA;
        })
        .slice(0, 5);

      return result;
    } catch (error) {
      this.logger.error('Error fetching alert heatmap:', error);
      return [];
    }
  }

  async getAlertHistory(category: string, line?: string, facilityCode?: string) {
    if (category === 'cycle_anomaly') return this.getCycleAnomalyHistory(line, facilityCode);
    if (category === 'air_leak') return this.getAirLeakHistory(line, facilityCode);

    this.logger.log(`Fetching alert history for category: ${category}`);

    try {
      const today = todayStart();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const alertType = this.getAlertType(category);
      const lineCond = lineFilter(line);
      const facilityCondition = facilityCode ? Prisma.sql`AND f.code = ${facilityCode}` : Prisma.empty;

      const history = await this.prisma.$queryRaw<any[]>`
        SELECT
          a.id,
          a."detectedAt" as timestamp,
          a.severity,
          CASE WHEN a."actionTaken" IS NOT NULL THEN 'RESOLVED' ELSE 'ACTIVE' END as status,
          a."actionTaken" as action,
          a.metadata,
          f.code as facility_code,
          f.name as facility_name,
          f.process,
          l.name as line_name
        FROM alerts a
        JOIN facilities f ON a."facilityId" = f.id
        JOIN lines l ON f."lineId" = l.id
        WHERE a."detectedAt" >= ${sevenDaysAgo}
          AND a.type::text = ${alertType}
          ${lineCond}
          ${facilityCondition}
        ORDER BY a."detectedAt" DESC
        LIMIT 50
      `;

      return history.map((h, idx) => {
        let baseline = '';
        let current = '';
        let ratio = 0;

        const metadata = typeof h.metadata === 'object' ? h.metadata : {};

        if (category === 'power_quality') {
          baseline = '5.0%';
          const ub = Number(metadata.imbalance || 0);
          current = `${ub.toFixed(1)}%`;
          ratio = Math.round((ub / 5.0) * 100);
        } else {
          baseline = 'N/A';
          current = 'N/A';
          ratio = 0;
        }

        return {
          id: h.id,
          no: idx + 1,
          timestamp: h.timestamp instanceof Date ? h.timestamp.toISOString() : String(h.timestamp),
          line: h.line_name || '',
          facilityCode: h.facility_code,
          facilityName: `${h.facility_code} ${h.process || ''}`.trim(),
          baseline,
          current,
          ratio,
          status: h.status || 'ACTIVE',
          action: h.action || undefined,
          category,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching alert history:', error);
      throw error;
    }
  }

  // 조치사항 저장
  async saveAlertAction(id: string, action: string, actionBy?: string) {
    this.logger.log(`Saving alert action for id: ${id}, action: ${action}`);

    // composite ID (cycle/air 이력) — UUID가 아닌 경우 로그만 남기고 성공 반환
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id);
    if (!isUuid) {
      this.logger.log(`Action logged for computed record: ${id}`);
      return { success: true, id, action, updatedAt: new Date() };
    }

    try {
      const updatedAlert = await this.prisma.alert.update({
        where: { id },
        data: {
          actionTaken: action,
          actionTakenBy: actionBy || 'system',
          actionTakenAt: new Date(),
        },
      });

      return { success: true, id, action, updatedAt: updatedAlert.updatedAt };
    } catch (error) {
      this.logger.error(`Error saving alert action for id ${id}:`, error);
      throw error;
    }
  }

  // 이력 상세 모달 — 파형/추이 데이터
  async getCycleWaveformForAlert(compositeId: string) {
    this.logger.log(`Fetching waveform/trend for: ${compositeId}`);

    // air composite ID: air:facilityId:YYYYMMDDHH
    if (compositeId.startsWith('air:')) {
      return this.getAirHourlyTrendForFacility(compositeId);
    }

    // cycle composite ID: MACH_ID|TAG_NAME|MATERIAL_ID
    const parts = compositeId.split('|');
    if (parts.length === 3) {
      return this.getCycleWaveformFromStepMms(parts[0], parts[1], parts[2]);
    }

    // 폴백: 기존 mock 패턴 (UUID인 경우)
    const baseValue = 850;
    const variance = 180;
    const points = 60;
    const now = todayStart();

    return Array.from({ length: points }, (_, i) => {
      const time = new Date(now.getTime() + i * 60000);
      const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
      const noise = Math.sin(i / 10) * variance;
      const prevNoise = Math.sin((i + 5) / 10) * variance * 0.8;
      return {
        time: timeStr,
        current: Math.max(0, baseValue + noise),
        prev: Math.max(0, baseValue + prevNoise),
      };
    });
  }

  // 싸이클 이상 유형별 분포 (ALT-003 도넛 차트)
  async getCycleAnomalyTypes() {
    this.logger.log('Fetching cycle anomaly type distribution');

    try {
      const sevenDaysAgo = this.daysAgoStr(7);

      const rows = await this.prisma.$queryRawUnsafe<Array<{ name: string; value: number }>>(
        `SELECT
          m."LINE_CD" as name,
          COUNT(*)::int as value
        FROM "CYCLE_STD_MST_MMS" c
        JOIN "CYCLE_MMS_MAPPING" m ON c."MACH_ID" = m."MACH_ID" AND c."TAG_NAME" = m."TAG_NAME"
        WHERE c."STAND_YN" = 3
          AND c."START_DT" >= $1
        GROUP BY m."LINE_CD"
        ORDER BY value DESC`,
        sevenDaysAgo,
      );

      return rows.map((r) => ({ name: String(r.name), value: Number(r.value) }));
    } catch (error) {
      this.logger.error('Error fetching cycle anomaly types:', error);
      return [];
    }
  }

  // ────────────────────────────────────────────────────────────
  // 싸이클 이상 — CYCLE_STD_MST_MMS 직접 쿼리
  // ────────────────────────────────────────────────────────────

  private async getCycleAnomalyKpi() {
    this.logger.log('Fetching cycle anomaly KPI from CYCLE_STD_MST_MMS');

    try {
      const sevenDaysAgo = this.daysAgoStr(7);
      const fourteenDaysAgo = this.daysAgoStr(14);

      const [thisWeek] = await this.prisma.$queryRawUnsafe<
        Array<{ anomaly: number; normal: number; total: number }>
      >(
        `SELECT
          COUNT(*) FILTER (WHERE "STAND_YN" = 3)::int as anomaly,
          COUNT(*) FILTER (WHERE "STAND_YN" = 2)::int as normal,
          COUNT(*)::int as total
        FROM "CYCLE_STD_MST_MMS"
        WHERE "START_DT" >= $1`,
        sevenDaysAgo,
      );

      const [prevWeek] = await this.prisma.$queryRawUnsafe<
        Array<{ anomaly: number }>
      >(
        `SELECT COUNT(*) FILTER (WHERE "STAND_YN" = 3)::int as anomaly
        FROM "CYCLE_STD_MST_MMS"
        WHERE "START_DT" >= $1 AND "START_DT" < $2`,
        fourteenDaysAgo,
        sevenDaysAgo,
      );

      const anomaly = Number(thisWeek?.anomaly || 0);
      const normal = Number(thisWeek?.normal || 0);
      const total = Number(thisWeek?.total || 0);
      const prevAnomaly = Number(prevWeek?.anomaly || 0);

      const weeklyChange = prevAnomaly > 0
        ? Math.round(((anomaly - prevAnomaly) / prevAnomaly) * 100)
        : 0;

      return {
        total: anomaly,
        weekly: anomaly,
        weeklyChange,
        resolved: normal,
        resolvedRate: total > 0 ? Math.round((normal / total) * 100) : 0,
      };
    } catch (error) {
      this.logger.error('Error fetching cycle anomaly KPI:', error);
      return { total: 0, weekly: 0, weeklyChange: 0, resolved: 0, resolvedRate: 0 };
    }
  }

  private async getCycleAnomalyTrend() {
    this.logger.log('Fetching cycle anomaly trend from CYCLE_STD_MST_MMS');

    try {
      const eightWeeksAgo = this.daysAgoStr(56);

      const trend = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT
          to_char(date_trunc('week', "START_DT"::timestamp), 'MM/DD') as week,
          COUNT(*)::int as count
        FROM "CYCLE_STD_MST_MMS"
        WHERE "STAND_YN" = 3
          AND "START_DT" >= $1
        GROUP BY date_trunc('week', "START_DT"::timestamp)
        ORDER BY date_trunc('week', "START_DT"::timestamp)`,
        eightWeeksAgo,
      );

      return trend.map((t) => ({
        week: t.week,
        count: Number(t.count || 0),
      }));
    } catch (error) {
      this.logger.error('Error fetching cycle anomaly trend:', error);
      return [];
    }
  }

  private async getCycleAnomalyHistory(line?: string, facilityCode?: string) {
    this.logger.log('Fetching cycle anomaly history from CYCLE_STD_MST_MMS');

    try {
      const sevenDaysAgo = this.daysAgoStr(7);

      // 설비별 기준 싸이클 시간 (STAND_YN=1)
      const refRows = await this.prisma.$queryRawUnsafe<
        Array<{ code: string; ref_duration_ms: number }>
      >(
        `SELECT m."MCN_CD" as code, AVG(c."DIFF_DESC")::float as ref_duration_ms
        FROM "CYCLE_STD_MST_MMS" c
        JOIN "CYCLE_MMS_MAPPING" m ON c."MACH_ID" = m."MACH_ID" AND c."TAG_NAME" = m."TAG_NAME"
        WHERE c."STAND_YN" = 1
        GROUP BY m."MCN_CD"`,
      );
      const refMap = new Map(refRows.map((r) => [r.code, Number(r.ref_duration_ms || 0)]));

      // 조건 조립
      let whereExtra = '';
      const params: any[] = [sevenDaysAgo];
      let paramIdx = 2;

      if (line) {
        whereExtra += ` AND l.code = $${paramIdx}`;
        params.push(line.toUpperCase());
        paramIdx++;
      }
      if (facilityCode) {
        whereExtra += ` AND f.code = $${paramIdx}`;
        params.push(facilityCode);
        paramIdx++;
      }

      const history = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT
          c."MACH_ID" || '|' || c."TAG_NAME" || '|' || c."MATERIAL_ID" as id,
          c."START_DT"::timestamp as timestamp,
          l.name as line_name,
          f.code as facility_code,
          f.name as facility_name,
          f.process,
          c."DIFF_DESC"::float as duration_ms,
          c."CYCLE_DELAY"::int as cycle_delay,
          c."CYCLE_NM" as cycle_nm
        FROM "CYCLE_STD_MST_MMS" c
        JOIN "CYCLE_MMS_MAPPING" m ON c."MACH_ID" = m."MACH_ID" AND c."TAG_NAME" = m."TAG_NAME"
        JOIN facilities f ON f.code = m."MCN_CD"
        JOIN lines l ON f."lineId" = l.id
        WHERE c."STAND_YN" = 3
          AND c."START_DT" >= $1
          ${whereExtra}
        ORDER BY c."START_DT" DESC
        LIMIT 50`,
        ...params,
      );

      return history.map((h, idx) => {
        const durationSec = Number(h.duration_ms || 0) / 1000;
        const refDurationMs = refMap.get(h.facility_code) || 0;
        const refDurationSec = refDurationMs / 1000;
        const delay = Number(h.cycle_delay || 0);

        // 기준 대비 비율 (시간 기반)
        const ratio = refDurationMs > 0
          ? Math.round((Number(h.duration_ms) / refDurationMs) * 100)
          : 0;

        return {
          id: h.id,
          no: idx + 1,
          timestamp: h.timestamp instanceof Date ? h.timestamp.toISOString() : String(h.timestamp),
          line: h.line_name || '',
          facilityCode: h.facility_code,
          facilityName: `${h.facility_code} ${h.process || ''}`.trim(),
          baseline: refDurationSec > 0 ? `${refDurationSec.toFixed(1)}s` : 'N/A',
          current: `${durationSec.toFixed(1)}s`,
          ratio,
          status: 'ACTIVE' as const,
          action: undefined,
          category: 'cycle_anomaly',
          // 추가 필드: 프론트엔드에서 활용 가능
          cycleDelay: delay,
          cycleNm: h.cycle_nm || '',
        };
      });
    } catch (error) {
      this.logger.error('Error fetching cycle anomaly history:', error);
      return [];
    }
  }

  // STEP_MMS에서 실제 파형 데이터 조회
  private async getCycleWaveformFromStepMms(machId: string, tagName: string, materialId: string) {
    try {
      // 이상 싸이클 스텝 데이터
      const currentSteps = await this.prisma.$queryRawUnsafe<
        Array<{ value: number; time: string }>
      >(
        `SELECT "VALUE"::float as value, "TIME" as time
        FROM "STEP_MMS"
        WHERE "MACH_ID" = $1 AND "TAG_NAME" = $2 AND "MATERIAL_ID" = $3
        ORDER BY "TIME"`,
        machId, tagName, materialId,
      );

      // 기준 싸이클 파형 (STAND_YN=1, 같은 MACH_ID+TAG_NAME의 첫번째)
      const refMaterial = await this.prisma.$queryRawUnsafe<
        Array<{ material_id: string }>
      >(
        `SELECT c."MATERIAL_ID" as material_id
        FROM "CYCLE_STD_MST_MMS" c
        WHERE c."MACH_ID" = $1 AND c."TAG_NAME" = $2 AND c."STAND_YN" = 1
        LIMIT 1`,
        machId, tagName,
      );

      let refSteps: Array<{ value: number; time: string }> = [];
      if (refMaterial.length > 0) {
        refSteps = await this.prisma.$queryRawUnsafe<
          Array<{ value: number; time: string }>
        >(
          `SELECT "VALUE"::float as value, "TIME" as time
          FROM "STEP_MMS"
          WHERE "MACH_ID" = $1 AND "TAG_NAME" = $2 AND "MATERIAL_ID" = $3
          ORDER BY "TIME"`,
          machId, tagName, refMaterial[0].material_id,
        );
      }

      // TrendChart 호환 형식: [{ time, current, prev }]
      const maxLen = Math.max(currentSteps.length, refSteps.length);
      if (maxLen === 0) {
        return [{ time: '00:00', current: 0, prev: 0 }];
      }

      return Array.from({ length: maxLen }, (_, i) => {
        const cur = currentSteps[i];
        const ref = refSteps[i];
        const sec = i; // 인덱스 기반 시간
        const mm = Math.floor(sec / 60);
        const ss = sec % 60;
        return {
          time: `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
          current: cur ? Number(cur.value) : 0,
          prev: ref ? Number(ref.value) : 0,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching STEP_MMS waveform:', error);
      return [{ time: '00:00', current: 0, prev: 0 }];
    }
  }

  // 에어 누기 — 설비 당일 시간별 사용량 추이 (ALT-005 모달)
  private async getAirHourlyTrendForFacility(compositeId: string) {
    try {
      // air:facilityId:YYYYMMDDHH → facilityId 추출
      const parts = compositeId.split(':');
      const facilityId = parts[1] || '';
      const dateStr = parts[2] || '';
      // dateStr에서 날짜 추출 (YYYYMMDD 부분)
      const year = dateStr.slice(0, 4);
      const month = dateStr.slice(4, 6);
      const day = dateStr.slice(6, 8);
      const targetDate = `${year}-${month}-${day}`;

      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ hour: string; value: number; baseline: number }>
      >(
        `WITH hourly AS (
          SELECT
            to_char(c.bucket AT TIME ZONE 'Asia/Seoul', 'HH24:00') as hour,
            SUM(GREATEST(0, c.raw_usage_diff))::float as value
          FROM cagg_usage_1h c
          WHERE c."facilityId" = $1
            AND c.energy_type = 'air'
            AND c.bucket >= ($2::date)::timestamp
            AND c.bucket < ($2::date + INTERVAL '1 day')::timestamp
          GROUP BY c.bucket
          ORDER BY c.bucket
        )
        SELECT
          hour,
          ROUND(value::numeric, 1)::float as value,
          ROUND(AVG(value) OVER ()::numeric, 1)::float as baseline
        FROM hourly`,
        facilityId, targetDate,
      );

      if (rows.length === 0) {
        return Array.from({ length: 24 }, (_, i) => ({
          time: `${String(i).padStart(2, '0')}:00`,
          current: 0,
          prev: 0,
        }));
      }

      return rows.map((r) => ({
        time: r.hour,
        current: Number(r.value || 0),
        prev: Number(r.baseline || 0), // 평균을 기준선으로
      }));
    } catch (error) {
      this.logger.error('Error fetching air hourly trend:', error);
      return [{ time: '00:00', current: 0, prev: 0 }];
    }
  }

  // ────────────────────────────────────────────────────────────
  // 에어 누기 — cagg_usage_1h 기반 계산
  // ────────────────────────────────────────────────────────────

  private async getAirLeakKpi() {
    this.logger.log('Fetching air leak KPI from cagg_usage_1h');

    try {
      // 설비별 시간당 에어 사용량 → 24h 이동평균 대비 surge 카운트
      const [thisWeek] = await this.prisma.$queryRawUnsafe<
        Array<{ surge_count: number; total_hours: number }>
      >(
        `WITH hourly AS (
          SELECT
            c."facilityId",
            c.bucket,
            SUM(GREATEST(0, c.raw_usage_diff)) as hourly_usage
          FROM cagg_usage_1h c
          WHERE c.energy_type = 'air'
            AND c.bucket >= NOW() - INTERVAL '7 days'
          GROUP BY c."facilityId", c.bucket
        ),
        with_baseline AS (
          SELECT *,
            AVG(hourly_usage) OVER (
              PARTITION BY "facilityId"
              ORDER BY bucket
              ROWS BETWEEN 24 PRECEDING AND 1 PRECEDING
            ) as baseline_avg
          FROM hourly
        )
        SELECT
          COUNT(*) FILTER (WHERE hourly_usage > baseline_avg * 1.2 AND baseline_avg > 100)::int as surge_count,
          COUNT(*)::int as total_hours
        FROM with_baseline`,
      );

      const [prevWeek] = await this.prisma.$queryRawUnsafe<
        Array<{ surge_count: number }>
      >(
        `WITH hourly AS (
          SELECT
            c."facilityId",
            c.bucket,
            SUM(GREATEST(0, c.raw_usage_diff)) as hourly_usage
          FROM cagg_usage_1h c
          WHERE c.energy_type = 'air'
            AND c.bucket >= NOW() - INTERVAL '14 days'
            AND c.bucket < NOW() - INTERVAL '7 days'
          GROUP BY c."facilityId", c.bucket
        ),
        with_baseline AS (
          SELECT *,
            AVG(hourly_usage) OVER (
              PARTITION BY "facilityId"
              ORDER BY bucket
              ROWS BETWEEN 24 PRECEDING AND 1 PRECEDING
            ) as baseline_avg
          FROM hourly
        )
        SELECT
          COUNT(*) FILTER (WHERE hourly_usage > baseline_avg * 1.2 AND baseline_avg > 100)::int as surge_count
        FROM with_baseline`,
      );

      const surgeCount = Number(thisWeek?.surge_count || 0);
      const prevSurge = Number(prevWeek?.surge_count || 0);
      const weeklyChange = prevSurge > 0
        ? Math.round(((surgeCount - prevSurge) / prevSurge) * 100)
        : 0;

      return {
        total: surgeCount,
        weekly: surgeCount,
        weeklyChange,
        resolved: 0,
        resolvedRate: 0,
      };
    } catch (error) {
      this.logger.error('Error fetching air leak KPI:', error);
      return { total: 0, weekly: 0, weeklyChange: 0, resolved: 0, resolvedRate: 0 };
    }
  }

  private async getAirLeakTrend() {
    this.logger.log('Fetching air leak trend from cagg_usage_1h');

    try {
      const trend = await this.prisma.$queryRawUnsafe<any[]>(
        `WITH hourly AS (
          SELECT
            c."facilityId",
            c.bucket,
            SUM(GREATEST(0, c.raw_usage_diff)) as hourly_usage
          FROM cagg_usage_1h c
          WHERE c.energy_type = 'air'
            AND c.bucket >= NOW() - INTERVAL '56 days'
          GROUP BY c."facilityId", c.bucket
        ),
        with_baseline AS (
          SELECT *,
            AVG(hourly_usage) OVER (
              PARTITION BY "facilityId"
              ORDER BY bucket
              ROWS BETWEEN 24 PRECEDING AND 1 PRECEDING
            ) as baseline_avg
          FROM hourly
        )
        SELECT
          to_char(date_trunc('week', bucket), 'MM/DD') as week,
          COUNT(*) FILTER (WHERE hourly_usage > baseline_avg * 1.2 AND baseline_avg > 100)::int as count
        FROM with_baseline
        GROUP BY date_trunc('week', bucket)
        ORDER BY date_trunc('week', bucket)`,
      );

      return trend.map((t) => ({
        week: t.week,
        count: Number(t.count || 0),
      }));
    } catch (error) {
      this.logger.error('Error fetching air leak trend:', error);
      return [];
    }
  }

  private async getAirLeakHeatmap() {
    this.logger.log('Fetching air leak heatmap from cagg_usage_1h');

    try {
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
      const startWeekNum = this.getIsoWeek(eightWeeksAgo);

      const data = await this.prisma.$queryRawUnsafe<any[]>(
        `WITH hourly AS (
          SELECT
            c."facilityId",
            c.bucket,
            SUM(GREATEST(0, c.raw_usage_diff)) as hourly_usage
          FROM cagg_usage_1h c
          WHERE c.energy_type = 'air'
            AND c.bucket >= NOW() - INTERVAL '56 days'
          GROUP BY c."facilityId", c.bucket
        ),
        with_baseline AS (
          SELECT *,
            AVG(hourly_usage) OVER (
              PARTITION BY "facilityId"
              ORDER BY bucket
              ROWS BETWEEN 24 PRECEDING AND 1 PRECEDING
            ) as baseline_avg
          FROM hourly
        ),
        surge_events AS (
          SELECT "facilityId", bucket
          FROM with_baseline
          WHERE hourly_usage > baseline_avg * 1.2 AND baseline_avg > 100
        )
        SELECT
          f.code as facility,
          EXTRACT(WEEK FROM se.bucket)::int as week_num,
          COUNT(*)::int as count
        FROM surge_events se
        JOIN facilities f ON se."facilityId" = f.id
        GROUP BY f.code, week_num
        ORDER BY SUM(COUNT(*)) OVER (PARTITION BY f.code) DESC`,
      );

      // 주차 매핑
      const facilityMap = new Map<string, Record<string, number>>();
      for (const row of data) {
        const facility = row.facility;
        if (!facilityMap.has(facility)) {
          facilityMap.set(facility, {});
        }
        const relWeek = Math.min(8, Math.max(1, Number(row.week_num) - startWeekNum + 1));
        const weekKey = `week${relWeek}`;
        const map = facilityMap.get(facility)!;
        map[weekKey] = (map[weekKey] || 0) + Number(row.count || 0);
      }

      return Array.from(facilityMap.entries())
        .map(([facility, weeks]) => ({
          facility,
          week1: weeks['week1'] || 0,
          week2: weeks['week2'] || 0,
          week3: weeks['week3'] || 0,
          week4: weeks['week4'] || 0,
          week5: weeks['week5'] || 0,
          week6: weeks['week6'] || 0,
          week7: weeks['week7'] || 0,
          week8: weeks['week8'] || 0,
        }))
        .sort((a, b) => {
          const sumA = a.week1 + a.week2 + a.week3 + a.week4 + a.week5 + a.week6 + a.week7 + a.week8;
          const sumB = b.week1 + b.week2 + b.week3 + b.week4 + b.week5 + b.week6 + b.week7 + b.week8;
          return sumB - sumA;
        })
        .slice(0, 5);
    } catch (error) {
      this.logger.error('Error fetching air leak heatmap:', error);
      return [];
    }
  }

  private async getAirLeakHistory(line?: string, facilityCode?: string) {
    this.logger.log('Fetching air leak history from cagg_usage_1h');

    try {
      let whereExtra = '';
      const params: any[] = [];
      let paramIdx = 1;

      if (line) {
        whereExtra += ` AND l.code = $${paramIdx}`;
        params.push(line.toUpperCase());
        paramIdx++;
      }
      if (facilityCode) {
        whereExtra += ` AND f.code = $${paramIdx}`;
        params.push(facilityCode);
        paramIdx++;
      }

      const history = await this.prisma.$queryRawUnsafe<any[]>(
        `WITH hourly AS (
          SELECT
            c."facilityId",
            c.bucket,
            SUM(GREATEST(0, c.raw_usage_diff)) as hourly_usage
          FROM cagg_usage_1h c
          WHERE c.energy_type = 'air'
            AND c.bucket >= NOW() - INTERVAL '7 days'
          GROUP BY c."facilityId", c.bucket
        ),
        with_baseline AS (
          SELECT *,
            AVG(hourly_usage) OVER (
              PARTITION BY "facilityId"
              ORDER BY bucket
              ROWS BETWEEN 24 PRECEDING AND 1 PRECEDING
            ) as baseline_avg
          FROM hourly
        )
        SELECT
          'air:' || wb."facilityId" || ':' || to_char(wb.bucket, 'YYYYMMDDHH24') as id,
          wb.bucket as timestamp,
          l.name as line_name,
          f.code as facility_code,
          f.name as facility_name,
          f.process,
          ROUND(wb.baseline_avg::numeric, 1)::float as baseline,
          ROUND(wb.hourly_usage::numeric, 1)::float as current_usage,
          CASE WHEN wb.baseline_avg > 0
            THEN ROUND((wb.hourly_usage / wb.baseline_avg * 100)::numeric, 1)::float
            ELSE 0 END as ratio
        FROM with_baseline wb
        JOIN facilities f ON wb."facilityId" = f.id
        JOIN lines l ON f."lineId" = l.id
        WHERE wb.hourly_usage > wb.baseline_avg * 1.2
          AND wb.baseline_avg > 100
          ${whereExtra}
        ORDER BY wb.bucket DESC
        LIMIT 50`,
        ...params,
      );

      return history.map((h, idx) => ({
        id: h.id,
        no: idx + 1,
        timestamp: h.timestamp instanceof Date ? h.timestamp.toISOString() : String(h.timestamp),
        line: h.line_name || '',
        facilityCode: h.facility_code,
        facilityName: `${h.facility_code} ${h.process || ''}`.trim(),
        baseline: `${Number(h.baseline || 0).toFixed(0)} m³`,
        current: `${Number(h.current_usage || 0).toFixed(0)} m³`,
        ratio: Number(h.ratio || 0),
        status: 'ACTIVE' as const,
        action: undefined,
        category: 'air_leak',
      }));
    } catch (error) {
      this.logger.error('Error fetching air leak history:', error);
      return [];
    }
  }

  // ────────────────────────────────────────────────────────────
  // Helper
  // ────────────────────────────────────────────────────────────

  private getAlertType(category: string): any {
    switch (category) {
      case 'power_quality':
        return 'POWER_QUALITY';
      case 'air_leak':
        return 'AIR_LEAK';
      case 'cycle_anomaly':
        return 'CYCLE_ANOMALY';
      case 'hvac_fault':
        return 'HVAC_FAULT';
      case 'light_fault':
        return 'LIGHT_FAULT';
      case 'interlock_violation':
        return 'INTERLOCK_VIOLATION';
      default:
        return 'THRESHOLD';
    }
  }

  /** N일 전 날짜 문자열 (YYYY-MM-DD) — CYCLE_STD_MST_MMS.START_DT varchar 비교용 */
  private daysAgoStr(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  /** ISO week number */
  private getIsoWeek(d: Date): number {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }
}
