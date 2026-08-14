# Link Page Studio V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Littly-faithful link-page studio with scalable page-tree management, explicit navigation/child page roles, stable internal page destinations, URL metadata suggestions, and a complete curated design studio.

**Architecture:** Upgrade browser state to a validated V2 schema before changing UI. Keep tree indexing, destination/navigation resolution, theme recipes, metadata fetching, and React views in separate focused modules. The preview and public route continue to share `LinkPageRenderer`; page relationships never directly generate public child navigation.

**Tech Stack:** Next.js 16.2.4 App Router, React 19.2.4, TypeScript, CSS Modules, Lucide React, browser localStorage/IndexedDB prototype repository, Playwright 1.60.

## Global Constraints

- Public URLs remain flat: `/l/{slug}`.
- Every page remains a complete independent entry point.
- Page/block/item/asset UUIDs and slug aliases survive V1→V2 migration.
- Preview and public pages use the same renderer and destination resolver.
- `navigation` pages may appear in the top menu; `child` pages never appear there automatically.
- New page creation asks for `navigation` or `child` before name, slug, and parent details.
- Child pages require a parent; navigation pages have `parentId: null`.
- External destinations open a new tab; internal page destinations use the current canonical slug in the same tab.
- Random themes come only from reviewed recipes and must change only theme state.
- Normal text contrast is at least 4.5:1; large text and UI boundaries are at least 3:1.
- Chrome is the user-selected browser for final visual verification.
- Do not implement analytics dashboards, CRM, payments, outbound messaging, or external account connections.

---

## File Structure

### Create

- `src/lib/link-pages/tree.ts`: O(N) tree index, visible-row calculation, ancestor helpers.
- `src/lib/link-pages/navigation.ts`: navigation-page resolution, internal/external destination resolution, inbound page references.
- `src/lib/link-pages/theme-recipes.ts`: reviewed recipes, contrast helpers, non-repeating recipe selection.
- `src/lib/link-pages/url-metadata.ts`: URL validation, safe metadata normalization, HTML metadata parsing.
- `src/components/link-pages/PageTree.tsx`: searchable accessible tree and collapse state.
- `src/components/link-pages/PageTree.module.css`: connector lines, dense rows, selected/focus states.
- `src/components/link-pages/PageTypeSelector.tsx`: first-step navigation/child choice.
- `src/components/link-pages/LinkDestinationField.tsx`: shared external/internal destination editor.
- `src/components/link-pages/DesignStudio.tsx`: complete design controls, random recipe, locks, undo.
- `src/components/link-pages/DesignStudio.module.css`: Littly-derived tile layout and responsive states.
- `src/app/api/link-pages/metadata/route.ts`: guarded server-only metadata endpoint.

### Modify

- `src/lib/link-pages/model.ts`: V2 types, migration, validation, page-role creation, expanded theme.
- `src/lib/link-pages/browser-repository.ts`: migrate before validate; preserve recovery error instead of seed reset.
- `src/components/link-pages/LinkPageStudio.tsx`: compose new focused components and two-step page creation.
- `src/components/link-pages/LinkPageStudio.module.css`: widened/drawer rail integration and remaining shell layout.
- `src/components/link-pages/LinkPageRenderer.tsx`: role-based navigation, common destinations, theme effects.
- `src/components/link-pages/LinkPageRenderer.module.css`: borderless cards, top-menu styles, shapes/actions/backgrounds.
- `src/components/link-pages/PublicLinkPageClient.tsx`: pass all pages to the shared resolver.
- `scripts/test-link-page-prototype.mjs`: source-contract assertions for V2 boundaries.
- `tests/link-page-prototype.spec.ts`: runtime migration, tree, roles, links, themes, metadata, responsive tests.

---

### Task 1: V2 Model and Lossless Migration

**Files:**
- Modify: `src/lib/link-pages/model.ts`
- Modify: `src/lib/link-pages/browser-repository.ts`
- Modify: `scripts/test-link-page-prototype.mjs`

**Interfaces:**
- Produces: `LinkPageRole`, `LinkDestination`, expanded `LinkPageTheme`, `LinkPageStateV2`, `migrateLinkPageState(raw): LinkPageStateV2`, `isLinkPageStateV2(value): boolean`.
- Preserves: existing IDs, slug aliases, asset references, event storage key.

- [ ] **Step 1: Add failing contract assertions**

Assert that `model.ts` declares `version: 2`, `LinkPageRole`, `LinkDestination`, `migrateLinkPageState`, and migration-before-validation repository flow. Assert no direct invalid-state-to-seed reset is used for recognized V1 state.

- [ ] **Step 2: Run the contract test and observe failure**

