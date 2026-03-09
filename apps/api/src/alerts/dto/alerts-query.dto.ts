import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class AlertCategoryDto {
  @IsNotEmpty()
  @IsIn(['power_quality', 'air_leak', 'cycle_anomaly'])
  category: string;
}

export class AlertHistoryQueryDto extends AlertCategoryDto {
  @IsOptional()
  @IsString()
  line?: string;

  @IsOptional()
  @IsString()
  facilityCode?: string;
}

export class SaveAlertActionDto {
  @IsNotEmpty()
  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  actionBy?: string;
}
