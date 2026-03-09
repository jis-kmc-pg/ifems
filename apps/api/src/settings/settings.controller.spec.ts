import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: SettingsService;

  const mockSettingsService = {
    getThresholdSettings: jest.fn(),
    saveThresholdSettings: jest.fn(),
    getFacilityMasterList: jest.fn(),
    createFacilityMaster: jest.fn(),
    getHierarchy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPowerQualitySettings', () => {
    it('should return power quality threshold settings', async () => {
      const mockSettings = [
        { facilityId: '1', threshold1: 90, threshold2: 95 },
      ];
      mockSettingsService.getThresholdSettings.mockResolvedValue(mockSettings);

      const result = await controller.getPowerQualitySettings();

      expect(result).toEqual(mockSettings);
      expect(service.getThresholdSettings).toHaveBeenCalledWith('power_quality');
    });
  });

  describe('savePowerQualitySettings', () => {
    it('should save power quality settings', async () => {
      const rows = [{ facilityId: '1', threshold1: 92, threshold2: 97 }];
      const mockResult = { success: true, updated: 1 };
      mockSettingsService.saveThresholdSettings.mockResolvedValue(mockResult);

      const result = await controller.savePowerQualitySettings(rows);

      expect(result).toEqual(mockResult);
      expect(service.saveThresholdSettings).toHaveBeenCalledWith('power_quality', rows);
    });
  });

  describe('getFacilityMasterList', () => {
    it('should return facility master list with filters', async () => {
      const mockList = [
        { id: '1', code: 'HNK10-000', name: 'Facility 1' },
      ];
      mockSettingsService.getFacilityMasterList.mockResolvedValue(mockList);

      const result = await controller.getFacilityMasterList('block', 'OP10', 'MACHINE', 'HNK');

      expect(result).toEqual(mockList);
      expect(service.getFacilityMasterList).toHaveBeenCalledWith({
        line: 'block',
        process: 'OP10',
        type: 'MACHINE',
        search: 'HNK',
      });
    });
  });
});
