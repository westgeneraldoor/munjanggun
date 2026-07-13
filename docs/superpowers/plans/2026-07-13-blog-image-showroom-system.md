# Blog Image Showroom Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the approved `/blog` image-showroom experience while giving it a reusable blog-only semantic design system, durable handoff documentation, and a clean PR merged into `v2-cms`.

**Architecture:** Reconstruct the approved A-scope blog experience in this clean `origin/v2-cms` worktree, then introduce a `[data-mg-theme="blog"]` token layer that leaves legacy shared `--mg-*` tokens untouched. Existing blog primitives remain owned by the blog: navigation, wordmark, media player, and runtime media registry. CSS modules retain composition and scene behavior; only stable repeated values become scoped semantic tokens.

**Tech Stack:** Next.js 16.2.4 App Router, React 19, TypeScript, CSS Modules, `next/image`, `next/font`, Playwright.

## Global Constraints

- Include only the approved blog image-showroom A scope and essential blog runtime dependencies.
- Never modify or stage `src/styles/munjanggun-brand.css` or other B/C/D files.
- Preserve the approved hero, glass navigation, rail, story, condition composer, long CTA, footer reveal, published-post behavior, reduced motion, and mobile layout.
- Use Tmoney RoundWind only for large Korean display text, Pretendard for body and small UI, and a separate English font for the `MUNJANGGUN BLOG` lockup.
- Keep media paths, alt text, and focal points in `src/app/blog/blog-home-assets.ts`; do not encode UI text into imagery.
- Keep scene-specific veils, overlays, and rail/story/CTA mechanics as documented local exceptions.
- During implementation use browser viewport checks only. Run lint, build, all three named E2E specs, and `git diff --check` once after the systemization is complete.

---

### Task 1: Reconstruct the approved A-scope baseline

**Files:**
- Add/modify only approved blog runtime sources under `src/app/blog/**` and `src/components/blog/**`.
- Add/modify `public/assets/blog-home/**`, the Tmoney runtime font registration, the blog-only `PublicUserMenu` presentation, and blog E2E sources when required by the approved experience.

- [ ] Copy only the audited A-scope implementation into the clean worktree.
- [ ] Confirm `git status --short` contains no B/C/D paths.
- [ ] Use a 1440x900 browser pass to confirm the hero, navigation, rail, story, composer, CTA, and footer render before token extraction.

### Task 2: Add a scoped Blog Experience token layer

**Files:**
- Create: `src/styles/blog-experience.css`
- Modify: `src/app/globals.css`
- Modify: `src/app/blog/page.tsx`
- Modify: `src/app/blog/[slug]/page.tsx`
- Modify: affected blog CSS modules only.

**Interfaces:**
- `[data-mg-theme="blog"]` exposes `--mg-blog-*` tokens for canvas, text, borders, surfaces, glass, CTA, typography, radii, elevation, motion, and responsive cadence.
- Page roots provide the attribute so home, article navigation, account surface, and reader surfaces inherit the same values.

- [ ] Add the focused E2E assertion that the home root exposes `data-mg-theme="blog"` and its display/wordmark typography stays correct; execute it only in the single final validation run.
- [ ] Add only the stable, repeated semantic values and refactor affected modules to consume them.
- [ ] Preserve each intentional scene-specific literal and list it in the system document.
- [ ] Re-run the focused assertion and browser-check 1440x900, 768x900, and 393x852.

### Task 3: Formalize actual blog primitives without broad abstraction

**Files:**
- Modify: `src/components/blog/BlogNavigation.{tsx,module.css}`
- Modify: `src/app/blog/BlogBrandWordmark.{tsx,module.css}`
- Modify: `src/app/blog/BlogAutoplayVideo.tsx`
- Modify: `src/app/blog/blog-home-assets.ts`
- Modify: any directly consuming blog CSS modules.

**Interfaces:**
- `BlogNavigation` keeps explicit `variant`, `surface`, `condensed`, `searchPosts`, and optional reading-progress inputs.
- `BlogBrandWordmark` keeps `compact` and `className` inputs.
- `BlogAutoplayVideo` keeps `src`, optional `poster`, `alt`, and optional `className` inputs.
- `BLOG_HOME_MEDIA` remains the typed image/video registry with alt and focal-point metadata.

- [ ] Remove repeated stable surface/control/font literals in these primitives in favor of blog tokens.
- [ ] Do not introduce generic Button/Card wrappers or alter interaction APIs.
- [ ] Confirm the home and article navigation preserve search/account keyboard behavior and reading progress.

### Task 4: Write operational design documentation

**Files:**
- Create: `docs/design/README.md`
- Create: `docs/design/BLOG_EXPERIENCE_SYSTEM.md`
- Create: `docs/design/BLOG_EXPERIENCE_HANDOFF.md`
- Modify: `docs/design/05-design-qa-report.md`

- [ ] Write the entry-point README with document order, authority, and historical links to 04/05.
- [ ] Document the blog theme token table, typography roles, component APIs, visual rules, hardcoded exceptions, media registry, accessibility, and responsive rules.
- [ ] Document completed scope, exact file map, validation method, exclusions, and next priority order.
- [ ] Replace historical QA claims with the actual final command results and measured viewport evidence.

### Task 5: Final validation and atomic commits

**Files:** all approved A-scope files only.

- [ ] Check 1440x900, 768x900, and 393x852 in Chromium for layout, wrapping, glass navigation, image cards, composer, CTA, and horizontal overflow.
- [ ] Run `npm run lint`, `npm run build`, `npm run test:e2e -- tests/blog-navigation.spec.ts tests/blog-home-experience.spec.ts tests/blog-article-actions.spec.ts`, and `git diff --check` exactly once after implementation completes.
- [ ] Update the QA report with pass/fail/skipped evidence and separate environment limitations from regressions.
- [ ] Commit in order: `docs(design): add blog experience system and handoff`; `refactor(blog): extract image showroom experience tokens and primitives`; `feat(blog): preserve approved image showroom behavior through system migration`.

### Task 6: PR and merge closeout

- [ ] Push `codex/blog-image-showroom-system`.
- [ ] Create a draft PR with base `v2-cms`; verify only A-scope paths appear.
- [ ] Confirm required GitHub checks, then mark ready.
- [ ] Squash merge only if no scope drift, conflict, or required-check failure remains; delete the branch.
- [ ] Verify the resulting squash merge commit is reachable from `origin/v2-cms`.

## Self-review

- The plan maps every user requirement to an implementation, documentation, validation, or GitHub closeout task.
- The plan intentionally excludes B/C/D paths, shared `--mg-*` migration, and premature generic component abstraction.
- Browser-only iteration and one full final validation run are explicit.
