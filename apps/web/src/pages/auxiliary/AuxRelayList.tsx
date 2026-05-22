import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Power } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import {
  getLightingRelays, getZones, getRelayLiveStatus, getZoneLightingStats,
} from '../../services/auxiliary';

// 조명 Relay 목록 — Zone 그룹화 + ON/OFF + 점등률 (실데이터)
//   onOff 값은 onOffTagId 의 최근 tag_data_raw 값

export default function AuxRelayList() {
  const { data: relays = [], isLoading: rLoading } = useQuery({
    queryKey: ['aux', 'relays'],
    queryFn: () => getLightingRelays(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ['aux', 'zones'],
    queryFn: () => getZones(false),
  });
  const { data: liveStatus = [] } = useQuery({
    queryKey: ['aux', 'relay-live'],
    queryFn: getRelayLiveStatus,
    refetchInterval: 30_000,
  });
  const { data: zoneStats = [] } = useQuery({
    queryKey: ['aux', 'zone-lighting-stats'],
    queryFn: getZoneLightingStats,
    refetchInterval: 30_000,
  });

  // Relay ID → ON/OFF
  const liveById = useMemo(() => {
    const m = new Map<string, number | null>();
    liveStatus.forEach(l => m.set(l.id, l.onOff));
    return m;
  }, [liveStatus]);

  // Zone ID → stats (onRate, onCount)
  const statsByZone = useMemo(() => {
    const m = new Map<string, typeof zoneStats[number]>();
    zoneStats.forEach(s => m.set(s.zoneId, s));
    return m;
  }, [zoneStats]);

  // 전체 KPI
  const totalOn = useMemo(() => zoneStats.reduce((s, z) => s + (z.onCount ?? 0), 0), [zoneStats]);
  const totalRelays = relays.length;
  const onRate = totalRelays > 0 ? Math.round((totalOn / totalRelays) * 100) : 0;
  const totalKw = useMemo(() => relays.reduce((s, r) => s + (r.ratedW ?? 0), 0) / 1000, [relays]);

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
        description="Zone 그룹별 Relay ON/OFF + 정격 전력 + 점등률 — onOffTagId 최근값 기반 실데이터 (30초 자동 갱신)"
        breadcrumbs={[{ label: '부대설비' }, { label: '조명' }, { label: 'Relay 목록' }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="등록 Zone" value={byZone.length} unit="개" />
        <KpiCard label="등록 Relay" value={totalRelays} unit="개" />
        <KpiCard label="총 정격 전력" value={totalKw.toFixed(1)} unit="kW" />
        <KpiCard label="점등률 (실데이터)" value={onRate} unit="%" />
      </div>

      {rLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-3">
          {byZone.map(z => {
            const zoneId = z.relays[0]?.zoneId ?? undefined;
            const stat = zoneId ? statsByZone.get(zoneId) : undefined;
            const zoneOnRate = stat?.onRate ?? 0;
            return (
              <div key={z.zoneCode} className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <span className="font-mono text-xs text-gray-500">{z.zoneCode}</span>
                    <span className="ml-2 text-sm font-semibold">{z.zoneName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {z.areaSqm != null && <span className="text-gray-500">{z.areaSqm.toLocaleString()} ㎡</span>}
                    <span className="text-gray-500">{z.relays.length} relay · {(z.relays.reduce((s, r) => s + (r.ratedW ?? 0), 0)).toLocaleString()} W</span>
                    <span className={`px-2 py-0.5 rounded font-mono font-semibold ${zoneOnRate > 50 ? 'bg-[#FDB813]/20 text-[#F39C12]' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                      점등 {zoneOnRate}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                  {z.relays.map(r => {
                    const v = liveById.get(r.id);
                    const on = v != null && v >= 0.5;
                    const hasData = v != null;
                    return (
                      <div key={r.id}
                        className={`rounded px-2 py-2 text-xs ${on ? 'bg-[#FDB813]/20 border border-[#FDB813]' : 'bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold">{r.code.replace(/^HW4-LGT-/, '')}</span>
                          <Power size={12} className={on ? 'text-[#FDB813]' : 'text-gray-400'} />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-[10px] font-bold ${on ? 'text-[#FDB813]' : hasData ? 'text-gray-500' : 'text-gray-400'}`}>
                            {hasData ? (on ? 'ON' : 'OFF') : '—'}
                          </span>
                          <span className="font-mono text-[10px] text-gray-500">{r.ratedW ?? 0}W</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 text-[11px] text-gray-500">
        ※ ON/OFF는 onOffTagId의 최근 tag_data_raw 값. 데이터 없으면 — 표시. 게이트웨이 연동 시 실시간 갱신.
      </div>
    </div>
  );
}
