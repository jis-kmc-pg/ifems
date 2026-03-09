import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';
import {
  FacilityHourlyQueryDto,
  DetailedComparisonDto,
  CycleListQueryDto,
  CycleWaveformQueryDto,
  PowerQualityAnalysisDto,
} from './dto/analysis-query.dto';

@ApiTags('Analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get('facilities/tree')
  @ApiOperation({ summary: '설비 트리 조회' })
  async getFacilityTree() {
    return this.analysisService.getFacilityTree();
  }

  @Get('facility/hourly')
  @ApiOperation({ summary: '설비별 시간대별 데이터' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'type', required: true, enum: ['elec', 'air'] })
  async getFacilityHourlyData(@Query() query: FacilityHourlyQueryDto) {
    return this.analysisService.getFacilityHourlyData(query.facilityId, query.type, query.date);
  }

  @Get('comparison/detailed')
  @ApiOperation({ summary: '상세 비교 분석' })
  async getDetailedComparison(@Query() query: DetailedComparisonDto) {
    return this.analysisService.getDetailedComparison(
      { facilityId: query.facilityId, date: query.date },
      { facilityId: query.facilityId2 || query.facilityId, date: query.date2 || query.date },
    );
  }

  @Get('cycles')
  @ApiOperation({ summary: '싸이클 목록' })
  async getCycleList(@Query() query: CycleListQueryDto) {
    return this.analysisService.getCycleList(query.facilityId);
  }

  @Get('cycle/waveform')
  @ApiOperation({ summary: '싸이클 파형 데이터' })
  @ApiQuery({ name: 'cycleId', required: true })
  @ApiQuery({ name: 'interval', required: false, enum: ['10s', '1s'], description: 'Data interval (default: 10s)' })
  async getCycleWaveform(@Query() query: CycleWaveformQueryDto) {
    const interval = (query.interval || '10s') as '10s' | '1s';
    return this.analysisService.getCycleWaveform(query.cycleId, query.isReference === 'true', interval);
  }

  @Get('cycle/delay')
  @ApiOperation({ summary: '싸이클 타임 지연 정보' })
  async getCycleDelay(@Query() query: CycleListQueryDto) {
    return this.analysisService.getCycleDelay(query.facilityId);
  }

  @Get('power-quality')
  @ApiOperation({ summary: '전력 품질 분석 (설비별 불평형/역률)' })
  async getPowerQualityAnalysis(@Query() query: PowerQualityAnalysisDto) {
    const ids = query.facilityIds ? query.facilityIds.split(',') : [];
    return this.analysisService.getPowerQualityAnalysis(ids, query.date);
  }
}
