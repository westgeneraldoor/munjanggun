# 프로젝트 컨텍스트
📅 마지막 업데이트: 2026-05-30
📋 마지막 오더: #052 MVP-01 OAuth 로그인 기반 구축

## 현재 상태
V2 쇼룸은 `v2-cms` 기준 Phase 5-B까지 완료된 상태다. 현재는 `platform-v1` 브랜치에서 쇼룸을 Public Experience로 계승하면서 플랫폼 MVP로 확장하는 작업을 진행 중이다. 플랫폼 기준 문서는 `docs/platform/`으로 모았고, 플랫폼 제작 일정의 기준은 `docs/platform/PLATFORM_TASKS.md`로 분리했다.

## 최근 완료 (최대 5건)
- 플랫폼 문서 폴더 정리: `docs/platform/`, `docs/showroom/`, `docs/archive/showroom/`
- 플랫폼 전용 태스크 보드 작성: `docs/platform/PLATFORM_TASKS.md`
- `PROJECT_TASKS.md`를 쇼룸 히스토리 + 플랫폼 태스크 포인터로 축소
- 플랫폼 기준 문서 경로 갱신
- MVP-01 OAuth 로그인 구현 오더 유지: `_order.md` #052

## 핵심 결정 (최대 5개)
- `docs/platform/PLATFORM_STRATEGY.md`는 PRD보다 상위 기준 문서이며, 플랫폼의 목적은 쇼핑몰이 아니라 고객 여정 통합이다.
- `docs/platform/PLATFORM_TASKS.md`는 플랫폼 제작 일정과 페이즈의 기준 문서다.
- 기존 쇼룸 V2는 폐기하지 않고 플랫폼의 Public Experience로 유지한다.
- 기존 `showroom`/CMS 자산은 유지하고, 플랫폼 고객 데이터는 신규 `platform` 스키마로 분리한다.
- OAuth는 Kakao 우선, Google 보조, Naver는 `custom:naver` 후속 후보로 본다.

## 다음 할 일 (우선순위 순)
1. ⬜ 문서 구조 정리 커밋/푸시
2. ⬜ MVP-01 OAuth 로그인 구현
3. ⬜ MVP-02 무료실측 신청 구현
4. ⬜ AppSheet 전산과 플랫폼 DB의 관계 결정
5. ⬜ MVP-03 관리자/영업 매니저 접수 확인

## 현재 이슈
- `docs/platform/PLATFORM_DB_RBAC_DESIGN.md`는 최소 설계 문서이며, 다음 구현 오더에서 실제 migration SQL을 작성해야 한다.
- Naver 로그인은 Supabase built-in provider가 아니므로 MVP-01 블로커로 두지 않는다.

## 미결정 사항
- Kakao + Google을 MVP-01에 동시에 넣을지 여부
- Naver `custom:naver` OAuth를 어느 시점에 붙일지
- AppSheet 연동/수동 병행/대체 방향
- 토스페이먼츠 결제/취소/환불/웹훅 운영 범위
