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
- PRD: `./PRD_v2.0.md`
- 디자인: `./docs/DESIGN_SYSTEM.md`
- 프로젝트 브리프: `./docs/PROJECT_BRIEF.md`
- 진행현황: `./PROJECT_TASKS.md`
- 작업상태: `./_context.md`
- 작업지시서: `./_order.md`
- V1 아카이브: `./_archive.md`

## 현재 단계
V1 완료 & 프로덕션 배포 → **V2 Phase 5-B 완료** (시네마틱갤러리 + 매끄러운전환 + UX편의)

## 브랜치 전략
- `main` = V1 프로덕션 (Vercel 자동 배포, 절대 수정 금지)
- `v2-cms` = V2 개발 브랜치 (모든 V2 작업은 여기서)

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
- 결제/장바구니, 고객 회원가입, 댓글/리뷰, 다국어, 검색/필터, 알림, AR/VR 일체 금지
- `console.log` 프로덕션 잔류 금지
- `console.error` 직접 호출 금지 → `src/lib/logger.ts`의 `logError()` 사용
- 고객 컴포넌트에 어드민 로직 혼입 금지
- 하드코딩된 콘텐츠 금지 — 모든 콘텐츠 DB 동적 로딩
- main 브랜치 직접 수정 금지 — V1 프로덕션 보호
