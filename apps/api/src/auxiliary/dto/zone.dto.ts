import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const ZONE_TYPES = [
  'PRODUCTION', 'OFFICE', 'CORRIDOR', 'WAREHOUSE',
  'UTILITY', 'OUTDOOR', 'PARKING', 'LOUNGE',
] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export class ZoneDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) parentId?: string | null;
  @ApiPropertyOptional({ nullable: true }) factoryId?: string | null;
  @ApiPropertyOptional({ nullable: true }) areaSqm?: number | null;
  @ApiProperty({ enum: ZONE_TYPES }) zoneType!: ZoneType;
  @ApiPropertyOptional({ nullable: true }) metadata?: Record<string, unknown> | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class CreateZoneDto {
  @ApiProperty({ example: 'HW4-PROD-E' })
  @IsString() @MaxLength(50)
  code!: string;

  @ApiProperty({ example: '5번 라인 작업장' })
  @IsString() @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  factoryId?: string;

  @ApiPropertyOptional({ example: 1500.0 })
  @IsOptional() @IsNumber() @Min(0)
  areaSqm?: number;

  @ApiProperty({ enum: ZONE_TYPES })
  @IsIn(ZONE_TYPES as unknown as string[])
  zoneType!: ZoneType;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateZoneDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) areaSqm?: number | null;
  @ApiPropertyOptional({ enum: ZONE_TYPES })
  @IsOptional() @IsIn(ZONE_TYPES as unknown as string[])
  zoneType?: ZoneType;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown> | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ZoneTreeNodeDto extends ZoneDto {
  @ApiProperty({ type: () => [ZoneTreeNodeDto] })
  children!: ZoneTreeNodeDto[];
}
