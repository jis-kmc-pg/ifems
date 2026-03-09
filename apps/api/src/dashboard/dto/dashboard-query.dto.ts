import { IsOptional, IsString, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  line?: string;
}

export class FacilityTrendQueryDto {
  @IsOptional()
  @IsString()
  line?: string;

  @IsOptional()
  @IsString()
  facilityId?: string;
}

export class UsageDistributionQueryDto {
  @IsOptional()
  @IsString()
  line?: string;

  @IsOptional()
  @IsString()
  date?: string; // YYYY-MM-DD format (하위 호환)

  @IsOptional()
  @IsString()
  start?: string; // ISO8601 시작 시각

  @IsOptional()
  @IsString()
  end?: string; // ISO8601 종료 시각
}

export class ProcessRankingQueryDto {
  @IsOptional()
  @IsString()
  line?: string;

  @IsOptional()
  @IsIn(['elec', 'air'])
  type?: string;
}

export class EnergyChangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topN?: number;

  @IsOptional()
  @IsIn(['elec', 'air'])
  type?: string;
}
