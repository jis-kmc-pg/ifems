import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let service: AnalysisService;

  const mockAnalysisService = {
    getFacilityTree: jest.fn(),
    getFacilityHourlyData: jest.fn(),
    getDetailedComparison: jest.fn(),
    getCycleList: jest.fn(),
    getPowerQualityAnalysis: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        {
          provide: AnalysisService,
          useValue: mockAnalysisService,
        },
      ],
    }).compile();

    controller = module.get<AnalysisController>(AnalysisController);
    service = module.get<AnalysisService>(AnalysisService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getFacilityTree', () => {
    it('should return facility tree structure', async () => {
      const mockTree = [
        { id: '1', code: 'HNK10', name: 'Factory HNK10', children: [] },
      ];
      mockAnalysisService.getFacilityTree.mockResolvedValue(mockTree);

      const result = await controller.getFacilityTree();

      expect(result).toEqual(mockTree);
      expect(service.getFacilityTree).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFacilityHourlyData', () => {
    it('should return hourly data for facility', async () => {
      const query = { facilityId: 'HNK10-000', type: 'elec', date: '2026-02-20' };
      const mockData = [
        { hour: 0, value: 50 },
        { hour: 1, value: 48 },
      ];
      mockAnalysisService.getFacilityHourlyData.mockResolvedValue(mockData);

      const result = await controller.getFacilityHourlyData(query);

      expect(result).toEqual(mockData);
      expect(service.getFacilityHourlyData).toHaveBeenCalledWith('HNK10-000', 'elec', '2026-02-20');
    });
  });

  describe('getDetailedComparison', () => {
    it('should return detailed comparison data', async () => {
      const query = {
        facilityId: 'HNK10-000',
        date: '2026-02-20',
        facilityId2: 'HNK10-010',
        date2: '2026-02-19',
      };
      const mockComparison = {
        target1: { facilityId: 'HNK10-000', data: [] },
        target2: { facilityId: 'HNK10-010', data: [] },
      };
      mockAnalysisService.getDetailedComparison.mockResolvedValue(mockComparison);

      const result = await controller.getDetailedComparison(query);

      expect(result).toEqual(mockComparison);
      expect(service.getDetailedComparison).toHaveBeenCalled();
    });
  });
});
