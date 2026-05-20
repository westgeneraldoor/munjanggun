# 문장군 디지털 쇼룸 V2 작업 현황

마지막 업데이트: 2026-05-20
현재 기준 브랜치: `v2-cms`
현재 정리 브랜치: `codex-v2-cms-cleanup`

> V1 디지털 컬러북 히스토리는 `_archive.md`에 보관한다.

## 기준선 정리

- [x] `v2-cms`를 현재 운영 기준으로 확정
- [x] V1/V2 문서 혼선 확인
- [x] README를 V2 디지털 쇼룸 기준으로 교체
- [x] `_context.md`를 2026-05-20 기준으로 갱신
- [x] 생성 산출물과 실제 소스 기준을 분리
- [x] Supabase advisor 기준 위험 항목 문서화
- [x] lint/build 검증 완료
- [x] Supabase preview token RLS 하드닝 마이그레이션 설계

## V2 Phase 0: 기반 설정

- [x] Git 브랜치 `v2-cms` 생성
- [x] package.json 정리
- [x] V2 디렉터리 구조 추가
- [x] constants.ts 생성
- [x] catch-all `[...slugs]` 라우트 기반 구성
- [x] `/admin/nodes` 라우트 기반 구성

## V2 Phase 1: 데이터베이스와 인증

- [x] `showroom` 스키마 생성
- [x] `nodes`, `hero_media`, `site_hero_media`, `gallery_photos`, `preview_tokens`, `site_settings` 구성
- [x] `is_node_visible()` PostgreSQL 함수 구성
- [x] slug/status 제약과 인덱스 구성
- [x] RLS 기본 정책 구성
- [x] TypeScript DB 타입 생성
- [x] V1에서 V2로 데이터 마이그레이션
- [x] 마이그레이션 검증
- [x] `preview_tokens` anon 정책 최소 권한화
- [x] FK 인덱스 누락 여부 재점검

### Supabase advisor 메모

- `showroom.preview_tokens`의 anon 직접 읽기 정책은 제거하고, 토큰 기반 미리보기는 `showroom.get_preview_payload(p_token)` RPC로 처리한다.
- `showroom.is_node_visible(uuid)`는 exposed schema의 SECURITY DEFINER 함수이며 anon/authenticated에서 직접 RPC 실행 가능 경고가 있다. RLS 내부 전용이라면 직접 실행 권한을 회수하거나 private schema로 옮기는 방안을 검토한다.
- `showroom.get_preview_payload(text)`는 의도적으로 노출된 SECURITY DEFINER RPC다. anon은 토큰 테이블을 직접 읽을 수 없고, 이 함수로 정확한 토큰 하나에 대한 preview payload만 받을 수 있다.
- `showroom.gallery_photos.node_id`, `showroom.hero_media.node_id`, `showroom.preview_tokens.node_id`는 FK 인덱스 보강 대상이며 마이그레이션에 포함한다.

## V2 Phase 2: 관리자 CMS

- [x] 관리자 레이아웃과 auth guard
- [x] `/admin`에서 `/admin/nodes` 리다이렉트
- [x] 노드 CRUD와 상태 전환
- [x] 최상위 노드 정렬과 삭제 관리
- [x] Supabase exposed schema와 grant 설정
- [x] 노드 편집 폼
- [x] 히어로 설정 UI
- [x] 이미지 업로드와 자동 정렬
- [x] 갤러리 관리
- [x] 미리보기 토큰 생성 워크플로우
- [x] 사이트 설정 관리
- [x] 노드 부모 이동 기능
- [x] NodeList 헤더 탐색 리팩터링

## V2 Phase 3: 고객 페이지

- [x] 메인 페이지 V2 전환
- [x] catch-all 라우트와 노드 해석 로직
- [x] 범용 리스트 페이지
- [x] 범용 상세 페이지
- [x] 스크롤 애니메이션
- [x] 라이트박스
- [x] CTA 바
- [x] 동적 OG 메타 태그
- [x] 토큰 미리보기 페이지
- [x] V1 URL 301 리다이렉트
- [x] V1 전용 라우트와 컴포넌트 정리

## V2 Phase 4: 검증과 안정화

- [x] V1 잔재 정리
- [x] 코드 위생 개선
- [x] Playfair Display 적용과 LQIP 프리뷰
- [x] slug 데이터 정리
- [x] 에러 핸들링
- [x] 접근성 기본 확인
- [ ] EVAL-01 ~ EVAL-21 필수 검증
- [ ] 카카오톡 인앱 브라우저 호환 테스트
- [ ] 이미지 로딩 성능 확인
- [ ] 최종 빌드 후 배포 기준 확인

## V2 Phase 5-A: 시네마틱 갤러리 경험

- [x] 카드 스태거 리빌과 호버 강화
- [x] 갤러리 시네마틱 스크롤
- [x] 히어로 캔버스와 페이지 미세 연출
- [x] 히어로 문구 고도화
- [x] CTA 바 프리미엄 정리
- [x] 그리드 규칙 정리

## V2 Phase 5-B: 매끄러운 전환

- [x] View Transitions API 기반 설정
- [x] 페이지 전환
- [x] 카드와 페이지 공유 요소 전환
- [x] listing 카드 이중 애니메이션 충돌 수정
- [x] 전환 방향과 이미지 정리
- [x] 공유 요소 전환 줄이기
- [x] ScrollToTop 버튼과 CTA 앵커 버튼
- [x] CTA 바와 힌트 라인 미니멀 리디자인
- [x] 4개 그리드 2열 중앙 배치 보정

## 이번 정리 작업

- [x] V2 기준선 문서화
- [x] ESLint ignore 범위 보강
- [x] `ScrollToTop` hover 토큰 추가
- [x] `ImageLightbox` lint disable 제거
- [x] 미리보기 페이지 CSS Module 정리
- [x] Supabase RLS/advisor 위험 항목 문서화
- [x] lint/build 실행

## 마일스톤 기록

| 날짜 | 마일스톤 | 비고 |
| --- | --- | --- |
| 2026-04-27 | V1 완료 및 배포 | 디지털 컬러북 MVP |
| 2026-04-28 | V2 PRD 확정 | 페이지 빌더형 디지털 쇼룸 |
| 2026-04-28 | V2 개발 시작 | `v2-cms` |
| 2026-04-28 | V2 Phase 1 완료 | showroom 스키마와 마이그레이션 |
| 2026-04-28 | V2 Phase 2 완료 | 관리자 CMS |
| 2026-04-28 | V2 Phase 3 완료 | 고객 페이지 |
| 2026-04-30 | V2 Phase 5-A 완료 | 시네마틱 갤러리 |
| 2026-05-06 | V2 Phase 5-B 완료 | View Transitions |
| 2026-05-19 | Phase 4 안전망 및 접근성 보강 | #052 |
| 2026-05-20 | V2 교통정리 시작 | 문서/린트/코드 부채 정리 |
