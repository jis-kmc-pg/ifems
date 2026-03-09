import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const databaseUrl =
      configService.get<string>('DATABASE_URL') || 'postgresql://postgres:ifems2026@localhost:5432/ifems?schema=public';

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    this.logger.log(`🔌 Prisma Client initialized with DATABASE_URL: ${databaseUrl}`);
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Prisma Client connected to database');
    } catch (error) {
      this.logger.warn('⚠️ Prisma Client connection failed - API will start without Prisma');
      this.logger.warn('Error details: ' + error.message);
      // 연결 실패 시에도 앱은 계속 실행되도록 함 (Prisma 없이)
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('👋 Prisma Client disconnected from database');
    } catch (error) {
      this.logger.warn('Disconnect error: ' + error.message);
    }
  }
}
