# Munjanggun Design System Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project-wide Munjanggun design system and then migrate login, account menu, My Page, intake flows, and blog reader actions onto that system without a risky big-bang rewrite.

**Architecture:** Central brand tokens stay authoritative in `C:/Users/hjh/안티그래비티/문장군_브랜드`. This project receives a versioned `--mg-*` token snapshot plus semantic theme aliases, then shared React/CSS-module primitives consume those semantic aliases. Route-level CSS should become mostly layout and domain spacing, not a second design system.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, CSS custom properties, lucide-react, Supabase SSR/client, Playwright.

---

## Scope Decision

This is not one feature. It is a design-system program with dependent product surfaces.

The work must be split into seven phases:

1. **Foundation:** project tokens, theme scopes, primitive UI components.
2. **Portal Shell:** shared customer shell, top navigation, account/menu pattern.
3. **My Page Renewal:** dashboard, recent requests, saved/helpful/question collections.
4. **Intake Renewal:** free measurement and A/S forms moved into the same shell/component system.
5. **Blog Reader Actions:** bottom action bar, question entry, save/helpful/share states.
6. **Persistence:** DB-backed helpful/saved/question data and My Page aggregation.
7. **Review/Hardening:** code review, design review, debugging, RLS/data ownership review.

Phase 1 must land first because the user explicitly wants themeable design rules, not hard-coded page redesigns.

---

## Non-Negotiable Constraints

- Do not overwrite active PR-A blog work unless the current task explicitly says to absorb PR-A.
- Preserve old `--color-*`, `--admin-*`, and `--blog-*` tokens as compatibility aliases during Phase 1.
- New shared components consume semantic `--mg-*` aliases, not raw hex values.
- Customer portal, intake, and platform admin must follow `docs/platform/PLATFORM_UI_CONSTITUTION.md`.
- Blog comments are not public comments in the first implementation. Use private inquiry or approved Q&A.
- No customer names, phone numbers, detailed addresses, raw records, transcripts, tokens, cookies, or secrets in docs/tests.
- Mobile 390px must not have horizontal overflow.
- Button states must be readable in default, hover, active, active-hover, disabled, and focus-visible states.

---

## Phase 0: Confirm Baseline And Guard Rails

**Files:**
- Read: `C:/Users/hjh/안티그래비티/문장군_브랜드/BRAND_CONTEXT.md`
- Read: `C:/Users/hjh/안티그래비티/문장군_브랜드/FIELD_JUDGMENT_RULES.md`
- Read: `C:/Users/hjh/안티그래비티/문장군_브랜드/DESIGN.md`
- Read: `C:/Users/hjh/안티그래비티/문장군_브랜드/PROJECT_ADAPTERS.md`
- Read: `C:/Users/hjh/안티그래비티/문장군_브랜드/CHANGELOG.md`
- Read: `C:/Users/hjh/안티그래비티/문장군_브랜드/tokens/brand.css`
- Read: `C:/Users/hjh/안티그래비티/문장군_브랜드/tokens/brand.tokens.json`
- Read: `docs/brand/BRAND_SOURCE.md`
- Read: `docs/brand/PROJECT_BRAND_ADAPTER.md`
- Read: `docs/platform/PLATFORM_UI_CONSTITUTION.md`
- Read: `docs/platform/PLATFORM_STRATEGY.md`
- Read: `docs/platform/PLATFORM_TASKS.md`
- Read: `docs/platform/DEVELOPMENT_STRATEGY.md`
- Read: `docs/platform/TEAM_AGENT_OPERATING_MODEL.md`
- Read: `docs/showroom/DESIGN_SYSTEM.md`
- Inspect: `src/app/globals.css`
- Inspect: `src/app/login/page.tsx`
- Inspect: `src/app/login/login.module.css`
- Inspect: `src/app/portal/page.tsx`
- Inspect: `src/app/portal/portal.module.css`
- Inspect: `src/app/portal/measure/new/MeasureForm.tsx`
- Inspect: `src/app/portal/measure/new/measure-form.module.css`
- Inspect: `src/app/portal/as/new/AsForm.tsx`
- Inspect: `src/app/portal/as/new/as-form.module.css`
- Inspect: `src/components/customer/PublicUserMenu.tsx`
- Inspect: `src/components/customer/PublicUserMenu.module.css`
- Inspect: `src/components/blog/BlogArticleActions.tsx`
- Inspect: `src/components/blog/BlogArticleActions.module.css`