Run: `npm run test:link-page-prototype`
Expected: FAIL because V2 symbols and migration do not exist.

- [ ] **Step 3: Implement exact V2 migration rules**

Add:

```ts
export type LinkPageRole = 'navigation' | 'child'
export type LinkDestination =
  | { kind: 'external'; url: string }
  | { kind: 'page'; pageId: string }
```

Convert root pages to `navigation`, non-root pages to `child`, existing single/group/gallery URLs to external destinations, and old theme values to the new defaults. Preserve all identifiers and aliases byte-for-byte. Make migration idempotent.

- [ ] **Step 4: Validate without destructive fallback**

Repository load order must be `parse → migrate recognized V1/V2 → validate V2 → persist migrated V2`. On unrecognized corrupt data, surface a recoverable load error and keep the raw key intact until the user chooses reset.

- [ ] **Step 5: Run contract, TypeScript, and targeted lint**

Run:

```powershell
npm run test:link-page-prototype
npx tsc --noEmit --incremental false
npx eslint src/lib/link-pages/model.ts src/lib/link-pages/browser-repository.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/link-pages/model.ts src/lib/link-pages/browser-repository.ts scripts/test-link-page-prototype.mjs
git commit -m "feat: migrate link page state to v2"
```

### Task 2: O(N) Accessible Page Tree

**Files:**
- Create: `src/lib/link-pages/tree.ts`
- Create: `src/components/link-pages/PageTree.tsx`
- Create: `src/components/link-pages/PageTree.module.css`
- Modify: `src/components/link-pages/LinkPageStudio.tsx`
- Modify: `src/components/link-pages/LinkPageStudio.module.css`
- Modify: `tests/link-page-prototype.spec.ts`

**Interfaces:**
- Consumes: V2 `LinkPage[]`, selected page ID.
- Produces: `createPageTreeIndex(pages)`, `getVisibleTreeRows(index, expandedIds, query)`, `getAncestorIds(index, pageId)`, `PageTree` callbacks for select/add/edit/copy/delete.

- [ ] **Step 1: Write failing Playwright coverage**

Seed a four-level tree and assert per-node expand buttons, nested `treeitem` levels, connector-bearing rows, selected-ancestor auto expansion, search preserving ancestor path, and reload persistence. Add a 300-page seed asserting a collapsed root removes descendants from the DOM.

- [ ] **Step 2: Run the focused browser test and observe failure**

Run: `npm run test:link-page-prototype-browser -- --grep "page tree"`
Expected: FAIL because accessible tree controls do not exist.

- [ ] **Step 3: Implement tree index and visible rows**

Build `byId` and sorted `childrenByParentId` maps once. Use stable `sortOrder` then ID ordering. Detect cycles defensively and exclude invalid edges from visible traversal without mutating stored state.

- [ ] **Step 4: Implement dense PageTree**

Use nested `role="tree"`, `role="treeitem"`, and `role="group"`; `aria-level`, `aria-expanded`, `aria-selected`; ArrowUp/Down navigation, ArrowLeft collapse/parent, ArrowRight expand/first child, Enter selection. Persist expanded IDs under `munjanggun:link-page-tree:v1`. Draw vertical/elbow connectors with CSS borders, not text glyphs.

- [ ] **Step 5: Integrate responsive rail**

Desktop uses a dense named-page rail with search, add, collapse-all, and selected-path actions. At narrow editor widths the tree opens as a drawer; the public route remains unchanged.

- [ ] **Step 6: Run focused tests and lint**

Run:

```powershell
npm run test:link-page-prototype-browser -- --grep "page tree"
npx eslint src/lib/link-pages/tree.ts src/components/link-pages/PageTree.tsx src/components/link-pages/LinkPageStudio.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/link-pages/tree.ts src/components/link-pages/PageTree.tsx src/components/link-pages/PageTree.module.css src/components/link-pages/LinkPageStudio.tsx src/components/link-pages/LinkPageStudio.module.css tests/link-page-prototype.spec.ts
git commit -m "feat: add scalable link page tree"
```

### Task 3: Page Type First and Role-Based Top Navigation

**Files:**
- Create: `src/components/link-pages/PageTypeSelector.tsx`
- Create: `src/lib/link-pages/navigation.ts`
- Modify: `src/components/link-pages/LinkPageStudio.tsx`
- Modify: `src/components/link-pages/LinkPageRenderer.tsx`
- Modify: `src/components/link-pages/PublicLinkPageClient.tsx`
- Modify: `tests/link-page-prototype.spec.ts`

**Interfaces:**
- Produces: `getNavigationPages(state): LinkPage[]`, `PageTypeSelector({ value, onChange })`.
- Enforces: navigation→`parentId:null`; child→required valid parent; published navigation pages only in public top menu.

