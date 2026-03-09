import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * TrendAggregateService
 * Continuous Aggregate 기반 TREND 데이터 조회
 *
 * - cagg_trend_10sec View 사용 (순시값 LAST)
 * - 10초/1분/5분/1시간 등 다양한 interval 지원
 * - 실시간 전력/에어 소비량 추이 표시
 */
@Injectable()
export class TrendAggregateService {
  private readonly logger = new Logger(TrendAggregateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * TREND 데이터 조회 (순시값)
   *
   * @param facilityId 설비 ID (선택)
   * @param tagId 태그 ID (선택)
   * @param startTime 시작 시간
   * @param endTime 종료 시간
   * @param interval 집계 간격 ('10sec', '1min', '5min', '1hour')
   * @returns 순시값 데이터
   */
  async getTrendData(params: {
    facilityId?: string;
    tagId?: string;
    startTime: Date;
    endTime: Date;
    interval?: '10sec' | '1min' | '5min' | '1hour';
  }) {
    const { facilityId, tagId, startTime, endTime, interval = '10sec' } = params;

    this.logger.log(
      `Fetching TREND data: facility=${facilityId || 'all'}, ` +
        `tag=${tagId || 'all'}, interval=${interval}, ` +
        `range=${startTime.toISOString()} ~ ${endTime.toISOString()}`,
    );

    try {
      const bucketSize = this.getBucketSize(interval);

      // 조건부 WHERE 절 구성
      const whereClauses = [
        `bucket >= '${startTime.toISOString()}'`,
        `bucket < '${endTime.toISOString()}'`,
      ];

      if (facilityId) {
        whereClauses.push(`"facilityId" = '${facilityId}'`);
      }

      if (tagId) {
        whereClauses.push(`"tagId" = '${tagId}'`);
      }

      const whereClause = whereClauses.join(' AND ');

      const selectClause =
        bucketSize === "INTERVAL '10 seconds'"
          ? 'bucket'
          : `time_bucket(${bucketSize}, bucket) as bucket`;

      const groupByClause =
        bucketSize === "INTERVAL '10 seconds'"
          ? '"tagId", "facilityId", energy_type, bucket'
          : `time_bucket(${bucketSize}, bucket), "tagId", "facilityId", energy_type`;

      const sql = `
        SELECT
          ${selectClause},
          "tagId",
          "facilityId",
          energy_type,
          AVG(last_value) as avg_value,
          MIN(last_value) as min_value,
          MAX(last_value) as max_value,
          SUM(data_count) as data_count
        FROM cagg_trend_10sec
        WHERE ${whereClause}
        GROUP BY ${groupByClause}
        ORDER BY bucket DESC, "tagId";
      `;

      const result = await this.prisma.$queryRawUnsafe<
        Array<{
          bucket: Date;
          tagId: string;
          facilityId: string;
          energy_type: string;
          avg_value: number;
          min_value: number;
          max_value: number;
          data_count: number;
        }>
      >(sql);

      this.logger.log(`Retrieved ${result.length} TREND data points`);

      return result.map((row: typeof result[0]) => ({
        timestamp: row.bucket,
        tagId: row.tagId,
        facilityId: row.facilityId,
        energyType: row.energy_type,
        value: Number(row.avg_value), // 대표값 (평균)
        avgValue: Number(row.avg_value),
        minValue: Number(row.min_value),
        maxValue: Number(row.max_value),
        dataCount: Number(row.data_count),
      }));
    } catch (error) {
      this.logger.error('Failed to fetch TREND data:', error);
      throw error;
    }
  }

  /**
   * 특정 설비의 최근 TREND 데이터 (실시간)
   */
  async getRecentTrend(facilityId?: string, minutes: number = 10) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);

    return this.getTrendData({
      facilityId,
      startTime,
      endTime,
      interval: '10sec', // 10초 단위 (가장 디테일)
    });
  }

  /**
   * 실시간 모니터링용 최신값 (마지막 1분)
   */
  async getRealTimeValues(facilityIds: string[]) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 1000); // 1분 전

    const sql = `
      SELECT DISTINCT ON ("tagId")
        "tagId",
        "facilityId",
        energy_type,
        bucket as timestamp,
        last_value as value
      FROM cagg_trend_10sec
      WHERE "facilityId" = ANY($1)
        AND bucket >= $2
        AND bucket < $3
      ORDER BY "tagId", bucket DESC;
    `;

    const result = await this.prisma.$queryRaw<
      Array<{
        tagId: string;
        facilityId: string;
        energy_type: string;
        timestamp: Date;
        value: number;
      }>
    >`
      SELECT DISTINCT ON ("tagId")
        "tagId",
        "facilityId",
        energy_type,
        bucket as timestamp,
        last_value as value
      FROM cagg_trend_10sec
      WHERE "facilityId" = ANY(ARRAY[${facilityIds.map((id) => `'${id}'`).join(',')}])
        AND bucket >= ${startTime}
        AND bucket < ${endTime}
      ORDER BY "tagId", bucket DESC;
    `;

    return result.map((row) => ({
      tagId: row.tagId,
      facilityId: row.facilityId,
      energyType: row.energy_type,
      timestamp: row.timestamp,
      value: Number(row.value),
    }));
  }

  /**
   * interval을 PostgreSQL time_bucket 크기로 변환
   */
  private getBucketSize(interval: '10sec' | '1min' | '5min' | '1hour'): string {
    const bucketSizes = {
      '10sec': "INTERVAL '10 seconds'",
      '1min': "INTERVAL '1 minute'",
      '5min': "INTERVAL '5 minutes'",
      '1hour': "INTERVAL '1 hour'",
    };

    return bucketSizes[interval];
  }
}
