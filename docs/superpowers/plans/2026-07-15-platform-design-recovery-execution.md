# Platform Design Recovery Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the contaminated workspace and PR #33 with a reviewed stack of small Draft PRs that implements the approved platform, CMS, blog, and token contracts.

**Architecture:** Work starts from `origin/v2-cms@d1eef38` and advances through narrowly-scoped stacked branches. Shared pure helpers and semantic primitives are introduced before the surfaces that consume them; browser evidence is collected on each deployed Draft Preview before dependent visual work is accepted.

**Tech Stack:** Next.js 16.2.4 App Router, React 19, TypeScript, CSS Modules, Node verification scripts, Playwright E2E, Supabase server clients, GitHub Draft PRs.

## Global Constraints

- Do not merge a PR or deploy production.
- Do not restore admin AI drafting or add model/key UI.
- Do not change database schema, RLS, authentication policy, or production data.
- Do not edit the central brand repository.
- Preserve the approved `/blog` home experience and its section order.
- General blog CTA is `/measure`; reader-question CTA is `/portal/measure/new?source=blog-question&post=<slug>`.
- Keep `source_evidence` as server-owned internal provenance; remove operator evidence/date UI and evidence/date publish gates.
- Production code may be written only after its covering test has failed for the expected reason.
- Every branch is pushed as a Draft PR and independently reviewed; no branch is merged.

---

### Task 0: Publish the execution contract

**Files:**
- Create: `docs/superpowers/specs/2026-07-15-platform-design-recovery-execution-design.md`
- Create: `docs/superpowers/plans/2026-07-15-platform-design-recovery-execution.md`

**Interfaces:**
- Consumes: approved audit decisions and `origin/v2-cms@d1eef38`.
- Produces: the binding branch topology, global constraints, and verification matrix for all later tasks.

- [ ] **Step 1: Verify repository baseline**

  Run `npm run lint`, all existing `verify:blog-*` scripts, `npm run test:approved-manuscript-intake`, and `npm run build`. Record the existing lint-warning baseline separately from failures.

  Verify `.project-recovery-trash/20260715-152052/recovery-classification.md`, `tracked-working-copy-manifest.json`, and `untracked-moves.json` account for 41 tracked and 109 untracked files; run `git bundle verify` on `all-refs-before.bundle`; require the original workspace HEAD to equal `origin/v2-cms` and `git status --porcelain` to be empty.

- [ ] **Step 2: Self-review the two documents**

  Run a case-insensitive placeholder scan over both documents and require no incomplete-marker matches. Confirm every user requirement maps to a branch and verification row.

- [ ] **Step 3: Validate and commit**

  Run `git diff --check`, commit with `docs: define platform design recovery execution`, push, and open a Draft PR against `v2-cms`.

### Task 1: Harden the private media boundary

