# Tag Management Phase 2 상세 설계

**Feature**: tag-management-phase2
**Created**: 2026-02-23
**Phase**: Design
**Dependencies**: tag-management (Phase 1, Match Rate 93%)

## 📐 아키텍처 개요

Phase 2는 Phase 1의 기본 CRUD 위에 고급 관리 기능을 추가합니다.

```
┌─────────────────────────────────────────────────┐
│          Frontend (React 19 + Vite 6)           │
├─────────────────────────────────────────────────┤
│ SET-011: FacilityType CRUD                      │
│ SET-012: Tag Bulk Upload + Reassignment         │
└─────────────────┬───────────────────────────────┘
                  │ REST API
┌─────────────────┴───────────────────────────────┐
│         Backend (NestJS 11 + Prisma)            │
├─────────────────────────────────────────────────┤
│ SettingsModule:                                 │
│  - FacilityType CRUD                            │
│  - Tag Bulk Upload (xlsx, csv-parser, multer)  │
│  - Tag Reassignment (Transaction)              │
└─────────────────┬───────────────────────────────┘
                  │ Prisma ORM
┌─────────────────┴───────────────────────────────┐
│         PostgreSQL 192.168.123.205:5432         │
│         Database: ifems                         │
├─────────────────────────────────────────────────┤
│ Tables:                                         │
│  - facility_types (신규)                        │
│  - facilities (typeId FK 추가)                 │
│  - tags (기존)                                  │
│  - tag_reassignment_log (신규, Audit)          │
└─────────────────────────────────────────────────┘
```

## 🗄️ 데이터베이스 설계

### 1. FacilityType 테이블 (신규)

```prisma
model FacilityType {
  id          String     @id @default(uuid())
  code        String     @unique @db.VarChar(50)
  name        String     @db.VarChar(100)
  description String?    @db.Text
  color       String?    @db.VarChar(7)  // Hex color (예: #FF5733)
  icon        String?    @db.VarChar(50) // lucide-react icon name
  isActive    Boolean    @default(true)
  order       Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  facilities  Facility[]

  @@map("facility_types")
}
```

### 2. Facility 테이블 확장

```prisma
model Facility {
  // ... 기존 필드들 ...

  typeId      String?         @db.Uuid  // 신규 FK
  type        FacilityType?   @relation(fields: [typeId], references: [id], onDelete: SetNull)

  // ... 나머지 필드들 ...
}
```

### 3. TagReassignmentLog 테이블 (신규, Audit)

```prisma
model TagReassignmentLog {
  id                String    @id @default(uuid())
  tagId             String    @db.Uuid
  fromFacilityId    String    @db.Uuid
  toFacilityId      String    @db.Uuid
  reason            String?   @db.Text
  reassignedBy      String?   @db.VarChar(100)  // 사용자 이름 (향후 Auth 연동)
  reassignedAt      DateTime  @default(now())

  tag               Tag       @relation(fields: [tagId], references: [id], onDelete: Cascade)
  fromFacility      Facility  @relation("FromFacility", fields: [fromFacilityId], references: [id])
  toFacility        Facility  @relation("ToFacility", fields: [toFacilityId], references: [id])

  @@map("tag_reassignment_logs")
  @@index([tagId])
  @@index([fromFacilityId])
  @@index([toFacilityId])
}
```

### 4. Tag 테이블 확장

```prisma
model Tag {
  // ... 기존 필드들 ...

  reassignmentLogs  TagReassignmentLog[]  // Audit 로그

  // ... 나머지 필드들 ...
}
```

### 마이그레이션 파일

**파일**: `apps/api/prisma/migrations/20260223_add_facility_type_and_reassignment/migration.sql`

