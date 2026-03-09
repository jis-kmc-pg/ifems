import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { RangeQueryDto } from './dto/range-query.dto';
import { RangeDataResponse } from './dto/range-response.dto';
import {
  HourlyTrendQueryDto,
  LineDetailQueryDto,
  EnergyRankingQueryDto,
  LineQueryDto,
  PowerQualityQueryDto,
} from './dto/monitoring-query.dto';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  // MON-001: 종합 현황 - KPI
  @Get('overview/kpi')
  @ApiOperation({ summary: '종합 현황 KPI 조회' })
  async getOverviewKpi() {
    return this.monitoringService.getOverviewKpi();
  }

  // MON-001: 종합 현황 - 라인 미니 카드
  @Get('overview/lines')
  @ApiOperation({ summary: '라인 미니 카드 조회' })
  async getLineMiniCards() {
    return this.monitoringService.getLineMiniCards();
  }

  // MON-001: 종합 현황 - 시간별 트렌드
  @Get('overview/hourly')
  @ApiOperation({ summary: '시간별 트렌드 조회' })
  async getHourlyTrend(@Query() query: HourlyTrendQueryDto) {
    return this.monitoringService.getHourlyTrend(query.date);
  }

  // MON-001: 종합 현황 - 알람 요약
  @Get('overview/alarms')
  @ApiOperation({ summary: '알람 요약 조회' })
  async getAlarmSummary() {
    return this.monitoringService.getAlarmSummary();
  }

  // MON-002: 라인별 상세
  @Get('line/:line')
  @ApiOperation({ summary: '라인별 상세 차트 조회' })
  async getLineDetailChart(
    @Param('line') line: string,
    @Query() query: LineDetailQueryDto,
  ) {
    return this.monitoringService.getLineDetailChart(line, query.date, query.interval);
  }

  // MON-003: 에너지 순위
  @Get('energy-ranking')
  @ApiOperation({ summary: '에너지 순위 조회' })
  async getEnergyRanking(@Query() query: EnergyRankingQueryDto) {
    return this.monitoringService.getEnergyRanking(query.line || '', query.type || 'elec');
  }

  // MON-004: 에너지 알림 현황
  @Get('energy-alert')
  @ApiOperation({ summary: '에너지 알림 현황 조회' })
  async getEnergyAlertStatus(@Query() query: LineQueryDto) {
    return this.monitoringService.getEnergyAlertStatus(query.line || '');
  }

  // MON-005: 전력 품질 순위
  @Get('power-quality')
  @ApiOperation({ summary: '전력 품질 순위 조회' })
  async getPowerQualityRanking(@Query() query: PowerQualityQueryDto) {
    return this.monitoringService.getPowerQualityRanking(
      query.line || '',
      query.startDate,
      query.endDate,
    );
  }

  // MON-006: 에어 누기 순위
  @Get('air-leak')
  @ApiOperation({ summary: '에어 누기 순위 조회' })
  async getAirLeakRanking(@Query() query: LineQueryDto) {
    return this.monitoringService.getAirLeakRanking(query.line || '');
  }
}

// ===== Line Range Data API Controller =====

@ApiTags('Dynamic Resolution')
@Controller('lines')
export class LineRangeDataController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * 라인별 전력 범위 데이터 조회 (동적 해상도)
   *
   * 해당 라인에 속한 모든 설비의 전력 데이터를 합산하여 반환
   */
  @Get(':lineCode/power/range')
  @ApiOperation({
    summary: '라인별 전력 범위 데이터 조회 (동적 해상도)',
    description: '라인 소속 전체 설비의 전력 사용량을 합산하여 시계열 데이터로 반환',
  })
  @ApiParam({
    name: 'lineCode',
    description: '라인 코드 (BLOCK, HEAD, CRANK, ASSEMBLE 등)',
    example: 'BLOCK',
    required: true,
  })
  async getLinePowerRangeData(
    @Param('lineCode') lineCode: string,
    @Query() query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    return this.monitoringService.fetchLineRangeData(lineCode, 'power', query);
  }

  /**
   * 라인별 에어 범위 데이터 조회 (동적 해상도)
   *
   * 해당 라인에 속한 모든 설비의 에어 데이터를 합산하여 반환
   */
  @Get(':lineCode/air/range')
  @ApiOperation({
    summary: '라인별 에어 범위 데이터 조회 (동적 해상도)',
    description: '라인 소속 전체 설비의 에어 사용량을 합산하여 시계열 데이터로 반환',
  })
  @ApiParam({
    name: 'lineCode',
    description: '라인 코드 (BLOCK, HEAD, CRANK, ASSEMBLE 등)',
    example: 'BLOCK',
    required: true,
  })
  async getLineAirRangeData(
    @Param('lineCode') lineCode: string,
    @Query() query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    return this.monitoringService.fetchLineRangeData(lineCode, 'air', query);
  }
}

