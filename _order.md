# 작업지시서 #052 — MVP-01 OAuth 로그인 기반 구축
📅 발행: 2026-05-29
🌿 브랜치: `platform-v1`
🤖 추천 모델: Codex high reasoning

## 작업 목표

문장군 플랫폼 MVP-01의 OAuth 로그인 기반을 구축한다.

이번 오더의 목표는 무료실측 신청 구현이 아니다. 다음 오더(MVP-02)에서 고객이 실제 신청을 저장할 수 있도록, 먼저 안전한 인증/프로필/RBAC 기반만 만든다.

## 반드시 먼저 읽을 문서

1. `AGENTS.md`
2. `GEMINI.md`
3. `PLATFORM_STRATEGY.md`
4. `PLATFORM_DB_RBAC_DESIGN.md`
5. `PRD_PLATFORM_v1.0.md`
6. `CODEX_PROJECT_BOOTSTRAP.md`
7. `DECISION_LOG.md`
8. `PROJECT_TASKS.md`
9. `_context.md`

Next.js 작업 전에는 `AGENTS.md` 지시에 따라 `node_modules/next/dist/docs/`에서 App Router, middleware/proxy, auth callback 관련 문서를 확인한다.

Supabase 작업 전에는 아래 공식 문서를 확인한다.

- https://supabase.com/docs/guides/auth/social-login
- https://supabase.com/docs/guides/auth/social-login/auth-kakao
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/database/postgres/row-level-security

## 범위

### 포함

- `platform` 스키마와 MVP-01에 필요한 최소 테이블/타입 생성
- `platform.profiles` 생성
- `platform.staff_profiles` 생성
- `platform_private` helper function 생성
- profile 자동 생성 trigger
- RLS enable + MVP-01 정책
- 플랫폼용 Supabase client 헬퍼 추가
- OAuth 로그인 페이지 또는 진입 컴포넌트 추가
- OAuth callback route 추가
- `/portal` 보호 라우트의 아주 얇은 placeholder 추가
- 기존 `/admin` auth guard를 깨지 않도록 `proxy.ts` 확장

### 제외

- 무료실측 신청 폼 저장
- 사진 업로드
- 담당자 배정
- 견적/결제
- Naver OAuth 강제 구현
- 장바구니/쿠폰/포인트/회원등급/자동견적

## 결정 사항

| 항목 | 결정 |
|---|---|
| 기본 OAuth | Kakao 우선 |
| 보조 OAuth | Google 가능하면 함께 |
| Naver | MVP-01 블로커 아님. `custom:naver`는 후속 후보 |
| 기본 role | OAuth 최초 로그인 사용자는 `customer` |
| role 원본 | `platform.profiles.role` |
| 금지 | `user_metadata` 또는 클라이언트 값으로 role 판단 금지 |

## 예상 파일

새 파일 또는 수정 가능 파일:

```text
src/lib/supabase/platform-server.ts
src/lib/supabase/platform-client.ts
src/app/auth/callback/route.ts
src/app/login/page.tsx
src/app/login/login.module.css
src/app/portal/page.tsx
src/app/portal/portal.module.css
src/proxy.ts
src/types/database.ts
```

마이그레이션:

```text
supabase/migrations/<generated>_platform_auth_foundation.sql
```

단, 현재 repo에 `supabase/` 디렉터리가 없다면 먼저 현 구조를 확인하고 프로젝트 관례에 맞게 만든다. 마이그레이션 파일명은 직접 발명하지 말고 Supabase CLI가 가능하면 `supabase migration new platform_auth_foundation`으로 만든다.

## DB 설계 요약

`PLATFORM_DB_RBAC_DESIGN.md`의 MVP-01 범위를 따른다.

필수:

- schema: `platform`
- private schema: `platform_private`
- enum: `platform.profile_role`
- tables:
  - `platform.profiles`
  - `platform.staff_profiles`
- helper functions:
  - `platform_private.current_role()`
  - `platform_private.is_admin()`
  - `platform_private.is_sales_manager()`
- RLS:
  - 사용자는 본인 profile 조회 가능
  - 관리자는 전체 profile 조회/수정 가능
  - 일반 사용자는 자기 role 수정 불가

## 구현 규칙

- 기존 `showroom`/V2 CMS 동작을 깨지 않는다.
- 기존 `/admin` 접근 흐름을 깨지 않는다.
- 플랫폼 고객 경로는 `/portal`로 시작한다.
- 로그인 화면은 고객에게 "회원가입"보다 "무료실측 신청 계속하기" 맥락으로 보이게 만든다.
- CSS는 기존 디자인 토큰을 사용한다.
- Tailwind 사용 금지.
- `any` 금지.
- `console.log` 금지.
- `console.error` 직접 호출 금지, 기존 `logError()` 사용.

## 검증 기준

필수:

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] 로그인하지 않은 사용자가 `/portal` 접근 시 `/login` 또는 로그인 유도 경로로 이동
- [ ] OAuth callback route가 존재하고 세션 교환 흐름이 구현됨
- [ ] `platform.profiles` role이 기본 `customer`로 생성되는 설계
- [ ] 고객이 자신의 role을 클라이언트에서 바꿀 수 없는 설계
- [ ] 기존 `/admin` CMS 접근 흐름이 깨지지 않음

가능하면:

- [ ] Supabase 로컬/원격에서 migration 적용 가능 여부 확인
- [ ] 테스트 사용자 1명으로 `profiles` row 생성 확인

## 작업 결과 (작업자가 작성)

아직 미작성.
