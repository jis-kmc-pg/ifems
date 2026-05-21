import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export const SOURCE_TYPES = ['ELECTRICITY','GAS','WATER','AIR'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export class EnergyFlowDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: SOURCE_TYPES }) sourceType!: SourceType;
  @ApiProperty() targetShop!: string;
  @ApiPropertyOptional() branchLabel?: string | null;
  @ApiPropertyOptional() value?: number | null;
  @ApiPropertyOptional() unit?: string | null;
  @ApiPropertyOptional() color?: string | null;
  @ApiProperty() order!: number;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() description?: string | null;
  @ApiPropertyOptional() createdBy?: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class CreateEnergyFlowDto {
  @ApiProperty({ enum: SOURCE_TYPES })
  @IsIn(SOURCE_TYPES as unknown as string[])
  sourceType!: SourceType;

  @ApiProperty({ example: 'Stamping' })
  @IsString() @MaxLength(50)
  targetShop!: string;

  @ApiPropertyOptional({ example: 'Boiler' })
  @IsOptional() @IsString() @MaxLength(50)
  branchLabel?: string;

  @ApiPropertyOptional({ example: 11.45 })
  @IsOptional() @IsNumber()
  value?: number;

  @ApiPropertyOptional({ example: 'MWh' })
  @IsOptional() @IsString() @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ example: '#FDB813' })
  @IsOptional() @IsString() @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt()
  order?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdateEnergyFlowDto {
  @ApiPropertyOptional() @IsOptional() @IsString() targetShop?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchLabel?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() value?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string | null;
}