- [ ] **Step 1: Check dirty worktree**

Run:

```powershell
git status -sb
```

Expected:

```text
Current PR-A blog reading-nav files may be modified or untracked.
Do not revert them.
```

- [ ] **Step 2: Inventory hard-coded design values**

Run:

```powershell
rg "#[0-9A-Fa-f]{3,8}|rgba\(|rgb\(" src/app src/components -g "*.css" -n
```

Expected:

```text
List of CSS modules still owning raw colors. Use this as migration map, not as a reason to rewrite all files immediately.
```

- [ ] **Step 3: Confirm Next.js local docs before implementation**

Run:

```powershell
Get-ChildItem -LiteralPath "node_modules/next/dist/docs" -Recurse -Filter "*.md" | Select-Object -First 20
```

Expected:

```text
Next docs are available locally. Before code edits, read the App Router, CSS, and client component docs relevant to the files being changed.
```

---

## Phase 1: Design-System Foundation

**Files:**
- Create: `src/styles/munjanggun-brand.css`
- Create: `src/components/platform/ui/PlatformButton.tsx`
- Create: `src/components/platform/ui/PlatformButton.module.css`
- Create: `src/components/platform/ui/PlatformIconButton.tsx`
- Create: `src/components/platform/ui/PlatformIconButton.module.css`
- Create: `src/components/platform/ui/PlatformCard.tsx`
- Create: `src/components/platform/ui/PlatformCard.module.css`
- Create: `src/components/platform/ui/PlatformBadge.tsx`
- Create: `src/components/platform/ui/PlatformBadge.module.css`
- Create: `src/components/platform/ui/PlatformField.tsx`
- Create: `src/components/platform/ui/PlatformField.module.css`
- Create: `src/components/platform/ui/PlatformShell.tsx`
- Create: `src/components/platform/ui/PlatformShell.module.css`
- Create: `src/components/platform/ui/index.ts`
- Modify: `src/app/globals.css`
- Test: `tests/platform-design-system.spec.ts`

- [ ] **Step 1: Add semantic project token snapshot**

Add `src/styles/munjanggun-brand.css` with three layers:

