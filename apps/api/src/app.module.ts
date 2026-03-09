import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { MonitoringModule } from './monitoring/monitoring.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AlertsModule } from './alerts/alerts.module';
import { AnalysisModule } from './analysis/analysis.module';
import { SettingsModule } from './settings/settings.module';
import { DataCollectionModule } from './data-collection/data-collection.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
// import { TagsModule } from './tags/tags.module'; // Disabled: Using settings/tag API instead

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DataCollectionModule,
    MonitoringModule,
    DashboardModule,
    AlertsModule,
    AnalysisModule,
    SettingsModule,
    // TagsModule, // Disabled: Using settings/tag API instead
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
  exports: [PrismaService],
})
export class AppModule {}
