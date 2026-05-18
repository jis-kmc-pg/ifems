import { Module } from '@nestjs/common';
import { AuxController } from './auxiliary.controller';
import { AuxService } from './auxiliary.service';
import { PrismaService } from '../prisma.service';

/**
 * 부대설비(Auxiliary) 모듈 — i-FEMS fems 스키마 도메인
 *
 *  포함:
 *    - zones (공간 단위)
 *    - lux_standards (작업조도 KS A 3011)
 *    - schedule_rules (자동 운전 룰)
 *    - control_commands (제어 명령 이력)
 *
 *  비고:
 *    Prisma 모델은 아직 미연동 — 모든 DB 접근은 raw SQL ($queryRaw/$executeRaw)
 *    안정화 후 multiSchema 활성화 + @@schema("fems") 모델 도입 예정.
 */
@Module({
  controllers: [AuxController],
  providers: [AuxService, PrismaService],
  exports: [AuxService],
})
export class AuxModule {}