- [ ] **Step 1: Write failing role-flow tests**

Assert `페이지 추가` first shows exactly two large choices, `네비게이션 페이지` and `자식 페이지`. Assert navigation creation does not request a parent; child creation requires parent selection. Assert only published navigation pages appear in preview/public top navigation.

- [ ] **Step 2: Run focused test and observe failure**

Run: `npm run test:link-page-prototype-browser -- --grep "page type|top navigation"`
Expected: FAIL because creation starts with the detail form and children appear in inferred navigation.

- [ ] **Step 3: Implement two-step creation and edit invariants**

First dialog state stores the chosen role. The detail step conditionally shows parent selection. Editing role to navigation clears parent; editing to child requires a non-descendant parent. New child sort order is computed within the chosen parent.

- [ ] **Step 4: Replace inferred navigation**

`getNavigationPages` returns only published `role === 'navigation'` pages in root sort order. Renderer labels use actual titles; no first-array-item `홈화면` heuristic. Design theme may hide or restyle the menu on a page, but child relationships never add items.

- [ ] **Step 5: Verify runtime and commit**

Run TypeScript, targeted lint, contract test, and focused Playwright. Commit as `feat: separate navigation and child pages`.

### Task 4: Stable Internal Page Destinations

**Files:**
- Create: `src/components/link-pages/LinkDestinationField.tsx`
- Modify: `src/lib/link-pages/navigation.ts`
- Modify: `src/components/link-pages/LinkPageStudio.tsx`
- Modify: `src/components/link-pages/LinkPageRenderer.tsx`
- Modify: `tests/link-page-prototype.spec.ts`

**Interfaces:**
- Produces: `resolveDestination(state, destination): { href: string; external: boolean; pageId?: string } | null`, `getInboundPageReferences(state, pageId)`.
- Applies to: single link, group items, gallery items.

- [ ] **Step 1: Write failing destination tests**

Create one external and one internal single link, one internal group item, and one internal gallery image. Change the target slug and assert all internal hrefs use the new canonical slug. Assert external opens `_blank`, internal stays same-tab, and preview calls `onNavigate(pageId)`.

- [ ] **Step 2: Add failing deletion-reference test**

Attempt to delete a referenced page and assert the dialog lists inbound block/navigation references and requires `연결 제거` or cancellation before deletion.

- [ ] **Step 3: Implement shared field and resolvers**

Use segmented external/internal choice. Internal selector stores UUID only. Exclude the current page from default suggestions but allow deliberate self-link through search if needed. Draft targets show an editor warning and render disabled publicly.

- [ ] **Step 4: Add `페이지 이동` picker preset**

Keep the seven block kinds unchanged. The preset creates a `singleLink` whose destination starts as `{ kind: 'page', pageId: '' }` and opens the same single-link editor.

- [ ] **Step 5: Remove generic link outline**

Base single-link cards have `border: 0; outline: 0`. The highlight toggle uses the selected theme action class, with a static reduced-motion alternative.

- [ ] **Step 6: Verify and commit**

Run focused Playwright, contract, TypeScript, and lint. Commit as `feat: add internal page destinations`.

### Task 5: Littly-Derived Design Studio and Curated Random Themes

**Files:**
- Create: `src/lib/link-pages/theme-recipes.ts`
- Create: `src/components/link-pages/DesignStudio.tsx`
- Create: `src/components/link-pages/DesignStudio.module.css`
- Modify: `src/components/link-pages/LinkPageStudio.tsx`
- Modify: `src/components/link-pages/LinkPageRenderer.tsx`
- Modify: `src/components/link-pages/LinkPageRenderer.module.css`
- Modify: `tests/link-page-prototype.spec.ts`

**Interfaces:**
- Produces: `THEME_RECIPES`, `selectNextTheme(recipes, currentId, rng)`, `getReadableTextColor(color)`, expanded `LinkPageTheme` fields for background, buttons, shape, action, typography, top menu, share controls, and logo.

- [ ] **Step 1: Write failing design-control tests**

Assert Littly-derived section order and visual tiles: recommendation, background, button color/scope, shape 3, action 5, typography, top menu, share/subscription, logo. Assert selection uses radio/`aria-pressed`, not `disabled`.

- [ ] **Step 2: Write failing random-theme invariants**

Click recommendation twice and assert a different reviewed recipe, page/block/item IDs unchanged, theme persisted after reload, live region announcement present, and undo restores exact previous theme. Lock background and assert the next recommendation preserves it.

- [ ] **Step 3: Implement reviewed theme recipes**

