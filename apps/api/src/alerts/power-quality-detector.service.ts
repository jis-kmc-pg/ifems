import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

/**
 * PowerQualityDetectorService
 * 전력 품질 이상 감지 (QUALITY 태그 기반)
 *
 * - 매 5분: 전류 불평형률 감지 (Phase A/B/C)
 * - 매 5분: 역률 저하 감지 (PF 태그)
 * - alerts 테이블에 INSERT → ALT-001 페이지에서 조회
 */
@Injectable()
export class PowerQualityDetectorService {
  private readonly logger = new Logger(PowerQualityDetectorService.name);

  // 기본 임계값 (settings에서 오버라이드 가능)
  private readonly DEFAULT_IMBALANCE_THRESHOLD = 1.0; // 불평형률 %
  private readonly DEFAULT_PF_THRESHOLD = 93;          // 역률 최소 %
  private readonly DUPLICATE_WINDOW_MIN = 30;          // 중복 방지 윈도우 (분)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 매 5분마다 전력 품질 이상 감지
   */
  @Cron('0 */5 * * * *')
  async detectPowerQuality() {
    try {
      const thresholds = await this.loadThresholds();
      const imbalanceThreshold = thresholds?.threshold1 ?? this.DEFAULT_IMBALANCE_THRESHOLD;
      const pfThreshold = thresholds?.threshold2 ?? this.DEFAULT_PF_THRESHOLD;

      await Promise.all([
        this.detectImbalance(imbalanceThreshold),
        this.detectLowPowerFactor(pfThreshold),
      ]);
    } catch (error) {
      this.logger.error('Failed to detect power quality issues:', error);
    }
  }

  /**
   * 전류 불평형률 감지
   * Phase A/B/C 3상 전류의 편차율 계산
   */
  private async detectImbalance(threshold: number) {
    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          facilityId: string;
          max_val: number;
          min_val: number;
          avg_val: number;
          imbalance_pct: number;
        }>
      >`
        WITH phase_data AS (
          SELECT
            t."facilityId",
            CASE
              WHEN t."tagName" LIKE '%\_A' THEN 'A'
              WHEN t."tagName" LIKE '%\_B' THEN 'B'
              WHEN t."tagName" LIKE '%\_C' THEN 'C'
            END AS phase,
            AVG(d.value) AS avg_value
          FROM tag_data_raw d
          JOIN tags t ON d."tagId" = t.id
          WHERE t.category = 'QUALITY'
            AND t."isActive" = true
            AND (t."tagName" LIKE '%\_A' OR t."tagName" LIKE '%\_B' OR t."tagName" LIKE '%\_C')
            AND d.timestamp >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes'
            AND d.value IS NOT NULL
            AND d.value > 0
          GROUP BY t."facilityId", phase
        )
        SELECT
          "facilityId",
          MAX(avg_value) AS max_val,
          MIN(avg_value) AS min_val,
          AVG(avg_value) AS avg_val,
          (MAX(avg_value) - MIN(avg_value)) / AVG(avg_value) * 100 AS imbalance_pct
        FROM phase_data
        GROUP BY "facilityId"
        HAVING COUNT(DISTINCT phase) = 3
          AND (MAX(avg_value) - MIN(avg_value)) / AVG(avg_value) * 100 > ${threshold}
      `;

      if (results.length === 0) return;

      this.logger.debug(`Imbalance detected: ${results.length} facilities`);

