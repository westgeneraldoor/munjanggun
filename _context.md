# 프로젝트 컨텍스트
📅 마지막 업데이트: 2026-05-30
📋 마지막 오더: #052 MVP-01 카카오 로그인 기반 구축

## 현재 상태
V2 쇼룸은 `v2-cms` 기준 Phase 5-B까지 완료된 상태다. 현재는 `platform-v1` 브랜치에서 쇼룸을 Public Experience로 계승하면서 플랫폼 MVP로 확장하는 작업을 진행 중이다. 플랫폼 기준 문서는 `docs/platform/`으로 모았고, 플랫폼 제작 일정의 기준은 `docs/platform/PLATFORM_TASKS.md`로 분리했다.

## 최근 완료 (최대 5건)
- 플랫폼 문서 폴더 정리와 전용 태스크 보드 작성
- `PROJECT_TASKS.md`를 쇼룸 히스토리 + 플랫폼 태스크 포인터로 축소
- 어드민을 플랫폼의 실제 운영 엔진으로 재정의
- 결제 이후 AS/후기/사진/홍보동의 흐름을 후속 MVP로 반영
- `docs/platform/DEVELOPMENT_STRATEGY.md`로 AI 역할 분담과 개발 운영 전략 저장

## 핵심 결정 (최대 5개)
- `docs/platform/PLATFORM_STRATEGY.md`는 PRD보다 상위 기준 문서이며, 플랫폼의 목적은 쇼핑몰이 아니라 고객 여정 통합이다.
- `docs/platform/PLATFORM_TASKS.md`는 플랫폼 제작 일정과 페이즈의 기준 문서다.
- `docs/platform/DEVELOPMENT_STRATEGY.md`는 Codex/Gemini/Claude/GPT 역할 분담과 작업 운영 기준이다.
- 기존 쇼룸 V2와 CMS 자산은 Public Experience로 유지하고, 플랫폼 고객 데이터는 신규 `platform` 스키마로 분리한다.
- MVP-01 로그인은 카카오만 구현하고, Google/Naver 간편로그인은 후속 확장 시점에 함께 검토한다.

## 다음 할 일 (우선순위 순)
1. ⬜ 제품/개발전략 문서 반영 커밋/푸시
2. ⬜ Gemini Flash 3.5 High 작업자에게 `_order.md` #052 실행
3. ⬜ Codex가 MVP-01 결과 검수
4. ⬜ MVP-02 무료방문견적 신청 + 어드민 접수 큐 오더 협의

## 현재 이슈
- `docs/platform/PLATFORM_DB_RBAC_DESIGN.md`는 최소 설계 문서이며, 다음 구현 오더에서 실제 migration SQL을 작성해야 한다.
- Naver 로그인은 Supabase built-in provider가 아니므로 MVP-01 블로커로 두지 않고 Google 확장 시점에 함께 검토한다.

## 미결정 사항
- 결제 전 설문 기본 선택지 최종 문구
- 후기 요청 링크 발송 주체: 영업 담당자 / 관리부 / n8n 자동화
- 홍보 활용 동의를 자연스럽게 받는 문구와 타이밍
- AppSheet 장기 연동/흡수 우선순위