```sql
-- 1. FacilityType 테이블 생성
CREATE TABLE "facility_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "color" VARCHAR(7),
  "icon" VARCHAR(50),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "facility_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "facility_types_code_key" UNIQUE ("code")
);

-- 2. Facility 테이블에 typeId 추가
ALTER TABLE "facilities" ADD COLUMN "typeId" UUID;

ALTER TABLE "facilities" ADD CONSTRAINT "facilities_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "facility_types"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. TagReassignmentLog 테이블 생성
CREATE TABLE "tag_reassignment_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tagId" UUID NOT NULL,
  "fromFacilityId" UUID NOT NULL,
  "toFacilityId" UUID NOT NULL,
  "reason" TEXT,
  "reassignedBy" VARCHAR(100),
  "reassignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tag_reassignment_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tag_reassignment_logs_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tag_reassignment_logs_fromFacilityId_fkey"
    FOREIGN KEY ("fromFacilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tag_reassignment_logs_toFacilityId_fkey"
    FOREIGN KEY ("toFacilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "tag_reassignment_logs_tagId_idx" ON "tag_reassignment_logs"("tagId");
CREATE INDEX "tag_reassignment_logs_fromFacilityId_idx" ON "tag_reassignment_logs"("fromFacilityId");
CREATE INDEX "tag_reassignment_logs_toFacilityId_idx" ON "tag_reassignment_logs"("toFacilityId");

-- 4. 기본 설비 유형 삽입 (예시 데이터)
INSERT INTO "facility_types" ("code", "name", "description", "color", "icon", "order") VALUES
  ('MACHINING', '가공설비', '절삭, 연삭 등 가공 작업', '#3B82F6', 'Settings', 1),
  ('ASSEMBLY', '조립설비', '부품 조립 및 체결', '#10B981', 'Wrench', 2),
  ('INSPECTION', '검사설비', '품질 검사 및 측정', '#F59E0B', 'Search', 3),
  ('PAINTING', '도장설비', '도장 및 코팅', '#EF4444', 'Paintbrush', 4),
  ('UTILITY', '유틸리티', '공조, 전력 등 지원 설비', '#8B5CF6', 'Zap', 5);
```

## 🔌 Backend API 설계

### 1. FacilityType API

#### DTO

**파일**: `apps/api/src/settings/dto/facility-type.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsInt, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreateFacilityTypeDto {
  @ApiProperty({ example: 'MACHINING' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: '가공설비' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: '#3B82F6' })
  @IsOptional()
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'Color must be a valid hex color (e.g., #FF5733)' })
  color?: string;

  @ApiProperty({ required: false, example: 'Settings' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateFacilityTypeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^#[0-9A-F]{6}$/i)
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  order?: number;
}
```

#### Service Methods

**파일**: `apps/api/src/settings/settings.service.ts`

```typescript
// FacilityType CRUD
async getFacilityTypeList(filters?: { search?: string; isActive?: boolean }) {
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
  return this.prisma.facilityType.create({
    data: {
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
  // Check if any facilities are using this type
  const count = await this.prisma.facility.count({ where: { typeId: id } });
  if (count > 0) {
    throw new BadRequestException(
      `Cannot delete facility type: ${count} facilities are using this type`
    );
  }

  return this.prisma.facilityType.delete({ where: { id } });
}
```

#### Controller Endpoints

**파일**: `apps/api/src/settings/settings.controller.ts`

```typescript
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
```

### 2. Tag Bulk Upload API

#### DTO

**파일**: `apps/api/src/settings/dto/tag-bulk.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTagDto } from './tag.dto';

export class BulkUploadResponseDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  success: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  warnings: number;

  @ApiProperty({ type: [Object] })
  results: BulkUploadResultItem[];
}

export interface BulkUploadResultItem {
  row: number;
  status: 'success' | 'error' | 'warning';
  data?: Partial<CreateTagDto>;
  message?: string;
  errors?: string[];
}
```

#### Service Methods

**파일**: `apps/api/src/settings/settings.service.ts`

