# 현재 작업 오더 - Admin·CMS·Blog 통합 안정화

발행: 2026-07-21

브랜치: `codex/platform-admin-blog-stabilization`

base: `v2-cms`

상태: 구현·원격 DB·로컬 브라우저 검증 완료, 단일 Draft PR 패키징 중

## 목표

승인된 Admin·CMS·Blog·공식 브랜드 자산·GIF 작업을 하나의 안전한 통합 변경으로 정리한다. 로컬 migration ledger와 원격 Supabase를 맞추고, Admin과 공개 Blog를 중앙 Editorial Showroom v5 토큰 정책에 연결하며, 실제 첫 원고는 발행하지 않은 `reviewing` 상태로 보존한다.

## 현재 완료 범위

- 로컬·원격 target migration version/name 정합
- 관리자 원자 저장 RPC와 Storage·lease·Preview·공식 자산 경계 원격 적용
- public derivative 정리의 crash-safe 감사 이벤트와 재조정 계약
- 실제 원고 27블록, image block 2개, active private media 3개 유지
- 미사용 공식 자산 연결의 감사 detach와 원본·파일 record 보존
- Admin·Blog CSS 64개 재귀 정책 검사, 명명 layout 예외 45개
- visible interaction 44px, 키보드·모달·Sidebar·모바일 overflow 검증
- secretless CI, 정적·타입·lint·build, 인증/공개 Playwright 검증
- UI·DB/security 독립 재검토 완료

## 남은 실행 순서

1. 전체 변경을 한 커밋 경계로 stage하고 migration rename을 staged diff에서 재확인한다.
2. 원격 브랜치에 push한다.
3. `v2-cms` 대상 단일 Draft PR을 만들고 CI·Vercel Preview를 확인한다.
4. Preview 공개 Blog와 인증 경계를 실제 브라우저에서 재검수한다.
5. 새 Draft PR 링크를 남긴 뒤 superseded Draft PR #34–#72를 닫는다.
6. 원격 보존을 확인한 clean superseded worktree만 `git worktree remove`로 정리한다.

## 금지

- PR merge 또는 Draft → Ready 전환
- production 배포
- 실제 원고의 `ready`/`published` 전환이나 미디어 공개 승격
- 중앙 브랜드 저장소 수정
- dirty worktree 삭제·reset·checkout
- 서비스 role key, 비밀번호, 쿠키, token 기록

## 완료 기준

`v2-cms` 대상 단일 Draft PR이 존재하고 CI·Preview QA가 통과하며, superseded PR과 clean worktree가 안전하게 정리되고, 원본 루트·중앙 브랜드·보존 대상 dirty worktree가 변경되지 않은 상태다.
