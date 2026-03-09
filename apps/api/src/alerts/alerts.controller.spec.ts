import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

describe('AlertsController', () => {
  let controller: AlertsController;
  let service: AlertsService;

  const mockAlertsService = {
    getAlertStatsKpi: jest.fn(),
    getAlertTrend: jest.fn(),
    getAlertHistory: jest.fn(),
    saveAlertAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        {
          provide: AlertsService,
          useValue: mockAlertsService,
        },
      ],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
    service = module.get<AlertsService>(AlertsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAlertStatsKpi', () => {
    it('should return alert KPI statistics', async () => {
      const query = { category: 'power_quality' };
      const mockKpi = { total: 120, active: 15, resolved: 105, avgResponseTime: 45 };
      mockAlertsService.getAlertStatsKpi.mockResolvedValue(mockKpi);

      const result = await controller.getAlertStatsKpi(query);

      expect(result).toEqual(mockKpi);
      expect(service.getAlertStatsKpi).toHaveBeenCalledWith('power_quality');
    });
  });

  describe('getAlertHistory', () => {
    it('should return alert history', async () => {
      const query = { category: 'air_leak', line: 'block', facilityCode: 'HNK10-000' };
      const mockHistory = [
        { id: '1', no: 1, timestamp: '2026-02-20T10:00:00Z', facilityCode: 'HNK10-000' },
      ];
      mockAlertsService.getAlertHistory.mockResolvedValue(mockHistory);

      const result = await controller.getAlertHistory(query);

      expect(result).toEqual(mockHistory);
      expect(service.getAlertHistory).toHaveBeenCalledWith('air_leak', 'block', 'HNK10-000');
    });
  });

  describe('saveAlertAction', () => {
    it('should save alert action', async () => {
      const id = 'alert-123';
      const body = { action: '펌프 교체 완료', actionBy: 'admin' };
      const mockResult = { success: true, id };
      mockAlertsService.saveAlertAction.mockResolvedValue(mockResult);

      const result = await controller.saveAlertAction(id, body);

      expect(result).toEqual(mockResult);
      expect(service.saveAlertAction).toHaveBeenCalledWith(id, body.action, body.actionBy);
    });
  });
});
