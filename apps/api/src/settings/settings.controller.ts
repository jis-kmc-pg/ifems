import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseInterceptors, UploadedFile, Res, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SettingsService } from './settings.service';
import { CreateFactoryDto, UpdateFactoryDto, FactoryResponseDto } from './dto/factory.dto';
import { CreateLineDto, UpdateLineDto, LineResponseDto } from './dto/line.dto';
import { CreateTagDto, UpdateTagDto, TagResponseDto } from './dto/tag.dto';
import { CreateFacilityTypeDto, UpdateFacilityTypeDto } from './dto/facility-type.dto';
import { TagReassignmentDto } from './dto/tag-reassignment.dto';
import { UpdateEnergyConfigDto } from './dto/energy-config.dto';
import { SaveNonProductionSchedulesDto, ProductionCalendarDto } from './dto/non-production.dto';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ──────────────────────────────────────────────
  // SET001-SET006: 임계값 설정 API (Threshold Settings)
  // ──────────────────────────────────────────────
  @Get('power-quality')
  @ApiOperation({ summary: '전력 품질 임계값 설정 조회' })
  async getPowerQualitySettings() {
    return this.settingsService.getThresholdSettings('power_quality');
  }

  @Put('power-quality')
  @ApiOperation({ summary: '전력 품질 임계값 설정 저장' })
  async savePowerQualitySettings(@Body() rows: any[]) {
    return this.settingsService.saveThresholdSettings('power_quality', rows);
  }

  @Get('air-leak')
  @ApiOperation({ summary: '에어 누기 임계값 설정 조회' })
  async getAirLeakSettings() {
    return this.settingsService.getThresholdSettings('air_leak');
  }

  @Put('air-leak')
  @ApiOperation({ summary: '에어 누기 임계값 설정 저장' })
  async saveAirLeakSettings(@Body() rows: any[]) {
    return this.settingsService.saveThresholdSettings('air_leak', rows);
  }

  @Get('reference-cycles')
  @ApiOperation({ summary: '기준 싸이클 파형 조회' })
  async getReferenceCycles() {
    return this.settingsService.getReferenceCycles();
  }

  @Get('cycle-alert')
  @ApiOperation({ summary: '싸이클 알림 임계값 설정 조회' })
  async getCycleAlertSettings() {
    return this.settingsService.getThresholdSettings('cycle_alert');
  }

  @Put('cycle-alert')
  @ApiOperation({ summary: '싸이클 알림 임계값 설정 저장' })
  async saveCycleAlertSettings(@Body() rows: any[]) {
    return this.settingsService.saveThresholdSettings('cycle_alert', rows);
  }

  @Get('energy-alert')
  @ApiOperation({ summary: '에너지 사용량 알림 설정 조회' })
  async getEnergyAlertSettings() {
    return this.settingsService.getThresholdSettings('energy_alert');
  }

  @Put('energy-alert')
  @ApiOperation({ summary: '에너지 사용량 알림 설정 저장' })
  async saveEnergyAlertSettings(@Body() rows: any[]) {
    return this.settingsService.saveThresholdSettings('energy_alert', rows);
  }

  @Get('cycle-energy-alert')
  @ApiOperation({ summary: '싸이클당 에너지 알림 설정 조회' })
  async getCycleEnergyAlertSettings() {
    return this.settingsService.getThresholdSettings('cycle_energy_alert');
  }

  @Put('cycle-energy-alert')
  @ApiOperation({ summary: '싸이클당 에너지 알림 설정 저장' })
  async saveCycleEnergyAlertSettings(@Body() rows: any[]) {
    return this.settingsService.saveThresholdSettings('cycle_energy_alert', rows);
  }

  @Get('anomaly-detection')
  @ApiOperation({ summary: '이상 데이터 감지 임계값 설정 조회' })
  async getAnomalyDetectionSettings() {
    return this.settingsService.getThresholdSettings('anomaly_detection');
  }

  @Put('anomaly-detection')
  @ApiOperation({ summary: '이상 데이터 감지 임계값 설정 저장' })
  async saveAnomalyDetectionSettings(@Body() rows: any[]) {
    return this.settingsService.saveThresholdSettings('anomaly_detection', rows);
  }

  @Get('general')
  @ApiOperation({ summary: '일반 설정 조회' })
  async getGeneralSettings() {
    return this.settingsService.getGeneralSettings();
  }

  @Put('general')
  @ApiOperation({ summary: '일반 설정 저장' })
  async saveGeneralSettings(@Body() settings: any) {
    return this.settingsService.saveGeneralSettings(settings);
  }

  @Get('system')
  @ApiOperation({ summary: '시스템 설정 전체 조회' })
  async getSystemSettings() {
    return this.settingsService.getSystemSettings();
  }

  @Put('system')
  @ApiOperation({ summary: '시스템 설정 저장' })
  async saveSystemSettings(@Body() settings: Record<string, any>) {
    return this.settingsService.saveSystemSettings(settings);
  }

  @Get('thresholds')
  @ApiOperation({ summary: '임계값 설정 조회' })
  async getThresholds() {
    return this.settingsService.getThresholds();
  }

  // ──────────────────────────────────────────────
  // 설비 마스터 관리 API
  // ──────────────────────────────────────────────
  @Get('facility-master')
  @ApiOperation({ summary: '설비 마스터 목록 조회' })
  async getFacilityMasterList(
    @Query('line') line?: string,
    @Query('process') process?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.settingsService.getFacilityMasterList({ line, process, type, search });
  }

  @Post('facility-master/auto-assign-process')
  @ApiOperation({ summary: '설비 공정 자동 할당 (코드 기반 일괄 업데이트)' })
  async autoAssignProcess() {
    return this.settingsService.autoAssignProcess();
  }

  @Post('facility-master')
  @ApiOperation({ summary: '설비 마스터 생성' })
  async createFacilityMaster(@Body() data: any) {
    return this.settingsService.createFacilityMaster(data);
  }

  @Put('facility-master/:id')
  @ApiOperation({ summary: '설비 마스터 수정' })
  async updateFacilityMaster(@Param('id') id: string, @Body() data: any) {
    return this.settingsService.updateFacilityMaster(id, data);
  }

  @Delete('facility-master/:id')
  @ApiOperation({ summary: '설비 마스터 삭제' })
  async deleteFacilityMaster(@Param('id') id: string) {
    return this.settingsService.deleteFacilityMaster(id);
  }

  // ──────────────────────────────────────────────
  // 공장 관리 API (Factory Management)
  // ──────────────────────────────────────────────
  @Get('factory')
  @ApiOperation({ summary: '공장 목록 조회' })
  async getFactoryList() {
    return this.settingsService.getFactoryList();
  }

  @Post('factory')
  @ApiOperation({ summary: '공장 생성' })
  async createFactory(@Body() dto: CreateFactoryDto) {
    return this.settingsService.createFactory(dto);
  }

  @Put('factory/:id')
  @ApiOperation({ summary: '공장 수정' })
  async updateFactory(@Param('id') id: string, @Body() dto: UpdateFactoryDto) {
    return this.settingsService.updateFactory(id, dto);
  }

  @Delete('factory/:id')
  @ApiOperation({ summary: '공장 삭제' })
  async deleteFactory(@Param('id') id: string) {
    return this.settingsService.deleteFactory(id);
  }

  // ──────────────────────────────────────────────
  // 라인 관리 API (Line Management)
  // ──────────────────────────────────────────────
  @Get('line')
  @ApiOperation({ summary: '라인 목록 조회' })
  async getLineList(@Query('factoryId') factoryId?: string) {
    return this.settingsService.getLineList(factoryId);
  }

  @Post('line')
  @ApiOperation({ summary: '라인 생성' })
  async createLine(@Body() dto: CreateLineDto) {
    return this.settingsService.createLine(dto);
  }

  @Put('line/:id')
  @ApiOperation({ summary: '라인 수정' })
  async updateLine(@Param('id') id: string, @Body() dto: UpdateLineDto) {
    return this.settingsService.updateLine(id, dto);
  }

  @Delete('line/:id')
  @ApiOperation({ summary: '라인 삭제' })
  async deleteLine(@Param('id') id: string) {
    return this.settingsService.deleteLine(id);
  }

  // ──────────────────────────────────────────────
  // 태그 관리 API (Tag Management)
  // ──────────────────────────────────────────────
  @Get('tag')
  @ApiOperation({ summary: '태그 목록 조회' })
  async getTagList(
    @Query('facilityId') facilityId?: string,
    @Query('measureType') measureType?: string,
    @Query('category') category?: string,
    @Query('energyType') energyType?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.settingsService.getTagList({
      facilityId,
      measureType,
      category,
      energyType,
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('tag/:id')
  @ApiOperation({ summary: '태그 상세 조회' })
  async getTag(@Param('id') id: string) {
    return this.settingsService.getTag(id);
  }

  @Post('tag')
  @ApiOperation({ summary: '태그 생성' })
  async createTag(@Body() dto: CreateTagDto) {
    return this.settingsService.createTag(dto);
  }

  @Put('tag/:id')
  @ApiOperation({ summary: '태그 수정' })
  async updateTag(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.settingsService.updateTag(id, dto);
  }

  @Delete('tag/:id')
  @ApiOperation({ summary: '태그 삭제' })
  async deleteTag(@Param('id') id: string) {
    return this.settingsService.deleteTag(id);
  }

  // ──────────────────────────────────────────────
  // 계층 구조 API (Hierarchy)
  // ──────────────────────────────────────────────
  @Get('hierarchy')
  @ApiOperation({ summary: '전체 계층 구조 조회' })
  async getHierarchy() {
    return this.settingsService.getHierarchy();
  }

  @Get('hierarchy/factory/:factoryId')
  @ApiOperation({ summary: '공장별 계층 구조 조회' })
  async getFactoryHierarchy(@Param('factoryId') factoryId: string) {
    return this.settingsService.getFactoryHierarchy(factoryId);
  }

  @Get('hierarchy/line/:lineId')
  @ApiOperation({ summary: '라인별 계층 구조 조회' })
  async getLineHierarchy(@Param('lineId') lineId: string) {
    return this.settingsService.getLineHierarchy(lineId);
  }

  @Get('hierarchy/facility/:facilityId')
  @ApiOperation({ summary: '설비별 태그 목록 조회' })
  async getFacilityTags(@Param('facilityId') facilityId: string) {
    return this.settingsService.getFacilityTags(facilityId);
  }

  // ──────────────────────────────────────────────
  // Phase 2: FacilityType API
  // ──────────────────────────────────────────────
  @Get('facility-type')
  @ApiOperation({ summary: '설비 유형 목록 조회' })
  async getFacilityTypeList(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.settingsService.getFacilityTypeList({
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Post('facility-type')
  @ApiOperation({ summary: '설비 유형 생성' })
  async createFacilityType(@Body() dto: CreateFacilityTypeDto) {
    return this.settingsService.createFacilityType(dto);
  }

  @Put('facility-type/:id')
  @ApiOperation({ summary: '설비 유형 수정' })
  async updateFacilityType(
    @Param('id') id: string,
    @Body() dto: UpdateFacilityTypeDto,
  ) {
    return this.settingsService.updateFacilityType(id, dto);
  }

  @Delete('facility-type/:id')
  @ApiOperation({ summary: '설비 유형 삭제' })
  async deleteFacilityType(@Param('id') id: string) {
    return this.settingsService.deleteFacilityType(id);
  }

  // ──────────────────────────────────────────────
  // Phase 2: Tag Bulk Upload API
  // ──────────────────────────────────────────────
  @Post('tag/bulk-upload')
  @ApiOperation({ summary: '태그 일괄 업로드 (Excel/CSV)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async bulkUploadTags(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only Excel (.xlsx, .xls) and CSV files are allowed');
    }

    return this.settingsService.processTagBulkUpload(file);
  }

  @Get('tag/bulk-template')
  @ApiOperation({ summary: '태그 일괄 업로드 템플릿 다운로드' })
  async downloadBulkTemplate(@Res() res: Response) {
    const buffer = await this.settingsService.generateTagBulkTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=tag-bulk-upload-template.xlsx');
    res.send(buffer);
  }

  // ──────────────────────────────────────────────
  // Phase 2: Tag Reassignment API
  // ──────────────────────────────────────────────
  @Post('tag/reassign')
  @ApiOperation({ summary: '태그 재할당' })
  async reassignTags(@Body() dto: TagReassignmentDto) {
    return this.settingsService.reassignTags(dto);
  }

  @Get('tag/:id/reassignment-history')
  @ApiOperation({ summary: '태그 재할당 이력 조회' })
  async getTagReassignmentHistory(@Param('id') id: string) {
    return this.settingsService.getTagReassignmentHistory(id);
  }

  // ──────────────────────────────────────────────
  // Energy Source Config (에너지 소스 매핑) API
  // ──────────────────────────────────────────────
  @Get('energy-config')
  @ApiOperation({ summary: '에너지 소스 매핑 목록 조회' })
  async getEnergyConfigList(
    @Query('lineCode') lineCode?: string,
    @Query('energyType') energyType?: string,
    @Query('needsReview') needsReview?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.settingsService.getEnergyConfigList({
      lineCode,
      energyType,
      needsReview: needsReview === 'true' ? true : needsReview === 'false' ? false : undefined,
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post('energy-config/auto-generate')
  @ApiOperation({ summary: '태그 기반 에너지 소스 매핑 자동 생성' })
  async autoGenerateEnergyConfigs() {
    return this.settingsService.autoGenerateEnergyConfigs();
  }

  @Get('energy-config/summary')
  @ApiOperation({ summary: '에너지 소스 매핑 요약 통계' })
  async getEnergyConfigSummary() {
    return this.settingsService.getEnergyConfigSummary();
  }

  @Get('energy-config/history')
  @ApiOperation({ summary: '에너지 소스 매핑 변경 이력 조회' })
  async getEnergyConfigHistory(
    @Query('facilityId') facilityId?: string,
    @Query('energyType') energyType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.settingsService.getEnergyConfigHistory({
      facilityId,
      energyType,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('energy-config/:id')
  @ApiOperation({ summary: '에너지 소스 매핑 상세 조회 (설비의 사용 가능한 태그 포함)' })
  async getEnergyConfig(@Param('id') id: string) {
    return this.settingsService.getEnergyConfig(id);
  }

  @Put('energy-config/:id')
  @ApiOperation({ summary: '에너지 소스 매핑 수정' })
  async updateEnergyConfig(
    @Param('id') id: string,
    @Body() dto: UpdateEnergyConfigDto,
  ) {
    return this.settingsService.updateEnergyConfig(id, dto);
  }

  // ──────────────────────────────────────────────
  // 비생산시간 설정 API (Non-Production Schedule)
  // ──────────────────────────────────────────────
  @Get('non-production-schedules')
  @ApiOperation({ summary: '전체 라인 비생산시간 스케줄 조회' })
  async getAllNonProductionSchedules() {
    return this.settingsService.getAllNonProductionSchedules();
  }

  @Get('non-production-schedules/:lineId')
  @ApiOperation({ summary: '라인별 비생산시간 스케줄 조회' })
  async getNonProductionSchedules(@Param('lineId') lineId: string) {
    return this.settingsService.getNonProductionSchedules(lineId);
  }

  @Put('non-production-schedules')
  @ApiOperation({ summary: '라인별 비생산시간 스케줄 저장 (전체 교체)' })
  async saveNonProductionSchedules(@Body() dto: SaveNonProductionSchedulesDto) {
    return this.settingsService.saveNonProductionSchedules(dto);
  }

  // ──────────────────────────────────────────────
  // 생산 캘린더 API (Production Calendar)
  // ──────────────────────────────────────────────
  @Get('production-calendar')
  @ApiOperation({ summary: '생산 캘린더 조회' })
  async getProductionCalendar(
    @Query('lineId') lineId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.settingsService.getProductionCalendar({
      lineId,
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
    });
  }

  @Post('production-calendar')
  @ApiOperation({ summary: '생산 캘린더 항목 추가' })
  async createProductionCalendar(@Body() dto: ProductionCalendarDto) {
    return this.settingsService.createProductionCalendar(dto);
  }

  @Delete('production-calendar/:id')
  @ApiOperation({ summary: '생산 캘린더 항목 삭제' })
  async deleteProductionCalendar(@Param('id') id: string) {
    return this.settingsService.deleteProductionCalendar(id);
  }
}
