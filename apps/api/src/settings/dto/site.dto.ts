import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class SiteDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() fullName?: string | null;
  @ApiPropertyOptional() address?: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() order!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() factoryCount?: number;
}

export class CreateSiteDto {
  @ApiProperty({ example: 'hwasung' })
  @IsString() @MaxLength(50)
  code!: string;

  @ApiProperty({ example: '화성 사업장' })
  @IsString() @MaxLength(100)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() order?: number;
}

export class UpdateSiteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
