import { Controller, Get, Query, Logger } from '@nestjs/common';
import { UsageAggregateService } from './usage-aggregate.service';
import { TrendAggregateService } from './trend-aggregate.service';
import { ResetDetectorService } from './reset-detector.service';

/**
 * TestCaggController
 * Continuous Aggregate 테스트용 임시 컨트롤러
 */
@Controller('test/cagg')
export class TestCaggController {
  private readonly logger = new Logger(TestCaggController.name);

  constructor(
    private readonly usageService: UsageAggregateService,
    private readonly trendService: TrendAggregateService,
    private readonly resetService: ResetDetectorService,
  ) {}

  /**
   * GET /test/cagg/usage/recent
   * 최근 USAGE 데이터 조회 (리셋 보정 포함)
   */
  @Get('usage/recent')
  async getRecentUsage(
    @Query('facilityId') facilityId?: string,
    @Query('minutes') minutes?: string,
  ) {
    this.logger.log(`Getting recent USAGE data: facility=${facilityId}, minutes=${minutes || 10}`);

    const data = await this.usageService.getRecentUsage(
      facilityId,
      minutes ? parseInt(minutes) : 10,
    );

    return {
      success: true,
      count: data.length,
      data,
    };
  }

  /**
   * GET /test/cagg/usage/range
   * 기간별 USAGE 데이터 조회
   */
  @Get('usage/range')
  async getUsageRange(
    @Query('facilityId') facilityId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('interval') interval?: '1min' | '5min' | '1hour' | '1day',
  ) {
    const start = startTime ? new Date(startTime) : new Date(Date.now() - 60 * 60 * 1000); // 1시간 전
    const end = endTime ? new Date(endTime) : new Date();

    this.logger.log(
      `Getting USAGE range: ${start.toISOString()} ~ ${end.toISOString()}, interval=${interval || '1min'}`,
    );

    const data = await this.usageService.getUsageData({
      facilityId,
      startTime: start,
      endTime: end,
      interval: interval || '1min',
    });

    return {
      success: true,
      count: data.length,
      params: {
        facilityId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        interval: interval || '1min',
      },
      data,
    };
  }

  /**
   * GET /test/cagg/resets
   * 리셋 이벤트 조회
   */
  @Get('resets')
  async getResets(
    @Query('facilityId') facilityId?: string,
    @Query('tagId') tagId?: string,
    @Query('hours') hours?: string,
  ) {
    const hoursAgo = hours ? parseInt(hours) : 24;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursAgo * 60 * 60 * 1000);

    this.logger.log(`Getting reset events: last ${hoursAgo} hours`);

    const resets = await this.usageService.getResetHistory({
      facilityId,
      tagId,
      startTime,
      endTime,
    });

    return {
      success: true,
      count: resets.length,
      params: {
        facilityId,
        tagId,
        hours: hoursAgo,
      },
      data: resets,
    };
  }

  /**
   * POST /test/cagg/detect-reset
   * 리셋 감지 수동 트리거 (테스트용)
   */
  @Get('detect-reset')
  async triggerResetDetection() {
    this.logger.log('Triggering manual reset detection...');

    await this.resetService.detectResets();

    return {
      success: true,
      message: 'Reset detection triggered. Check logs for results.',
    };
  }

  /**
   * GET /test/cagg/compare-hourly
   * 시간대별 사용량 비교 (오늘 vs 어제)
   */
  @Get('compare-hourly')
  async compareHourly(@Query('facilityId') facilityId: string) {
    if (!facilityId) {
      return {
        success: false,
        error: 'facilityId is required',
      };
    }

    this.logger.log(`Comparing hourly usage for facility: ${facilityId}`);

    const comparison = await this.usageService.compareUsageByHour(facilityId);

    return {
      success: true,
      data: comparison,
    };
  }

  /**
   * GET /test/cagg/trend/recent
   * 최근 TREND 데이터 조회 (순시값)
   */
  @Get('trend/recent')
  async getRecentTrend(
    @Query('facilityId') facilityId?: string,
    @Query('minutes') minutes?: string,
  ) {
    this.logger.log(`Getting recent TREND data: facility=${facilityId}, minutes=${minutes || 10}`);

    const data = await this.trendService.getRecentTrend(
      facilityId,
      minutes ? parseInt(minutes) : 10,
    );

    return {
      success: true,
      count: data.length,
      data,
    };
  }

  /**
   * GET /test/cagg/trend/realtime
   * 실시간 TREND 값 조회 (마지막 1분)
   */
  @Get('trend/realtime')
  async getRealTimeTrend(@Query('facilityIds') facilityIds: string) {
    const ids = facilityIds.split(',');
    this.logger.log(`Getting real-time TREND values for ${ids.length} facilities`);

    const data = await this.trendService.getRealTimeValues(ids);

    return {
      success: true,
      count: data.length,
      data,
    };
  }
}
