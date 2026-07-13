# Blog Image Showroom Experience System

## 1. 목적

이 시스템의 목표는 승인된 `/blog` 경험을 일반 SaaS 화면으로 바꾸지 않고, 재사용 가능한 블로그 전용 언어로 고정하는 것이다. 첫 화면의 미디어, 유리 내비게이션, 카드 레일, 스크롤 스토리, 조건 선택기, 긴 상담 CTA, 푸터 리빌은 하나의 연결된 읽기 경험이다.

유지해야 하는 판단은 다음과 같다.

- 고객 데이터와 공개 글은 기존 server-side published-post 흐름을 유지한다.
- 모든 문구·버튼·검색·결과·진행 표시는 코드 UI다.
- 사진과 영상만 typed media registry에서 교체한다.
- 무료 방문실측 CTA는 상단 유틸리티가 아니라 히어로·스토리·마지막 CTA의 의도된 전환 위치에 둔다.
- reduced motion에서도 링크, 선택, 검색, 결과는 모두 동작한다.

## 2. Scope와 theme 구조

```text
[data-mg-theme="blog"]
  ├─ reader semantic defaults: /blog/[slug], shared blog navigation
  └─ [data-mg-blog-experience="showroom"]
       └─ approved image-showroom override: /blog home
```

토큰 구현 위치는 `src/styles/blog-experience.css`다. `src/app/globals.css`가 이 파일을 한 번만 import한다. CSS 모듈은 레이아웃, 조합, 씬 전용 동작을 담당하고 전역 토큰을 재정의하지 않는다.

## 3. Semantic tokens

| 역할 | Reader 기본 | Showroom override | 사용처 |
|---|---|---|---|
| `--mg-blog-canvas` | `#fbf7f1` | `#ffffff` | 페이지 배경 |
| `--mg-blog-canvas-subtle` | `#f7f1e9` | `#f4f4f1` | 보조 구역, 검색/선택 배경 |
| `--mg-blog-surface` | `#ffffff` | `#ffffff` | 카드, CTA 버튼, reader surface |
| `--mg-blog-surface-muted` | `#f3e9dc` | `#eeeeea` | 카드 미디어 fallback, 보조 surface |
| `--mg-blog-ink` | `#2e241c` | `#171717` | 주 텍스트, dark CTA |
| `--mg-blog-body` | `#2e241c` | `#30302d` | 본문과 control hover |
| `--mg-blog-muted` | `#78685a` | `#6b6b65` | 보조 카피와 메타 |
| `--mg-blog-inverse` | `#ffffff` | `#ffffff` | 어두운 미디어 위 UI |
| `--mg-blog-border` | `#ede0d3` | `#e5e5e0` | 카드·reader border |
| `--mg-blog-border-strong` | `#d9c4a8` | `#c9c9c2` | hover/focus 강화 border |
| `--mg-blog-accent` | `#9c4e2c` | `#3d5b4b` | action과 active 표현 |
| `--mg-blog-accent-strong` | `#86401f` | `#274237` | action hover와 링크 강조 |
| `--mg-blog-cta-surface` | `#2e241c` | `#171717` | dark CTA, navigation control |
| `--mg-blog-status-success` / `danger` | `#2c6b3f` / `#a3392a` | 동일 | reader 상태 |

### Glass, elevation, radius, motion

| 역할 | Token | 규칙 |
|---|---|---|
| hero glass | `--mg-blog-glass-hero` | 투명. 히어로 미디어 위에서만 사용 |
| compact glass | `--mg-blog-glass-light` | light navigation surface |
| dark glass | `--mg-blog-glass-dark` | final CTA track 위 navigation |
| search glass | `--mg-blog-glass-panel` | search sheet와 selector 계열 |
| floating / overlay shadow | `--mg-blog-shadow-floating`, `--mg-blog-shadow-overlay` | nav, search panel 같은 떠 있는 surface |
| compact / media / card | `--mg-blog-radius-compact`, `media`, `card` | reader control, sticky image stage, article/topic card |
| floating / search / CTA / footer | `--mg-blog-radius-floating`, `search`, `cta`, `footer` | pill control, sheet, final track, footer reveal |
| motion | `--mg-blog-motion-fast`, `standard`, `navigation` | micro transition과 nav treatment만 공통화 |
| responsive cadence | `--mg-blog-layout-gutter`, `--mg-blog-layout-section` | desktop/tablet/mobile의 container 및 section rhythm |

토큰 값은 `prefers-reduced-motion`에서 0ms가 된다. rail, story, composer, final CTA의 진행 계산과 scene 전환 의미 자체는 각 컴포넌트가 유지한다.

## 4. Typography

| 역할 | Token / 구현 | 허용 범위 |
|---|---|---|
| Korean display | `--mg-blog-font-display` = Tmoney RoundWind | 히어로, section title, story/CTA stage, 조건 문장, 큰 footer title |
| body / small UI | `--mg-blog-font-body` = Pretendard | 본문, metadata, form, search, controls |
| English wordmark | `--mg-blog-font-wordmark` + `next/font` Nunito loader | `MUNJANGGUN BLOG` lockup만 |

