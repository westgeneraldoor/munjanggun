# 프로젝트 컨텍스트

마지막 업데이트: 2026-05-20
현재 기준: V2 디지털 쇼룸 (`v2-cms`)
현재 정리 작업: `codex-v2-cms-cleanup`

## 프로젝트 이해

문장군은 방문 중문, 도어, 관련 인테리어 상품을 실측 상담, 제작, 시공, A/S까지 연결하는 회사다.

이 프로젝트는 처음에 고객이 종이 컬러북을 직접 보기 어려운 상황을 보완하기 위한 디지털 컬러북 MVP로 출발했다. 고객 반응과 영업부 현장 반응이 좋아지면서, 전체 상품군의 디자인 요소와 컬러 요소를 자유롭게 반영할 수 있는 디지털 쇼룸으로 확장되었다.

현재 제품의 핵심은 개발자가 매번 하드코딩하지 않아도 운영자가 CMS에서 노드를 늘리고, 페이지 구조를 바꾸고, 이미지와 문구를 조정할 수 있는 페이지 빌더형 쇼룸이다.

## 현재 상태

- `v2-cms`가 현재 운영 기준 브랜치다.
- 최근 Vercel 프로덕션 배포도 `v2-cms` 기준으로 확인했다.
- `master`는 V1 디지털 컬러북 히스토리로 본다.
- V1 기록과 작업 히스토리는 `_archive.md`에 보관한다.
- README와 작업 문서는 V2 기준으로 정리 중이다.

## 최근 완료

- #052 Phase 4 안전망 및 접근성 보강 (2026-05-19)
- #051 CTA 바, 힌트 라인, 모바일 브랜드 흐름 정리 (2026-05-06)
- #050 ScrollToTop, CTA 앵커 버튼, 모바일 흐름 보강 (2026-05-06)
- #049 공유 요소 전환 정리, 텍스트 only 히어로 여백 보강 (2026-05-02)
- V2 Phase 5-B View Transitions 기반 페이지 전환 작업 완료

## 현재 교통정리 포인트

- README가 V1 디지털 컬러북 기준으로 남아 있어 V2 기준으로 교체한다.
- `_context.md`, `PROJECT_TASKS.md`의 날짜와 완료 상태를 현재 기준으로 맞춘다.
- ESLint가 `.vercel`, `.agents`, 기타 생성 산출물을 따라가지 않도록 ignore 범위를 정리한다.
- `ScrollToTop.module.css`가 참조하는 `--color-surface-elevated-hover` 토큰을 전역 토큰에 추가한다.
- 미리보기 페이지의 인라인 스타일을 CSS Module로 옮겨 유지보수성을 높인다.
- `ImageLightbox`의 이미지 로드 상태 리셋을 lint disable 없이 표현한다.
- Supabase `showroom.preview_tokens`의 `anon_read_preview_tokens` 정책은 제거했다. 미리보기는 `showroom.get_preview_payload(p_token)` RPC로 정확한 토큰 하나만 검증한다.
- Supabase advisor 기준 `showroom.is_node_visible(uuid)`도 exposed schema의 SECURITY DEFINER 함수로 anon/authenticated 직접 실행 가능 경고가 있다.
- Supabase advisor 기준 `showroom.get_preview_payload(text)`도 exposed schema의 SECURITY DEFINER 함수 경고가 뜬다. 토큰 테이블 직접 노출을 막기 위한 의도된 RPC이며, 토큰 하나에 대한 preview payload만 반환한다.
- Supabase performance advisor 기준 `showroom.gallery_photos.node_id`, `showroom.hero_media.node_id`, `showroom.preview_tokens.node_id` FK 인덱스 보강을 적용했다.

## 다음 우선순위

1. V2 기준 문서 정리 완료
2. lint/build 기준선 통과 확인
3. 미리보기 토큰 RLS 하드닝 설계 및 마이그레이션
4. showroom FK 인덱스 보강 마이그레이션
5. EVAL-01 ~ EVAL-21 필수 검증
6. 카카오톡 인앱 브라우저, 이미지 로딩, 접근성 회귀 검증

## 주의사항

- Next.js 16 로컬 문서는 `node_modules/next/dist/docs/`를 먼저 확인한다.
- CSS는 global token과 CSS Module 기준을 우선한다.
- Supabase 운영 DB 변경은 마이그레이션 단위로 기록하고, 적용 후 advisor를 확인한다.
- 문장군 브랜드 맥락은 `C:\Users\hjh\안티그래비티\문장군블로그\BRAND_CONTEXT.md`를 기준으로 본다.
