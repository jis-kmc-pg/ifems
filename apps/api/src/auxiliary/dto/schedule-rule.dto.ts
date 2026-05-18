import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString,
  IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min,
} from 'class-validator';

export const TARGET_TYPES  = ['HVAC','LIGHTING','MIXED'] as const;
export const TARGET_SCOPES = ['FACILITY','ZONE']         as const;
export const ACTIONS       = ['ON','OFF','SETPOINT']     as const;

export type TargetType  = (typeof TARGET_TYPES)[number];
export type TargetScope = (typeof TARGET_SCOPES)[number];
export type ActionType  = (typeof ACTIONS)[number];

export class ScheduleRuleDto {
  @ApiProperty()                 id!: string;
  @ApiProperty()                 name!: string;
  @ApiPropertyOptional()         description?: string | null;
  @ApiProperty({ enum: TARGET_TYPES })  targetType!: TargetType;
  @ApiProperty({ enum: TARGET_SCOPES }) targetScope!: TargetScope;
  @ApiProperty()                 targetId!: string;
  @ApiProperty({ type: [Number] }) dayOfWeek!: number[];
  @ApiPropertyOptional()         startTime?: string | null;
  @ApiPropertyOptional()         endTime?: string | null;
  @ApiPropertyOptional()         condition?: Record<string, unknown> | null;
  @ApiProperty({ enum: ACTIONS }) action!: ActionType;
  @ApiPropertyOptional()         actionValue?: Record<string, unknown> | null;
  @ApiProperty()                 priority!: number;
  @ApiProperty()                 enabled!: boolean;
  @ApiPropertyOptional()         effectiveFrom?: Date | null;
  @ApiPropertyOptional()         effectiveTo?: Date | null;
  @ApiPropertyOptional()         createdBy?: string | null;
  @ApiProperty()                 createdAt!: Date;
  @ApiProperty()                 updatedAt!: Date;
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateScheduleRuleDto {
  @ApiProperty({ example: '평일 점심 사무동 조명 OFF' })
  @IsString() @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ enum: TARGET_TYPES })
  @IsIn(TARGET_TYPES as unknown as string[])
  targetType!: TargetType;

  @ApiProperty({ enum: TARGET_SCOPES })
  @IsIn(TARGET_SCOPES as unknown as string[])
  targetScope!: TargetScope;

  @ApiProperty({ description: 'targetScope에 따라 facility.id 또는 zone.id' })
  @IsString()
  targetId!: string;

  @ApiProperty({ type: [Number], example: [1,2,3,4,5], description: '0=일, 6=토' })
  @IsArray() @ArrayMinSize(0) @ArrayMaxSize(7)
  @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  dayOfWeek!: number[];

  @ApiPropertyOptional({ example: '12:00' })
  @IsOptional() @Matches(TIME_REGEX, { message: 'startTime must be HH:mm or HH:mm:ss' })
  startTime?: string;

  @ApiPropertyOptional({ example: '13:00' })
  @IsOptional() @Matches(TIME_REGEX, { message: 'endTime must be HH:mm or HH:mm:ss' })
  endTime?: string;

  @ApiPropertyOptional({ example: { occupancy: false } })
  @IsOptional() @IsObject()
  condition?: Record<string, unknown>;

  @ApiProperty({ enum: ACTIONS })
  @IsIn(ACTIONS as unknown as string[])
  action!: ActionType;

  @ApiPropertyOptional({ example: { setpoint: 24, mode: 'cooling' } })
  @IsOptional() @IsObject()
  actionValue?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt()
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() createdBy?: string;
}

export class UpdateScheduleRuleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string | null;
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  dayOfWeek?: number[];
  @ApiPropertyOptional() @IsOptional() @Matches(TIME_REGEX) startTime?: string | null;
  @ApiPropertyOptional() @IsOptional() @Matches(TIME_REGEX) endTime?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsObject() condition?: Record<string, unknown> | null;
  @ApiPropertyOptional({ enum: ACTIONS })
  @IsOptional() @IsIn(ACTIONS as unknown as string[]) action?: ActionType;
  @ApiPropertyOptional() @IsOptional() @IsObject() actionValue?: Record<string, unknown> | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() priority?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveFrom?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string | null;
}
