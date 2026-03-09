import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsString, IsOptional, ArrayMinSize } from 'class-validator';

export class TagReassignmentDto {
  @ApiProperty({ type: [String], example: ['tag-id-1', 'tag-id-2'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tagIds: string[];

  @ApiProperty({ example: 'target-facility-id' })
  @IsString()
  targetFacilityId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reassignedBy?: string;
}

export class TagReassignmentResponseDto {
  @ApiProperty()
  success: number;

  @ApiProperty()
  failed: number;

  @ApiProperty({ type: [Object] })
  results: {
    tagId: string;
    tagName: string;
    status: 'success' | 'error';
    message?: string;
  }[];
}
