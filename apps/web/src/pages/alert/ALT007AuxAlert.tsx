import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import { apiClient } from '../../services/api';

/**
 * Phase 2-③ 부대설비 알림 통합 페이지 (ALT-007/008/009)
 *  - 라우트별로 type 결정 (/alert/hvac-fault → HVAC_FAULT)
 *  - 기존 alerts 테이블 활용 (type 필터)
 *  - alerts 데이터 비어 있으면 안내 표시
 */

interface AuxAlertRow {
  id: string;
  facilityCode: string;
  severity: 'NORMAL' | 'WARNING' | 'DANGER';
  type: string;
  message: string;
  detectedAt: string;
  actionTaken?: string | null;
}

const PAGE_META: Record<string, { id: string; title: string; description: string; alertType: string }> = {
  '/alert/hvac-fault': {
    id: 'ALT-007', title: '공조 이상',
    description: '공조기 필터 막힘, 풍량 저하, 인버터 트립 등 HVAC 이상 알림 (fems 도메인)',
    alertType: 'HVAC_FAULT',
  },
  '/alert/light-fault': {
    id: 'ALT-008', title: '조명 이상',
    description: '회로 차단, 점등불량, 잔존점등 등 LIGHTING 이상 알림',
    alertType: 'LIGHT_FAULT',
  },
  '/alert/interlock-violation': {
    id: 'ALT-009', title: '인터록 위반',
    description: '출입통제 OFF 상태에서 공조/조명 ON — 무인 운전 위반 알림',
    alertType: 'INTERLOCK_VIOLATION',
  },
};

const SEVERITY_BADGE: Record<string, string> = {
  NORMAL:  'bg-[#27AE60] text-white',
  WARNING: 'bg-[#F39C12] text-white',
  DANGER:  'bg-[#E74C3C] text-white',
};

export default function ALT007AuxAlert() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] ?? PAGE_META['/alert/hvac-fault'];

  const { data = [], isLoading } = useQuery({
    queryKey: ['aux-alert', meta.alertType],
    queryFn: async (): Promise<AuxAlertRow[]> => {
      try {
        const r = await apiClient.get('/alerts/history', {
          params: { category: meta.alertType.toLowerCase() },
        });
        return Array.isArray(r.data) ? r.data : (r.data?.rows ?? []);
      } catch {
        return [];
      }
    },
  });

  const columns: Column<AuxAlertRow>[] = [
    {
      key: 'detectedAt', label: '감지 시각', sortable: true,
      render: (_v, row) => <span className="font-mono text-xs">{new Date(row.detectedAt).toLocaleString('ko-KR')}</span>,
    },
    { key: 'facilityCode', label: '설비', sortable: true },
    {
      key: 'severity', label: '심각도', sortable: true,
      render: (_v, row) => (
        <span className={`px-2 py-0.5 text-xs rounded ${SEVERITY_BADGE[row.severity] ?? ''}`}>{row.severity}</span>
      ),
    },
    { key: 'message', label: '메시지' },
    {
      key: 'actionTaken', label: '조치',
      render: (_v, row) => row.actionTaken
        ? <span className="text-xs">{row.actionTaken}</span>
        : <span className="text-gray-400">—</span>,
    },
  ];

  const hasData = useMemo(() => data.length > 0, [data]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={`${meta.title} (${meta.id})`}
        description={meta.description}
        breadcrumbs={[{ label: '알림' }, { label: '부대설비 알림' }, { label: meta.title }]}
      />

      <div className="bg-[#FDB813]/10 border border-[#FDB813]/30 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-[#FDB813] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-700 dark:text-gray-200">
            <strong>AlertType = <code>{meta.alertType}</code></strong> 적용.
            룰 엔진 워커(
            <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">AUX_RULE_ENGINE_ENABLED=true</code>
            )가 룰 위반 감지 시 자동으로 alerts 테이블에 INSERT 합니다. 외부 게이트웨이 연동 시 실시간 알림으로 확장됩니다.
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">불러오는 중...</div>
      ) : !hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
          <AlertCircle size={32} className="text-gray-300" />
          <div>현재 등록된 {meta.title} 알림이 없습니다.</div>
          <div className="text-[11px]">룰 엔진이 활성화되면 위반 발생 시 자동 표시됩니다.</div>
        </div>
      ) : (
        <SortableTable data={data} columns={columns} pageSize={30} />
      )}
    </div>
  );
}
