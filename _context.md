# 프로젝트 컨텍스트
📅 마지막 업데이트: 2026-05-29
📋 마지막 오더: #052 MVP-01 OAuth 로그인 기반 구축

## 현재 상태
V2 쇼룸은 `v2-cms` 기준 Phase 5-B까지 완료된 상태다. 현재는 `v2-cms`에서 `platform-v1` 브랜치를 분리했고, 쇼룸을 Public Experience로 계승하면서 플랫폼 MVP로 확장하기 위한 전략/감사/DB-RBAC 문서 베이스라인과 MVP-01 작업 오더를 준비했다.

## 최근 완료 (최대 5건)
- `platform-v1` 브랜치 생성 (`v2-cms` 기반)
- 플랫폼 전략 문서 작성: `PLATFORM_STRATEGY.md`
- 플랫폼 DB/RBAC 설계 문서 작성: `PLATFORM_DB_RBAC_DESIGN.md`
- 플랫폼 전환 감사 보고서 작성/보정: `PLATFORM_MIGRATION_AUDIT.md`
- 플랫폼 기준 PRD 및 Codex 부트스트랩 승격: `PRD_PLATFORM_v1.0.md`, `CODEX_PROJECT_BOOTSTRAP.md`
- MVP-01 OAuth 로그인 구현 오더 작성: `_order.md` #052

## 핵심 결정 (최대 5개)
- `PLATFORM_STRATEGY.md`는 PRD보다 상위 기준 문서이며, 플랫폼의 목적은 쇼핑몰이 아니라 고객 여정 통합이다.
- 기존 쇼룸 V2는 폐기하지 않고 플랫폼의 Public Experience로 유지한다.
- 기존 `showroom`/CMS 자산은 유지하고, 플랫폼 고객 데이터는 신규 `platform` 스키마로 분리한다.
- OAuth는 Kakao 우선, Google 보조, Naver는 `custom:naver` 후속 후보로 본다.
- 고객 현장 사진은 public URL 금지, private `measurement-photos` bucket + signed URL 원칙으로 간다.

## 다음 할 일 (우선순위 순)
1. ⬜ 문서 베이스라인 커밋/푸시/드래프트 PR 생성
2. ⬜ MVP-01 OAuth 로그인 구현
3. ⬜ MVP-02 무료실측 신청 구현 오더 작성
4. ⬜ MVP-02 무료실측 신청 구현
5. ⬜ AppSheet 전산과 플랫폼 DB의 관계 결정

## 현재 이슈
- `PLATFORM_DB_RBAC_DESIGN.md`는 최소 설계 문서이며, 다음 구현 오더에서 실제 migration SQL을 작성해야 한다.
- Naver 로그인은 Supabase built-in provider가 아니므로 MVP-01 블로커로 두지 않는다.

## 미결정 사항
- Kakao + Google을 MVP-01에 동시에 넣을지 여부
- Naver `custom:naver` OAuth를 어느 시점에 붙일지
- AppSheet 연동/수동 병행/대체 방향
- 토스페이먼츠 결제/취소/환불/웹훅 운영 범위
