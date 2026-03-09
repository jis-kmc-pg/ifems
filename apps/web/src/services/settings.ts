import { USE_MOCK } from '../lib/constants';
import { mockDelay, apiClient } from './api';
import { fetchApi, postApi, putApi, deleteApi } from './service-helpers';
import {
  POWER_QUALITY_SETTINGS, AIR_LEAK_SETTINGS, REFERENCE_CYCLES,
  CYCLE_ALERT_SETTINGS, ENERGY_ALERT_SETTINGS, CYCLE_ENERGY_ALERT_SETTINGS,
  SettingRow, CycleWaveformItem,
} from './mock/settings';
import { BLOCK_FACILITIES, type Facility } from './mock/facilities';

export type { SettingRow, CycleWaveformItem, Facility };

// ──────────────────────────────────────────────
// 알림 설정 (SET-001~006) — 단순 GET/PUT 패턴
// ──────────────────────────────────────────────
export const getPowerQualitySettings = () => fetchApi(POWER_QUALITY_SETTINGS, '/settings/power-quality');
export const savePowerQualitySettings = (rows: SettingRow[]) => putApi({ success: true }, '/settings/power-quality', rows);

export const getAirLeakSettings = () => fetchApi(AIR_LEAK_SETTINGS, '/settings/air-leak');
export const saveAirLeakSettings = (rows: SettingRow[]) => putApi({ success: true }, '/settings/air-leak', rows);

export const getReferenceCycles = () => fetchApi(REFERENCE_CYCLES, '/settings/reference-cycles');

export const getCycleAlertSettings = () => fetchApi(CYCLE_ALERT_SETTINGS, '/settings/cycle-alert');
export const saveCycleAlertSettings = (rows: SettingRow[]) => putApi({ success: true }, '/settings/cycle-alert', rows);

export const getEnergyAlertSettings = () => fetchApi(ENERGY_ALERT_SETTINGS, '/settings/energy-alert');
export const saveEnergyAlertSettings = (rows: SettingRow[]) => putApi({ success: true }, '/settings/energy-alert', rows);

export const getCycleEnergyAlertSettings = () => fetchApi(CYCLE_ENERGY_ALERT_SETTINGS, '/settings/cycle-energy-alert');
export const saveCycleEnergyAlertSettings = (rows: SettingRow[]) => putApi({ success: true }, '/settings/cycle-energy-alert', rows);

// ──────────────────────────────────────────────
// 설비 마스터 관리
// ──────────────────────────────────────────────
export const getFacilityMasterList = () => fetchApi(BLOCK_FACILITIES, '/settings/facility-master');

export async function saveFacilityMaster(facility: Facility) {
  if (USE_MOCK) return mockDelay({ success: true, data: facility });
  return putApi({ success: true, data: facility }, `/settings/facility-master/${facility.id}`, facility);
}

export async function createFacilityMaster(facility: Omit<Facility, 'id'>) {
  if (USE_MOCK) return mockDelay({ success: true, data: { ...facility, id: `f${Date.now()}` } });
  return postApi({ success: true }, '/settings/facility-master', facility);
}

export const deleteFacilityMaster = (id: string) => deleteApi({ success: true }, `/settings/facility-master/${id}`);

export const autoAssignProcess = () =>
  postApi<{ success: boolean; updated: number }>({ success: true, updated: 0 }, '/settings/facility-master/auto-assign-process');

