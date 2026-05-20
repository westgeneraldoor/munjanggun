# 문장군 디지털 쇼룸

문장군의 방문 중문, 도어, 디자인 요소, 컬러 요소를 고객 상담 현장에서 바로 보여주기 위한 **디지털 쇼룸**입니다.

이 프로젝트는 처음에는 고객이 종이 컬러북을 직접 보지 못하는 상황을 보완하기 위한 "디지털 컬러북" MVP로 시작했습니다. 운영 과정에서 고객 반응과 영업부 사용성이 모두 좋아졌고, 이후 문장군의 전체 상품군을 직접 구성하고 확장할 수 있는 페이지 빌더형 쇼룸으로 발전했습니다.

## 현재 기준

- 운영 기준 브랜치: `v2-cms`
- 현재 정리 브랜치: `codex-v2-cms-cleanup`
- V1 디지털 컬러북 기록: `_archive.md`
- V2 기획 기준: `PRD_v2.0.md`, `docs/PROJECT_BRIEF_v2.md`
- 작업 현황 기준: `_context.md`, `PROJECT_TASKS.md`

`master`는 V1 컬러북 히스토리에 가깝고, 현재 제품 기준은 V2 디지털 쇼룸입니다. 새 기능과 문서 업데이트는 V2 기준으로 진행합니다.

## 핵심 기능

- 고객용 쇼룸: `/`, `/:slug`, `/parent/child` 형태의 무한 깊이 노드 탐색
- 관리자 CMS: `/admin/nodes`, `/admin/settings`에서 노드, 히어로, 갤러리, 사이트 설정 관리
- 미리보기 링크: `/preview/[token]`으로 비공개 노드 검수
- 이미지 운영: Supabase Storage 기반 이미지 업로드와 노출
- 공유 최적화: 동적 메타데이터와 V1 URL 301 리다이렉트

## 기술 스택

- Frontend: Next.js 16 App Router, React 19, TypeScript
- Styling: CSS Modules, global CSS design tokens
- Backend: Supabase PostgreSQL, Storage, Auth
- Deployment: Vercel

## 주요 구조

```text
src/
  app/
    page.tsx                 # 쇼룸 홈
    [...slugs]/page.tsx      # 노드 기반 고객 페이지
    preview/[token]/page.tsx # 비공개 미리보기
    admin/                   # 관리자 CMS
  components/
    customer/                # 고객 화면 컴포넌트
    admin/                   # 관리자 화면 컴포넌트
  lib/
    supabase/                # Supabase 클라이언트
    constants.ts             # 예약 링크, 깊이 제한 등 전역 상수
  types/
    database.ts              # Supabase 타입
docs/
  DESIGN_SYSTEM.md
  PROJECT_BRIEF.md
  PROJECT_BRIEF_v2.md
```

## 환경 변수

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY`는 관리자성 서버 작업이나 RLS 우회가 필요한 서버 전용 코드에서만 사용해야 합니다. 클라이언트 코드에 노출되면 안 됩니다.

## 실행

```bash
npm install
npm run dev
```

검증은 아래 명령을 기준으로 합니다.

```bash
npm run lint
npm run build
```

## 운영 메모

- Supabase 기본 운영 스키마는 `showroom`입니다.
- V1 `colorbook` 스키마는 히스토리와 이전 데이터 확인 용도로만 봅니다.
- 생성물과 외부 도구 산출물(`.next`, `.vercel`, `.agents`, 영상 산출물 등)은 소스 기준 문서가 아닙니다.
- 미리보기 토큰은 편의 기능이지만 보안 표면이 있으므로 RLS 정책과 만료 정책을 함께 확인해야 합니다.