      for (const row of results) {
        await this.createImbalanceAlert(row, threshold);
      }
    } catch (error) {
      this.logger.error('Failed to detect imbalance:', error);
    }
  }

  /**
   * 역률 저하 감지
   */
  private async detectLowPowerFactor(threshold: number) {
    try {
      const results = await this.prisma.$queryRaw<
        Array<{
          facilityId: string;
          avg_pf: number;
        }>
      >`
        SELECT
          t."facilityId",
          AVG(d.value) AS avg_pf
        FROM tag_data_raw d
        JOIN tags t ON d."tagId" = t.id
        WHERE t.category = 'QUALITY'
          AND t."isActive" = true
          AND t."tagName" LIKE '%\_PF'
          AND d.timestamp >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes'
          AND d.value IS NOT NULL
        GROUP BY t."facilityId"
        HAVING AVG(d.value) < ${threshold}
      `;

      if (results.length === 0) return;

      this.logger.debug(`Low PF detected: ${results.length} facilities`);

      for (const row of results) {
        await this.createPowerFactorAlert(row, threshold);
      }
    } catch (error) {
      this.logger.error('Failed to detect low power factor:', error);
    }
  }

  /**
   * 불평형률 알림 생성
   */
  private async createImbalanceAlert(
    data: { facilityId: string; max_val: number; min_val: number; avg_val: number; imbalance_pct: number },
    threshold: number,
  ) {
    const imbalance = Number(data.imbalance_pct);

    // 중복 방지: 최근 30분 이내 동일 설비 + imbalance 알림 확인
    const duplicate = await this.findRecentAlert(data.facilityId, 'imbalance');
    if (duplicate) return;

    const severity = imbalance >= 10 ? 'DANGER' : 'WARNING';

    try {
      await this.prisma.alert.create({
        data: {
          facilityId: data.facilityId,
          severity,
          type: 'POWER_QUALITY',
          message: `전류 불평형률 ${imbalance.toFixed(1)}% (임계 ${threshold}%)`,
          value: imbalance,
          threshold,
          unit: '%',
          metadata: {
            imbalance,
            phaseA: Number(data.max_val),
            phaseB: Number(data.avg_val),
            phaseC: Number(data.min_val),
            subType: 'imbalance',
          },
          detectedAt: new Date(),
        },
      });

      this.logger.warn(
        `⚡ Imbalance alert: facility=${data.facilityId} imbalance=${imbalance.toFixed(1)}% [${severity}]`,
      );
    } catch (error) {
      this.logger.error(`Failed to create imbalance alert: ${error.message}`);
    }
  }

  /**
   * 역률 저하 알림 생성
   */
  private async createPowerFactorAlert(
    data: { facilityId: string; avg_pf: number },
    threshold: number,
  ) {
    const pf = Number(data.avg_pf);

    // 중복 방지
    const duplicate = await this.findRecentAlert(data.facilityId, 'power_factor');
    if (duplicate) return;

    const severity = pf < 80 ? 'DANGER' : 'WARNING';

    try {
      await this.prisma.alert.create({
        data: {
          facilityId: data.facilityId,
          severity,
          type: 'POWER_QUALITY',
          message: `역률 ${pf.toFixed(1)}% (기준 ${threshold}%)`,
          value: pf,
          threshold,
          unit: '%',
          metadata: {
            powerFactor: pf,
            subType: 'power_factor',
          },
          detectedAt: new Date(),
        },
      });

      this.logger.warn(
        `⚡ Low PF alert: facility=${data.facilityId} PF=${pf.toFixed(1)}% [${severity}]`,
      );
    } catch (error) {
      this.logger.error(`Failed to create PF alert: ${error.message}`);
    }
  }

  /**
   * 중복 방지: 최근 N분 이내 동일 설비+subType 알림 확인
   */
  private async findRecentAlert(facilityId: string, subType: string) {
    const windowStart = new Date(Date.now() - this.DUPLICATE_WINDOW_MIN * 60 * 1000);

    return this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM alerts
      WHERE "facilityId" = ${facilityId}
        AND type = 'POWER_QUALITY'
        AND "detectedAt" >= ${windowStart}
        AND metadata->>'subType' = ${subType}
      LIMIT 1
    `.then(rows => rows.length > 0 ? rows[0] : null);
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
      const config = meta?.thresholds?.power_quality;
      if (config) {
        return { threshold1: config.threshold1, threshold2: config.threshold2 };
      }
    } catch {
      // ignore
    }
    return null;
  }
}