```typescript
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

async processTagBulkUpload(file: Express.Multer.File): Promise<BulkUploadResponseDto> {
  const workbook = XLSX.read(file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  const results: BulkUploadResultItem[] = [];
  let successCount = 0;
  let failedCount = 0;
  let warningCount = 0;

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
      if (!row.tagType) errors.push('tagType is required');
      if (!row.dataType) errors.push('dataType is required');

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
      if (!['TREND', 'USAGE', 'SENSOR'].includes(row.tagType)) {
        results.push({
          row: rowNumber,
          status: 'error',
          data: row,
          message: `Invalid tagType: ${row.tagType}`,
        });
        failedCount++;
        continue;
      }

      if (row.energyType && !['elec', 'air'].includes(row.energyType)) {
        results.push({
          row: rowNumber,
          status: 'warning',
          data: row,
          message: `Invalid energyType: ${row.energyType} (will be set to null)`,
        });
        warningCount++;
      }

      if (!['T', 'Q'].includes(row.dataType)) {
        results.push({
          row: rowNumber,
          status: 'error',
          data: row,
          message: `Invalid dataType: ${row.dataType}`,
        });
        failedCount++;
        continue;
      }

      // Prepare tag data
      const tagData = {
        facilityId: facility.id,
        tagName: row.tagName,
        displayName: row.displayName,
        tagType: row.tagType,
        energyType: row.energyType || null,
        dataType: row.dataType,
        unit: row.unit || null,
        order: row.order || 0,
        isActive: true,
      };

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

  // If all validations passed, insert in transaction
  if (failedCount === 0) {
    const tagsToCreate = results
      .filter((r) => r.status === 'success')
      .map((r) => r.data);

    await this.prisma.tag.createMany({
      data: tagsToCreate,
    });
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
  const templateData = [
    {
      facilityCode: 'HNK10-010-1',
      tagName: 'HNK10_010_1_POWER_1',
      displayName: '전력 사용량',
      tagType: 'USAGE',
      energyType: 'elec',
      dataType: 'T',
      unit: 'kWh',
      order: 1,
    },
    {
      facilityCode: 'HNK10-010-2',
      tagName: 'HNK10_010_2_AIR_1',
      displayName: '에어 사용량',
      tagType: 'USAGE',
      energyType: 'air',
      dataType: 'T',
      unit: 'L',
      order: 2,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tags');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
```

#### Controller Endpoints

**파일**: `apps/api/src/settings/settings.controller.ts`

```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors, UploadedFile } from '@nestjs/common';

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
```

### 3. Tag Reassignment API

#### DTO

**파일**: `apps/api/src/settings/dto/tag-reassignment.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsString, IsOptional, ArrayMinSize } from 'class-validator';

export class TagReassignmentDto {
  @ApiProperty({ type: [String], example: ['uuid1', 'uuid2'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  tagIds: string[];

  @ApiProperty({ example: 'target-facility-uuid' })
  @IsUUID('4')
  targetFacilityId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reassignedBy?: string;
}

export class TagReassignmentResponseDto {
  @ApiProperty()
  success: number;

  @ApiProperty()
  failed: number;

  @ApiProperty({ type: [Object] })
  results: {
    tagId: string;
    tagName: string;
    status: 'success' | 'error';
    message?: string;
  }[];
}
```

#### Service Methods

**파일**: `apps/api/src/settings/settings.service.ts`

```typescript
async reassignTags(dto: TagReassignmentDto): Promise<TagReassignmentResponseDto> {
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

        // Create reassignment log
        await prisma.tagReassignmentLog.create({
          data: {
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

  return {
    success: successCount,
    failed: failedCount,
    results,
  };
}
```

#### Controller Endpoints

**파일**: `apps/api/src/settings/settings.controller.ts`

```typescript
@Post('tag/reassign')
@ApiOperation({ summary: '태그 재할당' })
async reassignTags(@Body() dto: TagReassignmentDto) {
  return this.settingsService.reassignTags(dto);
}

@Get('tag/:id/reassignment-history')
@ApiOperation({ summary: '태그 재할당 이력 조회' })
async getTagReassignmentHistory(@Param('id') id: string) {
  return this.prisma.tagReassignmentLog.findMany({
    where: { tagId: id },
    include: {
      fromFacility: { select: { code: true, name: true } },
      toFacility: { select: { code: true, name: true } },
    },
    orderBy: { reassignedAt: 'desc' },
  });
}
```

## 🎨 Frontend 설계

### 1. SET-011: 설비 유형 관리

**파일**: `apps/web/src/pages/settings/SET011FacilityTypeManagement.tsx`

**컴포넌트 구조**:
```tsx
<PageHeader title="설비 유형 관리" />
<FilterBar filters={[search, isActive]} />
<div>총 {types.length}개 유형</div>
<button onClick={handleAdd}>유형 추가</button>
<SortableTable data={types} columns={[code, name, color, icon, facilityCount, actions]} />

{/* 추가/수정 모달 */}
<Modal isOpen={editModalOpen}>
  <input name="code" />
  <input name="name" />
  <textarea name="description" />
  <ColorPicker value={color} onChange={setColor} />
  <IconPicker value={icon} onChange={setIcon} />
  <input type="number" name="order" />
  <checkbox name="isActive" />
</Modal>

{/* 삭제 확인 모달 */}
<ConfirmModal />
```

