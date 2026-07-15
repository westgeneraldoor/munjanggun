# Platform Design Recovery Execution Design

## Status

Approved for execution on 2026-07-15. The approval source is the first full audit and the user's approval of all three recommendations: split PR #33, retain `source_evidence` as internal provenance, and consume central v5 tokens through a generated snapshot and manifest.

## Goal

Recover the contaminated original workspace, replace PR #33 with narrowly-scoped Draft PRs, simplify the manual CMS, supply central v5 tokens reproducibly, standardize every admin surface, and align blog reader and preview presentation without changing the approved `/blog` home experience.

## Global invariants

- Never merge a PR or deploy production in this execution.
- Never restore admin AI drafting or add model/key UI.
- Never change database schema, RLS, authentication policy, or production data.
- Never edit `C:\Users\hjh\안티그래비티\문장군_브랜드`.
- Preserve the approved `/blog` home section order, geometry, navigation, and general CTA meaning.
- General blog CTAs route to `/measure`; reader-question CTAs route to `/portal/measure/new?source=blog-question&post=<slug>`.
- `source_evidence` remains an internal provenance field. Operators do not type it and it does not gate ready/publish on date or evidence presence.
- Every behavior change starts with a failing test and records the RED and GREEN command output.
- Every implementation PR is Draft, pushed, independently reviewed, and left unmerged.

## Recovery baseline

The original branch `codex/theme-platform-pr1-8@d16e2f7` had no unique commits and was eight commits behind `origin/v2-cms@d1eef38`. Its entire working state is recoverable from `.project-recovery-trash/20260715-152052/` through an all-refs bundle, binary patches, copied tracked files, quarantined untracked files, SHA-256 manifests, and an external archived PR #30 worktree. The original workspace now uses `codex/recovery-baseline@d1eef38`, tracks `origin/v2-cms`, and has zero status entries.

No dirty code is transplanted automatically. Approved behavior already exists in `v2-cms` or PR #33; the remaining local code is obsolete, conflicts with later approved PRs, or uses the old token model. The per-file decision evidence is retained locally in `.project-recovery-trash/20260715-152052/recovery-classification.md`, `tracked-working-copy-manifest.json`, and `untracked-moves.json`; bundle, patch, PR, and worktree inventories are checksummed in the same directory.

## Branch and Draft PR topology

| Order | Branch | Base | Scope |
| --- | --- | --- | --- |
| 0 | `codex/platform-execution-contract` | `v2-cms` | Approved design and execution plan only |
| 1 | `codex/blog-private-media-boundary` | `v2-cms` | Opaque private media route, URL/MIME hardening, security tests |
| 2 | `codex/blog-renderer-parity` | branch 1 | Shared renderer, embedded container layout, no-media hero, stable preview keys, unsaved navigation guard |
| 3 | `codex/blog-generic-cta-routing` | branch 2 | General `/measure` routing only; question CTA unchanged |
| 4 | `codex/brand-token-snapshot` | branch 3 | Generated v5 snapshot, manifest, sync/verify/drift scripts, import order |
| 5 | `codex/admin-primitives-contract` | branch 4 | Shared controls, state matrix, sidebar accessibility |
| 6A | `codex/admin-platform-surfaces` | branch 5 | Login, platform queue/detail, settings, and assets migration |
| 6B | `codex/admin-legacy-surfaces` | branch 6A | Nodes and legacy site settings migration; converges into the main stack |
| 7 | `codex/blog-cms-provenance` | branch 6B | Manual intake/editor/queue simplification and server provenance |
| 8 | `codex/blog-reader-v5-contract` | branch 7 | Reader/saved/embedded presentation parity and strict token policy; `/blog` home preserved |

PR #33 remains open until branches 1, 2, and 3 are pushed as Draft PRs and cross-reference it. It is then closed as superseded, never merged.

## Private media boundary

`GET /admin/platform/blog/media/[mediaId]` remains same-origin and administrator-only. The route returns 404 for invalid UUIDs, missing authentication, non-administrator users, missing media, rejected MIME, unsafe fallback URL, or upstream failure so it does not reveal object existence.

The pure helper interface is:

```ts
export const ALLOWED_BLOG_IMAGE_TYPES: ReadonlySet<string>
export function normalizeBlogImageContentType(value: string | null): string | null
export function isAllowedBlogPrivateMediaUrl(value: string, allowedHostname: string): boolean
export function blogPrivateMediaHeaders(contentType: string): HeadersInit
```

Only HTTPS URLs on the configured Supabase project hostname are allowed for the legacy fallback. Loopback, private-IP literals, userinfo, alternate ports, unknown MIME, and `application/octet-stream` are rejected. Successful responses include `Cache-Control: private, no-store, max-age=0`, `X-Content-Type-Options: nosniff`, and a safe inline content disposition.

