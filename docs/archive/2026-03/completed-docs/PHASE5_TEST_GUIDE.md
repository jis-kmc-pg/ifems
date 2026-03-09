# Phase 5: 통합 테스트 가이드

## 🎯 테스트 목표
동적 차트 해상도 기능이 설계 문서대로 정상 동작하는지 검증

## 🖥️ 테스트 환경
- **서버**: http://localhost:3202
- **페이지**: 모니터링 > 라인별 상세 현황 (MON002)
- **모드**: VITE_USE_MOCK=true (Mock 데이터)

## ✅ 테스트 체크리스트

### 1. 기본 화면 확인
- [ ] MON002 페이지 접근 성공
- [ ] 전력/에어 차트 2개 정상 표시
- [ ] 🚀 동적 해상도 토글 버튼 표시
- [ ] 토글 OFF 상태: "표시단위" 드롭다운 (1초~시간별)
- [ ] 토글 ON 상태: "시작 Interval" 드롭다운 (15분/1분)

### 2. 동적 해상도 활성화 (15분 시작)
- [ ] 토글 ON + "15분 (Level 0~3)" 선택
- [ ] PageHeader description: "동적 해상도 활성화 (현재: 15분)"
- [ ] 차트 subtitle: "동적 해상도: 15분 • Zoom하면 자동 전환"
- [ ] 초기 데이터 로딩 완료 (전력/에어 각각)

### 3. Zoom Level 전환 테스트
| Zoom Ratio | Expected Interval | 확인 방법 |
|-----------|------------------|----------|
| 100% → 50% | 15분 → 1분 | subtitle 변경, 로딩 오버레이 |
| 50% → 10% | 1분 → 10초 | subtitle "10초", 로딩 중 표시 |
| 10% → 2% | 10초 → 1초 | subtitle "1초", 최대 해상도 |

#### 각 전환 시 확인사항:
- [ ] subtitle에 새로운 interval 표시
- [ ] 로딩 오버레이 표시: 회색 배경 + 스피너 + "X 데이터 로딩 중..."
- [ ] 로딩 완료 후 더 많은 데이터 포인트 표시
- [ ] 브라우저 콘솔에 로그: `[useDynamicResolution] Interval 전환: ...`

### 4. Network 요청 확인 (F12 > Network 탭)
```
예상 API 호출:
GET /api/facilities/block-power/power/range?startTime=2026-02-27T00:00:00Z&endTime=2026-02-27T23:59:59Z&interval=15m
GET /api/facilities/block-power/power/range?startTime=2026-02-27T00:00:00Z&endTime=2026-02-27T23:59:59Z&interval=1m
GET /api/facilities/block-power/power/range?startTime=2026-02-27T00:00:00Z&endTime=2026-02-27T23:59:59Z&interval=10s
GET /api/facilities/block-power/power/range?startTime=2026-02-27T00:00:00Z&endTime=2026-02-27T23:59:59Z&interval=1s
```

- [ ] API 호출 URL에 올바른 interval 파라미터 포함
- [ ] 응답 데이터에 metadata.interval 포함
- [ ] 응답 데이터에 metadata.totalPoints 포함
- [ ] 동일한 요청 60초 내 중복 호출 안 됨 (SWR dedupingInterval)

### 5. 1분 시작 모드 테스트
- [ ] "시작 Interval"을 "1분 (Level 1~3)"로 변경
- [ ] 초기 로딩: "동적 해상도: 1분"
- [ ] Zoom 시 1분 → 10초 → 1초로만 전환 (15분 건너뜀)
- [ ] Level 0 (15분)에 접근 안 됨 확인

### 6. 리셋 및 경계 테스트
- [ ] 차트 더블클릭 → 전체 범위로 복귀
- [ ] subtitle이 초기 interval로 복귀 (15분 or 1분)
- [ ] 빠르게 여러 번 줌 → 디바운싱(500ms) 동작 확인
- [ ] 콘솔에 "[useDynamicResolution] Zoom in progress, skipping" 없음 (무한 루프 방지)

### 7. 독립성 테스트
- [ ] 전력 차트만 줌 → 에어 차트는 영향 없음
- [ ] 전력/에어 각각 다른 interval로 전환 가능
- [ ] 라인 탭 전환 (블록→헤드→크랭크) 시 각각 독립 동작

