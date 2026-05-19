import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

/**
 * Phase 2-② 룰 엔진 실행 워커
 *
 *  1분마다 fems.schedule_rules 중 enabled=true 인 룰들을 평가하여,
 *  현재 시각/요일/조건이 부합하면 대상 facility에 대해 fems.control_commands 발행.
 *
 *  중복 방지: 같은 ruleId × facilityId × command 가 동일 분(date_trunc('minute', NOW()))
 *  내에 이미 있으면 INSERT 스킵.
 *
 *  안전 장치:
 *  - 환경변수 AUX_RULE_ENGINE_ENABLED=true 일 때만 실제 발행.
 *    기본값(false)에서는 평가만 하고 로그 출력 → 운영 환경에 즉시 영향 없음.
 *
 *  현재 구현 범위 (PoC):
 *  - 시간 조건: dayOfWeek + startTime~endTime (자정 넘김 지원)
 *  - 유효 기간: effectiveFrom/To
 *  - condition JSONB: PoC에서는 무시 (occupancy/oaTempLt 등은 외부 신호 필요)
 *  - 액션: control_commands INSERT (result=SUCCESS) — 실제 제어 송신은 외부 게이트웨이 영역
 */
/**
 * ⚠️ Phase 2 PoC 한계:
 *  - condition JSONB 평가 미구현. {"occupancy": false}, {"oaTempLt": 18} 등은
 *    외부 신호 (출입통제 시스템, 외기 온도 센서) 연동이 필요하므로 Phase 3 작업.
 *  - 현재 룰 엔진은 dayOfWeek + startTime~endTime + effectiveFrom/To 만 평가.
 *  - condition 가진 룰도 시간 조건만 맞으면 발행됨 → 운영 활성화 전 주의.
 *
 * 운영 안전 모드:
 *  - AUX_RULE_ENGINE_ENABLED=false (기본): Cron 실행 안 함
 *  - AUX_RULE_ENGINE_MODE=DRY_RUN       : 평가만 하고 INSERT 안 함 (시뮬레이션 로그)
 *  - AUX_RULE_ENGINE_MODE=LIVE          : 실제 INSERT (기본)
 */
@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);
  private readonly enabled: boolean;
  private readonly dryRun: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.enabled = this.config.get<string>('AUX_RULE_ENGINE_ENABLED') === 'true';
    this.dryRun  = this.config.get<string>('AUX_RULE_ENGINE_MODE') === 'DRY_RUN';
    const mode = this.dryRun ? 'DRY_RUN (no INSERT)' : 'LIVE';
    this.logger.log(`🔧 RuleEngineService init — enabled=${this.enabled} mode=${mode}`);
    this.logger.log('⚠️  Phase 2 PoC: condition JSONB 평가는 미구현 (occupancy/oaTempLt 등 외부 신호 미연동)');
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'aux-rule-engine' })
  async tick(): Promise<void> {
    if (!this.enabled) return; // 안전: 환경변수로 비활성 상태 유지
    try {
      const issued = await this.evaluateAndIssue();
      if (issued > 0) {
        this.logger.log(`✅ rule-engine: issued ${issued} control_commands`);
      }
    } catch (err) {
      this.logger.error(`rule-engine tick failed: ${(err as Error).message}`);
    }
  }

  /**
   * 시간 매칭 조건 (요일 + 시간대 + 유효기간) — Prisma.sql fragment.
   *  - dayOfWeek 빈 배열 → 항상 매칭
   *  - startTime ≤ endTime: 같은 날 범위
   *  - startTime > endTime: 야간 (자정 넘김)
   *  - 둘 다 NULL: 전일
   */
  private timeMatchSql(): Prisma.Sql {
    return Prisma.sql`
      (
        EXTRACT(DOW FROM NOW())::int = ANY (r."dayOfWeek")
        OR cardinality(r."dayOfWeek") = 0
      )
      AND (r."effectiveFrom" IS NULL OR CURRENT_DATE >= r."effectiveFrom")
      AND (r."effectiveTo"   IS NULL OR CURRENT_DATE <= r."effectiveTo")
      AND (
        (r."startTime" IS NULL AND r."endTime" IS NULL)
        OR (r."startTime" <= r."endTime"
            AND CURRENT_TIME BETWEEN r."startTime" AND r."endTime")
        OR (r."startTime" > r."endTime"
            AND (CURRENT_TIME >= r."startTime" OR CURRENT_TIME <= r."endTime"))
      )
    `;
  }

  private async evaluateAndIssue(): Promise<number> {
    const match = this.timeMatchSql();
    // DRY_RUN: result='PENDING' + triggeredBy='rule-engine-dryrun' (감사 추적용 — 외부 송신 X)
    //   PENDING은 CHECK 제약에 포함된 합법 값. triggeredBy로 dryrun 식별.
    // LIVE   : result='SUCCESS' + triggeredBy='rule-engine' (정상 발행)
    const resultCol  = this.dryRun ? Prisma.sql`'PENDING'`            : Prisma.sql`'SUCCESS'`;
    const triggerCol = this.dryRun ? Prisma.sql`'rule-engine-dryrun'` : Prisma.sql`'rule-engine'`;

    // 1) FACILITY 대상 룰 → 단일 facility 발행
    const facilityCount = await this.prisma.$executeRaw`
      INSERT INTO fems.control_commands
        ("ruleId", "facilityId", command, "commandValue", source, "triggeredBy", result, "executedAt")
      SELECT r.id, r."targetId", r.action, r."actionValue", 'SCHEDULE', ${triggerCol}, ${resultCol}, NOW()
        FROM fems.schedule_rules r
       WHERE r.enabled = true
         AND r."targetScope" = 'FACILITY'
         AND ${match}
         AND NOT EXISTS (
           SELECT 1 FROM fems.control_commands c
            WHERE c."ruleId" = r.id
              AND c."facilityId" = r."targetId"
              AND c.command = r.action
              AND c."executedAt" >= date_trunc('minute', NOW())
         )
    `;

    // 2) ZONE 대상 룰 → zone 매핑 facilities 전수 발행
    const zoneCount = await this.prisma.$executeRaw`
      INSERT INTO fems.control_commands
        ("ruleId", "facilityId", command, "commandValue", source, "triggeredBy", result, "executedAt")
      SELECT r.id, f.id, r.action, r."actionValue", 'SCHEDULE', ${triggerCol}, ${resultCol}, NOW()
        FROM fems.schedule_rules r
        JOIN public.facilities f
          ON f."zoneId" = r."targetId"
         AND (
           (r."targetType" = 'MIXED')
           OR (r."targetType" = 'HVAC'     AND f.type = 'HVAC')
           OR (r."targetType" = 'LIGHTING' AND f.type = 'LIGHTING')
         )
       WHERE r.enabled = true
         AND r."targetScope" = 'ZONE'
         AND ${match}
         AND NOT EXISTS (
           SELECT 1 FROM fems.control_commands c
            WHERE c."ruleId" = r.id
              AND c."facilityId" = f.id
              AND c.command = r.action
              AND c."executedAt" >= date_trunc('minute', NOW())
         )
    `;

    return Number(facilityCount) + Number(zoneCount);
  }

  /**
   * 외부에서 강제 실행 (수동 트리거용).
   * AuxController.runRuleEngineNow 에서 사용.
   */
  async runOnce(): Promise<{ issued: number; wasEnabled: boolean }> {
    const wasEnabled = this.enabled;
    // runOnce는 enabled 여부와 관계없이 1회 실행 (관리자 수동 트리거)
    const issued = await this.evaluateAndIssue();
    return { issued, wasEnabled };
  }
}
