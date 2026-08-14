# TASK-20260723-01 관리자 CMS Ready 게이트

## 작업 정보

- 상태: 검수 중
- 현재 역할: 작업자
- 검수 필요: 예
- 현재 반복 이슈: PR 병합 충돌과 런타임 상태 전이·서버 쿼리 회귀
- 동일 이슈 시도 횟수: 0
- 생성일: 2026-07-23
- 최근 수정일: 2026-07-25

## 원래 요청

기존 `codex/admin-cms-workflow-ux` 브랜치와 Draft PR #84를 그대로 이어서 작업한다.

Ready 전 다음을 완료한다.

1. 안전한 인증 관리자 환경에서 1366px·390px 블로그 큐, 편집기, 사진보관함, 저장 revision, stale 복구, 발행 전 검사, 선택·휴지통 UX, 키보드·포커스, loading, intent prefetch를 검증하고 스크린샷·콘솔·overflow·실패 네트워크·prefetch 증거를 남긴다.
2. 사진 검색·필터·정렬·전체 건수·페이지 분할을 서버 전체 데이터셋 기준으로 구현하고 공유 가능한 URL 상태와 결정적 보조 정렬을 적용한다. 현재 페이지 전체 선택과 검색 결과 전체 선택을 구분하고 파괴적 작업 직전 서버에서 대상 수와 참조 상태를 재검사한다.
3. Production이 아닌 격리 Supabase에 PR #84 migration을 적용하고 두 독립 세션에서 저장·발행·사진 참조·cleanup·RLS·멱등성 경쟁을 검증한다. 환경이 없으면 Production에 적용하지 않고 정확한 차단 사유를 보고한다.
4. 모든 수정 후 CI, lint, typegen, TypeScript, production build, migration 계약 테스트를 재실행하고 독립 검수 P0/P1/P2가 0일 때만 관리자에게 보고한다.

금지: 새 브랜치·새 PR, PR #83 migration 변경·중복, Production 데이터 변경, 실제 첫 원고 변경, force push, Ready 전환, 병합, Production 배포, 기존 root·다른 worktree 변경.

## 관리자 작업오더

### 목표

PR #84가 Ready 전환 가능한 수준의 브라우저·전체 데이터셋·격리 DB 경쟁 증거를 갖추게 한다.

### 작업 범위

사용자의 원래 요청 전체.

### 제외 범위

금지사항 전체.

### 완료 조건

사용자의 검증 항목과 재검증을 충족하고 독립 검수 P0/P1/P2가 0이다.

### 검증 방법

인증 브라우저, 서버 쿼리 계약 테스트, 실제 격리 Supabase 두 세션, CI와 로컬 정적·빌드 검증.

## 작업자 결과 보고

### 받은 작업오더 요약

PR #84를 유지한 채 사진보관함의 검색·필터·정렬·페이지 분할을 서버 전체 데이터 기준으로 바꾸고, 인증 브라우저와 실제 격리 Supabase 경쟁 검증까지 Ready 게이트로 확인한다.

### 수행한 작업

- URL search params 기반 검색·상세 필터·6개 정렬·페이지 분할·전체 결과 수를 구현했다.
- 파일명 검색·정렬은 업로드 이벤트에 보존된 원본 파일명을 우선하고, 파일 크기는 원본 파일 크기를 우선하며 기존 자산은 안전하게 대체값을 사용한다.
- 동일 정렬값에서 `asset_id ASC`를 결정적 보조 정렬로 사용했다.
- 현재 페이지 전체 선택과 검색 결과 전체 선택을 분리하고 범위를 화면과 확인창에 표시했다.
- 전체 결과 파괴 작업은 서버가 검색 조건을 다시 해석하고, 확인 시점의 전체 결과 수와 정렬된 UUID 집합 토큰을 모두 재검사한 뒤 기존 참조 잠금 RPC를 호출하도록 했다.
- 검색어 초안과 서버 결과 범위가 어긋나거나 화면 전환 중이면 선택·확인 상태를 초기화하고 파괴 작업을 비활성화했다.
- Windows CRLF에서도 공식 미디어 문서 계약 테스트가 동일하게 동작하도록 읽기 입력을 정규화했다.
- PR #83 hidden asset allowlist migration은 변경하지 않았다.