**Files:**
- Create: `src/lib/content-os/blog-private-media.ts`
- Create: `src/app/admin/platform/blog/media/[mediaId]/route.ts`
- Create: `scripts/test-blog-private-media.mjs`
- Modify: `src/app/admin/platform/blog/[id]/page.tsx`
- Modify: `src/lib/content-os/blog-rendering.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `normalizeBlogImageContentType`, `isAllowedBlogPrivateMediaUrl`, and `blogPrivateMediaHeaders`; same-origin `/admin/platform/blog/media/<uuid>` URLs.

- [ ] **Step 1: Write the failing helper and route-contract tests**

  Cover invalid UUID, unsafe scheme/host/port/userinfo/IP, rejected MIME, allowed PNG/JPEG/WebP/GIF/AVIF, private no-store headers, and path non-serialization. Run `node scripts/test-blog-private-media.mjs`; verify failure because the helper and route do not exist.

- [ ] **Step 2: Implement the pure security helper**

  Add the four interfaces specified by the design. Use `URL`, an exact configured Supabase hostname, HTTPS-only checks, an explicit MIME set, and deterministic header values. Re-run the test and require pass.

- [ ] **Step 3: Implement the administrator Route Handler**

  Await `RouteContext<'/admin/platform/blog/media/[mediaId]'>.params`; validate UUID before lookup; authenticate user and administrator role inside the handler; return 404 for every rejected state; stream only allowed images; never return storage path or signed URL. Re-run the helper test, `npm run verify:blog-public-safety`, lint, and build.

- [ ] **Step 4: Commit, review, push, and open Draft PR**

  Commit only the listed files. Generate a full diff review package from `d1eef38` to HEAD. Resolve all Critical/Important review findings, push `codex/blog-private-media-boundary`, and open a Draft PR against `v2-cms`.

### Task 2: Repair renderer parity and unsaved navigation

**Files:**
- Create: `src/lib/content-os/blog-editor-preview.ts`
- Create: `scripts/test-blog-editor-preview.mjs`
- Modify: `src/components/blog/BlogPostRenderer.tsx`
- Modify: `src/components/blog/BlogPostRenderer.module.css`
- Modify: `src/app/admin/platform/blog/[id]/BlogEditorClient.tsx`
- Modify: `src/app/admin/platform/blog/[id]/blog-editor.module.css`
- Modify: `package.json`

**Interfaces:**
- Consumes: private media same-origin URLs from Task 1.
- Produces: `BlogRenderSurface`, current-state preview adapter with `id || clientId`, container-responsive embedded preview, and guarded saved-preview navigation.

- [ ] **Step 1: Write RED adapter and source-contract tests**

  Assert current editor state reaches preview data, two empty database IDs receive distinct preview IDs, preview links/actions are inert, the embedded root establishes a container, no-media hero has an explicit class, and navigation uses a guard. Run `node scripts/test-blog-editor-preview.mjs`; verify the expected missing-contract failure.

- [ ] **Step 2: Add the preview adapter and shared surface contract**

  Implement only the adapter and renderer surface enum/prop. Remove the legacy duplicated preview JSX after shared rendering is active. Re-run the RED test until adapter and inert-action assertions pass.

- [ ] **Step 3: Add container and no-media layout**

  Establish `container-type: inline-size` on embedded host. At narrow container widths force one-column hero, mobile typography, stacked actions, zero duplicate page padding, and unset page `min-height`. Apply one-column layout whenever hero media is absent. Run source tests, lint, and build.

- [ ] **Step 4: Add unsaved navigation behavior**

  Compute a stable saved-state signature and update it after save. Guard the header Preview navigation with `Link onNavigate` or an accessible dialog-trigger button and add `beforeunload`. Cancel retains focus/state; confirm navigates. Add Playwright coverage for cancel, confirm, reload, Escape, Tab cycle, and focus restoration.

- [ ] **Step 5: Verify actual layouts and publish Draft PR**

  On the deployed Preview verify 1440px with the embedded 368px rail, 390px viewport, image/no-image, keyboard, reduced motion, zero horizontal overflow, and no duplicate-key console warning. Review, push `codex/blog-renderer-parity`, and open a Draft PR against the Task 1 branch.

### Task 3: Isolate generic CTA routing

**Files:**
- Modify: `src/app/blog/BlogHomeHero.tsx`
- Modify: `src/app/blog/BlogStoryStage.tsx`
- Modify: `src/app/blog/BlogFinalExperience.tsx`
- Modify: `src/components/blog/BlogPostRenderer.tsx`
- Modify: `tests/blog-article-actions.spec.ts`
- Modify: `tests/blog-home-experience.spec.ts`
- Modify: relevant launch-mode documentation only

- [ ] **Step 1: Write RED route assertions**

  Assert every generic CTA href is `/measure` and every question CTA retains the portal URL with `source=blog-question` and slug. Run the two focused E2E files and verify the generic assertions fail on the branch base.

- [ ] **Step 2: Change only generic CTA hrefs**

  Do not change copy, home structure, styling, question CTA, or renderer layout. Re-run focused E2E, lint, and build.

- [ ] **Step 3: Review and publish**

  Review only the CTA diff, push `codex/blog-generic-cta-routing`, and open a Draft PR against Task 2.

### Task 4: Generate and verify the central v5 snapshot

**Files:**
- Create: `src/styles/generated/brand.css`
- Create: `src/styles/generated/brand.tokens.json`
- Create: `src/styles/generated/brand.manifest.json`
- Create: `scripts/brand-token-snapshot.mjs`
- Create: `scripts/test-brand-token-snapshot.mjs`
- Create: `scripts/sync-brand-tokens.mjs`
- Create: `scripts/verify-brand-tokens.mjs`
- Create: `scripts/check-brand-token-drift.mjs`
- Create: `scripts/ui-token-policy.config.mjs`
- Create: `scripts/verify-ui-token-policy.mjs`
- Create: `scripts/test-ui-token-policy.mjs`
- Modify: `src/app/globals.css`
- Modify: `src/styles/munjanggun-brand.css`
- Modify: `src/styles/blog-experience.css`
- Modify: `package.json`
- Modify: `docs/brand/BRAND_SOURCE.md`
- Modify: `docs/brand/PROJECT_BRAND_ADAPTER.md`

- [ ] **Step 1: Write deterministic fixture tests**

  Test byte-identical repeated output, CSS/JSON hash verification, token-set mismatch, drift detection, source-path override, and absence of timestamps. Run `node scripts/test-brand-token-snapshot.mjs`; verify missing-module failure.

- [ ] **Step 2: Implement pure generation and verification**

  Normalize LF, sort manifest keys, hash bytes with SHA-256, and expose generate/verify/drift functions. No function writes outside the project output directory. Re-run fixture tests to GREEN.

- [ ] **Step 3: Generate committed v5 artifacts**

  Run sync against the read-only central repository at commit `e6b6eb6`. Confirm the central `git status --short` remains empty. Import generated CSS before project and blog adapters. Run snapshot verify, drift verify, lint, all blog verifiers, and build.

  Add the strict token-policy engine with file:line diagnostics, generated/token-declaration allowlists, explicit named layout-constant exceptions, undefined-variable detection, and configurable scope. Its initial tests must fail before implementation and pass against fixtures before any admin migration consumes it.

- [ ] **Step 4: Browser and review gate**

  Verify computed Ink/Forest semantic aliases, 44px controls, and unchanged `/blog` home geometry at 1440/390. Review, push `codex/brand-token-snapshot`, and open a Draft PR against Task 3.

### Task 5: Build the shared admin primitive contract

**Files:**
- Modify: `src/components/platform/ui/PlatformButton.tsx`
- Modify: `src/components/platform/ui/PlatformButton.module.css`
- Modify: `src/components/platform/ui/index.ts`
- Create: `src/components/platform/ui/PlatformIconButton.tsx` and CSS Module
- Create: `src/components/platform/ui/PlatformFilterChip.tsx` and CSS Module
- Create: `src/components/platform/ui/PlatformTabs.tsx` and CSS Module
- Create: `src/components/platform/ui/PlatformSelect.tsx` and CSS Module
- Create: `src/components/platform/ui/PlatformPanel.tsx` and CSS Module
- Create: `src/components/platform/ui/PlatformToolbar.tsx` and CSS Module
- Modify: `src/components/admin/AdminSidebar.tsx`
- Modify: `src/components/admin/AdminSidebar.module.css`
- Create: `tests/admin-controls.spec.ts`

- [ ] **Step 1: Write RED semantic and interaction tests**

  Cover 44px targets, filter `aria-pressed`, tab roles/selection/controls/roving tabindex/arrow/Home/End, disabled-hover, focus-visible, Sidebar expanded/controls/inert/Escape/focus trap/focus restore, and reduced motion.

- [ ] **Step 2: Implement one primitive at a time**

  For each primitive, run the single failing test, implement the minimum semantic API and token-only state CSS, and re-run before starting the next primitive. Do not migrate application surfaces in this task.

- [ ] **Step 3: Integrate Sidebar and verify**

  Use the shared icon button and focus-management contract. Run the focused E2E at desktop and 390px, lint, build, and existing admin verifiers.

- [ ] **Step 4: Review and publish**

  Push `codex/admin-primitives-contract` and open a Draft PR against Task 4 after independent review approval.

### Task 6A: Migrate platform administrator surfaces

**Files:**
- Modify: `src/app/admin/platform/AdminQueueClient.tsx` and CSS
- Modify: `src/app/admin/platform/[id]/DetailClient.tsx` and CSS
- Modify: platform queue action components
- Modify: `src/app/admin/platform/settings/SettingsClient.tsx` and CSS
- Modify: `src/app/admin/platform/assets/ContentAssetsClient.tsx` and CSS
- Modify: `src/app/admin/login/page.tsx` and its CSS/layout boundary
- Create: `tests/admin-platform-surfaces.spec.ts`

- [ ] **Step 1: Write RED route-level control inventory tests**

  At `/admin/login`, `/admin/platform`, `/admin/platform/[id]`, `/admin/platform/settings`, and `/admin/platform/assets`, enumerate visible button/link/select/tab/filter controls and assert semantics, 44px targets, state matrix, keyboard operation, reduced motion, and horizontal overflow at 1366/390. Verify logged-out login has no administrator Sidebar and logged-in access preserves the role gate.

- [ ] **Step 2: Migrate queue, settings, then assets**

  Move one route at a time to shared primitives, removing only the route-local duplicate styles after the route test is GREEN. Preserve actions, copy, and data flow. Expand the token-policy configuration to each migrated route and require no unapproved raw color, spacing, radius, shadow, or control-size values in that route before moving on.

- [ ] **Step 3: Full verification and Draft PR**

  Run the new E2E, admin verifier, lint, build, review, push `codex/admin-platform-surfaces`, and open a Draft PR against Task 5. This branch is the required base of Task 6B.

### Task 6B: Migrate legacy administrator surfaces

**Files:**
- Modify: `src/app/admin/nodes/**`
- Modify: `src/app/admin/settings/**`
- Modify: `src/components/admin/**` excluding already-migrated Sidebar
- Create: `tests/admin-legacy-surfaces.spec.ts`

- [ ] **Step 1: Write RED `/admin`, `/admin/nodes`, node detail, and settings tests**

  Verify `/admin` redirects to `/admin/nodes`; reproduce the 390px nodes overflow, small icon controls, modal keyboard/focus defects, and missing state styles on `/admin/nodes`, `/admin/nodes/[id]`, and `/admin/settings`. Assert no horizontal overflow and the shared control contract.

- [ ] **Step 2: Migrate route by route**

  Apply primitives to nodes list/form/add/move, site settings, hero, gallery, status, and confirmation dialog while preserving behavior and data calls. Run the focused test and the scoped token-policy verifier after each component group; no migrated file may retain an unapproved raw color, spacing, radius, shadow, or control-size value.

- [ ] **Step 3: Verify and publish**

  Run E2E, lint, build, review, push `codex/admin-legacy-surfaces`, and open a Draft PR against Task 6A so all administrator surfaces converge into one stack.

### Task 7: Automate provenance and simplify CMS

**Files:**
- Modify: `src/lib/content-os/approved-manuscript.ts`
- Modify: `src/app/admin/platform/blog/new/ApprovedManuscriptIntakeClient.tsx`
- Modify: `src/app/admin/platform/blog/manuscript-actions.ts`
- Modify: `src/app/admin/platform/blog/BlogDraftQueueClient.tsx`
- Modify: `src/app/admin/platform/blog/page.tsx`
- Modify: `src/app/admin/platform/blog/[id]/BlogEditorClient.tsx`
- Modify: `src/app/admin/platform/blog/[id]/page.tsx`
- Modify: `src/app/admin/platform/blog/[id]/actions.ts`
- Modify: claim-safety and existing verifier scripts
- Modify: `scripts/test-approved-manuscript-intake.mjs`

- [ ] **Step 1: Write RED provenance and removed-UI assertions**

  Assert intake succeeds without operator evidence/date, server provenance overrides client input, reviewing-first RPC remains, evidence/date inputs and queue warnings are absent, and ready/publish ignores evidence freshness while privacy/media/CTA/claim gates still fail invalid content.

- [ ] **Step 2: Move provenance ownership to the server**

  Remove evidence from client payload types and construct minimal provenance after administrator authentication. Keep existing columns and RPC; create no migration. Re-run intake and claim-safety tests.

- [ ] **Step 3: Remove UI and old gate branches**

  Delete fact-check date and evidence controls, duplicate warnings, and readiness checks that depend only on those values. Retain event history and safety gates. Migrate CMS controls to shared primitives and consolidate duplicate summary/SEO inputs without changing stored fields.

- [ ] **Step 4: Browser, review, and publish**

  Verify queue/new/editor/saved Preview at desktop/390 and keyboard-only. Run all CMS verifiers, lint, build, review, push `codex/blog-cms-provenance`, and open a Draft PR against Task 6B.

### Task 8: Align blog reader and enforce token policy

**Files:**
- Modify: `src/app/blog/[slug]/page.tsx`
- Modify: `src/components/blog/BlogPostRenderer.tsx` and CSS
- Modify: `src/components/blog/BlogReadingTopBar.tsx` and CSS
- Modify: `src/components/blog/BlogArticleActions.tsx` and CSS
- Modify: `src/lib/content-os/blog-rendering.ts`
- Modify: `src/lib/content-os/blog-public-presentation.ts`
- Modify: `src/styles/blog-experience.css`
- Modify: `scripts/ui-token-policy.config.mjs`
- Modify: `scripts/verify-ui-token-policy.mjs` only if a verified general-purpose defect is found
- Modify: `scripts/test-ui-token-policy.mjs`
- Create: `tests/blog-reader-contract.spec.ts`
- Modify: existing blog home/navigation/action E2E tests

- [ ] **Step 1: Write RED token-policy tests**

  Across all customer, blog, administrator, and CMS CSS/TSX covered by Tasks 1 through 7, fail on raw hex/rgb, unapproved spacing/radius/shadow/control-size, undefined variables, and missing state selectors outside generated/token declaration files. Require file:line diagnostics and exact documented exceptions for layout constants.

- [ ] **Step 2: Implement verifier and clean reader surfaces**

  Expand the existing strict verifier configuration to all remaining blog and customer surfaces, then replace one literal category at a time with generated semantic/component aliases. Keep the `/blog` home component DOM and geometry unchanged.

- [ ] **Step 3: Write and pass visual contract E2E**

  Compare public, saved Preview, and embedded Preview typography/spacing for image and no-image articles; public actions active, preview actions inert; no internal provenance/private path in public output; CTA contracts unchanged; reduced motion and keyboard states correct.

- [ ] **Step 4: Final review and publish**

  Run strict token policy, all verifiers, full lint, production build, and targeted/full E2E. Review, push `codex/blog-reader-v5-contract`, and open a Draft PR against Task 7.

### Task 9: Supersede PR #33 and run completion audit

**Files:**
- Update: `.superpowers/sdd/progress.md` only as ignored execution ledger
- No product files

- [ ] **Step 1: Close PR #33 only after replacements exist**

  Confirm Draft PRs for Tasks 1, 2, and 3 are pushed and cross-linked. Comment with the replacement PR URLs and close PR #33 as superseded without merging.

- [ ] **Step 2: Run whole-stack reviews**

  Generate full review packages for each branch range and the converged Task 8 range from `origin/v2-cms` to `codex/blog-reader-v5-contract`. Resolve all Critical/Important findings with covering tests and re-review.

- [ ] **Step 3: Run final verification matrix**

  Re-run lint, build, all verifier scripts, all new unit scripts, full relevant Playwright E2E, and authenticated Preview checks at desktop/390, keyboard-only, reduced motion, and private media boundaries.

- [ ] **Step 4: Verify negative requirements and workspace state**

  Prove no AI UI/code restoration, no migration/RLS/Auth changes, no central repository edits, no `/blog` home regression, no PR merge/deployment, and original workspace HEAD equals latest `origin/v2-cms` with empty status.
