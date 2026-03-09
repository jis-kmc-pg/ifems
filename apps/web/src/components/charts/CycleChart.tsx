import { memo, useMemo, useRef, useState, useEffect } from 'react';
import UplotReact from 'uplot-react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { COLORS } from '../../lib/constants';

interface CycleChartProps {
  data: Array<{ sec: number; ref: number; current: number; diff: number }>;
  type: 'ref' | 'current' | 'diff';
  width?: number;
  height?: number;
  onZoomChange?: (zoomRatio: number) => void; // Dynamic Resolution 지원
}

const CycleChart = memo(({ data, type, width, height, onZoomChange }: CycleChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: width || 800, height: height || 200 });
  const uplotInstanceRef = useRef<uPlot | null>(null);

  // 🔥 ResizeObserver 제거 → Window resize만 사용 (무한 루프 완전 차단)
  useEffect(() => {
    const calculateSize = () => {
      // 1. 왼쪽 싸이클 목록 패널의 높이를 기준으로 사용
      const cycleList = document.getElementById('anl004-cycle-list');
      const chartContainer = document.getElementById('anl004-chart-container');

      if (!cycleList || !chartContainer) {
        console.log(`[CycleChart ${type}] ❌ 패널을 찾지 못함, 기본값 사용`);
        return {
          width: width || 1200,
          height: height || 250,
        };
      }

      // 왼쪽 패널과 오른쪽 차트 컨테이너는 같은 높이 (h-full)
      const containerRect = chartContainer.getBoundingClientRect();
      const containerHeight = containerRect.height;

      // 2. gap-2 (8px * 2 = 16px) 제외하고 3으로 나누기
      const gapTotal = 16; // gap-2: 8px between 3 cards
      const perCardHeight = (containerHeight - gapTotal) / 3;

      // 3. ChartCard header 높이 구하기
      const parent = containerRef.current?.parentElement; // ChartCard content
      const chartCard = parent?.parentElement; // ChartCard 최상위

      let headerHeight = 25; // 기본값: py-3 (24px) + border (1px)
      if (chartCard) {
        const header = chartCard.querySelector('.border-b');
        if (header) {
          headerHeight = (header as HTMLElement).getBoundingClientRect().height;
        }
      }

      // 4. ChartCard content padding 구하기
      const parentStyles = parent ? window.getComputedStyle(parent) : null;
      const paddingTop = parentStyles ? parseFloat(parentStyles.paddingTop) : 14.25;
      const paddingBottom = parentStyles ? parseFloat(parentStyles.paddingBottom) : 14.25;
      const totalPadding = paddingTop + paddingBottom;

      // 5. 차트 너비 계산 (부모 너비 사용)
      const parentWidth = parent ? parent.getBoundingClientRect().width : 1200;
      const paddingLeft = parentStyles ? parseFloat(parentStyles.paddingLeft) : 14.25;
      const paddingRight = parentStyles ? parseFloat(parentStyles.paddingRight) : 14.25;
      const chartWidth = Math.floor(parentWidth - paddingLeft - paddingRight);

      // 6. 최종 차트 높이 계산
      const chartHeight = Math.floor(perCardHeight - headerHeight - totalPadding);

      console.log(`[CycleChart ${type}] 📐 정확한 계산:`, {
        '3패널 컨테이너 전체 높이': containerHeight,
        'gap 총합': gapTotal,
        'ChartCard당 할당 높이': perCardHeight,
        'header 높이': headerHeight,
        'content padding': totalPadding,
        'content 너비': parentWidth,
        '최종 차트 너비': chartWidth,
        '최종 차트 높이': chartHeight,
      });

      return {
        width: width || chartWidth,
        height: height || chartHeight || 250,
      };
    };

    // 초기 크기 설정 (flex 레이아웃 완성 대기)
    setTimeout(() => {
      const size = calculateSize();
      console.log(`[CycleChart ${type}] 📏 Initial dims:`, size);
      setDims(size);
    }, 150);

    // Window resize 이벤트만 사용 (창 크기 변경 시에만 반응)
    const handleResize = () => {
      const size = calculateSize();
      console.log(`[CycleChart ${type}] 📐 Resize dims:`, size);
      setDims(size);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height, type]);

  // uPlot 데이터 형식: [[x축], [y축]]
  const uplotData = useMemo(() => {
    if (!data || data.length === 0) return [[], []];

    const xData = data.map(d => d.sec);
    let yData: number[];

    if (type === 'ref') {
      yData = data.map(d => d.ref);
    } else if (type === 'current') {
      yData = data.map(d => d.current);
    } else {
      yData = data.map(d => d.diff);
    }

    return [xData, yData];
  }, [data, type]);

  // uPlot 옵션 설정
  const options = useMemo((): uPlot.Options => {
    const isDiff = type === 'diff';

    return {
      width: dims.width - 40,
      height: dims.height,
      scales: {
        x: {
          time: false,
          // 양쪽 끝에 여유 공간 추가
          range: (u, dataMin, dataMax) => {
            const paddingLeft = 0.5;
            const paddingRight = 1.0;
            return [dataMin - paddingLeft, dataMax + paddingRight];
          },
        },
        y: {
          auto: true,
        },
      },
      hooks: {
        init: [
          (u) => {
            uplotInstanceRef.current = u;
          },
        ],
        setScale: [
          (u, key) => {
            if (key === 'x' && onZoomChange) {
              const xScale = u.scales.x;
              const xRange = xScale.max! - xScale.min!;
              const xDataRange = u.data[0][u.data[0].length - 1] - u.data[0][0];
              const zoomRatio = xDataRange / xRange;

              // zoomRatio 변화가 유의미할 때만 콜백 호출
              if (Math.abs(zoomRatio - 1) > 0.01) {
                onZoomChange(zoomRatio);
              }
            }
          },
        ],
      },
      series: [
        {
          label: 'Time (s)',
        },
        {
          label: type === 'ref' ? '기준' : type === 'current' ? '비교' : '차이',
          stroke: type === 'ref'
            ? 'rgba(156,163,175,0.8)'
            : type === 'current'
              ? COLORS.chart.purple
              : COLORS.danger,
          width: isDiff ? 1 : 2,
          fill: isDiff ? COLORS.danger + '40' : undefined,
          paths: isDiff ? uPlot.paths.bars!({ size: [0.8, 100] }) : undefined,
          points: {
            show: false,
          },
        },
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
          font: '9px sans-serif',
        },
        {
          label: 'Power (kW)',
          grid: {
            show: true,
            stroke: '#f0f0f0',
            width: 1,
          },
          ticks: {
            show: true,
            size: 5,
          },
          font: '9px sans-serif',
        },
      ],
      cursor: {
        show: true,
        drag: {
          x: true,
          y: false,
        },
        sync: {
          key: 'anl004-cycle', // 3개 차트 커서 동기화
        },
      },
      legend: {
        show: true,
        live: true,
      },
      padding: [10, 16, 20, 8],
    };
  }, [type, dims]);

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full" style={{ height: `${dims.height}px`, overflow: 'hidden' }}>
      <UplotReact options={options} data={uplotData} />
    </div>
  );
});

CycleChart.displayName = 'CycleChart';

export default CycleChart;
