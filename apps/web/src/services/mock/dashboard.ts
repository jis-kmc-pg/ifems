// ============================================================
// 대시보드 목업 데이터
// ============================================================

// ──────────────────────────────────────────────
// DSH-001 에너지 사용 추이 (월별)
// ──────────────────────────────────────────────
const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
                '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
                '2026-01', '2026-02'];
const basePower = [128400, 114200, 132800, 126900, 138400, 142100,
                   149800, 152300, 141200, 136800, 129400, 134100, 131800, 87400];
const prevPower = [121300, 108400, 126100, 120800, 131200, 135800,
                   142400, 145100, 134200, 129900, 122800, 127400, 125100, 82800];

export const ENERGY_TREND_MONTHLY = months.map((month, i) => ({
  month,
  power: basePower[i],
  prevPower: prevPower[i],
  air: Math.round(basePower[i] * 48.2),
  prevAir: Math.round(prevPower[i] * 46.8),
}));

// ──────────────────────────────────────────────
// DSH-002 설비별 추이 (일별 추이 14일)
// ──────────────────────────────────────────────
const days14 = Array.from({ length: 14 }, (_, i) => {
  const d = new Date('2026-02-06');
  d.setDate(d.getDate() + i);
  return d.toISOString().slice(0, 10);
});

export const FACILITY_TREND_DATA = {
  dates: days14,
  facilities: [
    {
      code: 'HNK10-020',
      name: 'HNK10-020',
      powerData: [892, 871, 908, 861, 934, 918, 0, 0, 845, 872, 896, 921, 887, 892],
      airData: [418300, 402100, 431200, 398400, 447800, 436200, 0, 0, 399800, 408100, 424300, 441200, 415800, 418300],
    },
    {
      code: 'HNK10-010',
      name: 'HNK10-010',
      powerData: [742, 724, 758, 719, 771, 763, 0, 0, 698, 718, 741, 758, 734, 742],
      airData: [385200, 374800, 394100, 368900, 401200, 396400, 0, 0, 358100, 371400, 384200, 395800, 378100, 385200],
    },
    {
      code: 'HNK10-010-1',
      name: 'HNK10-010-1',
      powerData: [418, 406, 432, 401, 445, 438, 0, 0, 388, 402, 419, 431, 412, 418],
      airData: [298100, 288400, 309200, 282100, 318400, 311200, 0, 0, 274100, 284800, 298100, 308400, 291200, 298100],
    },
  ],
};

// ──────────────────────────────────────────────
// DSH-003 사용량 분포
// ──────────────────────────────────────────────
export const USAGE_DISTRIBUTION = {
  powerProcessing: [
    { name: 'OP10', value: 1445.4 },
    { name: 'OP20', value: 1090.7 },
    { name: 'OP30', value: 638.9 },
    { name: 'OP40', value: 387.2 },
    { name: 'OP50', value: 312.4 },
    { name: 'OP60', value: 241.8 },
  ],
  powerNonProcessing: [
    { name: '컴프레서', value: 521.3 },
    { name: '쿨링타워', value: 148.6 },
    { name: '집진기', value: 64.2 },
    { name: '기타', value: 87.4 },
  ],
  airProcessing: [
    { name: 'OP10', value: 904600 },
    { name: 'OP20', value: 689500 },
    { name: 'OP30', value: 312400 },
    { name: 'OP40', value: 271500 },
    { name: 'OP50', value: 248700 },
    { name: 'OP60', value: 184200 },
  ],
  airNonProcessing: [
    { name: '기타', value: 0 },
  ],
};

// ──────────────────────────────────────────────
// DSH-004 공정별 순위
// ──────────────────────────────────────────────
export const PROCESS_RANKING_DATA = [
  { process: 'OP20', power: 1090.7, air: 689500, prevPower: 1018.3, prevAir: 641800 },
  { process: 'OP10', power: 1445.4, air: 904600, prevPower: 1382.1, prevAir: 865400 },
  { process: 'OP30', power: 638.9, air: 312400, prevPower: 648.1, prevAir: 308200 },
  { process: 'OP40', power: 387.2, air: 271500, prevPower: 371.8, prevAir: 265000 },
  { process: 'OP50', power: 312.4, air: 248700, prevPower: 318.9, prevAir: 241000 },
  { process: 'OP60', power: 241.8, air: 184200, prevPower: 248.3, prevAir: 188000 },
  { process: 'UTL', power: 734.1, air: 0, prevPower: 712.9, prevAir: 0 },
].sort((a, b) => b.power - a.power);

// ──────────────────────────────────────────────
// DSH-005 싸이클당 순위
// ──────────────────────────────────────────────
export const CYCLE_RANKING = [
  { rank: 1, code: 'HNK10-020', process: 'OP20', cycleEnergy: 8.41, cycleTime: 42, deviation: 18.2, status: 'DANGER' as const },
  { rank: 2, code: 'HNK10-010', process: 'OP10', cycleEnergy: 6.83, cycleTime: 38, deviation: 12.4, status: 'WARNING' as const },
  { rank: 3, code: 'HNK10-030', process: 'OP30', cycleEnergy: 5.94, cycleTime: 35, deviation: 8.1, status: 'NORMAL' as const },
  { rank: 4, code: 'HNK10-040', process: 'OP40', cycleEnergy: 4.21, cycleTime: 44, deviation: 6.8, status: 'NORMAL' as const },
  { rank: 5, code: 'HNK10-010-1', process: 'OP10', cycleEnergy: 3.87, cycleTime: 38, deviation: 5.4, status: 'NORMAL' as const },
  { rank: 6, code: 'HNK10-050', process: 'OP50', cycleEnergy: 3.24, cycleTime: 41, deviation: 4.2, status: 'NORMAL' as const },
  { rank: 7, code: 'HNK10-010-2', process: 'OP10', cycleEnergy: 2.98, cycleTime: 38, deviation: 3.1, status: 'NORMAL' as const },
  { rank: 8, code: 'HNK10-060', process: 'OP60', cycleEnergy: 2.71, cycleTime: 46, deviation: 2.8, status: 'NORMAL' as const },
];

// ──────────────────────────────────────────────
// DSH-008 에너지 변화 TOP N
// ──────────────────────────────────────────────
export const ENERGY_CHANGE_TOP = [
  { code: 'HNK10-020', name: 'HNK10-020', prevMonthChange: 18.4, prevYearChange: 24.1 },
  { code: 'HNK10-010-1', name: 'HNK10-010-1', prevMonthChange: 15.2, prevYearChange: 19.8 },
  { code: 'HNK10-080', name: 'HNK10-080', prevMonthChange: 12.8, prevYearChange: 16.4 },
  { code: 'HNK10-040', name: 'HNK10-040', prevMonthChange: 10.1, prevYearChange: 14.2 },
  { code: 'HNK10-010', name: 'HNK10-010', prevMonthChange: 4.2, prevYearChange: 8.1 },
  { code: 'HNK10-060', name: 'HNK10-060', prevMonthChange: -5.2, prevYearChange: -1.8 },
  { code: 'HNK10-050', name: 'HNK10-050', prevMonthChange: -4.1, prevYearChange: 2.1 },
  { code: 'HNK10-030', name: 'HNK10-030', prevMonthChange: -2.8, prevYearChange: 4.9 },
];
