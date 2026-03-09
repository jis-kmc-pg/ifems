import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TagDataCollectorService } from './tag-data-collector.service';
import { EnergyAggregatorService } from './energy-aggregator.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    PrismaService,
    TagDataCollectorService,
    EnergyAggregatorService,
  ],
  exports: [TagDataCollectorService, EnergyAggregatorService],
})
export class DataCollectionModule {}
