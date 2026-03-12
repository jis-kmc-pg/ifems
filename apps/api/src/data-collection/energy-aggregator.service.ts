import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

/**
 * EnergyAggregatorService
 * 15분 단위 에너지 데이터 집계
 *
 * ⚠️ 참고: docs/TAG-DATA-SPEC.md
 * - USAGE: 차분 계산 (endValue - startValue)
 * - TREND: 마지막 값 또는 피크값
 * - OPERATE: 합 (가동 시간)
 * - SENSOR: 평균값
 */
@Injectable()
export class EnergyAggregatorService {
  private readonly logger = new Logger(EnergyAggregatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 15분마다 실행 (매시 0, 15, 30, 45분)
   */
  @Cron('0,15,30,45 * * * *')
  async aggregate15Minutes() {
    try {
      const endTime = new Date();
      endTime.setSeconds(0, 0); // 정각으로 맞춤

      const startTime = new Date(endTime.getTime() - 15 * 60 * 1000);

      this.logger.log(
        `📊 15분 집계 시작: ${startTime.toISOString()} ~ ${endTime.toISOString()}`,
      );

      await this.aggregateEnergyData(startTime, endTime);

      this.logger.log('✅ 15분 집계 완료');
    } catch (error) {
      this.logger.error('15분 집계 실패', error);
    }
  }

  /**
   * 에너지 데이터 집계 로직
   * facility_energy_configs 테이블을 참조하여 어떤 태그로 사용량을 계산할지 결정
   */
  private async aggregateEnergyData(startTime: Date, endTime: Date) {
    const facilities = await this.prisma.facility.findMany({
      include: {
        tags: true,
        energyConfigs: {
          where: { isActive: true },
          include: {
            configTags: {
              where: { isActive: true },
              include: { tag: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    for (const facility of facilities) {
      const elecConfig = facility.energyConfigs.find((c: any) => c.energyType === 'elec');
      const airConfig = facility.energyConfigs.find((c: any) => c.energyType === 'air');

      if (!elecConfig && !airConfig) continue;

      // ✅ 전력 사용량 집계 (configTags의 복수 태그 합산)
      const powerUsage = elecConfig
        ? await this.aggregateUsageByConfig(elecConfig, startTime, endTime)
        : null;

      // ✅ 에어 사용량 집계 (configTags의 복수 태그 합산)
      const airUsage = airConfig
        ? await this.aggregateUsageByConfig(airConfig, startTime, endTime)
        : null;

      // ✅ 순시 전력 피크값 (INSTANTANEOUS+ENERGY 태그 사용)
      const powerPeak = await this.getPeakDemand(
        facility.tags.filter((t: any) => t.energyType === 'elec' && t.measureType === 'INSTANTANEOUS'),
        startTime,
        endTime,
      );

      // 전력 품질 지표 집계
      const qualityData = await this.aggregateQualityMetrics(
        facility.tags,
        startTime,
        endTime,
      );

      // ✅ 데이터가 없으면 레코드 생성 안 함 (null이 아닌 빈 레코드 방지)
      if (powerUsage == null && airUsage == null && powerPeak == null) {
        continue; // 다음 설비로
      }

      // EnergyTimeseries에 저장
      await this.prisma.energyTimeseries.create({
        data: {
          timestamp: endTime,
          facilityId: facility.id,
          powerKwh: powerUsage ?? null,        // ✅ 적산 차분값
          powerPeak: powerPeak ?? null,         // ✅ 순시 피크값
          airL: airUsage ?? null,               // ✅ 적산 차분값
          imbalance: qualityData.imbalance,
          powerFactor: qualityData.powerFactor,
          voltage: qualityData.voltage,
          current: qualityData.current,
          frequency: qualityData.frequency,
          airPressure: qualityData.airPressure,
          airFlow: qualityData.airFlow,
          status: this.calculateFacilityStatus(qualityData),
        },
      });
    }
  }

  /**
   * 태그 데이터 집계 (sum, avg, min, max)
   */
  private async aggregateTagData(
    tagIds: string[],
    startTime: Date,
    endTime: Date,
  ) {
    if (tagIds.length === 0) return { sum: 0, avg: 0, min: 0, max: 0 };

    const result = await this.prisma.tagDataRaw.aggregate({
      where: {
        tagId: { in: tagIds },
        timestamp: { gte: startTime, lt: endTime },
        quality: 'GOOD',
      },
      _sum: { value: true },
      _avg: { value: true },
      _min: { value: true },
      _max: { value: true },
    });

    return {
      sum: result._sum.value || 0,
      avg: result._avg.value || 0,
      min: result._min.value || 0,
      max: result._max.value || 0,
    };
  }

  /**
   * 전력 품질 지표 집계
   */
  private async aggregateQualityMetrics(
    tags: any[],
    startTime: Date,
    endTime: Date,
  ) {
    const getAvgValue = async (displayNameKeyword: string) => {
      const tag = tags.find((t) => t.displayName.includes(displayNameKeyword));
      if (!tag) return null;

      const result = await this.prisma.tagDataRaw.aggregate({
        where: {
          tagId: tag.id,
          timestamp: { gte: startTime, lt: endTime },
          quality: 'GOOD',
        },
        _avg: { value: true },
      });

      return result._avg.value;
    };

    return {
      imbalance: await getAvgValue('불평형률'),
      powerFactor: await getAvgValue('역률'),
      voltage: await getAvgValue('전압'),
      current: await getAvgValue('전류'),
      frequency: await getAvgValue('주파수'),
      airPressure: await getAvgValue('압력'),
      airFlow: await getAvgValue('유량'),
    };
  }

  /**
   * ✅ 적산값 차분 계산 (USAGE 태그)
   * 예: 0분 120kWh, 15분 160kWh → 사용량 40kWh
   */
  private async aggregateUsageData(
    tagIds: string[],
    startTime: Date,
    endTime: Date,
  ): Promise<number | null> {
    if (tagIds.length === 0) return null;

    // 시작 시점의 값들
    const startValues = await this.getTagValuesAtTime(tagIds, startTime);
    // 종료 시점의 값들
    const endValues = await this.getTagValuesAtTime(tagIds, endTime);

    let totalUsage = 0;
    let hasData = false;

    for (const tagId of tagIds) {
      const startValue = startValues.get(tagId);
      const endValue = endValues.get(tagId);

      if (startValue !== undefined && endValue !== undefined) {
        const diff = endValue - startValue;
        if (diff >= 0) {
          // 차분이 음수가 아닌 경우만 (적산값은 증가만 함)
          totalUsage += diff;
          hasData = true;
        }
      }
    }

    return hasData ? totalUsage : null;
  }

  /**
   * ✅ facility_energy_config 기반 사용량 계산
   * configTags의 복수 태그를 합산
   * calcMethod에 따라 DIFF(적산 차분) 또는 INTEGRAL_TRAP(순시 적분) 수행
   */
  private async aggregateUsageByConfig(
    config: any,
    startTime: Date,
    endTime: Date,
  ): Promise<number | null> {
    const tagIds: string[] = (config.configTags || []).map((ct: any) => ct.tagId);
    if (tagIds.length === 0) return null;

    if (config.calcMethod === 'DIFF') {
      return this.aggregateUsageData(tagIds, startTime, endTime);
    }

    if (config.calcMethod === 'INTEGRAL_TRAP') {
      return this.integrateTrapezoidMulti(tagIds, startTime, endTime);
    }

    return null;
  }

  /**
   * ✅ 사다리꼴 적분법 (INTEGRAL_TRAP) - 복수 태그 합산
   * 각 순시 태그별 적분 후 합산하여 총 사용량 산출
   */
  private async integrateTrapezoidMulti(
    tagIds: string[],
    startTime: Date,
    endTime: Date,
  ): Promise<number | null> {
    let totalEnergy = 0;
    let hasData = false;

    for (const tagId of tagIds) {
      const dataPoints = await this.prisma.tagDataRaw.findMany({
        where: {
          tagId,
          timestamp: { gte: startTime, lt: endTime },
          quality: 'GOOD',
          value: { not: null },
        },
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true, value: true },
      });

      if (dataPoints.length < 2) continue;

      for (let i = 0; i < dataPoints.length - 1; i++) {
        const curr = dataPoints[i];
        const next = dataPoints[i + 1];
        const avgPower = ((curr.value ?? 0) + (next.value ?? 0)) / 2;
        const durationHours = (next.timestamp.getTime() - curr.timestamp.getTime()) / (1000 * 3600);
        totalEnergy += avgPower * durationHours;
      }
      hasData = true;
    }

    return hasData && totalEnergy > 0 ? totalEnergy : null;
  }

  /**
   * ✅ 순시 전력 피크값 조회 (INSTANTANEOUS 태그)
   */
  private async getPeakDemand(
    tags: any[],
    startTime: Date,
    endTime: Date,
  ): Promise<number | null> {
    if (tags.length === 0) return null;

    // 전력 관련 태그만 필터링 (displayName에 "전력", "kW" 포함)
    const demandTags = tags.filter(
      (t) =>
        t.displayName?.includes('전력') ||
        t.displayName?.includes('kW') ||
        t.unit === 'kW',
    );

    if (demandTags.length === 0) return null;

    const result = await this.prisma.tagDataRaw.aggregate({
      where: {
        tagId: { in: demandTags.map((t) => t.id) },
        timestamp: { gte: startTime, lt: endTime },
        quality: 'GOOD',
      },
      _max: { value: true },
    });

    return result._max.value;
  }

  /**
   * 특정 시점의 태그 값 조회 (적산 계산용)
   */
  private async getTagValuesAtTime(
    tagIds: string[],
    timestamp: Date,
  ): Promise<Map<string, number>> {
    const values = new Map<string, number>();

    for (const tagId of tagIds) {
      // timestamp 이전의 가장 최근 데이터 조회
      const data = await this.prisma.tagDataRaw.findFirst({
        where: {
          tagId,
          timestamp: { lte: timestamp },
          quality: 'GOOD',
        },
        orderBy: { timestamp: 'desc' },
      });

      if (data?.value !== null && data?.value !== undefined) {
        values.set(tagId, data.value);
      }
    }

    return values;
  }

  /**
   * ✅ 가동 시간 집계 (OPERATE 태그)
   * 예: 15분(900초) 중 720초 가동 → 80% 가동률
   */
  private async aggregateOperateTime(
    tagIds: string[],
    startTime: Date,
    endTime: Date,
  ): Promise<number | null> {
    if (tagIds.length === 0) return null;

    // OPERATE 태그는 0 또는 1 값
    // 모든 1 값을 합산 = 가동 시간(초)
    const result = await this.prisma.tagDataRaw.aggregate({
      where: {
        tagId: { in: tagIds },
        timestamp: { gte: startTime, lt: endTime },
        quality: 'GOOD',
      },
      _sum: { value: true },
      _count: true,
    });

    const operatingSeconds = result._sum.value || 0;
    const totalDataPoints = result._count;

    // 데이터가 없으면 null
    if (totalDataPoints === 0) return null;

    return operatingSeconds;
  }

  /**
   * ✅ 센서 평균값 집계 (SENSOR 태그)
   */
  private async aggregateSensorAverage(
    tagIds: string[],
    startTime: Date,
    endTime: Date,
  ): Promise<number | null> {
    if (tagIds.length === 0) return null;

    const result = await this.prisma.tagDataRaw.aggregate({
      where: {
        tagId: { in: tagIds },
        timestamp: { gte: startTime, lt: endTime },
        quality: 'GOOD',
      },
      _avg: { value: true },
    });

    return result._avg.value ?? null;
  }

  /**
   * 설비 상태 계산
   */
  private calculateFacilityStatus(qualityData: any): 'NORMAL' | 'WARNING' | 'DANGER' | 'OFFLINE' {
    // 불평형률 >= 5% → DANGER
    if (qualityData.imbalance && qualityData.imbalance >= 5) return 'DANGER';

    // 역률 < 0.85 → WARNING
    if (qualityData.powerFactor && qualityData.powerFactor < 0.85) return 'WARNING';

    // 불평형률 >= 3% → WARNING
    if (qualityData.imbalance && qualityData.imbalance >= 3) return 'WARNING';

    // 압력 < 5.5 bar → WARNING
    if (qualityData.airPressure && qualityData.airPressure < 5.5) return 'WARNING';

    return 'NORMAL';
  }
}
