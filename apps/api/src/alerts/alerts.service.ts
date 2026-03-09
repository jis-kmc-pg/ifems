import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { todayStart, daysAgo, roundTo, changeRate } from '../common/utils/date-time.utils';
import { lineFilter } from '../common/utils/query-helpers';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getAlertStatsKpi(category: string) {
    this.logger.log(`Fetching alert stats KPI for category: ${category}`);

    try {
      const today = todayStart();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date(today);
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const alertType = this.getAlertType(category);

      // 전체 알림 수
      const total = await this.prisma.alert.count({
        where: {
          type: alertType,
          detectedAt: { gte: sevenDaysAgo },
        },
      });

      // 주간 알림 수 (최근 7일)
      const weekly = total;

      // 전주 대비 변화율 계산을 위한 이전 주 데이터
      const previousWeekly = await this.prisma.alert.count({
        where: {
          type: alertType,
          detectedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      });

      const weeklyChange = previousWeekly > 0
        ? Math.round(((weekly - previousWeekly) / previousWeekly) * 100)
        : 0;

      // 조치 완료 알림 수
      const resolved = await this.prisma.alert.count({
        where: {
          type: alertType,
          detectedAt: { gte: sevenDaysAgo },
          actionTaken: { not: null },
        },
      });

      const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      return {
        total,
        weekly,
        weeklyChange,
        resolved,
        resolvedRate,
      };
    } catch (error) {
      this.logger.error('Error fetching alert stats KPI:', error);
      throw error;
    }
  }

  async getAlertTrend(category: string) {
    this.logger.log(`Fetching alert trend for category: ${category}`);

    try {
      const today = todayStart();
      const eightWeeksAgo = new Date(today);
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      const alertType = this.getAlertType(category);

      const trend = await this.prisma.$queryRaw<any[]>`
        SELECT
          to_char(date_trunc('week', a."detectedAt"), 'MM/DD') as week,
          COUNT(*) as count
        FROM alerts a
        WHERE a."detectedAt" >= ${eightWeeksAgo}
          AND a.type::text = ${alertType}
        GROUP BY date_trunc('week', a."detectedAt")
        ORDER BY date_trunc('week', a."detectedAt")
      `;

      return trend.map((t) => ({
        week: t.week,
        count: Number(t.count || 0),
      }));
    } catch (error) {
      this.logger.error('Error fetching alert trend:', error);
      throw error;
    }
  }

  // 설비별 알림 히트맵 - ALT-001~003 통계 화면에서 사용
  // Frontend expects: [{facility, week1, week2, ..., week8}]
  async getAlertHeatmap(category: string) {
    this.logger.log(`Fetching alert heatmap for category: ${category}`);

    try {
      const today = todayStart();
      const eightWeeksAgo = new Date(today);
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      const alertType = this.getAlertType(category);

      // 설비별 + 주차별 알림 수
      const data = await this.prisma.$queryRaw<any[]>`
        SELECT
          f.code as facility,
          EXTRACT(WEEK FROM a."detectedAt") - EXTRACT(WEEK FROM ${eightWeeksAgo}::timestamp) + 1 as week_num,
          COUNT(*) as count
        FROM alerts a
        JOIN facilities f ON a."facilityId" = f.id
        WHERE a."detectedAt" >= ${eightWeeksAgo}
          AND a.type::text = ${alertType}
        GROUP BY f.code, week_num
        ORDER BY SUM(COUNT(*)) OVER (PARTITION BY f.code) DESC
      `;

      // 설비별로 그룹핑
      const facilityMap = new Map<string, Record<string, number>>();
      for (const row of data) {
        const facility = row.facility;
        if (!facilityMap.has(facility)) {
          facilityMap.set(facility, {});
        }
        const weekKey = `week${Math.min(8, Math.max(1, Number(row.week_num)))}`;
        const map = facilityMap.get(facility)!;
        map[weekKey] = (map[weekKey] || 0) + Number(row.count || 0);
      }

      // 상위 5개 설비
      const result = Array.from(facilityMap.entries())
        .map(([facility, weeks]) => ({
          facility,
          week1: weeks['week1'] || 0,
          week2: weeks['week2'] || 0,
          week3: weeks['week3'] || 0,
          week4: weeks['week4'] || 0,
          week5: weeks['week5'] || 0,
          week6: weeks['week6'] || 0,
          week7: weeks['week7'] || 0,
          week8: weeks['week8'] || 0,
        }))
        .sort((a, b) => {
          const sumA = a.week1 + a.week2 + a.week3 + a.week4 + a.week5 + a.week6 + a.week7 + a.week8;
          const sumB = b.week1 + b.week2 + b.week3 + b.week4 + b.week5 + b.week6 + b.week7 + b.week8;
          return sumB - sumA;
        })
        .slice(0, 5);

      return result;
    } catch (error) {
      this.logger.error('Error fetching alert heatmap:', error);
      // 데이터가 없을 때 빈 배열 반환
      return [];
    }
  }

  // Frontend expects: AlertHistoryItem[] = {id, no, timestamp, line, facilityCode, facilityName, baseline, current, ratio, status, action?, category}
  async getAlertHistory(category: string, line?: string, facilityCode?: string) {
    this.logger.log(`Fetching alert history for category: ${category}`);

    try {
      const today = todayStart();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const alertType = this.getAlertType(category);
      const lineCondition = lineFilter(line);
      const facilityCondition = facilityCode ? Prisma.sql`AND f.code = ${facilityCode}` : Prisma.empty;

      const history = await this.prisma.$queryRaw<any[]>`
        SELECT
          a.id,
          a."detectedAt" as timestamp,
          a.severity,
          CASE WHEN a."actionTaken" IS NOT NULL THEN 'RESOLVED' ELSE 'ACTIVE' END as status,
          a."actionTaken" as action,
          a.metadata,
          f.code as facility_code,
          f.name as facility_name,
          f.process,
          l.name as line_name
        FROM alerts a
        JOIN facilities f ON a."facilityId" = f.id
        JOIN lines l ON f."lineId" = l.id
        WHERE a."detectedAt" >= ${sevenDaysAgo}
          AND a.type::text = ${alertType}
          ${lineCondition}
          ${facilityCondition}
        ORDER BY a."detectedAt" DESC
        LIMIT 50
      `;

      return history.map((h, idx) => {
        let baseline = '';
        let current = '';
        let ratio = 0;

        // Extract metadata values
        const metadata = typeof h.metadata === 'object' ? h.metadata : {};

        if (category === 'power_quality') {
          baseline = '5.0%';
          const ub = Number(metadata.imbalance || 0);
          current = `${ub.toFixed(1)}%`;
          ratio = Math.round((ub / 5.0) * 100);
        } else if (category === 'air_leak') {
          const base = 10000;
          const cur = Number(metadata.airUsage || 0);
          baseline = `${base} L`;
          current = `${Math.round(cur)} L`;
          ratio = base > 0 ? Math.round((cur / base) * 100) : 0;
        } else {
          const base = 900;
          const cur = Number(metadata.powerUsage || 0);
          baseline = `${base.toFixed(2)} kW`;
          current = `${cur.toFixed(1)} kW`;
          ratio = base > 0 ? Math.round((cur / base) * 100) : 0;
        }

        return {
          id: h.id,
          no: idx + 1,
          timestamp: h.timestamp instanceof Date ? h.timestamp.toISOString() : String(h.timestamp),
          line: h.line_name || '',
          facilityCode: h.facility_code,
          facilityName: `${h.facility_code} ${h.process || ''}`.trim(),
          baseline,
          current,
          ratio,
          status: h.status || 'ACTIVE',
          action: h.action || undefined,
          category,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching alert history:', error);
      throw error;
    }
  }

  // 조치사항 저장
  async saveAlertAction(id: string, action: string, actionBy?: string) {
    this.logger.log(`Saving alert action for id: ${id}, action: ${action}`);

    try {
      const updatedAlert = await this.prisma.alert.update({
        where: { id },
        data: {
          actionTaken: action,
          actionTakenBy: actionBy || 'system',
          actionTakenAt: new Date(),
        },
      });

      return { success: true, id, action, updatedAt: updatedAlert.updatedAt };
    } catch (error) {
      this.logger.error(`Error saving alert action for id ${id}:`, error);
      throw error;
    }
  }

  // 싸이클 파형 데이터 (이력 상세 모달)
  // Frontend expects: Array<{ time: string; current: number; prev: number }>
  async getCycleWaveformForAlert(alertId: string) {
    this.logger.log(`Fetching cycle waveform for alert: ${alertId}`);

    // 파형 데이터 생성 (실제로는 시계열 데이터에서 추출)
    const baseValue = 850;
    const variance = 180;
    const points = 60; // 1시간, 1분 단위

    const now = todayStart();

    return Array.from({ length: points }, (_, i) => {
      const time = new Date(now.getTime() + i * 60000);
      const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
      // Deterministic sine wave pattern instead of Math.random()
      const noise = Math.sin(i / 10) * variance;
      const prevNoise = Math.sin((i + 5) / 10) * variance * 0.8;
      return {
        time: timeStr,
        current: Math.max(0, baseValue + noise),
        prev: Math.max(0, baseValue + prevNoise),
      };
    });
  }

  // 싸이클 이상 유형 목록
  async getCycleAnomalyTypes() {
    this.logger.log('Fetching cycle anomaly types');

    // CycleStatus enum 값 반환
    return [
      { value: 'NORMAL', label: '정상' },
      { value: 'DELAYED', label: '지연' },
      { value: 'ANOMALY', label: '이상' },
      { value: 'INCOMPLETE', label: '미완료' },
    ];
  }

  // Helper: 카테고리를 AlertType enum으로 변환
  private getAlertType(category: string): any {
    switch (category) {
      case 'power_quality':
        return 'POWER_QUALITY';
      case 'air_leak':
        return 'AIR_LEAK';
      case 'cycle_anomaly':
        return 'CYCLE_ANOMALY';
      default:
        return 'THRESHOLD';
    }
  }
}
