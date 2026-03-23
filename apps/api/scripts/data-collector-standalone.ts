/**
 * 독립 데이터 수집기 (Standalone Data Collector)
 *
 * 백엔드(NestJS)와 별도로 실행되는 Mock 데이터 생성기
 * 백엔드 재시작 시에도 데이터 수집이 끊기지 않음
 *
 * 기능:
 * 1. 10초 주기 태그 데이터 수집
 * 2. 매시 :24분 CYCLE/STEP 데모 데이터 생성
 *
 * 실행: pnpm --filter @ifems/api collector
 * 또는: cd apps/api && npx tsx scripts/data-collector-standalone.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ─── 파일 로깅 (종료 원인 추적용) ───
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'collector.log');

function fileLog(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch { /* ignore */ }
}

// 수집기 전용 connection pool (백엔드와 분리, 소량 연결)
const baseUrl = (process.env.DATABASE_URL || 'postgresql://postgres:1@localhost:5432/ifems?schema=public')
  .replace(/[?&]connection_limit=\d+/g, '')
  .replace(/[?&]pool_timeout=\d+/g, '');
const collectorDbUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'connection_limit=10&pool_timeout=30';

const prisma = new PrismaClient({
  datasourceUrl: collectorDbUrl,
});

const INTERVAL_MS = 1_000; // 1초 주기
const cumulativeValues = new Map<string, number>();
let cachedTags: any[] | null = null;
let running = true;
let consecutiveErrors = 0;
let insertCounter = 0; // count() 대신 내부 카운터 (풀스캔 방지)
const MAX_CONSECUTIVE_ERRORS = 10; // 10연속 에러 시 DB 재연결

// ─── 랜덤성 개선: 태그별 상태 ───
const tagWalkState = new Map<string, number>();   // 랜덤워크 현재 위치 (-1~1 비율)
const tagOffUntil = new Map<string, number>();     // 설비정지 종료 시각 (ms)
const discreteState = new Map<string, { value: number; until: number }>(); // DISCRETE 상태 유지

