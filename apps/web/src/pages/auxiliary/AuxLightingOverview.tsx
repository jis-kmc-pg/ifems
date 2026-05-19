import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import TrendChart, { type TrendSeries } from '../../components/charts/TrendChart';
import {
  getZones, getLuxStandards, getLightingTrend,
  ZONE_TYPE_LABEL, type Zone, type LuxStandard,
} from '../../services/auxiliary';

const LGT_TREND_SERIES: TrendSeries[] = [
  { key: 'kwh', label: '조명 사용량 (kWh)', color: '#F39C12', type: 'area', fillOpacity: 0.35 },
];

const currentTime = new Date().toTimeString().slice(0, 5);

function zoneTypeToLuxKey(zoneType: string): string {
  const map: Record<string, string> = {
    PRODUCTION: '일반가공',
    OFFICE: '사무',
    CORRIDOR: '복도',
    WAREHOUSE: '창고',
    PARKING: '주차장',
    LOUNGE: '휴게실',
    UTILITY: '유틸리티',
  };
  return map[zoneType] ?? '';
}

function ZoneCard({ zone, requiredLux }: { zone: Zone; requiredLux?: number }) {
  const lightingCount = zone.lightingCount ?? 0;
  const ratedW = zone.totalRatedW ?? 0;
  const kwh24 = zone.lightingKwh24h ?? 0;
  const lpd = zone.areaSqm && zone.areaSqm > 0 && ratedW > 0
    ? ratedW / zone.areaSqm
    : null;
  const lpdOver = lpd != null && lpd > 12; // LEED/G-SEED 기준 12 W/㎡

  return (
    <div className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{zone.code}</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{zone.name}</div>
        </div>
        <span className="px-2 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {ZONE_TYPE_LABEL[zone.zoneType] ?? zone.zoneType}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
        <div>
          <div className="text-gray-400">면적</div>
          <div className="font-mono text-gray-700 dark:text-gray-200">
            {zone.areaSqm != null ? `${zone.areaSqm.toLocaleString()}㎡` : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400">회로/정격</div>
          <div className={`font-mono ${lightingCount > 0 ? 'text-[#F39C12]' : 'text-gray-400'}`}>
            {lightingCount > 0 ? `${lightingCount}회 / ${(ratedW/1000).toFixed(1)}kW` : '미등록'}
          </div>
        </div>
        <div>
          <div className="text-gray-400">LPD(W/㎡)</div>
          <div className={`font-mono font-semibold ${lpdOver ? 'text-[#E74C3C]' : lpd != null ? 'text-[#27AE60]' : 'text-gray-400'}`}>
            {lpd != null ? lpd.toFixed(1) : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400">24h kWh</div>
          <div className={`font-mono font-semibold ${kwh24 > 0 ? 'text-[#27AE60]' : 'text-gray-400'}`}>
            {kwh24 > 0 ? kwh24.toFixed(0) : '—'}
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-[11px]">
        <span className="text-gray-400">KS A 3011 기준</span>
        <span className="font-mono text-[#F39C12]">
          {requiredLux ? `${requiredLux} lux` : '—'}
        </span>
      </div>
    </div>
  );
}

export default function AuxLightingOverview() {
  const { data: zones = [], isLoading: zLoading } = useQuery({
    queryKey: ['aux', 'zones'],
    queryFn: () => getZones(false),
  });
  const { data: lux = [], isLoading: lLoading } = useQuery({
    queryKey: ['aux', 'lux-standards'],
    queryFn: getLuxStandards,
  });

  const { data: trendData = [], isLoading: tLoading } = useQuery({
    queryKey: ['aux', 'lighting-trend', 24],
    queryFn: () => getLightingTrend(24),
  });

  const luxByZoneType = useMemo(() => {
    const m = new Map<string, LuxStandard>();
    lux.forEach(s => m.set(s.zoneType, s));
    return m;
  }, [lux]);

  // 옥외(OUTDOOR) 제외 — 실내 조명 대상만
  const lightingZones = useMemo(
    () => zones.filter(z => z.zoneType !== 'OUTDOOR'),
    [zones],
  );

  const totalArea = useMemo(
    () => lightingZones.reduce((sum, z) => sum + (z.areaSqm ?? 0), 0),
    [lightingZones],
  );

  const totalCircuits = useMemo(
    () => zones.reduce((sum, z) => sum + (z.lightingCount ?? 0), 0),
    [zones],
  );

  const totalRatedKw = useMemo(
    () => zones.reduce((sum, z) => sum + (z.totalRatedW ?? 0), 0) / 1000,
    [zones],
  );

  const totalKwh24h = useMemo(
    () => zones.reduce((sum, z) => sum + (z.lightingKwh24h ?? 0), 0),
    [zones],
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="조명 종합 현황"
        description="조명(Lighting) 영역별 운영 모니터링 — KS A 3011 작업조도 기준 적용"
        breadcrumbs={[{ label: '부대설비' }, { label: '조명' }, { label: '종합 현황' }]}
      />

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="조명 대상 영역" value={lightingZones.length} unit="개" />
        <KpiCard label="등록 회로 수" value={totalCircuits} unit="회로" />
        <KpiCard label="총 정격 전력" value={totalRatedKw.toFixed(1)} unit="kW" />
        <KpiCard label="24h 사용량" value={totalKwh24h.toFixed(0)} unit="kWh" />
      </div>

      {/* 24h 트렌드 차트 */}
      <div className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">시간별 조명 사용량 (최근 24시간)</h2>
          <span className="text-xs text-gray-500">1시간 버킷 · {trendData.length}개 포인트</span>
        </div>
        {tLoading ? (
          <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">트렌드 불러오는 중...</div>
        ) : trendData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">시계열 데이터 없음</div>
        ) : (
          <div className="h-[240px]">
            <TrendChart
              data={trendData}
              series={LGT_TREND_SERIES}
              xKey="time"
              yLabel="kWh"
              currentTime={currentTime}
              height={240}
            />
          </div>
        )}
      </div>

      {/* 데이터 수집 안내 */}
      <div className="bg-[#27AE60]/10 border border-[#27AE60]/30 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-[#27AE60] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-700 dark:text-gray-200">
            <strong>모의 시계열 데이터 활성</strong> ({totalCircuits}회로, 최근 24h 누적 <strong>{totalKwh24h.toFixed(0)} kWh</strong>) —
            LPD는 LEED/G-SEED 기준 12 W/㎡ 이하 권장 (초과 시 빨강).
            운영 적용 시 실제 점등 ON/OFF 태그 + 조도센서로 자동 전환됩니다.
          </div>
        </div>
      </div>

      {/* zones list */}
      {(zLoading || lLoading) ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {lightingZones.map(z => (
            <ZoneCard
              key={z.id}
              zone={z}
              requiredLux={luxByZoneType.get(zoneTypeToLuxKey(z.zoneType))?.requiredLux}
            />
          ))}
        </div>
      )}
    </div>
  );
}
