# Blog Experience Handoff

## 완료 범위

이번 범위는 승인된 `/blog` image-showroom home, shared blog navigation, `/blog/[slug]` reader surface, account/search presentation을 블로그 전용 semantic theme으로 정리하는 일이다.

포털, 무료방문실측 랜딩, 마이페이지, A/S, 플랫폼 어드민, central `--mg-*` token migration은 구현하지 않았다. `src/styles/munjanggun-brand.css`도 변경하지 않는다.

## 실제 파일 지도

| 목적 | 파일 |
|---|---|
| Scoped tokens | `src/styles/blog-experience.css` |
| Theme import와 Tmoney font face | `src/app/globals.css` |
| Home route scope | `src/app/blog/page.tsx` |
| Reader route scope | `src/components/blog/BlogPostRenderer.tsx` |
| Home composition | `src/app/blog/BlogHomeHero.tsx`, `BlogExplorerClient.tsx`, `BlogTopicRail.tsx`, `BlogStoryStage.tsx`, `BlogConditionComposer.tsx`, `BlogFinalExperience.tsx` |
| Replaceable home media | `src/app/blog/blog-home-assets.ts`, `public/assets/blog-home/hero-sunlit-expansion.png` |
| Shared blog primitives | `src/components/blog/BlogNavigation.tsx`, `src/app/blog/BlogBrandWordmark.tsx`, `src/app/blog/BlogAutoplayVideo.tsx` |
| Reader presentation | `src/components/blog/BlogPostRenderer*`, `BlogReadingTopBar*`, `BlogArticleActions*`, `BlogConditionChecklist*` |
| Embedded account tone | `src/components/customer/PublicUserMenu*` |
| Regression tests | `tests/blog-navigation.spec.ts`, `tests/blog-home-experience.spec.ts`, `tests/blog-article-actions.spec.ts` |
| System docs | `docs/design/README.md`, `BLOG_EXPERIENCE_SYSTEM.md`, this file, `04-implementation-contract.md`, `05-design-qa-report.md` |

## 시작 방법

1. `README.md`를 읽고 scope와 historical contract를 확인한다.
2. `BLOG_EXPERIENCE_SYSTEM.md`의 token/primitive/exception을 먼저 적용한다.
3. 실제 사진·영상 교체는 `blog-home-assets.ts`의 `src`, `poster`, `alt`, `focalPoint`만 바꾼다.
4. 새 UI가 blog route의 한 부분이면 `[data-mg-theme="blog"]` 안에서 semantic token을 사용한다. central token을 덮어쓰지 않는다.
5. scene-specific style을 추가하면 System 문서의 exception table을 갱신한다.

## 검증 방법

수정 중에는 Chromium에서 아래만 눈으로 확인한다.

- 1440×900: hero, navigation surface transition, rail, story, composer, final CTA/footer
- 768×900: glass navigation/user menu separation, rail/card/CTA collision 없음
- 393×852: search/account 44px controls, text wrapping, horizontal overflow 없음

묶음 완료 뒤에만 한 번 실행한다.

```text
npm run lint
npm run build
npm run test:e2e -- tests/blog-navigation.spec.ts tests/blog-home-experience.spec.ts tests/blog-article-actions.spec.ts
git diff --check
```

환경 설정 때문에 published post가 비어 있으면 data-dependent Playwright assertions가 skip될 수 있다. skip과 pass를 같은 의미로 보고하지 말고 QA report에 분리한다.

## 다음 우선순위

1. **실제 이미지·영상 교체:** registry와 alt/focal point만 갱신하고 image overlay를 실제 장면에 맞춰 재검수한다.
2. **상담 랜딩:** blog CTA가 이동하는 `/portal/measure/new`의 별도 경험을 설계한다. 이 문서 범위를 자동 확장하지 않는다.
3. **블로그 상세 / Content OS:** reader body block과 asset approval flow를 개선하되 public/private media 경계를 유지한다.
4. **마이페이지·접수 화면:** customer journey 화면은 Platform UI Constitution을 읽고 별도 scope로 작업한다.

## 의도적으로 하지 않은 일

- 전역 Button/Card/GlassPanel 추상화
- recommendation ranking 또는 데이터베이스/API 변경
- central brand token v3→v4 migration
- portal/admin/root/showroom 리뉴얼
- 실제 고객 사진, 고객명, 주소, 상담 원문, 비공개 운영 데이터의 사용
