import { useEffect, useRef } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  step?: number;
  className?: string;
}

export default function RangeSlider({ min, max, value, onChange, step = 1, className = '' }: RangeSliderProps) {
  const minValRef = useRef<HTMLInputElement>(null);
  const maxValRef = useRef<HTMLInputElement>(null);
  const range = useRef<HTMLDivElement>(null);

  const [minVal, maxVal] = value;

  // 슬라이더 범위 시각화
  useEffect(() => {
    if (range.current && max > min) {
      const minPercent = ((minVal - min) / (max - min)) * 100;
      const maxPercent = ((maxVal - min) / (max - min)) * 100;
      range.current.style.left = `${minPercent}%`;
      range.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [minVal, maxVal, min, max]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = Math.min(Number(e.target.value), maxVal - step);
    onChange([newMin, maxVal]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = Math.max(Number(e.target.value), minVal + step);
    onChange([minVal, newMax]);
  };

  return (
    <div className={`relative ${className}`}>
      {/* 슬라이더 트랙 */}
      <div className="relative h-1 bg-gray-200 rounded">
        {/* 선택 범위 하이라이트 */}
        <div ref={range} className="absolute h-full bg-blue-500 rounded" />
      </div>

      {/* Min 슬라이더 */}
      <input
        ref={minValRef}
        type="range"
        min={min}
        max={max}
        step={step}
        value={minVal}
        onChange={handleMinChange}
        className="absolute top-0 w-full h-1 pointer-events-none appearance-none bg-transparent
          [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
          [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:z-10
          [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none
          [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer
          [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white
          [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:z-10"
        style={{ zIndex: minVal > max - 100 ? 5 : 3 }}
      />

      {/* Max 슬라이더 */}
      <input
        ref={maxValRef}
        type="range"
        min={min}
        max={max}
        step={step}
        value={maxVal}
        onChange={handleMaxChange}
        className="absolute top-0 w-full h-1 pointer-events-none appearance-none bg-transparent
          [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
          [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:z-10
          [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none
          [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer
          [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white
          [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:z-10"
        style={{ zIndex: 4 }}
      />

      {/* 범위 표시 레이블 */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>{minVal}</span>
        <span>{maxVal}</span>
      </div>
    </div>
  );
}