Define named recipes using brand-safe Ink/Forest and neutral palettes. Validate contrast when recipes are declared. `selectNextTheme` receives RNG for deterministic tests and never calls randomness during render.

- [ ] **Step 4: Implement DesignStudio controls**

Match the captured Littly tile density and section order. Provide preset plus HEX controls, photo upload via existing asset repository, shape/action preview tiles, type samples, top-menu choices, share/subscription choices, logo upload/default/hidden, recommendation locks, and one-level undo.

- [ ] **Step 5: Connect every visible control to the shared renderer**

Apply background solid/photo, readable text, button color/scope, three shapes, five named 문장군 actions, typography sets, top-menu style/visibility, utility button visibility, and logo state. Respect `prefers-reduced-motion`.

- [ ] **Step 6: Verify and commit**

Run focused design Playwright, TypeScript, lint, and contract. Commit as `feat: build curated link page design studio`.

### Task 6: Safe URL Metadata Suggestions

**Files:**
- Create: `src/lib/link-pages/url-metadata.ts`
- Create: `src/app/api/link-pages/metadata/route.ts`
- Modify: `src/components/link-pages/LinkDestinationField.tsx`
- Modify: `src/components/link-pages/LinkPageStudio.tsx`
- Modify: `tests/link-page-prototype.spec.ts`

**Interfaces:**
- Produces: `POST /api/link-pages/metadata` with `{ url }` and response `{ title?: string; imageUrl?: string; faviconUrl?: string; status: 'found'|'empty'|'blocked' }`.
- Security: HTTP(S) only, no localhost/private/link-local IP, redirect limit, timeout, HTML content-type, response-size cap.

- [ ] **Step 1: Read the installed Next.js Route Handler guide**

Read the relevant files under `node_modules/next/dist/docs/` for Next.js 16 Route Handlers and request/response APIs before writing route code.

- [ ] **Step 2: Write failing parser and browser states**

Add contract fixtures for OG title/image, ordinary title/favicon, empty metadata, invalid URL, and private-address rejection. Add UI assertions for loading, found, empty/blocked, and manual override.

- [ ] **Step 3: Implement guarded fetch and parser**

Resolve and reject private destinations before each request and redirect. Abort after the chosen timeout, stop after the size cap, accept HTML only, normalize relative metadata URLs against the final response URL, and return no raw HTML.

- [ ] **Step 4: Integrate debounced suggestions**

Fetch only for valid external destinations. Do not overwrite a title/image the user changed after the request started. Cache identical URL results in memory for the editor session. Keep manual image upload available for blocked sites.

- [ ] **Step 5: Verify and commit**

Run contract, TypeScript, route lint, and focused Playwright with a local mocked route response. Commit as `feat: suggest metadata for external links`.

### Task 7: Full Regression and Chrome Visual Verification

**Files:**
- Modify: `tests/link-page-prototype.spec.ts`
- Create: `docs/littly-clone/prototype-v2/verification.md`
- Create: `docs/littly-clone/prototype-v2/screenshots/` evidence files produced from Chrome.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: test results plus artifact-linked visual comparison notes.

- [ ] **Step 1: Run complete automated gates**

```powershell
npm run test:link-page-prototype
npm run test:link-page-prototype-browser
npx tsc --noEmit --incremental false
npx eslint src/lib/link-pages src/components/link-pages src/app/api/link-pages/metadata/route.ts tests/link-page-prototype.spec.ts
```

Expected: all PASS.

- [ ] **Step 2: Verify the 300-page and V1 migration fixtures**

Record exact before/after page, block, item, alias, and asset-reference counts. Any loss is a blocker.

- [ ] **Step 3: Use the user-selected Chrome browser for visual QA**

At 1300×960 capture: page-type first step, expanded 3-level tree, collapsed tree, search result, complete Design tab, recommended theme after click. At 390×844 capture: public root with navigation and direct child page without automatic child tab.

- [ ] **Step 4: Compare against Littly evidence**

Place each current screenshot beside the corresponding captured Littly state from `docs/littly-clone/full-product-research/completion-pass/screenshots/`. Document fact, intentional adaptation, and remaining difference. Do not mark a state verified from screenshots alone; include DOM/accessibility observation and artifact paths.

- [ ] **Step 5: Fix any P0/P1 mismatch and rerun gates**

P0/P1 includes data loss, broken internal navigation, child leakage into top navigation, missing shared renderer behavior, unusable tree, inaccessible controls, contrast failure, or visible high-fidelity drift in the cloned Design sections.

- [ ] **Step 6: Final review commit**

```powershell
git add tests/link-page-prototype.spec.ts docs/littly-clone/prototype-v2
git commit -m "test: verify link page studio v2"
```