// ===== Factory Range Data API Controller =====

@ApiTags('Dynamic Resolution')
@Controller('factories')
export class FactoryRangeDataController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * 공장별 전력 범위 데이터 조회 (동적 해상도)
   *
   * 해당 공장에 속한 모든 라인의 전력 데이터를 합산하여 반환
   */
  @Get(':factoryCode/power/range')
  @ApiOperation({
    summary: '공장별 전력 범위 데이터 조회 (동적 해상도)',
    description: '공장 소속 전체 라인·설비의 전력 사용량을 합산하여 시계열 데이터로 반환',
  })
  @ApiParam({
    name: 'factoryCode',
    description: '공장 코드 (예: hw4)',
    example: 'hw4',
    required: true,
  })
  async getFactoryPowerRangeData(
    @Param('factoryCode') factoryCode: string,
    @Query() query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    return this.monitoringService.fetchFactoryRangeData(factoryCode, 'power', query);
  }

  /**
   * 공장별 에어 범위 데이터 조회 (동적 해상도)
   *
   * 해당 공장에 속한 모든 라인의 에어 데이터를 합산하여 반환
   */
  @Get(':factoryCode/air/range')
  @ApiOperation({
    summary: '공장별 에어 범위 데이터 조회 (동적 해상도)',
    description: '공장 소속 전체 라인·설비의 에어 사용량을 합산하여 시계열 데이터로 반환',
  })
  @ApiParam({
    name: 'factoryCode',
    description: '공장 코드 (예: hw4)',
    example: 'hw4',
    required: true,
  })
  async getFactoryAirRangeData(
    @Param('factoryCode') factoryCode: string,
    @Query() query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    return this.monitoringService.fetchFactoryRangeData(factoryCode, 'air', query);
  }
}

// ===== Dynamic Resolution API Controller =====

@ApiTags('Dynamic Resolution')
@Controller('facilities')
export class DynamicResolutionController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * 설비별 전력 범위 데이터 조회 (동적 해상도)
   *
   * Progressive Resolution을 지원하는 전력 시계열 데이터 API
   * 4가지 interval (15m, 1m, 10s, 1s)을 지원하며, Zoom Level에 따라 자동으로 해상도 전환
   */
  @Get(':facilityId/power/range')
  @ApiOperation({
    summary: '설비별 전력 범위 데이터 조회 (동적 해상도)',
    description: `
Progressive Resolution API for power data.
Supports 4 intervals: 15m (Level 0), 1m (Level 1), 10s (Level 2), 1s (Level 3).
Returns current and previous day data for comparison.
    `,
  })
  @ApiParam({
    name: 'facilityId',
    description: '설비 ID (Facility code)',
    example: 'HNK10-000',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: '전력 범위 데이터 반환',
    type: RangeDataResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters (INVALID_INTERVAL, INVALID_TIME_RANGE)',
  })
  @ApiResponse({
    status: 404,
    description: 'Facility not found (FACILITY_NOT_FOUND)',
  })
  @ApiResponse({
    status: 500,
    description: 'Database query failed (DATABASE_ERROR)',
  })
  async getPowerRangeData(
    @Param('facilityId') facilityId: string,
    @Query() query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    return this.monitoringService.fetchRangeData(facilityId, 'power', query);
  }

  /**
   * 설비별 에어 범위 데이터 조회 (동적 해상도)
   *
   * Progressive Resolution을 지원하는 에어 시계열 데이터 API
   * 4가지 interval (15m, 1m, 10s, 1s)을 지원하며, Zoom Level에 따라 자동으로 해상도 전환
   */
  @Get(':facilityId/air/range')
  @ApiOperation({
    summary: '설비별 에어 범위 데이터 조회 (동적 해상도)',
    description: `
Progressive Resolution API for air data.
Supports 4 intervals: 15m (Level 0), 1m (Level 1), 10s (Level 2), 1s (Level 3).
Returns current and previous day data for comparison.
    `,
  })
  @ApiParam({
    name: 'facilityId',
    description: '설비 ID (Facility code)',
    example: 'HNK10-000',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: '에어 범위 데이터 반환',
    type: RangeDataResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters (INVALID_INTERVAL, INVALID_TIME_RANGE)',
  })
  @ApiResponse({
    status: 404,
    description: 'Facility not found (FACILITY_NOT_FOUND)',
  })
  @ApiResponse({
    status: 500,
    description: 'Database query failed (DATABASE_ERROR)',
  })
  async getAirRangeData(
    @Param('facilityId') facilityId: string,
    @Query() query: RangeQueryDto,
  ): Promise<RangeDataResponse> {
    return this.monitoringService.fetchRangeData(facilityId, 'air', query);
  }
}
