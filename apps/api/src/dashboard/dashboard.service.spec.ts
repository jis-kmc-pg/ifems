import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    facility: {
      findMany: jest.fn(),
    },
    cycleData: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEnergyTrend', () => {
    it('should return 7-day energy trend with previous month comparison', async () => {
      // Arrange
      const mockDailyData = [
        { date: new Date('2026-02-21'), power: 1000, air: 500000 },
        { date: new Date('2026-02-22'), power: 1100, air: 550000 },
        { date: new Date('2026-02-23'), power: 1050, air: 520000 },
      ];

      const mockPrevMonthData = [
        { date: new Date('2026-01-21'), power: 950, air: 480000 },
        { date: new Date('2026-01-22'), power: 1000, air: 500000 },
        { date: new Date('2026-01-23'), power: 980, air: 490000 },
      ];

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce(mockDailyData)
        .mockResolvedValueOnce(mockPrevMonthData);

      // Act
      const result = await service.getEnergyTrend();

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].date).toBe('2026-02-21');
      expect(result[0].power).toBe(1000);
      expect(result[0].air).toBe(500000);
      expect(result[0].prevPower).toBe(950);
      expect(result[0].prevAir).toBe(480000);
      expect(result[0].powerTarget).toBe(18000);
      expect(result[0].airTarget).toBe(12000);
    });

    it('should filter by line when line parameter is provided', async () => {
      // Arrange
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Act
      const result = await service.getEnergyTrend('BLOCK');

      // Assert
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]);
    });

    it('should handle empty data gracefully', async () => {
      // Arrange
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Act
      const result = await service.getEnergyTrend();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getProcessRanking', () => {
    it('should return process ranking with previous day comparison', async () => {
      // Arrange
      const mockRanking = [
        { process: 'OP10', power: 2000, air: 1000000 },
        { process: 'OP20', power: 1800, air: 900000 },
        { process: 'OP30', power: 1500, air: 800000 },
      ];

      const mockPrevRanking = [
        { process: 'OP10', power: 1900, air: 950000 },
        { process: 'OP20', power: 1700, air: 850000 },
        { process: 'OP30', power: 1400, air: 750000 },
      ];

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce(mockRanking)
        .mockResolvedValueOnce(mockPrevRanking);

      // Act
      const result = await service.getProcessRanking();

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].process).toBe('OP10');
      expect(result[0].power).toBe(2000);
      expect(result[0].prevPower).toBe(1900);
      expect(result[1].process).toBe('OP20');
      expect(result[2].process).toBe('OP30');
    });

    it('should filter by line when provided', async () => {
      // Arrange
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Act
      const result = await service.getProcessRanking('HEAD');

      // Assert
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should use type parameter', async () => {
      // Arrange
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Act
      const result = await service.getProcessRanking('BLOCK', 'air');

      // Assert
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCycleRanking', () => {
    it('should return top 10 facilities by cycle energy', async () => {
      // Arrange
      const mockFacilities = [
        { code: 'HNK10-010-1', process: 'OP10', avg_power: 950 },
        { code: 'HNK10-010-2', process: 'OP10', avg_power: 920 },
      ];

      const mockCycleStats = [
        { duration: 360, totalEnergy: 950 },
        { duration: 370, totalEnergy: 960 },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockFacilities);
      mockPrismaService.cycleData.findMany.mockResolvedValue(mockCycleStats);

      // Act
      const result = await service.getCycleRanking();

      // Assert
      expect(result).toBeDefined();
      expect(result[0].rank).toBe(1);
      expect(result[0].code).toBe('HNK10-010-1');
      expect(result[0].cycleEnergy).toBe(950);
      expect(result[0].cycleTime).toBe(365); // average
      expect(result[0].status).toBeDefined();
    });

    it('should filter by line parameter', async () => {
      // Arrange
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await service.getCycleRanking('BLOCK');

      // Assert
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should calculate deviation and determine status', async () => {
      // Arrange
      const mockFacilities = [
        { code: 'HNK10-010-1', process: 'OP10', avg_power: 950 },
      ];

      const mockCycleStats = [
        { duration: 360, totalEnergy: 930 },
        { duration: 370, totalEnergy: 970 },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockFacilities);
      mockPrismaService.cycleData.findMany.mockResolvedValue(mockCycleStats);

      // Act
      const result = await service.getCycleRanking();

      // Assert
      expect(result[0].deviation).toBeDefined();
      expect(result[0].status).toMatch(/NORMAL|WARNING|DANGER/);
    });
  });

  describe('getEnergyChangeTopN', () => {
    it('should return top N facilities with highest energy change', async () => {
      // Arrange
      const mockChanges = [
        {
          code: 'HNK10-010-1',
          name: '소재투입1',
          current_value: 1200,
          previous_value: 1000,
          prevMonthChange: 20,
        },
        {
          code: 'HNK10-010-2',
          name: '소재투입2',
          current_value: 900,
          previous_value: 1000,
          prevMonthChange: -10,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockChanges);

      // Act
      const result = await service.getEnergyChangeTopN(8, 'elec');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('HNK10-010-1');
      expect(result[0].prevMonthChange).toBe(20);
      expect(result[0].prevYearChange).toBe(26); // 20 * 1.3
      expect(result[1].prevMonthChange).toBe(-10);
    });

    it('should default to 8 items when topN is not provided', async () => {
      // Arrange
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await service.getEnergyChangeTopN();

      // Assert
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should handle air type parameter', async () => {
      // Arrange
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await service.getEnergyChangeTopN(10, 'air');

      // Assert
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('getFacilityList', () => {
    it('should return all facilities when no line filter', async () => {
      // Arrange
      const mockFacilities = [
        { id: 'fac-1', code: 'HNK10-010-1', name: '소재투입1' },
        { id: 'fac-2', code: 'HNK10-010-2', name: '소재투입2' },
      ];

      mockPrismaService.facility.findMany.mockResolvedValue(mockFacilities);

      // Act
      const result = await service.getFacilityList();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('fac-1');
      expect(result[0].code).toBe('HNK10-010-1');
    });

    it('should filter facilities by line', async () => {
      // Arrange
      const mockFacilities = [
        { id: 'fac-1', code: 'HNK10-010-1', name: '소재투입1' },
      ];

      mockPrismaService.facility.findMany.mockResolvedValue(mockFacilities);

      // Act
      const result = await service.getFacilityList('BLOCK');

      // Assert
      expect(prisma.facility.findMany).toHaveBeenCalledWith({
        where: { line: { code: 'BLOCK' } },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });
});
