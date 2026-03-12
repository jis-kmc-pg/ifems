import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

/**
 * ResetDetectorService
 * 계측기 누적치 리셋 자동 감지 및 이상 데이터 감지
 *
 * - 10초마다 USAGE 태그의 리셋 감지 (10% 이상 감소)
 * - 1분마다 분당 사용량 이상 감지 (N배 이상 변동)
 * - meter_reset_events 테이블에 자동 기록
 */
@Injectable()
export class ResetDetectorService {
  private readonly logger = new Logger(ResetDetectorService.name);
  private readonly RESET_THRESHOLD = 0.1; // 10% 감소

  // 이상 감지 기본값 (설비별 설정으로 오버라이드 가능)
  private readonly DEFAULT_ANOMALY_MULTIPLIER = 5; // 5배 이상 변동
  private readonly DEFAULT_MAX_CONSECUTIVE = 2;    // 2분까지 직전 정상값 대체, 3분+ → NULL

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 10초마다 리셋 감지 실행
   * Continuous Aggregate 갱신 주기(1분)보다 빠르게 실행하여 즉시 감지
   */
  @Cron('*/30 * * * * *')
  async detectResets() {
    try {
      // CUMULATIVE(적산) 태그 목록 조회
      const usageTags = await this.prisma.tag.findMany({
        where: {
          measureType: 'CUMULATIVE',
          isActive: true,
        },
        select: {
          id: true,
          tagName: true,
          displayName: true,
        },
      });

      if (usageTags.length === 0) {
        return;
      }

      this.logger.debug(`Checking ${usageTags.length} USAGE tags for resets...`);

      // 각 태그별 리셋 감지
      for (const tag of usageTags) {
        await this.detectResetForTag(tag.id, tag.tagName);
      }
    } catch (error) {
      this.logger.error('Failed to detect resets:', error);
    }
  }

