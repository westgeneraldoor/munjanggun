# MVP-01 Final Review Audit

Date: 2026-06-02
Mode: MVP-01 final review before MVP-02 order
Reviewer: Codex PM + Inspector

## Verdict

MVP-01 판정: `GO with follow-up`

카카오 로그인, 세션 복귀, `platform.profiles` 고객 role 생성, RLS/권한 기본선은 통과했다.

단, MVP-02 착수 전에 아래 follow-up을 작업 오더에 반영해야 한다.

- 고객용 이메일 보조 로그인은 MVP-01.5 또는 MVP-02 전후 의사결정 항목으로 남긴다.
- `/portal` 첫 화면은 현재 placeholder다. MVP-02에서 "무료방문견적 신청/진행 상태" 중심으로 재설계한다.
- 고객 전화번호는 Kakao OAuth가 아니라 MVP-02 신청 폼에서 필수 확보한다.
- 사진/영상은 private storage + signed URL 원칙으로 MVP-02 시작 전에 다시 확인한다.

## 직접 확인한 범위

- `src/app/login/page.tsx`
- `src/app/login/login.module.css`
- `src/app/portal/page.tsx`
- `src/app/portal/portal.module.css`
- `src/app/auth/callback/route.ts`
- `src/proxy.ts`
- `src/lib/supabase/platform-client.ts`
- `src/lib/supabase/platform-server.ts`
- `supabase/migrations/20260602015936_platform_auth_foundation.sql`
- `supabase/migrations/20260602020113_harden_platform_auth_policies.sql`
- `supabase/migrations/20260602024352_sync_platform_profile_on_auth_update.sql`
- `docs/platform/PLATFORM_TASKS.md`
- `_context.md`
- `_order.md`
- Supabase MCP: migrations, policies, triggers, `platform.profiles`

## Evidence

Supabase MCP 확인:

- `platform.profiles` row 생성됨
- role: `customer`
- display_name/email 저장됨
- phone: `null`

DB trigger 확인:

- `auth.users` INSERT trigger: `on_auth_user_created`
- `auth.users` UPDATE trigger: `on_auth_user_updated`
- `platform.profiles` UPDATE timestamp trigger
- `platform.staff_profiles` UPDATE timestamp trigger

RLS policy 확인:

- `platform.profiles`: SELECT/UPDATE 정책은 `authenticated` 대상
- `platform.staff_profiles`: SELECT/INSERT/UPDATE/DELETE 정책은 `authenticated` 대상
- `platform_private` schema는 Data API 노출 대상이 아니다.

Verification:

- `npm run lint`: 통과, 기존 CMS warning 9개
- `npm run build`: 통과
- 로컬 Kakao OAuth 로그인 후 `/portal` 진입 확인
- 재로그인 후 기존 auth user의 `platform.profiles.role = customer` 생성 확인

## Findings

### 경고 1. 로그인 화면은 기능상 통과했지만 고객 전환 화면으로는 아직 약하다

근거:

- `src/app/login/page.tsx`는 카카오 버튼 하나와 개인정보 문구만 제공한다.
- 사용자는 카카오 자동 로그인 외 이메일 로그인도 필요하다고 지적했다.
- 플랫폼 전략상 로그인은 포털 입구가 아니라 "무료방문견적 신청 계속하기"의 마찰 최소화 화면이어야 한다.

영향:

- 카카오를 쓰지 않는 고객, 카카오 장애, 카카오 이메일 미제공 케이스에서 이탈할 수 있다.

해결 방향:

- 고객용 이메일 로그인은 비밀번호 회원가입보다 매직링크/OTP를 우선 검토한다.
- MVP-02 오더에 "카카오 메인 + 이메일 보조 로그인 의사결정"을 포함한다.

### 경고 2. `/portal`은 아직 고객 여정 화면이 아니라 placeholder다

근거:

- `src/app/portal/page.tsx`는 "MVP-02 구현 예정", "MVP-04, 05 구현 예정" 문구가 직접 노출된다.
- 고객이 실제로 해야 할 다음 행동이 버튼/상태 중심으로 완성되어 있지 않다.

영향:

- 실제 고객 테스트에서 "로그인 후 무엇을 해야 하는지"가 흐려질 수 있다.

해결 방향:

- MVP-02에서 `/portal` 첫 화면을 "무료방문견적 신청", "내 신청 상태", "필수 연락처 보완" 중심으로 재구성한다.
- 고객 화면에는 내부 MVP 번호를 노출하지 않는다.

### 경고 3. 전화번호 확보 책임을 MVP-01에 두면 안 된다

근거:

- 확인된 `platform.profiles.phone`은 `null`.
- Kakao OAuth metadata에는 `phone_verified = false`이고 전화번호가 내려오지 않았다.
- 사용자 결정상 이름/전화번호는 신청 단계에서 필수 확보해야 한다.

영향:

- 로그인만으로 고객 연락처를 확보했다고 오해하면 MVP-02 운영 큐가 비게 된다.

해결 방향:

- MVP-02 `measurement_requests` 생성 전 phone/address 필수 입력을 강제한다.
- `platform.profiles.phone`은 신청 폼 제출 시 함께 보정 업데이트한다.

### 참고 1. Auth/RBAC는 현재 MVP-02 진입에 충분하지만 실서버 redirect는 배포 후 재검증 필요

근거:

- 로컬 callback은 검증됨.
- `_order.md`에 원격 실서버 OAuth redirect는 배포 URL 확정 후 재확인 항목으로 남겼다.

해결 방향:

- 배포 URL 확정 시 Supabase Redirect URLs와 Kakao redirect 흐름을 다시 테스트한다.

### 위생 1. `.codex/` 임시 로그는 repo 추적 대상이 아니다

근거:

- 작업 중 `.codex/` 로그 폴더가 untracked로 생성되었다.
- `.gitignore`에 `.codex/`를 추가했다.

해결 방향:

- 잠금이 풀리면 로컬에서 삭제한다. 커밋에는 포함하지 않는다.

## MVP-02 Entry Gate

MVP-02 오더 작성 전 확인할 항목:

- [x] MVP-01 Kakao OAuth 로그인 통과
- [x] `platform.profiles.role = customer` 생성 확인
- [x] 기존 auth user 재로그인 profile 보정 확인
- [x] `platform` exposed schema 확인
- [x] `platform_private` 미노출 유지
- [ ] `measurement-media` private bucket 설계 재확인
- [ ] 고객 신청 폼에서 phone/address 필수 검증 방식 결정
- [ ] `/portal` 고객 첫 화면을 신청 중심으로 재구성할지 MVP-02 범위에 포함
- [ ] 이메일 매직링크/OTP 보조 로그인 도입 시점 결정

## Next PM Decision

권장 다음 행동:

1. MVP-01은 `GO with follow-up`으로 닫는다.
2. #053 오더는 "MVP-02 무료방문견적 신청 + 어드민 접수 큐"로 작성한다.
3. #053 범위에는 고객 신청 폼, profile phone 보정, private media 설계, 어드민 접수 큐, AppSheet 수동 등록 지원 UI를 함께 포함한다.
4. 이메일 보조 로그인은 #053의 필수 구현이 아니라 "도입 시점 결정" 항목으로 둔다.