### 8. 기존 모드 호환성
- [ ] 토글 OFF → "표시단위" 드롭다운 복원
- [ ] 기존 interval (1초, 10초, 30초, 1분, ..., 시간별) 선택 가능
- [ ] 조회 버튼 클릭 시 기존 API 호출 (`getLineDetailChart`)
- [ ] 기존 모드에서 정상 차트 표시

## 🔍 예상 결과

### Mock 데이터 특징
- **전력**: 사인파 (3.5 ± 0.8 kWh), 시간에 따라 부드러운 곡선
- **에어**: 사인파 (120 ± 30 L), 전력과 유사한 패턴
- **데이터 포인트 수**:
  - 15분: 96개 (24시간 / 15분)
  - 1분: 1,440개 (24시간 / 1분)
  - 10초: 8,640개 (24시간 / 10초)
  - 1초: 86,400개 (24시간 / 1초)

### 성공 기준
✅ 모든 체크리스트 항목 통과
✅ 콘솔에 에러 없음
✅ Network 요청에 올바른 파라미터 포함
✅ 로딩 중 UI 피드백 표시
✅ Zoom에 따라 자동 interval 전환

## 🐛 문제 발생 시 디버깅

### 문제 1: Interval이 전환되지 않음
**확인사항:**
1. 브라우저 콘솔에 `[useDynamicResolution] Interval 전환:` 로그 있는지
2. `TrendChart` 컴포넌트에 `onZoomChange` props 전달되었는지
3. `handleZoom` 디바운싱 때문에 500ms 지연 있음 (정상)

**해결방법:**
```typescript
// MON002LineDetail.tsx에서 확인
onZoomChange={enableDynamicResolution ? dynamicPowerResolution.handleZoom : undefined}
```

### 문제 2: 로딩 오버레이가 표시되지 않음
**확인사항:**
1. `TrendChart`에 `isLoading` props 전달 확인
2. `useDynamicResolution`의 `isValidating` 상태 확인

**해결방법:**
```typescript
isLoading={enableDynamicResolution ? dynamicPowerResolution.isLoading : false}
loadingMessage={`${formatInterval(dynamicPowerResolution.currentInterval)} 데이터 로딩 중...`}
```

### 문제 3: API 요청이 중복 호출됨
**확인사항:**
1. SWR `dedupingInterval: 60000` 설정 확인
2. 60초 내 동일한 요청은 캐시에서 반환되어야 함

**해결방법:**
- Network 탭에서 "Disable cache" OFF 확인
- SWR 설정 확인: `useDynamicResolution.ts:54-62`

### 문제 4: 무한 루프 발생 (페이지 멈춤)
**확인사항:**
1. 콘솔에 "[useDynamicResolution] Zoom in progress, skipping" 반복 표시
2. `isZoomingRef.current` 플래그 동작 확인

**해결방법:**
- `useDynamicResolution.ts:73-76`의 useRef 로직 확인
- 이미 구현되어 있으므로 발생 안 해야 함

### 문제 5: TypeScript 오류
**확인사항:**
```bash
cd d:/AI_PJ/IFEMS
npx tsc --noEmit
```

**해결방법:**
- Phase 4에서 이미 체크 완료 (통과)

## 📊 테스트 결과 기록

### 테스트 실행 정보
- 실행일시: ____________________
- 실행자: ____________________
- 브라우저: ____________________
- 서버 포트: http://localhost:3202

### 결과 요약
- [ ] ✅ 전체 통과
- [ ] ⚠️ 일부 실패 (아래에 상세 기록)
- [ ] ❌ 테스트 불가

### 실패 항목 상세
```
[기록 공간]
```

### 성능 측정 (선택사항)
- 15분 → 1분 전환 시간: _____ ms
- 1분 → 10초 전환 시간: _____ ms
- 10초 → 1초 전환 시간: _____ ms
- API 응답 시간: _____ ms

## ➡️ 다음 단계

### Phase 5 성공 시
➡️ **Phase 6: Backend API 연동**으로 진행
- `VITE_USE_MOCK=false` 설정
- 실제 Backend API 엔드포인트 구현
- 실제 DB 데이터로 검증

### Phase 5 실패 시
🔄 해당 Phase로 돌아가서 수정
- Phase 1-4 코드 검토
- 설계 문서 재확인
- Gap Analysis 실행
