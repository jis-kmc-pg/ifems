import { useState, useMemo, useRef, useEffect } from 'react';
import useSWR from 'swr';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import FilterBar from '../../components/ui/FilterBar';
import { getUsageDistribution } from '../../services/dashboard';
import { useSearchFilter } from '../../hooks/useSearchFilter';
import { useLineFilter } from '../../hooks/useCommonFilters';
import { COLORS } from '../../lib/constants';

const PIE_COLORS_PROCESS = [
  COLORS.energy.air, COLORS.chart.cyan, COLORS.chart.green,
  COLORS.chart.purple, COLORS.chart.orange, COLORS.chart.pink,
];
const PIE_COLORS_NON = [COLORS.chart.amber, COLORS.chart.red, COLORS.offline, '#94a3b8'];

type DistItem = { name: string; value: number };

function DonutChart({ data, colors, unit }: { data: DistItem[]; colors: string[]; unit: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const measure = () => {
      const el = containerRef.current;
      if (!el) { attempts++; if (attempts < 20) timer = setTimeout(measure, 50); return; }
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDims({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      } else { attempts++; if (attempts < 20) timer = setTimeout(measure, 50); }
    };
    measure();
    const onResize = () => {
      const el = containerRef.current;
      if (el) { const rect = el.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) setDims({ width: Math.floor(rect.width), height: Math.floor(rect.height) }); }
    };
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', onResize); };
  }, []);

  if (!data || data.length === 0 || total === 0) {
    return <div ref={containerRef} className="w-full h-full flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>;
  }

  const w = dims.width;
  const h = dims.height;
  const legendW = 90;
  const chartW = w - legendW;
  const cx = chartW / 2;
  const cy = h / 2;
  const radius = Math.min(chartW / 2, h / 2) * 0.8;
  const thickness = radius * 0.5;
  const midR = radius;
  const circumference = 2 * Math.PI * midR;
  const gapPx = 3;

  let offset = 0;
  const slices = data.map((d, i) => {
    const ratio = d.value / total;
    const arcLen = ratio * circumference - gapPx;
    const dashOffset = -offset + circumference * 0.25;
    offset += ratio * circumference;
    const midAngle = ((offset - ratio * circumference / 2) / circumference) * 360 - 90;
    const RAD = Math.PI / 180;
    const labelR = midR + thickness / 2 + 14;
    const lx = cx + labelR * Math.cos(midAngle * RAD);
    const ly = cy + labelR * Math.sin(midAngle * RAD);
    const pct = (ratio * 100).toFixed(0);
    return { ...d, arcLen, dashOffset, midAngle, lx, ly, pct, color: colors[i % colors.length], index: i };
  });

  const fmtValue = (v: number) => unit === 'kWh' ? `${v.toFixed(1)} kWh` : `${(v / 1000).toFixed(1)} KL`;
  const fmtTotal = unit === 'kWh' ? total.toFixed(0) : `${(total / 1000).toFixed(0)}K`;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col relative">
      {w > 0 && h > 0 && (
        <>
          {/* Legend 우측 */}
          <div className="absolute right-0 top-0 flex flex-col justify-center gap-1.5 h-full" style={{ width: legendW, paddingRight: 6 }}>
            {slices.map((s) => (
              <div
                key={s.index}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer"
                onMouseEnter={() => setHover(s.index)}
                onMouseLeave={() => setHover(null)}
                style={{ opacity: hover !== null && hover !== s.index ? 0.4 : 1, transition: 'opacity 0.15s' }}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="truncate">{s.name}</span>
              </div>
            ))}
          </div>
          {/* Donut SVG */}
          <svg width={w} height={h}>
            {slices.map((s) => (
              <circle
                key={s.index}
                cx={cx}
                cy={cy}
                r={midR}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === s.index ? thickness + 6 : thickness}
                strokeDasharray={`${Math.max(s.arcLen, 0)} ${circumference}`}
                strokeDashoffset={s.dashOffset}
                opacity={hover !== null && hover !== s.index ? 0.4 : 1}
                style={{ cursor: 'pointer', transition: 'stroke-width 0.15s, opacity 0.15s' }}
                onMouseEnter={() => setHover(s.index)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
            {slices.map((s) => {
              if (Number(s.pct) < 6) return null;
              const RAD = Math.PI / 180;
              const tx = cx + midR * Math.cos(s.midAngle * RAD);
              const ty = cy + midR * Math.sin(s.midAngle * RAD);
              return (
                <text key={`lbl-${s.index}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#fff" style={{ pointerEvents: 'none' }}>
                  {s.pct}%
                </text>
              );
            })}
            <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#9ca3af">합계</text>
            <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight="bold" fill="#1f2937" className="dark:fill-white">{fmtTotal}</text>
          </svg>
          {hover !== null && slices[hover] && (
            <div
              className="absolute pointer-events-none px-3 py-2 rounded-lg text-xs text-white shadow-lg z-10"
              style={{
                background: 'rgba(26,26,46,0.95)',
                left: Math.min(Math.max(slices[hover].lx, 70), w - 70),
                top: Math.max(slices[hover].ly - 10, 10),
                transform: 'translate(-50%, -100%)',
              }}
            >
              <span className="font-semibold">{slices[hover].name}</span>: {fmtValue(slices[hover].value)} ({slices[hover].pct}%)
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DSH003UsageDistribution() {
  const { line, filter: lineFilter } = useLineFilter();

  // ── 검색 필터 훅 (에너지추이와 동일) ──
  const { filters: searchFilters, startTime, endTime } = useSearchFilter();

  // 라인 필터 + useSearchFilter 결합
  const filters = useMemo(() => [
    lineFilter,
    ...searchFilters,
  ], [lineFilter, searchFilters]);

  // ── 데이터 조회 (useSWR — 검색 범위 기반) ──
  const lineParam = line === 'all' ? undefined : (line as 'block');
  const { data, mutate } = useSWR(
    `dsh003:${line}:${startTime}:${endTime}`,
    () => getUsageDistribution(lineParam, startTime, endTime),
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  const totalPowerProcess = (data?.powerProcessing ?? []).reduce((s: number, d: DistItem) => s + (Number(d.value) || 0), 0);
  const totalPowerNon = (data?.powerNonProcessing ?? []).reduce((s: number, d: DistItem) => s + (Number(d.value) || 0), 0);
  const totalAirProcess = (data?.airProcessing ?? []).reduce((s: number, d: DistItem) => s + (Number(d.value) || 0), 0);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="사용량 분포" description="전력/에어 가공·비가공 공정별 분포 (도넛 차트)" />

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard label="전체 전력" value={Math.round(totalPowerProcess + totalPowerNon)} unit="kWh" />
        <KpiCard label="가공 전력" value={Math.round(totalPowerProcess)} unit="kWh" />
        <KpiCard label="비가공 전력" value={Math.round(totalPowerNon)} unit="kWh" />
        <KpiCard label="가공 에어" value={Math.round(totalAirProcess / 1000)} unit="KL" />
      </div>

      {/* 필터바 (useSearchFilter — 에너지추이와 동일) */}
      <FilterBar
        filters={filters}
        onSearch={() => mutate()}
        searchLabel="검색"
        className="mb-0"
      />

      {/* 도넛 차트 2×2 */}
      <div className="grid grid-cols-2 grid-rows-2 gap-3 flex-1 min-h-0">
        <ChartCard
          title="전력 — 가공 공정별"
          subtitle="OP10~OP60 전력 분포"
          className="h-full"
          chartId="dsh003-power-process"
          exportData={data?.powerProcessing}
          exportFilename="사용량분포_전력가공"
          minHeight={200}
        >
          <DonutChart data={data?.powerProcessing ?? []} colors={PIE_COLORS_PROCESS} unit="kWh" />
        </ChartCard>

        <ChartCard
          title="전력 — 비가공 공정별"
          subtitle="컴프레서/쿨링/집진기 전력 분포"
          className="h-full"
          chartId="dsh003-power-non"
          exportData={data?.powerNonProcessing}
          exportFilename="사용량분포_전력비가공"
          minHeight={200}
        >
          <DonutChart data={data?.powerNonProcessing ?? []} colors={PIE_COLORS_NON} unit="kWh" />
        </ChartCard>

        <ChartCard
          title="에어 — 가공 공정별"
          subtitle="OP10~OP60 에어 분포"
          className="h-full"
          chartId="dsh003-air-process"
          exportData={data?.airProcessing}
          exportFilename="사용량분포_에어가공"
          minHeight={200}
        >
          <DonutChart data={data?.airProcessing ?? []} colors={PIE_COLORS_PROCESS} unit="L" />
        </ChartCard>

        <ChartCard
          title="에어 — 비가공 공정별"
          subtitle="비가공 에어 분포"
          className="h-full"
          chartId="dsh003-air-non"
          exportData={data?.airNonProcessing}
          exportFilename="사용량분포_에어비가공"
          minHeight={200}
        >
          <DonutChart data={data?.airNonProcessing ?? []} colors={PIE_COLORS_NON} unit="L" />
        </ChartCard>
      </div>
    </div>
  );
}
