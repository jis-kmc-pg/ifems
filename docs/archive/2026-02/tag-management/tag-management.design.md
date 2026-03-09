# 태그 관리 시스템 설계서 (Tag Management System Design)

## 📋 목차
1. [개요](#개요)
2. [현재 데이터 분석](#현재-데이터-분석)
3. [계층 구조 설계](#계층-구조-설계)
4. [데이터베이스 스키마](#데이터베이스-스키마)
5. [태그 명명 규칙](#태그-명명-규칙)
6. [설정 화면 구성](#설정-화면-구성)
7. [API 엔드포인트](#api-엔드포인트)
8. [데이터 마이그레이션 계획](#데이터-마이그레이션-계획)

---

## 개요

### 목적
화성 PT4 공장의 모든 설비와 태그를 계층적으로 관리하여, 에너지 관리 시스템의 데이터 구조를 명확히 하고 가독성을 높인다.

### 범위
- 공장(Factory) → 라인(Line) → 설비(Facility) → 태그(Tag) 4단계 계층 구조
- 총 3,107개 태그 관리
- 태그 표시명 매핑 (TAG_NAME → Display Name)
- 계층별 CRUD 관리 화면

---

## 현재 데이터 분석

### Excel 파일: `화성PT4공장_TagList.xlsx`

**전체 데이터 현황:**
- 총 행 수: 3,448행
- 헤더: 8행
- 데이터 행: 3,440행

**계층 분포 (USE_YN=1 기준):**
```
DEPTH 0 (공장):     1개   - hw4 (4공장)
DEPTH 1 (라인):     4개   - BLOCK, HEAD, CRANK, ASSEMBLE
DEPTH 2 (설비):   325개   - HNK10-010-1, HNK20-010-A 등
DEPTH 3 (태그):  3,107개  - 실제 센서 태그
```

**데이터 타입 분포:**
```
DATA_TYPE G (Group/설비):   328개
DATA_TYPE T (Trend):      1,575개
DATA_TYPE Q (Quality):    1,532개
```

**에너지 타입 분포:**
```
ENERGY_TYPE elec (전력): 2,307개
ENERGY_TYPE air (에어):    800개
```

**태그 타입 분포:**
```
TAG_TYPE TREND:  2,547개
TAG_TYPE USAGE:    530개
TAG_TYPE SENSOR:    30개
```

**현재 DB 상태:**
- ✅ Factory: Excel 데이터 없음 (코드로 정의)
- ✅ Line: Excel 데이터 없음 (enum으로 정의)
- ✅ Facility: 325개 (DEPTH=2, DATA_TYPE=G, USE_YN=1)
- ❌ Tag: 0개 (DEPTH=3 데이터 미적용)

---

## 계층 구조 설계

### 1. Factory (공장)
```
hw4 (4공장 - 화성PT4공장)
```

**속성:**
- `code`: 공장 코드 (예: hw4)
- `name`: 공장명 (예: 4공장)
- `fullName`: 전체 이름 (예: 화성PT4공장)
- `location`: 위치 정보

### 2. Line (라인/공정)
```
BLOCK    (블록)
HEAD     (헤드)
CRANK    (크랑크)
ASSEMBLE (조립)
```

**속성:**
- `code`: 라인 코드 (BLOCK, HEAD, CRANK, ASSEMBLE)
- `name`: 라인명 (블록, 헤드, 크랑크, 조립)
- `factoryCode`: 소속 공장 코드
- `order`: 표시 순서

### 3. Facility (설비)
**현재 상태:** ✅ 325개 DB 적재 완료

**예시:**
```
HNK10-010-1 (BLOCK 라인)
HNK20-010-A (HEAD 라인)
HNK30-005   (CRANK 라인)
HNK00-010   (ASSEMBLE 라인)
```

**속성:**
- `id`: UUID
- `code`: 설비 코드 (HNK10-010-1)
- `name`: 설비명 (HNK10-010-1)
- `line`: 소속 라인 (BLOCK, HEAD, CRANK, ASSEMBLE)
- `process`: 공정명 (OP0 등)
- `type`: 설비 유형 (MC 등)
- `status`: 가동 상태 (NORMAL, WARNING, DANGER, OFFLINE)
- `isProcessing`: 가동 여부

### 4. Tag (태그)
**현재 상태:** ❌ 3,107개 미적재

**예시 구조:**
```
Facility: HNK10-010-1
  ├── Tag: HNK10_010_1_POWER_1      (전력 사용량)
  ├── Tag: HNK10_010_1_AIR_1        (에어 사용량)
  ├── Tag: HNK10_010_1_TEMP_1       (온도)
  └── Tag: HNK10_010_1_STATUS_1     (가동 상태)
```

**속성:**
- `id`: UUID
- `facilityId`: 소속 설비 ID (FK)
- `tagName`: 태그 전체 이름 (HNK10_010_1_POWER_1)
- `displayName`: UI 표시명 (전력 사용량)
- `tagType`: 태그 타입 (TREND, USAGE, SENSOR)
- `energyType`: 에너지 타입 (elec, air)
- `dataType`: 데이터 타입 (T, Q)
- `unit`: 단위 (kWh, m³, ℃ 등)
- `order`: 표시 순서

---

## 데이터베이스 스키마

### Prisma Schema 추가

```prisma
// 공장 (Factory)
model Factory {
  id        String   @id @default(uuid())
  code      String   @unique // hw4
  name      String   // 4공장
  fullName  String?  // 화성PT4공장
  location  String?  // 경기도 화성시
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  lines Line[]
}

// 라인 (Line)
model Line {
  id          String   @id @default(uuid())
  code        String   @unique // BLOCK, HEAD, CRANK, ASSEMBLE
  name        String   // 블록, 헤드, 크랑크, 조립
  factoryId   String
  factory     Factory  @relation(fields: [factoryId], references: [id], onDelete: Cascade)
  order       Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  facilities Facility[]

  @@index([factoryId])
}

// 설비 (Facility) - 기존 모델 확장
model Facility {
  id           String         @id @default(uuid())
  code         String         @unique
  name         String
  lineId       String         // Line 테이블과 연결
  line         Line           @relation(fields: [lineId], references: [id], onDelete: Cascade)
  process      String?
  type         String         // 설비 유형 (MC 등)
  status       FacilityStatus @default(NORMAL)
  isProcessing Boolean        @default(true)
  latitude     Float?
  longitude    Float?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  tags         Tag[]
  energyData   EnergyData[]

  @@index([lineId])
  @@index([status])
}

// 태그 (Tag) - 신규 모델
model Tag {
  id          String    @id @default(uuid())
  facilityId  String
  facility    Facility  @relation(fields: [facilityId], references: [id], onDelete: Cascade)
  tagName     String    @unique // HNK10_010_1_POWER_1
  displayName String    // 전력 사용량
  tagType     TagType   // TREND, USAGE, SENSOR
  energyType  EnergyType? // elec, air
  dataType    DataType  // T (Trend), Q (Quality)
  unit        String?   // kWh, m³, ℃
  order       Int       @default(0)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([facilityId])
  @@index([tagType])
  @@index([energyType])
}

// Enum: 태그 타입
enum TagType {
  TREND   // 추세 데이터
  USAGE   // 사용량 데이터
  SENSOR  // 센서 데이터
}

// Enum: 에너지 타입
enum EnergyType {
  elec    // 전력
  air     // 에어
}

// Enum: 데이터 타입
enum DataType {
  T       // Trend
  Q       // Quality
}
```

### 마이그레이션 전략

**Phase 1: 테이블 생성**
- Factory, Line, Tag 모델 추가
- Facility 모델에 lineId 필드 추가 (line enum → Line 테이블 참조로 변경)

**Phase 2: 데이터 마이그레이션**
- Factory 데이터 생성 (hw4)
- Line 데이터 생성 (BLOCK, HEAD, CRANK, ASSEMBLE)
- 기존 Facility의 line enum → lineId 변환
- Tag 데이터 3,107개 적재

---

## 태그 명명 규칙

### 태그명 패턴
```
{FACILITY_CODE}_{METRIC}_{NUMBER}

예시:
- HNK10_010_1_POWER_1  → HNK10-010-1 설비의 전력 사용량 #1
- HNK20_010_A_AIR_1    → HNK20-010-A 설비의 에어 사용량 #1
- HNK30_005_TEMP_1     → HNK30-005 설비의 온도 센서 #1
```

### 표시명 매핑 (Tag Master)
| tagName | displayName | tagType | energyType |
|---------|-------------|---------|------------|
| HNK10_010_1_POWER_1 | 전력 사용량 | TREND | elec |
| HNK10_010_1_AIR_1 | 에어 사용량 | TREND | air |
| HNK10_010_1_TEMP_1 | 온도 | SENSOR | - |
| HNK10_010_1_STATUS_1 | 가동 상태 | USAGE | - |

### 단위 표준
- 전력: kWh (킬로와트시)
- 에어: m³ (세제곱미터)
- 온도: ℃ (섭씨)
- 상태: - (무차원)

---

## 설정 화면 구성

### SET-008: 공장 관리 (Factory Management)
**URL:** `/settings/factory`

**기능:**
- 공장 목록 조회
- 공장 추가/수정/삭제
- 공장별 라인 현황 표시

**필드:**
- 공장 코드 (code)
- 공장명 (name)
- 전체 이름 (fullName)
- 위치 (location)
- 활성 여부 (isActive)

### SET-009: 라인 설정 (Line Settings)
**URL:** `/settings/line`

**기능:**
- 라인 목록 조회 (공장별 필터링)
- 라인 추가/수정/삭제
- 라인별 설비 현황 표시

**필드:**
- 라인 코드 (code)
- 라인명 (name)
- 소속 공장 (factoryId)
- 표시 순서 (order)
- 활성 여부 (isActive)

### SET-010: 설비 마스터 관리 (Facility Master)
**URL:** `/settings/facility-master` (기존 화면 확장)

**기능:**
- 설비 목록 조회 (라인별, 유형별 필터링)
- 설비 추가/수정/삭제
- 설비별 태그 현황 표시

**필드:**
- 설비 코드 (code)
- 설비명 (name)
- 소속 라인 (lineId)
- 공정 (process)
- 설비 유형 (type)
- 가동 상태 (status)
- 위치 정보 (latitude, longitude)

### SET-011: 설비 유형 관리 (Facility Type Settings)
**URL:** `/settings/facility-type`

**기능:**
- 설비 유형 목록 조회
- 유형 추가/수정/삭제
- 유형별 설비 개수 표시

**필드:**
- 유형 코드 (code)
- 유형명 (name)
- 설명 (description)
- 아이콘/색상 (icon, color)

### SET-012: 태그 마스터 관리 (Tag Master Management)
**URL:** `/settings/tag-master`

**기능:**
- 태그 목록 조회 (설비별, 태그타입별, 에너지타입별 필터링)
- 태그 추가/수정/삭제
- 태그명 ↔ 표시명 매핑 관리
- 일괄 등록 (Excel 업로드)

**필드:**
- 태그명 (tagName)
- 표시명 (displayName)
- 소속 설비 (facilityId)
- 태그 타입 (tagType)
- 에너지 타입 (energyType)
- 데이터 타입 (dataType)
- 단위 (unit)
- 표시 순서 (order)

### SET-013: 태그 계층 관리 (Tag Hierarchy)
**URL:** `/settings/tag-hierarchy`

**기능:**
- 전체 계층 구조 시각화 (Tree View)
- 공장 → 라인 → 설비 → 태그 드릴다운
- 계층별 통계 표시
- 태그 할당 및 재배치

**화면 구성:**
```
공장 (1)
└── hw4 (4공장)
    ├── BLOCK (92개 설비, 약 900개 태그)
    │   ├── HNK10-010-1 (10개 태그)
    │   └── ...
    ├── HEAD (101개 설비, 약 1,000개 태그)
    ├── CRANK (82개 설비, 약 800개 태그)
    └── ASSEMBLE (50개 설비, 약 400개 태그)
```

---

## API 엔드포인트

### Factory API
```typescript
GET    /api/settings/factory              // 공장 목록
POST   /api/settings/factory              // 공장 생성
PUT    /api/settings/factory/:id          // 공장 수정
DELETE /api/settings/factory/:id          // 공장 삭제
```

### Line API
```typescript
GET    /api/settings/line                 // 라인 목록
GET    /api/settings/line?factoryId=xxx   // 공장별 라인
POST   /api/settings/line                 // 라인 생성
PUT    /api/settings/line/:id             // 라인 수정
DELETE /api/settings/line/:id             // 라인 삭제
```

### Facility API (기존 확장)
```typescript
GET    /api/settings/facility-master                  // 설비 목록
GET    /api/settings/facility-master?lineId=xxx       // 라인별 설비
GET    /api/settings/facility-master/:id/tags         // 설비별 태그
POST   /api/settings/facility-master                  // 설비 생성
PUT    /api/settings/facility-master/:id              // 설비 수정
DELETE /api/settings/facility-master/:id              // 설비 삭제
```

### Facility Type API
```typescript
GET    /api/settings/facility-type        // 유형 목록
POST   /api/settings/facility-type        // 유형 생성
PUT    /api/settings/facility-type/:id    // 유형 수정
DELETE /api/settings/facility-type/:id    // 유형 삭제
```

### Tag API
```typescript
GET    /api/settings/tag                  // 태그 목록
GET    /api/settings/tag?facilityId=xxx   // 설비별 태그
GET    /api/settings/tag?tagType=TREND    // 타입별 태그
POST   /api/settings/tag                  // 태그 생성
POST   /api/settings/tag/bulk             // 일괄 생성 (Excel)
PUT    /api/settings/tag/:id              // 태그 수정
DELETE /api/settings/tag/:id              // 태그 삭제
```

### Hierarchy API
```typescript
GET    /api/settings/hierarchy            // 전체 계층 구조
GET    /api/settings/hierarchy/factory/:factoryId  // 공장 계층
GET    /api/settings/hierarchy/line/:lineId        // 라인 계층
GET    /api/settings/hierarchy/facility/:facilityId // 설비 계층
```

---

## 데이터 마이그레이션 계획

### Step 1: 스키마 마이그레이션
```bash
# Prisma 스키마 업데이트
pnpm prisma migrate dev --name add_tag_management

# 생성 파일:
# - Factory 테이블
# - Line 테이블
# - Tag 테이블
# - TagType, EnergyType, DataType enum
```

### Step 2: 기초 데이터 적재
```typescript
// seed.ts 추가
async function seedTagManagement() {
  // 1. Factory 생성
  const factory = await prisma.factory.create({
    data: {
      code: 'hw4',
      name: '4공장',
      fullName: '화성PT4공장',
      location: '경기도 화성시',
    },
  });

  // 2. Line 생성
  const lines = await Promise.all([
    prisma.line.create({
      data: {
        code: 'BLOCK',
        name: '블록',
        factoryId: factory.id,
        order: 1,
      },
    }),
    prisma.line.create({
      data: {
        code: 'HEAD',
        name: '헤드',
        factoryId: factory.id,
        order: 2,
      },
    }),
    prisma.line.create({
      data: {
        code: 'CRANK',
        name: '크랑크',
        factoryId: factory.id,
        order: 3,
      },
    }),
    prisma.line.create({
      data: {
        code: 'ASSEMBLE',
        name: '조립',
        factoryId: factory.id,
        order: 4,
      },
    }),
  ]);

  // 3. 기존 Facility의 lineId 업데이트
  const lineMap = {
    BLOCK: lines[0].id,
    HEAD: lines[1].id,
    CRANK: lines[2].id,
    ASSEMBLE: lines[3].id,
  };

  // ... lineId 업데이트 로직
}
```

### Step 3: 태그 데이터 추출 및 적재
```bash
# Excel에서 DEPTH=3 태그 추출
node extract_tags.js

# 출력: tags_3107.json
# 형식:
# {
#   "tagName": "HNK10_010_1_POWER_1",
#   "facilityCode": "HNK10_010_1",
#   "tagType": "TREND",
#   "energyType": "elec",
#   "dataType": "T"
# }
```

### Step 4: 데이터 검증
```typescript
// 검증 스크립트
async function validateTagData() {
  const factoryCount = await prisma.factory.count();
  const lineCount = await prisma.line.count();
  const facilityCount = await prisma.facility.count();
  const tagCount = await prisma.tag.count();

  console.log('Validation Results:');
  console.log('- Factories:', factoryCount, '(expected: 1)');
  console.log('- Lines:', lineCount, '(expected: 4)');
  console.log('- Facilities:', facilityCount, '(expected: 325)');
  console.log('- Tags:', tagCount, '(expected: 3,107)');
}
```

---

## 구현 우선순위

### Phase 1: 기본 구조 (1-2일)
- ✅ Prisma 스키마 업데이트
- ✅ Factory, Line, Tag 모델 추가
- ✅ 마이그레이션 및 Seed 스크립트

### Phase 2: Backend API (2-3일)
- ✅ Factory CRUD API
- ✅ Line CRUD API
- ✅ Tag CRUD API
- ✅ Hierarchy API

### Phase 3: Frontend 화면 (3-4일)
- ✅ SET-008: 공장 관리
- ✅ SET-009: 라인 설정
- ✅ SET-012: 태그 마스터
- ✅ SET-013: 태그 계층

### Phase 4: 데이터 적재 (1일)
- ✅ TagList.xlsx에서 3,107개 태그 추출
- ✅ 일괄 적재 스크립트
- ✅ 데이터 검증

### Phase 5: 통합 테스트 (1일)
- ✅ 전체 계층 조회 테스트
- ✅ CRUD 동작 검증
- ✅ 성능 테스트 (3,107개 태그 조회 속도)

---

## 예상 이슈 및 대응

### 1. 기존 Facility line enum 변경
**문제:** Facility.line이 enum에서 FK로 변경되어 Breaking Change 발생

**대응:**
- Migration script에서 기존 enum 값을 Line 테이블 ID로 자동 변환
- 롤백 스크립트 준비

### 2. 대량 태그 데이터 조회 성능
**문제:** 3,107개 태그 조회 시 성능 저하 가능

**대응:**
- 페이지네이션 적용 (limit/offset)
- 인덱스 최적화 (facilityId, tagType, energyType)
- 가상 스크롤링 (Frontend)

### 3. 태그명 중복 방지
**문제:** 동일 tagName 중복 등록

**대응:**
- DB unique constraint (tagName)
- Frontend validation

### 4. Excel 데이터 파싱 오류
**문제:** Excel 행 파싱 시 타입 불일치

**대응:**
- String() 변환 강제 적용
- 파싱 오류 로그 상세 출력

---

## 다음 단계

1. ✅ 태그 추출 스크립트 작성 (`extract_tags.js`)
2. ⏳ Prisma 스키마 업데이트
3. ⏳ 마이그레이션 실행
4. ⏳ Backend API 구현
5. ⏳ Frontend 화면 구현
6. ⏳ 데이터 적재 및 검증

---

**작성일:** 2026-02-23
**작성자:** Claude (Sonnet 4.5)
**버전:** 1.0
