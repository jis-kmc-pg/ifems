import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import { getZones, ZONE_TYPE_LABEL, type Zone } from '../../services/auxiliary';

const HVAC_ZONE_TYPES = ['PRODUCTION', 'OFFICE', 'CORRIDOR', 'LOUNGE'] as const;

function ZoneCard({ zone }: { zone: Zone }) {
  const hvac = zone.hvacCount ?? 0;
  const capRT = zone.totalCapacityRt ?? 0;
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

      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
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
      </div>
    </div>
  );
}

export default function AuxHvacOverview() {
  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['aux', 'zones'],
    queryFn: () => getZones(false),
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
        <KpiCard label="공조 면적 합계" value={totalArea.toLocaleString()} unit="㎡" />
        <KpiCard label="등록 공조기" value={totalHvac} unit="대" />
        <KpiCard label="총 냉방 능력" value={totalCapacityRt.toLocaleString()} unit="RT" />
      </div>

      {/* 데이터 수집 안내 */}
      <div className="bg-[#FDB813]/10 border border-[#FDB813]/30 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-[#FDB813] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-700 dark:text-gray-200">
            <strong>샘플 공조기 {totalHvac}대 등록 완료</strong> — 인버터 전력 / SA·RA·OA 온도 / 풍량 / 댐퍼 개도 태그가
            <code className="mx-1 px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">tag_data_raw</code> 에 수집되면
            실시간 트렌드·운전상태·이상감지를 표시합니다.
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