// ──────────────────────────────────────────────
// 공장 관리 (Factory Management)
// ──────────────────────────────────────────────
export interface Factory {
  id: string;
  code: string;
  name: string;
  fullName?: string | null;
  location?: string | null;
  isActive: boolean;
  lineCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const getFactoryList = () => fetchApi([] as Factory[], '/settings/factory');

export const createFactory = (data: Omit<Factory, 'id' | 'createdAt' | 'updatedAt' | 'lineCount'>) =>
  postApi({ success: true }, '/settings/factory', data);

export const updateFactory = (id: string, data: Partial<Omit<Factory, 'id' | 'code' | 'createdAt' | 'updatedAt'>>) =>
  putApi({ success: true }, `/settings/factory/${id}`, data);

export const deleteFactory = (id: string) => deleteApi({ success: true }, `/settings/factory/${id}`);

// ──────────────────────────────────────────────
// 라인 관리 (Line Management)
// ──────────────────────────────────────────────
export interface Line {
  id: string;
  code: string;
  name: string;
  factoryId: string;
  factoryCode?: string;
  factoryName?: string;
  order: number;
  isActive: boolean;
  facilityCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const getLineList = (factoryId?: string) => fetchApi([] as Line[], '/settings/line', factoryId ? { factoryId } : undefined);

export const createLine = (data: { code: string; name: string; factoryId: string; order?: number; isActive?: boolean }) =>
  postApi({ success: true }, '/settings/line', data);

export const updateLine = (id: string, data: Partial<Omit<Line, 'id' | 'createdAt' | 'updatedAt'>>) =>
  putApi({ success: true }, `/settings/line/${id}`, data);

export const deleteLine = (id: string) => deleteApi({ success: true }, `/settings/line/${id}`);

// ──────────────────────────────────────────────
// 태그 관리 (Tag Management)
// ──────────────────────────────────────────────
export interface Tag {
  id: string;
  facilityId: string;
  facilityCode?: string;
  facilityName?: string;
  lineCode?: string;
  lineName?: string;
  factoryCode?: string;
  factoryName?: string;
  tagName: string;
  displayName: string;
  measureType: 'INSTANTANEOUS' | 'CUMULATIVE' | 'DISCRETE';
  category: 'ENERGY' | 'QUALITY' | 'ENVIRONMENT' | 'OPERATION' | 'CONTROL';
  energyType?: 'elec' | 'air' | 'gas' | 'solar' | null;
  unit?: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 복잡한 URL 조합 + 응답 변환 → 유지
export async function getTagList(filters?: {
  facilityId?: string;
  measureType?: string;
  category?: string;
  energyType?: string;
  search?: string;
}) {
  if (USE_MOCK) return mockDelay([]);
  const params = new URLSearchParams();
  if (filters?.facilityId) params.append('facilityId', filters.facilityId);
  if (filters?.measureType) params.append('measureType', filters.measureType);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.energyType) params.append('energyType', filters.energyType);
  if (filters?.search) params.append('search', filters.search);
  params.append('pageSize', '10000');
  const url = `/settings/tag${params.toString() ? '?' + params.toString() : ''}`;
  return apiClient.get(url).then((r) => {
    const result = r.data;
    if (result && Array.isArray(result.data)) return result.data;
    return Array.isArray(result) ? result : [];
  });
}

export const getTag = (id: string) => fetchApi(null, `/settings/tag/${id}`);

export const createTag = (data: Omit<Tag, 'id' | 'createdAt' | 'updatedAt' | 'facilityCode' | 'lineCode' | 'factoryCode'>) =>
  postApi({ success: true }, '/settings/tag', data);

export const updateTag = (id: string, data: Partial<Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>>) =>
  putApi({ success: true }, `/settings/tag/${id}`, data);

export const deleteTag = (id: string) => deleteApi({ success: true }, `/settings/tag/${id}`);

// ──────────────────────────────────────────────
// 계층 구조 (Hierarchy)
// ──────────────────────────────────────────────
export interface HierarchyFactory {
  id: string;
  code: string;
  name: string;
  fullName?: string | null;
  location?: string | null;
  isActive: boolean;
  lines: HierarchyLine[];
}

export interface HierarchyLine {
  id: string;
  code: string;
  name: string;
  order: number;
  isActive: boolean;
  facilities: HierarchyFacility[];
}

export interface HierarchyFacility {
  id: string;
  code: string;
  name: string;
  process: string;
  type: string;
  status: string;
  isProcessing: boolean;
  tagCount?: number;
}

export const getHierarchy = () => fetchApi([] as HierarchyFactory[], '/settings/hierarchy');
export const getFactoryHierarchy = (factoryId: string) => fetchApi(null, `/settings/hierarchy/factory/${factoryId}`);
export const getLineHierarchy = (lineId: string) => fetchApi(null, `/settings/hierarchy/line/${lineId}`);
export const getFacilityTags = (facilityId: string) => fetchApi([], `/settings/hierarchy/facility/${facilityId}`);

// ──────────────────────────────────────────────
// 설비 유형 관리 (FacilityType Management)
// ──────────────────────────────────────────────
export interface FacilityType {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
  order: number;
  facilityCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const getFacilityTypeList = () => fetchApi([] as FacilityType[], '/settings/facility-type');

export const createFacilityType = (data: Omit<FacilityType, 'id' | 'createdAt' | 'updatedAt' | 'facilityCount'>) =>
  postApi({ success: true }, '/settings/facility-type', data);

export const updateFacilityType = (id: string, data: Partial<Omit<FacilityType, 'id' | 'code' | 'createdAt' | 'updatedAt'>>) =>
  putApi({ success: true }, `/settings/facility-type/${id}`, data);

export const deleteFacilityType = (id: string) => deleteApi({ success: true }, `/settings/facility-type/${id}`);

// ──────────────────────────────────────────────
// 태그 일괄 업로드 (Tag Bulk Upload) — 복잡한 로직 → 유지
// ──────────────────────────────────────────────
export interface BulkUploadResult {
  total: number;
  success: number;
  failed: number;
  warnings: number;
  results: {
    row: number;
    status: 'success' | 'error' | 'warning';
    data?: any;
    message?: string;
    errors?: string[];
  }[];
}

export async function uploadTagBulk(file: File) {
  if (USE_MOCK) return mockDelay({ total: 0, success: 0, failed: 0, warnings: 0, results: [] });
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post('/settings/tag/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
}

export async function downloadTagBulkTemplate() {
  if (USE_MOCK) {
    const sampleData = 'facilityCode,tagName,displayName,measureType,category,energyType,unit,order\nHNK10-010-1,SAMPLE_TAG_1,샘플 태그 1,CUMULATIVE,ENERGY,elec,kWh,0\nHNK10-010-2,SAMPLE_TAG_2,샘플 태그 2,INSTANTANEOUS,ENVIRONMENT,,℃,1';
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tag_bulk_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  return apiClient.get('/settings/tag/bulk-template', { responseType: 'blob' }).then((r) => {
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tag_bulk_template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ──────────────────────────────────────────────
// 태그 재할당 (Tag Reassignment)
// ──────────────────────────────────────────────
export interface TagReassignmentResponse {
  success: number;
  failed: number;
  results: {
    tagId: string;
    tagName: string;
    status: 'success' | 'error';
    message?: string;
  }[];
}

export interface TagReassignmentLog {
  id: string;
  tagId: string;
  fromFacilityId: string;
  toFacilityId: string;
  reason?: string | null;
  reassignedBy?: string | null;
  reassignedAt: string;
  fromFacilityCode?: string;
  toFacilityCode?: string;
}

export const reassignTags = (data: { tagIds: string[]; targetFacilityId: string; reason?: string; reassignedBy?: string }) =>
  postApi({ success: 0, failed: 0, results: [] }, '/settings/tag/reassign', data);

export const getTagReassignmentHistory = (tagId: string) =>
  fetchApi([] as TagReassignmentLog[], `/settings/tag/${tagId}/reassignment-history`);

// ──────────────────────────────────────────────
// 에너지 소스 매핑 관리 (Energy Config) — 복잡한 URL 조합 → 유지
// ──────────────────────────────────────────────
export interface EnergyConfigTag {
  id: string;
  tagName: string;
  displayName: string;
  measureType: string;
  isActive: boolean;
  configTagId?: string;
}

export interface EnergyConfig {
  id: string;
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  lineCode: string;
  lineName: string;
  energyType: 'elec' | 'air' | 'gas' | 'solar';
  calcMethod: 'DIFF' | 'INTEGRAL_TRAP';
  tags: EnergyConfigTag[];
  tagCount: number;
  hasCumulativeTag: boolean;
  cumulativeTagCount: number;
  description: string | null;
  configuredBy: string | null;
  needsReview: boolean;
  isActive: boolean;
  since: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnergyConfigDetail extends EnergyConfig {
  availableTags: { id: string; tagName: string; displayName: string; measureType: string; energyType: string; unit: string | null }[];
}

export interface EnergyConfigSummary {
  total: number;
  totalTags: number;
  needsReview: number;
  switchableCount: number;
  integralCount: number;
  byCalcMethod: { calcMethod: string; count: number }[];
  byEnergyType: { energyType: string; count: number }[];
}

export interface EnergyConfigHistory {
  id: string;
  facilityId: string;
  energyType: string;
  action: string;
  prevCalcMethod: string | null;
  newCalcMethod: string | null;
  tagId: string | null;
  tagName: string | null;
  reason: string | null;
  changedBy: string | null;
  changedAt: string;
}

export async function getEnergyConfigList(filters?: {
  lineCode?: string;
  energyType?: string;
  needsReview?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  if (USE_MOCK) return mockDelay({ data: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } });
  const params = new URLSearchParams();
  if (filters?.lineCode) params.append('lineCode', filters.lineCode);
  if (filters?.energyType) params.append('energyType', filters.energyType);
  if (filters?.needsReview !== undefined) params.append('needsReview', String(filters.needsReview));
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
  const url = `/settings/energy-config${params.toString() ? '?' + params.toString() : ''}`;
  return apiClient.get(url).then((r) => r.data);
}

export const getEnergyConfig = (id: string): Promise<EnergyConfigDetail> => fetchApi(null as unknown as EnergyConfigDetail, `/settings/energy-config/${id}`);

export const updateEnergyConfig = (id: string, data: {
  calcMethod?: string;
  tagIds?: string[];
  description?: string;
  configuredBy?: string;
  needsReview?: boolean;
  isActive?: boolean;
}) => putApi({ success: true }, `/settings/energy-config/${id}`, data);

export async function getEnergyConfigHistory(filters?: {
  facilityId?: string;
  energyType?: string;
  page?: number;
  pageSize?: number;
}) {
  if (USE_MOCK) return mockDelay({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  const params = new URLSearchParams();
  if (filters?.facilityId) params.append('facilityId', filters.facilityId);
  if (filters?.energyType) params.append('energyType', filters.energyType);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
  const url = `/settings/energy-config/history${params.toString() ? '?' + params.toString() : ''}`;
  return apiClient.get(url).then((r) => r.data);
}

export const getEnergyConfigSummary = () =>
  fetchApi({ total: 0, needsReview: 0, byCalcMethod: [], byEnergyType: [] } as unknown as EnergyConfigSummary, '/settings/energy-config/summary');

export const autoGenerateEnergyConfigs = () =>
  postApi({ created: 0, skipped: 0, tagsMapped: 0 }, '/settings/energy-config/auto-generate');

// ──────────────────────────────────────────────
// 비생산시간 설정 (Non-Production Schedule)
// ──────────────────────────────────────────────
export interface NonProductionScheduleItem {
  id?: string;
  dayType: 'weekday' | 'saturday' | 'sunday';
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface LineSchedule {
  lineId: string;
  lineCode: string;
  lineName: string;
  schedules: NonProductionScheduleItem[];
}

const MOCK_LINE_SCHEDULES: LineSchedule[] = [
  { lineId: 'block', lineCode: 'block', lineName: '블록', schedules: [
    { dayType: 'weekday', startTime: '08:00', endTime: '18:00' },
    { dayType: 'saturday', startTime: '08:00', endTime: '13:00' },
    { dayType: 'sunday', startTime: '00:00', endTime: '00:00' },
  ]},
  { lineId: 'head', lineCode: 'head', lineName: '헤드', schedules: [
    { dayType: 'weekday', startTime: '08:00', endTime: '18:00' },
    { dayType: 'saturday', startTime: '08:00', endTime: '13:00' },
    { dayType: 'sunday', startTime: '00:00', endTime: '00:00' },
  ]},
  { lineId: 'crank', lineCode: 'crank', lineName: '크랭크', schedules: [
    { dayType: 'weekday', startTime: '08:00', endTime: '18:00' },
    { dayType: 'saturday', startTime: '08:00', endTime: '13:00' },
    { dayType: 'sunday', startTime: '00:00', endTime: '00:00' },
  ]},
  { lineId: 'assembly', lineCode: 'assembly', lineName: '조립', schedules: [
    { dayType: 'weekday', startTime: '08:00', endTime: '20:00' },
    { dayType: 'saturday', startTime: '08:00', endTime: '17:00' },
    { dayType: 'sunday', startTime: '00:00', endTime: '00:00' },
  ]},
];

export const getAllNonProductionSchedules = () =>
  fetchApi(MOCK_LINE_SCHEDULES, '/settings/non-production-schedules');

export const getNonProductionSchedules = (lineId: string) =>
  fetchApi([] as NonProductionScheduleItem[], `/settings/non-production-schedules/${lineId}`);

export const saveNonProductionSchedules = (lineId: string, schedules: NonProductionScheduleItem[]) =>
  putApi({ success: true }, '/settings/non-production-schedules', { lineId, schedules });

// ──────────────────────────────────────────────
// 생산 캘린더 (Production Calendar)
// ──────────────────────────────────────────────
export interface ProductionCalendarEntry {
  id: string;
  lineId: string | null;
  lineCode: string | null;
  lineName: string | null;
  date: string; // "YYYY-MM-DD"
  type: 'holiday' | 'workday' | 'shutdown';
  description: string | null;
}

export const getProductionCalendar = (filters?: { lineId?: string; year?: number; month?: number }) =>
  fetchApi([] as ProductionCalendarEntry[], '/settings/production-calendar', filters);

export const createProductionCalendar = (data: { lineId?: string; date: string; type: string; description?: string }) =>
  postApi({ success: true }, '/settings/production-calendar', data);

export const deleteProductionCalendar = (id: string) =>
  deleteApi({ success: true }, `/settings/production-calendar/${id}`);

// ──────────────────────────────────────────────
// 시스템 설정 (System Settings) — key-value 방식
// ──────────────────────────────────────────────
export type SystemSettingValue = {
  value: any;
  description: string | null;
};

export const getSystemSettings = () =>
  fetchApi({} as Record<string, SystemSettingValue>, '/settings/system');

export const saveSystemSettings = (settings: Record<string, SystemSettingValue>) =>
  putApi({} as Record<string, SystemSettingValue>, '/settings/system', settings);
