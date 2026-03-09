import { ApiProperty } from '@nestjs/swagger';
import { CreateTagDto } from './tag.dto';

export class BulkUploadResponseDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  success: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  warnings: number;

  @ApiProperty({ type: [Object] })
  results: BulkUploadResultItem[];
}

export interface BulkUploadResultItem {
  row: number;
  status: 'success' | 'error' | 'warning';
  data?: Partial<CreateTagDto & { facilityCode: string }>;
  message?: string;
  errors?: string[];
}
