import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateFactoryDto {
  @ApiProperty({ example: 'hw5', description: '공장 코드' })
  @IsString()
  code: string;

  @ApiProperty({ example: '5공장', description: '공장명' })
  @IsString()
  name: string;

  @ApiProperty({ example: '화성PT5공장', description: '전체 이름', required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ example: '경기도 화성시', description: '위치', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: true, description: '활성 여부', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFactoryDto {
  @ApiProperty({ example: '5공장', description: '공장명', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '화성PT5공장', description: '전체 이름', required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ example: '경기도 화성시', description: '위치', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: true, description: '활성 여부', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FactoryResponseDto {
  @ApiProperty({ example: 'factory-hw4', description: '공장 ID' })
  id: string;

  @ApiProperty({ example: 'hw4', description: '공장 코드' })
  code: string;

  @ApiProperty({ example: '4공장', description: '공장명' })
  name: string;

  @ApiProperty({ example: '화성PT4공장', description: '전체 이름' })
  fullName: string | null;

  @ApiProperty({ example: '경기도 화성시', description: '위치' })
  location: string | null;

  @ApiProperty({ example: true, description: '활성 여부' })
  isActive: boolean;

  @ApiProperty({ example: 4, description: '라인 개수' })
  lineCount?: number;

  @ApiProperty({ example: '2026-02-23T00:00:00.000Z', description: '생성일' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-23T00:00:00.000Z', description: '수정일' })
  updatedAt: Date;
}
