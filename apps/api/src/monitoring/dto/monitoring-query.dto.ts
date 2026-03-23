import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BaseDateFilterDto,
  BaseLineFilterDto,
  BaseEnergyTypeFilterDto,
  BaseDateRangeFilterDto,
} from '../../common/dto/base-query.dto';

/**
 * 시간별 트렌드 조회 DTO (overview/hourly)
 */
export class HourlyTrendQueryDto extends BaseDateFilterDto {}

/**
 * 라인별 상세 차트 조회 DTO (line/:line)
 */
export class LineDetailQueryDto extends BaseDateFilterDto {
  @ApiPropertyOptional({
    description: '데이터 간격 (초)',
    example: 60,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  interval?: number;
}

/**
 * 에너지 순위 조회 DTO (energy-ranking)
 */
export class EnergyRankingQueryDto extends BaseEnergyTypeFilterDto {}

/**
 * 라인별 공통 쿼리 DTO (energy-alert, air-leak)
 */
export class LineQueryDto extends BaseLineFilterDto {}

/**
 * 전력 품질 순위 조회 DTO (power-quality)
 */
export class PowerQualityQueryDto extends BaseDateRangeFilterDto {}
