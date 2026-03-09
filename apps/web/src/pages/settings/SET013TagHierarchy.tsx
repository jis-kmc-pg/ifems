import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Factory, Layers, Box, Tag as TagIcon, Info } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import { getHierarchy } from '../../services/settings';

type SelectedItem =
  | { type: 'factory'; data: any }
  | { type: 'line'; data: any; factory: any }
  | { type: 'facility'; data: any; line: any; factory: any };

export default function SET013TagHierarchy() {
  const [expandedFactories, setExpandedFactories] = useState<Set<string>>(new Set());
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  const { data: hierarchy = [], isLoading } = useQuery({
    queryKey: ['hierarchy'],
    queryFn: getHierarchy,
  });

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  const expandAll = () => {
    setExpandedFactories(new Set(hierarchy.map((f: any) => f.id)));
    setExpandedLines(new Set(hierarchy.flatMap((f: any) => f.lines.map((l: any) => l.id))));
  };

  const collapseAll = () => {
    setExpandedFactories(new Set());
    setExpandedLines(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  const totalFactories = hierarchy.length;
  const totalLines = hierarchy.reduce((s: number, f: any) => s + f.lines.length, 0);
  const totalFacilities = hierarchy.reduce(
    (s: number, f: any) => s + f.lines.reduce((ls: number, l: any) => ls + l.facilities.length, 0), 0
  );
  const totalTags = hierarchy.reduce(
    (s: number, f: any) => s + f.lines.reduce(
      (ls: number, l: any) => ls + l.facilities.reduce((fs: number, fac: any) => fs + (fac.tagCount || 0), 0), 0
    ), 0
  );

  const isSelected = (type: string, id: string) =>
    selected?.type === type && selected.data.id === id;

  return (
    <div className="space-y-4">
      <PageHeader
        title="태그 계층 구조"
        description="공장 → 라인 → 설비 → 태그 계층 구조를 시각화합니다"
        breadcrumbs={[
          { label: '설정', path: '/settings' },
          { label: '태그 계층', path: '/settings/hierarchy' },
        ]}
      />

      {/* 통계 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: <Factory size={16} />, label: '공장', value: totalFactories, color: 'text-[#E94560]' },
          { icon: <Layers size={16} />, label: '라인', value: totalLines, color: 'text-[#27AE60]' },
          { icon: <Box size={16} />, label: '설비', value: totalFacilities, color: 'text-[#F39C12]' },
          { icon: <TagIcon size={16} />, label: '태그', value: totalTags.toLocaleString(), color: 'text-[#3B82F6]' },
        ].map((item) => (
          <div key={item.label} className="bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm px-4 py-3 flex items-center gap-3">
            <span className={item.color}>{item.icon}</span>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 메인: 트리 + 상세 (50:50) */}
      <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 320px)' }}>
        {/* 좌측 트리 */}
        <div className="w-1/2 bg-white dark:bg-[#16213E] border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">계층 구조</span>
            <div className="flex gap-1">
              <button onClick={expandAll} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                전체 펼치기
              </button>
              <button onClick={collapseAll} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                전체 접기
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {hierarchy.length === 0 ? (
              <div className="text-center text-gray-500 py-8 text-sm">데이터 없음</div>
            ) : (
              hierarchy.map((factory: any) => (
                <div key={factory.id}>
                  {/* 공장 */}
                  <div
                    className={`flex items-center gap-2 py-2 px-3 mx-1.5 rounded-md cursor-pointer transition-colors ${
                      isSelected('factory', factory.id)
                        ? 'bg-[#E94560]/10 dark:bg-[#E94560]/15 text-gray-900 dark:text-white'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200'
                    }`}
                    onClick={() => { setSelected({ type: 'factory', data: factory }); setExpandedFactories(prev => toggle(prev, factory.id)); }}
                  >
                    <span className="text-gray-400 shrink-0">
                      {expandedFactories.has(factory.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </span>
                    <Factory size={14} className="text-[#E94560] shrink-0" />
                    <span className="truncate flex-1 text-sm font-medium">{factory.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                      {factory.lines.length}
                    </span>
                  </div>

                  {/* 라인 */}
                  {expandedFactories.has(factory.id) && factory.lines.map((line: any) => (
                    <div key={line.id}>
                      <div
                        className={`flex items-center gap-2 py-1.5 pr-3 mx-1.5 rounded-md cursor-pointer transition-colors ${
                          isSelected('line', line.id)
                            ? 'bg-[#27AE60]/10 dark:bg-[#27AE60]/15 text-gray-900 dark:text-white'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300'
                        }`}
                        style={{ paddingLeft: '32px' }}
                        onClick={() => { setSelected({ type: 'line', data: line, factory }); setExpandedLines(prev => toggle(prev, line.id)); }}
                      >
                        <span className="text-gray-400 shrink-0">
                          {expandedLines.has(line.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <Layers size={13} className="text-[#27AE60] shrink-0" />
                        <span className="truncate flex-1 text-sm">{line.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{line.facilities.length}</span>
                      </div>

                      {/* 설비 */}
                      {expandedLines.has(line.id) && line.facilities.map((facility: any) => (
                        <div
                          key={facility.id}
                          className={`flex items-center gap-2 py-1 pr-3 mx-1.5 rounded-md cursor-pointer transition-colors ${
                            isSelected('facility', facility.id)
                              ? 'bg-[#F39C12]/10 dark:bg-[#F39C12]/15 text-gray-900 dark:text-white'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-500 dark:text-gray-400'
                          }`}
                          style={{ paddingLeft: '56px' }}
                          onClick={() => setSelected({ type: 'facility', data: facility, line, factory })}
                        >
                          <Box size={12} className="text-[#F39C12] shrink-0" />
                          <span className="truncate flex-1 text-xs">{facility.code}</span>
                          {facility.tagCount > 0 && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">{facility.tagCount}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 우측 상세 패널 */}
        <div className="w-1/2 bg-white dark:bg-[#16213E] border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <Info size={36} className="mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm">좌측 트리에서 항목을 선택하세요</p>
            </div>
          ) : selected.type === 'factory' ? (
            <FactoryDetail factory={selected.data} />
          ) : selected.type === 'line' ? (
            <LineDetail line={selected.data} factory={selected.factory} />
          ) : (
            <FacilityDetail facility={selected.data} line={selected.line} factory={selected.factory} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 상세 패널 컴포넌트 ─── */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center py-2.5 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
      <span className="w-24 shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      active
        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
    }`}>
      {active ? '활성' : '비활성'}
    </span>
  );
}

function FactoryDetail({ factory }: { factory: any }) {
  const totalFacilities = factory.lines.reduce((s: number, l: any) => s + l.facilities.length, 0);
  const totalTags = factory.lines.reduce(
    (s: number, l: any) => s + l.facilities.reduce((fs: number, f: any) => fs + (f.tagCount || 0), 0), 0
  );

  return (
    <div className="p-5">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#E94560]/10 dark:bg-[#E94560]/20 flex items-center justify-center">
          <Factory size={16} className="text-[#E94560]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{factory.name}</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">{factory.code}</p>
        </div>
        <StatusBadge active={factory.isActive} />
      </div>
      <div>
        <DetailRow label="전체 이름" value={factory.fullName || factory.name} />
        <DetailRow label="위치" value={factory.location || '-'} />
        <DetailRow label="라인 수" value={`${factory.lines.length}개`} />
        <DetailRow label="설비 수" value={`${totalFacilities}개`} />
        <DetailRow label="태그 수" value={`${totalTags.toLocaleString()}개`} />
      </div>

      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-6 mb-3">소속 라인</h4>
      <div className="grid grid-cols-2 gap-2">
        {factory.lines.map((line: any) => (
          <div key={line.id} className="bg-gray-50 dark:bg-[#1A1A2E] rounded-lg p-3 border border-gray-100 dark:border-gray-700/50">
            <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">{line.name}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{line.code} · 설비 {line.facilities.length}개</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineDetail({ line, factory }: { line: any; factory: any }) {
  const totalTags = line.facilities.reduce((s: number, f: any) => s + (f.tagCount || 0), 0);

  return (
    <div className="p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[#27AE60]/10 dark:bg-[#27AE60]/20 flex items-center justify-center">
          <Layers size={16} className="text-[#27AE60]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{line.name}</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">{factory.name} &gt; {line.name}</p>
        </div>
        <StatusBadge active={line.isActive} />
      </div>
      <div className="mt-4">
        <DetailRow label="코드" value={line.code} />
        <DetailRow label="소속 공장" value={factory.name} />
        <DetailRow label="설비 수" value={`${line.facilities.length}개`} />
        <DetailRow label="태그 수" value={`${totalTags.toLocaleString()}개`} />
      </div>

      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-6 mb-3">
        소속 설비 ({line.facilities.length})
      </h4>
      <div className="max-h-[360px] overflow-y-auto space-y-1">
        {line.facilities.map((fac: any) => (
          <div key={fac.id} className="flex items-center justify-between bg-gray-50 dark:bg-[#1A1A2E] rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700/50">
            <div>
              <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{fac.code}</span>
              {fac.name && fac.name !== fac.code && (
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{fac.name}</span>
              )}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">태그 {fac.tagCount || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FacilityDetail({ facility, line, factory }: { facility: any; line: any; factory: any }) {
  return (
    <div className="p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[#F39C12]/10 dark:bg-[#F39C12]/20 flex items-center justify-center">
          <Box size={16} className="text-[#F39C12]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{facility.code}</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">{factory.name} &gt; {line.name} &gt; {facility.code}</p>
        </div>
        {facility.status && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            facility.status === 'NORMAL' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : facility.status === 'WARNING' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              : facility.status === 'DANGER' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            {facility.status}
          </span>
        )}
      </div>
      <div className="mt-4">
        <DetailRow label="설비 코드" value={facility.code} />
        <DetailRow label="설비명" value={facility.name || '-'} />
        <DetailRow label="소속 라인" value={`${line.name} (${line.code})`} />
        <DetailRow label="소속 공장" value={factory.name} />
        <DetailRow label="태그 수" value={`${(facility.tagCount || 0).toLocaleString()}개`} />
        {facility.isProcessing !== undefined && (
          <DetailRow label="가공설비" value={facility.isProcessing ? '예' : '아니오'} />
        )}
      </div>
    </div>
  );
}
