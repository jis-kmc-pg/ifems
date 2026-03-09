# Tag Management Phase 2 구현 계획

**Feature**: tag-management-phase2
**Created**: 2026-02-23
**Priority**: High
**Estimated**: 2-3 days
**Dependencies**: tag-management (완료, Match Rate 93%)

## 📋 개요

Tag Management System의 Phase 1 완료(93% Match Rate) 이후, 사용자 편의성과 관리 효율성을 높이는 3가지 핵심 기능을 추가합니다.

## 🎯 목표

1. **설비 유형 관리 (SET-011)**: FacilityType CRUD 화면으로 설비 분류 체계 완성
2. **Tag 일괄 업로드**: Excel/CSV 파일로 수백~수천 개 태그를 한번에 등록
3. **Tag 재할당**: 설비 간 태그 이동 기능으로 재구성 지원
4. **Backend 완성**: 모든 기능에 대한 검증된 API 제공

## 📊 현재 상태

### Phase 1 완료 내역 ✅
- Factory, Line, Facility, Tag CRUD API (27+ endpoints)
- 4개 Frontend 화면 (SET-008, 009, 012, 013)
- 계층 구조 시각화 (SET-013)
- 2,794개 태그 적재 완료

### Phase 2 범위 🆕
- **SET-011**: 설비 유형 관리 (미구현)
- **Tag Bulk Upload**: 일괄 업로드 기능 (미구현)
- **Tag Reassignment**: 태그 재할당 기능 (미구현)

## 🏗️ 구현 범위

### Feature 1: 설비 유형 관리 (SET-011)

#### Backend API
- `POST /api/settings/facility-type` - 유형 생성
- `GET /api/settings/facility-type` - 유형 목록 조회
- `GET /api/settings/facility-type/:id` - 유형 상세 조회
- `PUT /api/settings/facility-type/:id` - 유형 수정
- `DELETE /api/settings/facility-type/:id` - 유형 삭제

#### Frontend (SET-011)
- 설비 유형 목록 테이블 (SortableTable)
- 추가/수정 모달 (Modal)
- 삭제 확인 모달 (ConfirmModal)
- 필터: 검색, 활성/비활성
- 페이지네이션 (50개/페이지)

#### Data Model
```typescript
interface FacilityType {
  id: string;
  code: string;          // 유형 코드 (예: MACHINING, ASSEMBLY)
  name: string;          // 유형명 (예: 가공설비, 조립설비)
  description?: string;  // 설명
  color?: string;        // UI 표시 색상 (hex)
  icon?: string;         // 아이콘 이름
  isActive: boolean;     // 활성 상태
  order: number;         // 정렬 순서
  facilityCount?: number; // 해당 유형 설비 수
  createdAt: Date;
  updatedAt: Date;
}
```

### Feature 2: Tag 일괄 업로드

#### Backend API
- `POST /api/settings/tag/bulk-upload` - 파일 업로드 및 검증
  - Multipart form-data (Excel/CSV)
  - 파일 형식 검증
  - 데이터 파싱 및 검증
  - 중복 체크
  - 일괄 삽입 (Transaction)
- `POST /api/settings/tag/validate-bulk` - 업로드 전 검증만 수행
- `GET /api/settings/tag/bulk-template` - Excel 템플릿 다운로드

#### Frontend (SET-012 확장)
- "일괄 업로드" 버튼 추가
- 파일 선택 UI (Drag & Drop 지원)
- 업로드 진행 상태 표시
- 검증 결과 테이블 (성공/실패/경고)
- 템플릿 다운로드 링크

#### Excel/CSV 형식
| facilityCode | tagName | displayName | tagType | energyType | dataType | unit | order |
|--------------|---------|-------------|---------|------------|----------|------|-------|
| HNK10-010-1 | HNK10_010_1_POWER_1 | 전력 사용량 | USAGE | elec | T | kWh | 1 |

#### 검증 규칙
1. 필수 필드: facilityCode, tagName, displayName, tagType, dataType
2. facilityCode → DB의 Facility.code와 매칭 (FK 검증)
3. tagName 중복 체크 (기존 Tag와 비교)
4. tagType enum 검증 (TREND, USAGE, SENSOR)
5. energyType enum 검증 (elec, air, null)
6. dataType enum 검증 (T, Q)
7. 최대 업로드: 5,000개/파일

### Feature 3: Tag 재할당

