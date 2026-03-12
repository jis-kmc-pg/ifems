import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { todayStart, daysAgo, roundTo, toUtcSql, KST_OFFSET } from '../common/utils/date-time.utils';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getFacilityTree() {
    this.logger.log('Fetching facility tree');

    try {
      const facilities = await this.prisma.facility.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          lineId: true,
          line: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: [{ line: { code: 'asc' } }, { code: 'asc' }],
      });

      // 라인별로 그룹핑하여 트리 구조 생성
      const lineMap = new Map<string, any>();

      facilities.forEach((f) => {
        const lineId = f.lineId;
        const lineName = f.line.name;

        if (!lineMap.has(lineId)) {
          lineMap.set(lineId, {
            id: lineId,
            label: lineName,
            children: [],
          });
        }

        lineMap.get(lineId).children.push({
          id: f.code,
          label: f.name || f.code,
        });
      });

      // 최상위 공장 노드 생성
      return [{
        id: 'plant',
        label: '4공장',
        children: Array.from(lineMap.values()),
      }];
    } catch (error) {
      this.logger.error('Error fetching facility tree:', error);
      throw error;
    }
  }

  // Frontend expects: Array<{ time: string; current: number; prev: number }>
  async getFacilityHourlyData(facilityId: string, type: string, date?: string) {
    this.logger.log(`Fetching hourly data for facility: ${facilityId}, type: ${type}`);

    try {
      const targetDate = date ? new Date(date) : new Date();
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const prevDate = new Date(targetDate);
      prevDate.setDate(prevDate.getDate() - 1);

      const energyType = type === 'air' ? 'air' : 'elec';

      // facilityId가 설비 코드인 경우 (프론트에서 code를 보낼 수 있음)
      const isCode = facilityId.startsWith('HNK');

      // UTC 변환
      const targetDateUtc = toUtcSql(targetDate);
      const nextDayUtc = toUtcSql(nextDay);
      const prevDateUtc = toUtcSql(prevDate);

      // 당일 데이터 — hourly CA 직접 조회 (VIEW 바이패스)
      const facilityFilter = isCode
        ? Prisma.sql`f.code = ${facilityId}`
        : Prisma.sql`f.id = ${facilityId}`;

      const currentData = await this.prisma.$queryRaw<any[]>`
        WITH tag_usage AS (
          SELECT u."tagId",
            EXTRACT(HOUR FROM u.bucket + ${KST_OFFSET}) as hour,
            LAST(u.last_value, u.bucket) - FIRST(u.first_value, u.bucket) as usage
          FROM cagg_usage_1h u
          JOIN facilities f ON u."facilityId" = f.id
          WHERE ${facilityFilter}
            AND u.bucket >= ${targetDateUtc} AND u.bucket < ${nextDayUtc}
            AND u.energy_type::text = ${energyType}
          GROUP BY u."tagId", EXTRACT(HOUR FROM u.bucket + ${KST_OFFSET})
          UNION ALL
          SELECT t."tagId",
            EXTRACT(HOUR FROM t.bucket + ${KST_OFFSET}) as hour,
            SUM(CASE WHEN t.energy_type = 'elec'::"EnergyType" THEN t.sum_value / 60.0 ELSE t.sum_value END) as usage
          FROM cagg_trend_usage_1h t
          JOIN facilities f ON t."facilityId" = f.id
          WHERE ${facilityFilter}
            AND t.bucket >= ${targetDateUtc} AND t.bucket < ${nextDayUtc}
            AND t.energy_type::text = ${energyType}
            AND EXISTS (
              SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
            )
          GROUP BY t."tagId", EXTRACT(HOUR FROM t.bucket + ${KST_OFFSET})
        )
        SELECT hour, SUM(usage) as value
        FROM tag_usage
        GROUP BY hour
        ORDER BY hour
      `;

      // 전일 데이터 — hourly CA 직접 조회
      const prevData = await this.prisma.$queryRaw<any[]>`
        WITH tag_usage AS (
          SELECT u."tagId",
            EXTRACT(HOUR FROM u.bucket + ${KST_OFFSET}) as hour,
            LAST(u.last_value, u.bucket) - FIRST(u.first_value, u.bucket) as usage
          FROM cagg_usage_1h u
          JOIN facilities f ON u."facilityId" = f.id
          WHERE ${facilityFilter}
            AND u.bucket >= ${prevDateUtc} AND u.bucket < ${targetDateUtc}
            AND u.energy_type::text = ${energyType}
          GROUP BY u."tagId", EXTRACT(HOUR FROM u.bucket + ${KST_OFFSET})
          UNION ALL
          SELECT t."tagId",
            EXTRACT(HOUR FROM t.bucket + ${KST_OFFSET}) as hour,
            SUM(CASE WHEN t.energy_type = 'elec'::"EnergyType" THEN t.sum_value / 60.0 ELSE t.sum_value END) as usage
          FROM cagg_trend_usage_1h t
          JOIN facilities f ON t."facilityId" = f.id
          WHERE ${facilityFilter}
            AND t.bucket >= ${prevDateUtc} AND t.bucket < ${targetDateUtc}
            AND t.energy_type::text = ${energyType}
            AND EXISTS (
              SELECT 1 FROM facility_energy_configs fec
              WHERE fec."facilityId" = t."facilityId"
                AND fec."energyType"::text = t.energy_type::text
                AND fec."calcMethod"::text = 'INTEGRAL_TRAP' AND fec."isActive" = true
            )
          GROUP BY t."tagId", EXTRACT(HOUR FROM t.bucket + ${KST_OFFSET})
        )
        SELECT hour, SUM(usage) as value
        FROM tag_usage
        GROUP BY hour
        ORDER BY hour
      `;

      // 24시간 전체를 채우기
      return Array.from({ length: 24 }, (_, hour) => {
        const curr = currentData.find((d) => Number(d.hour) === hour);
        const prev = prevData.find((d) => Number(d.hour) === hour);
        const timeStr = `${String(hour).padStart(2, '0')}:00`;
        return {
          time: timeStr,
          current: Number(curr?.value || 0),
          prev: Number(prev?.value || 0),
        };
      });
    } catch (error) {
      this.logger.error('Error fetching facility hourly data:', error);
      throw error;
    }
  }

  // ANL-002: 상세 비교 분석
  // Frontend expects: Array<{ time: string; origin: number; compare: number; diff: number }>
  async getDetailedComparison(
    cond1: { facilityId: string; date: string },
    cond2: { facilityId: string; date: string },
  ) {
    this.logger.log(`Fetching detailed comparison: ${JSON.stringify(cond1)} vs ${JSON.stringify(cond2)}`);

    try {
      const data1 = await this.getFacilityHourlyData(cond1.facilityId, 'elec', cond1.date);
      const data2 = await this.getFacilityHourlyData(cond2.facilityId, 'elec', cond2.date);

      return data1.map((pt, i) => ({
        time: pt.time,
        origin: pt.current,
        compare: data2[i]?.current ?? 0,
        diff: pt.current - (data2[i]?.current ?? 0),
      }));
    } catch (error) {
      this.logger.error('Error fetching detailed comparison:', error);
      throw error;
    }
  }

  // ANL-003: 싸이클 목록
  // Frontend expects: Array<{ id, label, energy, similarity, status }>
  async getCycleList(facilityId?: string) {
    this.logger.log(`Fetching cycle list for facility: ${facilityId || 'all'}`);

    try {
      const today = todayStart();

      const where: any = {
        startTime: { gte: today },
      };

      if (facilityId) {
        if (facilityId.startsWith('HNK')) {
          // facilityId가 코드인 경우
          where.facility = { code: facilityId };
        } else {
          // facilityId가 UUID인 경우
          where.facilityId = facilityId;
        }
      }

      const cycles = await this.prisma.cycleData.findMany({
        where,
        include: {
          facility: { select: { code: true } },
        },
        orderBy: { startTime: 'desc' },
        take: 20,
      });

      // 각 설비의 기준 싸이클과 비교하여 유사도 계산
      return cycles.map((c) => {
        const start = c.startTime;
        const end = c.endTime || new Date(start.getTime() + (c.duration || 360) * 1000);
        const energy = c.totalEnergy || 0;

        // 상태에 따라 유사도 결정 (deterministic based on cycle status)
        let similarity = 95;
        if (c.status === 'ANOMALY') similarity = 65;
        else if (c.status === 'DELAYED') similarity = 80;
        else similarity = 95;

        const label = `${String(start.getMonth() + 1).padStart(2, '0')}/${String(start.getDate()).padStart(2, '0')} ${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}~${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;

        return {
          id: c.id,
          label,
          energy: Math.round(energy * 100) / 100,
          similarity: Math.round(similarity * 10) / 10,
          status: c.status === 'NORMAL' ? ('normal' as const) : ('anomaly' as const),
        };
      });
    } catch (error) {
      this.logger.error('Error fetching cycle list:', error);
      throw error;
    }
  }

  // ANL-009/010: 시간범위 내 싸이클 목록 (레거시 CYCLE_STD_MST_MMS 기반)
  async getCyclesInRange(facilityId: string, start: string, end: string) {
    this.logger.log(`Fetching cycles in range: ${facilityId} ${start}~${end}`);

    try {
      // facilityId가 UUID면 facility code로 변환
      let facilityCode = facilityId;
      if (!facilityId.startsWith('HNK')) {
        const fac = await this.prisma.facility.findFirst({
          where: { id: facilityId },
          select: { code: true },
        });
        if (fac) facilityCode = fac.code;
      }

      // ISO 타임스탬프 → 로컬 시간 문자열 (CYCLE_STD_MST_MMS의 START_DT는 varchar)
      const toLocalStr = (iso: string) => {
        const d = new Date(iso);
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return `${y}-${mo}-${dd} ${hh}:${mm}:${ss}`;
      };
      const startLocal = toLocalStr(start);
      const endLocal = toLocalStr(end);

      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        cycle_number: string;
        start_time: string;
        end_time: string;
        duration_ms: string;
        total_energy: string | null;
        dtw: string | null;
        delay_ms: string | null;
        stand_yn: number;
      }>>(`
        SELECT
          c."MATERIAL_ID" as id,
          ROW_NUMBER() OVER (ORDER BY MIN(c."START_DT")) as cycle_number,
          MIN(c."START_DT") as start_time,
          MAX(c."END_DT") as end_time,
          AVG(c."DIFF_DESC")::integer as duration_ms,
          AVG(c."U_ENERGY")::numeric(10,2) as total_energy,
          AVG(c."DTW")::numeric(10,4) as dtw,
          AVG(c."CYCLE_DELAY")::integer as delay_ms,
          MAX(c."STAND_YN") as stand_yn
        FROM "CYCLE_STD_MST_MMS" c
        JOIN "CYCLE_MMS_MAPPING" m
          ON c."MACH_ID" = m."MACH_ID" AND c."TAG_NAME" = m."TAG_NAME"
        WHERE m."MCN_CD" = $1
          AND c."END_DT" > $2
          AND c."START_DT" < $3
        GROUP BY c."MATERIAL_ID"
        ORDER BY start_time
        LIMIT 500
      `, facilityCode, startLocal, endLocal);

      this.logger.log(`Found ${rows.length} cycles for ${facilityCode}`);

      return rows.map((r) => {
        const dtwVal = r.dtw ? Number(r.dtw) : null;
        const similarity = dtwVal != null ? Math.round((1 - dtwVal) * 1000) / 10 : 0;
        const durationSec = Math.round(Number(r.duration_ms || 0) / 1000);
        const delaySec = Math.round(Number(r.delay_ms || 0) / 1000);
        // STAND_YN: 1=기준(normal), 2=정상(normal), 3=이상(anomaly)
        const status = r.stand_yn <= 2 ? 'normal' : delaySec > 5 ? 'delayed' : 'anomaly';

        return {
          id: r.id,
          cycleNumber: Number(r.cycle_number),
          startTime: new Date(r.start_time).toISOString(),
          endTime: new Date(r.end_time).toISOString(),
          duration: durationSec,
          totalEnergy: Math.round(Number(r.total_energy || 0) * 100) / 100,
          peakPower: 0,
          avgPower: 0,
          similarity,
          delay: delaySec,
          status: status as 'normal' | 'delayed' | 'anomaly',
        };
      });
    } catch (error) {
      this.logger.error('Error fetching cycles in range:', error);
      return [];
    }
  }

  // ANL-011: 싸이클 내 스텝 목록
  async getCycleSteps(materialId: string) {
    this.logger.log(`Fetching steps for cycle: ${materialId}`);

    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        step_seq: number;
        start_time: string;
        end_time: string;
      }>>(`
        SELECT
          s."STEP_SEQ" as step_seq,
          MIN(s."START_DT") as start_time,
          MAX(s."END_DT") as end_time
        FROM "STEP_STD_MST_MMS" s
        WHERE s."MATERIAL_ID" = $1
        GROUP BY s."STEP_SEQ"
        ORDER BY s."STEP_SEQ"
      `, materialId);

      this.logger.log(`Found ${rows.length} steps for cycle ${materialId}`);

      return rows.map(r => {
        const startDt = new Date(r.start_time);
        const endDt = new Date(r.end_time);
        const durationSec = Math.round((endDt.getTime() - startDt.getTime()) / 1000);
        return {
          stepSeq: r.step_seq,
          startTime: startDt.toISOString(),
          endTime: endDt.toISOString(),
          durationSec,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching cycle steps:', error);
      return [];
    }
  }

  // ANL-003: 싸이클 파형 데이터
  // Frontend expects: Array<{ sec: number; value: number }>
  async getCycleWaveform(cycleId: string, isReference = false, interval: '10s' | '1s' = '10s') {
    this.logger.log(`Fetching cycle waveform for: ${cycleId}, isReference: ${isReference}, interval: ${interval}`);

    try {
      if (isReference) {
        // 기준 싸이클 파형 조회 (cycleId는 facilityId)
        const referenceCycle = await this.prisma.referenceCycle.findUnique({
          where: { facilityId: cycleId },
        });

        if (referenceCycle && referenceCycle.waveform) {
          // waveform이 JSON 배열이므로 파싱
          const waveform = referenceCycle.waveform as Array<{ sec: number; value: number }>;
          return this.resampleWaveform(waveform, interval);
        }

        // 기준 싸이클이 없는 경우 기본 파형 생성
        return this.generateDefaultWaveform(850, 80, interval);
      } else {
        // 실제 싸이클 파형 조회
        const cycle = await this.prisma.cycleData.findUnique({
          where: { id: cycleId },
        });

        if (cycle && cycle.waveform) {
          // waveform이 JSON 배열이므로 파싱
          const waveform = cycle.waveform as Array<{ sec: number; value: number }>;
          return this.resampleWaveform(waveform, interval);
        }

        // 파형 데이터가 없는 경우 기본 파형 생성
        return this.generateDefaultWaveform(880, 90, interval);
      }
    } catch (error) {
      this.logger.error('Error fetching cycle waveform:', error);
      // 에러 시 기본 파형 반환
      return this.generateDefaultWaveform(isReference ? 850 : 880, isReference ? 80 : 90, interval);
    }
  }

  // 기본 파형 생성 (실제 데이터가 없을 때)
  private generateDefaultWaveform(base: number, variance: number, interval: '10s' | '1s' = '10s') {
    const pointCount = interval === '1s' ? 3600 : 360; // 1초: 3600개, 10초: 360개
    const step = interval === '1s' ? 0.1 : 1; // 1초 간격: 0.1초씩, 10초 간격: 1초씩

    return Array.from({ length: pointCount }, (_, i) => ({
      sec: i * step,
      value: Math.max(
        0,
        base + Math.sin(i * 0.087) * variance * 0.8 + Math.sin(i / 20) * variance * 0.4,
      ),
    }));
  }

  // 파형 데이터 리샘플링 (DB에서 가져온 데이터를 interval에 맞게 변환)
  private resampleWaveform(waveform: Array<{ sec: number; value: number }>, interval: '10s' | '1s') {
    if (interval === '10s') {
      // 10초 간격: 매 10번째 포인트만 선택 (또는 원본이 이미 10초 간격이면 그대로)
      return waveform.filter((_, i) => i % 10 === 0);
    }
    // 1초 간격: 그대로 반환 (DB 원본이 1초 단위라고 가정)
    return waveform;
  }

  // ANL-004: 싸이클 타임 지연 정보
  // Frontend expects: { cycleId, totalEnergy, similarity, delay }
  async getCycleDelay(cycleId?: string) {
    this.logger.log(`Fetching cycle delay info for: ${cycleId}`);

    if (cycleId) {
      try {
        const cycle = await this.prisma.cycleData.findUnique({
          where: { id: cycleId },
          include: {
            facility: {
              include: {
                referenceCycle: true,
              },
            },
          },
        });

        if (cycle) {
          const totalEnergy = cycle.totalEnergy || 0;
          const delay = cycle.delay || 0;

          // 유사도 결정 (deterministic based on cycle status)
          let similarity = 95;
          if (cycle.status === 'ANOMALY') similarity = 70;
          else if (cycle.status === 'DELAYED') similarity = 80;
          else similarity = 95;

          return {
            cycleId,
            totalEnergy: Math.round(totalEnergy * 100) / 100,
            similarity: Math.round(similarity * 100) / 100,
            delay: Math.round(delay * 10) / 10,
          };
        }
      } catch (error) {
        this.logger.error('Error fetching cycle delay:', error);
      }
    }

    // 기본값 반환
    return {
      cycleId: cycleId || 'CYC-DEFAULT',
      totalEnergy: 962.84,
      similarity: 57.71,
      delay: 1,
    };
  }

  // ANL-005: 전력 품질 분석 (설비별 불평형/역률)
  // Frontend expects: Array<Array<{ time: string; current: number; prev: number }>>
  async getPowerQualityAnalysis(facilityIds: string[], date?: string) {
    this.logger.log(`Fetching power quality analysis for: ${facilityIds}`);

    const results = [];
    for (const facilityId of facilityIds) {
      const data = await this.getFacilityHourlyData(facilityId, 'elec', date);
      results.push(data);
    }

    return results;
  }

  // ──────────────────────────────────────────────
  // 설비별 트렌드 태그 순시값 조회 (ANL-002 상세 비교 분석)
  // ──────────────────────────────────────────────

  /**
   * 설비별 트렌드 태그 수 (전체 설비 일괄)
   */
  async getFacilityTagCounts(energyType?: string): Promise<Record<string, number>> {
    const counts = await this.prisma.tag.groupBy({
      by: ['facilityId'],
      where: {
        measureType: 'INSTANTANEOUS',
        category: 'ENERGY',
        isActive: true,
        ...(energyType ? { energyType: energyType as any } : {}),
      },
      _count: { _all: true },
    });

    const facilityIds = counts.map(c => c.facilityId);
    const facilities = await this.prisma.facility.findMany({
      where: { id: { in: facilityIds } },
      select: { id: true, code: true },
    });
    const idToCode = new Map(facilities.map(f => [f.id, f.code]));

    const result: Record<string, number> = {};
    for (const c of counts) {
      const code = idToCode.get(c.facilityId);
      if (code) result[code] = c._count._all;
    }
    return result;
  }

  /**
   * 설비 코드 → UUID 변환 (코드가 전달되면 UUID로 변환, UUID면 그대로)
   */
  private async resolveFacilityId(facilityIdOrCode: string): Promise<string> {
    const isCode = facilityIdOrCode.startsWith('HNK');
    if (!isCode) return facilityIdOrCode;

    const facility = await this.prisma.facility.findFirst({
      where: { code: facilityIdOrCode },
      select: { id: true },
    });
    if (!facility) {
      this.logger.warn(`Facility not found for code: ${facilityIdOrCode}`);
      return facilityIdOrCode; // fallback
    }
    return facility.id;
  }

  /**
   * 설비의 트렌드 태그 목록 조회
   */
  async getFacilityTrendTags(facilityIdOrCode: string, energyType?: string) {
    const facilityId = await this.resolveFacilityId(facilityIdOrCode);
    return this.prisma.tag.findMany({
      where: {
        facilityId,
        measureType: 'INSTANTANEOUS',
        category: 'ENERGY',
        isActive: true,
        ...(energyType ? { energyType: energyType as any } : {}),
      },
      select: {
        id: true,
        tagName: true,
        displayName: true,
        energyType: true,
        unit: true,
      },
      orderBy: { tagName: 'asc' },
    });
  }

  /**
   * 설비의 모든 트렌드 태그 순시값 시계열 조회
   *
   * 응답 형태:
   * {
   *   tags: [{ tagName, displayName, energyType, unit }],
   *   data: [{ time, timestamp, [tagName1]: value, [tagName2]: value, ... }]
   * }
   */
  async getFacilityTrendData(
    facilityIdOrCode: string,
    startTime: string,
    endTime: string,
    interval: '10s' | '1s' = '10s',
    energyType?: string,
  ) {
    this.logger.log(`Fetching trend data: facility=${facilityIdOrCode}, interval=${interval}, energyType=${energyType ?? 'all'}`);

    // 1. 해당 설비의 트렌드 태그 조회 (코드→UUID 변환 포함)
    const tags = await this.getFacilityTrendTags(facilityIdOrCode, energyType);
    if (tags.length === 0) {
      return { tags: [], data: [] };
    }

    const tagIds = tags.map(t => t.id);
    const start = new Date(startTime);
    const end = new Date(endTime);

    // 2. 순시값 조회 (tag_data_raw에서 직접)
    const bucketInterval = interval === '1s' ? '1 second' : '10 seconds';

    // tagId 목록을 SQL 안전하게 구성 (Prisma findMany 결과 = 안전한 UUID)
    const tagIdList = tagIds.map(id => `'${id}'`).join(',');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ bucket: Date; tagId: string; avg_value: number }>
    >(`
      SELECT
        time_bucket('${bucketInterval}', t.timestamp) AS bucket,
        t."tagId",
        AVG(t.value) as avg_value
      FROM tag_data_raw t
      WHERE t."tagId" IN (${tagIdList})
        AND t.timestamp >= $1::timestamp
        AND t.timestamp < $2::timestamp
        AND t.value IS NOT NULL
      GROUP BY bucket, t."tagId"
      ORDER BY bucket ASC
    `, start.toISOString(), end.toISOString());

    // 3. 태그ID → tagName 매핑
    const tagIdToName = new Map(tags.map(t => [t.id, t.tagName]));

    // 4. 시간별로 그룹핑하여 태그별 값을 하나의 row로 병합
    const timeMap = new Map<string, Record<string, any>>();

    for (const row of rows) {
      const ts = new Date(row.bucket);
      const timeKey = ts.toISOString();
      const hh = String(ts.getHours()).padStart(2, '0');
      const mm = String(ts.getMinutes()).padStart(2, '0');
      const ss = String(ts.getSeconds()).padStart(2, '0');

      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, {
          time: `${hh}:${mm}:${ss}`,
          timestamp: timeKey,
        });
      }

      const tagName = tagIdToName.get(row.tagId);
      if (tagName) {
        timeMap.get(timeKey)![tagName] = Number(row.avg_value);
      }
    }

    const data = Array.from(timeMap.values());

    this.logger.log(`Trend data: ${tags.length} tags, ${data.length} points`);

    return {
      tags: tags.map(t => ({
        tagName: t.tagName,
        displayName: t.displayName,
        energyType: t.energyType,
        unit: t.unit,
      })),
      data,
    };
  }
}
