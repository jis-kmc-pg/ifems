import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsInt, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreateFacilityTypeDto {
  @ApiProperty({ example: 'MACHINING' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: '가공설비' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: '#3B82F6' })
  @IsOptional()
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'Color must be a valid hex color (e.g., #FF5733)' })
  color?: string;

  @ApiProperty({ required: false, example: 'Settings' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateFacilityTypeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^#[0-9A-F]{6}$/i)
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  order?: number;
}
