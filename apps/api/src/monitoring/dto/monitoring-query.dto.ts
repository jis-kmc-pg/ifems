import { IsOptional, IsString, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 시간별 트렌드 조회 DTO (overview/hourly)
 */
export class HourlyTrendQueryDto {
  @ApiPropertyOptional({
    description: '조회 날짜 (YYYY-MM-DD)',
    example: '2026-02-20',
  })
  @IsOptional()
  @IsString()
  date?: string;
}

/**
 * 라인별 상세 차트 조회 DTO (line/:line)
 */
export class LineDetailQueryDto {
  @ApiPropertyOptional({
    description: '조회 날짜 (YYYY-MM-DD)',
    example: '2026-02-20',
  })
  @IsOptional()
  @IsString()
  date?: string;

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
export class EnergyRankingQueryDto {
  @ApiPropertyOptional({
    description: '라인 코드',
    example: 'block',
  })
  @IsOptional()
  @IsString()
  line?: string;

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
 * 라인별 공통 쿼리 DTO (energy-alert, air-leak)
 */
export class LineQueryDto {
  @ApiPropertyOptional({
    description: '라인 코드',
    example: 'block',
  })
  @IsOptional()
  @IsString()
  line?: string;
}

/**
 * 전력 품질 순위 조회 DTO (power-quality)
 */
export class PowerQualityQueryDto {
  @ApiPropertyOptional({
    description: '라인 코드',
    example: 'block',
  })
  @IsOptional()
  @IsString()
  line?: string;

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
