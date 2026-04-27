# 작업지시서 #014 — 🟡 데스크탑 UI 수정 4건 (Masonry 수정 + 비네팅 + 뒤로가기 + 라이트박스)
📅 발행: 2026-04-24 10:10
🤖 추천 모델: Gemini Pro
⏱️ 예상 시간: ~25분

## 환경 확인 (필수)
- GEMINI.md 읽고 코딩 규칙 확인
- lucide-react v1.8.0 설치됨 — 아이콘 사용 가능

## 배경
오더 #013 결과물에 대한 사장님 로컬 테스트 피드백 4건 수정.

---

## 이슈 1: Masonry 지그재그 안 됨 (🔴 핵심)

### 원인
`InstallationGallery`에서 각 `<figure>`를 `ScrollAnimationWrapper`(`<div>`)로 감싸고 있는데,
이 래퍼 div에 `break-inside: avoid`가 없어 CSS `columns: 2`가 올바르게 동작하지 않음.

### 수정 파일: `src/components/customer/ScrollAnimationWrapper.module.css`

`.wrapper`에 `break-inside: avoid` 추가:
```css
.wrapper {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity var(--transition-gallery), transform var(--transition-gallery);
  /* transition-delay is set inline */
  break-inside: avoid;  /* ← 추가: CSS columns 내부에서 깨짐 방지 */
}
```

> 이 한 줄로 모바일+데스크탑 모두 Masonry 정상 동작.
> break-inside: avoid는 columns 밖에서는 영향 없으므로 다른 곳의 ScrollAnimationWrapper에 부작용 없음.

---

## 이슈 2: 데스크탑 왼쪽 이미지가 밋밋함 (비네팅 + 컬러명)

### 방향
데스크탑에서 HeroTexture 오버레이를 완전 숨기지 말고:
- 가장자리 비네팅(어두운 테두리 효과) 유지
- 좌하단에 컬러명만 작게 표시 (컬렉션태그, 태그라인은 숨김 유지)

### 수정 파일: `src/components/customer/HeroTexture.module.css`

현재 데스크탑 미디어쿼리에서 `.info`, `.gradient`, `.scrollCue` 전부 `display: none`으로 되어 있음.

변경:
```css
/* 데스크탑 좌우분할 */
@media (min-width: 1024px) {
  /* 오버레이 정보는 유지하되 위치와 스타일 조정 */
  .info {
    /* display: none 제거 — 대신 좌하단 미니멀 배치 */
    bottom: var(--space-6);
    left: var(--space-6);
    right: auto;  /* 전체 너비가 아닌 좌측 정렬 */
  }

  /* 컬렉션태그, 태그라인은 데스크탑에서도 숨김 유지 */
  /* (이미 .collectionTag와 .tagline에 display:none 적용됨) */

  /* 컬러명을 데스크탑에서 더 작게 */
  .colorName {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
  }

  /* 그라데이션 → 비네팅으로 변경 */
  .gradient {
    /* display: none 제거 — 비네팅 효과 */
    background: radial-gradient(
      ellipse at center,
      transparent 50%,
      rgba(0, 0, 0, 0.3) 100%
    );
  }

  /* textLight/textDark 그라데이션 오버라이드 — 비네팅은 항상 어두움 */
  .gradient.textLight,
  .gradient.textDark {
    background: radial-gradient(
      ellipse at center,
      transparent 50%,
      rgba(0, 0, 0, 0.3) 100%
    );
  }

  /* 스크롤 유도는 데스크탑에서 숨김 유지 */
  .scrollCue {
    display: none;
  }
}
```

---

## 이슈 3: 데스크탑 뒤로가기 버튼 없음

### 수정 파일: `src/app/color/[collectionSlug]/[colorSlug]/page.tsx`

오른쪽 패널(`.rightPane`) 최상단에 뒤로가기 링크 추가:
```tsx
<div className={styles.rightPane}>
  {/* ← 데스크탑 뒤로가기 추가 */}
  <Link href={`/collection/${collectionSlug}`} className={styles.backNav}>
    ← {collection.name}
  </Link>

  <ColorInfo ... />
  ...
</div>
```

### 수정 파일: `src/app/color/[collectionSlug]/[colorSlug]/color-detail.module.css`

```css
/* 데스크탑 상단 뒤로가기 — 모바일에서는 숨김 */
.backNav {
  display: none;
}

@media (min-width: 1024px) {
  .backNav {
    display: inline-block;
    padding: var(--space-4) var(--space-6);
    color: var(--color-text-sub);
    font-size: var(--text-sm);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .backNav:hover {
    color: var(--color-accent);
  }
}
```

> 뒤로가기 목적지: `/collection/[collectionSlug]` (해당 컬렉션 페이지)
> 모바일에서는 하단의 기존 `.bottomNav`가 그 역할을 함

---

## 이슈 4: 모바일 시공사진 풀스크린 확대

### 신규 파일: `src/components/customer/ImageLightbox.tsx`

간단한 풀스크린 오버레이 컴포넌트:
- Props: `{ imageUrl: string; alt: string; isOpen: boolean; onClose: () => void }`
- `isOpen` 시 fixed 오버레이 + 이미지 object-fit: contain으로 전체 표시
- 배경 탭 또는 X 버튼으로 닫기
- lucide-react의 `X` 아이콘 사용
- body 스크롤 잠금 (isOpen일 때)

### 신규 파일: `src/components/customer/ImageLightbox.module.css`