**주요 기능**:
- Color Picker: `<input type="color" />` 사용
- Icon Picker: lucide-react 아이콘 그리드 선택 UI
- 유형별 색상 Badge 표시
- 해당 유형 설비 수 표시

### 2. SET-012 확장: Tag 일괄 업로드

**파일**: `apps/web/src/pages/settings/SET012TagMaster.tsx` (기존 파일 확장)

**추가 컴포넌트**:
```tsx
{/* 일괄 업로드 버튼 추가 */}
<button onClick={() => setBulkUploadModalOpen(true)}>일괄 업로드</button>

{/* 일괄 업로드 모달 */}
<Modal isOpen={bulkUploadModalOpen}>
  <div>템플릿 다운로드: <a href="/api/settings/tag/bulk-template">Excel 템플릿</a></div>

  {/* Drag & Drop 영역 */}
  <div onDragOver={handleDragOver} onDrop={handleDrop}>
    <UploadCloud size={48} />
    <p>Excel/CSV 파일을 드래그하거나 클릭하여 선택</p>
    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
  </div>

  {/* 업로드 진행 */}
  {uploading && <ProgressBar value={progress} />}

  {/* 검증 결과 */}
  {uploadResult && (
    <div>
      <div>✅ 성공: {uploadResult.success}개</div>
      <div>❌ 실패: {uploadResult.failed}개</div>
      <div>⚠️ 경고: {uploadResult.warnings}개</div>

      <SortableTable
        data={uploadResult.results}
        columns={[row, status, data, message]}
      />
    </div>
  )}
</Modal>
```

### 3. SET-012 확장: Tag 재할당

**파일**: `apps/web/src/pages/settings/SET012TagMaster.tsx` (기존 파일 확장)

**추가 컴포넌트**:
```tsx
{/* 테이블에 체크박스 컬럼 추가 */}
<SortableTable
  columns={[
    {
      key: 'select',
      label: <checkbox onChange={handleSelectAll} />,
      render: (row) => <checkbox checked={selectedTags.has(row.id)} onChange={() => toggleTag(row.id)} />
    },
    ...기존 컬럼들
  ]}
/>

{/* 선택한 태그 재할당 버튼 */}
{selectedTags.size > 0 && (
  <button onClick={() => setReassignModalOpen(true)}>
    선택한 {selectedTags.size}개 태그 재할당
  </button>
)}

{/* 재할당 모달 */}
<Modal isOpen={reassignModalOpen}>
  <h3>선택한 {selectedTags.size}개 태그 재할당</h3>

  {/* 선택된 태그 목록 */}
  <div>
    {Array.from(selectedTags).map((id) => {
      const tag = tags.find((t) => t.id === id);
      return <div key={id}>{tag.tagName} ({tag.displayName})</div>;
    })}
  </div>

  {/* 대상 설비 선택 (계층적 선택) */}
  <CascadeSelect
    levels={[
      { label: '공장', options: factories, value: selectedFactory },
      { label: '라인', options: lines, value: selectedLine },
      { label: '설비', options: facilities, value: selectedFacility },
    ]}
    onChange={(factory, line, facility) => {
      setSelectedFactory(factory);
      setSelectedLine(line);
      setSelectedFacility(facility);
    }}
  />

  {/* 재할당 사유 */}
  <textarea
    placeholder="재할당 사유 (선택)"
    value={reason}
    onChange={(e) => setReason(e.target.value)}
  />

  {/* 확인/취소 */}
  <button onClick={handleReassign}>재할당</button>
  <button onClick={() => setReassignModalOpen(false)}>취소</button>
</Modal>
```

## 📁 파일 구조

