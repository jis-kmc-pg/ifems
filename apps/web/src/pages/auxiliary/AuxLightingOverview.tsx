import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import {
  getZones, getLuxStandards,
  ZONE_TYPE_LABEL, type Zone, type LuxStandard,
} from '../../services/auxiliary';

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
          <div className="text-gray-400">회로</div>
          <div className={`font-mono font-semibold ${lightingCount > 0 ? 'text-[#F39C12]' : 'text-gray-400'}`}>
            {lightingCount > 0 ? `${lightingCount}` : '미등록'}
          </div>
        </div>
        <div>
          <div className="text-gray-400">정격 W</div>
          <div className="font-mono text-gray-700 dark:text-gray-200">
            {ratedW > 0 ? ratedW.toLocaleString() : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400">LPD(W/㎡)</div>
          <div className={`font-mono font-semibold ${lpdOver ? 'text-[#E74C3C]' : lpd != null ? 'text-[#27AE60]' : 'text-gray-400'}`}>
            {lpd != null ? lpd.toFixed(1) : '—'}
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
        <KpiCard label="조명 면적 합계" value={totalArea.toLocaleString()} unit="㎡" />
        <KpiCard label="등록 회로 수" value={totalCircuits} unit="회로" />
        <KpiCard label="총 정격 전력" value={totalRatedKw.toFixed(1)} unit="kW" />
      </div>

      {/* 데이터 수집 안내 */}
      <div className="bg-[#FDB813]/10 border border-[#FDB813]/30 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-[#FDB813] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-700 dark:text-gray-200">
            <strong>샘플 조명 회로 {totalCircuits}개 등록 완료</strong> —
            LPD(W/㎡)는 LEED/G-SEED 기준 12 이하가 권장 (초과 시 빨강).
            점등 ON/OFF 태그가 <code className="mx-1 px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">tag_data_raw</code> 에 수집되면
            구역별 점등률·조도 컴플라이언스를 실시간 표시합니다.
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