#### Backend API
- `POST /api/settings/tag/reassign` - 태그 재할당
  - Body: `{ tagIds: string[], targetFacilityId: string }`
  - 검증: targetFacility 존재 여부
  - 일괄 업데이트 (Transaction)
- `POST /api/settings/tag/reassign/validate` - 재할당 가능 여부 검증

#### Frontend (SET-012 확장)
- 다중 선택 체크박스 추가
- "선택한 태그 재할당" 버튼
- 재할당 모달:
  - 선택된 태그 목록 표시
  - 대상 설비 선택 드롭다운 (Factory → Line → Facility 계층 선택)
  - 재할당 사유 입력 (선택)
  - 확인/취소 버튼

#### 검증 규칙
1. 최소 1개 이상 태그 선택
2. 대상 설비 존재 여부 확인
3. 태그와 대상 설비의 에너지 타입 호환성 체크 (선택)
4. 재할당 이력 기록 (Audit Log)

## 📦 의존성

### 기존 (Phase 1)
- ✅ PostgreSQL 192.168.123.205:5432 (ifems DB)
- ✅ Prisma ORM 6.19.2
- ✅ NestJS 11
- ✅ React 19 + Vite 6
- ✅ TanStack Query

### 신규 (Phase 2)
- **xlsx** (^0.18.5) - Excel 파싱 및 생성
- **csv-parser** (^3.0.0) - CSV 파싱
- **multer** (^1.4.5-lts.1) - File upload middleware
- **@nestjs/platform-express** - Multer 통합

## 🎨 UI/UX 요구사항

### 공통
- 기존 다크 모드 디자인 유지
- FilterBar, SortableTable, Modal 컴포넌트 재사용
- 반응형 디자인
- 검색 및 필터링

### 설비 유형 관리 (SET-011)
- 유형별 색상 표시 (Badge)
- 아이콘 선택 UI (lucide-react 아이콘 팔레트)
- 해당 유형 설비 수 표시

### Tag 일괄 업로드
- Drag & Drop 파일 업로드 영역
- 업로드 진행 표시 (Progress Bar)
- 검증 결과 3단계 표시:
  - ✅ 성공 (초록)
  - ⚠️ 경고 (노랑) - 선택 필드 누락
  - ❌ 실패 (빨강) - 필수 필드 누락, FK 오류

### Tag 재할당
- 다중 선택 체크박스
- 선택된 태그 수 표시
- 계층 선택 UI (Factory → Line → Facility Cascade)

## ✅ 완료 조건

### API 완성도
1. **FacilityType API**: 5개 endpoint 모두 동작 ✅
2. **Tag Bulk Upload API**: 파일 업로드, 검증, 템플릿 다운로드 동작 ✅
3. **Tag Reassignment API**: 재할당 및 검증 동작 ✅

### Frontend 완성도
1. **SET-011**: 설비 유형 CRUD 화면 완성 ✅
2. **SET-012 확장**: 일괄 업로드 UI 통합 ✅
3. **SET-012 확장**: 재할당 UI 통합 ✅

### 데이터 검증
1. **설비 유형**: 최소 5개 유형 등록 및 설비 연결 가능 ✅
2. **일괄 업로드**: 100개 태그 Excel 업로드 성공 ✅
3. **재할당**: 10개 태그 재할당 성공 ✅

### 성능
1. **일괄 업로드**: 1,000개 태그 업로드 < 10초 ✅
2. **재할당**: 100개 태그 재할당 < 3초 ✅

### Gap Analysis
1. **Match Rate**: >= 90% ✅

## 📝 참고 문서

- [tag-management Phase 1 Report](../../04-report/features/tag-management.report.md) - 완료 보고서
- [TagList.xlsx](../../Tag/화성PT4공장_TagList.xlsx) - 원본 데이터 (일괄 업로드 테스트용)
- [schema.prisma](../../apps/api/prisma/schema.prisma) - DB 스키마

## 🔄 Phase 구분

### Phase 1 (완료) ✅
- Factory, Line, Facility, Tag 기본 CRUD
- 계층 구조 시각화
- 2,794개 태그 적재

### Phase 2 (현재) 🔄
- 설비 유형 관리
- Tag 일괄 업로드
- Tag 재할당

### Phase 3 (향후) 📅
- Tag 그룹 관리
- Tag 이력 조회
- Tag 통계 및 분석

---

**Next**: Design 단계 → `/pdca design tag-management-phase2`
