import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as XLSX from 'xlsx';
import { CreateFacilityTypeDto, UpdateFacilityTypeDto } from './dto/facility-type.dto';
import { BulkUploadResponseDto, BulkUploadResultItem } from './dto/tag-bulk.dto';
import { TagReassignmentDto, TagReassignmentResponseDto } from './dto/tag-reassignment.dto';
import { SaveNonProductionSchedulesDto, ProductionCalendarDto } from './dto/non-production.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // SET001-SET006: 임계값 설정 (설비 기반 동적 생성)
  // ──────────────────────────────────────────────

  /**
   * 설비 목록 기반으로 카테고리별 임계값 설정 행을 생성합니다.
   * 실제 운영 환경에서는 별도 threshold_settings 테이블에 저장하지만,
   * 현재는 설비 마스터에서 동적으로 생성하여 반환합니다.
   */
  async getThresholdSettings(category: string) {
    this.logger.log(`Fetching threshold settings for category: ${category}`);

    const facilities = await this.prisma.facility.findMany({
      include: {
        line: { select: { code: true, name: true } },
      },
      orderBy: [{ line: { code: 'asc' } }, { process: 'asc' }, { code: 'asc' }],
    });

    return facilities.map((f) => {
      const defaults = this.getDefaultThresholds(category);
      return {
        id: f.id,
        facilityId: f.id,
        code: f.code,
        name: f.name,
        process: f.process ?? 'OP00',
        modelCode: f.type,
        threshold1: defaults.threshold1,
        threshold2: defaults.threshold2,
        enabled: true,
      };
    });
  }

  async saveThresholdSettings(category: string, rows: any[]) {
    this.logger.log(`Saving threshold settings for category: ${category}, ${rows.length} rows`);

    try {
      // Update facility metadata with threshold settings
      const updatePromises = rows.map(async (row) => {
        // Fetch current facility data
        const facility = await this.prisma.facility.findUnique({
          where: { id: row.facilityId },
        });

        const currentMetadata = (facility as any)?.metadata || {};
        const thresholds = currentMetadata.thresholds || {};

        // Update threshold for this category
        thresholds[category] = {
          threshold1: row.threshold1,
          threshold2: row.threshold2,
        };

        // Save back to database using raw Prisma
        return this.prisma.$executeRaw`
          UPDATE facilities
          SET metadata = ${JSON.stringify({ ...currentMetadata, thresholds })}::jsonb,
              "updatedAt" = NOW()
          WHERE id = ${row.facilityId}
        `;
      });

      await Promise.all(updatePromises);

      return { success: true, count: rows.length, message: 'Threshold settings saved successfully' };
    } catch (error) {
      this.logger.error('Error saving threshold settings:', error);
      throw error;
    }
  }

  /**
   * 기준 싸이클 파형 목록 (가공 설비만 대상)
   */
  async getReferenceCycles() {
    this.logger.log('Fetching reference cycles');

    const facilities = await this.prisma.facility.findMany({
      where: { isProcessing: true },
      include: {
        line: { select: { code: true, name: true } },
        referenceCycle: true,
      },
      orderBy: [{ line: { code: 'asc' } }, { code: 'asc' }],
    });

    return facilities.map((f) => {
      const hasReference = f.referenceCycle !== null;
      const energy = hasReference && f.referenceCycle ? this.calculateWaveformEnergy(f.referenceCycle.waveform) : null;
      const cycleTime = hasReference && f.referenceCycle ? Math.round(f.referenceCycle.duration) : null;

      return {
        id: f.id,
        code: f.code,
        name: f.name,
        process: f.process ?? 'OP00',
        modelCode: f.type,
        registeredAt: hasReference && f.referenceCycle
          ? f.referenceCycle.uploadedAt.toISOString().split('T')[0]
          : null,
        energy: energy ? Math.round(energy * 100) / 100 : null,
        cycleTime,
        active: hasReference,
      };
    });
  }

  // 파형 데이터에서 에너지 계산 (간단한 적분)
  private calculateWaveformEnergy(waveform: any): number {
    if (!Array.isArray(waveform) || waveform.length === 0) return 0;

    let totalEnergy = 0;
    for (let i = 0; i < waveform.length - 1; i++) {
      const current = waveform[i];
      const next = waveform[i + 1];
      const avgPower = (current.value + next.value) / 2;
      const duration = (next.sec - current.sec) / 3600; // 초 -> 시간
      totalEnergy += avgPower * duration;
    }

    return totalEnergy;
  }

  private getDefaultThresholds(category: string): { threshold1: number; threshold2: number } {
    switch (category) {
      case 'power_quality':
        return { threshold1: 1.0, threshold2: 93 };   // 불평형률 임계(%), 역률 기준(%)
      case 'air_leak':
        return { threshold1: 5000, threshold2: 20 };   // 비생산 에어 기준(L), 누기율 임계(%)
      case 'cycle_alert':
        return { threshold1: 90, threshold2: 3 };      // 유사도 임계(%), 지연 허용(사이클)
      case 'energy_alert':
        return { threshold1: 15, threshold2: 20 };     // 전월 대비 임계(%), 전년 대비 임계(%)
      case 'cycle_energy_alert':
        return { threshold1: 8.5, threshold2: 15 };    // 싸이클당 기준(kWh), 초과 임계(%)
      case 'anomaly_detection':
        return { threshold1: 5, threshold2: 2 };        // 이상 판정 배율(5배), 보간 허용 연속(2분)
      default:
        return { threshold1: 10, threshold2: 10 };
    }
  }

  // 일반 설정 조회 (MOCK DATA - NOT PRODUCTION READY)
  async getGeneralSettings() {
    this.logger.log('📊 Fetching general settings');
    // TODO: Implement real DB query (settings table)
    // PRIORITY: Must be fixed before production deployment
    return {
      language: 'ko',
      timezone: 'Asia/Seoul',
      theme: 'light',
      refreshInterval: 5000,
      enableNotifications: true,
    };
  }

  // 일반 설정 저장 (MOCK RESPONSE - NOT PRODUCTION READY)
  async saveGeneralSettings(settings: any) {
    this.logger.log('📊 Saving general settings:', settings);
    // TODO: Implement real DB mutation (INSERT/UPDATE settings table)
    // PRIORITY: Must be fixed before production deployment
    return { success: true, settings };
  }

  // 임계값 조회 (MOCK DATA - NOT PRODUCTION READY)
  async getThresholds() {
    this.logger.log('📊 Fetching thresholds');
    // TODO: Implement real DB query (thresholds table or facility metadata)
    // PRIORITY: Must be fixed before production deployment
    return {
      power: {
        warning: 100,
        critical: 120,
        unit: 'kWh',
      },
      air: {
        warning: 80000,
        critical: 100000,
        unit: 'L',
      },
      powerFactor: {
        warning: 0.85,
        critical: 0.80,
        unit: '',
      },
      imbalance: {
        warning: 5,
        critical: 10,
        unit: '%',
      },
    };
  }

  // ──────────────────────────────────────────────
  // 설비 마스터 관리
  // ──────────────────────────────────────────────
  async getFacilityMasterList(filters: {
    line?: string;
    process?: string;
    type?: string;
    search?: string;
  }) {
    this.logger.log('📊 Fetching facility master list', filters);

    const where: any = {};

    if (filters.line) {
      where.line = { code: filters.line.toUpperCase() };
    }

    if (filters.process) {
      where.process = filters.process;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const facilities = await this.prisma.facility.findMany({
      where,
      include: {
        line: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ line: { code: 'asc' } }, { process: 'asc' }, { code: 'asc' }],
    });

    // Frontend 형식으로 변환
    return facilities.map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      line: f.line.code.toLowerCase(),
      lineLabel: f.line.name,
      process: f.process,
      type: f.type,
      status: f.status,
      isProcessing: f.isProcessing,
    }));
  }

  async createFacilityMaster(data: any) {
    this.logger.log('📊 Creating facility master', data);

    const facility = await this.prisma.facility.create({
      data: {
        code: data.code,
        name: data.name,
        lineId: data.lineId,
        process: data.process,
        type: data.type,
        status: data.status || 'NORMAL',
        isProcessing: data.isProcessing ?? true,
      },
    });

    return { success: true, data: facility };
  }

  async updateFacilityMaster(id: string, data: any) {
    this.logger.log('📊 Updating facility master', { id, data });

    // line 코드('block') → lineId(UUID) 변환
    let lineId = data.lineId;
    if (data.line && !lineId) {
      const line = await this.prisma.line.findFirst({
        where: { code: { equals: data.line, mode: 'insensitive' } },
      });
      if (line) lineId = line.id;
    }

    const facility = await this.prisma.facility.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        ...(lineId ? { lineId } : {}),
        process: data.process,
        type: data.type,
        status: data.status,
        isProcessing: data.isProcessing,
      },
    });

    return { success: true, data: facility };
  }

  // ──────────────────────────────────────────────
  // 설비 공정 자동 할당
  // ──────────────────────────────────────────────
  async autoAssignProcess() {
    this.logger.log('⚙ 설비 공정 자동 할당 시작');

    const facilities = await this.prisma.facility.findMany({
      select: { id: true, code: true, name: true },
    });

    let updated = 0;
    for (const f of facilities) {
      const process = this.extractProcess(f.code);
      const { type, isProcessing } = this.inferType(f.code, f.name);

      await this.prisma.facility.update({
        where: { id: f.id },
        data: { process, type, isProcessing },
      });
      updated++;
    }

    this.logger.log(`⚙ 설비 공정 자동 할당 완료: ${updated}건`);
    return { success: true, updated };
  }

  /** 설비 코드에서 공정(OP) 번호 추출: HNK10_031A_1 → OP30 */
  private extractProcess(code: string): string {
    const segments = code.split('_');
    if (segments.length < 2) return 'OP0';
    const match = segments[1].match(/^\d+/);
    if (!match) return 'OP0';
    const num = parseInt(match[0], 10);
    const group = Math.floor(num / 10) * 10;
    return `OP${group}`;
  }

  /** 설비 코드/이름에서 유형 및 가공 여부 판별 */
  private inferType(code: string, name: string): { type: string; isProcessing: boolean } {
    const upper = code.toUpperCase();
    const lower = name.toLowerCase();
    if (upper.includes('COOLANT')) return { type: 'COOLING', isProcessing: false };
    if (lower.includes('컴프레서') || lower.includes('compressor')) return { type: 'COMPRESSOR', isProcessing: false };
    if (lower.includes('집진')) return { type: 'DUST', isProcessing: false };
    if (lower.includes('쿨링') || lower.includes('cooling')) return { type: 'COOLING', isProcessing: false };
    if (lower.includes('에어드라이')) return { type: 'AIR_DRY', isProcessing: false };
    return { type: 'MC', isProcessing: true };
  }

  async deleteFacilityMaster(id: string) {
    this.logger.log('📊 Deleting facility master', id);

    await this.prisma.facility.delete({
      where: { id },
    });

    return { success: true };
  }


  // ──────────────────────────────────────────────
  // Factory API Methods
  // ──────────────────────────────────────────────
  async getFactoryList() {
    this.logger.log('📊 Fetching factory list');

    const factories = await this.prisma.factory.findMany({
      include: {
        _count: {
          select: { lines: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return factories.map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      fullName: f.fullName,
      location: f.location,
      isActive: f.isActive,
      lineCount: f._count.lines,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  }

  async createFactory(data: any) {
    this.logger.log('📊 Creating factory', data);

    const factory = await this.prisma.factory.create({
      data: {
        code: data.code,
        name: data.name,
        fullName: data.fullName || null,
        location: data.location || null,
        isActive: data.isActive ?? true,
      },
    });

    return { success: true, data: factory };
  }

  async updateFactory(id: string, data: any) {
    this.logger.log('📊 Updating factory', id, data);

    const factory = await this.prisma.factory.update({
      where: { id },
      data: {
        name: data.name,
        fullName: data.fullName,
        location: data.location,
        isActive: data.isActive,
      },
    });

    return { success: true, data: factory };
  }

  async deleteFactory(id: string) {
    this.logger.log('📊 Deleting factory', id);

    await this.prisma.factory.delete({
      where: { id },
    });

    return { success: true };
  }

  // ──────────────────────────────────────────────
  // Line API Methods
  // ──────────────────────────────────────────────
  async getLineList(factoryId?: string) {
    this.logger.log('📊 Fetching line list', { factoryId });

    const where = factoryId ? { factoryId } : {};

    const lines = await this.prisma.line.findMany({
      where,
      include: {
        factory: true,
        _count: {
          select: { facilities: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    return lines.map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      factoryId: l.factoryId,
      factoryName: l.factory.name,
      order: l.order,
      isActive: l.isActive,
      facilityCount: l._count.facilities,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }));
  }

  async createLine(data: any) {
    this.logger.log('📊 Creating line', data);

    const line = await this.prisma.line.create({
      data: {
        code: data.code,
        name: data.name,
        factoryId: data.factoryId,
        order: data.order ?? 0,
        isActive: data.isActive ?? true,
      },
      include: { factory: true },
    });

    return { success: true, data: line };
  }

  async updateLine(id: string, data: any) {
    this.logger.log('📊 Updating line', id, data);

    const line = await this.prisma.line.update({
      where: { id },
      data: {
        name: data.name,
        order: data.order,
        isActive: data.isActive,
      },
      include: { factory: true },
    });

    return { success: true, data: line };
  }

  async deleteLine(id: string) {
    this.logger.log('📊 Deleting line', id);

    await this.prisma.line.delete({
      where: { id },
    });

    return { success: true };
  }

  // ──────────────────────────────────────────────
  // Tag API Methods
  // ──────────────────────────────────────────────
  async getTagList(filters: {
    facilityId?: string;
    measureType?: string;
    category?: string;
    energyType?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    this.logger.log('📊 Fetching tag list', filters);

    const where: any = {};

    if (filters.facilityId) where.facilityId = filters.facilityId;
    if (filters.measureType) where.measureType = filters.measureType;
    if (filters.category) where.category = filters.category;
    if (filters.energyType) where.energyType = filters.energyType;
    if (filters.search) {
      where.OR = [
        { tagName: { contains: filters.search, mode: 'insensitive' } },
        { displayName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Pagination parameters with defaults
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [tags, total] = await Promise.all([
      this.prisma.tag.findMany({
        where,
        include: {
          facility: {
            include: {
              line: {
                include: {
                  factory: true,
                },
              },
            },
          },
        },
        orderBy: [{ facility: { code: 'asc' } }, { order: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.tag.count({ where }),
    ]);

    const data = tags.map((t) => ({
      id: t.id,
      tagName: t.tagName,
      displayName: t.displayName,
      measureType: t.measureType,
      category: t.category,
      energyType: t.energyType,
      unit: t.unit,
      order: t.order,
      isActive: t.isActive,
      facilityId: t.facilityId,
      facilityCode: t.facility.code,
      facilityName: t.facility.name,
      lineCode: t.facility.line.code,
      lineName: t.facility.line.name,
      factoryCode: t.facility.line.factory.code,
      factoryName: t.facility.line.factory.name,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getTag(id: string) {
    this.logger.log('📊 Fetching tag detail', id);

    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        facility: {
          include: {
            line: {
              include: {
                factory: true,
              },
            },
          },
        },
      },
    });

    return tag;
  }

  async createTag(data: any) {
    this.logger.log('📊 Creating tag', data);

    const tag = await this.prisma.tag.create({
      data: {
        facilityId: data.facilityId,
        tagName: data.tagName,
        displayName: data.displayName,
        measureType: data.measureType,
        category: data.category,
        energyType: data.energyType || null,
        unit: data.unit || null,
        order: data.order ?? 0,
        isActive: data.isActive ?? true,
      },
    });

    return { success: true, data: tag };
  }

  async updateTag(id: string, data: any) {
    this.logger.log('📊 Updating tag', id, data);

    const tag = await this.prisma.tag.update({
      where: { id },
      data: {
        displayName: data.displayName,
        measureType: data.measureType,
        category: data.category,
        energyType: data.energyType,
        unit: data.unit,
        order: data.order,
        isActive: data.isActive,
      },
    });

    return { success: true, data: tag };
  }

  async deleteTag(id: string) {
    this.logger.log('📊 Deleting tag', id);

    await this.prisma.tag.delete({
      where: { id },
    });

    return { success: true };
  }

  // ──────────────────────────────────────────────
  // Hierarchy API Methods
  // ──────────────────────────────────────────────
  async getHierarchy() {
    this.logger.log('📊 Fetching full hierarchy');

    const factories = await this.prisma.factory.findMany({
      include: {
        lines: {
          include: {
            facilities: {
              include: {
                _count: {
                  select: { tags: true },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    return factories.map((factory) => ({
      id: factory.id,
      code: factory.code,
      name: factory.name,
      fullName: factory.fullName,
      location: factory.location,
      isActive: factory.isActive,
      lines: factory.lines.map((line) => ({
        id: line.id,
        code: line.code,
        name: line.name,
        order: line.order,
        isActive: line.isActive,
        facilities: line.facilities.map((facility) => ({
          id: facility.id,
          code: facility.code,
          name: facility.name,
          process: facility.process ?? 'OP00',
          type: facility.type,
          status: facility.status,
          isProcessing: facility.isProcessing,
          tagCount: facility._count.tags,
        })),
      })),
    }));
  }

  async getFactoryHierarchy(factoryId: string) {
    this.logger.log('📊 Fetching factory hierarchy', factoryId);

    const factory = await this.prisma.factory.findUnique({
      where: { id: factoryId },
      include: {
        lines: {
          include: {
            facilities: {
              include: {
                _count: {
                  select: { tags: true },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return factory;
  }

  async getLineHierarchy(lineId: string) {
    this.logger.log('📊 Fetching line hierarchy', lineId);

    const line = await this.prisma.line.findUnique({
      where: { id: lineId },
      include: {
        factory: true,
        facilities: {
          include: {
            _count: {
              select: { tags: true },
            },
          },
          orderBy: { code: 'asc' },
        },
      },
    });

    return line;
  }

  async getFacilityTags(facilityId: string) {
    this.logger.log('📊 Fetching facility tags', facilityId);

    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      include: {
        line: {
          include: {
            factory: true,
          },
        },
        tags: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return facility;
  }

  // ============================================================
  // Phase 2: FacilityType CRUD
  // ============================================================

  async getFacilityTypeList(filters?: { search?: string; isActive?: boolean }) {
    this.logger.log('📊 Fetching facility type list', filters);

    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const types = await this.prisma.facilityType.findMany({
      where,
      include: {
        _count: {
          select: { facilities: true },
        },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    return types.map((type) => ({
      ...type,
      facilityCount: type._count.facilities,
    }));
  }

  async createFacilityType(data: CreateFacilityTypeDto) {
    this.logger.log('✏️ Creating facility type', data);

    // Generate ID
    const id = `facilitytype-${data.code.toLowerCase()}`;

    return this.prisma.facilityType.create({
      data: {
        id,
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        isActive: data.isActive ?? true,
        order: data.order ?? 0,
      },
    });
  }

  async updateFacilityType(id: string, data: UpdateFacilityTypeDto) {
    this.logger.log('✏️ Updating facility type', id, data);

    return this.prisma.facilityType.update({
      where: { id },
      data: {
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
  }

  async deleteFacilityType(id: string) {
    this.logger.log('🗑️ Deleting facility type', id);

    // Check if any facilities are using this type
    const count = await this.prisma.facility.count({ where: { typeId: id } });
    if (count > 0) {
      throw new BadRequestException(
        `Cannot delete facility type: ${count} facilities are using this type`,
      );
    }

    return this.prisma.facilityType.delete({ where: { id } });
  }

  // ============================================================
  // Phase 2: Tag Bulk Upload
  // ============================================================

  async processTagBulkUpload(file: Express.Multer.File): Promise<BulkUploadResponseDto> {
    this.logger.log('📤 Processing tag bulk upload', file.originalname);

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const results: BulkUploadResultItem[] = [];
    let successCount = 0;
    let failedCount = 0;
    let warningCount = 0;

    const tagsToCreate: any[] = [];

    // Validate and prepare data
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      const rowNumber = i + 2; // Excel row (header is row 1)

      try {
        // Validate required fields
        const errors: string[] = [];

        if (!row.facilityCode) errors.push('facilityCode is required');
        if (!row.tagName) errors.push('tagName is required');
        if (!row.displayName) errors.push('displayName is required');
        if (!row.measureType) errors.push('measureType is required');
        if (!row.category) errors.push('category is required');

        if (errors.length > 0) {
          results.push({
            row: rowNumber,
            status: 'error',
            data: row,
            errors,
          });
          failedCount++;
          continue;
        }

        // Find facility by code
        const facility = await this.prisma.facility.findFirst({
          where: { code: row.facilityCode },
        });

        if (!facility) {
          results.push({
            row: rowNumber,
            status: 'error',
            data: row,
            message: `Facility not found: ${row.facilityCode}`,
          });
          failedCount++;
          continue;
        }

        // Check duplicate tagName
        const existing = await this.prisma.tag.findFirst({
          where: { tagName: row.tagName },
        });

        if (existing) {
          results.push({
            row: rowNumber,
            status: 'error',
            data: row,
            message: `Duplicate tagName: ${row.tagName}`,
          });
          failedCount++;
          continue;
        }

        // Validate enums
        if (!['INSTANTANEOUS', 'CUMULATIVE', 'DISCRETE'].includes(row.measureType)) {
          results.push({
            row: rowNumber,
            status: 'error',
            data: row,
            message: `Invalid measureType: ${row.measureType}`,
          });
          failedCount++;
          continue;
        }

        if (!['ENERGY', 'QUALITY', 'ENVIRONMENT', 'OPERATION', 'CONTROL'].includes(row.category)) {
          results.push({
            row: rowNumber,
            status: 'error',
            data: row,
            message: `Invalid category: ${row.category}`,
          });
          failedCount++;
          continue;
        }

        if (row.energyType && !['elec', 'air', 'gas', 'solar'].includes(row.energyType)) {
          results.push({
            row: rowNumber,
            status: 'warning',
            data: row,
            message: `Invalid energyType: ${row.energyType} (will be set to null)`,
          });
          warningCount++;
        }

        // Generate tag ID
        const tagId = `tag-${row.tagName.toLowerCase()}`;

        // Prepare tag data
        const tagData = {
          id: tagId,
          facilityId: facility.id,
          tagName: row.tagName,
          displayName: row.displayName,
          measureType: row.measureType,
          category: row.category,
          energyType: row.energyType || null,
          unit: row.unit || null,
          order: row.order || 0,
          isActive: true,
        };

        tagsToCreate.push(tagData);

        results.push({
          row: rowNumber,
          status: 'success',
          data: tagData,
        });
        successCount++;
      } catch (error) {
        results.push({
          row: rowNumber,
          status: 'error',
          data: row,
          message: error.message,
        });
        failedCount++;
      }
    }

    // If all validations passed, insert in a single transaction
    if (failedCount === 0 && tagsToCreate.length > 0) {
      await this.prisma.tag.createMany({
        data: tagsToCreate,
      });
      this.logger.log(`✅ Successfully created ${tagsToCreate.length} tags`);
    }

    return {
      total: data.length,
      success: successCount,
      failed: failedCount,
      warnings: warningCount,
      results,
    };
  }

  async generateTagBulkTemplate(): Promise<Buffer> {
    this.logger.log('📄 Generating tag bulk upload template');

    const templateData = [
      {
        facilityCode: 'HNK10-010-1',
        tagName: 'HNK10_010_1_KWH_1',
        displayName: '전력 적산량',
        measureType: 'CUMULATIVE',
        category: 'ENERGY',
        energyType: 'elec',
        unit: 'kWh',
        order: 1,
      },
      {
        facilityCode: 'HNK10-010-2',
        tagName: 'HNK10_010_2_AIR_L_1',
        displayName: '에어 적산량',
        measureType: 'CUMULATIVE',
        category: 'ENERGY',
        energyType: 'air',
        unit: 'm³',
        order: 2,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tags');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ============================================================
  // Phase 2: Tag Reassignment
  // ============================================================

  async reassignTags(dto: TagReassignmentDto): Promise<TagReassignmentResponseDto> {
    this.logger.log('🔄 Reassigning tags', dto);

    // Validate target facility exists
    const targetFacility = await this.prisma.facility.findUnique({
      where: { id: dto.targetFacilityId },
    });

    if (!targetFacility) {
      throw new NotFoundException(`Target facility not found: ${dto.targetFacilityId}`);
    }

    const results: TagReassignmentResponseDto['results'] = [];
    let successCount = 0;
    let failedCount = 0;

    // Process each tag in a transaction
    await this.prisma.$transaction(async (prisma) => {
      for (const tagId of dto.tagIds) {
        try {
          // Get current tag with facility
          const tag = await prisma.tag.findUnique({
            where: { id: tagId },
            include: { facility: true },
          });

          if (!tag) {
            results.push({
              tagId,
              tagName: 'Unknown',
              status: 'error',
              message: 'Tag not found',
            });
            failedCount++;
            continue;
          }

          const fromFacilityId = tag.facilityId;

          // Skip if already in target facility
          if (fromFacilityId === dto.targetFacilityId) {
            results.push({
              tagId,
              tagName: tag.tagName,
              status: 'error',
              message: 'Tag is already in target facility',
            });
            failedCount++;
            continue;
          }

          // Update tag's facilityId
          await prisma.tag.update({
            where: { id: tagId },
            data: { facilityId: dto.targetFacilityId },
          });

          // Generate reassignment log ID
          const logId = `reassignment-${Date.now()}-${tagId}`;

          // Create reassignment log
          await prisma.tagReassignmentLog.create({
            data: {
              id: logId,
              tagId,
              fromFacilityId,
              toFacilityId: dto.targetFacilityId,
              reason: dto.reason,
              reassignedBy: dto.reassignedBy,
            },
          });

          results.push({
            tagId,
            tagName: tag.tagName,
            status: 'success',
          });
          successCount++;
        } catch (error) {
          results.push({
            tagId,
            tagName: 'Unknown',
            status: 'error',
            message: error.message,
          });
          failedCount++;
        }
      }
    });

    this.logger.log(`✅ Reassignment complete: ${successCount} success, ${failedCount} failed`);

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  async getTagReassignmentHistory(tagId: string) {
    this.logger.log('📜 Fetching tag reassignment history', tagId);

    return this.prisma.tagReassignmentLog.findMany({
      where: { tagId },
      include: {
        fromFacility: { select: { code: true, name: true } },
        toFacility: { select: { code: true, name: true } },
      },
      orderBy: { reassignedAt: 'desc' },
    });
  }

  // ============================================================
  // Energy Source Config (에너지 소스 매핑) CRUD
  // ============================================================

  async getEnergyConfigList(filters: {
    lineCode?: string;
    energyType?: string;
    needsReview?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    this.logger.log('📊 Fetching energy config list', filters);

    const where: any = {};

    if (filters.energyType) where.energyType = filters.energyType;
    if (filters.needsReview !== undefined) where.needsReview = filters.needsReview;

    if (filters.lineCode) {
      where.facility = { line: { code: filters.lineCode } };
    }

    if (filters.search) {
      where.OR = [
        { facility: { code: { contains: filters.search, mode: 'insensitive' } } },
        { facility: { name: { contains: filters.search, mode: 'insensitive' } } },
        { configTags: { some: { tag: { tagName: { contains: filters.search, mode: 'insensitive' } } } } },
      ];
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [configs, total] = await Promise.all([
      this.prisma.facilityEnergyConfig.findMany({
        where,
        include: {
          facility: {
            include: {
              line: { select: { code: true, name: true } },
            },
          },
          configTags: {
            where: { isActive: true },
            include: {
              tag: { select: { id: true, tagName: true, displayName: true, measureType: true } },
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: [{ facility: { code: 'asc' } }, { energyType: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.facilityEnergyConfig.count({ where }),
    ]);

    // 설비+에너지타입별 가용 적산(CUMULATIVE) 태그 수 조회
    // 같은 에너지원의 적산 태그가 있어야 전환 가능 (예: air config → air CUMULATIVE 태그 필요)
    const facilityIds = [...new Set(configs.map((c) => c.facilityId))];
    const cumulativeCounts = facilityIds.length > 0
      ? await this.prisma.tag.groupBy({
          by: ['facilityId', 'energyType'],
          where: {
            facilityId: { in: facilityIds },
            measureType: 'CUMULATIVE',
            category: 'ENERGY',
          },
          _count: true,
        })
      : [];
    // key: "facilityId|energyType" → count
    const cumulativeMap = new Map(
      cumulativeCounts.map((c) => [`${c.facilityId}|${c.energyType}`, c._count]),
    );

    const data = configs.map((c) => {
      const cumKey = `${c.facilityId}|${c.energyType}`;
      const cumCount = cumulativeMap.get(cumKey) || 0;
      return {
      id: c.id,
      facilityId: c.facilityId,
      facilityCode: c.facility.code,
      facilityName: c.facility.name,
      lineCode: c.facility.line.code,
      lineName: c.facility.line.name,
      energyType: c.energyType,
      calcMethod: c.calcMethod,
      tags: c.configTags.map((ct) => ({
        id: ct.tag.id,
        tagName: ct.tag.tagName,
        displayName: ct.tag.displayName,
        measureType: ct.tag.measureType,
        isActive: ct.isActive,
      })),
      tagCount: c.configTags.length,
      hasCumulativeTag: cumCount > 0,
      cumulativeTagCount: cumCount,
      description: c.description,
      configuredBy: c.configuredBy,
      needsReview: c.needsReview,
      isActive: c.isActive,
      since: c.since,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      };
    });

    return {
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getEnergyConfig(id: string) {
    this.logger.log('📊 Fetching energy config detail', id);

    const config = await this.prisma.facilityEnergyConfig.findUnique({
      where: { id },
      include: {
        facility: {
          include: {
            line: { select: { code: true, name: true } },
            tags: {
              where: { isActive: true, category: 'ENERGY' },
              select: { id: true, tagName: true, displayName: true, measureType: true, energyType: true, unit: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        configTags: {
          include: {
            tag: { select: { id: true, tagName: true, displayName: true, measureType: true, energyType: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!config) throw new NotFoundException(`Energy config not found: ${id}`);

    return {
      id: config.id,
      facilityId: config.facilityId,
      facilityCode: config.facility.code,
      facilityName: config.facility.name,
      lineCode: config.facility.line.code,
      lineName: config.facility.line.name,
      energyType: config.energyType,
      calcMethod: config.calcMethod,
      description: config.description,
      needsReview: config.needsReview,
      isActive: config.isActive,
      since: config.since,
      // 현재 매핑된 태그들
      tags: config.configTags.map((ct) => ({
        id: ct.tag.id,
        tagName: ct.tag.tagName,
        displayName: ct.tag.displayName,
        measureType: ct.tag.measureType,
        isActive: ct.isActive,
        configTagId: ct.id,
      })),
      // 매핑 가능한 전체 태그 목록
      availableTags: config.facility.tags.filter((t) => t.energyType === config.energyType),
    };
  }

  async updateEnergyConfig(id: string, data: {
    calcMethod?: string;
    tagIds?: string[];       // 매핑할 태그 ID 배열
    description?: string;
    configuredBy?: string;
    needsReview?: boolean;
    isActive?: boolean;
  }) {
    this.logger.log('✏️ Updating energy config', id, data);

    const current = await this.prisma.facilityEnergyConfig.findUnique({
      where: { id },
      include: { configTags: { include: { tag: { select: { tagName: true } } } } },
    });
    if (!current) throw new NotFoundException(`Energy config not found: ${id}`);

    const calcMethod = (data.calcMethod as any) ?? current.calcMethod;
    const needsReview = data.needsReview ?? (calcMethod === 'INTEGRAL_TRAP');

    // 트랜잭션
    await this.prisma.$transaction(async (tx) => {
      // 1. config 헤더 업데이트
      await tx.facilityEnergyConfig.update({
        where: { id },
        data: {
          calcMethod,
          description: data.description,
          configuredBy: data.configuredBy,
          needsReview,
          isActive: data.isActive,
        },
      });

      // 2. calcMethod 변경 이력
      if (data.calcMethod && data.calcMethod !== current.calcMethod) {
        await tx.facilityEnergyConfigHistory.create({
          data: {
            facilityId: current.facilityId,
            energyType: current.energyType,
            action: 'UPDATE',
            prevCalcMethod: current.calcMethod,
            newCalcMethod: calcMethod,
            reason: data.description,
            changedBy: data.configuredBy,
          },
        });
      }

      // 3. 태그 매핑 업데이트 (tagIds가 있으면)
      if (data.tagIds) {
        const currentTagIds = current.configTags.map((ct) => ct.tagId);
        const newTagIds = data.tagIds;

        // 제거할 태그
        const toRemove = currentTagIds.filter((tid) => !newTagIds.includes(tid));
        // 추가할 태그
        const toAdd = newTagIds.filter((tid) => !currentTagIds.includes(tid));

        // 제거
        if (toRemove.length > 0) {
          await tx.facilityEnergyConfigTag.deleteMany({
            where: { configId: id, tagId: { in: toRemove } },
          });
          for (const tagId of toRemove) {
            const tagName = current.configTags.find((ct) => ct.tagId === tagId)?.tag.tagName;
            await tx.facilityEnergyConfigHistory.create({
              data: {
                facilityId: current.facilityId,
                energyType: current.energyType,
                action: 'TAG_REMOVE',
                tagId,
                tagName,
                reason: data.description,
                changedBy: data.configuredBy,
              },
            });
          }
        }

        // 추가
        if (toAdd.length > 0) {
          const addedTags = await tx.tag.findMany({ where: { id: { in: toAdd } }, select: { id: true, tagName: true } });
          for (let i = 0; i < addedTags.length; i++) {
            await tx.facilityEnergyConfigTag.create({
              data: { configId: id, tagId: addedTags[i].id, order: currentTagIds.length + i },
            });
            await tx.facilityEnergyConfigHistory.create({
              data: {
                facilityId: current.facilityId,
                energyType: current.energyType,
                action: 'TAG_ADD',
                tagId: addedTags[i].id,
                tagName: addedTags[i].tagName,
                reason: data.description,
                changedBy: data.configuredBy,
              },
            });
          }
        }
      }
    });

    return { success: true };
  }

  async getEnergyConfigHistory(filters: {
    facilityId?: string;
    energyType?: string;
    page?: number;
    pageSize?: number;
  }) {
    this.logger.log('📜 Fetching energy config history', filters);

    const where: any = {};
    if (filters.facilityId) where.facilityId = filters.facilityId;
    if (filters.energyType) where.energyType = filters.energyType;

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [histories, total] = await Promise.all([
      this.prisma.facilityEnergyConfigHistory.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.facilityEnergyConfigHistory.count({ where }),
    ]);

    return {
      data: histories.map((h) => ({
        id: h.id,
        facilityId: h.facilityId,
        energyType: h.energyType,
        action: h.action,
        prevCalcMethod: h.prevCalcMethod,
        newCalcMethod: h.newCalcMethod,
        tagId: h.tagId,
        tagName: h.tagName,
        reason: h.reason,
        changedBy: h.changedBy,
        changedAt: h.changedAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async autoGenerateEnergyConfigs() {
    this.logger.log('🔄 Auto-generating energy configs from tag data');

    const facilities: any[] = await this.prisma.facility.findMany({
      include: {
        tags: {
          where: { isActive: true, category: 'ENERGY' },
          select: { id: true, tagName: true, measureType: true, energyType: true },
        },
        energyConfigs: { select: { id: true, energyType: true } },
      },
    });

    let created = 0;
    let skipped = 0;
    let tagsMapped = 0;

    for (const fac of facilities) {
      for (const eType of ['elec', 'air'] as const) {
        // 이미 config가 있으면 건너뜀
        if (fac.energyConfigs.some((c: any) => c.energyType === eType)) {
          skipped++;
          continue;
        }

        const energyTags = fac.tags.filter((t: any) => t.energyType === eType);
        if (energyTags.length === 0) continue;

        const cumulativeTags = energyTags.filter((t: any) => t.measureType === 'CUMULATIVE');
        const instantaneousTags = energyTags.filter((t: any) => t.measureType === 'INSTANTANEOUS');

        const useDiff = cumulativeTags.length > 0;
        const calcMethod = useDiff ? 'DIFF' : 'INTEGRAL_TRAP';
        const sourceTags = useDiff ? cumulativeTags : instantaneousTags;

        if (sourceTags.length === 0) continue;

        const config = await this.prisma.facilityEnergyConfig.create({
          data: {
            facilityId: fac.id,
            energyType: eType,
            calcMethod: calcMethod as any,
            needsReview: !useDiff,
            configuredBy: 'auto-generate',
          },
        });

        for (let i = 0; i < sourceTags.length; i++) {
          await this.prisma.facilityEnergyConfigTag.create({
            data: { configId: config.id, tagId: sourceTags[i].id, order: i },
          });
          tagsMapped++;
        }

        created++;
      }
    }

    this.logger.log(`✅ Auto-generate complete: ${created} created, ${skipped} skipped, ${tagsMapped} tags mapped`);

    return { created, skipped, tagsMapped };
  }

  // ============================================================
  // 비생산시간 설정 (Non-Production Schedule & Calendar)
  // ============================================================

  async getNonProductionSchedules(lineId: string) {
    this.logger.log('📊 Fetching non-production schedules', lineId);

    return this.prisma.nonProductionSchedule.findMany({
      where: { lineId },
      orderBy: { dayType: 'asc' },
    });
  }

  async getAllNonProductionSchedules() {
    this.logger.log('📊 Fetching all non-production schedules');

    const lines = await this.prisma.line.findMany({
      include: {
        nonProductionSchedules: { orderBy: { dayType: 'asc' } },
      },
      orderBy: { order: 'asc' },
    });

    return lines.map((l) => ({
      lineId: l.id,
      lineCode: l.code,
      lineName: l.name,
      schedules: l.nonProductionSchedules.map((s) => ({
        id: s.id,
        dayType: s.dayType,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    }));
  }

  async saveNonProductionSchedules(dto: SaveNonProductionSchedulesDto) {
    this.logger.log('💾 Saving non-production schedules', dto.lineId);

    // 라인 존재 확인
    const line = await this.prisma.line.findUnique({ where: { id: dto.lineId } });
    if (!line) throw new NotFoundException(`Line not found: ${dto.lineId}`);

    // 트랜잭션: 기존 삭제 + 새로 생성
    await this.prisma.$transaction(async (tx) => {
      await tx.nonProductionSchedule.deleteMany({ where: { lineId: dto.lineId } });

      for (const s of dto.schedules) {
        await tx.nonProductionSchedule.create({
          data: {
            lineId: dto.lineId,
            dayType: s.dayType as any,
            startTime: s.startTime,
            endTime: s.endTime,
          },
        });
      }
    });

    return { success: true, count: dto.schedules.length };
  }

  async getProductionCalendar(filters: { lineId?: string; year?: number; month?: number }) {
    this.logger.log('📊 Fetching production calendar', filters);

    const where: any = {};

    if (filters.lineId) {
      where.OR = [{ lineId: filters.lineId }, { lineId: null }];
    }

    if (filters.year) {
      const start = new Date(filters.year, (filters.month ?? 1) - 1, 1);
      const end = filters.month
        ? new Date(filters.year, filters.month, 0)
        : new Date(filters.year, 11, 31);
      where.date = { gte: start, lte: end };
    }

    const entries = await this.prisma.productionCalendar.findMany({
      where,
      include: { line: { select: { code: true, name: true } } },
      orderBy: { date: 'asc' },
    });

    return entries.map((e) => ({
      id: e.id,
      lineId: e.lineId,
      lineCode: e.line?.code ?? null,
      lineName: e.line?.name ?? null,
      date: e.date.toISOString().slice(0, 10),
      type: e.type,
      description: e.description,
    }));
  }

  async createProductionCalendar(dto: ProductionCalendarDto) {
    this.logger.log('📅 Creating production calendar entry', dto);

    const entry = await this.prisma.productionCalendar.create({
      data: {
        lineId: dto.lineId || null,
        date: new Date(dto.date + 'T00:00:00'),
        type: dto.type as any,
        description: dto.description,
      },
    });

    return { success: true, data: entry };
  }

  async deleteProductionCalendar(id: string) {
    this.logger.log('🗑️ Deleting production calendar entry', id);

    await this.prisma.productionCalendar.delete({ where: { id } });

    return { success: true };
  }

  async getEnergyConfigSummary() {
    this.logger.log('📊 Fetching energy config summary');

    const [total, needsReview, byCalcMethod, byEnergyType, totalTags] = await Promise.all([
      this.prisma.facilityEnergyConfig.count({ where: { isActive: true } }),
      this.prisma.facilityEnergyConfig.count({ where: { needsReview: true, isActive: true } }),
      this.prisma.facilityEnergyConfig.groupBy({
        by: ['calcMethod'],
        where: { isActive: true },
        _count: true,
      }),
      this.prisma.facilityEnergyConfig.groupBy({
        by: ['energyType'],
        where: { isActive: true },
        _count: true,
      }),
      this.prisma.facilityEnergyConfigTag.count({ where: { isActive: true } }),
    ]);

    // 순시적분 중 같은 에너지원의 적산 태그가 있는 건수 계산
    const integralConfigs = await this.prisma.facilityEnergyConfig.findMany({
      where: { calcMethod: 'INTEGRAL_TRAP', isActive: true },
      select: { facilityId: true, energyType: true },
    });
    // 설비+에너지타입별 CUMULATIVE 태그 존재 여부 확인
    const integralFacilityIds = [...new Set(integralConfigs.map((c) => c.facilityId))];
    const switchableCounts = integralFacilityIds.length > 0
      ? await this.prisma.tag.groupBy({
          by: ['facilityId', 'energyType'],
          where: {
            facilityId: { in: integralFacilityIds },
            measureType: 'CUMULATIVE',
            category: 'ENERGY',
          },
          _count: true,
        })
      : [];
    const switchableSet = new Set(
      switchableCounts.map((c) => `${c.facilityId}|${c.energyType}`),
    );
    const switchableCount = integralConfigs.filter(
      (c) => switchableSet.has(`${c.facilityId}|${c.energyType}`),
    ).length;

    return {
      total,
      totalTags,
      needsReview,
      switchableCount,
      integralCount: integralConfigs.length,
      byCalcMethod: byCalcMethod.map((g) => ({ calcMethod: g.calcMethod, count: g._count })),
      byEnergyType: byEnergyType.map((g) => ({ energyType: g.energyType, count: g._count })),
    };
  }

  // ──────────────────────────────────────────────
  // 시스템 설정 (system_settings 테이블)
  // ──────────────────────────────────────────────

  async getSystemSettings(): Promise<Record<string, any>> {
    const rows = await this.prisma.$queryRaw<{ key: string; value: any; description: string | null }[]>`
      SELECT key, value, description FROM system_settings ORDER BY key
    `;
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.key] = { value: row.value, description: row.description };
    }
    return result;
  }

  async getSystemSetting(key: string): Promise<any> {
    const rows = await this.prisma.$queryRaw<{ value: any }[]>`
      SELECT value FROM system_settings WHERE key = ${key}
    `;
    return rows[0]?.value ?? null;
  }

  async saveSystemSetting(key: string, value: any, description?: string) {
    await this.prisma.$executeRaw`
      INSERT INTO system_settings (key, value, description, "updatedAt")
      VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${description ?? null}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}::jsonb, "updatedAt" = NOW()
    `;
    return { key, value };
  }

  async saveSystemSettings(settings: Record<string, any>) {
    for (const [key, val] of Object.entries(settings)) {
      await this.saveSystemSetting(key, val.value, val.description);
    }
    return this.getSystemSettings();
  }

  // ──────────────────────────────────────────────
  // CYCLE_MMS_MAPPING 관리
  // ──────────────────────────────────────────────

  async getCycleMappings() {
    this.logger.log('Fetching cycle mappings');

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m."MACH_ID" as "machId", m."TAG_NAME" as "tagName",
        m."PLANT_CD" as "plantCd", m."LINE_CD" as "lineCd",
        m."MCN_CD" as "mcnCd", m."ENERGY_TYPE" as "energyType",
        m."TARGET_YN" as "targetYn",
        f.id as "facilityId", f.code as "facilityCode", f.name as "facilityName"
      FROM "CYCLE_MMS_MAPPING" m
      LEFT JOIN tags t ON t."tagName" = m."TAG_NAME"
      LEFT JOIN facilities f ON f.id = t."facilityId"
      ORDER BY m."MACH_ID", m."TAG_NAME"
    `);

    return rows;
  }

  async updateCycleMapping(machId: number, tagName: string, data: { targetYn?: number; machId?: number }) {
    this.logger.log(`Updating cycle mapping: MACH_ID=${machId}, TAG_NAME=${tagName}`);

    const sets: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (data.targetYn !== undefined) {
      sets.push(`"TARGET_YN" = $${paramIdx++}`);
      params.push(data.targetYn);
    }
    if (data.machId !== undefined) {
      sets.push(`"MACH_ID" = $${paramIdx++}`);
      params.push(data.machId);
    }

    if (sets.length === 0) return { updated: 0 };

    params.push(machId, tagName);
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE "CYCLE_MMS_MAPPING" SET ${sets.join(', ')} WHERE "MACH_ID" = $${paramIdx++} AND "TAG_NAME" = $${paramIdx}`,
      ...params,
    );

    return { updated: result };
  }
}
