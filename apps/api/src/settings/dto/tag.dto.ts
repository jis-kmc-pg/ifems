import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, IsUUID, IsEnum } from 'class-validator';

// Enums matching Prisma schema
export enum MeasureType {
  INSTANTANEOUS = 'INSTANTANEOUS',
  CUMULATIVE = 'CUMULATIVE',
  DISCRETE = 'DISCRETE',
}

export enum TagCategory {
  ENERGY = 'ENERGY',
  QUALITY = 'QUALITY',
  ENVIRONMENT = 'ENVIRONMENT',
  OPERATION = 'OPERATION',
  CONTROL = 'CONTROL',
}

export enum EnergyType {
  elec = 'elec',
  air = 'air',
  gas = 'gas',
  solar = 'solar',
}

export enum CalcMethod {
  DIFF = 'DIFF',
  INTEGRAL_TRAP = 'INTEGRAL_TRAP',
}

export class CreateTagDto {
  @ApiProperty({ example: 'facility-uuid-here', description: '설비 ID (FK)' })
  @IsUUID()
  facilityId: string;

  @ApiProperty({ example: 'HNK10_010_1_POWER_1', description: '태그명 (유니크)' })
  @IsString()
  tagName: string;

  @ApiProperty({ example: '전력 사용량', description: '표시명' })
  @IsString()
  displayName: string;

  @ApiProperty({ enum: MeasureType, example: MeasureType.INSTANTANEOUS, description: '측정 방식' })
  @IsEnum(MeasureType)
  measureType: MeasureType;

  @ApiProperty({ enum: TagCategory, example: TagCategory.ENERGY, description: '도메인 용도' })
  @IsEnum(TagCategory)
  category: TagCategory;

  @ApiProperty({ enum: EnergyType, example: EnergyType.elec, description: '에너지 유형 (category=ENERGY일 때만)', required: false })
  @IsOptional()
  @IsEnum(EnergyType)
  energyType?: EnergyType;

  @ApiProperty({ example: 'kWh', description: '단위', required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ example: 0, description: '표시 순서', default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ example: true, description: '활성 여부', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTagDto {
  @ApiProperty({ example: '전력 사용량', description: '표시명', required: false })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ enum: MeasureType, example: MeasureType.INSTANTANEOUS, description: '측정 방식', required: false })
  @IsOptional()
  @IsEnum(MeasureType)
  measureType?: MeasureType;

  @ApiProperty({ enum: TagCategory, example: TagCategory.ENERGY, description: '도메인 용도', required: false })
  @IsOptional()
  @IsEnum(TagCategory)
  category?: TagCategory;

  @ApiProperty({ enum: EnergyType, example: EnergyType.elec, description: '에너지 유형', required: false })
  @IsOptional()
  @IsEnum(EnergyType)
  energyType?: EnergyType;

  @ApiProperty({ example: 'kWh', description: '단위', required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ example: 0, description: '표시 순서', required: false })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ example: true, description: '활성 여부', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TagResponseDto {
  @ApiProperty({ example: 'tag-uuid', description: '태그 ID' })
  id: string;

  @ApiProperty({ example: 'HNK10_010_1_POWER_1', description: '태그명' })
  tagName: string;

  @ApiProperty({ example: '전력 사용량', description: '표시명' })
  displayName: string;

  @ApiProperty({ enum: MeasureType, example: MeasureType.INSTANTANEOUS, description: '측정 방식' })
  measureType: MeasureType;

  @ApiProperty({ enum: TagCategory, example: TagCategory.ENERGY, description: '도메인 용도' })
  category: TagCategory;

  @ApiProperty({ enum: EnergyType, example: EnergyType.elec, description: '에너지 유형' })
  energyType: EnergyType | null;

  @ApiProperty({ example: 'kWh', description: '단위' })
  unit: string | null;

  @ApiProperty({ example: 0, description: '표시 순서' })
  order: number;

  @ApiProperty({ example: true, description: '활성 여부' })
  isActive: boolean;

  @ApiProperty({ example: 'facility-uuid', description: '설비 ID' })
  facilityId: string;

  @ApiProperty({ example: 'HNK10-000', description: '설비 코드' })
  facilityCode?: string;

  @ApiProperty({ example: '블록 메인', description: '설비명' })
  facilityName?: string;

  @ApiProperty({ example: 'HNK10', description: '라인 코드' })
  lineCode?: string;

  @ApiProperty({ example: '블록 라인', description: '라인명' })
  lineName?: string;

  @ApiProperty({ example: 'hw4', description: '공장 코드' })
  factoryCode?: string;

  @ApiProperty({ example: '4공장', description: '공장명' })
  factoryName?: string;

  @ApiProperty({ example: '2026-02-23T00:00:00.000Z', description: '생성일' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-23T00:00:00.000Z', description: '수정일' })
  updatedAt: Date;
}
