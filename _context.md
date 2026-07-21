# 프로젝트 컨텍스트

마지막 업데이트: 2026-07-21

현재 오더: Admin·CMS·Blog 통합 안정화 및 단일 Draft PR 완성

## 작업 기준

- 저장소: `munjanggun`
- 통합 브랜치: `codex/platform-admin-blog-stabilization`
- base: `v2-cms`
- 구현 위치: dedicated linked worktree `platform-admin-blog-stabilization`
- 제품 북극성: `docs/platform/PLATFORM_STRATEGY.md`
- 실행 순서: `docs/platform/PLATFORM_TASKS.md`
- UI 계약: `docs/platform/PLATFORM_UI_CONSTITUTION.md`
- 브랜드 정본: 중앙 브랜드 `e6b6eb6`, DESIGN v5.0, 고유 토큰 114개

## 확인된 현재 상태

- 실제 첫 원고는 `reviewing`, `published_at = null`이다.
- 본문은 27블록, image block 2개, active private media 3개다.
- active media의 public 노출은 0이고 promotion consent는 승인하지 않았다.
- 미사용 공식 자산은 글 연결만 감사 detach했으며 asset record와 file row 3개를 보존했다.
- Preview token·draft showroom 권한 보정 migration `20260721013710`과 공식 자산 공개 파생 경계 migration `20260721015552`를 원격에 적용했고 로컬 version/name과 맞췄다.
- 신규 target migration 정합은 확인했지만, 저장소 전체의 과거 local/remote migration history 차이는 상속 상태로 남아 있어 빈 DB fresh-reset 재현성과 동일한 의미로 보고하지 않는다.
- public cleanup 미해결 감사 이벤트는 0건이다.
- Admin·Blog UI verifier는 CSS 64개와 명명·허용된 layout 예외 37개를 검사하며 현재 정책 위반은 0건이다.
- 통합 Draft PR [#73](https://github.com/westgeneraldoor/munjanggun/pull/73)은 생성됐고 superseded PR과 clean worktree 정리는 끝났다.
- 이전 전체 브라우저 회귀는 실제 환경에서 83/83 통과했다. 이번 보정 diff의 전체 재검증과 독립 재검수는 진행 중이므로 새 최종 통과 수와 미해결 finding 수는 완료 후 확정한다.

## 전달 경계

GitHub CI는 비밀값 없는 정적·단위·타입·lint·build 검증만 맡는다. Supabase 인증이 필요한 전체 Playwright와 원격 DB 검증은 로컬 및 Vercel Preview 증거로 분리한다. 실제 발행, merge, Ready 전환, production 배포는 이 오더에 포함하지 않는다.

## 다음 단계

보정 diff 전체 재검증 → 독립 재검수 → commit/push → Draft PR #73 CI·Vercel Preview QA → Draft 재검수 결과에 따른 Ready 판단 순서로 진행한다. 이 오더에서는 Ready 전환 자체를 수행하지 않는다.
