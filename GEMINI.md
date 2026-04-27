# 문장군 디지털 컬러북

## 프로젝트 개요
영업사원이 카톡 링크 하나로 보내는, 현장 컬러북을 넘어서는 프리미엄 디지털 쇼룸. 중문 필름 컬러를 고화질 텍스처와 시공 사례로 온라인에서 몰입감 있게 탐색.

## 기술 스택
- 프레임워크: Next.js (App Router, TypeScript strict)
- 스타일: CSS Variables (디자인 토큰 기반)
- 백엔드: Supabase (PostgreSQL + Storage + Auth)
- 배포: Vercel
- 폰트: Pretendard Variable (CDN)
- 아이콘: Lucide React
- 애니메이션: Intersection Observer API (Framer Motion 미사용 — 번들 최적화)

## 핵심 문서 위치
- PRD: `./PRD_v1.1.md`
- 디자인: `./docs/DESIGN_SYSTEM.md`
- 프로젝트 브리프: `./docs/PROJECT_BRIEF.md`
- 진행현황: `./PROJECT_TASKS.md`
- 작업상태: `./_context.md`
- 감사보고서: `./_audit_2026-04-21.md`
- 출시점검: `./_launch_check.md`
- 작업지시서: `./_order.md`

## 현재 단계
기획 완료 → 디자인 확정 → 개발 완료 → **Phase 4: 검증 & 출시** (폴리싱 진행 중)

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
- 하드코딩된 컬렉션/컬러 데이터 금지 — 모든 콘텐츠 DB 동적 로딩
