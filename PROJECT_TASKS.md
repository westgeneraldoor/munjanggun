# 문장군 디지털 쇼룸 V2 — 전체 태스크 현황
📅 마지막 업데이트: 2026-04-28

> V1 히스토리는 `_archive.md`에 보관

## V2 Phase 0: 기반 설정 ✅
- [x] Git 브랜치 `v2-cms` 생성 (main 보호) ✅ 오더 #015
- [x] package.json 수정 (sharp→dependencies, 프로젝트명) ✅ 오더 #015
- [x] 디렉토리 구조 추가 (PRD 5.4 — v1 파일 유지, 병렬 추가) ✅ 오더 #015
- [x] constants.ts 생성 (예약 slug, 압축 설정, 최대 깊이) ✅ 오더 #015
- [x] catch-all [...slugs] 라우트 placeholder ✅ 오더 #015
- [x] 어드민 /nodes/ 라우트 placeholder ✅ 오더 #015

## V2 Phase 1: 데이터베이스 & 인증
- [x] showroom 스키마 생성 (nodes, hero_media, site_hero_media, gallery_photos, preview_tokens, site_settings) ✅ 오더 #016
- [x] `is_node_visible()` PostgreSQL 함수 (WITH RECURSIVE CTE) ✅ 오더 #016
- [x] 제약 조건 + 인덱스 (slug 유니크, 타입/상태 CHECK) ✅ 오더 #016
- [x] RLS 정책 (anon=is_node_visible, authenticated=전체) ✅ 오더 #016
- [x] TypeScript 타입 재생성 ✅ 오더 #016
- [x] V1→V2 데이터 마이그레이션 스크립트 [F-012] ✅ 오더 #017
- [x] 마이그레이션 실행 + 검증 (25 nodes, 126 gallery_photos) ✅ 오더 #017

## V2 Phase 2: 어드민 CMS
- [x] 어드민 레이아웃 + auth guard 리팩토링 [F-005] ✅ 오더 #018
- [x] /admin → /admin/nodes 리다이렉트 ✅ 오더 #018
- [x] 노드 관리 CRUD + 타입 전환 [F-006] ✅ 오더 #018
- [x] 탭(최상위 노드) 정렬/상태/삭제 관리 ✅ 오더 #018 (핫픽스)
- [x] Supabase Exposed schemas + GRANT 설정 ✅ 핫픽스 (PostgREST 406 해결)
- [ ] 노드 편집 폼 (이름/슬러그/설명/썸네일) [F-006]
- [ ] 히어로 설정 UI (복수 이미지/영상 + 문구) [F-006]
- [ ] 이미지 업로더 + 자동 압축 [F-007]
- [ ] 갤러리 관리 (복수 업로드 + 정렬) [F-006]
- [ ] 미리보기 워크플로우 (토큰 URL) [F-008]
- [ ] 사이트 설정 (메인 히어로 포함) [F-011]

## V2 Phase 3: 고객 페이지
- [ ] 메인 페이지 (히어로 + 탭 그리드) [F-001]
- [ ] catch-all [...slugs] 라우트 + 노드 해석 로직 [F-002, F-003]
- [ ] 범용 리스트 페이지 (선택적 히어로 + 카드 그리드) [F-002]
- [ ] 범용 상세 페이지 (히어로 + 정보 + 갤러리 + CTA) [F-003]
- [ ] 스크롤 애니메이션 [F-004]
- [ ] 라이트박스 [F-013] (v1 ImageLightbox 재사용)
- [ ] CTA 바 [F-010]
- [ ] 동적 OG 메타 태그 [F-009]
- [ ] 토큰 미리보기 페이지
- [ ] V1 URL 301 리다이렉트 (next.config.ts)
- [ ] V1 전용 라우트/컴포넌트 정리 삭제

## V2 Phase 4: 검증 & 폴리싱
- [ ] EVAL-01 ~ EVAL-21 전수 검사
- [ ] 카카오톡 인앱 브라우저 호환 테스트
- [ ] 이미지 로딩 성능 확인
- [ ] 에러 핸들링 (네트워크 실패, 이미지 fallback)
- [ ] 접근성 확인 (alt, 키보드 네비게이션)
- [ ] 최종 빌드 → Vercel 배포 (v2-cms → main merge)

---
## 마일스톤 기록
| 날짜 | 마일스톤 | 비고 |
|------|---------|------|
| 2026-04-27 | **V1 완료 & 배포** 🏁 | Phase 6까지 완료, Vercel 프로덕션 |
| 2026-04-28 | V2 PRD 확정 | PRD v2.1.0 (감찰보고서 반영) |
| 2026-04-28 | V2 디자인시스템 확정 | DS v2.0.0 |
| 2026-04-28 | **V2 개발 시작** | Phase 0 오더 #015 발행 |
| 2026-04-28 | **V2 Phase 0 완료** 🏁 | 브랜치+디렉토리+placeholder, 빌드통과 |
| 2026-04-28 | **V2 Phase 1-1 완료** | showroom 스키마 6테이블+함수+RLS12개+인덱스4개, V1 무손상 |
| 2026-04-28 | **V2 Phase 1 전체 완료** 🏁 | 데이터 마이그레이션 25노드+126갤러리, UUID보존 |
| 2026-04-28 | **V2 Phase 2-1 완료** | 노드 목록+CRUD+탭관리, Exposed schemas 핫픽스 |

