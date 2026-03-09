import { IsOptional, IsString, IsEnum, IsArray, ValidateNested, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NonProductionScheduleDto {
  @ApiProperty({ description: '요일 유형', enum: ['weekday', 'saturday', 'sunday'] })
  @IsEnum(['weekday', 'saturday', 'sunday'] as const)
  dayType: 'weekday' | 'saturday' | 'sunday';

  @ApiProperty({ description: '비생산 시작 시각 (HH:mm)', example: '18:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be HH:mm format' })
  startTime: string;

  @ApiProperty({ description: '비생산 종료 시각 (HH:mm)', example: '08:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be HH:mm format' })
  endTime: string;
}

export class SaveNonProductionSchedulesDto {
  @ApiProperty({ description: '라인 ID' })
  @IsString()
  lineId: string;

  @ApiProperty({ type: [NonProductionScheduleDto], description: '스케줄 목록 (최대 3개: weekday/saturday/sunday)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NonProductionScheduleDto)
  schedules: NonProductionScheduleDto[];
}

export class ProductionCalendarDto {
  @ApiPropertyOptional({ description: '라인 ID (NULL이면 전체 공장)' })
  @IsOptional()
  @IsString()
  lineId?: string;

  @ApiProperty({ description: '날짜 (YYYY-MM-DD)', example: '2026-03-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ description: '타입', enum: ['holiday', 'workday', 'shutdown'] })
  @IsEnum(['holiday', 'workday', 'shutdown'] as const)
  type: 'holiday' | 'workday' | 'shutdown';

  @ApiPropertyOptional({ description: '설명', example: '설날' })
  @IsOptional()
  @IsString()
  description?: string;
}
