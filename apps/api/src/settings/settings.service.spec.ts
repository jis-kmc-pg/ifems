import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    facility: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    factory: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    line: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tag: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getThresholdSettings', () => {
    it('should return threshold settings for power_quality category', async () => {
      // Arrange
      const mockFacilities = [
        {
          id: 'fac-1',
          code: 'HNK10-010-1',
          name: '소재투입1',
          process: 'OP10',
          type: 'MC-100',
          line: { code: 'HNK10', name: '블록' },
        },
        {
          id: 'fac-2',
          code: 'HNK10-010-2',
          name: '소재투입2',
          process: 'OP10',
          type: 'MC-100',
          line: { code: 'HNK10', name: '블록' },
        },
      ];

      mockPrismaService.facility.findMany.mockResolvedValue(mockFacilities);

      // Act
      const result = await service.getThresholdSettings('power_quality');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].facilityId).toBe('fac-1');
      expect(result[0].code).toBe('HNK10-010-1');
      expect(result[0].threshold1).toBe(5.0); // power_quality default
      expect(result[0].threshold2).toBe(85);
      expect(result[0].enabled).toBe(true);
    });

    it('should return different defaults for air_leak category', async () => {
      // Arrange
      const mockFacilities = [
        {
          id: 'fac-1',
          code: 'HNK10-010-1',
          name: '소재투입1',
          process: 'OP10',
          type: 'MC-100',
          line: { code: 'HNK10', name: '블록' },
        },
      ];

      mockPrismaService.facility.findMany.mockResolvedValue(mockFacilities);

      // Act
      const result = await service.getThresholdSettings('air_leak');

      // Assert
      expect(result[0].threshold1).toBe(5000);
      expect(result[0].threshold2).toBe(20);
    });

    it('should handle null process with default OP00', async () => {
      // Arrange
      const mockFacilities = [
        {
          id: 'fac-1',
          code: 'HNK10-000',
          name: 'Main',
          process: null,
          type: 'MAIN',
          line: { code: 'HNK10', name: '블록' },
        },
      ];

      mockPrismaService.facility.findMany.mockResolvedValue(mockFacilities);

      // Act
      const result = await service.getThresholdSettings('cycle_alert');

      // Assert
      expect(result[0].process).toBe('OP00');
    });
  });

  describe('saveThresholdSettings', () => {
    it('should save threshold settings to facility metadata', async () => {
      // Arrange
      const rows = [
        {
          facilityId: 'fac-1',
          threshold1: 6.0,
          threshold2: 90,
        },
        {
          facilityId: 'fac-2',
          threshold1: 5.5,
          threshold2: 88,
        },
      ];

      mockPrismaService.facility.findUnique.mockResolvedValue({
        id: 'fac-1',
        metadata: {},
      });
      mockPrismaService.$executeRaw.mockResolvedValue(1);

      // Act
      const result = await service.saveThresholdSettings('power_quality', rows);

      // Assert
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('should preserve existing metadata when updating', async () => {
      // Arrange
      const rows = [
        {
          facilityId: 'fac-1',
          threshold1: 7.0,
          threshold2: 92,
        },
      ];

      mockPrismaService.facility.findUnique.mockResolvedValue({
        id: 'fac-1',
        metadata: {
          customField: 'value',
          thresholds: {
            air_leak: { threshold1: 5000, threshold2: 20 },
          },
        },
      });
      mockPrismaService.$executeRaw.mockResolvedValue(1);

      // Act
      await service.saveThresholdSettings('power_quality', rows);

      // Assert
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('getFactoryList', () => {
    it('should return factory list with line counts', async () => {
      // Arrange
      const mockFactories = [
        {
          id: 'factory-1',
          code: 'PT4',
          name: '4공장',
          fullName: '화성 PT4공장',
          location: '화성',
          isActive: true,
          _count: { lines: 4 },
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-02-01'),
        },
      ];

      mockPrismaService.factory.findMany.mockResolvedValue(mockFactories);

      // Act
      const result = await service.getFactoryList();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('PT4');
      expect(result[0].lineCount).toBe(4);
    });

    it('should handle empty factory list', async () => {
      // Arrange
      mockPrismaService.factory.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getFactoryList();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getLineList', () => {
    it('should return all lines when no factory filter', async () => {
      // Arrange
      const mockLines = [
        {
          id: 'line-1',
          code: 'HNK10',
          name: '블록',
          factoryId: 'factory-1',
          factory: { code: 'PT4', name: '4공장' },
          order: 1,
          isActive: true,
          _count: { facilities: 15 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'line-2',
          code: 'HNK20',
          name: '헤드',
          factoryId: 'factory-1',
          factory: { code: 'PT4', name: '4공장' },
          order: 2,
          isActive: true,
          _count: { facilities: 12 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.line.findMany.mockResolvedValue(mockLines);

      // Act
      const result = await service.getLineList();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('HNK10');
      expect(result[0].facilityCount).toBe(15);
      expect(result[1].facilityCount).toBe(12);
    });

    it('should filter lines by factoryId', async () => {
      // Arrange
      mockPrismaService.line.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getLineList('factory-1');

      // Assert
      expect(prisma.line.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { factoryId: 'factory-1' },
        })
      );
    });
  });

  describe('getTagList', () => {
    it('should return paginated tag list with facility info', async () => {
      // Arrange
      const mockTags = [
        {
          id: 'tag-1',
          tagName: 'HNK10_010_1_POWER_1',
          displayName: '전력 사용량',
          measureType: 'CUMULATIVE',
          category: 'ENERGY',
          energyType: 'elec',
          unit: 'kWh',
          order: 1,
          isActive: true,
          facilityId: 'fac-1',
          facility: {
            code: 'HNK10-010-1',
            name: '소재투입1',
            line: {
              code: 'HNK10',
              name: '블록',
              factory: {
                code: 'PT4',
                name: '4공장',
              },
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.tag.findMany.mockResolvedValue(mockTags);
      mockPrismaService.tag.count.mockResolvedValue(100);

      // Act
      const result = await service.getTagList({ page: 1, pageSize: 50 });

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].tagName).toBe('HNK10_010_1_POWER_1');
      expect(result.data[0].facilityCode).toBe('HNK10-010-1');
      expect(result.data[0].lineCode).toBe('HNK10');
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should filter tags by facilityId', async () => {
      // Arrange
      mockPrismaService.tag.findMany.mockResolvedValue([]);
      mockPrismaService.tag.count.mockResolvedValue(0);

      // Act
      await service.getTagList({ facilityId: 'fac-1' });

      // Assert
      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            facilityId: 'fac-1',
          }),
        })
      );
    });

    it('should filter tags by measureType and energyType', async () => {
      // Arrange
      mockPrismaService.tag.findMany.mockResolvedValue([]);
      mockPrismaService.tag.count.mockResolvedValue(0);

      // Act
      await service.getTagList({ measureType: 'CUMULATIVE', energyType: 'elec' });

      // Assert
      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            measureType: 'CUMULATIVE',
            energyType: 'elec',
          }),
        })
      );
    });

    it('should search tags by name', async () => {
      // Arrange
      mockPrismaService.tag.findMany.mockResolvedValue([]);
      mockPrismaService.tag.count.mockResolvedValue(0);

      // Act
      await service.getTagList({ search: 'POWER' });

      // Assert
      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('getReferenceCycles', () => {
    it('should return reference cycles for processing facilities', async () => {
      // Arrange
      const mockFacilities = [
        {
          id: 'fac-1',
          code: 'HNK10-010-1',
          name: '소재투입1',
          process: 'OP10',
          type: 'MC-100',
          isProcessing: true,
          line: { code: 'HNK10', name: '블록' },
          referenceCycle: {
            facilityId: 'fac-1',
            duration: 360,
            uploadedAt: new Date('2026-02-01'),
            waveform: Array.from({ length: 360 }, (_, i) => ({
              sec: i,
              value: 850 + Math.sin(i * 0.087) * 80,
            })),
          },
        },
        {
          id: 'fac-2',
          code: 'HNK10-010-2',
          name: '소재투입2',
          process: 'OP10',
          type: 'MC-100',
          isProcessing: true,
          line: { code: 'HNK10', name: '블록' },
          referenceCycle: null,
        },
      ];

      mockPrismaService.facility.findMany.mockResolvedValue(mockFacilities);

      // Act
      const result = await service.getReferenceCycles();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('HNK10-010-1');
      expect(result[0].active).toBe(true);
      expect(result[0].cycleTime).toBe(360);
      expect(result[0].registeredAt).toBe('2026-02-01');
      expect(result[1].active).toBe(false);
      expect(result[1].energy).toBeNull();
    });
  });
});
