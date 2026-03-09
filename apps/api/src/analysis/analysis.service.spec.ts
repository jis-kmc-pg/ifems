import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisService } from './analysis.service';
import { PrismaService } from '../prisma.service';

describe('AnalysisService', () => {
  let service: AnalysisService;
  let prisma: PrismaService;

  const mockPrismaService = {
    facility: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    cycleData: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    referenceCycle: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AnalysisService>(AnalysisService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFacilityTree', () => {
    it('should return hierarchical facility tree structure', async () => {
      // Arrange
      const mockFacilities = [
        {
          id: 'fac-1',
          code: 'HNK10-010-1',
          name: '소재투입1',
          lineId: 'line-1',
          line: { id: 'line-1', code: 'HNK10', name: '블록' },
        },
        {
          id: 'fac-2',
          code: 'HNK10-010-2',
          name: '소재투입2',
          lineId: 'line-1',
          line: { id: 'line-1', code: 'HNK10', name: '블록' },
        },
        {
          id: 'fac-3',
          code: 'HNK20-010-1',
          name: '헤드1',
          lineId: 'line-2',
          line: { id: 'line-2', code: 'HNK20', name: '헤드' },
        },
      ];

      mockPrismaService.facility.findMany.mockResolvedValue(mockFacilities);

      // Act
      const result = await service.getFacilityTree();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('plant');
      expect(result[0].label).toBe('4공장');
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children[0].label).toBe('블록');
      expect(result[0].children[0].children).toHaveLength(2);
      expect(result[0].children[1].label).toBe('헤드');
      expect(result[0].children[1].children).toHaveLength(1);
    });

    it('should handle empty facilities', async () => {
      // Arrange
      mockPrismaService.facility.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getFacilityTree();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(0);
    });
  });

  describe('getFacilityHourlyData', () => {
    it('should return 24-hour data for facility by code', async () => {
      // Arrange
      const mockCurrentData = [
        { hour: 9, value: 100 },
        { hour: 10, value: 120 },
        { hour: 11, value: 110 },
      ];

      const mockPrevData = [
        { hour: 9, value: 95 },
        { hour: 10, value: 115 },
        { hour: 11, value: 105 },
      ];

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce(mockCurrentData)
        .mockResolvedValueOnce(mockPrevData);

      // Act
      const result = await service.getFacilityHourlyData('HNK10-010-1', 'elec');

      // Assert
      expect(result).toHaveLength(24);
      expect(result[9].time).toBe('09:00');
      expect(result[9].current).toBe(100);
      expect(result[9].prev).toBe(95);
      expect(result[10].current).toBe(120);
      expect(result[11].prev).toBe(105);
    });

    it('should handle facility by UUID', async () => {
      // Arrange
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Act
      const result = await service.getFacilityHourlyData('uuid-123', 'air');

      // Assert
      expect(result).toHaveLength(24);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should handle specific date parameter', async () => {
      // Arrange
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ hour: 0, value: 50 }])
        .mockResolvedValueOnce([{ hour: 0, value: 45 }]);

      // Act
      const result = await service.getFacilityHourlyData('HNK10-010-1', 'elec', '2026-02-27');

      // Assert
      expect(result).toHaveLength(24);
      expect(result[0].current).toBe(50);
    });

    it('should fill missing hours with zero', async () => {
      // Arrange
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ hour: 5, value: 100 }])
        .mockResolvedValueOnce([]);

      // Act
      const result = await service.getFacilityHourlyData('HNK10-010-1', 'elec');

      // Assert
      expect(result[0].current).toBe(0);
      expect(result[5].current).toBe(100);
      expect(result[23].current).toBe(0);
    });
  });

  describe('getCycleList', () => {
    it('should return cycle list with similarity calculation', async () => {
      // Arrange
      const mockCycles = [
        {
          id: 'cycle-1',
          startTime: new Date('2026-02-28T10:00:00Z'),
          endTime: new Date('2026-02-28T10:06:00Z'),
          duration: 360,
          totalEnergy: 950,
          status: 'NORMAL',
          facility: { code: 'HNK10-010-1' },
        },
        {
          id: 'cycle-2',
          startTime: new Date('2026-02-28T09:00:00Z'),
          endTime: new Date('2026-02-28T09:07:00Z'),
          duration: 420,
          totalEnergy: 880,
          status: 'DELAYED',
          facility: { code: 'HNK10-010-1' },
        },
        {
          id: 'cycle-3',
          startTime: new Date('2026-02-28T08:00:00Z'),
          endTime: new Date('2026-02-28T08:06:30Z'),
          duration: 390,
          totalEnergy: 820,
          status: 'ANOMALY',
          facility: { code: 'HNK10-010-1' },
        },
      ];

      mockPrismaService.cycleData.findMany.mockResolvedValue(mockCycles);

      // Act
      const result = await service.getCycleList('HNK10-010-1');

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('cycle-1');
      expect(result[0].similarity).toBe(95);
      expect(result[0].status).toBe('normal');
      expect(result[1].similarity).toBe(80); // DELAYED
      expect(result[2].similarity).toBe(65); // ANOMALY
    });

    it('should filter by facility UUID', async () => {
      // Arrange
      mockPrismaService.cycleData.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getCycleList('uuid-facility-123');

      // Assert
      expect(prisma.cycleData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            facilityId: 'uuid-facility-123',
          }),
        })
      );
    });

    it('should return all cycles when no facilityId provided', async () => {
      // Arrange
      mockPrismaService.cycleData.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getCycleList();

      // Assert
      expect(prisma.cycleData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('getCycleWaveform', () => {
    it('should return cycle waveform data from database', async () => {
      // Arrange
      const mockWaveform = Array.from({ length: 360 }, (_, i) => ({
        sec: i,
        value: 850 + Math.sin(i * 0.087) * 80,
      }));

      const mockCycle = {
        id: 'cycle-1',
        waveform: mockWaveform,
      };

      mockPrismaService.cycleData.findUnique.mockResolvedValue(mockCycle);

      // Act
      const result = await service.getCycleWaveform('cycle-1', false);

      // Assert
      expect(result).toHaveLength(360);
      expect(result[0].sec).toBe(0);
      expect(result[0].value).toBeDefined();
    });

    it('should return reference cycle waveform', async () => {
      // Arrange
      const mockWaveform = Array.from({ length: 360 }, (_, i) => ({
        sec: i,
        value: 850 + Math.sin(i * 0.087) * 80,
      }));

      const mockReferenceCycle = {
        facilityId: 'facility-1',
        waveform: mockWaveform,
      };

      mockPrismaService.referenceCycle.findUnique.mockResolvedValue(mockReferenceCycle);

      // Act
      const result = await service.getCycleWaveform('facility-1', true);

      // Assert
      expect(result).toHaveLength(360);
      expect(result[0].sec).toBe(0);
    });

    it('should generate default waveform when data not found', async () => {
      // Arrange
      mockPrismaService.cycleData.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.getCycleWaveform('cycle-not-found', false);

      // Assert
      expect(result).toHaveLength(360);
      expect(result[0].sec).toBe(0);
      expect(result[0].value).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPowerQualityAnalysis', () => {
    it('should return power quality data for multiple facilities', async () => {
      // Arrange
      const mockData1 = Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        current: 100 + i * 5,
        prev: 95 + i * 5,
      }));

      const mockData2 = Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        current: 90 + i * 4,
        prev: 85 + i * 4,
      }));

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ hour: 0, value: 100 }])
        .mockResolvedValueOnce([{ hour: 0, value: 95 }])
        .mockResolvedValueOnce([{ hour: 0, value: 90 }])
        .mockResolvedValueOnce([{ hour: 0, value: 85 }]);

      // Act
      const result = await service.getPowerQualityAnalysis(['HNK10-010-1', 'HNK10-010-2']);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(24);
      expect(result[1]).toHaveLength(24);
    });

    it('should handle empty facility list', async () => {
      // Act
      const result = await service.getPowerQualityAnalysis([]);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should pass date parameter to getFacilityHourlyData', async () => {
      // Arrange
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Act
      await service.getPowerQualityAnalysis(['HNK10-010-1'], '2026-02-27');

      // Assert
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });
});