```css
/**
 * Munjanggun project design-system tokens.
 * Source snapshot: C:/Users/hjh/안티그래비티/문장군_브랜드/tokens/brand.css v3.0.
 * Update central brand files first, then refresh this project snapshot.
 */

:root {
  --mg-cocoa-oak: #2C221E;
  --mg-clay-terracotta: #B35D43;
  --mg-clay-terracotta-hover: #9E4F39;
  --mg-cashmere-cream: #F5EFE6;
  --mg-toasted-almond: #C5B9A5;
  --mg-verified-navy: #1D3858;
  --mg-paper-white: #FFFCF7;
  --mg-warm-line: #E2D7C8;
  --mg-warm-line-strong: #C5B9A5;
  --mg-ink-warm: #171512;
  --mg-body-warm: #443B34;
  --mg-muted-warm: #6B6259;
  --mg-cream-soft: #FAF7F0;
  --mg-almond-soft: #EFE6DA;
  --mg-navy-soft: #E7EEF5;
  --mg-caution-red: #C74332;
  --mg-success-green: #5C8A62;
  --mg-on-dark: #FFFCF7;
  --mg-on-terracotta: #FFFFFF;

  --mg-font-brand-ko: "Noto Serif KR", "Song Myung", "Noto Serif CJK KR", serif;
  --mg-font-body: "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  --mg-font-latin: "Manrope", "Inter", "Pretendard", system-ui, sans-serif;

  --mg-radius-xs: 4px;
  --mg-radius-sm: 6px;
  --mg-radius-md: 8px;
  --mg-radius-lg: 12px;
  --mg-radius-full: 999px;

  --mg-space-xs: 6px;
  --mg-space-sm: 10px;
  --mg-space-md: 16px;
  --mg-space-lg: 24px;
  --mg-space-xl: 36px;
  --mg-space-xxl: 56px;
  --mg-space-section: 88px;

  --mg-surface-page: var(--mg-cashmere-cream);
  --mg-surface-page-soft: var(--mg-cream-soft);
  --mg-surface-card: var(--mg-paper-white);
  --mg-surface-card-subtle: var(--mg-almond-soft);
  --mg-surface-inverse: var(--mg-cocoa-oak);
  --mg-border-subtle: var(--mg-warm-line);
  --mg-border-strong: var(--mg-warm-line-strong);
  --mg-text-primary: var(--mg-ink-warm);
  --mg-text-body: var(--mg-body-warm);
  --mg-text-muted: var(--mg-muted-warm);
  --mg-action-primary: var(--mg-clay-terracotta);
  --mg-action-primary-hover: var(--mg-clay-terracotta-hover);
  --mg-action-primary-text: var(--mg-on-terracotta);
  --mg-action-secondary: var(--mg-paper-white);
  --mg-action-secondary-text: var(--mg-cocoa-oak);
  --mg-focus-ring: var(--mg-clay-terracotta);
  --mg-state-success: var(--mg-success-green);
  --mg-state-danger: var(--mg-caution-red);
  --mg-state-proof: var(--mg-verified-navy);
  --mg-shadow-card: 0 14px 34px rgba(44, 34, 30, 0.08);
  --mg-shadow-elevated: 0 26px 70px rgba(44, 34, 30, 0.18);
}

[data-mg-theme="portal"] {
  color-scheme: light;
  --mg-current-bg: var(--mg-surface-page);
  --mg-current-surface: var(--mg-surface-card);
  --mg-current-text: var(--mg-text-primary);
}

[data-mg-theme="showroom-dark"] {
  color-scheme: dark;
  --mg-current-bg: #0C0C0E;
  --mg-current-surface: #1A1A1F;
  --mg-current-text: #F5F5F7;
}

[data-mg-theme="admin"] {
  color-scheme: light;
  --mg-current-bg: #F8F8FA;
  --mg-current-surface: #FFFFFF;
  --mg-current-text: #111114;
}
```

- [ ] **Step 2: Import tokens without breaking legacy pages**

Modify `src/app/globals.css` near the top:

```css
@import "../styles/munjanggun-brand.css";
```

Expected behavior:

```text
Existing --color-*, --admin-*, and --blog-* consumers still render because they remain defined.
New components can use --mg-* tokens.
```

- [ ] **Step 3: Create primitive components**

Create primitives with explicit variants:

```text
PlatformButton: variant primary | secondary | ghost | danger, size md | sm, disabled/loading state.
PlatformIconButton: square icon button with aria-label required by caller.
PlatformCard: variant default | subtle | inverse, optional href behavior should use Link at call site.
PlatformBadge: tone neutral | action | success | danger | proof.
PlatformField: label + input/textarea wrapper for consistent focus/error/disabled states.
PlatformShell: page frame with top bar slot, hero slot, main content slot, data-mg-theme attribute.
```

Expected:

```text
No primitive contains customer data fetching or route-specific logic.
No primitive imports Supabase.
No primitive uses raw page copy.
```

- [ ] **Step 4: Write Playwright smoke coverage**

Create `tests/platform-design-system.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('portal surface has no mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/api/dev/playwright-login?role=customer&next=/portal')
  await page.waitForURL('**/portal')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('portal keeps primary service actions reachable', async ({ page }) => {
  await page.goto('/api/dev/playwright-login?role=customer&next=/portal')
  await page.waitForURL('**/portal')
  await expect(page.getByRole('link', { name: /실측|상담|무료/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /A\/S|AS|접수/ })).toBeVisible()
})
```

Expected:

```text
The first run may fail until Phase 2 migrates portal markup. Keep the test as the guardrail.
```

---

## Phase 2: Portal Shell And Account Menu

**Files:**
- Modify: `src/app/portal/page.tsx`
- Modify: `src/app/portal/portal.module.css`
- Modify: `src/components/customer/PublicUserMenu.tsx`
- Modify: `src/components/customer/PublicUserMenu.module.css`
- Create: `src/components/platform/customer/CustomerAccountMenu.tsx`
- Create: `src/components/platform/customer/CustomerAccountMenu.module.css`
- Create: `src/components/platform/customer/CustomerTopNav.tsx`
- Create: `src/components/platform/customer/CustomerTopNav.module.css`
- Test: `tests/platform-design-system.spec.ts`

