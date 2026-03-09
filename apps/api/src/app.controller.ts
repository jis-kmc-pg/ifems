import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * 개발용: Mock 데이터 초기화
   */
  @Post('reset-mock-data')
  async resetMockData() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Not allowed in production' };
    }

    await this.prisma.energyTimeseries.deleteMany();
    await this.prisma.tagDataRaw.deleteMany();

    return {
      message: 'Mock data cleared. New data will be generated in 1 minute.',
      timestamp: new Date().toISOString(),
    };
  }
}
