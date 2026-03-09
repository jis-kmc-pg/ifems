# i-FEMS (Intelligence Facility & Energy Management System)

> 화성 PT4공장 설비·에너지 실시간 모니터링 시스템

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![TimescaleDB](https://img.shields.io/badge/TimescaleDB-Enabled-F6CE00)](https://www.timescale.com/)
[![pnpm](https://img.shields.io/badge/pnpm-Workspace-F69220?logo=pnpm)](https://pnpm.io/)

---

## 📋 프로젝트 개요

i-FEMS는 기아 화성 PT4공장의 **설비·에너지 데이터를 실시간으로 수집·분석**하여, 에너지 낭비 요소를 조기 발견하고 설비 이상을 자동 감지하는 Intelligence FEMS입니다.

### 주요 기능
- **실시간 모니터링** - 전력, 에어, 가스, 태양광 사용량 실시간 추적
- **Dynamic Resolution** - 차트 줌에 따른 4단계 자동 해상도 전환 (15m → 1m → 10s → 1s)
- **이상 데이터 감지** - 센서 글리치/통신 오류 자동 감지, 보정, 차트 시각화 (2026-03-05)
- **알림 시스템** - 전력 품질, 에어 누기, 싸이클 이상 자동 감지
- **비교 분석** - 설비별/기간별 에너지 사용 패턴 비교
- **설정 관리** - 임계값, 기준 싸이클, 계층 구조 관리

### 시스템 구성
- **Frontend**: React 19 + Vite 6 + TypeScript 5.7 (32개 화면)
- **Backend**: NestJS 11 + Prisma ORM + PostgreSQL 16 + TimescaleDB (79개 API)
- **Charts**: uPlot (Canvas 기반, 60 FPS 성능)
- **State**: TanStack Query v6 + Zustand v5
- **Styles**: Tailwind CSS v4

---

## 🚀 빠른 시작

### 필수 요구사항
- Node.js 20+
- pnpm 9+
- PostgreSQL 16+ (TimescaleDB 확장 권장)

### 설치 및 실행

```bash
# 프로젝트 클론
git clone <repository-url>
cd IFEMS

# 의존성 설치
pnpm install

# Frontend 실행 (개발 모드, Mock 데이터)
pnpm dev:web
# → http://localhost:5173

# Backend 실행 (개발 모드)
pnpm dev:api
# → http://localhost:4001/api

# 전체 실행 (Frontend + Backend)
pnpm dev
```

### 환경 변수 설정

```bash
# apps/web/.env
VITE_USE_MOCK=true          # true: Mock 데이터, false: 실제 API

# apps/api/.env
DATABASE_URL="postgresql://username:password@localhost:5432/ifems"
PORT=4001
NODE_ENV=development
```

---

## 📁 프로젝트 구조

```
IFEMS/
├── apps/
│   ├── web/                   # Frontend (React 19 + Vite 6)
│   │   ├── src/
│   │   │   ├── pages/         # 32개 화면
│   │   │   ├── components/    # 공통 컴포넌트
│   │   │   ├── services/      # API 서비스 레이어
│   │   │   ├── stores/        # Zustand 상태 관리
│   │   │   └── lib/           # 유틸리티
│   │   └── package.json
│   └── api/                   # Backend (NestJS 11 + Prisma)
│       ├── src/
│       │   ├── monitoring/    # 모니터링 모듈 (11 API)
│       │   ├── dashboard/     # 대시보드 모듈 (9 API)
│       │   ├── alerts/        # 알림 모듈 (7 API)
│       │   ├── analysis/      # 분석 모듈 (7 API)
│       │   ├── settings/      # 설정 모듈 (43 API)
│       │   └── prisma/        # DB 스키마
│       └── package.json
├── shared/                    # 공통 타입 (@ifems/shared)
├── docs/                      # 문서
│   ├── 01-plan/               # 계획 문서
│   ├── 02-design/             # 설계 문서
│   ├── 03-analysis/           # Gap 분석
│   ├── 04-report/             # 완료 보고서
│   └── archive/               # 아카이브 (PDCA 완료 프로젝트)
├── CLAUDE.md                  # 협업 지침서 (bkit 참조)
└── README.md                  # 이 파일
```

---

## 📚 핵심 문서

### 필수 협업 문서
- **[CLAUDE.md](CLAUDE.md)** - 프로젝트 협업 규칙 (bkit 에이전트 참조)
  - Frontend/Backend 규칙
  - Dynamic Resolution 사양
  - 색상 시스템
  - 절대 규칙

- **[docs/TAG-DATA-SPEC.md](docs/TAG-DATA-SPEC.md)** - 태그 데이터 사양서
  - 5가지 태그 종류 (TREND, USAGE, OPERATE, SENSOR, CONTROL)
  - 집계 로직 (마지막 값, 차분, 합, 평균)
  - Null vs 0 처리 규칙

### 개발 계획 및 현황
- **[docs/PLAN.md](docs/PLAN.md)** - 프로젝트 개발 계획서
  - 32개 화면 구현 계획
  - Phase 1~7 진행 현황
  - PDCA 완료 프로젝트 아카이브

- **[docs/CHANGELOG.md](docs/CHANGELOG.md)** - 변경 이력
  - 이상 데이터 감지 + 차트 시각화 (2026-03-05)
  - Frontend-Backend 통합 + Tag Classification (2026-03-04)
  - TimescaleDB CA + Reset Detection (2026-03-03)
  - Backend API 완료 (2026-02-28)
  - Dynamic Resolution / uPlot 마이그레이션 / Tag Management

### 개발 가이드
- **[docs/UI-UX-GUIDELINES.md](docs/UI-UX-GUIDELINES.md)** - UI/UX 가이드라인 (i-FEMS 고유 규칙)
- **[docs/API-CONTINUOUS-AGGREGATE.md](docs/API-CONTINUOUS-AGGREGATE.md)** - TimescaleDB Continuous Aggregate API 가이드
- **[apps/api/README_TIMESCALEDB_SETUP.md](apps/api/README_TIMESCALEDB_SETUP.md)** - TimescaleDB 초기화 가이드

---

## 🎯 완료된 PDCA 프로젝트 (아카이브)

### 1. backend-api (i-FEMS Backend API 전체 구현)
- **아카이브 일시**: 2026-02-28
- **Match Rate**: 91% (8회 PDCA 반복: 62% → 91%)
- **위치**: [docs/archive/2026-02/backend-api/](docs/archive/2026-02/backend-api/)
- **상세 보고서**: [backend-api.report.md](docs/archive/2026-02/backend-api/backend-api.report.md)
- **주요 성과**:
  - 77개 REST API 엔드포인트 구현
  - NestJS 11 + Prisma ORM + TimescaleDB
  - Swagger/OpenAPI 문서화 완료
  - Service 테스트 커버리지 49.47%

### 2. backend-dynamic-resolution (동적 차트 해상도)
- **아카이브 일시**: 2026-02-28
- **Match Rate**: 96%
- **위치**: [docs/archive/2026-02/backend-dynamic-resolution/](docs/archive/2026-02/backend-dynamic-resolution/)
- **주요 성과**:
  - 4단계 Progressive Resolution (15m → 1m → 10s → 1s)
  - 자동 interval 전환
  - SWR 캐싱 (interval별 TTL)

### 3. tag-management (태그 관리 시스템)
- **아카이브 일시**: 2026-02-23
- **Match Rate**: 93%
- **위치**: [docs/archive/2026-02/tag-management/](docs/archive/2026-02/tag-management/)
- **주요 성과**:
  - Factory → Line → Facility → Tag 계층 구조
  - 27+ Backend API 엔드포인트
  - 2,794개 활성 태그 관리

---

## 🖥️ 화면 구성 (32개)

### 모니터링 (MON) - 6개
- MON-001: 종합 현황
- MON-002: 라인별 상세 (Dynamic Resolution)
- MON-003: 에너지 사용 순위
- MON-004: 에너지 알림 현황
- MON-005: 전력 품질 순위
- MON-006: 에어 누기 순위

### 대시보드 (DSH) - 8개
- DSH-001: 에너지 사용 추이
- DSH-002: 설비별 추이
- DSH-003: 사용량 분포
- DSH-004: 공정별 순위
- DSH-005: 싸이클당 순위
- DSH-006: 전력 품질 순위
- DSH-007: 에어 누기 순위
- DSH-008: 에너지 변화 TOP N

### 알림 (ALT) - 6개
- ALT-001: 전력 품질 통계
- ALT-002: 에어 누기 통계
- ALT-003: 싸이클 이상 통계
- ALT-004: 전력 품질 이력
- ALT-005: 에어 누기 이력
- ALT-006: 싸이클 이상 이력

### 분석 (ANL) - 5개
- ANL-001: 비교 분석
- ANL-002: 상세 비교 분석
- ANL-003: 싸이클 분석
- ANL-004: 싸이클 타임 지연
- ANL-005: 전력 품질 분석

### 설정 (SET) - 6개
- SET-001: 전력 품질 설정
- SET-002: 에어 누기 설정
- SET-003: 기준 싸이클 파형
- SET-004: 싸이클 알림 설정
- SET-005: 에너지 사용량 알림
- SET-006: 싸이클당 에너지 알림

---

## 🔧 기술 스택

### Frontend
- **Framework**: React 19.2.4
- **Build Tool**: Vite 6.4.1
- **Language**: TypeScript 5.7
- **Routing**: React Router v7
- **State Management**:
  - Server State: TanStack Query v6 (auto-caching 5분)
  - Client State: Zustand v5 (persist middleware)
- **Styling**: Tailwind CSS v4 (@tailwindcss/vite)
- **Charts**: uPlot 1.6.32 (Canvas-based, 60 FPS)
- **Icons**: Lucide React
- **Package Manager**: pnpm workspace

### Backend
- **Framework**: NestJS 11
- **ORM**: Prisma 6.19.2
- **Database**: PostgreSQL 16 + TimescaleDB 확장
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest

### DevOps
- **Containerization**: Docker + Docker Compose
- **CI/CD**: (준비 중)
- **Monitoring**: (준비 중)

---

## 📊 개발 현황

### Frontend
- ✅ 32개 화면 전체 완료 (2026-02-19)
- ✅ uPlot 차트 마이그레이션 완료 (2026-02-25)
- ✅ Dynamic Resolution 구현 완료 (2026-02-28)
- ✅ TypeScript 컴파일 오류 0개

### Backend
- ✅ 79개 REST API 완료 (2026-02-28 ~ 2026-03-05)
- ✅ Swagger 문서화 완료
- ✅ TimescaleDB Hypertable 설정 완료
- ✅ TimescaleDB Continuous Aggregates 구현 (2026-03-03)
- ✅ 리셋 감지 및 보정 시스템 (2026-03-03)
- ✅ 이상 데이터 감지 + 차트 시각화 (2026-03-05)
- ✅ Mock 데이터 생성기 완료
- ✅ 15분 집계 Cron Job 완료
- ⏳ WebSocket 실시간 알림 (Phase 8 예정)

### Quality
- ✅ Gap Analysis: 91% (목표 90% 초과)
- ✅ Service 테스트: 49.47% 커버리지
- ⚠️ Controller 테스트: 25%+ (향상 필요)
- ⚠️ E2E 테스트: 미구현

---

## 🤝 협업 가이드

### bkit 에이전트 활용
이 프로젝트는 bkit PDCA 방법론을 사용합니다.

```bash
# PDCA 상태 확인
/pdca status

# 다음 단계 가이드
/pdca next

# 새 기능 개발 시작
/pdca plan [feature-name]

# Gap 분석
/pdca analyze [feature-name]

# 완료 보고서 생성
/pdca report [feature-name]
```

### 문서 우선 순위
1. **CLAUDE.md** - 항상 최우선 참조
2. **TAG-DATA-SPEC.md** - 데이터 처리 시 필수
3. **PLAN.md** - 개발 계획 확인
4. **archive/** - 완료된 프로젝트 참조

### 코딩 규칙
- **Frontend 규칙** (CLAUDE.md 참조)
  - TAG-DATA-SPEC.md 준수
  - 신호등 색상 고정
  - TypeScript strict 모드

- **Backend 규칙** (CLAUDE.md 참조)
  - Dynamic Resolution 준수
  - DTO Validation 필수
  - Swagger 문서화 필수
  - 매개변수 통일성 (`'elec' | 'air'`)

---

## 📈 성능 지표

### Frontend
- **초기 번들 크기**: ~450KB (code splitting 적용)
- **차트 성능**: 60 FPS (uPlot Canvas 기반)
- **API 응답 캐싱**: 5분 (TanStack Query)

### Backend
- **API 평균 응답 시간**: <100ms (Mock 데이터)
- **TimescaleDB 쿼리**: <1초 (15분 집계)
- **동시 접속**: ~100명 (설계 기준)

---

## 🔒 라이선스

이 프로젝트는 내부 사용 목적으로 개발되었습니다.

---

## 👥 팀

- **기획**: 기아 화성 PT4공장
- **개발**: AI Assistant (Claude) + 사용자 협업
- **방법론**: bkit PDCA (Plan-Do-Check-Act)

---

## 📞 문의

프로젝트 관련 문의사항은 이슈 트래커를 이용해 주세요.

---

**최종 업데이트**: 2026-03-05
**프로젝트 버전**: 1.0.0
**상태**: ✅ Frontend 완료 | ✅ Backend 완료 (79 API + CA + 이상감지) | ✅ 통합 PDCA 98% | ⏳ 실시간 수집 활성화 예정
