# 프로젝트 컨텍스트
📅 마지막 업데이트: 2026-04-28
📋 마지막 오더: #018

## 현재 상태
V2 Phase 2-1 완료. 어드민 노드 관리(목록/CRUD/탭관리) 동작 확인. Supabase showroom 스키마 Exposed + GRANT 완료. 노드 편집 폼(Phase 2-2) 진입 대기.

## 최근 완료 (최대 5건)
- #018 V2 Phase 2-1: 노드 목록 + CRUD ✅ (4/5) — 탭관리+자식CRUD+정렬 (2026-04-28)
- #017 V2 Phase 1-2: 데이터 마이그레이션 ✅ (5/5) — 25노드+126갤러리 (2026-04-28)
- #016 V2 Phase 1-1: showroom 스키마 생성 ✅ (5/5) — 6테이블+RLS+함수 (2026-04-28)
- #015 V2 Phase 0: 기반 설정 ✅ (5/5) — 브랜치+디렉토리+placeholder (2026-04-28)
- V2 PRD + 디자인시스템 확정 (2026-04-28)

## 핵심 결정 (최대 5개)
- Supabase Exposed schemas: showroom 추가 필수 | 사유: PostgREST 406 방지
- GRANT 패턴: 공식 문서 전체 권한 부여 (anon/authenticated/service_role) | 사유: 커스텀 스키마 접근
- V2 브랜치 전략: v2-cms 브랜치 분리 | 사유: V1 프로덕션 실사용 중
- DB 마이그레이션: UUID 보존 전략 | 사유: 매핑 테이블 불필요
- Supabase 클라이언트: 모든 쿼리에 .schema('showroom') 명시 필수 | 사유: 멀티스키마 환경

## 다음 할 일 (우선순위 순)
1. 🔄 **Phase 2-2: 노드 편집 폼 + 히어로/갤러리**
2. ⬜ Phase 3: 고객 Catch-all 라우팅

## 현재 이슈
- 노드 편집 페이지(/admin/nodes/[id]) 미구현 → Phase 2-2에서 구현 예정

## 교훈 & 주의사항
- ⚠️ Supabase 커스텀 스키마 사용 시 반드시: (1) Dashboard Exposed schemas 추가 (2) GRANT 전체 부여 (3) 코드에서 .schema() 명시
- ⚠️ 빌드 성공 ≠ 동작 성공. 인프라 설정 누락은 빌드에 안 잡힘
- ⚠️ 총괄 오더에 인프라 체크리스트 필수 포함할 것
