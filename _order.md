# 작업지시서 #051
📅 발행: 2026-05-06 14:10
🤖 추천 모델: Gemini Pro
⏱️ 예상 시간: ~20분

## 작업 목표
**A. CTA 바 리디자인 — 울트라 미니멀 스타일**
**B. 모바일 브레드크럼 수정 — 골드 통일 + 사이즈 업**

---

## A. CTA 바 리디자인

### 디자인 사양 (프리뷰 확정 — `_cta_preview.html`의 "개선안 C")

**바 컨테이너 (.container):**
- border-radius: `999px` (완전 필 형태)
- background: `rgba(20, 20, 24, 0.9)`
- backdrop-filter: `blur(20px)`
- border: `1px solid rgba(255,255,255,0.07)`
- box-shadow: `0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)`
- padding: `8px 10px`
- gap: `8px`

**바 상단 골드 라인 (::before):**
- top: -1px, left: 20%, right: 20%
- height: 1px
- background: `linear-gradient(to right, transparent, rgba(196,162,101,0.4), transparent)`

**아이콘 버튼 (.homeButton, .shareButton):**
- 36x36px (기존 44px에서 축소)
- border-radius: 50%
- border: none
- background: transparent
- color: `var(--color-text-sub)`
- 호버: color → `var(--color-accent)`, background → `rgba(196,162,101,0.08)`

**메인 버튼 (.button):**
- height: 40px
- border-radius: `999px` (필 형태)
- font-size: `var(--text-sm)` (13px)
- letter-spacing: 0.2px

**Primary (.primary):**
- background: `var(--color-accent)` (단순 단색, 기존 볼록 gradient 제거)
- color: `var(--color-accent-foreground)`
- box-shadow: `0 2px 8px rgba(196,162,101,0.2)`
- 호버: background → `var(--color-accent-hover)`, shadow 강화, translateY(-1px)

**Secondary (.secondary):**
- background: `rgba(255,255,255,0.05)`
- color: `var(--color-text)`
- border: `1px solid rgba(255,255,255,0.08)`
- 호버: background → `rgba(255,255,255,0.1)`, border 밝아짐

**데스크탑 (1024px+):**
- 동일 필 스타일 유지, max-width: 600px, 중앙 정렬
- 아이콘/메인 버튼 사이즈 동일 (변경 없음)

**제거할 것:**
- 기존 볼록 gradient (`background-image: linear-gradient(...)`) 전부 제거
- 기존 복잡한 box-shadow (inset 다중) 전부 제거
- 기존 shine sweep `::after` pseudo-element 전부 제거
- `slideUpDesktop` 애니메이션은 radius 999px + translateX(-50%) 조합 유지

### 수정 파일
- `src/components/customer/CTABar.module.css` — 전면 리라이트
- `src/components/customer/CTABar.tsx` — 변경 없음 (구조 유지)

---

## B. 모바일 브레드크럼 수정

### B-1. 색상 통일
- `.mobileLink` color를 `var(--color-text-sub)` → `var(--color-accent)`로 변경
- 데스크탑 `.link`와 동일하게 골드로 통일

### B-2. 사이즈 업
- `.mobileList` font-size를 `var(--text-xs)` → `var(--text-sm)`로 변경

### 수정 파일
- `src/components/customer/Breadcrumb.module.css`

---

## 참고 파일
- `_cta_preview.html` — 확정된 디자인 C의 CSS 참조 (`.new-bar-c` 클래스)

## ⚠️ 금지
- CTABar.tsx의 JSX 구조 변경 금지 (CSS만 수정)
- Breadcrumb.tsx 수정 금지 (CSS만 수정)
- 어드민 파일 수정 금지
- `prefers-reduced-motion` 대응 제거 금지 — 반드시 유지
- 데스크탑 중앙 정렬(translateX(-50%)) 로직 제거 금지

## 완료 기준
- [x] `npm run lint` — 에러 0개
- [x] `npm run build` — 성공
- [x] CTA 바: 필(pill) 형태, 투명 아이콘 버튼, 단색 골드 primary, 미세 보더 secondary
- [x] CTA 바: 데스크탑에서 중앙 정렬 + 필 형태 유지
- [x] 모바일 브레드크럼: 골드 링크 + 13px 사이즈
- [x] prefers-reduced-motion 대응 유지

---
## 작업 결과 (작업자가 작성)
CTA 바와 모바일 브레드크럼의 울트라 미니멀 디자인 업데이트를 완료했습니다.
- CTABar.module.css 를 _cta_preview.html 개선안 C 사양에 맞춰 전면 수정했습니다. (볼록 gradient 및 복잡한 shadow 제거, 필 형태 반투명 UI, 중앙 정렬 등)
- Breadcrumb.module.css 의 모바일 폰트 사이즈를 xs에서 sm으로 변경하고 텍스트 컬러를 골드로 통일했습니다.
- lint 경고(에러 0개) 및 build 에러 없음을 확인했습니다.
