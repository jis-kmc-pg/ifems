import { IsOptional, IsString, IsIn } from 'class-validator';
import {
  BaseLineFilterDto,
  BaseEnergyTypeFilterDto,
  BasePaginationDto,
} from '../../common/dto/base-query.dto';

export class DashboardQueryDto extends BaseLineFilterDto {}

export class CycleRankingQueryDto extends BaseLineFilterDto {
  @IsOptional()
  @IsString()
  startDate?: string; // YYYY-MM-DD (default: 7일 전)

  @IsOptional()
  @IsString()
  endDate?: string; // YYYY-MM-DD (default: 오늘)
}

export class FacilityTrendQueryDto extends BaseLineFilterDto {
  @IsOptional()
  @IsString()
  facilityId?: string;
}

export class UsageDistributionQueryDto extends BaseLineFilterDto {
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

export class AirLeakRankingQueryDto extends BaseLineFilterDto {
  @IsOptional()
  @IsString()
  startDate?: string; // YYYY-MM-DD (default: 7일 전)

  @IsOptional()
  @IsString()
  endDate?: string; // YYYY-MM-DD (default: 오늘)
}

export class ProcessRankingQueryDto extends BaseEnergyTypeFilterDto {}

export class EnergyChangeQueryDto extends BasePaginationDto {
  @IsOptional()
  @IsIn(['elec', 'air'])
  type?: string;
}
