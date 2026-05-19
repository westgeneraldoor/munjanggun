# 프로젝트 컨텍스트
📅 마지막 업데이트: 2026-05-06
📋 마지막 오더: #050 (ScrollToTop + CTA홈버튼 + 모바일브레드크럼)

## 현재 상태
**Phase 5-B 완료** → 폴리싱 진행 중

## 최근 완료 (최대 5건)
- #052 Phase 4 안전망 및 접근성 추가 ✅ (2026-05-19)
- #051 CTA바 울트라미니멀 리디자인+모바일브레드크럼 골드통일 ✅5/5 (2026-05-06)
- #051+ 그리드: 4개=CSS Grid 2열(3열 카드사이즈 공식 그대로 grid-template-columns에 적용, center) ✅ (2026-05-06)
- #050 ScrollToTop+CTA홈버튼+모바일브레드크럼 ⚠️4.5/5 통과 (2026-05-06)
- #049 공유요소전환 제거+텍스트only 히어로 ✅5/5 통과 (2026-05-02)

## 핵심 결정 (최대 5개)
- **Phase 5-B = View Transitions API** | Next.js 16 실험적 지원, Progressive Enhancement
- **카드 그리드: 4=3열, 5~6=3열, 7+=4열** | 마지막줄 1개 방지
- **공유요소전환 제거, 페이드+슬라이드 통일** | 카드(라운드)→히어로(직각) 형태차이로 부자연스러움
- **ScrollToTop.module.css 미정의 토큰** | `--color-surface-elevated-hover` 다음 폴리싱 때 수정
- **총괄은 직접 코드 수정 안 한다** | 검수→기록→오더 순서 필수

## 다음 할 일
1. 🟡 Phase 4 잔여 — EVAL-01~21 전수 검사 / 카카오톡 인앱 테스트 / 이미지 로딩 성능
2. 🟡 Phase 5-C 검토 — 소재 인터랙션 or 추가 폴리싱
3. 🟢 ScrollToTop 호버 토큰 수정 (비치명적, 폴리싱 합산)

## 교훈 & 주의사항
- ⚠️ viewTransition은 experimental — 실패 시 폴백 자연스러움
- ⚠️ 카카오톡 인앱: Android=Chrome(OK), iOS=Safari 18+(OK)
- ⚠️ 미정의 CSS 변수는 빌드에서 안 잡힘 — 수동 확인 필요
- ⚠️ **CSS Grid 열 사이즈 = 기존 width 공식 직접 대입** — max-width/퍼센트 그리드 제한은 뷰포트별 깨짐. `grid-template-columns: repeat(N, calc(...))` + `justify-content: center`가 정답
