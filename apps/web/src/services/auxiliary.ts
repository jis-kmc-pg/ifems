// ============================================================
// i-FEMS 부대설비(공조/조명/환경) 도메인 서비스
// Backend: /api/aux/*  (fems 스키마)
// ============================================================

import {
  fetchApi, postApi, patchApi, deleteApi,
} from './service-helpers';

// ──────────────────────────────────────────────
// 타입 정의 — backend DTO와 일치 유지
// ──────────────────────────────────────────────

export const ZONE_TYPES = [
  'PRODUCTION', 'OFFICE', 'CORRIDOR', 'WAREHOUSE',
  'UTILITY', 'OUTDOOR', 'PARKING', 'LOUNGE',
] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  PRODUCTION: '작업장',
  OFFICE:     '사무',
  CORRIDOR:   '복도',
  WAREHOUSE:  '창고',
  UTILITY:    '유틸리티',
  OUTDOOR:    '옥외',
  PARKING:    '주차장',
  LOUNGE:     '휴게실',
};

export interface Zone {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  factoryId: string | null;
  areaSqm: number | null;
  zoneType: ZoneType;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // facilities 통계 (listZones 응답에만 포함)
  hvacCount?: number;
  lightingCount?: number;
  totalRatedW?: number;
  totalCapacityRt?: number;
  // 24h 누적 사용량 (kWh)
  hvacKwh24h?: number;
  lightingKwh24h?: number;
}

export interface ZoneTreeNode extends Zone {
  children: ZoneTreeNode[];
}

export interface CreateZoneInput {
  code: string;
  name: string;
  parentId?: string;
  factoryId?: string;
  areaSqm?: number;
  zoneType: ZoneType;
  metadata?: Record<string, unknown>;
}

export type UpdateZoneInput = Partial<
  Omit<CreateZoneInput, 'code'> & { isActive: boolean }
>;

export interface LuxStandard {
  id: string;
  zoneType: string;
  requiredLux: number;
  description: string | null;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TARGET_TYPES  = ['HVAC','LIGHTING','MIXED'] as const;
export const TARGET_SCOPES = ['FACILITY','ZONE']         as const;
export const ACTIONS       = ['ON','OFF','SETPOINT']     as const;
export type TargetType  = (typeof TARGET_TYPES)[number];
export type TargetScope = (typeof TARGET_SCOPES)[number];
export type ActionType  = (typeof ACTIONS)[number];

export interface ScheduleRule {
  id: string;
  name: string;
  description: string | null;
  targetType: TargetType;
  targetScope: TargetScope;
  targetId: string;
  dayOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  condition: Record<string, unknown> | null;
  action: ActionType;
  actionValue: Record<string, unknown> | null;
  priority: number;
  enabled: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleRuleInput {
  name: string;
  description?: string;
  targetType: TargetType;
  targetScope: TargetScope;
  targetId: string;
  dayOfWeek: number[];
  startTime?: string;
  endTime?: string;
  condition?: Record<string, unknown>;
  action: ActionType;
  actionValue?: Record<string, unknown>;
  priority?: number;
  enabled?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdBy?: string;
}

export type UpdateScheduleRuleInput = Partial<
  Omit<CreateScheduleRuleInput, 'targetType' | 'targetScope' | 'targetId'>
>;

export interface ControlCommand {
  id: string;
  ruleId: string | null;
  facilityId: string;
  command: ActionType;
  commandValue: Record<string, unknown> | null;
  source: 'SCHEDULE' | 'MANUAL' | 'INTERLOCK' | 'API';
  triggeredBy: string;
  result: 'SUCCESS' | 'FAILED' | 'PENDING';
  errorMessage: string | null;
  executedAt: string;
}

// ──────────────────────────────────────────────
// zones
// ──────────────────────────────────────────────
export const getZones = (includeInactive = false) =>
  fetchApi<Zone[]>([], '/aux/zones', includeInactive ? { all: 'true' } : undefined);

export const getZoneTree = () =>
  fetchApi<ZoneTreeNode[]>([], '/aux/zones/tree');

export const getZone = (id: string) =>
  fetchApi<Zone>({} as Zone, `/aux/zones/${id}`);

export const createZone = (data: CreateZoneInput) =>
  postApi<Zone>({} as Zone, '/aux/zones', data);

export const updateZone = (id: string, data: UpdateZoneInput) =>
  patchApi<Zone>({} as Zone, `/aux/zones/${id}`, data);

export const deleteZone = (id: string) =>
  deleteApi<{ id: string }>({ id }, `/aux/zones/${id}`);

// ──────────────────────────────────────────────
// lux standards
// ──────────────────────────────────────────────
export const getLuxStandards = () =>
  fetchApi<LuxStandard[]>([], '/aux/lux-standards');

// ──────────────────────────────────────────────
// schedule rules
// ──────────────────────────────────────────────
export const getScheduleRules = (enabledOnly = false) =>
  fetchApi<ScheduleRule[]>([], '/aux/schedule-rules', enabledOnly ? { enabled: 'true' } : undefined);

export const getScheduleRule = (id: string) =>
  fetchApi<ScheduleRule>({} as ScheduleRule, `/aux/schedule-rules/${id}`);

export const createScheduleRule = (data: CreateScheduleRuleInput) =>
  postApi<ScheduleRule>({} as ScheduleRule, '/aux/schedule-rules', data);

export const updateScheduleRule = (id: string, data: UpdateScheduleRuleInput) =>
  patchApi<ScheduleRule>({} as ScheduleRule, `/aux/schedule-rules/${id}`, data);

export const deleteScheduleRule = (id: string) =>
  deleteApi<{ id: string }>({ id }, `/aux/schedule-rules/${id}`);

// ──────────────────────────────────────────────
// control commands
// ──────────────────────────────────────────────
export const getControlCommands = (params?: { limit?: number; facilityId?: string }) =>
  fetchApi<ControlCommand[]>([], '/aux/control-commands', params as Record<string, unknown>);

// ──────────────────────────────────────────────
// trend (시간별 누적 사용량 — HVAC / LIGHTING)
// ──────────────────────────────────────────────
export interface TrendPoint {
  time: string;     // 'HH:mm'
  kwh: number;      // 1h 누적 사용량
  bucket: string;   // ISO timestamp (시간순 정렬용)
}

export const getHvacTrend = (hours = 24) =>
  fetchApi<TrendPoint[]>([], '/aux/hvac/trend', { hours });

export const getLightingTrend = (hours = 24) =>
  fetchApi<TrendPoint[]>([], '/aux/lighting/trend', { hours });
