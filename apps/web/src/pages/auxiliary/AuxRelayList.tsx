import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Power } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import { getLightingRelays, getZones } from '../../services/auxiliary';

// 조명 Relay 목록 — Zone 그룹화 + ON/OFF + 점등률
//   ON/OFF는 onOffTagId의 최근값으로 표시 (현재는 미연동 → 모의 랜덤)

export default function AuxRelayList() {
  const { data: relays = [], isLoading } = useQuery({ queryKey: ['aux', 'relays'], queryFn: () => getLightingRelays() });
  const { data: zones = [] } = useQuery({ queryKey: ['aux', 'zones'], queryFn: () => getZones(false) });

  // PoC: 임의로 짝수 인덱스를 ON으로 간주 (실데이터 연결 전)
  const onRate = useMemo(() => {
    if (!relays.length) return 0;
    const on = relays.filter((_, i) => i % 2 === 0).length;
    return Math.round((on / relays.length) * 100);
  }, [relays]);

  const totalKw = useMemo(() => (relays.reduce((s, r) => s + (r.ratedW ?? 0), 0) / 1000), [relays]);

  // Zone별 그룹화
  const byZone = useMemo(() => {
    const m = new Map<string, { zoneCode: string; zoneName: string; areaSqm: number | null; relays: typeof relays }>();
    for (const r of relays) {
      const key = r.zoneId ?? '__none__';
      const zone = zones.find(z => z.id === r.zoneId);
      if (!m.has(key)) {
        m.set(key, {
          zoneCode: zone?.code ?? '(미할당)',
          zoneName: zone?.name ?? '',
          areaSqm: zone?.areaSqm ?? null,
          relays: [],
        });
      }
      m.get(key)!.relays.push(r);
    }
    return Array.from(m.values()).sort((a, b) => a.zoneCode.localeCompare(b.zoneCode));
  }, [relays, zones]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="조명 Relay 목록"
        description="Zone 그룹별 Relay ON/OFF + 정격 전력 — 게이트웨이 연동 시 실시간 점등 상태 표시"
        breadcrumbs={[{ label: '부대설비' }, { label: '조명' }, { label: 'Relay 목록' }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="등록 Zone" value={byZone.length} unit="개" />
        <KpiCard label="등록 Relay" value={relays.length} unit="개" />
        <KpiCard label="총 정격 전력" value={totalKw.toFixed(1)} unit="kW" />
        <KpiCard label="점등률 (PoC 모의)" value={onRate} unit="%" />
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-3">
          {byZone.map(z => (
            <div key={z.zoneCode} className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <span className="font-mono text-xs text-gray-500">{z.zoneCode}</span>
                  <span className="ml-2 text-sm font-semibold">{z.zoneName}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {z.areaSqm != null && <span className="mr-2">{z.areaSqm.toLocaleString()} ㎡</span>}
                  {z.relays.length} relay · {(z.relays.reduce((s, r) => s + (r.ratedW ?? 0), 0)).toLocaleString()} W
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                {z.relays.map((r, i) => {
                  const on = i % 2 === 0;  // PoC
                  return (
                    <div key={r.id}
                      className={`rounded px-2 py-2 text-xs ${on ? 'bg-[#FDB813]/20 border border-[#FDB813]' : 'bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold">{r.code.replace(/^HW4-LGT-/, '')}</span>
                        <Power size={12} className={on ? 'text-[#FDB813]' : 'text-gray-400'} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[10px] font-bold ${on ? 'text-[#FDB813]' : 'text-gray-400'}`}>{on ? 'ON' : 'OFF'}</span>
                        <span className="font-mono text-[10px] text-gray-500">{r.ratedW ?? 0}W</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 text-[11px] text-gray-500">
        ※ PoC 데모: ON/OFF는 짝수 인덱스 모의값. onOffTagId 연동 시 실시간 표시.
      </div>
    </div>
  );
}
