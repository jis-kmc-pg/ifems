import { memo, useMemo, useRef, useState, useEffect } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { downsampleChartData } from '../../lib/utils';
import { calculateZoomRatio } from '../../lib/chart-utils';
import type { AnomalyEvent } from '../../types/chart';

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  type?: 'line' | 'area' | 'bar';
  width?: number;
  fillOpacity?: number;
}

interface TrendChartProps {
  data: Array<Record<string, any>>;
  series: TrendSeries[];
  xKey?: string;
  width?: number;
  height?: number;
  syncKey?: string;
  yLabel?: string;
  showLegend?: boolean;
  currentTime?: string; // 현재 시각 (수직선 표시)
  onZoomChange?: (zoomRatio: number, timeRange?: { start: string; end: string }) => void; // 동적 해상도: zoom 이벤트 콜백 (시간 범위 포함)
  isLoading?: boolean; // 동적 해상도: 로딩 상태
  loadingMessage?: string; // 동적 해상도: 로딩 메시지
  anomalies?: AnomalyEvent[]; // 이상 데이터 구간 (반투명 영역 표시)
  verticalMarkers?: VerticalMarker[]; // 수직선 마커 (스텝 경계 등)
  spanGaps?: boolean; // null 갭 연결 여부 (기본: line/area=true, bar=false)
}

export interface VerticalMarker {
  xValue: string; // xKey 값 (xLabels에서 매칭)
  color: string;
  label?: string;
  dashed?: boolean;
}

