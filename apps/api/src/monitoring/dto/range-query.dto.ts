import { IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IntervalEnum } from '../types/interval.enum';

/**
 * Range Query DTO for Dynamic Resolution API
 *
 * Validates query parameters for power/air range data endpoints
 */
export class RangeQueryDto {
  @ApiProperty({
    description: '시작 시간 (ISO8601 UTC)',
    example: '2024-01-01T00:00:00Z',
    required: true,
  })
  @IsString()
  startTime: string;

  @ApiProperty({
    description: '종료 시간 (ISO8601 UTC)',
    example: '2024-01-01T23:59:59Z',
    required: true,
  })
  @IsString()
  endTime: string;

  @ApiProperty({
    description: '데이터 간격 (Progressive Resolution Level)',
    enum: IntervalEnum,
    example: IntervalEnum.ONE_MIN,
    required: true,
  })
  @IsEnum(IntervalEnum, {
    message: 'interval must be one of: 1M, 1d, 1h, 15m, 5m, 1m, 10s, 1s',
  })
  interval: IntervalEnum;

  @ApiProperty({
    description: 'Down-sampling 최대 포인트 수 (선택적)',
    example: 1000,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'maxPoints must be an integer' })
  @Min(1, { message: 'maxPoints must be greater than 0' })
  maxPoints?: number;
}