```
apps/
├── api/
│   ├── prisma/
│   │   ├── schema.prisma (FacilityType, TagReassignmentLog 추가)
│   │   └── migrations/
│   │       └── 20260223_add_facility_type_and_reassignment/
│   │           └── migration.sql
│   ├── src/
│   │   └── settings/
│   │       ├── dto/
│   │       │   ├── facility-type.dto.ts (신규)
│   │       │   ├── tag-bulk.dto.ts (신규)
│   │       │   └── tag-reassignment.dto.ts (신규)
│   │       ├── settings.controller.ts (5 endpoints 추가)
│   │       └── settings.service.ts (10+ methods 추가)
│   └── package.json (xlsx, csv-parser, multer 추가)
└── web/
    ├── src/
    │   ├── pages/
    │   │   └── settings/
    │   │       ├── SET011FacilityTypeManagement.tsx (신규)
    │   │       └── SET012TagMaster.tsx (확장: 일괄 업로드, 재할당)
    │   ├── services/
    │   │   └── settings.ts (확장: FacilityType, Bulk, Reassignment API)
    │   └── components/
    │       └── ui/
    │           ├── ColorPicker.tsx (신규)
    │           ├── IconPicker.tsx (신규)
    │           ├── CascadeSelect.tsx (신규)
    │           └── ProgressBar.tsx (신규)
    └── App.tsx (SET-011 route 추가)
```

## 🔄 구현 순서

### 1단계: Database & Migration (30분)
1. schema.prisma 수정
2. migration 파일 생성
3. `npx prisma migrate dev --name add_facility_type_and_reassignment`
4. Prisma generate

### 2단계: Backend - FacilityType (1시간)
1. DTO 작성 (facility-type.dto.ts)
2. Service methods 구현
3. Controller endpoints 추가
4. Swagger 테스트

### 3단계: Backend - Tag Bulk Upload (2시간)
1. package.json에 xlsx, multer 추가
2. DTO 작성 (tag-bulk.dto.ts)
3. Service methods 구현 (파싱, 검증, 삽입)
4. Controller endpoints 추가
5. 템플릿 생성 로직
6. Swagger 테스트

### 4단계: Backend - Tag Reassignment (1시간)
1. DTO 작성 (tag-reassignment.dto.ts)
2. Service methods 구현 (Transaction)
3. Controller endpoints 추가
4. Swagger 테스트

### 5단계: Frontend - SET-011 (2시간)
1. SET011FacilityTypeManagement.tsx 작성
2. ColorPicker, IconPicker 컴포넌트 구현
3. services/settings.ts 확장 (FacilityType API)
4. App.tsx 라우팅 추가
5. UI 테스트

### 6단계: Frontend - Tag Bulk Upload (2시간)
1. SET012TagMaster.tsx 확장
2. Drag & Drop 파일 업로드 UI
3. ProgressBar 컴포넌트
4. 검증 결과 테이블
5. services/settings.ts 확장 (Bulk API)
6. 통합 테스트

### 7단계: Frontend - Tag Reassignment (2시간)
1. SET012TagMaster.tsx 확장
2. 체크박스 다중 선택 구현
3. CascadeSelect 컴포넌트
4. 재할당 모달
5. services/settings.ts 확장 (Reassignment API)
6. 통합 테스트

### 8단계: 통합 테스트 & Gap Analysis (1시간)
1. 전체 기능 시나리오 테스트
2. /pdca analyze tag-management-phase2
3. Match Rate >= 90% 확인
4. 필요 시 개선 (pdca iterate)

## ✅ 검증 시나리오

### FacilityType
1. 5개 유형 등록 (MACHINING, ASSEMBLY, INSPECTION, PAINTING, UTILITY)
2. 각 유형에 색상 및 아이콘 지정
3. 10개 설비에 유형 할당
4. 유형 목록 조회 및 필터링
5. 유형 수정 및 비활성화
6. 유형 삭제 (설비 연결 시 오류 확인)

### Tag Bulk Upload
1. 템플릿 다운로드
2. 100개 태그 데이터 작성
3. Excel 파일 업로드
4. 검증 결과 확인 (성공/실패/경고)
5. 중복 태그 업로드 시 오류 확인
6. 잘못된 facilityCode 시 오류 확인

### Tag Reassignment
1. 10개 태그 선택
2. 대상 설비 선택 (Factory → Line → Facility)
3. 재할당 실행
4. 재할당 이력 조회
5. 이미 대상 설비에 있는 태그 재할당 시 오류 확인

## 📈 예상 성과

- **FacilityType**: 설비 분류 체계 완성으로 관리 효율성 20% 향상
- **Tag Bulk Upload**: 수동 등록 대비 95% 시간 절감 (100개 기준 5분 → 15초)
- **Tag Reassignment**: 설비 재구성 시간 80% 단축

---

**Next**: Do 단계 → 구현 시작
