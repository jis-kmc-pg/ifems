import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma.service';

describe('AlertsService', () => {
  let service: AlertsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    alert: {
      count: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAlertStatsKpi', () => {
    it('should return alert statistics for power_quality category', async () => {
      // Arrange
      mockPrismaService.alert.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(40) // previous weekly
        .mockResolvedValueOnce(30); // resolved

      // Act
      const result = await service.getAlertStatsKpi('power_quality');

      // Assert
      expect(result).toBeDefined();
      expect(result.total).toBe(50);
      expect(result.weekly).toBe(50);
      expect(result.weeklyChange).toBe(25); // ((50-40)/40)*100
      expect(result.resolved).toBe(30);
      expect(result.resolvedRate).toBe(60); // (30/50)*100
    });

    it('should handle zero previous week count', async () => {
      // Arrange
      mockPrismaService.alert.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(5);

      // Act
      const result = await service.getAlertStatsKpi('air_leak');

      // Assert
      expect(result.weeklyChange).toBe(0);
    });

    it('should calculate resolvedRate as 0 when total is 0', async () => {
      // Arrange
      mockPrismaService.alert.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      // Act
      const result = await service.getAlertStatsKpi('cycle_anomaly');

      // Assert
      expect(result.total).toBe(0);
      expect(result.resolvedRate).toBe(0);
    });
  });

  describe('getAlertTrend', () => {
    it('should return weekly alert trend for 8 weeks', async () => {
      // Arrange
      const mockTrend = [
        { week: '01/01', count: 10 },
        { week: '01/08', count: 15 },
        { week: '01/15', count: 12 },
        { week: '01/22', count: 20 },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockTrend);

      // Act
      const result = await service.getAlertTrend('power_quality');

      // Assert
      expect(result).toHaveLength(4);
      expect(result[0].week).toBe('01/01');
      expect(result[0].count).toBe(10);
      expect(result[3].count).toBe(20);
    });

    it('should handle empty trend data', async () => {
      // Arrange
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await service.getAlertTrend('air_leak');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getAlertHistory', () => {
    it('should return alert history with proper formatting', async () => {
      // Arrange
      const mockHistory = [
        {
          id: 'alert-1',
          detectedAt: new Date('2026-02-28T10:30:00Z'),
          severity: 'HIGH',
          status: 'ACTIVE',
          action: null, // aliased from actionTaken
          metadata: { imbalance: 6.5, powerFactor: 0.85 },
          facility_code: 'HNK10-010-1',
          facility_name: '소재투입1',
          process: 'OP10',
          line_name: '블록',
        },
        {
          id: 'alert-2',
          detectedAt: new Date('2026-02-28T09:15:00Z'),
          severity: 'MEDIUM',
          status: 'RESOLVED',
          action: '설비 재가동', // aliased from actionTaken
          metadata: { imbalance: 4.8 },
          facility_code: 'HNK10-010-2',
          facility_name: '소재투입2',
          process: 'OP10',
          line_name: '블록',
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockHistory);

      // Act
      const result = await service.getAlertHistory('power_quality');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('alert-1');
      expect(result[0].no).toBe(1);
      expect(result[0].facilityCode).toBe('HNK10-010-1');
      expect(result[0].baseline).toBe('5.0%');
      expect(result[0].current).toBe('6.5%');
      expect(result[0].status).toBe('ACTIVE');
      expect(result[0].action).toBeUndefined();
      expect(result[1].id).toBe('alert-2');
      expect(result[1].no).toBe(2);
      expect(result[1].status).toBe('RESOLVED');
      expect(result[1].action).toBe('설비 재가동');
    });

    it('should filter by line parameter', async () => {
      // Arrange
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await service.getAlertHistory('air_leak', 'BLOCK');

      // Assert
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should filter by facilityCode parameter', async () => {
      // Arrange
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await service.getAlertHistory('cycle_anomaly', undefined, 'HNK10-010-1');

      // Assert
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should handle air_leak category with different metadata', async () => {
      // Arrange
      const mockHistory = [
        {
          id: 'alert-3',
          detectedAt: new Date('2026-02-28T11:00:00Z'),
          severity: 'HIGH',
          status: 'ACTIVE',
          actionTaken: null,
          metadata: { airUsage: 15000 },
          facility_code: 'HNK10-020-1',
          facility_name: '가공1',
          process: 'OP20',
          line_name: '블록',
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockHistory);

      // Act
      const result = await service.getAlertHistory('air_leak');

      // Assert
      expect(result[0].baseline).toBe('10000 L');
      expect(result[0].current).toBe('15000 L');
      expect(result[0].ratio).toBe(150);
    });
  });

  describe('saveAlertAction', () => {
    it('should save alert action successfully', async () => {
      // Arrange
      const mockUpdatedAlert = {
        id: 'alert-1',
        actionTaken: '설비 점검 완료',
        actionTakenBy: 'user-123',
        actionTakenAt: new Date('2026-02-28T12:00:00Z'),
        updatedAt: new Date('2026-02-28T12:00:00Z'),
      };

      mockPrismaService.alert.update.mockResolvedValue(mockUpdatedAlert);

      // Act
      const result = await service.saveAlertAction('alert-1', '설비 점검 완료', 'user-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.id).toBe('alert-1');
      expect(result.action).toBe('설비 점검 완료');
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: {
          actionTaken: '설비 점검 완료',
          actionTakenBy: 'user-123',
          actionTakenAt: expect.any(Date),
        },
      });
    });

    it('should use default actionBy when not provided', async () => {
      // Arrange
      const mockUpdatedAlert = {
        id: 'alert-2',
        actionTaken: '자동 조치',
        actionTakenBy: 'system',
        actionTakenAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.alert.update.mockResolvedValue(mockUpdatedAlert);

      // Act
      const result = await service.saveAlertAction('alert-2', '자동 조치');

      // Assert
      expect(result.success).toBe(true);
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-2' },
        data: expect.objectContaining({
          actionTakenBy: 'system',
        }),
      });
    });
  });

  describe('getCycleAnomalyTypes', () => {
    it('should return all cycle anomaly types', async () => {
      // Act
      const result = await service.getCycleAnomalyTypes();

      // Assert
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ value: 'NORMAL', label: '정상' });
      expect(result[1]).toEqual({ value: 'DELAYED', label: '지연' });
      expect(result[2]).toEqual({ value: 'ANOMALY', label: '이상' });
      expect(result[3]).toEqual({ value: 'INCOMPLETE', label: '미완료' });
    });
  });
});