## Renderer and preview contract

`BlogPostRenderer` receives an explicit surface:

```ts
type BlogRenderSurface = 'public-page' | 'saved-preview' | 'embedded-preview'
```

All three surfaces share article content and block presentation. Page chrome is composed outside the shared article. `embedded-preview` establishes `container-type: inline-size` and responds to its parent width; it must not depend on the outer browser viewport. A renderer with no hero media adds an explicit no-media state and uses one column at all widths.

Editor preview block IDs use `block.id || block.clientId`; database IDs remain unchanged. The saved-preview route reads persisted data, while embedded preview reads current editor state. Candidate and approved media visibility follows one documented preview policy.

Unsaved navigation uses Next 16.2.4 `Link` `onNavigate` or an equivalent accessible button flow. Internal preview navigation and `beforeunload` are both guarded. Cancel retains editor state and focus; confirmed discard is the only path that navigates.

## CMS provenance contract

The client no longer sends operator-authored evidence, evidence status/type, or fact-check date. The server constructs minimum provenance from the authenticated actor identifier, intake kind, and server timestamp, then passes it to the existing atomic `register_approved_manuscript` RPC. The client cannot override the server value.

The following remain enforced: privacy and promotion consent, forbidden claims and personal-data checks, media readiness, CTA safety, brand checks, `reviewing`-first status, and event history. Existing `source_evidence` and `last_fact_checked_at` columns remain for compatibility; no migration is created.

## Token supply contract

The central repository remains read-only. `scripts/sync-brand-tokens.mjs` reads `tokens/brand.css` and `tokens/brand.tokens.json`, normalizes LF, and writes deterministic committed artifacts:

```text
src/styles/generated/brand.css
src/styles/generated/brand.tokens.json
src/styles/generated/brand.manifest.json
```

The manifest contains schema version, central design version, source repository commit, relative source paths, source SHA-256 values, generated SHA-256 values, and token count. It contains no current timestamp. `MUNJANGGUN_BRAND_ROOT` overrides the default sibling path.

`verify:brand-tokens` works without the sibling repository. `verify:brand-token-drift` compares the sibling source when available. Import order is generated brand, project semantic adapter, then route/experience scope. Components consume semantic or component aliases, not primitive literals.

## Admin component contract

Shared primitives cover button, icon button, filter chip, tabs, select, field, badge, card/panel, toolbar, and shell. Visible interactive targets are at least 44 by 44 CSS pixels. The required state matrix is default, hover, active, selected, selected-hover, disabled, disabled-hover, and focus-visible.

Filters expose `aria-pressed`. Tabs expose `tablist`, `tab`, `aria-selected`, `aria-controls`, roving tabindex, and Left/Right/Home/End behavior. Mobile Sidebar exposes `aria-expanded` and `aria-controls`, makes closed content inert, traps focus while open, closes on Escape, and restores focus to its trigger. Motion is disabled or reduced under `prefers-reduced-motion: reduce`.

## Visual direction

The visual source is central v5 Editorial Showroom: Ink is the primary action and text system; Forest is secondary; component state colors and surfaces are semantic aliases. The approved blog home remains the distinctive image-showroom expression. Admin uses the same product vocabulary with quieter operational density, clear hierarchy, and no decorative redesign that changes information architecture.

## Verification matrix

| Surface | Automated | Browser |
| --- | --- | --- |
| Private media | pure helper tests, route source contract, build | administrator 200; non-admin/anonymous 404; opaque URL; headers; no private path |
| Embedded preview | adapter and renderer contract tests | 1440 desktop with 368px rail, 390 viewport, image/no-image, no overflow |
| Unsaved navigation | component/E2E guard tests | keyboard cancel/confirm, Escape, focus restoration, reload warning |
| CTA | route assertions | general CTA `/measure`, question CTA portal URL |
| Tokens | deterministic fixture tests, snapshot verification, drift check | computed Ink/Forest aliases and 44px controls |
| Admin | semantic/state E2E assertions | desktop, 390, keyboard-only, selected-hover, disabled-hover, focus-visible, reduced motion |
| CMS | intake/claim-safety/admin verifiers | no evidence/date UI, reviewing-first, ready/publish without old evidence gate |
| Blog | strict raw-token verifier and existing blog E2E | home visual regression, reader/saved/embedded parity, reduced motion |

## Completion

Completion requires every Draft PR to be pushed and green, every task review to approve specification and quality, one converged Task 8 Preview containing Tasks 1 through 7, actual authenticated Preview evidence for every administrator route and required state, PR #33 closed as superseded, the original workspace still clean at the latest `origin/v2-cms` baseline, and no merge or production deployment.
