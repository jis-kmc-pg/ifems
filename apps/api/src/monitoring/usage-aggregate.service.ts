import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { todayStart, daysAgo, nextDay } from '../common/utils/date-time.utils';

/**
 * UsageAggregateService
 * Continuous Aggregate 기반 USAGE 데이터 조회
 *
 * - cagg_usage_combined_1min View 사용 (DIFF + INTEGRAL_TRAP 통합, 리셋 보정 포함)
 * - 1분/5분/1시간/1일 등 다양한 interval 지원
 * - 리셋 이벤트 자동 보정 적용
 */
@Injectable()
export class UsageAggregateService {
  private readonly logger = new Logger(UsageAggregateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * USAGE 데이터 조회 (리셋 보정 포함)
   *
   * @param facilityId 설비 ID (선택)
   * @param tagId 태그 ID (선택)
   * @param startTime 시작 시간
   * @param endTime 종료 시간
   * @param interval 집계 간격 ('1min', '5min', '1hour', '1day')
   * @returns 적산 사용량 데이터 (리셋 보정 적용됨)
   */
  async getUsageData(params: {
    facilityId?: string;
    tagId?: string;
    startTime: Date;
    endTime: Date;
    interval?: '1min' | '5min' | '1hour' | '1day';
  }) {
    const { facilityId, tagId, startTime, endTime, interval = '1min' } = params;

    this.logger.log(
      `Fetching USAGE data: facility=${facilityId || 'all'}, ` +
        `tag=${tagId || 'all'}, interval=${interval}, ` +
        `range=${startTime.toISOString()} ~ ${endTime.toISOString()}`,
    );

    try {
      // interval에 따라 추가 집계 필요
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
        bucketSize === "INTERVAL '1 minute'"
          ? 'bucket'
          : `time_bucket(${bucketSize}, bucket) as bucket`;

      const groupByClause =
        bucketSize === "INTERVAL '1 minute'"
          ? '"tagId", "facilityId", energy_type, bucket'
          : `time_bucket(${bucketSize}, bucket), "tagId", "facilityId", energy_type`;

      const sql = `
        SELECT
          ${selectClause},
          "tagId",
          "facilityId",
          energy_type,
          calc_method,
          CASE WHEN calc_method = 'DIFF'
            THEN LAST(last_value, bucket) - FIRST(first_value, bucket) + SUM(COALESCE(reset_correction, 0))
            ELSE SUM(usage_diff)
          END as total_usage,
          SUM(data_count) as data_count
        FROM cagg_usage_combined_1min
        WHERE ${whereClause}
        GROUP BY ${groupByClause}, calc_method
        ORDER BY bucket DESC, "tagId";
      `;

      const result = await this.prisma.$queryRawUnsafe<
        Array<{
          bucket: Date;
          tagId: string;
          facilityId: string;
          energy_type: string;
          total_usage: number;
          data_count: number;
        }>
      >(sql);

      this.logger.log(`Retrieved ${result.length} data points`);

      return result.map((row: typeof result[0]) => ({
        timestamp: row.bucket,
        tagId: row.tagId,
        facilityId: row.facilityId,
        energyType: row.energy_type,
        usage: Number(row.total_usage),
        resetCorrection: 0,
        dataCount: Number(row.data_count),
        hadResets: false,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch USAGE data:', error);
      throw error;
    }
  }

  /**
   * 특정 설비의 최근 USAGE 데이터 (실시간)
   */
  async getRecentUsage(facilityId?: string, minutes: number = 10) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);

    return this.getUsageData({
      facilityId,
      startTime,
      endTime,
      interval: '1min',
    });
  }

  /**
   * 시간대별 USAGE 비교 (오늘 vs 어제)
   */
  async compareUsageByHour(facilityId: string, date: Date = new Date()) {
    const today = new Date(date);
    today.setHours(0, 0, 0, 0);

    const tomorrow = nextDay(today);
    const yesterday = daysAgo(1, today);

    const [todayData, yesterdayData] = await Promise.all([
      this.getUsageData({
        facilityId,
        startTime: today,
        endTime: tomorrow,
        interval: '1hour',
      }),
      this.getUsageData({
        facilityId,
        startTime: yesterday,
        endTime: today,
        interval: '1hour',
      }),
    ]);

    return {
      today: todayData,
      yesterday: yesterdayData,
      comparison: this.calculateComparison(todayData, yesterdayData),
    };
  }

  /**
   * interval을 PostgreSQL time_bucket 크기로 변환
   */
  private getBucketSize(interval: '1min' | '5min' | '1hour' | '1day'): string {
    const bucketSizes = {
      '1min': "INTERVAL '1 minute'",
      '5min': "INTERVAL '5 minutes'",
      '1hour': "INTERVAL '1 hour'",
      '1day': "INTERVAL '1 day'",
    };

    return bucketSizes[interval];
  }

  /**
   * 오늘/어제 비교 계산
   */
  private calculateComparison(today: any[], yesterday: any[]) {
    const todayTotal = today.reduce((sum, item) => sum + item.usage, 0);
    const yesterdayTotal = yesterday.reduce((sum, item) => sum + item.usage, 0);

    const diff = todayTotal - yesterdayTotal;
    const changePercent = yesterdayTotal > 0 ? (diff / yesterdayTotal) * 100 : 0;

    return {
      todayTotal,
      yesterdayTotal,
      diff,
      changePercent: Number(changePercent.toFixed(2)),
    };
  }

  /**
   * 리셋 이벤트 발생 내역 조회
   */
  async getResetHistory(params: {
    facilityId?: string;
    tagId?: string;
    startTime: Date;
    endTime: Date;
  }) {
    const { facilityId, tagId, startTime, endTime } = params;

    return this.prisma.meterResetEvent.findMany({
      where: {
        resetTime: {
          gte: startTime,
          lt: endTime,
        },
        ...(tagId && { tagId }),
        ...(facilityId && {
          tag: {
            facilityId,
          },
        }),
      },
      include: {
        tag: {
          select: {
            tagName: true,
            displayName: true,
            facilityId: true,
          },
        },
      },
      orderBy: {
        resetTime: 'desc',
      },
    });
  }
}
