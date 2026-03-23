import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

/**
 * AirLeakDetectorService
 * 에어 누기 감지 (AIR 태그 CA 기반)
 *
 * - 매 5분: 시간당 에어 사용량 급증 감지
 * - 최근 1시간 사용량 vs 24시간 평균 비교
 * - alerts 테이블에 INSERT → ALT-002 페이지에서 조회
 */
@Injectable()
export class AirLeakDetectorService {
  private readonly logger = new Logger(AirLeakDetectorService.name);

  // 기본 임계값
  private readonly DEFAULT_MIN_BASELINE = 5000;  // 최소 기준량 (L)
  private readonly DEFAULT_SURGE_PCT = 20;        // 급증 임계 (%)
  private readonly DUPLICATE_WINDOW_MIN = 60;     // 중복 방지 윈도우 (분)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 매 5분마다 에어 누기 감지
   */
  @Cron('30 */5 * * * *')
  async detectAirLeak() {
    try {
      const thresholds = await this.loadThresholds();
      const minBaseline = thresholds?.threshold1 ?? this.DEFAULT_MIN_BASELINE;
      const surgePct = thresholds?.threshold2 ?? this.DEFAULT_SURGE_PCT;

      await this.detectSurge(minBaseline, surgePct);
    } catch (error) {
      this.logger.error('Failed to detect air leak:', error);
    }
  }

  /**
   * 에어 사용량 급증 감지
   * 최근 1시간 사용량 vs 24시간 평균 시간당 사용량 비교
   */
  private async detectSurge(minBaseline: number, surgePct: number) {
    try {
      const surgeRatio = 1 + surgePct / 100.0;

      const results = await this.prisma.$queryRaw<
        Array<{
          facilityId: string;
          current_usage: number;
          avg_hourly: number;
          usage_ratio: number;
        }>
      >`
        WITH
        utc_now AS (SELECT NOW() AT TIME ZONE 'UTC' AS t),
        hourly AS (
          SELECT
            cu."facilityId",
            SUM(GREATEST(0, cu.last_value - cu.first_value)) AS current_usage
          FROM cagg_usage_1h cu
          JOIN tags t ON cu."tagId" = t.id
          CROSS JOIN utc_now u
          WHERE t."energyType" = 'air'
            AND t."isActive" = true
            AND cu.bucket >= date_trunc('hour', u.t) - INTERVAL '1 hour'
            AND cu.last_value IS NOT NULL
            AND cu.first_value IS NOT NULL
          GROUP BY cu."facilityId"
        ),
        daily_avg AS (
          SELECT
            cu."facilityId",
            SUM(GREATEST(0, cu.last_value - cu.first_value))
              / GREATEST(COUNT(DISTINCT cu.bucket), 1) AS avg_hourly
          FROM cagg_usage_1h cu
          JOIN tags t ON cu."tagId" = t.id
          CROSS JOIN utc_now u
          WHERE t."energyType" = 'air'
            AND t."isActive" = true
            AND cu.bucket >= u.t - INTERVAL '25 hours'
            AND cu.bucket < date_trunc('hour', u.t) - INTERVAL '1 hour'
            AND cu.last_value IS NOT NULL
            AND cu.first_value IS NOT NULL
          GROUP BY cu."facilityId"
        )
        SELECT
          h."facilityId",
          h.current_usage,
          d.avg_hourly,
          h.current_usage / d.avg_hourly * 100 AS usage_ratio
        FROM hourly h
        JOIN daily_avg d ON h."facilityId" = d."facilityId"
        WHERE d.avg_hourly > ${minBaseline}
          AND h.current_usage / d.avg_hourly > ${surgeRatio}
      `;

      if (results.length === 0) return;

      this.logger.debug(`Air leak surge detected: ${results.length} facilities`);

      for (const row of results) {
        await this.createAirLeakAlert(row);
      }
    } catch (error) {
      this.logger.error('Failed to detect air surge:', error);
    }
  }

  /**
   * 에어 누기 알림 생성
   */
  private async createAirLeakAlert(
    data: { facilityId: string; current_usage: number; avg_hourly: number; usage_ratio: number },
  ) {
    const usage = Number(data.current_usage);
    const baseline = Number(data.avg_hourly);
    const ratio = Number(data.usage_ratio);

    // 중복 방지: 최근 1시간 이내 동일 설비 AIR_LEAK 알림 확인
    const duplicate = await this.findRecentAlert(data.facilityId);
    if (duplicate) return;

    const severity = ratio >= 200 ? 'DANGER' : 'WARNING';

    try {
      await this.prisma.alert.create({
        data: {
          facilityId: data.facilityId,
          severity,
          type: 'AIR_LEAK',
          message: `에어 사용량 급증 ${usage.toFixed(0)}L (평균 ${baseline.toFixed(0)}L, ${ratio.toFixed(0)}%)`,
          value: usage,
          threshold: baseline,
          unit: 'L',
          metadata: {
            airUsage: usage,
            baseline,
            leakRate: ratio,
          },
          detectedAt: new Date(),
        },
      });

      this.logger.warn(
        `🌬️ Air leak alert: facility=${data.facilityId} usage=${usage.toFixed(0)}L ratio=${ratio.toFixed(0)}% [${severity}]`,
      );
    } catch (error) {
      this.logger.error(`Failed to create air leak alert: ${error.message}`);
    }
  }

  /**
   * 중복 방지: 최근 N분 이내 동일 설비 AIR_LEAK 알림 확인
   */
  private async findRecentAlert(facilityId: string) {
    const windowStart = new Date(Date.now() - this.DUPLICATE_WINDOW_MIN * 60 * 1000);

    return this.prisma.alert.findFirst({
      where: {
        facilityId,
        type: 'AIR_LEAK',
        detectedAt: { gte: windowStart },
      },
      select: { id: true },
    });
  }

  /**
   * 설정에서 임계값 로드
   */
  private async loadThresholds(): Promise<{ threshold1: number; threshold2: number } | null> {
    try {
      const facilities = await this.prisma.facility.findMany({
        select: { id: true, metadata: true },
        take: 1,
      });

      if (facilities.length === 0) return null;

      const meta = facilities[0].metadata as any;
      const config = meta?.thresholds?.air_leak;
      if (config) {
        return { threshold1: config.threshold1, threshold2: config.threshold2 };
      }
    } catch {
      // ignore
    }
    return null;
  }
}
