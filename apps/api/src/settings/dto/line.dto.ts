import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, IsUUID } from 'class-validator';

export class CreateLineDto {
  @ApiProperty({ example: 'HNK10', description: '라인 코드' })
  @IsString()
  code: string;

  @ApiProperty({ example: '블록 라인', description: '라인명' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'factory-uuid-here', description: '공장 ID (FK)' })
  @IsUUID()
  factoryId: string;

  @ApiProperty({ example: 0, description: '표시 순서', default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ example: true, description: '활성 여부', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLineDto {
  @ApiProperty({ example: '블록 라인', description: '라인명', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 0, description: '표시 순서', required: false })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ example: true, description: '활성 여부', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LineResponseDto {
  @ApiProperty({ example: 'line-uuid', description: '라인 ID' })
  id: string;

  @ApiProperty({ example: 'HNK10', description: '라인 코드' })
  code: string;

  @ApiProperty({ example: '블록 라인', description: '라인명' })
  name: string;

  @ApiProperty({ example: 'factory-uuid', description: '공장 ID' })
  factoryId: string;

  @ApiProperty({ example: '4공장', description: '공장명' })
  factoryName: string;

  @ApiProperty({ example: 0, description: '표시 순서' })
  order: number;

  @ApiProperty({ example: true, description: '활성 여부' })
  isActive: boolean;

  @ApiProperty({ example: 12, description: '설비 개수' })
  facilityCount?: number;

  @ApiProperty({ example: '2026-02-23T00:00:00.000Z', description: '생성일' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-23T00:00:00.000Z', description: '수정일' })
  updatedAt: Date;
}
