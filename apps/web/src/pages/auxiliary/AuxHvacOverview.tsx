import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import TrendChart, { type TrendSeries } from '../../components/charts/TrendChart';
import { getZones, getHvacTrend, ZONE_TYPE_LABEL, type Zone } from '../../services/auxiliary';

const HVAC_TREND_SERIES: TrendSeries[] = [
  { key: 'kwh', label: '공조 사용량 (kWh)', color: '#3B82F6', type: 'area', fillOpacity: 0.35 },
];

const HVAC_ZONE_TYPES = ['PRODUCTION', 'OFFICE', 'CORRIDOR', 'LOUNGE'] as const;

// 'HH:mm' (현재 시각) — 빨간 수직선
const currentTime = new Date().toTimeString().slice(0, 5);

function ZoneCard({ zone }: { zone: Zone }) {
  const hvac = zone.hvacCount ?? 0;
  const capRT = zone.totalCapacityRt ?? 0;
  const kwh24 = zone.hvacKwh24h ?? 0;
  const hasHvac = hvac > 0;
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
          <div className="text-gray-400">공조기</div>
          <div className={`font-mono font-semibold ${hasHvac ? 'text-[#3B82F6]' : 'text-gray-400'}`}>
            {hasHvac ? `${hvac}대` : '미설치'}
          </div>
        </div>
        <div>
          <div className="text-gray-400">능력(RT)</div>
          <div className="font-mono text-gray-700 dark:text-gray-200">
            {capRT > 0 ? capRT.toLocaleString() : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400">24h kWh</div>
          <div className={`font-mono font-semibold ${kwh24 > 0 ? 'text-[#27AE60]' : 'text-gray-400'}`}>
            {kwh24 > 0 ? kwh24.toFixed(0) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuxHvacOverview() {
  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['aux', 'zones'],
    queryFn: () => getZones(false),
  });

  const { data: trendData = [], isLoading: trendLoading } = useQuery({
    queryKey: ['aux', 'hvac-trend', 24],
    queryFn: () => getHvacTrend(24),
  });

  const hvacZones = useMemo(
    () => zones.filter(z => HVAC_ZONE_TYPES.includes(z.zoneType as typeof HVAC_ZONE_TYPES[number])),
    [zones],
  );

  const totalArea = useMemo(
    () => hvacZones.reduce((sum, z) => sum + (z.areaSqm ?? 0), 0),
    [hvacZones],
  );

  const totalHvac = useMemo(
    () => zones.reduce((sum, z) => sum + (z.hvacCount ?? 0), 0),
    [zones],
  );

  const totalCapacityRt = useMemo(
    () => zones.reduce((sum, z) => sum + (z.totalCapacityRt ?? 0), 0),
    [zones],
  );

  const totalKwh24h = useMemo(
    () => zones.reduce((sum, z) => sum + (z.hvacKwh24h ?? 0), 0),
    [zones],
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="공조 종합 현황"
        description="공조(HVAC) 운전 영역 종합 모니터링 — 향후 인버터·SAT·외기 연계"
        breadcrumbs={[{ label: '부대설비' }, { label: '공조' }, { label: '종합 현황' }]}
      />

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="공조 대상 영역" value={hvacZones.length} unit="개" />
        <KpiCard label="등록 공조기" value={totalHvac} unit="대" />
        <KpiCard label="총 냉방 능력" value={totalCapacityRt.toLocaleString()} unit="RT" />
        <KpiCard label="24h 사용량" value={totalKwh24h.toFixed(0)} unit="kWh" />
      </div>

      {/* 24h 트렌드 차트 */}
      <div className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">시간별 공조 사용량 (최근 24시간)</h2>
          <span className="text-xs text-gray-500">1시간 버킷 · {trendData.length}개 포인트</span>
        </div>
        {trendLoading ? (
          <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">트렌드 불러오는 중...</div>
        ) : trendData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">시계열 데이터 없음</div>
        ) : (
          <div className="h-[240px]">
            <TrendChart
              data={trendData}
              series={HVAC_TREND_SERIES}
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
            <strong>모의 시계열 데이터 활성</strong> ({totalHvac}대 공조기, 최근 24h 누적 <strong>{totalKwh24h.toFixed(0)} kWh</strong>) —
            ifems_dev DB의 <code className="mx-1 px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">tag_data_raw</code> 에
            10분 간격 모의 데이터가 적재되어 있습니다. 운영 적용 시 실제 인버터/온도/풍량 태그로 자동 전환됩니다.
          </div>
        </div>
      </div>

      {/* zones list */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {hvacZones.map(z => <ZoneCard key={z.id} zone={z} />)}
        </div>
      )}
    </div>
  );
}
