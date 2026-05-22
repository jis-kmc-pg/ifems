import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class LightingRelayDto {
  @ApiProperty() id!: string;
  @ApiProperty() facilityId!: string;
  @ApiPropertyOptional() zoneId?: string | null;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() ratedW?: number | null;
  @ApiPropertyOptional() fixtureCount?: number | null;
  @ApiPropertyOptional() fixtureType?: string | null;
  @ApiPropertyOptional() onOffTagId?: string | null;
  @ApiPropertyOptional() powerTagId?: string | null;
  @ApiPropertyOptional() metadata?: Record<string, unknown> | null;
  @ApiProperty() order!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  // 조인 보강 (list 응답에만 포함)
  @ApiPropertyOptional() facilityCode?: string;
  @ApiPropertyOptional() facilityName?: string;
  @ApiPropertyOptional() zoneCode?: string;
}

export class CreateLightingRelayDto {
  @ApiProperty()
  @IsString() facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() zoneId?: string;

  @ApiProperty({ example: 'HW4-LGT-PROD-A-R1' })
  @IsString() @MaxLength(50)
  code!: string;

  @ApiProperty()
  @IsString() @MaxLength(100)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() ratedW?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() fixtureCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() fixtureType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() onOffTagId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() powerTagId?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
}

export class UpdateLightingRelayDto {
  @ApiPropertyOptional() @IsOptional() @IsString() facilityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zoneId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() ratedW?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() fixtureCount?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() fixtureType?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() onOffTagId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() powerTagId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown> | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
