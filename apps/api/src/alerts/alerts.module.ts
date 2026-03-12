import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { PowerQualityDetectorService } from './power-quality-detector.service';
import { AirLeakDetectorService } from './air-leak-detector.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AlertsController],
  providers: [
    AlertsService,
    PowerQualityDetectorService,
    AirLeakDetectorService,
    PrismaService,
  ],
})
export class AlertsModule {}
