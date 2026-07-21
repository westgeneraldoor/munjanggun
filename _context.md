# 프로젝트 컨텍스트

마지막 업데이트: 2026-07-21

현재 오더: Admin·CMS·Blog 통합 안정화 및 단일 Draft PR 완성

## 작업 기준

- 저장소: `munjanggun`
- 통합 브랜치: `codex/platform-admin-blog-stabilization`
- base: `v2-cms`
- 구현 위치: clean linked worktree `platform-admin-blog-stabilization`
- 제품 북극성: `docs/platform/PLATFORM_STRATEGY.md`
- 실행 순서: `docs/platform/PLATFORM_TASKS.md`
- UI 계약: `docs/platform/PLATFORM_UI_CONSTITUTION.md`
- 브랜드 정본: 중앙 브랜드 `e6b6eb6`, DESIGN v5.0, 고유 토큰 114개

## 확인된 현재 상태

- 실제 첫 원고는 `reviewing`, `published_at = null`이다.
- 본문은 27블록, image block 2개, active private media 3개다.
- active media의 public 노출은 0이고 promotion consent는 승인하지 않았다.
- 미사용 공식 자산은 글 연결만 감사 detach했으며 asset record와 file row 3개를 보존했다.
- target migration 14개는 원격 version과 일치하고 마지막 version은 `20260720084910`이다.
- public cleanup 미해결 감사 이벤트는 0건이다.
- Admin·Blog UI verifier는 CSS 64개와 명명 layout 예외 45개를 검사한다.
- 전체 브라우저 회귀는 실제 환경에서 83/83 통과했다.
- UI와 DB/security 독립 재검토의 미해결 finding은 0건이다.

## 전달 경계

GitHub CI는 비밀값 없는 정적·단위·타입·lint·build 검증만 맡는다. Supabase 인증이 필요한 전체 Playwright와 원격 DB 검증은 로컬 및 Vercel Preview 증거로 분리한다. 실제 발행, merge, Ready 전환, production 배포는 이 오더에 포함하지 않는다.

## 다음 단계

staged diff 재검수 → commit/push → 단일 Draft PR → CI/Vercel Preview QA → superseded Draft PR 정리 → clean superseded worktree 정리 순서로 진행한다.
