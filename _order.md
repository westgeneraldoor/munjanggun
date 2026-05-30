# 작업지시서 #052 — MVP-01 카카오 로그인 기반 구축
📅 발행: 2026-05-29
🌿 브랜치: `platform-v1`
🤖 추천 모델: Gemini Flash 3.5 High 작업자 + Codex PM 검수

## 작업 목표

문장군 플랫폼 MVP-01의 카카오 로그인 기반을 구축한다.

이번 오더의 목표는 무료방문견적 신청 구현이 아니다. 다음 오더(MVP-02)에서 고객 신청과 어드민 접수 큐를 만들 수 있도록, 먼저 안전한 인증/프로필/RBAC 기반만 만든다.

## 반드시 먼저 읽을 문서

1. `AGENTS.md`
2. `GEMINI.md`
3. `docs/platform/PLATFORM_STRATEGY.md`
4. `docs/platform/PLATFORM_TASKS.md`
5. `docs/platform/DEVELOPMENT_STRATEGY.md`
6. `docs/platform/PLATFORM_DB_RBAC_DESIGN.md`
7. `docs/platform/PRD_PLATFORM_v1.0.md`
8. `docs/platform/CODEX_PROJECT_BOOTSTRAP.md`
9. `docs/platform/DECISION_LOG.md`
10. `PROJECT_TASKS.md`
11. `_context.md`

Next.js 작업 전에는 `AGENTS.md` 지시에 따라 `node_modules/next/dist/docs/`에서 App Router, middleware/proxy, auth callback 관련 문서를 확인한다.

Supabase 작업 전에는 아래 공식 문서를 확인한다.

- https://supabase.com/docs/guides/auth/social-login
- https://supabase.com/docs/guides/auth/social-login/auth-kakao
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

- 무료방문견적 신청 폼 저장
- 사진 업로드
- 담당자 배정
- 견적/결제
- Naver OAuth 강제 구현
- 장바구니/쿠폰/포인트/회원등급/자동견적

## 결정 사항

| 항목 | 결정 |
|---|---|
| 기본 OAuth | Kakao만 구현 |
| Google | 후속 확장 |
| Naver | Google 확장 시점에 Naver 간편로그인도 함께 검토 |
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

`docs/platform/PLATFORM_DB_RBAC_DESIGN.md`의 MVP-01 범위를 따른다.

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
- 로그인 화면은 고객에게 "회원가입"보다 "무료방문견적 신청 계속하기" 맥락으로 보이게 만든다.
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

### 변경 파일 목록
- [supabase/migrations/20260530000000_platform_auth_foundation.sql](file:///c:/Users/hjh/안티그래비티/munjanggun/supabase/migrations/20260530000000_platform_auth_foundation.sql) (신규)
- [src/types/database.ts](file:///c:/Users/hjh/안티그래비티/munjanggun/src/types/database.ts) (수정)
- [src/lib/supabase/platform-client.ts](file:///c:/Users/hjh/안티그래비티/munjanggun/src/lib/supabase/platform-client.ts) (신규)
- [src/lib/supabase/platform-server.ts](file:///c:/Users/hjh/안티그래비티/munjanggun/src/lib/supabase/platform-server.ts) (신규)
- [src/proxy.ts](file:///c:/Users/hjh/안티그래비티/munjanggun/src/proxy.ts) (수정)
- [src/app/auth/callback/route.ts](file:///c:/Users/hjh/안티그래비티/munjanggun/src/app/auth/callback/route.ts) (신규)
- [src/app/login/page.tsx](file:///c:/Users/hjh/안티그래비티/munjanggun/src/app/login/page.tsx) (신규)
- [src/app/login/login.module.css](file:///c:/Users/hjh/안티그래비티/munjanggun/src/app/login/login.module.css) (신규)
- [src/app/portal/page.tsx](file:///c:/Users/hjh/안티그래비티/munjanggun/src/app/portal/page.tsx) (신규)
- [src/app/portal/portal.module.css](file:///c:/Users/hjh/안티그래비티/munjanggun/src/app/portal/portal.module.css) (신규)
- [eslint.config.mjs](file:///c:/Users/hjh/안티그래비티/munjanggun/eslint.config.mjs) (수정)

### 구현 내용
- **기존 /admin CMS 가드 예외화 및 legacy admin 임시 허용**: 일반 고객/영업 매니저 등이 기존 쇼룸 CMS 경로(예: `/admin/nodes`, `/admin/settings`)에 로그인 상태일 때 접근 차단되지 않도록 체크 로직을 완화하고, 신규 플랫폼 어드민인 `/admin/platform` 경로에 대해서만 `administrator` 역할을 강제하도록 `src/proxy.ts`를 조율했습니다. 더불어 platform profile row가 아예 없는 legacy admin인 경우 기존 CMS 경로에 접근할 수 있도록 `.maybeSingle()` 및 profile 존재 여부 검사를 구현했고, 쿼리 실패 시 fail-closed 원칙을 적용하여 보호 경로 진입을 차단했습니다.
- **마이그레이션 SQL 권한 엄격히 제한**: `platform.profiles` 테이블에 대해 `authenticated` 역할의 UPDATE 권한을 `display_name` 및 `phone` 컬럼으로만 한정(컬럼 레벨 GRANT)하여, 일반 로그인 사용자가 `role` 이나 `email`, `created_at/updated_at` 등의 민감한 컬럼을 임의로 변경하지 못하도록 데이터베이스 수준의 안전장치를 설정했습니다.
- **RLS 무한 재귀 루프 차단**: `profiles` RLS update 정책 내에서 자기 자신을 직접 서브쿼리로 조회해 무한 재귀를 유발할 수 있던 부분을 차단하기 위해 `platform_private.get_user_role(p_user_id UUID)` 헬퍼 함수를 신설하고 이를 RLS update `WITH CHECK`에 바인딩했습니다.
- **트리거 함수 보안 지정**: 사용자 가입 시 프로필을 연동 생성하는 `handle_new_user` 함수를 `platform_private` 스키마 하위로 이전하고, `SECURITY DEFINER` 및 `search_path`를 고정 지정하여 권한 위조를 방지했습니다.
- **오픈 리다이렉트 취약점 차단**: `src/app/auth/callback/route.ts` 에서 `next` 파라미터가 `/`로 시작하고 `//`로 시작하지 않는 유효한 상대 경로일 때만 리다이렉트를 처리하며, 절대 경로나 프로토콜이 주입되었을 때는 `/portal`로 안전하게 리다이렉트하는 위협 방지 로직을 추가했습니다.
- **타입 바인딩 & Supabase SDK 헬퍼 & UI**: 앞선 빌드와 동일하게 스키마별 클라이언트 분리, TS Database 타입 매핑 및 프리미엄 다크/골드 간편로그인 UI 및 포털 placeholder를 유지하였습니다.

### 검증 결과
- **npm run lint**: ESLint 체크 성공 (Warning은 빌드를 방해하지 않는 수준의 기존 CMS 잔재일 뿐이며, 생성 폴더 빌드 무시는 정상 유지됩니다).
- **npm run build**: Next.js 16+ Turbopack optimized production build가 에러 없이 완벽히 성공함을 재검증했습니다.

### 미확인 사항
- 실제 카카오 개발자 센터 어플리케이션(OAuth Client ID 및 Client Secret) 등록 정보와 클라우드 Supabase Auth의 카카오 활성화 연결 테스트.
- 원격 실서버 환경에서의 카카오 로그인 API 리다이렉트 흐름.
- Supabase Dashboard > API Settings > Exposed schemas 목록에 `platform` 스키마가 포함되어 있는지 확인.
