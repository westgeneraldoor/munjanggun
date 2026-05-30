# 문장군 디지털 쇼룸

## 프로젝트 개요
영업사원이 카톡 링크 하나로 보내는, 현장 컬러북을 넘어서는 프리미엄 디지털 쇼룸. 만능 노드 CMS로 컬러·디자인 등 어떤 제품 카테고리든 코드 수정 없이 추가·관리.

## 기술 스택
- 프레임워크: Next.js (App Router, TypeScript strict)
- 스타일: CSS Variables (디자인 토큰 기반)
- 백엔드: Supabase (PostgreSQL + Storage + Auth)
- DB 스키마: `showroom` (v2 범용 CMS)
- 배포: Vercel
- 폰트: Pretendard Variable (CDN) + Playfair Display (next/font)
- 아이콘: Lucide React
- 애니메이션: Intersection Observer API (Framer Motion 미사용 — 번들 최적화)
- 이미지 처리: sharp (dependencies — 서버사이드 런타임)

## 핵심 문서 위치
- 플랫폼 태스크 보드(제작 일정 기준): `./docs/platform/PLATFORM_TASKS.md`
- 플랫폼 전략(최상위 기준): `./docs/platform/PLATFORM_STRATEGY.md`
- 플랫폼 DB/RBAC 설계: `./docs/platform/PLATFORM_DB_RBAC_DESIGN.md`
- 플랫폼 PRD(기준): `./docs/platform/PRD_PLATFORM_v1.0.md`
- 플랫폼 에이전트 부트스트랩(기준): `./docs/platform/CODEX_PROJECT_BOOTSTRAP.md`
- 플랫폼 전환 감사(기준): `./docs/platform/PLATFORM_MIGRATION_AUDIT.md`
- 플랫폼 결정 기록: `./docs/platform/DECISION_LOG.md`
- 브랜드/사업 맥락: `./docs/platform/BRAND_CONTEXT.md`
- 쇼룸 V2 PRD: `./docs/showroom/PRD_v2.0.md`
- 쇼룸 PRD(Legacy/Public Experience 참고): `./docs/showroom/PRD_v1.1.md`
- 쇼룸 디자인: `./docs/showroom/DESIGN_SYSTEM.md`
- 쇼룸 프로젝트 브리프: `./docs/showroom/PROJECT_BRIEF.md`
- 전체 진행현황: `./PROJECT_TASKS.md`
- 작업상태: `./_context.md`
- 작업지시서: `./_order.md`
- 쇼룸 아카이브: `./docs/archive/showroom/`

## 현재 단계
V1 완료 & 프로덕션 배포 → **V2 Phase 5-B 완료** (시네마틱갤러리 + 매끄러운전환 + UX편의) → **플랫폼 전환 베이스라인 수립 중**.

플랫폼 개발은 거대한 추가 PRD를 더 만든 뒤 시작하는 것이 아니다. `docs/platform/PLATFORM_STRATEGY.md`를 북극성으로 두고, `docs/platform/PLATFORM_TASKS.md`의 페이즈 순서와 `docs/platform/PLATFORM_DB_RBAC_DESIGN.md`의 최소 DB/RBAC 기준에 따라 OAuth 로그인과 무료실측 신청 구현으로 바로 들어간다.

## 브랜치 전략
- `main` = V1 프로덕션 (Vercel 자동 배포, 절대 수정 금지)
- `v2-cms` = V2 개발 브랜치 (모든 V2 작업은 여기서)
- `platform-v1` = 플랫폼 MVP 개발 브랜치 (`v2-cms` 기반)

## 코딩 규칙
- 컬러 하드코딩 금지 — `var(--color-*)` / `var(--admin-*)` 사용
- 간격: 4px 배수만 사용 (`--space-N` 토큰)
- 접근성: WCAG AA 대비비 필수 (4.5:1 일반, 3:1 대형)
- 모든 이미지: `next/image` 컴포넌트 필수
- 고객 페이지 = 다크 토큰 / 어드민 = 라이트 토큰 (혼용 금지)
- IntersectionObserver 콜백 내 setState는 비동기이므로 허용 (lint 예외 아님)
- `any` 타입 금지 — Supabase 자동 생성 타입 사용
- `100vh` 금지 → `100dvh` 사용 (카카오톡 인앱 호환)

## 금기사항
- 쇼룸/Public Experience 영역에서는 장바구니, 고객 회원가입, 댓글/리뷰, 다국어, 검색/필터, 알림, AR/VR 일체 금지
- 플랫폼 영역에서는 `docs/platform/PLATFORM_STRATEGY.md`를 우선한다. 고객 로그인과 결제는 플랫폼 MVP 범위에 포함되지만, 장바구니/쿠폰/포인트/회원등급/자동견적은 금지 또는 후순위다.
- `console.log` 프로덕션 잔류 금지
- `console.error` 직접 호출 금지 → `src/lib/logger.ts`의 `logError()` 사용
- 고객 컴포넌트에 어드민 로직 혼입 금지
- 하드코딩된 콘텐츠 금지 — 모든 콘텐츠 DB 동적 로딩
- main 브랜치 직접 수정 금지 — V1 프로덕션 보호
