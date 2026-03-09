# 태그 관리 시스템 구현 계획 (Tag Management System Plan)

**Feature**: tag-management
**Created**: 2026-02-23
**Priority**: High
**Estimated**: 3-4 days

## 📋 개요

화성 PT4 공장의 2,794개 태그를 계층적으로 관리하고, Factory → Line → Facility → Tag 구조를 통해 데이터 가독성과 관리 효율성을 높인다.

## 🎯 목표

1. **계층 구조 완성**: Factory(1) → Line(4) → Facility(325) → Tag(2,794)
2. **6개 설정 화면 구현**: Factory, Line, Facility, FacilityType, Tag Master, Hierarchy
3. **태그 표시명 매핑**: tagName ↔ displayName 관리로 UX 개선
4. **전체 CRUD 완성**: 모든 설정 항목에 대한 생성/조회/수정/삭제 기능

## 📊 현재 상태

### 완료 ✅
- DB 스키마 설계 및 마이그레이션 완료
- TagList.xlsx 분석 및 태그 추출 (2,797개 → 2,794개 적재)
- Factory, Line, Facility, Tag 테이블 생성
- 계층 관계 설정 (FK 연결)

### 진행 중 🔄
- Backend API 구현
- Frontend 설정 화면 구현

### 대기 ⏳
- Gap 분석 및 검증
- 성능 최적화
- 사용자 테스트

## 🏗️ 구현 범위

### Phase 1: Backend API (2일)
1. **Factory API** - 공장 CRUD
2. **Line API** - 라인 CRUD
3. **Tag API** - 태그 CRUD + 일괄 업로드
4. **Hierarchy API** - 전체 계층 구조 조회
5. **Facility API 확장** - 기존 API에 lineId 필드 추가

### Phase 2: Frontend 화면 (2일)
1. **SET-008: 공장 관리** - Factory 목록/등록/수정/삭제
2. **SET-009: 라인 설정** - Line 목록/등록/수정/삭제
3. **SET-010: 설비 마스터** - 기존 화면 확장 (lineId 표시)
4. **SET-011: 설비 유형 관리** - Type 목록/등록/수정/삭제
5. **SET-012: 태그 마스터** - Tag 목록/등록/수정/삭제/일괄 업로드
6. **SET-013: 태그 계층** - Tree View로 전체 구조 시각화

### Phase 3: 검증 및 최적화 (1일)
1. Gap 분석 (설계 vs 구현)
2. 성능 테스트 (2,794개 태그 조회 속도)
3. UX 개선 (페이지네이션, 검색, 필터링)

## 📦 의존성

- ✅ PostgreSQL 192.168.123.205:5432 (ifems DB)
- ✅ Prisma ORM 6.19.2
- ✅ NestJS 11
- ✅ React 19 + Vite 6

## 🎨 UI/UX 요구사항

### 공통
- 다크 모드 지원
- 반응형 디자인
- 검색 및 필터링
- 페이지네이션 (50개/페이지)

### 계층 구조 시각화
- Tree View 컴포넌트 (react-arborist 또는 rc-tree)
- Drill-down 네비게이션
- 통계 표시 (각 레벨별 개수)

## ✅ 완료 조건

1. **API 완성도**: 6개 엔드포인트 모두 동작 ✅
2. **화면 완성도**: 6개 설정 화면 모두 구현 ✅
3. **데이터 검증**: 2,794개 태그 정상 조회/수정 가능 ✅
4. **성능**: 태그 목록 조회 < 1초 ✅
5. **Gap Analysis**: Match Rate >= 90% ✅

## 📝 참고 문서

- [TAG_MANAGEMENT_DESIGN.md](../02-design/features/tag-management.design.md) - 상세 설계
- [TagList.xlsx](../../Tag/화성PT4공장_TagList.xlsx) - 원본 데이터
- [schema.prisma](../../apps/api/prisma/schema.prisma) - DB 스키마

---

**Next**: Design 단계 → `/pdca design tag-management`
