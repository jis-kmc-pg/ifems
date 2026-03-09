import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { AlertCategoryDto, AlertHistoryQueryDto, SaveAlertActionDto } from './dto/alerts-query.dto';

@ApiTags('Alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('stats/kpi')
  @ApiOperation({ summary: '알람 통계 KPI' })
  @ApiQuery({ name: 'category', required: true })
  async getAlertStatsKpi(@Query() query: AlertCategoryDto) {
    return this.alertsService.getAlertStatsKpi(query.category);
  }

  @Get('stats/trend')
  @ApiOperation({ summary: '알람 주간 트렌드' })
  @ApiQuery({ name: 'category', required: true })
  async getAlertTrend(@Query() query: AlertCategoryDto) {
    return this.alertsService.getAlertTrend(query.category);
  }

  @Get('stats/heatmap')
  @ApiOperation({ summary: '설비별 알림 히트맵' })
  @ApiQuery({ name: 'category', required: true })
  async getAlertHeatmap(@Query() query: AlertCategoryDto) {
    return this.alertsService.getAlertHeatmap(query.category);
  }

  @Get('history')
  @ApiOperation({ summary: '알람 이력' })
  @ApiQuery({ name: 'category', required: true })
  async getAlertHistory(@Query() query: AlertHistoryQueryDto) {
    return this.alertsService.getAlertHistory(query.category, query.line, query.facilityCode);
  }

  @Patch(':id/action')
  @ApiOperation({ summary: '알림 조치사항 저장' })
  async saveAlertAction(@Param('id') id: string, @Body() body: SaveAlertActionDto) {
    return this.alertsService.saveAlertAction(id, body.action, body.actionBy);
  }

  @Get('cycle-anomaly/types')
  @ApiOperation({ summary: '싸이클 이상 유형 목록' })
  async getCycleAnomalyTypes() {
    return this.alertsService.getCycleAnomalyTypes();
  }

  @Get(':id/waveform')
  @ApiOperation({ summary: '싸이클 파형 데이터 (이력 상세 모달)' })
  async getCycleWaveformForAlert(@Param('id') id: string) {
    return this.alertsService.getCycleWaveformForAlert(id);
  }
}
