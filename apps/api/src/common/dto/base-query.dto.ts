import { IsOptional, IsString, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

// ============================================================
// DTO 베이스 클래스 (공통 검증 패턴 통합)
// ============================================================
// monitoring, dashboard, alerts, analysis DTO에서 반복되는
// 라인/에너지타입/날짜/설비 필터 검증을 재사용 가능한 클래스로 추출

/**
 * 라인 필터 (line?: string)
 * 사용: monitoring, dashboard, alerts, analysis
 */
export class BaseLineFilterDto {
  @ApiPropertyOptional({ description: '라인 코드', example: 'block' })
  @IsOptional()
  @IsString()
  line?: string;
}

/**
 * 에너지 타입 필터 (type?: 'elec' | 'air')
 * 사용: EnergyRankingQueryDto, ProcessRankingQueryDto, EnergyChangeQueryDto
 */
export class BaseEnergyTypeFilterDto extends BaseLineFilterDto {
  @ApiPropertyOptional({
    description: '에너지 타입',
    example: 'elec',
    enum: ['elec', 'air'],
  })
  @IsOptional()
  @IsIn(['elec', 'air'])
  type?: string;
}

/**
 * 날짜 단건 필터 (date?: string)
 * 사용: HourlyTrendQueryDto, FacilityHourlyQueryDto
 */
export class BaseDateFilterDto {
  @ApiPropertyOptional({
    description: '조회 날짜 (YYYY-MM-DD)',
    example: '2026-03-01',
  })
  @IsOptional()
  @IsString()
  date?: string;
}

/**
 * 날짜 범위 필터 (startDate + endDate)
 * 사용: PowerQualityQueryDto, 알림 이력 조회
 */
export class BaseDateRangeFilterDto extends BaseLineFilterDto {
  @ApiPropertyOptional({
    description: '시작 날짜 (YYYY-MM-DD)',
    example: '2026-03-01',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: '종료 날짜 (YYYY-MM-DD)',
    example: '2026-03-06',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}

/**
 * 설비 ID 필터 (facilityId: string)
 * 사용: FacilityHourlyQueryDto, DetailedComparisonDto
 */
export class BaseFacilityFilterDto {
  @ApiPropertyOptional({ description: '설비 ID' })
  @IsOptional()
  @IsString()
  facilityId?: string;
}

/**
 * 페이지네이션 (topN?: number)
 * 사용: EnergyChangeQueryDto
 */
export class BasePaginationDto {
  @ApiPropertyOptional({
    description: '상위 N건 조회',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topN?: number;
}
