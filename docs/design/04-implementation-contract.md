# Munjanggun Blog Final Home Contract

## Scope

- Route: `/blog` main only.
- Preserve: published-post loading, search, featured article, latest/all article links, existing sticky image story.
- Replace: old topic button grid, color-mood section, thread list, and small bottom consultation banner.
- Exclude: `/blog/[slug]`, shared brand CSS, recommendation algorithms, database/API work, portal/admin changes.
- The user explicitly skipped another mobile image-concept gate. Desktop interactions are the source design; mobile is derived from the same implemented components and verified in the real browser.

## Final Page Order

1. Full-screen image hero.
2. Rounded glass navigation.
3. Search and featured article.
4. Auto-moving image topic rail.
5. Sticky image story.
6. Home-condition sentence composer.
7. Latest and remaining published articles.
8. Three-act full-screen consultation CTA.
9. Footer reveal.

## Must-Match Interactions

### Navigation

- Rounded `MUNJANGGUN` plus smaller `BLOG` wordmark.
- Wide transparent glass over the hero; narrower light glass after scroll; dark glass over the final image CTA.
- Public user control rendered by the root layout remains unobscured.

### Topic Rail

- Six equal portrait cards on desktop.
- Selected card expands to a square and reveals secondary copy and action.
- Auto movement is visible but calm, pauses on hover/focus/drag/selection, and respects reduced motion.
- Mouse-wheel input eases instead of jumping. At either logical edge, matching wheel direction moves the page vertically.
- Mobile uses swipe-centered cards and does not require hover.

### Condition Composer

- Three local selection steps assemble one editable sentence.
- Phrase buttons reopen their matching step.
- Restart resets all phrases, media focus, and results.
- Results expand below the image panel and never cover the sentence or choices.
- Production results use available published posts, up to four. Future recommendation logic replaces only the resolver, not the layout.

### Final CTA And Footer

- Desktop CTA track is `280svh`; the image remains pinned for the complete sequence.
- All changing text remains in one left-side stage: introduction, `구조를 보고`, `동선을 재고`, `선택을 좁힙니다`, final consultation copy and buttons.
- The right side remains image-only.
- Footer does not enter until the CTA sequence is complete, then rises over the pinned image.
- Footer uses a compact dark signoff with rounded `MUNJANGGUN` and smaller `BLOG`; no giant filler wordmark.

## Content And Asset Rules

- All text, buttons, progress, filters, results, and navigation remain code UI.
- Gallery, condition, story, and CTA media are replaceable through `blog-home-assets.ts`.
- Placeholder imagery is accepted for implementation and will be replaced later.
- No fabricated review, count, price, performance, or customer proof.

## Responsive Acceptance

- 1440x900: all approved desktop interactions are visible and measurable.
- 768x900: no collision between glass nav, user menu, card rail, or CTA text.
- 375x812: no horizontal page overflow; rail alone scrolls horizontally; composer and footer stack; buttons fit.
- Reduced motion disables autoplay and transition-heavy staging while preserving every action and article link.

## Completion

- Existing blog data behavior works.
- Color-mood section and old thread/bottom CTA do not render.
- Focused E2E, full lint, and production build pass, or unrelated pre-existing failures are reported precisely.
- Browser screenshots and measured evidence are recorded in `docs/design/05-design-qa-report.md`.
