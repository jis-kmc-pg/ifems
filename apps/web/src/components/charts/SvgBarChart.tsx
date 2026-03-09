import { useState, useRef, useEffect } from 'react';

/* ═══ Types ═══════════════════════════════════════════════ */

export type BarDef = {
  dataKey: string;
  color: string | ((item: Record<string, unknown>, index: number) => string);
  label?: string;
  opacity?: number;
};

export type RefLine = {
  value: number;
  color: string;
  label?: string;
  dashed?: boolean;
};

type Props = {
  data: Record<string, unknown>[];
  categoryKey: string;
  bars: BarDef[];
  orientation?: 'vertical' | 'horizontal';
  referenceLines?: RefLine[];
  domain?: [number, number];
  valueUnit?: string;
  formatValue?: (v: number) => string;
  formatTooltip?: (item: Record<string, unknown>, bar: BarDef) => string;
  showGrid?: boolean;
  barRadius?: number;
  className?: string;
  /** 바 위에 값 라벨 표시 */
  showBarLabels?: boolean;
  /** 바 라벨 포맷 */
  formatBarLabel?: (v: number) => string;
};

/* ═══ Helpers ═════════════════════════════════════════════ */

function niceStep(range: number): number {
  if (range <= 0) return 1;
  const exp = Math.floor(Math.log10(range));
  const frac = range / 10 ** exp;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

function makeTicks(min: number, max: number): number[] {
  if (max <= min) return [min];
  const step = niceStep((max - min) / 5);
  const lo = Math.floor(min / step) * step;
  const arr: number[] = [];
  for (let v = lo; v <= max + step * 0.01; v += step) {
    arr.push(Math.round(v * 1e8) / 1e8);
  }
  return arr;
}

function resolveColor(
  c: BarDef['color'],
  item: Record<string, unknown>,
  i: number,
): string {
  return typeof c === 'function' ? c(item, i) : c;
}

/* ═══ Component ═══════════════════════════════════════════ */

export default function SvgBarChart({
  data,
  categoryKey,
  bars,
  orientation = 'vertical',
  referenceLines = [],
  domain,
  valueUnit = '',
  formatValue,
  formatTooltip,
  showGrid = true,
  barRadius = 2,
  className,
  showBarLabels,
  formatBarLabel,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  /* ── size measurement ──────────────────────────────── */
  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const measure = () => {
      const el = ref.current;
      if (!el) {
        if (++attempts < 20) timer = setTimeout(measure, 50);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
      } else if (++attempts < 20) {
        timer = setTimeout(measure, 50);
      }
    };
    measure();
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
      }
    });
    if (ref.current) ro.observe(ref.current);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  const vert = orientation === 'vertical';
  const { w, h } = size;

  // Empty state
  if (w < 20 || h < 20 || !data.length) {
    return (
      <div
        ref={ref}
        className={className}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }

  /* ── legend ────────────────────────────────────────── */
  const legendItems = bars.filter((b) => b.label);
  const hasLegend = legendItems.length > 1;
  const legendH = hasLegend ? 20 : 0;

  /* ── margins ───────────────────────────────────────── */
  const cats = data.map((d) => String(d[categoryKey]));
  const maxCatLen = Math.max(...cats.map((l) => l.length));

  const mg = vert
    ? {
        top: 8 + legendH,
        right: 16,
        left: 44,
        bottom: Math.min(maxCatLen * 4 + 16, 52),
      }
    : {
        top: 8 + legendH,
        right: 48,
        left: Math.min(maxCatLen * 7 + 8, 100),
        bottom: 24,
      };

  const pW = w - mg.left - mg.right;
  const pH = h - mg.top - mg.bottom;
  if (pW < 10 || pH < 10) {
    return (
      <div
        ref={ref}
        className={className}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }

  /* ── value domain ──────────────────────────────────── */
  const allVals = data.flatMap((d) =>
    bars.map((b) => Number(d[b.dataKey]) || 0),
  );
  const dMin = Math.min(0, ...allVals);
  const dMax = Math.max(0, ...allVals);
  const [vMin, vMax] = domain ?? [dMin, dMax === dMin ? dMax + 1 : dMax];
  const vR = vMax - vMin || 1;
  const ticks = makeTicks(vMin, vMax);

  const fv =
    formatValue ??
    ((v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)));

  /* ── scales ────────────────────────────────────────── */
  const v2p = (v: number) =>
    vert
      ? mg.top + pH - ((v - vMin) / vR) * pH
      : mg.left + ((v - vMin) / vR) * pW;
  const zero = v2p(Math.max(vMin, Math.min(vMax, 0)));

  /* ── bar geometry ──────────────────────────────────── */
  const n = data.length;
  const slot = vert ? pW / n : pH / n;
  const bCount = bars.length;
  const bThick = Math.min((slot * 0.7) / bCount, vert ? 40 : 20);
  const groupSz = bThick * bCount;
  const pad = (slot - groupSz) / 2;

  /* ── category label interval ───────────────────────── */
  const catInterval = vert ? Math.max(1, Math.ceil(n / 12)) : 1;

  /* ── colors ────────────────────────────────────────── */
  const gridC = '#e5e7eb';
  const textC = '#9ca3af';
  const axisC = '#d1d5db';

  /* ── build SVG elements ────────────────────────────── */
  const els: JSX.Element[] = [];

  // Grid + value ticks
  ticks.forEach((t) => {
    const p = v2p(t);
    if (showGrid) {
      els.push(
        vert ? (
          <line
            key={`g${t}`}
            x1={mg.left}
            x2={w - mg.right}
            y1={p}
            y2={p}
            stroke={gridC}
            strokeDasharray="3 3"
          />
        ) : (
          <line
            key={`g${t}`}
            x1={p}
            x2={p}
            y1={mg.top}
            y2={h - mg.bottom}
            stroke={gridC}
            strokeDasharray="3 3"
          />
        ),
      );
    }
    els.push(
      vert ? (
        <text
          key={`t${t}`}
          x={mg.left - 6}
          y={p}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize={10}
          fill={textC}
        >
          {fv(t)}
          {valueUnit}
        </text>
      ) : (
        <text
          key={`t${t}`}
          x={p}
          y={h - mg.bottom + 16}
          textAnchor="middle"
          fontSize={10}
          fill={textC}
        >
          {fv(t)}
          {valueUnit}
        </text>
      ),
    );
  });

  // Category labels
  data.forEach((item, i) => {
    if (i % catInterval !== 0) return;
    const lbl = String(item[categoryKey]);
    els.push(
      vert ? (
        <text
          key={`c${i}`}
          x={mg.left + i * slot + slot / 2}
          y={h - mg.bottom + 14}
          textAnchor="middle"
          fontSize={9}
          fill={textC}
        >
          {lbl.length > 10 ? lbl.slice(0, 9) + '\u2026' : lbl}
        </text>
      ) : (
        <text
          key={`c${i}`}
          x={mg.left - 6}
          y={mg.top + i * slot + slot / 2}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize={9}
          fill={textC}
        >
          {lbl.length > 14 ? lbl.slice(0, 13) + '\u2026' : lbl}
        </text>
      ),
    );
  });

  // Axis lines
  els.push(
    <line
      key="ax-y"
      x1={mg.left}
      x2={mg.left}
      y1={mg.top}
      y2={h - mg.bottom}
      stroke={axisC}
    />,
    <line
      key="ax-x"
      x1={mg.left}
      x2={w - mg.right}
      y1={h - mg.bottom}
      y2={h - mg.bottom}
      stroke={axisC}
    />,
  );

  // Reference lines
  referenceLines.forEach((rl, i) => {
    const p = v2p(rl.value);
    const dash = rl.dashed !== false ? '4 2' : undefined;
    els.push(
      vert ? (
        <g key={`rl${i}`}>
          <line
            x1={mg.left}
            x2={w - mg.right}
            y1={p}
            y2={p}
            stroke={rl.color}
            strokeDasharray={dash}
          />
          {rl.label && (
            <text
              x={w - mg.right + 4}
              y={p}
              dominantBaseline="middle"
              fontSize={9}
              fill={rl.color}
            >
              {rl.label}
            </text>
          )}
        </g>
      ) : (
        <g key={`rl${i}`}>
          <line
            x1={p}
            x2={p}
            y1={mg.top}
            y2={h - mg.bottom}
            stroke={rl.color}
            strokeDasharray={dash}
          />
          {rl.label && (
            <text
              x={p}
              y={mg.top - 4}
              textAnchor="middle"
              fontSize={9}
              fill={rl.color}
            >
              {rl.label}
            </text>
          )}
        </g>
      ),
    );
  });

  // Bars + hover areas
  const barEls: JSX.Element[] = [];
  const hitEls: JSX.Element[] = [];
  const labelEls: JSX.Element[] = [];

  data.forEach((item, di) => {
    bars.forEach((bd, bi) => {
      const val = Number(item[bd.dataKey]) || 0;
      const color = resolveColor(bd.color, item, di);
      const op = bd.opacity ?? 1;

      let x: number, y: number, bw: number, bh: number;

      if (vert) {
        x = mg.left + di * slot + pad + bi * bThick;
        bw = bThick;
        if (val >= 0) {
          y = v2p(val);
          bh = zero - y;
        } else {
          y = zero;
          bh = v2p(val) - zero;
        }
      } else {
        y = mg.top + di * slot + pad + bi * bThick;
        bh = bThick;
        if (val >= 0) {
          x = zero;
          bw = v2p(val) - zero;
        } else {
          x = v2p(val);
          bw = zero - v2p(val);
        }
      }

      bw = Math.max(0, bw);
      bh = Math.max(0, bh);

      const tipText = formatTooltip
        ? formatTooltip(item, bd)
        : `${item[categoryKey]}${bd.label ? ` (${bd.label})` : ''}: ${val > 0 ? '+' : ''}${fv(val)}${valueUnit}`;

      barEls.push(
        <rect
          key={`b${di}-${bi}`}
          x={x}
          y={y}
          width={bw}
          height={bh}
          rx={barRadius}
          fill={color}
          opacity={op}
        />,
      );

      hitEls.push(
        <rect
          key={`h${di}-${bi}`}
          x={x - 2}
          y={y - 2}
          width={bw + 4}
          height={bh + 4}
          fill="transparent"
          onMouseEnter={(e) => {
            const r = ref.current!.getBoundingClientRect();
            setTip({
              x: e.clientX - r.left,
              y: e.clientY - r.top - 12,
              text: tipText,
            });
          }}
          onMouseMove={(e) => {
            const r = ref.current!.getBoundingClientRect();
            setTip({
              x: e.clientX - r.left,
              y: e.clientY - r.top - 12,
              text: tipText,
            });
          }}
          onMouseLeave={() => setTip(null)}
        />,
      );

      // Bar labels
      if (showBarLabels && bw > 0 && bh > 0) {
        const lblFmt = formatBarLabel ?? fv;
        if (vert) {
          labelEls.push(
            <text
              key={`lb${di}-${bi}`}
              x={x + bw / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize={10}
              fill={textC}
            >
              {lblFmt(val)}
            </text>,
          );
        } else {
          labelEls.push(
            <text
              key={`lb${di}-${bi}`}
              x={x + bw + 4}
              y={y + bh / 2}
              textAnchor="start"
              dominantBaseline="middle"
              fontSize={10}
              fill={textC}
            >
              {lblFmt(val)}
            </text>,
          );
        }
      }
    });
  });

  // Legend
  const legendEls = hasLegend
    ? legendItems.map((b, i) => {
        const lx = w - mg.right - (legendItems.length - i) * 80;
        return (
          <g key={`lg${i}`}>
            <rect
              x={lx}
              y={4}
              width={10}
              height={10}
              rx={2}
              fill={typeof b.color === 'string' ? b.color : '#888'}
              opacity={b.opacity ?? 1}
            />
            <text x={lx + 14} y={13} fontSize={10} fill={textC}>
              {b.label}
            </text>
          </g>
        );
      })
    : null;

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <svg width={w} height={h} style={{ display: 'block' }}>
        {els}
        {barEls}
        {labelEls}
        {hitEls}
        {legendEls}
      </svg>

      {/* Tooltip */}
      {tip && (
        <div
          style={{
            position: 'absolute',
            left: tip.x,
            top: tip.y,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(26,26,46,.95)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 12,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
