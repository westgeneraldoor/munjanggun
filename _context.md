# 프로젝트 컨텍스트
📅 마지막 업데이트: 2026-05-30
📋 마지막 오더: #052 MVP-01 카카오 로그인 기반 구축

## 현재 상태
V2 쇼룸은 `v2-cms` 기준 Phase 5-B까지 완료. 현재는 `platform-v1`에서 쇼룸을 Public Experience로 계승하면서 플랫폼 MVP로 확장 중이다. 플랫폼 기준 문서는 `docs/platform/`, 제작 일정 기준은 `docs/platform/PLATFORM_TASKS.md`다.

## 최근 완료
- `PROJECT_TASKS.md`를 쇼룸 히스토리 + 플랫폼 태스크 포인터로 축소
- 어드민을 플랫폼의 실제 운영 엔진으로 재정의
- 결제 이후 AS/후기/사진/홍보동의 흐름을 후속 MVP로 반영
- `docs/platform/DEVELOPMENT_STRATEGY.md`를 가벼운 AI 작업 운영 규칙으로 축소
- MVP-01 카카오 로그인 기반 코드 구현 및 Codex PM 검수

## 핵심 결정
- `PLATFORM_STRATEGY.md`는 PRD보다 상위 기준이며, 목적은 쇼핑몰이 아니라 고객 여정 통합이다.
- `PLATFORM_TASKS.md`는 플랫폼 제작 일정과 페이즈의 기준 문서다.
- 기존 쇼룸/CMS는 Public Experience로 유지하고, 플랫폼 고객 데이터는 신규 `platform` 스키마로 분리한다.
- MVP-01 로그인은 카카오만 구현하고, Google/Naver 간편로그인은 후속 확장 시점에 함께 검토한다.
- 작업자는 Gemini Flash 3.5 High, Codex는 총괄 감리, Claude는 필요 시 선택 호출한다.

## 다음 할 일
1. ⬜ Supabase migration 적용 및 `platform` exposed schema 설정 확인
2. ⬜ Kakao 개발자 센터/Supabase Auth Kakao provider 설정
3. ⬜ 실제 Kakao OAuth 로그인으로 `platform.profiles` row 생성 확인
4. ⬜ MVP-02 무료방문견적 신청 + 어드민 접수 큐 오더 협의

## 현재 이슈
- MVP-01 코드는 준비됐지만, Supabase CLI가 로컬에 없어 migration 적용 검증은 아직 수행하지 못했다.
