import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum, IsArray, IsUUID } from 'class-validator';
import { EnergyType, CalcMethod } from './tag.dto';

export class UpdateEnergyConfigDto {
  @ApiProperty({ enum: CalcMethod, description: '계산 방식', required: false })
  @IsOptional()
  @IsEnum(CalcMethod)
  calcMethod?: CalcMethod;

  @ApiProperty({ description: '매핑할 태그 ID 배열', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiProperty({ description: '설명', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '설정자', required: false })
  @IsOptional()
  @IsString()
  configuredBy?: string;

  @ApiProperty({ description: '관리자 확인 필요 여부', required: false })
  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;

  @ApiProperty({ description: '활성 여부', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
