import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import { getZones, ZONE_TYPE_LABEL, type Zone } from '../../services/auxiliary';

const HVAC_ZONE_TYPES = ['PRODUCTION', 'OFFICE', 'CORRIDOR', 'LOUNGE'] as const;

function ZoneCard({ zone }: { zone: Zone }) {
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

      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div>
          <div className="text-gray-400">硫댁쟻</div>
          <div className="font-mono text-gray-700 dark:text-gray-200">
            {zone.areaSqm != null ? `${zone.areaSqm.toLocaleString()} ?? : '??}
          </div>
        </div>
        <div>
          <div className="text-gray-400">怨듭“ ?곹깭</div>
          <div className="flex items-center gap-1 text-gray-400">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            ?곗씠???섏쭛 ?湲?          </div>
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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="怨듭“ 醫낇빀 ?꾪솴"
        description="怨듭“(HVAC) ?댁쟾 ?곸뿭 醫낇빀 紐⑤땲?곕쭅 ???ν썑 ?몃쾭?걔톁AT쨌?멸린 ?곌퀎"
        breadcrumbs={[{ label: '遺??ㅻ퉬' }, { label: '怨듭“' }, { label: '醫낇빀 ?꾪솴' }]}
      />

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="怨듭“ ????곸뿭" value={hvacZones.length} unit="媛? />
        <KpiCard label="怨듭“ 硫댁쟻 ?⑷퀎" value={totalArea.toLocaleString()} unit="?? />
        <KpiCard label="?댁쟾 以? value="?? unit="媛? />
        <KpiCard label="?댁긽 媛먯?" value="?? unit="嫄? />
      </div>

      {/* ?곗씠???섏쭛 ?덈궡 */}
      <div className="bg-[#FDB813]/10 border border-[#FDB813]/30 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-[#FDB813] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-700 dark:text-gray-200">
            <strong>?ㅼ떆媛?怨듭“ ?곗씠???섏쭛 以鍮?以?/strong> ???몃쾭???꾨젰 / SA쨌RA쨌OA ?⑤룄 / ?띾웾 / ?먰띁 媛쒕룄 ?쒓렇媛
            <code className="mx-1 px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">tags</code> ???깅줉?섎㈃
            ???붾㈃?먯꽌 ?ㅼ떆媛??몃젋?쒕? ?쒖떆?⑸땲??
          </div>
        </div>
      </div>

      {/* zones list */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">遺덈윭?ㅻ뒗 以?..</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {hvacZones.map(z => <ZoneCard key={z.id} zone={z} />)}
        </div>
      )}
    </div>
  );
}
