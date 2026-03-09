import { ApiProperty } from '@nestjs/swagger';
import type { ZoomLevel } from '../types/interval.enum';

/**
 * Range Data Point
 *
 * Single time-series data point with current and previous day values
 */
export class RangeDataPoint {
  @ApiProperty({
    description: '시간 (HH:MM:SS or HH:MM:SS.mmm)',
    example: '08:00:00',
  })
  time: string;

  @ApiProperty({
    description: '전력 (kWh, 소수점 2자리)',
    example: 3.45,
    required: false,
  })
  power?: number;

  @ApiProperty({
    description: '전일 전력 (kWh, 소수점 2자리)',
    example: 3.21,
    required: false,
  })
  prevPower?: number;

  @ApiProperty({
    description: '에어 (L, 정수)',
    example: 1250,
    required: false,
  })
  air?: number;

  @ApiProperty({
    description: '전일 에어 (L, 정수)',
    example: 1180,
    required: false,
  })
  prevAir?: number;
}

/**
 * Range Metadata
 *
 * Metadata about the returned range data
 */
export class RangeMetadata {
  @ApiProperty({
    description: '데이터 간격',
    example: '1m',
    enum: ['15m', '1m', '10s', '1s'],
  })
  interval: string;

  @ApiProperty({
    description: '집계된 총 포인트 수',
    example: 480,
  })
  totalPoints: number;

  @ApiProperty({
    description: '실제 반환된 포인트 수 (down-sampling 후)',
    example: 480,
  })
  returnedPoints: number;

  @ApiProperty({
    description: 'Down-sampling 적용 여부',
    example: false,
  })
  downsampled: boolean;

  @ApiProperty({
    description: 'Zoom Level (0: 15m, 1: 1m, 2: 10s, 3: 1s)',
    example: 1,
    enum: [0, 1, 2, 3],
  })
  zoomLevel: ZoomLevel;

  @ApiProperty({
    description: '요청된 시작 시간 (ISO8601)',
    example: '2024-01-01T00:00:00Z',
  })
  startTime: string;

  @ApiProperty({
    description: '요청된 종료 시간 (ISO8601)',
    example: '2024-01-01T23:59:59Z',
  })
  endTime: string;

  @ApiProperty({
    description: '설비 ID (Facility code)',
    example: 'HNK10-000',
  })
  facilityId: string;

  @ApiProperty({
    description: '메트릭 타입',
    example: 'power',
    enum: ['power', 'air'],
  })
  metric: 'power' | 'air';
}

/**
 * Anomaly Event
 *
 * 이상 데이터 구간 정보 (차트 시각화용)
 */
export class AnomalyEvent {
  @ApiProperty({ description: '이상 구간 시작 시각 (ISO8601)', example: '2024-01-01T08:30:00Z' })
  start: string;

  @ApiProperty({ description: '이상 구간 종료 시각 (ISO8601)', example: '2024-01-01T08:32:00Z' })
  end: string;

  @ApiProperty({ description: '태그 ID' })
  tagId: string;

  @ApiProperty({ description: '이상 유형', enum: ['spike', 'drop'] })
  type: 'spike' | 'drop';

  @ApiProperty({ description: '최대 배율', example: 7.3 })
  maxDeviation: number;

  @ApiProperty({ description: '연속 분수', example: 2 })
  consecutiveMinutes: number;

  @ApiProperty({ description: '대체 방식', enum: ['lastNormal', 'null'] })
  replacedWith: 'lastNormal' | 'null';
}

/**
 * Range Data Response
 *
 * Complete response structure for power/air range data endpoints
 */
export class RangeDataResponse {
  @ApiProperty({
    description: '시계열 데이터 배열',
    type: [RangeDataPoint],
  })
  data: RangeDataPoint[];

  @ApiProperty({
    description: '메타데이터',
    type: RangeMetadata,
  })
  metadata: RangeMetadata;

  @ApiProperty({
    description: '이상 데이터 이벤트 목록 (차트 시각화용)',
    type: [AnomalyEvent],
    required: false,
  })
  anomalies?: AnomalyEvent[];
}
