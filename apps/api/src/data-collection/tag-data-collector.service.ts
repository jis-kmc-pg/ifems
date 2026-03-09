import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * TagDataCollectorService
 * Mock 데이터 생성기 - 10초 주기로 태그 데이터 생성
 */
@Injectable()
export class TagDataCollectorService implements OnModuleInit {
  private readonly logger = new Logger(TagDataCollectorService.name);
  private isCollecting = false;
  private collectionInterval: NodeJS.Timeout | null = null;
  private cumulativeValues = new Map<string, number>(); // 적산값 저장 (태그별 누적)
  private cachedTags: any[] | null = null; // 태그 캐싱 (매번 재조회 방지)

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') {
      await this.loadCumulativeValues();
      this.logger.log('🚀 Mock 데이터 수집 시작 (10초 주기)');
      await this.startCollection();
    }
  }

  /** DB에서 CUMULATIVE 태그의 마지막 적산값을 로드하여 이어서 수집 */
  private async loadCumulativeValues() {
    try {
      const lastValues = await this.prisma.$queryRawUnsafe<
        Array<{ tagId: string; lastValue: number }>
      >(`
        SELECT DISTINCT ON (t."tagId") t."tagId" as "tagId", t."numericValue" as "lastValue"
        FROM tag_data_raw t
        JOIN tags tag ON t."tagId" = tag.id
        WHERE tag."measureType" = 'CUMULATIVE'
          AND t."numericValue" IS NOT NULL
        ORDER BY t."tagId", t."timestamp" DESC
      `);

      for (const row of lastValues) {
        this.cumulativeValues.set(row.tagId, Number(row.lastValue));
      }

      this.logger.log(`📈 적산값 ${lastValues.length}개 태그 복원 완료 (DB 마지막 값 기준)`);
    } catch (error) {
      this.logger.warn('적산값 복원 실패, 0부터 시작합니다', error);
    }
  }

  async startCollection() {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.collectionInterval = setInterval(async () => {
      await this.collectData();
    }, 10000); // 10초 주기 (3,102개 Tag 처리 시간 고려)
  }

  stopCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      this.isCollecting = false;
    }
  }

  private async loadTags() {
    if (!this.cachedTags) {
      this.cachedTags = await this.prisma.tag.findMany({
        where: { isActive: true },
        select: {
          id: true,
          tagName: true,
          energyType: true,
          measureType: true,
          category: true,
          displayName: true,
          unit: true,
        },
      });
      this.logger.log(`📋 태그 ${this.cachedTags.length}개 캐싱 완료`);
    }
    return this.cachedTags;
  }

  /** 태그 캐시 무효화 (설정 변경 시) */
  invalidateTagCache() {
    this.cachedTags = null;
  }

  private async collectData() {
    try {
      const timestamp = new Date();
      const tags = await this.loadTags();

      if (tags.length === 0) return;

      const tagDataBatch = tags.map((tag) => ({
        timestamp,
        tagId: tag.id,
        numericValue: this.generateMockValue(tag),
        quality: 'GOOD' as const,
        collectorId: 'MOCK_COLLECTOR',
      }));

      await this.prisma.tagDataRaw.createMany({
        data: tagDataBatch,
        skipDuplicates: true,
      });

      // 매 분(0초)마다 로그, 첫 수집은 항상 로그
      const sec = timestamp.getSeconds();
      if (sec < 10) {
        const total = await this.prisma.tagDataRaw.count();
        this.logger.log(`📊 ${timestamp.toLocaleTimeString('ko-KR')} | 삽입: ${tagDataBatch.length}행 | 누적: ${total.toLocaleString()}행`);
      }
    } catch (error) {
      this.logger.error('데이터 수집 에러', error);
    }
  }

  /**
   * Mock 데이터 생성
   * 참고: docs/TAG-DATA-SPEC.md
   */
  private generateMockValue(tag: any): number {
    const { id, energyType, measureType, category } = tag;
    const hour = new Date().getHours();
    const timeMultiplier = 0.5 + Math.sin((hour / 24) * Math.PI * 2) * 0.5;

    // ✅ CUMULATIVE (적산값): 누적 증가
    if (measureType === 'CUMULATIVE') {
      if (!this.cumulativeValues.has(id)) {
        const initialValue = 0;
        this.cumulativeValues.set(id, initialValue);
      }

      const currentValue = this.cumulativeValues.get(id)!;
      const baseIncrement = energyType === 'elec'
        ? 0.01 + Math.random() * 0.04  // 0.01~0.05 kWh/초
        : 0.1 + Math.random() * 0.4;   // 0.1~0.5 m³/초

      const increment = baseIncrement * timeMultiplier;
      const newValue = currentValue + increment;
      this.cumulativeValues.set(id, newValue);

      return newValue;
    }

    // ✅ INSTANTANEOUS + ENERGY (에너지 순시값): 실시간 변동값
    if (measureType === 'INSTANTANEOUS' && category === 'ENERGY') {
      const baseValue = energyType === 'elec'
        ? 50 + Math.random() * 50    // 50~100 kW
        : 20 + Math.random() * 30;   // 20~50 m³/min

      const variation = (Math.random() - 0.5) * 10; // ±5
      return Math.max(0, baseValue * timeMultiplier + variation);
    }

    // ✅ INSTANTANEOUS + QUALITY (품질 순시값): tagName 패턴으로 구분
    if (measureType === 'INSTANTANEOUS' && category === 'QUALITY') {
      const tagName: string = tag.tagName ?? '';
      // 역률 태그 (_PF, _PF1, _PF2 등): 85~99%
      if (/PF/i.test(tagName)) {
        return 85 + Math.random() * 14; // 85~99%
      }
      // 3상 전류 태그 (_A, _B, _C): 설비별 안정적 기저값 + 상간 편차 ±2%
      const prefix = tagName.replace(/_(A|B|C)$/i, '');
      const minute = Math.floor(Date.now() / 60000);
      let hash = 0;
      for (let i = 0; i < prefix.length; i++) hash = ((hash << 5) - hash + prefix.charCodeAt(i)) | 0;
      const base = 45 + (Math.abs(hash) % 20) + Math.sin(minute * 0.1 + (Math.abs(hash) % 100)) * 5;
      const phaseOffset = (Math.random() - 0.5) * base * 0.04; // ±2%
      return Math.max(0, base + phaseOffset);
    }

    // ✅ DISCRETE (이산값): 가동 0 또는 1
    if (measureType === 'DISCRETE') {
      const operatingProbability = (hour >= 8 && hour < 18) ? 0.8 : 0.5;
      return Math.random() < operatingProbability ? 1 : 0;
    }

    // ✅ INSTANTANEOUS + ENVIRONMENT (환경 센서): 평균값 기준 변동
    if (measureType === 'INSTANTANEOUS' && category === 'ENVIRONMENT') {
      if (energyType === 'air') {
        // 압력: 5~7 bar
        if (tag.displayName?.includes('압력')) {
          return 6.0 + (Math.random() - 0.5) * 2;
        }
        // 온도: 23~27°C
        return 25.0 + (Math.random() - 0.5) * 4;
      }
      // 기타 센서: 평균 50, 변동 ±10
      return 50 + (Math.random() - 0.5) * 20;
    }

    // CONTROL은 저장하지만 표시하지 않음
    return 0;
  }

  getStatus() {
    return {
      isCollecting: this.isCollecting,
      collectorId: 'MOCK_COLLECTOR',
      interval: '10 seconds',
    };
  }
}
