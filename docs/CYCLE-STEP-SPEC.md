# CYCLE-STEP 데모 데이터 생성 스펙

## 1. 테이블 구조

### CYCLE_STD_MST_MMS (싸이클)
| 컬럼 | 타입 | 데모 규칙 |
|------|------|-----------|
| MACH_ID | integer | CYCLE_MMS_MAPPING 테이블 참조. i-FEMS facilities와 직접 매칭 안 됨 → 자체 정수 시퀀스 생성 (설비 UUID → 순번) |
| TAG_NAME | varchar(50) | i-FEMS tags에서 `measureType='INSTANTANEOUS' AND category='ENERGY'` 인 트렌드 태그명 |
| MATERIAL_ID | varchar(50) | 고유 ID 생성 (포맷 자유, 단 STEP과 매핑 키) |
| CYCLE_NM | varchar(50) | **MATERIAL_ID와 동일** |
| START_DT | varchar(50) | 싸이클 시작 시각 (예: "2026-03-10 14:30:05.123") |
| END_DT | varchar(50) | 싸이클 종료 시각 |
| DIFF_DESC | integer | 싸이클 소요시간 (밀리초). END_DT - START_DT |
| STAND_YN | integer | 3=초기, 2=이상확인, 1=기준싸이클 (설비+태그당 1개) |
| U_ENERGY | numeric | DTW 채울 때 함께 **0~100 랜덤** 입력 |
| PERSON | numeric | **NULL** |
| DTW | numeric | 초기 NULL → 다음 배치에서 유사도 값 채움 |
| CYCLE_DELAY | integer | **0~100 랜덤** |
| SAVE_DT | varchar(50) | 저장 시각 (매시 :24분) |
| OFFSET | integer | **NULL** |
| OFFSET_YN | integer | **NULL** |
| MODEL_ID | integer | 제품 모델. **1, 2, 28, 50, 60** 중 돌아가며 사용 |

### STEP_STD_MST_MMS (스텝)
| 컬럼 | 타입 | 데모 규칙 |
|------|------|-----------|
| MACH_ID | integer | 소속 CYCLE과 동일 |
| TAG_NAME | varchar(50) | 소속 CYCLE과 동일 |
| MATERIAL_ID | varchar(50) | 소속 CYCLE과 동일 (매핑 키!) |
| STEP_SEQ | integer | 순차 번호 (0, 1, 2, 3...) — **의미 없음** |
| START_DT | varchar(50) | **반드시 CYCLE.START_DT 이상** |
| END_DT | varchar(50) | **반드시 CYCLE.END_DT 이하** |
| DIFF_SEC | integer | **NULL** — 의미 없음 |
| SAVE_DT | varchar(50) | CYCLE과 동일 시각 |
| MODEL_ID | integer | 소속 CYCLE과 동일 |

## 2. 핵심 규칙

### 대상 태그
- i-FEMS `tags` 테이블에서 `measureType='INSTANTANEOUS' AND category='ENERGY' AND isActive=true`
- **"태그정보 트렌드로 정해진것을 쓴다"**
- 설비당 KW, AMS, FL 등 **모든 트렌드 태그**가 대상 (여러 개 가능)
- 패턴: KW → elec, FL → air, AMS → air (에머슨 장비, 유량 측정)

### CYCLE-STEP 관계
- CYCLE(1) : STEP(N) → 조인키: `MATERIAL_ID + MACH_ID + TAG_NAME + MODEL_ID`
- **STEP 시간은 반드시 CYCLE 시간 범위 내** (전제조건)
  - `STEP.START_DT >= CYCLE.START_DT`
  - `STEP.END_DT <= CYCLE.END_DT`

### 싸이클 시간 규칙 (설비 단위)
- **싸이클 시간은 설비 기준**으로 결정됨 (태그별이 아님)
- 같은 설비의 모든 태그는 **동일한 싸이클 시간**을 공유
- 같은 설비의 싸이클은 **거의 일률적**인 duration을 가짐
  - 기준 싸이클(STAND_YN=1) duration ± ~10% 범위 내
  - 예: 기준 14분 → 실제 13~15분 범위
- **싸이클 간 간격**: 약 5~10초 (이전 싸이클 END → 다음 싸이클 START)
- 설비별 baseDuration 결정: CYCLE_STD_MST_MMS의 MACH_ID별 평균 DIFF_DESC → CYCLE_MMS_MAPPING(TAG_NAME) → facilities 연결. 매핑 안 되는 설비는 전체 중앙값(139초) 사용
- 스텝 시간은 해당 싸이클 시간을 균등 분할

### STAND_YN 라이프싸이클
1. 최초 진입: `STAND_YN=3`, `DTW=NULL`
2. DTW 계산 후: `STAND_YN=3`, `DTW=값` (확인됨)
3. 이상 판정: `STAND_YN=2`, `DTW=값`
4. 기준 싸이클: `STAND_YN=1` — **설비+태그 조합당 1개** (나중에 설정 UI에서 등록/수정)

### 배치 패턴
- **1시간마다** 1시간치 데이터 입력
- SAVE_DT: 매시 :24분 (예: "2026-03-10 14:24:00")
- 배치당 약 300~500 CYCLE 레코드

### MACH_ID 매핑 (CYCLE_MMS_MAPPING — 현장 DB 호환)
- **`CYCLE_MMS_MAPPING` 테이블** — 현장 205 DB와 동일 구조 유지
  - `MACH_ID` (integer) — 설비 정수 ID
  - `TAG_NAME` (varchar) — 트렌드 태그명
  - `PLANT_CD` (varchar) — 공장 코드
  - `LINE_CD` (varchar) — 라인 코드
  - `MCN_CD` (varchar) — 설비 코드
  - `ENERGY_TYPE` (varchar) — elec/air
  - `TARGET_YN` (integer) — 싸이클 감시 대상 여부 (1=대상)
  - `SAVE_DT` (varchar)
  - PK: (MACH_ID, TAG_NAME)
- **원본**: 205 DB에서 495건 복사 완료 (TAG_NAME 전부 i-FEMS tags와 매칭)
- **확장**: 미매핑 272개 트렌드 태그 자동 추가 (MACH_ID 1000번대~, MCN_CD = facilities.code)
- **설정 UI**: SET 화면에서 매핑 조회/수정 가능
- **현장 배포 시**: 이 테이블을 현장 CYCLE_MMS_MAPPING으로 교체하면 이질감 없이 연동

### 데이터 볼륨 (전 설비 기준)
- **325개 설비** (트렌드 태그 보유), **767개 트렌드 태그**
- 설비당 태그 분포: 1개(28), 2개(220), 3개(33), 4개(29), 5개(10), 6개(1), 7개(4)
- 설비당 평균 2.4개 태그
- 싸이클당 중앙값 139초, STEP 3~8개
- 매 배치(1시간): 767태그 × ~2 싸이클/태그 = **약 1,000~1,500 CYCLE** + 각 STEP
- MODEL_ID: 1, 2, 28, 50, 60 순환