  /**
   * 특정 태그의 리셋 감지
   * LAG Window Function으로 이전 값과 비교
   */
  private async detectResetForTag(tagId: string, tagName: string) {
    try {
      // 최근 2분 데이터에서 리셋 감지
      // LAG로 이전 값과 비교하여 10% 이상 감소한 경우 리셋으로 판단
      const resets = await this.prisma.$queryRaw<
        Array<{
          timestamp: Date;
          current_value: number;
          previous_value: number;
          decrease_percent: number;
        }>
      >`
        WITH value_changes AS (
          SELECT
            timestamp,
            value as current_value,
            LAG(value) OVER (ORDER BY timestamp) as previous_value
          FROM tag_data_raw
          WHERE "tagId" = ${tagId}
            AND timestamp >= NOW() - INTERVAL '2 minutes'
            AND value IS NOT NULL
          ORDER BY timestamp
        )
        SELECT
          timestamp,
          current_value,
          previous_value,
          ((previous_value - current_value) / previous_value) as decrease_percent
        FROM value_changes
        WHERE previous_value IS NOT NULL
          AND current_value < previous_value
          AND ((previous_value - current_value) / previous_value) >= ${this.RESET_THRESHOLD}
          AND timestamp >= NOW() - INTERVAL '30 seconds'
        ORDER BY timestamp DESC
        LIMIT 5;
      `;

      if (resets.length === 0) {
        return;
      }

      // 감지된 리셋 기록
      for (const reset of resets) {
        await this.recordResetEvent(
          tagId,
          tagName,
          reset.timestamp,
          reset.previous_value,
          reset.current_value,
          reset.decrease_percent,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to detect reset for tag ${tagName}:`, error);
    }
  }

  /**
   * 리셋 이벤트 기록
   * 중복 방지: tag_id + reset_time UNIQUE 제약
   */
  private async recordResetEvent(
    tagId: string,
    tagName: string,
    resetTime: Date,
    valueBeforeReset: number,
    valueAfterReset: number,
    decreasePercent: number,
  ) {
    try {
      await this.prisma.meterResetEvent.create({
        data: {
          tagId,
          resetTime,
          valueBeforeReset,
          valueAfterReset,
          detectionMethod: 'auto',
          correctionApplied: true,
          notes: `Auto-detected: ${(decreasePercent * 100).toFixed(2)}% decrease`,
        },
      });

      this.logger.warn(
        `🔄 Reset detected: ${tagName} at ${resetTime.toISOString()} ` +
          `(${valueBeforeReset.toFixed(2)} → ${valueAfterReset.toFixed(2)}, ` +
          `-${(decreasePercent * 100).toFixed(2)}%)`,
      );
    } catch (error) {
      // UNIQUE 제약 위반 시 중복 기록 무시
      if (error.code === '23505') {
        this.logger.debug(`Reset already recorded: ${tagName} at ${resetTime.toISOString()}`);
      } else {
        this.logger.error(`Failed to record reset event for ${tagName}:`, error);
      }
    }
  }

  /**
   * 수동 리셋 기록 (관리자 API용)
   */
  async recordManualReset(
    tagId: string,
    resetTime: Date,
    valueBeforeReset: number,
    valueAfterReset: number,
    notes?: string,
  ) {
    try {
      const event = await this.prisma.meterResetEvent.create({
        data: {
          tagId,
          resetTime,
          valueBeforeReset,
          valueAfterReset,
          detectionMethod: 'manual',
          correctionApplied: true,
          notes,
        },
      });

      this.logger.log(`Manual reset recorded: ${tagId} at ${resetTime.toISOString()}`);

      return event;
    } catch (error) {
      this.logger.error('Failed to record manual reset:', error);
      throw error;
    }
  }

  /**
   * 리셋 이벤트 조회 (특정 태그, 특정 기간)
   */
  async getResetEvents(tagId: string, startTime?: Date, endTime?: Date) {
    return this.prisma.meterResetEvent.findMany({
      where: {
        tagId,
        ...(startTime && { resetTime: { gte: startTime } }),
        ...(endTime && { resetTime: { lte: endTime } }),
      },
      orderBy: {
        resetTime: 'desc',
      },
    });
  }

  /**
   * 리셋 이벤트 보정 적용/해제
   */
  async toggleCorrectionApplied(eventId: string, applied: boolean) {
    return this.prisma.meterResetEvent.update({
      where: { id: eventId },
      data: { correctionApplied: applied },
    });
  }

  // ============================================================
  // 이상 데이터 감지 (Anomaly Detection)
  // ============================================================

  /**
   * 1분마다 이상 데이터 감지 실행
   * cagg_usage_1min에서 분당 사용량의 급변동 감지
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async detectAnomalies() {
    try {
      // CUMULATIVE(적산) 태그가 있는 설비 목록 (이상 감지 대상)
      const usageTags = await this.prisma.tag.findMany({
        where: {
          measureType: 'CUMULATIVE',
          isActive: true,
        },
        select: {
          id: true,
          tagName: true,
          facilityId: true,
        },
      });

      if (usageTags.length === 0) {
        return;
      }

      this.logger.debug(`Checking ${usageTags.length} tags for anomalies...`);

      // 설비별 임계값 로드 (캐싱은 향후 최적화)
      const facilityIds = [...new Set(usageTags.map(t => t.facilityId))];
      const thresholds = await this.loadAnomalyThresholds(facilityIds);

      for (const tag of usageTags) {
        const config = thresholds.get(tag.facilityId);
        const multiplier = config?.threshold1 ?? this.DEFAULT_ANOMALY_MULTIPLIER;
        const maxConsecutive = config?.threshold2 ?? this.DEFAULT_MAX_CONSECUTIVE;

        await this.detectAnomalyForTag(tag.id, tag.tagName, multiplier, maxConsecutive);
      }
    } catch (error) {
      this.logger.error('Failed to detect anomalies:', error);
    }
  }

  /**
   * 특정 태그의 이상 데이터 감지
   * cagg_usage_1min에서 LAG()로 이전 분과 비교
   */
  private async detectAnomalyForTag(
    tagId: string,
    tagName: string,
    multiplier: number,
    maxConsecutive: number,
  ) {
    try {
      // 최근 5분 분당 사용량에서 이상 변동 감지
      const anomalies = await this.prisma.$queryRaw<
        Array<{
          bucket: Date;
          current_usage: number;
          prev_usage: number;
          deviation: number;
        }>
      >`
        WITH usage_changes AS (
          SELECT
            bucket,
            raw_usage_diff AS current_usage,
            LAG(raw_usage_diff) OVER (ORDER BY bucket) AS prev_usage
          FROM cagg_usage_1min
          WHERE "tagId" = ${tagId}
            AND bucket >= NOW() - INTERVAL '5 minutes'
            AND raw_usage_diff IS NOT NULL
          ORDER BY bucket
        )
        SELECT
          bucket,
          current_usage,
          prev_usage,
          CASE
            WHEN prev_usage > 0 THEN current_usage / prev_usage
            ELSE 0
          END AS deviation
        FROM usage_changes
        WHERE prev_usage IS NOT NULL
          AND prev_usage > 0
          AND (
            current_usage / prev_usage >= ${multiplier}
            OR prev_usage / current_usage >= ${multiplier}
          )
          AND bucket >= NOW() - INTERVAL '2 minutes'
        ORDER BY bucket DESC
        LIMIT 5;
      `;

      if (anomalies.length === 0) {
        return;
      }

      for (const anomaly of anomalies) {
        // 연속 이상 횟수 계산
        const consecutiveCount = await this.getConsecutiveAnomalyCount(tagId, anomaly.bucket);

        // 대체값 결정: 연속 1~maxConsecutive → 직전 정상값, 초과 → NULL
        const replacementValue = consecutiveCount < maxConsecutive
          ? await this.getLastNormalUsage(tagId, anomaly.bucket)
          : null;

        await this.recordAnomalyEvent(
          tagId,
          tagName,
          anomaly.bucket,
          anomaly.prev_usage,
          anomaly.current_usage,
          Number(anomaly.deviation),
          consecutiveCount + 1, // 현재 포함
          replacementValue,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to detect anomaly for tag ${tagName}:`, error);
    }
  }

  /**
   * 연속 이상 횟수 계산
   * 현재 bucket 직전까지의 연속 anomaly 이벤트 수
   */
  private async getConsecutiveAnomalyCount(tagId: string, currentBucket: Date): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      WITH recent_events AS (
        SELECT reset_time, event_type
        FROM meter_reset_events
        WHERE tag_id = ${tagId}
          AND event_type = 'anomaly'
          AND reset_time < ${currentBucket}
          AND reset_time >= ${currentBucket}::timestamp - INTERVAL '10 minutes'
        ORDER BY reset_time DESC
      )
      SELECT COUNT(*) as count
      FROM (
        SELECT reset_time,
               reset_time - LAG(reset_time) OVER (ORDER BY reset_time DESC) as gap
        FROM recent_events
      ) sub
      WHERE gap IS NULL OR gap >= INTERVAL '-2 minutes';
    `;

    return Number(result[0]?.count ?? 0);
  }

  /**
   * 직전 정상 사용량 조회
   * 이상이 아닌 가장 최근 분의 사용량
   */
  private async getLastNormalUsage(tagId: string, currentBucket: Date): Promise<number | null> {
    const result = await this.prisma.$queryRaw<Array<{ raw_usage_diff: number }>>`
      SELECT u.raw_usage_diff
      FROM cagg_usage_1min u
      LEFT JOIN meter_reset_events r
        ON u."tagId" = r.tag_id
        AND r.reset_time >= u.bucket
        AND r.reset_time < u.bucket + INTERVAL '1 minute'
        AND r.event_type = 'anomaly'
        AND r.correction_applied = true
      WHERE u."tagId" = ${tagId}
        AND u.bucket < ${currentBucket}
        AND u.bucket >= ${currentBucket}::timestamp - INTERVAL '30 minutes'
        AND u.raw_usage_diff IS NOT NULL
        AND r.tag_id IS NULL
      ORDER BY u.bucket DESC
      LIMIT 1;
    `;

    return result[0]?.raw_usage_diff != null ? Number(result[0].raw_usage_diff) : null;
  }

  /**
   * 이상 이벤트 기록
   */
  private async recordAnomalyEvent(
    tagId: string,
    tagName: string,
    bucket: Date,
    prevUsage: number,
    currentUsage: number,
    deviation: number,
    consecutiveCount: number,
    replacementValue: number | null,
  ) {
    try {
      await this.prisma.meterResetEvent.create({
        data: {
          tagId,
          resetTime: bucket,
          valueBeforeReset: prevUsage,
          valueAfterReset: currentUsage,
          detectionMethod: 'auto',
          correctionApplied: true,
          eventType: 'anomaly',
          deviationMultiplier: deviation,
          replacementValue,
          consecutiveCount,
          notes: `Anomaly: ${deviation.toFixed(1)}x deviation (${consecutiveCount} consecutive), replaced with ${replacementValue != null ? replacementValue.toFixed(2) : 'NULL'}`,
        },
      });

      this.logger.warn(
        `⚠️ Anomaly detected: ${tagName} at ${bucket.toISOString()} ` +
          `(${prevUsage.toFixed(2)} → ${currentUsage.toFixed(2)}, ` +
          `${deviation.toFixed(1)}x, consecutive: ${consecutiveCount})`,
      );
    } catch (error) {
      // UNIQUE 제약 위반 시 중복 기록 무시
      if (error.code === '23505') {
        this.logger.debug(`Anomaly already recorded: ${tagName} at ${bucket.toISOString()}`);
      } else {
        this.logger.error(`Failed to record anomaly event for ${tagName}:`, error);
      }
    }
  }

  /**
   * 설비별 이상 감지 임계값 로드
   * facilities.metadata.thresholds.anomaly_detection에서 조회
   */
  private async loadAnomalyThresholds(facilityIds: string[]): Promise<Map<string, { threshold1: number; threshold2: number }>> {
    const facilities = await this.prisma.facility.findMany({
      where: { id: { in: facilityIds } },
      select: { id: true, metadata: true },
    });

    const map = new Map<string, { threshold1: number; threshold2: number }>();

    for (const f of facilities) {
      const meta = f.metadata as any;
      const config = meta?.thresholds?.anomaly_detection;
      if (config) {
        map.set(f.id, {
          threshold1: config.threshold1 ?? this.DEFAULT_ANOMALY_MULTIPLIER,
          threshold2: config.threshold2 ?? this.DEFAULT_MAX_CONSECUTIVE,
        });
      }
    }

    return map;
  }

  /**
   * 이상 이벤트 조회 (특정 기간, 차트 표시용)
   * 연속 이벤트를 구간으로 병합하여 반환
   */
  async getAnomalyEvents(params: {
    facilityId?: string;
    lineId?: string;
    startTime: Date;
    endTime: Date;
  }) {
    const { facilityId, lineId, startTime, endTime } = params;

    let whereClause = '';
    if (facilityId) {
      whereClause = `AND t."facilityId" = '${facilityId}'`;
    } else if (lineId) {
      whereClause = `AND t."facilityId" IN (SELECT id FROM facilities WHERE "lineId" = '${lineId}')`;
    }

    const events = await this.prisma.$queryRawUnsafe<
      Array<{
        reset_time: Date;
        tag_id: string;
        tag_name: string;
        facility_id: string;
        deviation_multiplier: number;
        consecutive_count: number;
        replacement_value: number | null;
        value_before_reset: number;
        value_after_reset: number;
      }>
    >(`
      SELECT
        r.reset_time,
        r.tag_id,
        t."tagName" as tag_name,
        t."facilityId" as facility_id,
        r.deviation_multiplier,
        r.consecutive_count,
        r.replacement_value,
        r.value_before_reset,
        r.value_after_reset
      FROM meter_reset_events r
      JOIN tags t ON r.tag_id = t.id
      WHERE r.event_type = 'anomaly'
        AND r.correction_applied = true
        AND r.reset_time >= '${startTime.toISOString()}'
        AND r.reset_time < '${endTime.toISOString()}'
        ${whereClause}
      ORDER BY r.tag_id, r.reset_time;
    `);

    // 연속 이벤트를 구간으로 병합
    return this.mergeConsecutiveAnomalies(events);
  }

  /**
   * 연속 이상 이벤트를 하나의 구간으로 병합
   */
  private mergeConsecutiveAnomalies(events: Array<{
    reset_time: Date;
    tag_id: string;
    tag_name: string;
    facility_id: string;
    deviation_multiplier: number;
    consecutive_count: number;
    replacement_value: number | null;
    value_before_reset: number;
    value_after_reset: number;
  }>) {
    if (events.length === 0) return [];

    const merged: Array<{
      start: string;
      end: string;
      tagId: string;
      type: 'spike' | 'drop';
      maxDeviation: number;
      consecutiveMinutes: number;
      replacedWith: 'lastNormal' | 'null';
    }> = [];

    let currentGroup: typeof events = [];

    for (const event of events) {
      if (currentGroup.length === 0) {
        currentGroup.push(event);
        continue;
      }

      const lastEvent = currentGroup[currentGroup.length - 1];
      const timeDiff = event.reset_time.getTime() - lastEvent.reset_time.getTime();
      const sameTag = event.tag_id === lastEvent.tag_id;

      // 같은 태그 & 2분 이내 → 같은 구간
      if (sameTag && timeDiff <= 2 * 60 * 1000) {
        currentGroup.push(event);
      } else {
        // 구간 확정
        merged.push(this.buildAnomalyRange(currentGroup));
        currentGroup = [event];
      }
    }

    // 마지막 구간
    if (currentGroup.length > 0) {
      merged.push(this.buildAnomalyRange(currentGroup));
    }

    return merged;
  }

  private buildAnomalyRange(group: Array<{
    reset_time: Date;
    tag_id: string;
    deviation_multiplier: number;
    replacement_value: number | null;
    value_before_reset: number;
    value_after_reset: number;
  }>) {
    const first = group[0];
    const last = group[group.length - 1];
    const maxDev = Math.max(...group.map(e => Number(e.deviation_multiplier) || 0));
    const isSpike = Number(first.value_after_reset) > Number(first.value_before_reset);

    return {
      start: first.reset_time.toISOString(),
      end: new Date(last.reset_time.getTime() + 60000).toISOString(), // +1분 (bucket 끝)
      tagId: first.tag_id,
      type: (isSpike ? 'spike' : 'drop') as 'spike' | 'drop',
      maxDeviation: maxDev,
      consecutiveMinutes: group.length,
      replacedWith: (last.replacement_value != null ? 'lastNormal' : 'null') as 'lastNormal' | 'null',
    };
  }
}
