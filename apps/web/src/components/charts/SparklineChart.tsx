import { memo, useMemo } from 'react';

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color: string;
  showArea?: boolean;
  strokeWidth?: number;
  className?: string;
}

const SparklineChart = memo(function SparklineChart({
  data,
  width = 80,
  height = 24,
  color,
  showArea = false,
  strokeWidth = 1.5,
  className,
}: SparklineChartProps) {
  const { linePoints, areaPoints } = useMemo(() => {
    if (data.length < 2) {
      const mid = height / 2;
      return {
        linePoints: `0,${mid} ${width},${mid}`,
        areaPoints: `0,${mid} ${width},${mid} ${width},${height} 0,${height}`,
      };
    }

    const pad = strokeWidth;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return {
      linePoints: pts.join(' '),
      areaPoints: `${pts.join(' ')} ${width},${height} 0,${height}`,
    };
  }, [data, width, height, strokeWidth]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ display: 'block' }}
    >
      {showArea && (
        <polygon
          points={areaPoints}
          fill={color}
          fillOpacity={0.15}
        />
      )}
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

export default SparklineChart;
