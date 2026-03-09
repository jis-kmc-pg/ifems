import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../prisma.service';
import { IntervalEnum } from './types/interval.enum';
import { BadRequestException } from '@nestjs/common';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let prisma: PrismaService;

  const mockPrismaService = {
    energyTimeseries: {
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    facility: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverviewKpi', () => {
    it('should return overview KPI data with correct structure', async () => {
      // Arrange
      const mockTodayData = {
        _sum: { powerKwh: 1500, airL: 2000000 },
        _avg: { powerFactor: 0.95 },
      };
      const mockYesterdayData = {
        _sum: { powerKwh: 1400, airL: 1800000 },
      };

      mockPrismaService.energyTimeseries.aggregate
        .mockResolvedValueOnce(mockTodayData) // today data
        .mockResolvedValueOnce(mockYesterdayData); // yesterday data

      mockPrismaService.energyTimeseries.count
        .mockResolvedValueOnce(5) // active alarms
        .mockResolvedValueOnce(2) // critical alarms
        .mockResolvedValueOnce(4) // yesterday alarms
        .mockResolvedValueOnce(1); // yesterday critical alarms

      // Act
      const result = await service.getOverviewKpi();

      // Assert
      expect(result).toBeDefined();
      expect(result.totalPower).toBeDefined();
      expect(result.totalPower.value).toBe(1500);
      expect(result.totalPower.unit).toBe('kWh');
      expect(result.totalPower.inverseChange).toBe(true);
      expect(result.totalAir).toBeDefined();
      expect(result.totalAir.value).toBe(2); // 2000000 L -> 2 ML
      expect(result.totalAir.unit).toBe('ML');
      expect(result.powerQualityAlarms.value).toBe(5);
      expect(result.airLeakAlarms.value).toBe(2);
    });

    it('should handle zero values without division by zero error', async () => {
      // Arrange
      const mockTodayData = {
        _sum: { powerKwh: 0, airL: 0 },
        _avg: { powerFactor: 0 },
      };
      const mockYesterdayData = {
        _sum: { powerKwh: 0, airL: 0 },
      };

      mockPrismaService.energyTimeseries.aggregate
        .mockResolvedValueOnce(mockTodayData)
        .mockResolvedValueOnce(mockYesterdayData);

      mockPrismaService.energyTimeseries.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      // Act
      const result = await service.getOverviewKpi();

      // Assert
      expect(result.totalPower.value).toBe(0);
      expect(result.totalAir.value).toBe(0);
      expect(result.powerQualityAlarms.value).toBe(0);
      expect(result.airLeakAlarms.value).toBe(0);
    });
  });

  describe('getLineMiniCards', () => {
    it('should return line mini cards with aggregated data', async () => {
      // Arrange
      const mockLineData = [
        {
          line: 'BLOCK',
          lineName: '블록',
          totalPower: 5000,
          totalAir: 3000000,
          dangerCount: 1,
          warningCount: 2,
        },
        {
          line: 'HEAD',
          lineName: '헤드',
          totalPower: 4000,
          totalAir: 2500000,
          dangerCount: 0,
          warningCount: 1,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockLineData);

      // Act
      const result = await service.getLineMiniCards();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('block');
      expect(result[0].label).toBe('블록');
      expect(result[0].power).toBe(5); // 5000 kWh -> 5 MWh
      expect(result[0].air).toBe(3); // 3000000 L -> 3 ML
      expect(result[0].powerStatus).toBe('DANGER');
      expect(result[0].airStatus).toBe('DANGER');
      expect(result[1].id).toBe('head');
      expect(result[1].powerStatus).toBe('WARNING');
    });

    it('should handle empty line data', async () => {
      // Arrange
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await service.getLineMiniCards();

      // Assert
      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });
  });

  describe('getHourlyTrend', () => {
    it('should return hourly trend data for today when date is not provided', async () => {
      // Arrange
      const mockCurrentData = [
        { hour: 0, totalPower: 100, totalAir: 50000 },
        { hour: 1, totalPower: 120, totalAir: 60000 },
      ];
      const mockPrevData = [
        { hour: 0, totalPower: 90, totalAir: 45000 },
        { hour: 1, totalPower: 110, totalAir: 55000 },
      ];

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce(mockCurrentData)
        .mockResolvedValueOnce(mockPrevData);

      // Act
      const result = await service.getHourlyTrend();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(96); // 24 hours * 4 (15min intervals)
      expect(result[0].time).toBe('00:00');
      expect(result[0].current).toBe(25); // 100 / 4
      expect(result[0].prev).toBe(22.5); // 90 / 4
    });

    it('should return hourly trend data for specific date', async () => {
      // Arrange
      const mockCurrentData = [
        { hour: 10, totalPower: 200, totalAir: 100000 },
      ];
      const mockPrevData = [
        { hour: 10, totalPower: 180, totalAir: 90000 },
      ];

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce(mockCurrentData)
        .mockResolvedValueOnce(mockPrevData);

      // Act
      const result = await service.getHourlyTrend('2026-02-28');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(96);
      const tenAmSlot = result.find(r => r.time === '10:00');
      expect(tenAmSlot.current).toBe(50); // 200 / 4
      expect(tenAmSlot.prev).toBe(45); // 180 / 4
    });

    it('should handle null values in data', async () => {
      // Arrange
      const mockCurrentData = [
        { hour: 0, totalPower: null, totalAir: null },
      ];
      const mockPrevData = [];

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce(mockCurrentData)
        .mockResolvedValueOnce(mockPrevData);

      // Act
      const result = await service.getHourlyTrend();

      // Assert
      expect(result[0].current).toBeNull();
      expect(result[0].prev).toBeNull();
    });
  });

  describe('getEnergyRanking', () => {
    it('should return energy ranking with rank changes', async () => {
      // Arrange
      const mockRanking = [
        {
          facilityId: 'fac-1',
          code: 'HNK10-010-1',
          name: '소재투입1',
          process: 'OP10',
          status: 'NORMAL',
          isProcessing: true,
          dailyElec: 500,
          weeklyElec: 3000,
          dailyAir: 200000,
          weeklyAir: 1000000,
          prevDailyElec: 450,
          prevDailyAir: 180000,
        },
        {
          facilityId: 'fac-2',
          code: 'HNK10-010-2',
          name: '소재투입2',
          process: 'OP10',
          status: 'NORMAL',
          isProcessing: true,
          dailyElec: 480,
          weeklyElec: 2900,
          dailyAir: 190000,
          weeklyAir: 950000,
          prevDailyElec: 490,
          prevDailyAir: 200000,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockRanking);

      // Act
      const result = await service.getEnergyRanking('BLOCK', 'elec');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('HNK10-010-1');
      expect(result[0].rankElec).toBe(1);
      expect(result[0].rankChangeElec).toBe(1); // prevRank 2 - currRank 1 = 1 (moved up)
      expect(result[1].rankElec).toBe(2);
      expect(result[1].rankChangeElec).toBe(-1); // prevRank 1 - currRank 2 = -1 (moved down)
    });

    it('should handle line and type parameters', async () => {
      // Arrange
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await service.getEnergyRanking('HEAD', 'air');

      // Assert
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('fetchRangeData', () => {
    it('should return range data with correct metadata', async () => {
      // Arrange
      const mockFacility = {
        id: 'facility-uuid',
        code: 'HNK10-010-1',
      };

      const mockData = [
        { time: '00:00:00', power: 100, prevPower: 90 },
        { time: '00:15:00', power: 110, prevPower: 95 },
      ];

      mockPrismaService.facility.findUnique.mockResolvedValue(mockFacility);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockData);

      const query = {
        startTime: '2026-02-28T00:00:00Z',
        endTime: '2026-02-28T01:00:00Z',
        interval: IntervalEnum.FIFTEEN_MIN,
        maxPoints: 100,
      };

      // Act
      const result = await service.fetchRangeData('HNK10-010-1', 'power', query);

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.interval).toBe(IntervalEnum.FIFTEEN_MIN);
      expect(result.metadata.facilityId).toBe('HNK10-010-1');
      expect(result.metadata.metric).toBe('power');
      expect(result.metadata.totalPoints).toBe(2);
    });

    it('should throw error for invalid time range', async () => {
      // Arrange
      const query = {
        startTime: '2026-02-28T10:00:00Z',
        endTime: '2026-02-28T08:00:00Z', // end before start
        interval: IntervalEnum.FIFTEEN_MIN,
      };

      // Act & Assert
      await expect(
        service.fetchRangeData('HNK10-010-1', 'power', query)
      ).rejects.toThrow();
    });

    it('should throw error for invalid date format', async () => {
      // Arrange
      const query = {
        startTime: 'invalid-date',
        endTime: '2026-02-28T10:00:00Z',
        interval: IntervalEnum.FIFTEEN_MIN,
      };

      // Act & Assert
      await expect(
        service.fetchRangeData('HNK10-010-1', 'power', query)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for non-existent facility', async () => {
      // Arrange
      mockPrismaService.facility.findUnique.mockResolvedValue(null);

      const query = {
        startTime: '2026-02-28T00:00:00Z',
        endTime: '2026-02-28T01:00:00Z',
        interval: IntervalEnum.FIFTEEN_MIN,
      };

      // Act & Assert
      await expect(
        service.fetchRangeData('NON-EXISTENT', 'power', query)
      ).rejects.toThrow();
    });

    it('should downsample data when exceeding maxPoints', async () => {
      // Arrange
      const mockFacility = {
        id: 'facility-uuid',
        code: 'HNK10-010-1',
      };

      // Generate 200 data points
      const mockData = Array.from({ length: 200 }, (_, i) => ({
        time: `00:${String(i).padStart(2, '0')}:00`,
        power: 100 + i,
        prevPower: 90 + i,
      }));

      mockPrismaService.facility.findUnique.mockResolvedValue(mockFacility);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockData);

      const query = {
        startTime: '2026-02-28T00:00:00Z',
        endTime: '2026-02-28T01:00:00Z',
        interval: IntervalEnum.FIFTEEN_MIN,
        maxPoints: 50,
      };

      // Act
      const result = await service.fetchRangeData('HNK10-010-1', 'power', query);

      // Assert
      expect(result.data.length).toBeLessThanOrEqual(50);
      expect(result.metadata.downsampled).toBe(true);
      expect(result.metadata.totalPoints).toBe(200);
      expect(result.metadata.returnedPoints).toBeLessThanOrEqual(50);
    });
  });

  describe('getAlarmSummary', () => {
    it('should return alarm summary by line', async () => {
      // Arrange
      const mockAlarmData = [
        {
          line: '블록',
          line_order: 1,
          powerQuality: 5,
          airLeak: 3,
        },
        {
          line: '헤드',
          line_order: 2,
          powerQuality: 2,
          airLeak: 1,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockAlarmData);

      // Act
      const result = await service.getAlarmSummary();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].line).toBe('블록');
      expect(result[0].powerQuality).toBe(5);
      expect(result[0].airLeak).toBe(3);
      expect(result[0].total).toBe(8);
      expect(result[1].total).toBe(3);
    });
  });
});