const TrendChart = memo(({
  data,
  series,
  xKey = 'time',
  width,
  height,
  syncKey,
  yLabel = 'Value',
  showLegend = true,
  currentTime,
  onZoomChange,
  isLoading = false,
  loadingMessage,
  anomalies,
  verticalMarkers,
  spanGaps: spanGapsProp,
}: TrendChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null); // 차트 영역 직접 측정용
  const uplotRef = useRef<uPlot | null>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null); // zoom debounce용 타이머
  const prevZoomRatioRef = useRef<number>(1); // 이전 zoom ratio 저장
  const zoomLockRef = useRef<boolean>(false); // zoom lock (interval당 1번만)
  const [dims, setDims] = useState({ width: width || 800, height: height || 300 });
  const [cursorIdx, setCursorIdx] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState<{ left: number; top: number } | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [isZoomed, setIsZoomed] = useState(false);
  const [isProcessingZoom, setIsProcessingZoom] = useState(false);

  // ✅ 확대된 시간 범위 저장 (동적해상도: 확대 범위 유지용)
  const [zoomedTimeRange, setZoomedTimeRange] = useState<{ start: string; end: string } | null>(null);
  // ref: 복원 useEffect에서 읽기 전용 (deps에 넣지 않아 무한 루프 방지)
  const zoomedRangeRef = useRef<{ start: string; end: string } | null>(null);
  zoomedRangeRef.current = zoomedTimeRange;
  // handlePan/복원 시 setScale 훅 스킵 플래그 (패딩으로 인한 범위 확장 방지)
  const isInternalScaleChangeRef = useRef(false);

  // 데이터 존재 여부 (return null 해제 시 containerRef 마운트 감지용)
  const hasData = !!(data && data.length > 0);

  // 크기 측정: 부모 요소에서 padding을 제외한 content 영역 + ResizeObserver
  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return; // 데이터 없으면 return null → parent 없음 → hasData 변경 시 재실행

    const updateSize = () => {
      const rect = parent.getBoundingClientRect();
      const style = getComputedStyle(parent);
      const py = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const newWidth = Math.floor(rect.width) || 800;
      const newHeight = Math.floor(rect.height - py) || 400;

      setDims(prev => {
        if (prev.width === (width || newWidth) && prev.height === (height || newHeight)) return prev;
        return { width: width || newWidth, height: height || newHeight };
      });
    };

    // ResizeObserver: 레이아웃 변경/윈도우 리사이즈 자동 감지
    const observer = new ResizeObserver(updateSize);
    observer.observe(parent);

    return () => observer.disconnect();
  }, [width, height, hasData]);

  // 다운샘플링: 성능과 데이터 표현의 균형 (최대 5000포인트)
  const sampledData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const maxPoints = Math.min(data.length, 5000);
    return downsampleChartData(data, maxPoints);
  }, [data]);

  // uPlot 데이터 형식으로 변환: [[x축], [y1], [y2], ...]
  const uplotData = useMemo(() => {
    if (!sampledData || sampledData.length === 0) return [[]];

    // X축은 인덱스로 (uPlot은 숫자 배열 필요)
    const xData = sampledData.map((_, i) => i);
    const yDataArrays = series.map(s => sampledData.map(d => {
      const raw = d[s.key];
      if (raw == null) return null; // null/undefined → null
      const num = Number(raw);
      return isNaN(num) ? null : num; // NaN → null, 0은 유지
    }));

    return [xData, ...yDataArrays];
  }, [sampledData, series]);

  // 초기 X축 범위 저장
  const initialXRange = useMemo(() => {
    if (uplotData[0].length === 0) return [0, 0];
    return [0, uplotData[0].length - 1];
  }, [uplotData]);

  // X축 레이블 (다운샘플링된 데이터 기준)
  const xLabels = useMemo(() => sampledData.map(d => d[xKey]), [sampledData, xKey]);

  // ✅ 데이터 변경 시: 확대 범위가 있으면 복원 (ref에서 읽어 무한 루프 방지)
  useEffect(() => {
    const range = zoomedRangeRef.current;
    if (range && uplotRef.current && xLabels.length > 0 && sampledData.length > 0 && uplotData[0].length > 0) {
      const startIdx = xLabels.findIndex(label => label >= range.start);
      const endIdx = xLabels.findIndex(label => label >= range.end);

      if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        isInternalScaleChangeRef.current = true;
        setTimeout(() => {
          if (uplotRef.current && uplotRef.current.data && uplotRef.current.data[0]) {
            uplotRef.current.setScale('x', {
              min: startIdx,
              max: endIdx,
            });
          }
          // setScale 훅이 처리된 후 플래그 해제
          requestAnimationFrame(() => { isInternalScaleChangeRef.current = false; });
        }, 150);
      } else {
        setZoomedTimeRange(null);
        setIsZoomed(false);
      }
    }

    // zoom lock 해제 (새 데이터에서 다시 zoom 가능)
    prevZoomRatioRef.current = 1;
    zoomLockRef.current = false;
  }, [data, xLabels, sampledData, uplotData]);

  // Y축 데이터 범위 계산 (null 제외, 10% 여유)
  const yRange = useMemo(() => {
    const allValues: number[] = [];

    // 모든 시리즈의 데이터를 모아서 null이 아닌 값만 추출
    series.forEach(s => {
      sampledData.forEach(d => {
        const rawVal = d[s.key];
        // ✅ null/undefined 먼저 체크 (Number(null) === 0 방지)
        if (rawVal != null) { // null과 undefined 모두 제외
          const numVal = Number(rawVal);
          if (!isNaN(numVal)) {
            allValues.push(numVal);
          }
        }
      });
    });

    if (allValues.length === 0) return undefined;

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min;

    let padding;
    if (range === 0) {
      // ✅ 모든 값이 같은 경우: 값 자체의 10%를 여유로 (예: 3.4 → ±0.34)
      padding = Math.abs(min) * 0.1;
      if (padding === 0) padding = 1; // 값이 0인 경우 기본 여유
    } else {
      // 일반적인 경우: 범위의 10%
      padding = range * 0.1;
    }

    // ✅ 전력량은 0 이하로 떨어질 수 없음
    const yMin = Math.max(0, min - padding);
    let yMax = max + padding;

    // ✅ 비정상적으로 큰 값 방지: 최대값 상한선 설정
    // 전력(kWh): 10,000 이하, 에어(L): 100,000 이하로 제한
    if (yLabel === 'kWh' && yMax > 10000) {
      yMax = 10000;
    } else if (yLabel === 'L' && yMax > 100000) {
      yMax = 100000;
    } else if (yMax > 1000000) {
      // 일반적인 상한선: 1,000,000
      yMax = 1000000;
    }

    return [yMin, yMax];
  }, [sampledData, series, yLabel]);

  // 차트 리셋 함수
  const handleReset = () => {
    if (uplotRef.current) {
      uplotRef.current.setScale('x', {
        min: initialXRange[0],
        max: initialXRange[1],
      });

      if (yRange) {
        uplotRef.current.setScale('y', {
          min: yRange[0],
          max: yRange[1],
        });
      }

      setZoomedTimeRange(null);
      setIsZoomed(false);

      if (syncKey) {
        window.dispatchEvent(new CustomEvent('chart-reset', {
          detail: { syncKey }
        }));
      }
    }
  };

  // 줌 상태에서 좌우 이동 (zoomedTimeRange 상태 기반 → 패딩 영향 없음)
  const handlePan = (direction: 'left' | 'right') => {
    const u = uplotRef.current;
    if (!u || !zoomedTimeRange) return;

    // 현재 줌 범위를 인덱스로 변환 (u.scales.x 대신 state → 패딩 무관)
    const curStartIdx = xLabels.findIndex(label => label >= zoomedTimeRange.start);
    const curEndIdx = xLabels.findIndex(label => label >= zoomedTimeRange.end);
    if (curStartIdx === -1 || curEndIdx === -1) return;

    const visibleCount = curEndIdx - curStartIdx;
    const dataMax = xLabels.length - 1;

    let newStartIdx: number;
    let newEndIdx: number;

    if (direction === 'left') {
      newStartIdx = curStartIdx - visibleCount;
      newEndIdx = curEndIdx - visibleCount;
      if (newStartIdx < 0) {
        newStartIdx = 0;
        newEndIdx = visibleCount;
      }
    } else {
      newStartIdx = curStartIdx + visibleCount;
      newEndIdx = curEndIdx + visibleCount;
      if (newEndIdx > dataMax) {
        newEndIdx = dataMax;
        newStartIdx = dataMax - visibleCount;
      }
    }

    // 플래그: setScale 훅이 범위를 패딩으로 덮어쓰지 않도록
    isInternalScaleChangeRef.current = true;
    u.setScale('x', { min: newStartIdx, max: newEndIdx });
    setZoomedTimeRange({
      start: xLabels[newStartIdx],
      end: xLabels[newEndIdx],
    });
    requestAnimationFrame(() => { isInternalScaleChangeRef.current = false; });
  };

  // 현재 이동 가능 여부 (경계 도달 시 버튼 비활성화, state 기반 → 리렌더 보장)
  const panState = useMemo(() => {
    if (!isZoomed || !zoomedTimeRange) return { canLeft: false, canRight: false };
    const startIdx = xLabels.findIndex(label => label >= zoomedTimeRange.start);
    const endIdx = xLabels.findIndex(label => label >= zoomedTimeRange.end);
    return {
      canLeft: startIdx > 0,
      canRight: endIdx !== -1 && endIdx < xLabels.length - 1,
    };
  }, [isZoomed, zoomedTimeRange, xLabels]);

  // 다른 차트에서 리셋 이벤트 수신
  useEffect(() => {
    if (!syncKey) return;

    const handleResetEvent = (e: CustomEvent) => {
      if (e.detail.syncKey === syncKey && uplotRef.current) {
        // X축 리셋
        uplotRef.current.setScale('x', {
          min: initialXRange[0],
          max: initialXRange[1],
        });

        // Y축 리셋
        if (yRange) {
          uplotRef.current.setScale('y', {
            min: yRange[0],
            max: yRange[1],
          });
        }

        // ✅ 확대 범위 초기화
        setZoomedTimeRange(null);
        setIsZoomed(false);
      }
    };

    window.addEventListener('chart-reset', handleResetEvent as EventListener);
    return () => {
      window.removeEventListener('chart-reset', handleResetEvent as EventListener);
    };
  }, [syncKey, initialXRange, yRange]);

  // uPlot 옵션 설정
  const options = useMemo((): uPlot.Options => {
    return {
      width: dims.width - 40,
      height: dims.height,
      scales: {
        x: {
          time: false,
          // 양쪽 끝에 여유 공간 추가 (모든 차트 동일)
          range: (u, dataMin, dataMax) => {
            const paddingLeft = 0.5;
            const paddingRight = 1.0;
            return [dataMin - paddingLeft, dataMax + paddingRight];
          },
        },
        y: {
          range: yRange
            ? (u: uPlot, dataMin: number, dataMax: number) => yRange as [number, number]
            : undefined,
        },
      },
      series: [
        {
          label: xKey,
        },
        ...series.map((s) => {
          const isBar = s.type === 'bar';
          const isArea = s.type === 'area';

          // fill 색상 계산: hex와 rgba 모두 정상 처리
          let fillColor: string | undefined;
          if (isArea || isBar) {
            const opacity = s.fillOpacity ?? 0.25;
            const rgbaMatch = s.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
            if (rgbaMatch) {
              // rgba/rgb → fillOpacity로 alpha 교체
              fillColor = `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${opacity})`;
            } else {
              // hex (#RRGGBB) → alpha hex 추가
              const base = s.color.length === 9 ? s.color.slice(0, 7) : s.color;
              fillColor = base + Math.round(opacity * 255).toString(16).padStart(2, '0');
            }
          }

          return {
            show: !hiddenSeries.has(s.key),
            label: s.label,
            stroke: s.color,
            width: s.width ?? (isBar ? 1 : 2),
            fill: fillColor,
            paths: isBar ? uPlot.paths.bars!({ size: [0.6] }) : undefined,
            spanGaps: spanGapsProp ?? !isBar, // line/area: null 갭 건너뛰고 선 연결 (비교 차트 필수)
            points: {
              show: false,
            },
          };
        }),
      ],
      axes: [
        {
          grid: {
            show: true,
            stroke: '#f0f0f0',
            width: 1,
          },
          ticks: {
            show: true,
            size: 5,
          },
          font: '11px sans-serif',
          size: 50,
          // X축 라벨을 균등하게 표시 (목표: 20-30개)
          splits: (u, axisIdx, scaleMin, scaleMax) => {
            const splits = [];
            const totalPoints = xLabels.length;
            const visibleRange = Math.max(1, scaleMax - scaleMin);
            const targetLabels = 26; // 목표 라벨 개수

            // 보이는 범위 내에서 균등하게 라벨 선택
            const startIdx = Math.max(0, Math.floor(scaleMin));
            const endIdx = Math.min(totalPoints - 1, Math.ceil(scaleMax));
            const visiblePoints = endIdx - startIdx + 1;

            // step 계산: 목표 라벨 개수에 맞게 균등 간격
            const step = Math.max(1, Math.floor(visiblePoints / targetLabels));

            // startIdx부터 step 간격으로 인덱스 추가
            for (let i = startIdx; i <= endIdx; i += step) {
              splits.push(i);
            }

            // 마지막 인덱스가 포함되지 않았으면 추가
            if (splits.length > 0 && splits[splits.length - 1] !== endIdx) {
              splits.push(endIdx);
            }

            return splits.length > 0 ? splits : [startIdx];
          },
          values: (u, vals) => vals.map((v) => {
            const idx = Math.round(v);
            if (idx < 0 || idx >= xLabels.length) return '';
            const label = String(xLabels[idx]);
            // ISO8601("2026-03-05T05:15:00Z") → "05:15:00" 변환
            const tIdx = label.indexOf('T');
            if (tIdx !== -1) return label.slice(tIdx + 1, tIdx + 9);
            // "HH:mm:ss" 그대로 (10초/1초 해상도 필수)
            if (label.length >= 8 && label[2] === ':') return label.slice(0, 8);
            return label;
          }),
        },
        {
          label: yLabel,
          grid: {
            show: true,
            stroke: '#f0f0f0',
            width: 1,
          },
          ticks: {
            show: true,
            size: 5,
          },
          font: '11px sans-serif',
          size: 60,
          // Y축 라벨을 5-6개 정도로 적절히 표시
          splits: (u, axisIdx, scaleMin, scaleMax) => {
            const range = scaleMax - scaleMin;
            // 적절한 간격 계산 (5-6개의 틱을 목표로)
            const rawStep = range / 5;

            // 보기 좋은 숫자로 반올림 (1, 2, 5, 10, 20, 50, 100 등)
            const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
            const normalized = rawStep / magnitude;
            let step;

            if (normalized < 1.5) step = magnitude;
            else if (normalized < 3) step = 2 * magnitude;
            else if (normalized < 7) step = 5 * magnitude;
            else step = 10 * magnitude;

            // 시작점을 step의 배수로 맞춤
            const start = Math.ceil(scaleMin / step) * step;
            const splits = [];

            for (let i = start; i <= scaleMax; i += step) {
              splits.push(i);
            }

            // 0이 범위에 포함되고 splits에 없으면 추가
            if (scaleMin <= 0 && !splits.includes(0)) {
              splits.unshift(0);
            }

            return splits;
          },
        },
      ],
      cursor: {
        show: true,
        drag: {
          x: true,
          y: false,
        },
        sync: syncKey ? {
          key: syncKey,
        } : undefined,
      },
      hooks: {
        init: [
          (u) => {
            uplotRef.current = u;
          },
        ],
        setCursor: [
          (u) => {
            const idx = u.cursor.idx;
            setCursorIdx(idx ?? null);
            if (idx != null && u.cursor.left != null && u.cursor.top != null && u.cursor.left > 0) {
              setCursorPos({ left: u.cursor.left, top: u.cursor.top });
            } else {
              setCursorPos(null);
            }
          },
        ],
        // ✅ 항상 등록: 줌 상태 추적 (모든 페이지에서 < > 버튼 동작)
        setScale: [
          (u, key) => {
            if (key !== 'x') return;
            // handlePan/복원에서 호출 시 스킵 (패딩으로 인한 범위 확장 방지)
            if (isInternalScaleChangeRef.current) return;

            const xScale = u.scales.x;
            const visibleMin = xScale.min ?? 0;
            const visibleMax = xScale.max ?? (uplotData[0].length - 1);
            const totalPoints = uplotData[0].length;
            if (totalPoints === 0) return;

            const zoomRatio = calculateZoomRatio(visibleMin, visibleMax, totalPoints);

            if (zoomRatio > 0.95) {
              setIsZoomed(false);
              return;
            }

            setIsZoomed(true);

            // 드래그 줌에서만 범위 저장 (Math.round로 패딩 보정)
            const startIdx = Math.max(0, Math.round(visibleMin));
            const endIdx = Math.min(xLabels.length - 1, Math.round(visibleMax));
            if (startIdx < xLabels.length && endIdx < xLabels.length) {
              const newStart = xLabels[startIdx];
              const newEnd = xLabels[endIdx];
              setZoomedTimeRange(prev => {
                if (prev?.start === newStart && prev?.end === newEnd) return prev;
                return { start: newStart, end: newEnd };
              });
            }
          },
        ],
        // 동적 해상도 전용: onZoomChange 콜백 트리거 (debounce + lock)
        ...(onZoomChange && {
          setSelect: [
            (u) => {
              if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
              setIsProcessingZoom(true);

              zoomTimeoutRef.current = setTimeout(() => {
                const xScale = u.scales.x;
                if (xScale) {
                  const visibleMin = xScale.min ?? 0;
                  const visibleMax = xScale.max ?? uplotData[0].length - 1;
                  const totalPoints = uplotData[0].length;
                  const zoomRatio = calculateZoomRatio(visibleMin, visibleMax, totalPoints);

                  if (zoomRatio > 0.95 || zoomLockRef.current) {
                    setIsProcessingZoom(false);
                    return;
                  }

                  prevZoomRatioRef.current = zoomRatio;

                  const startIdx = Math.max(0, Math.floor(visibleMin));
                  const endIdx = Math.min(xLabels.length - 1, Math.ceil(visibleMax));
                  const timeRange = startIdx < sampledData.length && endIdx < sampledData.length
                    ? { start: xLabels[startIdx], end: xLabels[endIdx] }
                    : undefined;

                  onZoomChange(zoomRatio, timeRange);
                  zoomLockRef.current = true;
                  setIsProcessingZoom(false);
                }
              }, 700);
            },
          ],
        }),
        // draw hooks: currentTime 수직선 + anomaly 영역 + verticalMarkers
        ...((currentTime || (anomalies && anomalies.length > 0) || (verticalMarkers && verticalMarkers.length > 0)) && {
          draw: [
            (u: uPlot) => {
              const ctx = u.ctx;

              // 1. 이상 데이터 영역 표시 (반투명 빨간 영역)
              if (anomalies && anomalies.length > 0) {
                ctx.save();
                for (const anomaly of anomalies) {
                  // anomaly.start/end와 xLabels(ISO8601) 매칭
                  const startIdx = xLabels.findIndex((label) => String(label) >= anomaly.start);
                  const endIdx = xLabels.findIndex((label) => String(label) >= anomaly.end);

                  if (startIdx === -1) continue;
                  const actualEndIdx = endIdx === -1 ? xLabels.length - 1 : endIdx;

                  const startX = u.valToPos(startIdx, 'x', true);
                  const endX = u.valToPos(actualEndIdx, 'x', true);
                  const regionWidth = Math.max(endX - startX, 4); // 최소 4px

                  // 반투명 빨간 배경
                  ctx.fillStyle = anomaly.type === 'spike'
                    ? 'rgba(239, 68, 68, 0.12)'   // 급증: 빨강
                    : 'rgba(249, 115, 22, 0.12)';  // 급감: 주황
                  ctx.fillRect(startX, u.bbox.top, regionWidth, u.bbox.height);

                  // 상단 라벨
                  ctx.fillStyle = anomaly.type === 'spike' ? '#ef4444' : '#f97316';
                  ctx.font = '10px sans-serif';
                  ctx.textAlign = 'left';
                  const label = `이상 ${anomaly.maxDeviation.toFixed(1)}x`;
                  ctx.fillText(label, startX + 2, u.bbox.top + 12);
                }
                ctx.restore();
              }

              // 2. currentTime 수직선
              if (currentTime) {
                const xIdx = xLabels.findIndex((label) => {
                  const s = String(label);
                  const tIdx = s.indexOf('T');
                  const timePart = tIdx !== -1 ? s.slice(tIdx + 1, tIdx + 6) : s.slice(0, 5);
                  return timePart === currentTime;
                });
                if (xIdx !== -1) {
                  const xPos = u.valToPos(xIdx, 'x', true);
                  ctx.save();
                  ctx.strokeStyle = '#ef4444';
                  ctx.lineWidth = 2;
                  ctx.setLineDash([5, 5]);
                  ctx.beginPath();
                  ctx.moveTo(xPos, u.bbox.top);
                  ctx.lineTo(xPos, u.bbox.top + u.bbox.height);
                  ctx.stroke();
                  ctx.restore();
                }
              }

              // 3. verticalMarkers (스텝 경계선 등)
              if (verticalMarkers && verticalMarkers.length > 0) {
                ctx.save();
                for (const marker of verticalMarkers) {
                  const xIdx = xLabels.findIndex((label) => String(label) === marker.xValue);
                  if (xIdx === -1) continue;
                  const xPos = u.valToPos(xIdx, 'x', true);
                  ctx.strokeStyle = marker.color;
                  ctx.lineWidth = 1.5;
                  ctx.setLineDash(marker.dashed !== false ? [4, 3] : []);
                  ctx.beginPath();
                  ctx.moveTo(xPos, u.bbox.top);
                  ctx.lineTo(xPos, u.bbox.top + u.bbox.height);
                  ctx.stroke();

                  if (marker.label) {
                    ctx.fillStyle = marker.color;
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(marker.label, xPos, u.bbox.top + 12);
                  }
                }
                ctx.restore();
              }
            },
          ],
        }),
      },
      legend: {
        show: false, // 커스텀 범례 사용
      },
      padding: [10, 16, 20, 8],
    };
  }, [series, dims, xKey, yLabel, syncKey, showLegend, currentTime, xLabels, anomalies, verticalMarkers, spanGapsProp, hiddenSeries]);

  // 직접 uPlot 인스턴스 관리 (uplot-react 대신 → React 19 호환성 보장)
  const chartTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartTargetRef.current || !sampledData || sampledData.length === 0) return;
    if (uplotData[0].length === 0) return;

    // 타겟 div 내부 정리 (StrictMode 이중 실행 대비)
    chartTargetRef.current.innerHTML = '';

    const chart = new uPlot(options, uplotData as uPlot.AlignedData, chartTargetRef.current);
    uplotRef.current = chart;

    return () => {
      chart.destroy();
      uplotRef.current = null;
    };
  }, [options, uplotData]);

  if (!sampledData || sampledData.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="flex flex-col relative w-full h-full">
      {/* 커스텀 범례 (클릭으로 시리즈 표시/숨기기) */}
      {showLegend && (
        <div className="flex items-center flex-wrap gap-3 px-2 py-1 text-xs">
          {series.map(s => {
            const isHidden = hiddenSeries.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => setHiddenSeries(prev => {
                  const next = new Set(prev);
                  if (next.has(s.key)) next.delete(s.key);
                  else next.add(s.key);
                  return next;
                })}
                className={`flex items-center gap-1.5 cursor-pointer select-none transition-opacity ${isHidden ? 'opacity-35' : 'opacity-100'} hover:opacity-75`}
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className={`text-gray-700 dark:text-gray-300 ${isHidden ? 'line-through' : ''}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {/* 차트 */}
      <div ref={chartAreaRef} className="flex-1 relative">
        {/* 블러 효과로 부드러운 전환 */}
        <div className={`
          transition-all duration-500 ease-in-out
          ${(isLoading || isProcessingZoom) ? 'blur-[2px] opacity-60' : 'blur-0 opacity-100'}
        `}>
          <div ref={chartTargetRef} />
        </div>
        {/* 플로팅 툴팁 */}
        {cursorIdx != null && cursorPos && sampledData[cursorIdx] && (
          <div
            className="absolute z-20 pointer-events-none bg-white/95 dark:bg-[#1A1A2E]/95 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-xs"
            style={{
              left: cursorPos.left + 16,
              top: Math.max(4, cursorPos.top - 20),
              maxWidth: 280,
            }}
          >
            <div className="font-semibold text-gray-700 dark:text-gray-200 mb-1.5 border-b border-gray-100 dark:border-gray-700 pb-1">
              {(() => {
                const raw = String(sampledData[cursorIdx][xKey]);
                const tIdx = raw.indexOf('T');
                return tIdx !== -1 ? raw.slice(tIdx + 1, tIdx + 9).replace(/Z$/, '') : raw;
              })()}
            </div>
            {series.map(s => {
              if (hiddenSeries.has(s.key)) return null;
              const row = sampledData[cursorIdx!];
              const val = row[s.key];
              if (val == null) return null;
              const realTime = row[`${s.key}__t`];
              return (
                <div key={s.key} className="flex items-center justify-between gap-3 py-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-gray-600 dark:text-gray-300 truncate">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {realTime && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{realTime}</span>
                    )}
                    <span className="font-mono font-semibold text-gray-800 dark:text-white">
                      {typeof val === 'number' ? val.toFixed(2) : val}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* 로딩 인디케이터 (작은 스피너만) */}
        {(isLoading || isProcessingZoom) && (
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 px-3 py-1.5 rounded-lg shadow-sm z-10">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {isProcessingZoom ? 'Zoom 처리 중...' : (loadingMessage || '로딩 중...')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

TrendChart.displayName = 'TrendChart';

export default TrendChart;
