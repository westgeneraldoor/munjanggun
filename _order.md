# 현재 작업 오더 - Admin·CMS·Blog 통합 안정화

발행: 2026-07-21

브랜치: `codex/platform-admin-blog-stabilization`

base: `v2-cms`

상태: Draft PR #73 후속 보정 구현·원격 DB 적용 완료, 전체 재검증·독립 재검수 중

## 목표

승인된 Admin·CMS·Blog·공식 브랜드 자산·GIF 작업을 하나의 안전한 통합 변경으로 정리한다. 이번 통합 target migration의 version/name과 원격 Supabase 적용 상태를 맞추고, Admin과 공개 Blog를 중앙 Editorial Showroom v5 토큰 정책에 연결하며, 실제 첫 원고는 발행하지 않은 `reviewing` 상태로 보존한다. 저장소 전체의 과거 local/remote migration history 차이는 별도 상속 상태이며 이 오더에서 빈 DB fresh-reset 정합까지 주장하지 않는다.

## 현재 완료 범위

- 로컬·원격 target migration version/name 정합
- 관리자 원자 저장 RPC와 Storage·lease·Preview·공식 자산 경계 원격 적용
- public derivative 정리의 crash-safe 감사 이벤트와 재조정 계약
- 실제 원고 27블록, image block 2개, active private media 3개 유지
- 미사용 공식 자산 연결의 감사 detach와 원본·파일 record 보존
- Admin·Blog CSS 64개 재귀 정책 검사, 명명·허용된 layout 예외 37개, 정책 위반 0개
- visible interaction 44px, 키보드·모달·Sidebar·모바일 overflow 검증
- secretless CI, 정적·타입·lint·build, 인증/공개 Playwright 검증
- 통합 Draft PR [#73](https://github.com/westgeneraldoor/munjanggun/pull/73) 생성 및 superseded PR·clean worktree 정리
- 일반 authenticated의 Preview token·draft showroom 접근 차단과 anon 공개 범위 유지
- 공식 자산·usage·공개 파생 파일을 정확한 published media 계약으로 제한
- Production `/test-fixtures/**` 중앙 404 경계와 Secretless CI 회귀검증 추가

## 남은 실행 순서

1. 신규 RLS 역할 행렬과 전체 non-browser·타입·lint·build·인증 Playwright를 다시 실행한다.
2. DB/RLS, UI/accessibility/Production route, 원고 불변성, migration ledger, 전체 diff를 독립 재검수한다.
3. 보정 변경을 커밋하고 기존 원격 브랜치에 push한다.
4. Draft PR #73의 동일 Secretless workflow push/pull_request 실행과 Vercel Preview를 확인한다.
5. Preview 공개 Blog·인증 경계와 `/test-fixtures/**` 전체 404를 실제 환경에서 재검수한다.
6. 재검수 결과를 근거로 다음 승인 단계인 Draft → Ready 판단을 요청한다. 이 오더에서는 Ready 전환하지 않는다.

## 금지

- PR merge 또는 Draft → Ready 전환
- production 배포
- 실제 원고의 `ready`/`published` 전환이나 미디어 공개 승격
- 중앙 브랜드 저장소 수정
- dirty worktree 삭제·reset·checkout
- 서비스 role key, 비밀번호, 쿠키, token 기록

## 완료 기준

`v2-cms` 대상 Draft PR #73의 보정 CI·Preview QA와 독립 재검수가 통과하고, PR은 Draft·OPEN·CLEAN을 유지하며, 실제 원고는 `reviewing`으로 보존되고, 원본 루트·중앙 브랜드·보존 대상 dirty worktree가 변경되지 않은 상태다.
