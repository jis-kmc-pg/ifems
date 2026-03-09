import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  const mockDashboardService = {
    getEnergyTrend: jest.fn(),
    getProcessRanking: jest.fn(),
    getCycleRanking: jest.fn(),
    getFacilityList: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getEnergyTrend', () => {
    it('should return energy trend data', async () => {
      const query = { line: 'block' };
      const mockTrend = [
        { date: '2026-02-14', power: 1200, air: 95000 },
        { date: '2026-02-15', power: 1250, air: 98000 },
      ];
      mockDashboardService.getEnergyTrend.mockResolvedValue(mockTrend);

      const result = await controller.getEnergyTrend(query);

      expect(result).toEqual(mockTrend);
      expect(service.getEnergyTrend).toHaveBeenCalledWith('block');
    });
  });

  describe('getProcessRanking', () => {
    it('should return process ranking', async () => {
      const query = { line: 'block', type: 'elec' };
      const mockRanking = [
        { process: 'OP10', power: 500, air: 40000, prevPower: 480, prevAir: 39000 },
      ];
      mockDashboardService.getProcessRanking.mockResolvedValue(mockRanking);

      const result = await controller.getProcessRanking(query);

      expect(result).toEqual(mockRanking);
      expect(service.getProcessRanking).toHaveBeenCalledWith('block', 'elec');
    });
  });

  describe('getCycleRanking', () => {
    it('should return cycle ranking', async () => {
      const query = { line: 'block' };
      const mockRanking = [
        { rank: 1, code: 'HNK10-000', avgCycleTime: 45, targetCycleTime: 50 },
      ];
      mockDashboardService.getCycleRanking.mockResolvedValue(mockRanking);

      const result = await controller.getCycleRanking(query);

      expect(result).toEqual(mockRanking);
      expect(service.getCycleRanking).toHaveBeenCalledWith('block');
    });
  });
});
