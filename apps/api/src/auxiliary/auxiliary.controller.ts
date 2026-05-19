import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuxService } from './auxiliary.service';
import { RuleEngineService } from './rule-engine.service';
import {
  CreateZoneDto, UpdateZoneDto, ZoneDto, ZoneTreeNodeDto,
} from './dto/zone.dto';
import {
  CreateScheduleRuleDto, UpdateScheduleRuleDto, ScheduleRuleDto,
} from './dto/schedule-rule.dto';

/**
 * 부대설비(공조/조명/환경) 도메인 API — i-FEMS fems 스키마 골격
 *
 *  Prefix: /api/aux
 *    zones            : 공간 단위 (공장 > 동 > 층 > 존)
 *    lux-standards    : 작업조도 기준 (KS A 3011)
 *    schedule-rules   : 자동 운전 룰 엔진
 *    control-commands : 제어 명령 이력 (감사)
 */
@ApiTags('Aux')
@Controller('aux')
export class AuxController {
  constructor(
    private readonly aux: AuxService,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  // ──────────── zones ────────────
  @Get('zones')
  @ApiOperation({ summary: 'zones 목록 조회 (활성/전체)' })
  @ApiQuery({ name: 'all', required: false, type: Boolean, description: 'true면 비활성 포함' })
  listZones(@Query('all') all?: string): Promise<ZoneDto[]> {
    return this.aux.listZones(all !== 'true');
  }

  @Get('zones/tree')
  @ApiOperation({ summary: 'zones 계층 트리 (parent/children) 조회' })
  zoneTree(): Promise<ZoneTreeNodeDto[]> {
    return this.aux.getZoneTree();
  }

  @Get('zones/:id')
  @ApiOperation({ summary: 'zone 단건 조회' })
  getZone(@Param('id') id: string): Promise<ZoneDto> {
    return this.aux.getZone(id);
  }

  @Post('zones')
  @ApiOperation({ summary: 'zone 생성' })
  createZone(@Body() dto: CreateZoneDto): Promise<ZoneDto> {
    return this.aux.createZone(dto);
  }

  @Patch('zones/:id')
  @ApiOperation({ summary: 'zone 수정' })
  updateZone(@Param('id') id: string, @Body() dto: UpdateZoneDto): Promise<ZoneDto> {
    return this.aux.updateZone(id, dto);
  }

  @Delete('zones/:id')
  @ApiOperation({ summary: 'zone 삭제' })
  deleteZone(@Param('id') id: string) {
    return this.aux.deleteZone(id);
  }

  // ──────────── lux standards ────────────
  @Get('lux-standards')
  @ApiOperation({ summary: '작업조도 기준 전체 (KS A 3011)' })
  listLuxStandards() {
    return this.aux.listLuxStandards();
  }

  // ──────────── schedule rules ────────────
  @Get('schedule-rules')
  @ApiOperation({ summary: '스케줄 룰 목록' })
  @ApiQuery({ name: 'enabled', required: false, type: Boolean, description: 'true면 enabled=true만' })
  listScheduleRules(@Query('enabled') enabled?: string): Promise<ScheduleRuleDto[]> {
    return this.aux.listScheduleRules(enabled === 'true');
  }

  @Get('schedule-rules/:id')
  @ApiOperation({ summary: '스케줄 룰 단건 조회' })
  getScheduleRule(@Param('id') id: string): Promise<ScheduleRuleDto> {
    return this.aux.getScheduleRule(id);
  }

  @Post('schedule-rules')
  @ApiOperation({ summary: '스케줄 룰 생성' })
  createScheduleRule(@Body() dto: CreateScheduleRuleDto): Promise<ScheduleRuleDto> {
    return this.aux.createScheduleRule(dto);
  }

  @Patch('schedule-rules/:id')
  @ApiOperation({ summary: '스케줄 룰 수정' })
  updateScheduleRule(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleRuleDto,
  ): Promise<ScheduleRuleDto> {
    return this.aux.updateScheduleRule(id, dto);
  }

  @Delete('schedule-rules/:id')
  @ApiOperation({ summary: '스케줄 룰 삭제' })
  deleteScheduleRule(@Param('id') id: string) {
    return this.aux.deleteScheduleRule(id);
  }

  // ──────────── control commands ────────────
  @Get('control-commands')
  @ApiOperation({ summary: '제어 명령 이력 조회 (최신순)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '기본 100' })
  @ApiQuery({ name: 'facilityId', required: false, type: String })
  listControlCommands(
    @Query('limit') limit?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    const n = limit ? Math.min(parseInt(limit, 10) || 100, 1000) : 100;
    return this.aux.listControlCommands(n, facilityId);
  }

  // ──────────── trend (시간별 누적 사용량) ────────────
  @Get('hvac/trend')
  @ApiOperation({ summary: 'HVAC 시간별 누적 사용량 (1h 버킷)' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: '기본 24, 최대 168' })
  hvacTrend(@Query('hours') hours?: string) {
    return this.aux.getTypeTrend('HVAC', hours ? parseInt(hours, 10) : 24);
  }

  @Get('lighting/trend')
  @ApiOperation({ summary: 'LIGHTING 시간별 누적 사용량 (1h 버킷)' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: '기본 24, 최대 168' })
  lightingTrend(@Query('hours') hours?: string) {
    return this.aux.getTypeTrend('LIGHTING', hours ? parseInt(hours, 10) : 24);
  }

  // ──────────── rule engine (수동 트리거) ────────────
  @Post('rule-engine/run')
  @ApiOperation({
    summary: '룰 엔진 1회 강제 실행 (관리자 트리거)',
    description: 'Cron(1분 간격)과 별개로 즉시 1회 평가 + 발행. 환경변수 AUX_RULE_ENGINE_ENABLED 와 무관하게 실행.',
  })
  async runRuleEngineNow() {
    const result = await this.ruleEngine.runOnce();
    return { ...result, message: `${result.issued}개 control_commands 발행됨` };
  }
}
