# Munjanggun Blog Home Final QA Report

## Latest system migration evidence — July 13, 2026

This section is the source of truth for the blog image-showroom system migration. Earlier sections record the approved-showroom implementation history and are retained for context.

| Check | Actual result |
| --- | --- |
| Semantic theme scope | `/blog` renders one `main[data-mg-theme="blog"][data-mg-blog-experience="showroom"]`; `/blog/[slug]` uses the reader defaults. |
| Design language | Blog-only semantic tokens live in `src/styles/blog-experience.css`; central `src/styles/munjanggun-brand.css` was not changed. |
| Typography | Tmoney RoundWind is limited to Korean display surfaces, Pretendard remains the body/UI family, and the English `MUNJANGGUN BLOG` lockup uses its separately loaded wordmark font. |
| Browser visual evidence | Chromium screenshots inspected at 1440 x 900, 768 x 900, and 393 x 852. The full image hero, transparent-to-glass navigation, rail, story, composer, and final CTA remained intact; no mobile document overflow was observed. |
| Lint | `npm run lint` passed with 0 errors. Six pre-existing warnings remain only in unrelated admin components (`ImageUploader`, `NodeAddModal`, and `NodeMoveModal`). |
| Production build | `npm run build` passed on Next.js 16.2.4, including TypeScript validation and all 18 generated routes. |
| Blog regression suite | `npm run test:e2e -- tests/blog-navigation.spec.ts tests/blog-home-experience.spec.ts tests/blog-article-actions.spec.ts` passed: 21 passed, 0 failed. It was run against an existing `http://localhost:3000` server so the test runner and Next dev client share an origin. |
| Whitespace check | `git diff --check` is run as the final pre-commit gate for this migration. |

The first E2E attempt used `127.0.0.1` against a server accessed as `localhost`; Next 16 correctly blocked cross-origin dev resources, preventing hydration. Re-running at the same `localhost` origin restored the real client behavior. No runtime configuration change was needed.

## Result

The `/blog` main route now follows the approved image-led home direction. It combines a full-screen media hero, rounded glass navigation, an auto-moving portrait topic gallery, a full-screen sticky image story on desktop and mobile, a three-step condition composer, and a long-form consultation ending that reveals the footer only after four scroll beats. The shared navigation, search, account access, and reading progress now continue into `/blog/[slug]`.

## Browser Evidence

- Desktop hero, 1440 x 900: `output/playwright/blog-final-desktop-1440.png`
- Desktop topic gallery: `output/playwright/blog-final-desktop-topics.png`
- Desktop condition composer: `output/playwright/blog-final-desktop-condition.png`
- Desktop consultation scene: `output/playwright/blog-final-desktop-cta.png`
- Tablet hero, 768 x 900: `output/playwright/blog-final-tablet-768.png`
- Mobile hero, 375 x 812: `output/playwright/blog-final-mobile-375.png`

Measured in Chromium at `http://127.0.0.1:3000/blog`:

| Check | Result |
| --- | --- |
| Desktop viewport and hero | 1440 x 900; hero 900px |
| Desktop horizontal overflow | 0px |
| Topic gallery cards | 6 cards; 310px collapsed; 520px selected |
| Final consultation track | 280svh; 4 narrative beats plus final action state |
| Tablet viewport and hero | 768 x 900; hero 900px |
| Tablet horizontal overflow | 0px |
| Mobile viewport and hero | 375 x 812; hero 812px |
| Mobile navigation width | 172px, separated from the user menu |
| Mobile topic cards | 308px portrait cards inside a 360px rail |
| Mobile horizontal overflow | 0px |
| Broken loaded images | 0 |

## Contract Review

- The first viewport is real, replaceable media with all navigation, copy, and buttons rendered as code UI.
- The glass navigation contracts after scroll and switches to a dark glass surface over the final consultation image.
- The topic gallery auto-moves, pauses for interaction, supports drag and eased wheel movement, and expands only the selected card from portrait to square.
- At the horizontal rail edges, vertical wheel intent returns to the page instead of trapping desktop scrolling.
- The condition composer keeps editable selected words, reveals real published posts after three choices, and supports restart without reloading.
- The recommendation logic is intentionally static and replaceable; no diagnostic score or fabricated testimonial was added.
- The final consultation scene holds the viewport through four copy states before the footer rises.
- Footer anchors render only when their destination exists.
- Shared `src/styles/munjanggun-brand.css` and blog detail components were not modified by this final-home pass.

## Fixes Found During QA

