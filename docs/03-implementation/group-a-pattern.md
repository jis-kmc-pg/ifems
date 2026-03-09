# Group A 화면 Dynamic Resolution 구현 패턴

> ANL-002 완전 구현 예시를 기반으로 나머지 7개 화면에 적용할 패턴

## 1. Import 추가

```typescript
import { SCREEN_INITIAL_INTERVAL } from '../../lib/constants';
import { useDynamicResolution } from '../../hooks/useDynamicResolution';
import { formatInterval } from '../../lib/chart-utils';
import type { Interval } from '../../types/chart';
```

## 2. 상태 추가

```typescript
// Dynamic Resolution 활성화 여부
const [enableDynamicResolution, setEnableDynamicResolution] = useState(false);
const initialInterval = (SCREEN_INITIAL_INTERVAL['SCREEN-ID'] || '15m') as Interval;
```

## 3. 기존 useQuery 수정

```typescript
// 기존 데이터 (동적 해상도 비활성화 시)
const { data: legacyData, refetch, isLoading: legacyLoading } = useQuery({
  queryKey: [...],
  queryFn: () => ...,
  enabled: !enableDynamicResolution, // ⭐ 추가
});
```

## 4. useDynamicResolution 훅 추가

```typescript
// ISO8601 시간 변환
const startTime = useMemo(() => `${date}T00:00:00Z`, [date]);
const endTime = useMemo(() => `${date}T23:59:59Z`, [date]);

// 동적 해상도 훅
const dynamicResolution = useDynamicResolution({
  initialInterval,
  startTime,
  endTime,
  facilityId: selectedFacility, // 화면별 조정
  metric: 'power', // 'power' 또는 'air'
  enabled: enableDynamicResolution,
});
```

## 5. 데이터 선택 로직

```typescript
const chartData = enableDynamicResolution ? dynamicResolution.data : legacyData;
const isLoading = enableDynamicResolution ? dynamicResolution.isLoading : legacyLoading;
const currentInterval = enableDynamicResolution ? dynamicResolution.currentInterval : initialInterval;
```

## 6. PageHeader 업데이트

```typescript
<PageHeader
  title="화면 제목"
  description={
    enableDynamicResolution
      ? `설명 | 동적 해상도: ${formatInterval(currentInterval)} (maxDepth: N)`
      : "기존 설명"
  }
/>
```

## 7. 동적 해상도 토글 추가

```typescript
<div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
  <input
    type="checkbox"
    id="dynamic-resolution-SCREEN-ID"
    checked={enableDynamicResolution}
    onChange={(e) => setEnableDynamicResolution(e.target.checked)}
    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
  />
  <label htmlFor="dynamic-resolution-SCREEN-ID" className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer select-none">
    🚀 동적 해상도
  </label>
</div>
```

## 8. TrendChart 업데이트

```typescript
<TrendChart
  data={chartData}
  series={series}
  xKey="time"
  yLabel="kWh"
  showLegend={true}
  // ⭐ Dynamic Resolution 추가
  onZoomChange={enableDynamicResolution ? dynamicResolution.handleZoom : undefined}
  isLoading={isLoading}
  loadingMessage={enableDynamicResolution ? `${formatInterval(currentInterval)} 데이터 로딩 중...` : undefined}
/>
```

## 화면별 설정값

| 화면 ID | maxDepth | initialInterval | 비고 |
|---------|----------|-----------------|------|
| MON-001 | 2 | 15m | 시간대별 트렌드 |
| ANL-002 | 3 | 15m | ✅ 완료 |
| DSH-002 | 2 | 15m | 설비별 추이 |
| ANL-001 | 2 | 15m | 비교 분석 |
| ANL-005 | 2 | 15m | 전력 품질 |
| ALT-006 | 2 | 1m | 싸이클 이상 |
| DSH-001 | 1 | 15m | 에너지 추이 |
| ALT-004 | 1 | 15m | 전력 품질 이력 |

## 체크리스트

각 화면 구현 시:

- [ ] Import 추가
- [ ] enableDynamicResolution 상태 추가
- [ ] useQuery에 `enabled: !enableDynamicResolution` 추가
- [ ] useDynamicResolution 훅 추가
- [ ] 데이터 선택 로직 추가
- [ ] PageHeader 업데이트
- [ ] 동적 해상도 토글 UI 추가
- [ ] TrendChart에 onZoomChange 추가
- [ ] TypeScript 컴파일 확인
- [ ] 브라우저 테스트
