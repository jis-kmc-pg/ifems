import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  CreateZoneDto, UpdateZoneDto, ZoneDto, ZoneTreeNodeDto,
} from './dto/zone.dto';
import {
  CreateScheduleRuleDto, UpdateScheduleRuleDto, ScheduleRuleDto,
} from './dto/schedule-rule.dto';

/**
 * 부대설비(공조/조명/환경) 도메인 서비스
 *
 * fems 스키마는 schema.prisma에 모델로 등록돼 있지 않으므로 모든 접근은
 * Prisma의 $queryRaw / $executeRaw 를 통한 raw SQL 로 수행한다.
 */
@Injectable()
export class AuxService {
  private readonly logger = new Logger(AuxService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // zones
  // ──────────────────────────────────────────────

  async listZones(activeOnly = true): Promise<ZoneDto[]> {
    // facilities 통계 + 24h 사용량을 LEFT JOIN 으로 함께 반환
    //  - hvacCount/lightingCount/totalRatedW/totalCapacityRt: facility 마스터 집계
    //  - hvacKwh24h/lightingKwh24h: tag_data_raw 24시간 차분 (CUMULATIVE) — 가짜 데이터 포함
    return this.prisma.$queryRaw<ZoneDto[]>`
      WITH usage24 AS (
        SELECT f."zoneId",
               f.type,
               t.id AS tag_id,
               MAX(r.value) - MIN(r.value) AS diff
          FROM public.facilities f
          JOIN public.tags t ON t."facilityId" = f.id
          JOIN public.tag_data_raw r
            ON r."tagId" = t.id
           AND r.timestamp >= NOW() - interval '24 hours'
         WHERE f.type IN ('HVAC','LIGHTING')
           AND t."tagName" LIKE '%_POWER'
         GROUP BY f."zoneId", f.type, t.id
      ),
      usage_sum AS (
        SELECT "zoneId",
               SUM(diff) FILTER (WHERE type='HVAC')     AS hvac_kwh,
               SUM(diff) FILTER (WHERE type='LIGHTING') AS lighting_kwh
          FROM usage24
         GROUP BY "zoneId"
      )
      SELECT z.id, z.code, z.name, z."parentId", z."factoryId", z."areaSqm",
             z."zoneType", z.metadata, z."isActive", z."createdAt", z."updatedAt",
             COALESCE(s.hvac_count,     0)::int    AS "hvacCount",
             COALESCE(s.lighting_count, 0)::int    AS "lightingCount",
             COALESCE(s.total_rated_w,  0)::float  AS "totalRatedW",
             COALESCE(s.total_capacity_rt, 0)::float AS "totalCapacityRt",
             COALESCE(u.hvac_kwh,     0)::float    AS "hvacKwh24h",
             COALESCE(u.lighting_kwh, 0)::float    AS "lightingKwh24h"
        FROM fems.zones z
        LEFT JOIN (
          SELECT f."zoneId",
                 count(*) FILTER (WHERE f.type='HVAC')     AS hvac_count,
                 count(*) FILTER (WHERE f.type='LIGHTING') AS lighting_count,
                 SUM(COALESCE((f.metadata->>'ratedW')::float, 0))     AS total_rated_w,
                 SUM(COALESCE((f.metadata->>'capacityRT')::float, 0)) AS total_capacity_rt
            FROM public.facilities f
           WHERE f.type IN ('HVAC','LIGHTING')
           GROUP BY f."zoneId"
        ) s ON s."zoneId" = z.id
        LEFT JOIN usage_sum u ON u."zoneId" = z.id
       WHERE (${!activeOnly}::boolean OR z."isActive" = true)
       ORDER BY z.code
    `;
  }

  async getZone(id: string): Promise<ZoneDto> {
    const rows = await this.prisma.$queryRaw<ZoneDto[]>`
      SELECT id, code, name, "parentId", "factoryId", "areaSqm",
             "zoneType", metadata, "isActive", "createdAt", "updatedAt"
        FROM fems.zones WHERE id = ${id}
    `;
    if (rows.length === 0) throw new NotFoundException(`Zone not found: ${id}`);
    return rows[0];
  }

  async getZoneTree(): Promise<ZoneTreeNodeDto[]> {
    const flat = await this.listZones(true);
    const byId = new Map<string, ZoneTreeNodeDto>();
    flat.forEach(z => byId.set(z.id, { ...z, children: [] }));
    const roots: ZoneTreeNodeDto[] = [];
    byId.forEach(node => {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  async createZone(dto: CreateZoneDto): Promise<ZoneDto> {
    const rows = await this.prisma.$queryRaw<ZoneDto[]>`
      INSERT INTO fems.zones (code, name, "parentId", "factoryId", "areaSqm", "zoneType", metadata)
      VALUES (
        ${dto.code}, ${dto.name},
        ${dto.parentId ?? null}, ${dto.factoryId ?? null},
        ${dto.areaSqm ?? null}, ${dto.zoneType},
        ${dto.metadata ? Prisma.sql`${JSON.stringify(dto.metadata)}::jsonb` : Prisma.sql`NULL`}
      )
      RETURNING id, code, name, "parentId", "factoryId", "areaSqm",
                "zoneType", metadata, "isActive", "createdAt", "updatedAt"
    `;
    return rows[0];
  }

  async updateZone(id: string, dto: UpdateZoneDto): Promise<ZoneDto> {
    await this.getZone(id);
    const sets: Prisma.Sql[] = [];
    if (dto.name      !== undefined) sets.push(Prisma.sql`"name" = ${dto.name}`);
    if (dto.parentId  !== undefined) sets.push(Prisma.sql`"parentId" = ${dto.parentId}`);
    if (dto.areaSqm   !== undefined) sets.push(Prisma.sql`"areaSqm" = ${dto.areaSqm}`);
    if (dto.zoneType  !== undefined) sets.push(Prisma.sql`"zoneType" = ${dto.zoneType}`);
    if (dto.metadata  !== undefined) sets.push(
      dto.metadata === null
        ? Prisma.sql`metadata = NULL`
        : Prisma.sql`metadata = ${JSON.stringify(dto.metadata)}::jsonb`,
    );
    if (dto.isActive  !== undefined) sets.push(Prisma.sql`"isActive" = ${dto.isActive}`);

    if (sets.length === 0) return this.getZone(id);

    const rows = await this.prisma.$queryRaw<ZoneDto[]>`
      UPDATE fems.zones SET ${Prisma.join(sets, ', ')}
       WHERE id = ${id}
      RETURNING id, code, name, "parentId", "factoryId", "areaSqm",
                "zoneType", metadata, "isActive", "createdAt", "updatedAt"
    `;
    return rows[0];
  }

  async deleteZone(id: string): Promise<{ id: string }> {
    await this.getZone(id);
    await this.prisma.$executeRaw`DELETE FROM fems.zones WHERE id = ${id}`;
    return { id };
  }

  // ──────────────────────────────────────────────
  // lux_standards (KS A 3011)
  // ──────────────────────────────────────────────

  async listLuxStandards() {
    return this.prisma.$queryRaw`
      SELECT id, "zoneType", "requiredLux", description, reference,
             "createdAt", "updatedAt"
        FROM fems.lux_standards
       ORDER BY "requiredLux" DESC
    `;
  }

  // ──────────────────────────────────────────────
  // schedule_rules
  // ──────────────────────────────────────────────

  async listScheduleRules(enabledOnly = false): Promise<ScheduleRuleDto[]> {
    return this.prisma.$queryRaw<ScheduleRuleDto[]>`
      SELECT id, name, description, "targetType", "targetScope", "targetId",
             "dayOfWeek", "startTime"::text, "endTime"::text, condition,
             action, "actionValue", priority, enabled,
             "effectiveFrom", "effectiveTo", "createdBy",
             "createdAt", "updatedAt"
        FROM fems.schedule_rules
       WHERE (${!enabledOnly}::boolean OR enabled = true)
       ORDER BY priority DESC, name
    `;
  }

  async getScheduleRule(id: string): Promise<ScheduleRuleDto> {
    const rows = await this.prisma.$queryRaw<ScheduleRuleDto[]>`
      SELECT id, name, description, "targetType", "targetScope", "targetId",
             "dayOfWeek", "startTime"::text, "endTime"::text, condition,
             action, "actionValue", priority, enabled,
             "effectiveFrom", "effectiveTo", "createdBy",
             "createdAt", "updatedAt"
        FROM fems.schedule_rules WHERE id = ${id}
    `;
    if (rows.length === 0) throw new NotFoundException(`Schedule rule not found: ${id}`);
    return rows[0];
  }

  async createScheduleRule(dto: CreateScheduleRuleDto): Promise<ScheduleRuleDto> {
    const rows = await this.prisma.$queryRaw<ScheduleRuleDto[]>`
      INSERT INTO fems.schedule_rules
        (name, description, "targetType", "targetScope", "targetId",
         "dayOfWeek", "startTime", "endTime", condition, action, "actionValue",
         priority, enabled, "effectiveFrom", "effectiveTo", "createdBy")
      VALUES (
        ${dto.name}, ${dto.description ?? null},
        ${dto.targetType}, ${dto.targetScope}, ${dto.targetId},
        ${dto.dayOfWeek}::int[],
        ${dto.startTime ?? null}::time, ${dto.endTime ?? null}::time,
        ${dto.condition ? Prisma.sql`${JSON.stringify(dto.condition)}::jsonb` : Prisma.sql`NULL`},
        ${dto.action},
        ${dto.actionValue ? Prisma.sql`${JSON.stringify(dto.actionValue)}::jsonb` : Prisma.sql`NULL`},
        ${dto.priority ?? 0}, ${dto.enabled ?? true},
        ${dto.effectiveFrom ?? null}::date, ${dto.effectiveTo ?? null}::date,
        ${dto.createdBy ?? null}
      )
      RETURNING id, name, description, "targetType", "targetScope", "targetId",
                "dayOfWeek", "startTime"::text, "endTime"::text, condition,
                action, "actionValue", priority, enabled,
                "effectiveFrom", "effectiveTo", "createdBy",
                "createdAt", "updatedAt"
    `;
    return rows[0];
  }

  async updateScheduleRule(id: string, dto: UpdateScheduleRuleDto): Promise<ScheduleRuleDto> {
    await this.getScheduleRule(id);
    const sets: Prisma.Sql[] = [];
    if (dto.name          !== undefined) sets.push(Prisma.sql`name = ${dto.name}`);
    if (dto.description   !== undefined) sets.push(Prisma.sql`description = ${dto.description}`);
    if (dto.dayOfWeek     !== undefined) sets.push(Prisma.sql`"dayOfWeek" = ${dto.dayOfWeek}::int[]`);
    if (dto.startTime     !== undefined) sets.push(Prisma.sql`"startTime" = ${dto.startTime}::time`);
    if (dto.endTime       !== undefined) sets.push(Prisma.sql`"endTime"   = ${dto.endTime}::time`);
    if (dto.condition     !== undefined) sets.push(
      dto.condition === null
        ? Prisma.sql`condition = NULL`
        : Prisma.sql`condition = ${JSON.stringify(dto.condition)}::jsonb`,
    );
    if (dto.action        !== undefined) sets.push(Prisma.sql`action = ${dto.action}`);
    if (dto.actionValue   !== undefined) sets.push(
      dto.actionValue === null
        ? Prisma.sql`"actionValue" = NULL`
        : Prisma.sql`"actionValue" = ${JSON.stringify(dto.actionValue)}::jsonb`,
    );
    if (dto.priority      !== undefined) sets.push(Prisma.sql`priority = ${dto.priority}`);
    if (dto.enabled       !== undefined) sets.push(Prisma.sql`enabled = ${dto.enabled}`);
    if (dto.effectiveFrom !== undefined) sets.push(Prisma.sql`"effectiveFrom" = ${dto.effectiveFrom}::date`);
    if (dto.effectiveTo   !== undefined) sets.push(Prisma.sql`"effectiveTo"   = ${dto.effectiveTo}::date`);

    if (sets.length === 0) return this.getScheduleRule(id);

    const rows = await this.prisma.$queryRaw<ScheduleRuleDto[]>`
      UPDATE fems.schedule_rules SET ${Prisma.join(sets, ', ')}
       WHERE id = ${id}
      RETURNING id, name, description, "targetType", "targetScope", "targetId",
                "dayOfWeek", "startTime"::text, "endTime"::text, condition,
                action, "actionValue", priority, enabled,
                "effectiveFrom", "effectiveTo", "createdBy",
                "createdAt", "updatedAt"
    `;
    return rows[0];
  }

  async deleteScheduleRule(id: string): Promise<{ id: string }> {
    await this.getScheduleRule(id);
    await this.prisma.$executeRaw`DELETE FROM fems.schedule_rules WHERE id = ${id}`;
    return { id };
  }

  // ──────────────────────────────────────────────
  // control_commands (감사 이력 조회 + 수동 명령 기록)
  // ──────────────────────────────────────────────

  async listControlCommands(limit = 100, facilityId?: string) {
    if (facilityId) {
      return this.prisma.$queryRaw`
        SELECT id, "ruleId", "facilityId", command, "commandValue",
               source, "triggeredBy", result, "errorMessage", "executedAt"
          FROM fems.control_commands
         WHERE "facilityId" = ${facilityId}
         ORDER BY "executedAt" DESC
         LIMIT ${limit}
      `;
    }
    return this.prisma.$queryRaw`
      SELECT id, "ruleId", "facilityId", command, "commandValue",
             source, "triggeredBy", result, "errorMessage", "executedAt"
        FROM fems.control_commands
       ORDER BY "executedAt" DESC
       LIMIT ${limit}
    `;
  }
}
