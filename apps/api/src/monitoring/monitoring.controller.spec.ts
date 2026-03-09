import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringController, DynamicResolutionController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

describe('MonitoringController', () => {
  let controller: MonitoringController;
  let service: MonitoringService;

  const mockMonitoringService = {
    getOverviewKpi: jest.fn(),
    getLineMiniCards: jest.fn(),
    getHourlyTrend: jest.fn(),
    getLineDetailChart: jest.fn(),
    getEnergyRanking: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonitoringController],
      providers: [
        {
          provide: MonitoringService,
          useValue: mockMonitoringService,
        },
      ],
    }).compile();

    controller = module.get<MonitoringController>(MonitoringController);
    service = module.get<MonitoringService>(MonitoringService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOverviewKpi', () => {
    it('should return KPI data', async () => {
      const mockKpi = {
        totalPowerToday: 1500,
        totalAirToday: 120000,
        activeAlerts: 5,
        operatingFacilities: 42,
      };
      mockMonitoringService.getOverviewKpi.mockResolvedValue(mockKpi);

      const result = await controller.getOverviewKpi();

      expect(result).toEqual(mockKpi);
      expect(service.getOverviewKpi).toHaveBeenCalledTimes(1);
    });
  });

  describe('getHourlyTrend', () => {
    it('should return hourly trend data', async () => {
      const query = { date: '2026-02-20' };
      const mockData = [
        { hour: 0, power: 50, air: 4000 },
        { hour: 1, power: 45, air: 3800 },
      ];
      mockMonitoringService.getHourlyTrend.mockResolvedValue(mockData);

      const result = await controller.getHourlyTrend(query);

      expect(result).toEqual(mockData);
      expect(service.getHourlyTrend).toHaveBeenCalledWith('2026-02-20');
    });
  });

  describe('getEnergyRanking', () => {
    it('should return energy ranking', async () => {
      const query = { line: 'block', type: 'elec' };
      const mockRanking = [
        { facilityId: '1', code: 'HNK10-000', dailyElec: 100, rankElec: 1 },
      ];
      mockMonitoringService.getEnergyRanking.mockResolvedValue(mockRanking);

      const result = await controller.getEnergyRanking(query);

      expect(result).toEqual(mockRanking);
      expect(service.getEnergyRanking).toHaveBeenCalledWith('block', 'elec');
    });
  });
});

describe('DynamicResolutionController', () => {
  let controller: DynamicResolutionController;
  let service: MonitoringService;

  const mockMonitoringService = {
    fetchRangeData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DynamicResolutionController],
      providers: [
        {
          provide: MonitoringService,
          useValue: mockMonitoringService,
        },
      ],
    }).compile();

    controller = module.get<DynamicResolutionController>(DynamicResolutionController);
    service = module.get<MonitoringService>(MonitoringService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPowerRangeData', () => {
    it('should return power range data', async () => {
      const facilityId = 'HNK10-000';
      const query = { start: '2026-02-20T00:00:00Z', end: '2026-02-20T23:59:59Z', interval: '15m' };
      const mockResponse = {
        current: { data: [], startTime: query.start, endTime: query.end },
        previous: { data: [], startTime: query.start, endTime: query.end },
      };
      mockMonitoringService.fetchRangeData.mockResolvedValue(mockResponse);

      const result = await controller.getPowerRangeData(facilityId, query as any);

      expect(result).toEqual(mockResponse);
      expect(service.fetchRangeData).toHaveBeenCalledWith(facilityId, 'power', query);
    });
  });
});
