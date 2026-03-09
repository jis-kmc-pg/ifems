import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import SvgBarChart from '../../components/charts/SvgBarChart';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import FilterBar from '../../components/ui/FilterBar';
import { getAlertStatsKpi, getAlertTrend, getCycleAnomalyTypes } from '../../services/alerts';
import { COLORS } from '../../lib/constants';
import { PERIOD_OPTIONS } from '../../lib/filter-options';
import { useLineFilter } from '../../hooks/useCommonFilters';

const PIE_COLORS = [COLORS.danger, COLORS.energy.power, COLORS.chart.purple];

/* ─── Mini SVG Donut ───────────────────────────────────── */
function SvgDonut({ data }: { data: { name: string; value: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let a = 0, t: ReturnType<typeof setTimeout>;
    const m = () => {
      const el = ref.current;
      if (!el) { if (++a < 20) t = setTimeout(m, 50); return; }
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
      else if (++a < 20) t = setTimeout(m, 50);
    };
    m();
    const ro = new ResizeObserver(es => { const r = es[0]?.contentRect; if (r && r.width > 0 && r.height > 0) setSize({ w: Math.floor(r.width), h: Math.floor(r.height) }); });
    if (ref.current) ro.observe(ref.current);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, []);

  const { w, h } = size;
  if (w < 20 || h < 20 || !data.length) return <div ref={ref} style={{ width: '100%', height: '100%' }} />;

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div ref={ref} style={{ width: '100%', height: '100%' }} />;

  const legendW = 90;
  const chartW = w - legendW;
  const radius = Math.min(chartW / 2, h / 2) * 0.75;
  const thickness = radius * 0.45;
  const midR = radius - thickness / 2;
  const circumference = 2 * Math.PI * midR;
  const cx = chartW / 2;
  const cy = h / 2;

  let offset = circumference * 0.25;
  const segments = data.map((d, i) => {
    const pct = d.value / total;
    const arcLen = pct * circumference;
    const dashOffset = offset;
    offset -= arcLen;
    return { ...d, index: i, pct, arcLen, dashOffset, color: PIE_COLORS[i % PIE_COLORS.length] };
  });

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative', display: 'flex' }}>
      <svg width={chartW} height={h}>
        {segments.map(s => (
          <circle
            key={s.index}
            cx={cx} cy={cy} r={midR}
            fill="none" stroke={s.color}
            strokeWidth={hover === s.index ? thickness + 4 : thickness}
            strokeDasharray={`${Math.max(s.arcLen - 2, 0)} ${circumference}`}
            strokeDashoffset={s.dashOffset}
            opacity={hover !== null && hover !== s.index ? 0.4 : 1}
            style={{ cursor: 'pointer', transition: 'stroke-width 0.15s, opacity 0.15s' }}
            onMouseEnter={() => setHover(s.index)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#374151">합계</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={13} fontWeight={700} fill="#111827">{total}건</text>
      </svg>
      <div style={{ width: legendW, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, paddingRight: 4 }}>
        {segments.map(s => (
          <div
            key={s.index}
            className="flex items-center gap-1.5 cursor-pointer"
            onMouseEnter={() => setHover(s.index)}
            onMouseLeave={() => setHover(null)}
            style={{ opacity: hover !== null && hover !== s.index ? 0.5 : 1, transition: 'opacity 0.15s' }}
          >
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{s.name}</span>
            <span className="text-xs font-bold text-gray-800 dark:text-white ml-auto">{(s.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ALT003CycleAnomalyStats() {
  const { line, filter: lineFilter } = useLineFilter();
  const [period, setPeriod] = useState('8w');

  const { data: kpi } = useQuery({ queryKey: ['alt-cycle-kpi'], queryFn: () => getAlertStatsKpi('cycle_anomaly') });
  const { data: trend } = useQuery({ queryKey: ['alt-cycle-trend'], queryFn: () => getAlertTrend('cycle_anomaly') });
  const { data: anomalyTypes } = useQuery({ queryKey: ['alt-cycle-types'], queryFn: getCycleAnomalyTypes });

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="싸이클 이상 통계" description="싸이클 에너지·파형 이상 알림 통계 (8주)" />

      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard label="누적 알림" value={kpi?.total ?? 0} unit="건" />
        <KpiCard label="주간 알림" value={kpi?.weekly ?? 0} unit="건" change={kpi?.weeklyChange} inverseChange changeLabel="vs 전주" />
        <KpiCard label="조치 완료" value={kpi?.resolved ?? 0} unit="건" />
        <KpiCard label="조치율" value={kpi?.resolvedRate ?? 0} unit="%" />
      </div>

      <FilterBar
        filters={[
          { type: 'select', key: 'period', label: '기간', value: period, onChange: setPeriod, options: PERIOD_OPTIONS },
          lineFilter,
        ]}
        onSearch={() => {}}
        className="mb-0"
      />

      <div className="flex gap-3 flex-1 min-h-0">
        {/* 주간 트렌드 */}
        <ChartCard
          title="주간 싸이클 이상 알림 추이"
          subtitle="최근 8주 발생 건수"
          className="flex-[2]"
          chartId="alt003-trend"
          exportData={trend}
          exportFilename="싸이클이상_주간트렌드"
          minHeight={0}
        >
          <SvgBarChart
            data={trend ?? []}
            categoryKey="week"
            bars={[{ dataKey: 'count', color: COLORS.chart.purple }]}
            formatTooltip={(item) => `${item.week}: ${item.count}건`}
          />
        </ChartCard>

        {/* 이상 유형 분포 (순수 SVG 도넛) */}
        <ChartCard
          title="이상 유형 분포"
          subtitle="싸이클 이상 원인 분류"
          className="flex-[1]"
          chartId="alt003-type"
          minHeight={0}
        >
          <SvgDonut data={anomalyTypes ?? []} />
        </ChartCard>
      </div>
    </div>
  );
}