1. Selected condition choices could become white text on a white hover background. The selected hover/focus state now retains the dark surface and readable white text.
2. Topic-rail wheel interaction could leave auto movement paused indefinitely. A single resettable resume timer now restores motion after wheel, drag, button, or card interaction.
3. The fixed navigation remained light over the final dark image. It now detects the final CTA track and switches to a dark glass treatment.
4. The tablet CTA occupied the hidden center-navigation column and became excessively wide. Tablet navigation now uses a two-column logo/action layout.
5. The mobile/tablet navigation visually overlapped the fixed user menu. Width and placement now reserve a separate right-side zone.
6. A footer `최근 글` anchor could exist without a matching section. It is now data-aware.
7. Topic-card counts used a looser keyword match than the search results. Both now use `searchBlogPosts`, so the displayed count and opened result agree.
8. A removed color section remained as a story anchor. It now points to the live condition composer.
9. Collapsed recommendation results and inactive final-CTA actions remained in the keyboard tab order. Hidden states now use `inert`, `aria-hidden`, and explicit tab-index control.
10. Pointer dragging could remain active if released outside the gallery. Pointer capture now guarantees the release event returns to the rail.
11. No-post footer links are conditional, so search, topic, story, and latest anchors only appear when their destinations exist.
12. Pointer release now uses window-level `pointerup`/`pointercancel`, preserving child-button clicks while clearing drags even when release happens outside the rail.
13. Video slots now use a shared reduced-motion-aware player that pauses when the user requests reduced motion and resumes only when allowed.

## Automated Verification

- `npx playwright test tests/blog-navigation.spec.ts tests/blog-home-experience.spec.ts tests/blog-article-actions.spec.ts --project=chromium`: 19 passed, including authenticated account-menu keyboard behavior, search navigation, mobile full-screen story height, and reduced-motion checks.
- `npm run build`: passed with Next.js 16.2.4, TypeScript, and page generation.
- `npm run lint`: passed with 0 errors; 6 pre-existing warnings remain in unrelated admin components.
- `git diff --check` for the scoped blog/design files: passed; only Git line-ending notices were emitted.

## Navigation, Search, And Mobile Story Follow-up

Measured again in the in-app Chromium browser on July 10, 2026:

| Check | Result |
| --- | --- |
| Main desktop navigation | 1180 x 64px at 1440 x 900; logo left, links center, search and account right |
| Main mobile navigation | 358 x 58px at 393 x 852; search and account remain inside the glass bar |
| Search panel | Input receives focus on open; suggestion/results panel closes on Escape and is hidden when inactive |
| Embedded account | Existing authenticated profile links to `/portal`; the separate floating showroom menu is absent on blog routes |
| Article desktop navigation | 1120 x 64px with shared search/account and a 3px reading-progress line |
| Article mobile navigation | 358 x 58px with search/account preserved and no horizontal overflow |
| Mobile sticky story | 852px sticky stage inside a 3408px scroll track; four image chapters reuse the desktop sequence |
| Main and article overflow | 0px at 1440 x 900 and 393 x 852 |
| Korean wrapping | Display copy uses balanced wrapping; article paragraphs keep Korean word units and use pretty wrapping |

The authenticated-menu flow was also verified in the signed-in in-app browser: opening the account menu closes search, Arrow Down moves to the next menu item, and Escape closes the menu and restores focus to the account button. Search Escape similarly restores focus to its trigger.

The old standalone search block was removed. Search now opens from the shared fixed navigation on both route types. The top-navigation measurement CTA was removed, while the hero, article, and final consultation CTAs remain available in their intended conversion positions.

## Interaction Polish Follow-up

The July 10 feedback pass tightened the existing direction without changing the page architecture:

- Search and account utilities now use black controls on every glass-navigation surface.
- Mobile navigation measures 358 x 58px at 393 x 852. Search and account controls are both 44px high, vertically aligned with a 4px gap.
- Navigation now links to `상황별 가이드`, `공간 이야기`, and `우리 집 글 찾기`.
- The account control opens the same keyboard-accessible menu on desktop and mobile instead of navigating immediately.
- Search opens as a guided sheet with concise instructions, popular searches, and live article results.
- The condition composer starts with three empty slots. Selected values land into the sentence, filled slots remain editable, and the selector includes a previous-step action.
- The mobile topic rail exposes a centered 68vw card with scaled neighboring cards; the selected card expands to approximately 86vw and reveals its description and action.
- The featured article card uses a 24px desktop and 20px mobile radius with clipped media.

Browser checks passed at 1440 x 900 and 393 x 852 with no horizontal overflow. The final Playwright run passed 18 tests; the gallery test exposed a test-order timeout, was corrected to pause autoplay before selecting the centered card, and then passed independently in 2.3 seconds. Lint remained at 0 errors with the same 6 unrelated admin warnings, and the production build passed.

## Stop Boundary

The `/blog` main route and the shared blog navigation layer are complete for this phase. Runtime images remain centralized in `src/app/blog/blog-home-assets.ts`, so real project photos or videos can replace them without changing component structure. Recommendation ranking and a broader `/blog/[slug]` visual redesign remain separate follow-up work.