/** 태그 ID 해시 → 0~1 사이 고정값 (태그별 고유 기저값 산출용) */
function tagHash01(tagId: string): number {
  let h = 0;
  for (let i = 0; i < tagId.length; i++) {
    h = ((h << 5) - h + tagId.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

/** 태그별 고유 기저값 (min~max 범위 내 고정 위치) */
function getTagBaseline(tagId: string, min: number, max: number): number {
  return min + tagHash01(tagId) * (max - min);
}

/** 평균 회귀 랜덤워크: 이전 위치에서 소폭 이동, 기저값으로 회귀 */
function randomWalk(tagId: string, stepSize: number, reversion: number): number {
  const prev = tagWalkState.get(tagId) ?? 0;
  const step = (Math.random() - 0.5) * 2 * stepSize;  // ±stepSize
  const pull = -prev * reversion;                       // 평균 회귀력
  const next = Math.max(-1, Math.min(1, prev + step + pull));
  tagWalkState.set(tagId, next);
  return next;
}

/** 설비 정지 이벤트 체크/시작 (INSTANTANEOUS 태그용) */
function isEquipmentOff(tagId: string): boolean {
  const now = Date.now();
  const offEnd = tagOffUntil.get(tagId);
  if (offEnd && now < offEnd) return true;
  if (offEnd && now >= offEnd) { tagOffUntil.delete(tagId); return false; }
  // 0.3% 확률로 정지 시작 (10~60초)
  if (Math.random() < 0.003) {
    tagOffUntil.set(tagId, now + (10 + Math.random() * 50) * 1000);
    return true;
  }
  return false;
}

// ─── CYCLE/STEP 관련 상태 ───
const MODEL_IDS = [1, 2, 28, 50, 60];
let modelIdIndex = 0;
let cycleGeneratedThisHour = false;
let cycleInitDone = false;

// facilityId → baseDuration(초) 캐시
const baseDurationMap = new Map<string, number>();
// facilityId → MACH_ID 캐시
const facilityMachIdMap = new Map<string, number>();
// facilityId → tagName[] 캐시 (트렌드 태그)
const facilityTrendTags = new Map<string, string[]>();

const DEFAULT_BASE_DURATION = 242; // 전체 중앙값 (초)

function log(msg: string) {
  const time = new Date().toLocaleTimeString('ko-KR');
  console.log(`[${time}] [DataCollector] ${msg}`);
}

function logCycle(msg: string) {
  const time = new Date().toLocaleTimeString('ko-KR');
  console.log(`[${time}] [CycleGenerator] ${msg}`);
}

// ─── 태그 수집 관련 ───

/** DB에서 CUMULATIVE 태그의 마지막 적산값 복원 */
async function loadCumulativeValues() {
  try {
    // 최근 1시간 데이터에서만 적산값 복원 (전체 스캔 방지)
    const lastValues = await prisma.$queryRawUnsafe<
      Array<{ tagId: string; lastValue: number }>
    >(`
      SELECT DISTINCT ON (t."tagId") t."tagId" as "tagId", t.value as "lastValue"
      FROM tag_data_raw t
      JOIN tags tag ON t."tagId" = tag.id
      WHERE tag."measureType" = 'CUMULATIVE'
        AND t.value IS NOT NULL
        AND t."timestamp" >= NOW() - INTERVAL '1 hour'
      ORDER BY t."tagId", t."timestamp" DESC
    `);

    for (const row of lastValues) {
      cumulativeValues.set(row.tagId, Number(row.lastValue));
    }

    log(`적산값 ${lastValues.length}개 태그 복원 완료`);
  } catch (error) {
    log(`적산값 복원 실패, 0부터 시작: ${error}`);
  }
}

/** 태그 목록 캐싱 */
async function loadTags() {
  if (!cachedTags) {
    cachedTags = await prisma.tag.findMany({
      where: { isActive: true },
      select: {
        id: true,
        tagName: true,
        energyType: true,
        measureType: true,
        category: true,
        displayName: true,
        unit: true,
        facilityId: true,
      },
    });
    log(`태그 ${cachedTags.length}개 캐싱 완료`);
  }
  return cachedTags;
}

/** Mock 데이터 생성 — 랜덤워크 + 태그별 고유 기저값 + 간헐적 이벤트 */
function generateMockValue(tag: any): number {
  const { id, energyType, measureType, category } = tag;
  const hour = new Date().getHours();
  const timeMultiplier = 0.5 + Math.sin((hour / 24) * Math.PI * 2) * 0.5;

  // CUMULATIVE (적산값): 랜덤워크 기반 증분
  if (measureType === 'CUMULATIVE') {
    if (!cumulativeValues.has(id)) {
      cumulativeValues.set(id, 0);
    }
    const currentValue = cumulativeValues.get(id)!;

    // 태그별 고유 기본 증분율 (elec: 0.005~0.06, air: 0.05~0.55)
    const baseIncrement = energyType === 'elec'
      ? 0.005 + tagHash01(id) * 0.055
      : 0.05 + tagHash01(id) * 0.5;

    // 랜덤워크로 증분 변동 (±30%, 평균 회귀)
    const walk = randomWalk(id, 0.08, 0.05);
    let increment = baseIncrement * (1 + walk * 0.3) * timeMultiplier;

    // 비근무시간 에어: 급증 설비(20%) + 소량 누기(나머지 80%)
    if (energyType === 'air' && isNonWorkHours()) {
      if (shouldAirSurge(id)) {
        increment = baseIncrement * (2.5 + Math.random() * 1.0); // 급증
      } else {
        increment = baseIncrement * (0.05 + Math.random() * 0.15); // 소량 누기 (5~20%)
      }
    }

    // 간헐적 미세 증분 (설비 대기 상태, 1% 확률)
    if (Math.random() < 0.01) {
      increment *= 0.1;
    }

    const newValue = currentValue + Math.max(0, increment);
    cumulativeValues.set(id, newValue);
    return newValue;
  }

  // INSTANTANEOUS + ENERGY: 태그별 고유 기저값 + 랜덤워크 + 이벤트
  if (measureType === 'INSTANTANEOUS' && category === 'ENERGY') {
    // 설비 정지 이벤트
    if (isEquipmentOff(id)) {
      // 에어: 정지 중에도 소량 누기 (기저값의 2~8%)
      if (energyType === 'air') {
        const baseline = getTagBaseline(id, 10, 60);
        return baseline * (0.02 + Math.random() * 0.06);
      }
      return Math.random() * 0.5; // 전력: 거의 0
    }

    const baseline = energyType === 'elec'
      ? getTagBaseline(id, 30, 120)   // 태그별 30~120 kW
      : getTagBaseline(id, 10, 60);   // 태그별 10~60 m3/min

    // 랜덤워크 (±15% 변동, 완만한 회귀)
    const walk = randomWalk(id, 0.06, 0.03);
    let value = baseline * (1 + walk * 0.15) * timeMultiplier;

    // 에어: 비생산시간 소량 누기 (timeMultiplier가 낮아도 최소 5~15%)
    if (energyType === 'air' && isNonWorkHours()) {
      value = Math.max(value, baseline * (0.05 + Math.random() * 0.10));
    }

    // 스파이크 (2% 확률): 기저값의 1.5~3배
    if (Math.random() < 0.02) {
      value = baseline * (1.5 + Math.random() * 1.5);
    }

    return Math.max(0, value);
  }

  // INSTANTANEOUS + QUALITY: 기존 해시 기반 + 랜덤워크
  if (measureType === 'INSTANTANEOUS' && category === 'QUALITY') {
    const tagName: string = tag.tagName ?? '';

    // 역률 (PF): 랜덤워크 기반 85~99%
    if (/PF/i.test(tagName)) {
      const baseline = getTagBaseline(id, 88, 98);
      const walk = randomWalk(id, 0.04, 0.06);
      return Math.max(80, Math.min(100, baseline + walk * 5));
    }

    // 3상 전류: 기존 로직 유지 + 워크 변동 추가
    const prefix = tagName.replace(/_(A|B|C)$/i, '');
    const minute = Math.floor(Date.now() / 60000);
    let hash = 0;
    for (let i = 0; i < prefix.length; i++) hash = ((hash << 5) - hash + prefix.charCodeAt(i)) | 0;
    const base = 45 + (Math.abs(hash) % 20) + Math.sin(minute * 0.1 + (Math.abs(hash) % 100)) * 5;
    const walk = randomWalk(id, 0.03, 0.04);
    const phaseOffset = (Math.random() - 0.5) * base * 0.04;
    return Math.max(0, base * (1 + walk * 0.08) + phaseOffset);
  }

  // DISCRETE: 상태 유지 (한번 전환 후 일정 시간 유지)
  if (measureType === 'DISCRETE') {
    const now = Date.now();
    const state = discreteState.get(id);
    if (state && now < state.until) return state.value;

    // 새 상태 결정
    const operatingProbability = (hour >= 8 && hour < 18) ? 0.85 : 0.4;
    const newValue = Math.random() < operatingProbability ? 1 : 0;
    // 상태 유지: ON=5~30분, OFF=1~10분
    const holdSec = newValue === 1
      ? (300 + Math.random() * 1500)
      : (60 + Math.random() * 540);
    discreteState.set(id, { value: newValue, until: now + holdSec * 1000 });
    return newValue;
  }

  // INSTANTANEOUS + ENVIRONMENT: 랜덤워크 (환경값은 천천히 변함)
  if (measureType === 'INSTANTANEOUS' && category === 'ENVIRONMENT') {
    if (energyType === 'air') {
      if (tag.displayName?.includes('압력')) {
        const baseline = getTagBaseline(id, 5.5, 7.0);
        const walk = randomWalk(id, 0.02, 0.08); // 느린 변동, 강한 회귀
        return Math.max(4, Math.min(8, baseline + walk * 0.8));
      }
      // 온도
      const baseline = getTagBaseline(id, 22, 28);
      const walk = randomWalk(id, 0.015, 0.06);
      return Math.max(15, Math.min(40, baseline + walk * 3));
    }
    const baseline = getTagBaseline(id, 40, 60);
    const walk = randomWalk(id, 0.02, 0.05);
    return Math.max(20, Math.min(80, baseline + walk * 10));
  }

  return 0;
}

/** 비근무시간 여부 (KST 기준) */
function isNonWorkHours(): boolean {
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  const kstDate = new Date(now.getTime() + 9 * 3600000);
  const kstDay = kstDate.getDay();
  return kstHour < 8 || kstHour >= 18 || kstDay === 0 || kstDay === 6;
}

/** 에어 급증 대상 태그 (해시+날짜 기반 ~20%) */
function shouldAirSurge(tagId: string): boolean {
  const dayOfMonth = new Date().getDate();
  let hash = 0;
  for (let i = 0; i < tagId.length; i++) {
    hash = ((hash << 5) - hash + tagId.charCodeAt(i)) | 0;
  }
  return ((Math.abs(hash) + dayOfMonth) % 5) === 0;
}

/** 데이터 수집 1회 실행 */
async function collectOnce() {
  try {
    const timestamp = new Date();
    const tags = await loadTags();
    if (tags.length === 0) return;

    const tagDataBatch = tags.map((tag) => ({
      timestamp,
      tagId: tag.id,
      value: generateMockValue(tag),
      quality: 'GOOD' as const,
    }));

    await prisma.tagDataRaw.createMany({
      data: tagDataBatch,
      skipDuplicates: true,
    });
    consecutiveErrors = 0; // 성공 시 리셋

    // 매 분(0초)마다 로그 — count() 대신 내부 카운터 사용 (풀스캔 방지)
    insertCounter += tagDataBatch.length;
    const sec = timestamp.getSeconds();
    if (sec < 10) {
      log(`${timestamp.toLocaleTimeString('ko-KR')} | 삽입: ${tagDataBatch.length}행 | 누적: ~${insertCounter.toLocaleString()}행`);
    }

    // CYCLE/STEP 생성 체크 (매시 :24분)
    const min = timestamp.getMinutes();
    if (min === 24 && sec < 10 && !cycleGeneratedThisHour && cycleInitDone) {
      await generateCycleStep();
      cycleGeneratedThisHour = true;
    }
    if (min === 25) {
      cycleGeneratedThisHour = false;
    }
  } catch (error) {
    consecutiveErrors++;
    log(`수집 에러 (${consecutiveErrors}연속): ${error}`);

    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      log(`${MAX_CONSECUTIVE_ERRORS}연속 에러 -- DB 재연결 시도`);
      try {
        await prisma.$disconnect();
        await prisma.$connect();
        cachedTags = null; // 태그 캐시 초기화
        consecutiveErrors = 0;
        log('DB 재연결 성공');
      } catch (reconnectError) {
        log(`DB 재연결 실패: ${reconnectError}`);
      }
    }
  }
}

// ─── CYCLE/STEP 생성 관련 ───

/** 날짜를 CYCLE/STEP용 문자열로 변환 ("2026-03-10 14:30:05.123") */
function formatDt(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
}

/** CYCLE/STEP 초기화: CYCLE_MMS_MAPPING 확장 + baseDuration 로드 + 기준싸이클 생성 */
async function initCycleStep() {
  logCycle('=== CYCLE/STEP 초기화 시작 ===');

  // 1. 트렌드 태그 목록 (INSTANTANEOUS + ENERGY) 설비별 그룹핑
  const trendTags = await prisma.tag.findMany({
    where: {
      measureType: 'INSTANTANEOUS',
      category: 'ENERGY',
      isActive: true,
    },
    select: {
      tagName: true,
      energyType: true,
      facilityId: true,
      facility: { select: { code: true } },
    },
  });

  facilityTrendTags.clear();
  for (const t of trendTags) {
    if (!facilityTrendTags.has(t.facilityId)) facilityTrendTags.set(t.facilityId, []);
    facilityTrendTags.get(t.facilityId)!.push(t.tagName);
  }
  logCycle(`트렌드 태그: ${trendTags.length}개, 설비: ${facilityTrendTags.size}개`);

  // 2. 기존 CYCLE_MMS_MAPPING 로드
  const existingMapping = await prisma.$queryRawUnsafe<
    Array<{ MACH_ID: number; TAG_NAME: string }>
  >(`SELECT "MACH_ID", "TAG_NAME" FROM "CYCLE_MMS_MAPPING"`);

  const existingTagSet = new Set(existingMapping.map(r => r.TAG_NAME));
  let maxMachId = existingMapping.reduce((max, r) => Math.max(max, r.MACH_ID), 0);

  // facilityId → MACH_ID 매핑 (기존 매핑에서 역추적)
  const tagToMachId = new Map<string, number>();
  for (const r of existingMapping) {
    tagToMachId.set(r.TAG_NAME, r.MACH_ID);
  }

  // 기존 매핑의 TAG_NAME → facilityId → MACH_ID
  for (const t of trendTags) {
    const machId = tagToMachId.get(t.tagName);
    if (machId !== undefined) {
      facilityMachIdMap.set(t.facilityId, machId);
    }
  }

  // 3. 미매핑 태그 추가 (같은 설비 태그는 같은 MACH_ID)
  const newMappings: Array<{
    machId: number; tagName: string; plantCd: string;
    lineCd: string; mcnCd: string; energyType: string;
  }> = [];

  for (const [facId, tagNames] of facilityTrendTags) {
    // 이미 MACH_ID가 있는 설비인지 체크
    let machId = facilityMachIdMap.get(facId);
    const facCode = trendTags.find(t => t.facilityId === facId)?.facility?.code || 'UNKNOWN';

    for (const tagName of tagNames) {
      if (!existingTagSet.has(tagName)) {
        // 새로운 태그 → MACH_ID 결정
        if (machId === undefined) {
          maxMachId++;
          machId = maxMachId;
          facilityMachIdMap.set(facId, machId);
        }
        const energyType = trendTags.find(t => t.tagName === tagName)?.energyType || 'elec';
        const lineCd = facCode.substring(0, 5) || 'HNK00';
        newMappings.push({
          machId, tagName, plantCd: 'ifems',
          lineCd, mcnCd: facCode, energyType,
        });
        existingTagSet.add(tagName);
      }
    }

    // facilityMachIdMap 채우기 (기존 매핑으로 이미 설정된 경우 포함)
    if (machId === undefined) {
      // 모든 태그가 이미 매핑에 있는 경우 → 첫 태그의 MACH_ID 사용
      const firstTag = tagNames[0];
      machId = tagToMachId.get(firstTag);
      if (machId !== undefined) facilityMachIdMap.set(facId, machId);
    }
  }

  if (newMappings.length > 0) {
    // 배치 INSERT
    const values = newMappings.map(m =>
      `(${m.machId}, '${m.tagName}', '${m.plantCd}', '${m.lineCd}', '${m.mcnCd}', '${m.energyType}', 1, NULL)`
    ).join(',\n');

    await prisma.$executeRawUnsafe(`
      INSERT INTO "CYCLE_MMS_MAPPING" ("MACH_ID", "TAG_NAME", "PLANT_CD", "LINE_CD", "MCN_CD", "ENERGY_TYPE", "TARGET_YN", "SAVE_DT")
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `);
    logCycle(`CYCLE_MMS_MAPPING: ${newMappings.length}개 태그 추가 (총 ${existingTagSet.size}건)`);
  } else {
    logCycle(`CYCLE_MMS_MAPPING: 추가 없음 (${existingTagSet.size}건 유지)`);
  }

  // 4. baseDuration 로드 (CYCLE_STD_MST_MMS에서 MACH_ID별 평균 DIFF_DESC)
  const durationData = await prisma.$queryRawUnsafe<
    Array<{ MACH_ID: number; avg_sec: number }>
  >(`
    SELECT "MACH_ID", AVG("DIFF_DESC") / 1000.0 as avg_sec
    FROM "CYCLE_STD_MST_MMS"
    WHERE "DIFF_DESC" IS NOT NULL AND "DIFF_DESC" > 0
    GROUP BY "MACH_ID"
  `);

  const machIdDuration = new Map<number, number>();
  for (const r of durationData) {
    machIdDuration.set(r.MACH_ID, Math.round(Number(r.avg_sec)));
  }

  // facilityId → baseDuration
  baseDurationMap.clear();
  for (const [facId, machId] of facilityMachIdMap) {
    const dur = machIdDuration.get(machId);
    baseDurationMap.set(facId, dur || DEFAULT_BASE_DURATION);
  }
  logCycle(`baseDuration: ${baseDurationMap.size}개 설비 로드 (미매핑 → ${DEFAULT_BASE_DURATION}초)`);

  // 5. 기준 싸이클 (STAND_YN=1) 초기화 — 없는 조합에 대해 생성
  await initReferenceCycles();

  cycleInitDone = true;
  logCycle('=== CYCLE/STEP 초기화 완료 ===');
}

/** 기준 싸이클 (STAND_YN=1) 초기화 */
async function initReferenceCycles() {
  // 기존 기준 싸이클 조회
  const existing = await prisma.$queryRawUnsafe<
    Array<{ MACH_ID: number; TAG_NAME: string }>
  >(`SELECT "MACH_ID", "TAG_NAME" FROM "CYCLE_STD_MST_MMS" WHERE "STAND_YN" = 1`);

  const existingSet = new Set(existing.map(r => `${r.MACH_ID}|${r.TAG_NAME}`));
  const now = new Date();
  const saveDt = formatDt(now);
  const inserts: string[] = [];

  for (const [facId, tagNames] of facilityTrendTags) {
    const machId = facilityMachIdMap.get(facId);
    if (machId === undefined) continue;

    const baseDur = baseDurationMap.get(facId) || DEFAULT_BASE_DURATION;

    for (const tagName of tagNames) {
      const key = `${machId}|${tagName}`;
      if (existingSet.has(key)) continue;

      // 기준 싸이클 생성
      const startDt = new Date(now.getTime() - baseDur * 1000);
      const materialId = `REF_${machId}_${tagName}`;
      const diffDesc = baseDur * 1000; // ms
      const mid = MODEL_IDS[modelIdIndex % MODEL_IDS.length];
      modelIdIndex++;

      inserts.push(
        `(${machId}, '${tagName}', '${materialId}', '${materialId}', ` +
        `'${formatDt(startDt)}', '${saveDt}', ${diffDesc}, 1, 0, NULL, 0, ` +
        `'${saveDt}', NULL, NULL, ${mid})`
      );
    }
  }

  if (inserts.length > 0) {
    // 500건씩 배치 INSERT
    for (let i = 0; i < inserts.length; i += 500) {
      const batch = inserts.slice(i, i + 500);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "CYCLE_STD_MST_MMS"
          ("MACH_ID", "TAG_NAME", "MATERIAL_ID", "CYCLE_NM",
           "START_DT", "END_DT", "DIFF_DESC", "STAND_YN", "U_ENERGY", "PERSON", "DTW",
           "SAVE_DT", "OFFSET", "OFFSET_YN", "MODEL_ID")
        VALUES ${batch.join(',\n')}
        ON CONFLICT DO NOTHING
      `);
    }
    logCycle(`기준 싸이클(STAND_YN=1): ${inserts.length}건 생성`);
  } else {
    logCycle(`기준 싸이클(STAND_YN=1): 추가 없음 (${existingSet.size}건 유지)`);
  }
}

/** 매시 :24분 실행 — 1시간치 CYCLE/STEP 배치 생성 */
async function generateCycleStep() {
  const now = new Date();
  const batchEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  const batchStart = new Date(batchEnd.getTime() - 3600000); // 1시간 전
  const saveDt = formatDt(now);

  logCycle(`배치 시작: ${formatDt(batchStart)} ~ ${formatDt(batchEnd)}`);

  const cycleInserts: string[] = [];
  const stepInserts: string[] = [];
  let totalCycles = 0;
  let totalSteps = 0;

  for (const [facId, tagNames] of facilityTrendTags) {
    const machId = facilityMachIdMap.get(facId);
    if (machId === undefined) continue;

    const baseDur = baseDurationMap.get(facId) || DEFAULT_BASE_DURATION;

    // 설비별 싸이클 시간 생성 (모든 태그 공유)
    const cycleSlots: Array<{ start: Date; end: Date; duration: number }> = [];
    let cursor = batchStart.getTime();

    while (cursor + baseDur * 1000 < batchEnd.getTime()) {
      const duration = baseDur * (0.9 + Math.random() * 0.2); // ±10%
      const gap = 5 + Math.random() * 5; // 5~10초
      const startMs = cursor;
      const endMs = cursor + duration * 1000;

      if (endMs > batchEnd.getTime()) break;

      cycleSlots.push({
        start: new Date(startMs),
        end: new Date(endMs),
        duration,
      });

      cursor = endMs + gap * 1000;
    }

    // 각 싸이클 슬롯 × 각 태그 → CYCLE + STEP 레코드
    for (const slot of cycleSlots) {
      const mid = MODEL_IDS[modelIdIndex % MODEL_IDS.length];
      modelIdIndex++;

      const materialId = `M${machId}_${slot.start.getTime()}`;
      const diffDesc = Math.round(slot.duration * 1000);
      const cycleDelay = Math.floor(Math.random() * 101);

      for (const tagName of tagNames) {
        // CYCLE 레코드
        cycleInserts.push(
          `(${machId}, '${tagName}', '${materialId}', '${materialId}', ` +
          `'${formatDt(slot.start)}', '${formatDt(slot.end)}', ${diffDesc}, 3, NULL, NULL, NULL, ` +
          `${cycleDelay}, '${saveDt}', NULL, NULL, ${mid})`
        );
        totalCycles++;

        // STEP 생성 (3~8개, 싸이클 시간 내 균등 분할)
        const stepCount = 3 + Math.floor(Math.random() * 6);
        const stepDuration = slot.duration / stepCount;

        for (let seq = 0; seq < stepCount; seq++) {
          const stepStartMs = slot.start.getTime() + seq * stepDuration * 1000;
          const stepEndMs = slot.start.getTime() + (seq + 1) * stepDuration * 1000;

          // 마지막 스텝은 싸이클 END에 정확히 맞춤
          const actualEnd = seq === stepCount - 1 ? slot.end : new Date(stepEndMs);

          stepInserts.push(
            `(${machId}, '${tagName}', '${materialId}', ${seq}, ` +
            `'${formatDt(new Date(stepStartMs))}', '${formatDt(actualEnd)}', ` +
            `NULL, '${saveDt}', ${mid})`
          );
          totalSteps++;
        }
      }
    }
  }

  // 배치 INSERT (500건씩)
  if (cycleInserts.length > 0) {
    for (let i = 0; i < cycleInserts.length; i += 500) {
      const batch = cycleInserts.slice(i, i + 500);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "CYCLE_STD_MST_MMS"
          ("MACH_ID", "TAG_NAME", "MATERIAL_ID", "CYCLE_NM",
           "START_DT", "END_DT", "DIFF_DESC", "STAND_YN", "U_ENERGY", "PERSON", "DTW",
           "CYCLE_DELAY", "SAVE_DT", "OFFSET", "OFFSET_YN", "MODEL_ID")
        VALUES ${batch.join(',\n')}
        ON CONFLICT DO NOTHING
      `);
    }
  }

  if (stepInserts.length > 0) {
    for (let i = 0; i < stepInserts.length; i += 500) {
      const batch = stepInserts.slice(i, i + 500);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "STEP_STD_MST_MMS"
          ("MACH_ID", "TAG_NAME", "MATERIAL_ID", "STEP_SEQ",
           "START_DT", "END_DT", "DIFF_SEC", "SAVE_DT", "MODEL_ID")
        VALUES ${batch.join(',\n')}
        ON CONFLICT DO NOTHING
      `);
    }
  }

  // 이전 배치 DTW 업데이트 (1시간 전 STAND_YN=3 + DTW=NULL)
  const prevBatchStart = formatDt(new Date(batchStart.getTime() - 3600000));
  const prevBatchEnd = formatDt(batchStart);

  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "CYCLE_STD_MST_MMS"
    SET "DTW" = RANDOM(),
        "U_ENERGY" = FLOOR(RANDOM() * 101),
        "STAND_YN" = CASE WHEN RANDOM() > 0.3 THEN 3 ELSE 2 END
    WHERE "STAND_YN" = 3 AND "DTW" IS NULL
      AND "SAVE_DT" >= '${prevBatchStart}' AND "SAVE_DT" < '${prevBatchEnd}'
  `);

  logCycle(`생성: CYCLE ${totalCycles}건, STEP ${totalSteps}건 | DTW 업데이트: ${updated}건`);
}

// ─── 메인 루프 ───

async function main() {
  log('=== 독립 데이터 수집기 시작 ===');
  fileLog('=== 수집기 시작 ===');
  log(`DB: ${collectorDbUrl}`);
  log(`주기: ${INTERVAL_MS / 1000}초`);

  await prisma.$connect();
  log('DB 연결 완료');

  await loadCumulativeValues();
  await loadTags();

  // CYCLE/STEP 초기화 (매핑 확장 + 기준싸이클)
  await initCycleStep();

  // Graceful shutdown
  const shutdown = async (signal?: string) => {
    const msg = `종료 신호 수신 (${signal || 'unknown'}), 정리 중...`;
    log(msg);
    fileLog(msg);
    running = false;
    await prisma.$disconnect();
    fileLog('=== 수집기 정상 종료 ===');
    log('=== 데이터 수집기 종료 ===');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
  process.on('beforeExit', (code) => fileLog(`beforeExit event (code: ${code})`));
  process.on('exit', (code) => fileLog(`process.exit (code: ${code})`));

  // 순차 실행 루프 (await — 에러 시 루프 내부에서 복구)
  while (running) {
    try {
      const start = Date.now();
      await collectOnce();
      const elapsed = Date.now() - start;
      const wait = Math.max(0, INTERVAL_MS - elapsed);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
    } catch (loopError) {
      log(`루프 예외 (collectOnce 외부): ${loopError}`);
      await new Promise(r => setTimeout(r, 5000)); // 5초 대기 후 재시도
    }
  }
}

// ─── 전역 에러 핸들러 (조용한 죽음 방지) ───
process.on('uncaughtException', (err) => {
  const msg = `UNCAUGHT EXCEPTION: ${err.stack || err}`;
  log(msg);
  fileLog(msg);
  // 프로세스를 죽이지 않고 계속 실행 (while 루프가 복구)
});

process.on('unhandledRejection', (reason) => {
  const msg = `Unhandled rejection: ${reason}`;
  log(msg);
  fileLog(msg);
});

// ─── 자동 재시작 래퍼 ───
(async () => {
  const MAX_RETRIES = 5;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      await main();
      break; // 정상 종료 (SIGINT/SIGTERM)
    } catch (err) {
      retryCount++;
      const msg = `Fatal error (${retryCount}/${MAX_RETRIES}): ${err}`;
      log(msg);
      fileLog(msg);
      await prisma.$disconnect().catch(() => {});
      cachedTags = null;
      consecutiveErrors = 0;

      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(30000, 5000 * retryCount); // 5~30초 점진 대기
        log(`${delay / 1000}초 후 재시작...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (retryCount >= MAX_RETRIES) {
    const msg = `최대 재시도 횟수(${MAX_RETRIES}) 초과, 프로세스 종료`;
    log(msg);
    fileLog(msg);
    process.exit(1);
  }
})();