### 변경한 파일

- `src/app/admin/platform/assets/ContentAssetsClient.tsx`
- `src/app/admin/platform/assets/actions.ts`
- `src/app/admin/platform/assets/assets.module.css`
- `src/app/admin/platform/assets/library-data.ts`
- `src/app/admin/platform/assets/page.tsx`
- `src/app/admin/platform/assets/query-state.ts`
- `supabase/migrations/20260723081337_content_asset_library_server_query.sql`
- `scripts/test-admin-assets-primitives.mjs`
- `scripts/test-content-asset-library-query.mjs`
- `scripts/test-content-asset-library-query-runtime.mjs`
- `scripts/test-content-asset-query-state.mjs`
- `scripts/test-official-media-evidence-docs.mjs`
- `tests/platform-admin-assets.spec.ts`
- `.github/workflows/ci.yml`
- `package.json`

### 실행한 검증

- CI의 정적·마이그레이션·브랜드 계약 31개
- `npx next typegen`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- PGlite 서버 전체 데이터 쿼리 런타임
- 독립 UI 검수와 DB 검수

### 검증 결과

- CI 계약 31/31 통과
- typegen, TypeScript, production build 통과
- lint 0 errors, 기존 범위 밖 경고 1건
- 110개 합성 인메모리 행에서 48/48/9 페이지, 6개 정렬, 검색·필터, 정확한 결과 수, 동일 건수 결과 교체 거부 통과
- 독립 UI 검수 P0=0, P1=0, P2=0
- 독립 DB 검수 P0=0, P1=0, P2=0

### 작업오더와 달라진 부분

- 인증 관리자 브라우저 검증은 브라우저 제어 런타임 초기화가 `failed to write kernel assets: 지정된 경로를 찾을 수 없습니다. (os error 3)`로 실패해 수행하지 못했다.
- 실제 격리 Supabase 두 세션 검증은 연결 가능한 환경이 Production main 하나뿐이고 로컬 Docker daemon·Supabase config·직접 DB 세션이 없어 수행하지 못했다.
- PGlite 결과는 서버 쿼리와 마이그레이션 계약 증거로만 사용했으며 실제 Supabase 경쟁/RLS 증거로 취급하지 않았다.

### 남은 문제 또는 위험

- 1366px·390px 인증 화면 스크린샷, 콘솔·overflow·실패 네트워크·intent prefetch 증거가 없다.
- PostgreSQL 17/PostgREST/Auth/Storage가 포함된 격리 Supabase에서 두 독립 세션 경쟁·RLS·멱등성 검증이 남아 있다.
- 새 migration은 코드에만 있으며 Production DB에 적용하지 않았다.
- 위 두 외부 게이트가 해소될 때까지 PR #84는 Draft이고 Ready 전환할 수 없다.

### 2026-07-25 후속 작업 결과

- 1366px에서 사진보관함 카드·키보드·체크박스 Shift 범위 선택, 이미지 내부 시작 마우스 드래그 선택과 가시 선택 사각형을 실제 인증 로컬 UI로 재현·수정했다.
- 표준 UUID가 잘못된 정규식 때문에 archive/restore RPC 전에 거부되던 결함을 수정했다. 연결된 로컬 블로그 사진은 실제 RPC 응답의 사용처를 모달에 표시하고, `사용처 보기`가 해당 영역으로 포커스를 옮기는 것을 확인했다.
- 390px 터치에서 두 사진을 선택하고 overflow가 없음을 확인했다. 블로그 큐는 980px 이상에서 모바일 목록을 숨기고 979px 이하에서 표를 숨기는 DOM·가시성 계약을 추가했다.
- blog trash 동시 전이의 도메인 오류는 UI에 원문을 노출하지 않고 복구 안내 문구로 바꾸는 정적 RPC 계약을 추가했다.
- 실제 로컬 Postgres 17/Supabase 체인 재구축 뒤 PostgREST REST 200을 확인했고, 인증 브라우저 4개 테스트와 CI 정적 계약, `next typegen`, TypeScript, lint, production build를 통과했다. Production에는 접속하거나 변경하지 않았다.

