import { IsNotEmpty, IsOptional, IsString, IsIn, IsArray } from 'class-validator';

export class FacilityHourlyQueryDto {
  @IsNotEmpty()
  @IsString()
  facilityId: string;

  @IsNotEmpty()
  @IsIn(['elec', 'air'])
  type: string;

  @IsOptional()
  @IsString()
  date?: string; // YYYY-MM-DD format
}

export class DetailedComparisonDto {
  @IsNotEmpty()
  @IsString()
  facilityId: string;

  @IsNotEmpty()
  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  facilityId2?: string;

  @IsOptional()
  @IsString()
  date2?: string;
}

export class CycleListQueryDto {
  @IsOptional()
  @IsString()
  facilityId?: string;
}

export class CycleRangeQueryDto {
  @IsNotEmpty()
  @IsString()
  facilityId: string; // facility code (e.g. HNK10_010)

  @IsNotEmpty()
  @IsString()
  start: string; // ISO 8601

  @IsNotEmpty()
  @IsString()
  end: string; // ISO 8601
}

export class CycleWaveformQueryDto {
  @IsNotEmpty()
  @IsString()
  cycleId: string;

  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'])
  isReference?: string;

  @IsOptional()
  @IsString()
  @IsIn(['10s', '1s'])
  interval?: string; // Data interval (default: 10s)
}

export class CycleStepsQueryDto {
  @IsNotEmpty()
  @IsString()
  materialId: string; // CYCLE_STD_MST_MMS.MATERIAL_ID (= CycleRangeItem.id)
}

export class PowerQualityAnalysisDto {
  @IsNotEmpty()
  @IsString()
  facilityIds: string; // comma-separated facility IDs

  @IsOptional()
  @IsString()
  date?: string;
}