```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background-color: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  animation: fadeIn 0.2s ease;
}

.image {
  object-fit: contain;
}

.closeButton {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  background: none;
  border: none;
  color: var(--color-text);
  cursor: pointer;
  padding: var(--space-2);
  z-index: 101;
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.closeButton:hover {
  opacity: 1;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### 수정 파일: `src/components/customer/InstallationGallery.tsx`

갤러리를 `'use client'`로 변환 + 이미지 클릭 핸들러 추가:
- 상단에 `'use client'` 추가
- `useState`로 선택된 이미지 관리
- 각 `imageWrapper`에 `onClick` → `setSelectedImage(photo)`
- `cursor: pointer` CSS 추가
- 하단에 `<ImageLightbox>` 렌더링

> ⚠️ 현재 InstallationGallery는 서버 컴포넌트(use client 없음).
> `'use client'` 추가해야 useState 사용 가능. Image 컴포넌트는 client에서도 동작.

### 수정 파일: `src/components/customer/InstallationGallery.module.css`

`.imageWrapper`에 추가:
```css
.imageWrapper {
  cursor: pointer;  /* 추가 */
}
```

> 데스크탑에서는 라이트박스 없이 그대로 표시해도 됨 (좌우 분할에서 이미 크게 보이므로).
> 하지만 일관성을 위해 모바일+데스크탑 모두 적용해도 괜찮음.

---

## 대상 파일
- `src/components/customer/ScrollAnimationWrapper.module.css` — break-inside 1줄 추가
- `src/components/customer/HeroTexture.module.css` — 데스크탑 비네팅+컬러명
- `src/app/color/[collectionSlug]/[colorSlug]/page.tsx` — 뒤로가기 링크 추가
- `src/app/color/[collectionSlug]/[colorSlug]/color-detail.module.css` — 뒤로가기 스타일
- `src/components/customer/InstallationGallery.tsx` — 'use client' + 라이트박스 연동
- `src/components/customer/InstallationGallery.module.css` — cursor: pointer
- `src/components/customer/ImageLightbox.tsx` — 신규 생성
- `src/components/customer/ImageLightbox.module.css` — 신규 생성

## 참고 파일 (읽기만)
- `src/components/customer/HeroTexture.tsx` — Props 확인
- `src/components/customer/ScrollAnimationWrapper.tsx` — 래퍼 구조 확인
- `src/lib/logger.ts` — logError import 경로

## 핵심 규칙
- 컬러 하드코딩 금지 → `var(--color-*)` 토큰 사용
- 간격: 4px 배수만 (`--space-N` 토큰)
- `100vh` 금지 → `100dvh` 사용
- `any` 타입 금지
- `console.error` 직접 호출 금지 → `logError()` 사용
- `next/image` 필수

## ⚠️ 금지
- HeroTexture.tsx 컴포넌트 로직 변경 금지 (CSS만 수정)
- ColorInfo 수정 금지
- CTABar 수정 금지
- 홈 페이지(/), 컬렉션 페이지 수정 금지
- globals.css, 디자인 토큰 수정 금지
- 어드민 영역 일체 수정 금지

## 완료 기준
- [ ] `npm run build` 에러 없이 통과
- [ ] `npm run lint` 에러 0건
- [ ] **Masonry:** 모바일+데스크탑 시공사진이 2열 지그재그 배치 (좌→우 순서)
- [ ] **데스크탑 왼쪽:** 비네팅 + 좌하단 컬러명 표시
- [ ] **데스크탑 우상단:** ← 컬렉션명 뒤로가기 링크 표시 + 클릭 동작
- [ ] **모바일:** 시공사진 탭 → 풀스크린 라이트박스 → X 또는 배경 탭으로 닫기
- [ ] 라이트박스 열릴 때 배경 스크롤 잠금

---
## 작업 결과 (작업자가 작성)
- 수정 파일:
  - `src/components/customer/ScrollAnimationWrapper.module.css`
  - `src/components/customer/HeroTexture.module.css`
  - `src/app/color/[collectionSlug]/[colorSlug]/page.tsx`
  - `src/app/color/[collectionSlug]/[colorSlug]/color-detail.module.css`
  - `src/components/customer/InstallationGallery.tsx`
  - `src/components/customer/InstallationGallery.module.css`
  - `src/components/customer/ImageLightbox.tsx` (생성)
  - `src/components/customer/ImageLightbox.module.css` (생성)
- 변경 요약:
  - Masonry 레이아웃에서 2열이 정상적으로 유지되도록 `ScrollAnimationWrapper.module.css`의 `.wrapper`에 `break-inside: avoid` 추가.
  - 데스크탑 해상도(`min-width: 1024px`)에서 `HeroTexture`의 전체 숨김 처리를 제거하고, 좌하단 미니멀 배치 및 배경 비네팅 효과가 나오도록 CSS 수정.
  - 데스크탑에서 컬렉션 목록으로 돌아갈 수 있도록 상세 페이지의 우측 패널 상단에 뒤로가기 `Link` 추가.
  - 모바일에서 시공 사진 클릭 시 전체 화면으로 볼 수 있도록 `ImageLightbox` 컴포넌트 신규 작성 및 `InstallationGallery`에 연동. 사진 클릭 시 body 스크롤 잠금 적용.
- 자체 확인:
  - `npm run lint` 에러 0건 확인 완료.
  - `npm run build` 빌드 에러 없음 확인 완료.
  - 지정된 규칙(var 토큰 사용, 100dvh, logError 등) 준수 완료.