- [ ] **Step 1: Extract account menu responsibility**

Create `CustomerAccountMenu` with these props:

```ts
interface CustomerAccountMenuProps {
  displayName?: string
  email?: string
  isAuthenticated: boolean
  portalHref?: string
  onLogout?: () => void
}
```

Expected:

```text
Public user menu and portal header can share the same visual rule without sharing route-specific fetching.
```

- [ ] **Step 2: Replace portal header with CustomerTopNav**

`CustomerTopNav` should provide:

```text
left: home/back link
center: Munjanggun brand/home
right: account menu or login action
mobile: compact no-overflow layout
```

Expected:

```text
/portal no longer owns custom button/header state styles.
```

- [ ] **Step 3: Keep current data fetching intact**

Do not change:

```text
Supabase auth lookup
measurement_requests query
as_requests query
customer-request-action API
```

Expected:

```text
Only presentation changes in Phase 2.
```

---

## Phase 3: My Page Renewal

**Files:**
- Modify: `src/app/portal/page.tsx`
- Modify: `src/app/portal/portal.module.css`
- Create: `src/components/platform/customer/CustomerDashboard.tsx`
- Create: `src/components/platform/customer/CustomerDashboard.module.css`
- Create: `src/components/platform/customer/RequestSummaryCard.tsx`
- Create: `src/components/platform/customer/RequestSummaryCard.module.css`
- Create: `src/components/platform/customer/CustomerCollectionPanel.tsx`
- Create: `src/components/platform/customer/CustomerCollectionPanel.module.css`
- Test: `tests/platform-design-system.spec.ts`

- [ ] **Step 1: Restructure My Page into clear zones**

Use this order:

```text
1. Account/status header
2. Primary actions: 무료 실측, A/S 접수
3. Recent requests: measurement and A/S
4. My blog activity: saved/helpful/questions placeholder panel
5. Help/exit actions
```

Expected:

```text
The user sees "what can I do now" before historical data.
```

- [ ] **Step 2: Add blog activity placeholders without fake persistence**

Show empty or local-only panels:

```text
저장한 글
도움돼요 누른 글
남긴 질문
```

Expected:

```text
No fake counts. If DB is not ready, label the panel as 준비 중 or local-only through product copy that does not mislead.
```

- [ ] **Step 3: Verify mobile and desktop**

Run:

```powershell
npm run lint
npm run build
CI=1 npm run test:e2e -- tests/platform-design-system.spec.ts --project=chromium
```

Expected:

```text
Lint passes except known unrelated warnings already present in the repo.
Build passes.
Playwright passes at 390px and desktop.
```

---