### 다음 검수 인계

- 검수 대상: 이번 커밋의 사진보관함 범위/드래그/휴지통 UX, 390px 터치 선택, 블로그 큐 980px 경계 가시성, blog trash 오류 문구 계약.
- 재현 명령: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 PLAYWRIGHT_LOCAL_FIXTURES=1 npx playwright test tests/platform-admin-assets.spec.ts tests/blog-queue-list-primitives.spec.ts --workers=1`.
- 남은 승인 게이트: 독립 코드 검수, Draft PR #84 유지 상태에서 사용자 승인 후 Ready/병합 여부 결정, Production 미적용 상태 유지. 실제 동시 요청 레이스의 화면 재현은 별도 테스트용 경쟁 주입 환경이 필요하며, 이번에는 원문 비노출 정적 계약만 확인했다.

## 검수 결과

### 판정

코드 독립 검수 합격. 외부 실행 환경 게이트는 차단 상태.

### 충족한 완료 조건

- 서버 전체 데이터 검색·필터·정렬·카운트·안정적 페이지 분할
- 공유 가능한 URL 상태
- 현재 페이지와 검색 결과 전체 선택 범위 분리
- 파괴 작업 전 서버 결과 집합·참조 상태 재검사
- 로컬 CI·정적 검사·production build
- P0/P1/P2 0

### 발견한 문제

- 같은 건수로 검색 결과 구성원이 교체될 때 count-only 확인이 통과할 수 있었음
- 검색 debounce 중 이전 결과 범위의 파괴 작업이 잠시 활성 상태였음
- 전체 결과 선택이 개별 카드 조작으로 암묵적으로 축소될 수 있었음
- 검색 초기화를 effect에서 수행해 lint 규칙을 위반했음

### 검수자가 직접 수정한 내용

없음. 작업자가 지적을 TDD로 수정하고 재검수를 받음.

### 검증 방법과 결과

- DB 재검수: P0=0, P1=0, P2=0
- UI 재검수: P0=0, P1=0, P2=0

### 남은 불확실성

인증 브라우저와 실제 격리 Supabase 실행 증거.

## 관리자 최종 결정

### 결정

### 결정 이유

### 추가 작업오더

## 변경 이력

- 역할: 작업자
- 변경 내용: 사용자 후속 관리자 오더를 작업 중 TASK로 기록
- 검증: 기존 브랜치·Draft PR #84·clean worktree 상태 확인
- 역할: 작업자
- 변경 내용: 서버 전체 데이터 쿼리와 안전한 전체 결과 작업을 구현하고 독립 검수 P0/P1/P2를 0으로 해소
- 검증: CI 계약 31개, typegen, TypeScript, lint, production build, PGlite 계약 검증
- 역할: 작업자
- 변경 내용: 인증 브라우저와 실제 격리 Supabase 환경 부재로 상태를 차단으로 전환
- 검증: Production main 외 branch 없음, Docker daemon·Supabase local config 없음, 브라우저 런타임 초기화 실패
- 역할: 작업자
- 변경 내용: 사용자 재검수 오더로 작업을 재개하고 P1-a(merge conflict), P1-b(검색 focus), P1-c(발행 후 revision), P2(facet 범위·쿼리 비용)를 현재 범위에 추가
- 검증: 사용자 제공 코드 위치·재현 조건을 작업 기준으로 등록, Production·Ready·PR merge·force push 금지 유지
- 역할: 작업자
- 변경 내용: 실제 인증 로컬 UI에서 사진보관함 Shift 범위·드래그·터치 선택과 archive 사용처 표시를 복구하고, 블로그 큐 desktop/mobile 중복 목록을 수정
- 검증: 로컬 Postgres 17/Supabase 체인·PostgREST REST 200, Playwright 4/4, CI 정적 계약, next typegen, TypeScript, lint, production build
- 역할: 작업자
- 변경 내용: 작업 카드를 검수 중으로 전환하고 독립 검수·사용자 Ready/병합 승인 게이트를 기록
- 검증: Draft PR #84·기존 브랜치 유지, Production/다른 worktree/root dirty 파일 미변경
