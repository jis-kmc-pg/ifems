import { Module } from '@nestjs/common';
import { MonitoringController, LineRangeDataController, FactoryRangeDataController, DynamicResolutionController } from './monitoring.controller';
import { TestCaggController } from './test-cagg.controller';
import { MonitoringService } from './monitoring.service';
import { ResetDetectorService } from './reset-detector.service';
import { UsageAggregateService } from './usage-aggregate.service';
import { TrendAggregateService } from './trend-aggregate.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MonitoringController, LineRangeDataController, FactoryRangeDataController, DynamicResolutionController, TestCaggController],
  providers: [
    MonitoringService,
    ResetDetectorService,
    UsageAggregateService,
    TrendAggregateService,
    PrismaService,
  ],
  exports: [UsageAggregateService, TrendAggregateService, ResetDetectorService],
})
export class MonitoringModule {}