## Phase 4: Login And Intake Renewal

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/login/login.module.css`
- Modify: `src/app/portal/measure/new/MeasureForm.tsx`
- Modify: `src/app/portal/measure/new/measure-form.module.css`
- Modify: `src/app/portal/as/new/AsForm.tsx`
- Modify: `src/app/portal/as/new/as-form.module.css`
- Modify: `src/components/platform/IntakeRouteLoading.tsx`
- Modify: `src/components/platform/IntakeRouteLoading.module.css`
- Test: `tests/platform-design-system.spec.ts`

- [ ] **Step 1: Login visual renewal**

Replace page-owned button/card/field styling with:

```text
PlatformShell
PlatformCard
PlatformButton
PlatformIconButton
PlatformField
CustomerTopNav or close/home action
```

Expected:

```text
Kakao remains visually distinct, but layout, radius, spacing, focus, and error states follow the system.
```

- [ ] **Step 2: Intake shell renewal**

Both free measurement and A/S intake should share:

```text
top navigation
loading skeleton
exit pattern
section headings
field rhythm
completion/error state
sticky mobile submit area if needed
```

Expected:

```text
The two forms feel like one Munjanggun product, not two separate apps.
```

---

## Phase 5: Blog Reader Actions

**Files:**
- Modify after PR-A is stable: `src/components/blog/BlogArticleActions.tsx`
- Modify after PR-A is stable: `src/components/blog/BlogArticleActions.module.css`
- Modify after PR-A is stable: `src/components/blog/BlogPostRenderer.tsx`
- Create: `src/components/blog/BlogReaderActionBar.tsx`
- Create: `src/components/blog/BlogReaderActionBar.module.css`
- Create: `src/components/blog/BlogQuestionPanel.tsx`
- Create: `src/components/blog/BlogQuestionPanel.module.css`
- Test: `tests/blog-article-actions.spec.ts`

- [ ] **Step 1: Keep PR-A top bar behavior**

Expected:

```text
Mobile top reading nav appears only when scrolling upward.
Desktop keeps it hidden.
No horizontal overflow at 390px.
```

- [ ] **Step 2: Add bottom action bar**

Bottom actions:

```text
도움돼요
질문하기
무료 실측
더보기: 공유, 저장
```

Expected:

```text
Core user actions are one tap away on mobile. Secondary actions do not crowd the bar.
```

- [ ] **Step 3: Add private question entry**

Question behavior:

```text
Not public comment.
Capture article context.
Route authenticated users to inquiry flow or panel.
Route unauthenticated users through login with next URL.
No personal information is requested inside the public blog comment area.
```

Expected:

```text
AEO-friendly approved Q&A can come later, but first implementation is private and safe.
```

---

## Phase 6: Persistence And My Page Aggregation

**Files:**
- Inspect: `src/types/database.ts`
- Inspect: `docs/platform/PLATFORM_DB_RBAC_DESIGN.md`
- Create or modify Supabase migration files only after schema/RLS review.
- Create: `src/app/api/platform/blog-actions/route.ts`
- Create: `src/app/api/platform/blog-questions/route.ts`
- Modify: `src/app/portal/page.tsx`
- Modify: `src/types/database.ts`
- Test: API tests or Playwright flows depending on existing test pattern.

- [ ] **Step 1: Design DB model before code**

Required entities:

```text
blog_helpful_events: article_id, user_id or anonymous key, created_at
blog_saved_articles: article_id, user_id, created_at
blog_questions: article_id, user_id, question_body, status, created_at
```

Expected:

```text
RLS confirms users can read/write only their own private activity.
Admin can moderate approved Q&A.
Public cannot see raw questions.
```

- [ ] **Step 2: Move My Page placeholders to real data**

Expected:

```text
My Page shows saved articles, helpful articles, and submitted questions when persistence exists.
```

---

## Phase 7: Collaboration Review, Design Review, Debugging

**Files:**
- Review changed files from each phase.
- Review generated screenshots if available.
- Review tests and build logs.

- [ ] **Step 1: Code review subagent**

Ask for:

```text
TypeScript correctness
component boundaries
auth/RLS risk
unrelated PR-A damage
test gaps
```

- [ ] **Step 2: Design review subagent**

Ask for:

```text
brand-token fidelity
mobile 390px readability
button state contrast
portal/blog/admin density fit
hard-coded visual drift
```

- [ ] **Step 3: Debug review**

Run:

```powershell
npm run lint
npm run build
CI=1 npm run test:e2e -- tests/platform-design-system.spec.ts --project=chromium
CI=1 npm run test:e2e -- tests/blog-article-actions.spec.ts --project=chromium
git diff --check
```

Expected:

```text
No blocking build/test failures.
Known unrelated lint warnings are documented if still present.
```

---

## Recommended Execution Order

1. Finish or preserve current PR-A branch state.
2. Execute Phase 1 and Phase 2 together as the first working slice.
3. Review Phase 1/2 with code and design subagents.
4. Execute Phase 3 My Page renewal.
5. Review My Page in browser at 390px and 1366px.
6. Execute Phase 4 intake/login renewal.
7. Execute Phase 5 blog actions after PR-A is stable.
8. Execute Phase 6 persistence only after RLS/schema review.
9. Run Phase 7 verification before marking the goal complete.

---

## Self Review

- Spec coverage: The plan covers design standardization, theme capability, login/account menu, My Page, free measurement, A/S, blog actions, questions, saves, and review/debug collaboration.
- Placeholder scan: Dependent DB work is intentionally blocked behind schema/RLS review; it is not marked as implementation-ready before that review.
- Risk check: Phase 1 keeps legacy tokens, which reduces breakage. PR-A blog files are protected until the blog phase.
- Design check: Components consume semantic `--mg-*` roles so light/dark or role-based theme changes can happen through token scopes rather than page rewrites.
