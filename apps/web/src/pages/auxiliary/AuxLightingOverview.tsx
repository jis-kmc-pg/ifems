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
  // backend zoneType(?곷Ц) ??lux_standards.zoneType(?쒓?) 留ㅽ븨
  const map: Record<string, string> = {
    PRODUCTION: '?쇰컲媛怨?,
    OFFICE: '?щТ',
    CORRIDOR: '蹂듬룄',
    WAREHOUSE: '李쎄퀬',
    PARKING: '二쇱감??,
    LOUNGE: '?닿쾶??,
    UTILITY: '?좏떥由ы떚',
  };
  return map[zoneType] ?? '';
}

function ZoneCard({ zone, requiredLux }: { zone: Zone; requiredLux?: number }) {
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
          <div className="text-gray-400">硫댁쟻</div>
          <div className="font-mono text-gray-700 dark:text-gray-200">
            {zone.areaSqm != null ? `${zone.areaSqm.toLocaleString()}?? : '??}
          </div>
        </div>
        <div>
          <div className="text-gray-400">湲곗? lux</div>
          <div className="font-mono font-semibold text-[#F39C12]">
            {requiredLux ? `${requiredLux}` : '??}
          </div>
        </div>
        <div>
          <div className="text-gray-400">?꾩옱 ?먮벑</div>
          <div className="flex items-center gap-1 text-gray-400">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            ?湲?          </div>
        </div>
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

  // ?μ쇅(OUTDOOR) ?쒖쇅 ???ㅻ궡 議곕챸 ??곷쭔
  const lightingZones = useMemo(
    () => zones.filter(z => z.zoneType !== 'OUTDOOR'),
    [zones],
  );

  const totalArea = useMemo(
    () => lightingZones.reduce((sum, z) => sum + (z.areaSqm ?? 0), 0),
    [lightingZones],
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="議곕챸 醫낇빀 ?꾪솴"
        description="議곕챸(Lighting) ?곸뿭蹂??댁쁺 紐⑤땲?곕쭅 ??KS A 3011 ?묒뾽議곕룄 湲곗? ?곸슜"
        breadcrumbs={[{ label: '遺??ㅻ퉬' }, { label: '議곕챸' }, { label: '醫낇빀 ?꾪솴' }]}
      />

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="議곕챸 ????곸뿭" value={lightingZones.length} unit="媛? />
        <KpiCard label="議곕챸 硫댁쟻 ?⑷퀎" value={totalArea.toLocaleString()} unit="?? />
        <KpiCard label="?먮벑 以? value="?? unit="?뚮줈" />
        <KpiCard label="議곕룄 誘몃떖" value="?? unit="援ъ뿭" />
      </div>

      {/* ?곗씠???섏쭛 ?덈궡 */}
      <div className="bg-[#FDB813]/10 border border-[#FDB813]/30 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-[#FDB813] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-700 dark:text-gray-200">
            <strong>議곕챸 ?뚮줈 ?깅줉 ?湲?以?/strong> ???뚮줈蹂?ON/OFF / ?뺢꺽W / 議곕룄?쇱꽌 lux ?쒓렇媛
            <code className="mx-1 px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">tags</code> ???깅줉?섎㈃
            援ъ뿭蹂??먮벑瑜?/ LPD(W/?? / 議곕룄 而댄뵆?쇱씠?몄뒪瑜??ㅼ떆媛꾩쑝濡??쒖떆?⑸땲??
          </div>
        </div>
      </div>

      {/* zones list */}
      {(zLoading || lLoading) ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">遺덈윭?ㅻ뒗 以?..</div>
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