Tmoney RoundWind를 영문 wordmark나 일반 본문에 사용하지 않는다. `BlogBrandWordmark`는 `next/font/google`의 loaded variable을 blog wordmark token과 함께 사용한다.

## 5. 실제 reusable primitives

| Primitive | 파일 | API / 사용 기준 |
|---|---|---|
| `BlogNavigation` | `src/components/blog/BlogNavigation.tsx` | `variant`, `surface`, `condensed`, `searchPosts`, optional `readingProgress`, `hasPosts`. 홈과 글 상세가 공유한다. |
| `BlogBrandWordmark` | `src/app/blog/BlogBrandWordmark.tsx` | `compact`, optional `className`. blog navigation과 final footer signoff만 사용한다. |
| `BlogAutoplayVideo` | `src/app/blog/BlogAutoplayVideo.tsx` | `src`, optional `poster`, `alt`, optional `className`. reduced motion에서 재생하지 않는다. |
| `BLOG_HOME_MEDIA` | `src/app/blog/blog-home-assets.ts` | `kind`, `src`, optional `poster`, `alt`, optional `focalPoint`. image/video 교체의 유일한 홈 registry다. |
| `PublicUserMenu` blog embed | `src/components/customer/PublicUserMenu.tsx` | 블로그 내 navigation에서만 embedded variant를 사용한다. root floating menu와 중복하지 않는다. |

범용 `Button`, `Card`, `GlassPanel`은 만들지 않는다. 홈의 topic rail, condition composer, story stage, final CTA는 도메인 동작을 가진 구성요소이므로 같은 토큰을 소비하되 일반 컴포넌트로 승격하지 않는다.

## 6. Components와 시각 규칙

- **Navigation:** hero에서는 transparent, 스크롤 뒤에는 light glass, final CTA에서는 dark glass다. search와 account는 44px 이상의 실제 control target을 유지한다.
- **Article cards:** reader article card는 border/surface/compact radius token을 사용한다. image 비율과 featured 24px radius는 문서와 테스트의 승인값을 유지한다.
- **Topic rail:** desktop는 portrait 6장, selected card만 square로 확장한다. 모바일은 centered card와 neighbor depth를 유지한다.
- **Condition composer:** 선택 단어는 다시 열 수 있고 previous/restart가 가능하다. 완료 전 결과는 keyboard tab order에서 제외한다.
- **Final CTA:** desktop track은 `280svh`다. 네 단계 narrative와 final action 전에는 footer를 올리지 않는다.

## 7. 문서화된 literal exceptions

다음 값은 반복 토큰으로 기계적으로 치환하지 않는다. 이미지 장면의 가독성·몰입감·진행 상태에 종속되기 때문이다.

| 위치 | 예외 | 이유 |
|---|---|---|
| `BlogHomeHero.module.css` | `imageVeil` gradient, hero image reveal | 이미지별 좌측 copy safe area와 첫 장면 대비 |
| `BlogTopicRail.module.css` | card overlay, desktop/mobile card dimensions, rail easing | gallery depth, selected square, drag/autoplay mechanics |
| `BlogStoryStage.module.css` | stage veil와 chapter progress | 각 story scene의 미디어 명암과 scroll chapter 전환 |
| `BlogConditionComposer.module.css` | composer veil, word landing, selector glass mix | 선택 문장의 단계적 집중과 media focal shift |
| `BlogFinalExperience.module.css` | CTA veil, `--journey`, `--reveal`, scene timing | 280svh narrative와 footer reveal의 진행 계산 |
| `blog-home-assets.ts` | per-slot `focalPoint` | 실제 사진 교체 시 subject 위치를 보존 |

새 literal을 추가할 때는 먼저 semantic role로 충분한지 확인하고, 위와 같은 scene-specific 근거가 있을 때만 해당 모듈과 handoff에 기록한다.

## 8. Accessibility와 responsive

- focus outline을 제거하지 않는다. hidden recommendation/action states는 `inert`, `aria-hidden`, `tabIndex`를 함께 유지한다.
- `prefers-reduced-motion`에서 autoplay와 heavy transitions를 멈추되 navigation, link, composer selection은 계속 동작한다.
- 검수 viewport는 1440×900, 768×900, 393×852다. 추가로 home E2E가 375×812 sticky geometry를 보장한다.
- 모든 viewport에서 document horizontal overflow는 0px이어야 한다. 모바일에서 horizontal scroll은 topic rail 내부에서만 허용된다.

## 9. 검수 운영

디자인 수정 중에는 위 세 viewport의 브라우저 화면만 확인한다. semantic theme, primitives, docs가 하나의 묶음으로 확정된 뒤에만 아래를 한 번 실행한다.

```text
npm run lint
npm run build
npm run test:e2e -- tests/blog-navigation.spec.ts tests/blog-home-experience.spec.ts tests/blog-article-actions.spec.ts
git diff --check
```

실제 실행 결과와 skipped test는 `05-design-qa-report.md`에 기록한다.
