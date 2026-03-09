import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import {
  DashboardQueryDto,
  FacilityTrendQueryDto,
  UsageDistributionQueryDto,
  ProcessRankingQueryDto,
  EnergyChangeQueryDto,
} from './dto/dashboard-query.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // DSH-001: 에너지 사용 추이
  @Get('energy-trend')
  @ApiOperation({ summary: '에너지 사용 추이 조회' })
  @ApiQuery({ name: 'line', required: false, example: 'block' })
  async getEnergyTrend(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getEnergyTrend(query.line);
  }

  // DSH-002: 설비별 추이
  @Get('facility-trend')
  @ApiOperation({ summary: '설비별 추이 조회' })
  @ApiQuery({ name: 'line', required: false, example: 'block' })
  @ApiQuery({ name: 'facilityId', required: false, example: 'uuid' })
  async getFacilityTrend(@Query() query: FacilityTrendQueryDto) {
    return this.dashboardService.getFacilityTrend(query.line, query.facilityId);
  }

  // DSH-003: 사용량 분포
  @Get('usage-distribution')
  @ApiOperation({ summary: '사용량 분포 조회' })
  @ApiQuery({ name: 'line', required: false, example: 'block' })
  @ApiQuery({ name: 'start', required: false, example: '2026-02-20T00:00:00+09:00' })
  @ApiQuery({ name: 'end', required: false, example: '2026-02-20T23:59:59+09:00' })
  @ApiQuery({ name: 'date', required: false, example: '2026-02-20', description: '하위 호환 (start/end 우선)' })
  async getUsageDistribution(@Query() query: UsageDistributionQueryDto) {
    return this.dashboardService.getUsageDistribution(query.line, query.start, query.end, query.date);
  }

  // DSH-004: 공정별 순위
  @Get('process-ranking')
  @ApiOperation({ summary: '공정별 순위 조회' })
  @ApiQuery({ name: 'line', required: false, example: 'block' })
  @ApiQuery({ name: 'type', required: false, example: 'elec', enum: ['elec', 'air'] })
  async getProcessRanking(@Query() query: ProcessRankingQueryDto) {
    return this.dashboardService.getProcessRanking(query.line, query.type);
  }

  // DSH-005: 싸이클당 순위
  @Get('cycle-ranking')
  @ApiOperation({ summary: '싸이클당 순위 조회' })
  @ApiQuery({ name: 'line', required: false, example: 'block' })
  async getCycleRanking(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getCycleRanking(query.line);
  }

  // DSH-006: 전력 품질 순위
  @Get('power-quality-ranking')
  @ApiOperation({ summary: '전력 품질 순위 조회' })
  @ApiQuery({ name: 'line', required: false, example: 'block' })
  async getPowerQualityRanking(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getPowerQualityRanking(query.line);
  }

  // DSH-007: 에어 누기 순위
  @Get('air-leak-ranking')
  @ApiOperation({ summary: '에어 누기 순위 조회' })
  @ApiQuery({ name: 'line', required: false, example: 'block' })
  async getAirLeakRanking(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getAirLeakRanking(query.line);
  }

  // DSH-008: 에너지 변화 TOP N
  @Get('energy-change-top')
  @ApiOperation({ summary: '에너지 변화 TOP N 조회' })
  @ApiQuery({ name: 'topN', required: false, example: 8, description: 'TOP N 개수' })
  @ApiQuery({ name: 'type', required: false, example: 'elec', enum: ['elec', 'air'] })
  async getEnergyChangeTopN(@Query() query: EnergyChangeQueryDto) {
    return this.dashboardService.getEnergyChangeTopN(query.topN, query.type);
  }

  // 공통: 설비 목록
  @Get('facilities')
  @ApiOperation({ summary: '설비 목록 조회' })
  @ApiQuery({ name: 'line', required: false, example: 'block' })
  async getFacilityList(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getFacilityList(query.line);
  }
}
