# TASK-20260725-01 Migration chain recovery

## Task information

- Status: 검수 중
- Current role: 검수자
- Review required: yes
- Current repeated failure: PostgREST schema cache cannot load because configured schema `colorbook` is absent after an otherwise successful empty-DB migration chain.
- Same-solution attempt count: 0
- Created: 2026-07-25
- Last updated: 2026-07-25

## Original request

Recover the six missing `showroom` table definitions without modifying existing migrations; add a secretless CI gate that applies the complete migration chain to an empty database; correct PGlite test/documentation claims; prove the chain on local PostgreSQL 17; keep the PR Draft and do not apply any Production migration.

## Follow-up work order (2026-07-25)

- Continue on the same `codex/migration-chain-recovery` branch and Draft PR #91; do not create a branch or PR.
- Establish read-only evidence for whether `colorbook` is required in Production and what reads it. If it is required, add an idempotent creation migration; if it is unnecessary, add a later migration that removes it from `pgrst.db_schemas`. Do not modify existing migrations or guess when evidence is insufficient.
- Make the `migration-chain` CI start PostgREST, apply the full empty-DB chain, prove schema-cache loading, and prove at least one REST request returns 2xx with useful failure logs.
- Preserve the root dirty file, all other worktrees, PR #84/worktree, Draft state, and all existing CI jobs/checks. Do not apply a Production migration, merge, Ready-transition, or force-push.

## Worker result report

### Received work order summary

- Base: latest `origin/v2-cms`.
- Scope: a new pre-`20260720074812` migration for `nodes`, `gallery_photos`, `hero_media`, `preview_tokens`, `site_settings`, and `site_hero_media`; a secretless empty-database CI gate; honest PGlite wording and documentation.
- Exclusions: Production database mutation, existing migration edits, PR #84/worktree edits, CI job removal, Ready/merge/deploy/force-push.
- Completion conditions: a real local empty PostgreSQL 17 chain application succeeds; all 18 `showroom` tables exist afterwards; the named local verification suite succeeds; a Draft PR is created.

### Work performed

- Added `20260720074000_showroom_schema_bootstrap.sql` before the first dependent migration. It idempotently creates the six missing typed tables, enables RLS, restores only recoverable visibility policies/indexes, and supplies the historic `private.is_node_visible(uuid)` helper required by later RLS migrations.
- Added `20260721044937_restore_search_index_view.sql` immediately before the existing hardening migration. It creates only an empty compatibility view when the untracked Production view is absent; it never replaces an existing view or claims its unknown search semantics.
- Added a pinned Supabase CLI 2.109.1, secretless `migration-chain` CI job that starts an isolated PostgreSQL 17 stack, resets the database, asserts the 18 typed showroom tables, and lists the rebuilt schema.
- Added chain validation documentation, a schema-bootstrap contract test, and an explicit statement that PGlite fragment tests do not prove the ordered production migration chain.
- Normalized CRLF only while reading one existing documentation-contract fixture so the unchanged assertion is portable under Windows `core.autocrlf=true`.
- Pushed commit `06ad1c3d9ae2dbe73dc0141ecbd265acb60c78f0` and opened Draft PR #91; no Ready transition, merge, or Production action was performed.
- Follow-up: confirmed with a read-only Production REST HEAD probe that `colorbook.installation_photos` still exists. Current app source no longer reads colorbook, but the unregistered legacy `scripts/compress-existing-photos.mjs` does.
- Follow-up: added an idempotent pre-PostgREST `colorbook` schema bootstrap without inventing the untracked legacy tables, and expanded the secretless CI job to start Auth, Kong, and PostgREST, assert a successful schema-cache log, and require an anonymous showroom REST 2xx response.

### Changed files

- `.ai/tasks/TASK-20260725-01-migration-chain-recovery.md`
- `.github/workflows/ci.yml`
- `docs/platform/MIGRATION_CHAIN_VALIDATION.md`
- `package.json`
- `scripts/test-showroom-schema-bootstrap.mjs`
- `scripts/test-supabase-stabilization-migrations.mjs`
- `scripts/test-official-media-evidence-docs.mjs`
- `scripts/test-colorbook-schema-bootstrap.mjs`
- `scripts/test-postgrest-migration-chain-contract.mjs`
- `scripts/verify-postgrest-migration-chain.mjs`
- `supabase/config.toml` and `supabase/.gitignore`
- `supabase/migrations/20260602073000_colorbook_schema_bootstrap.sql`
- `supabase/migrations/20260720074000_showroom_schema_bootstrap.sql`
- `supabase/migrations/20260721044937_restore_search_index_view.sql`
- `supabase/tests/verify-showroom-table-count.sql`
- `supabase/tests/list-showroom-tables.sql`

### Validation run and result

- Empty local PostgreSQL 17: `supabase db reset --local --no-seed` applied every migration through `20260723082228_showroom_image_derivatives.sql` and finished successfully.
- Post-reset typed-table assertion: passed (`DO`). The 18 typed tables all exist; the physical schema has one additional already-tracked internal table, `showroom.blog_editor_save_leases`.
- `npm run test:supabase-stabilization-migrations` and `npm run test:showroom-schema-bootstrap`: passed.
- Existing CI static/unit contract suite: passed.
- `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`: passed. Lint retains one pre-existing Cloudflare preview warning; the linked worktree build retains one workspace-root warning.
- `supabase db advisors --local --type security --level warn --fail-on none`: no issues found.
- `git diff --check`: passed.
- Follow-up chain: `20260602073000_colorbook_schema_bootstrap.sql` applied before the pre-existing PostgREST configuration; PostgREST logged `Schema cache loaded 36 Relations, 47 Relationships, 15 RPCs` and `GET /rest/v1/nodes?select=id&limit=1` returned 200 with the showroom profile.
- Follow-up static contracts, full existing contract suite, `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, YAML parsing, and local security advisors all passed.
- Follow-up independent review: passed with no additional implementation finding; the pre-existing search-view and untracked colorbook-parity approval gates remain explicit.

### Deviations from the work order

- A pre-existing documentation-contract regex was LF-only and failed after the clean Windows worktree checked tracked documents out as CRLF. The test now normalizes CRLF while reading fixtures; no assertion, CI job, or product behavior was removed.
- The requested 18-table count refers to the tables represented in `src/types/database.ts`. The migration tree also tracks `showroom.blog_editor_save_leases`, which is intentionally not represented in those types. CI asserts every typed table exists and lists all physical tables rather than falsely failing on this tracked internal table.

### Remaining risks

- Production-only constraints, indexes, defaults, and triggers cannot be inferred from TypeScript Row types and will be documented rather than guessed.
- The actual `public.vw_search_index` definition and its search semantics are absent from version control. The compatibility shell is sufficient only for a clean-chain rebuild; read-only Production DDL comparison and explicit review are required before any parity or Production-migration claim.
- Any unknown Production grants, ownership, anonymous policies for `site_settings`/`site_hero_media`, default expressions, constraints, triggers, or indexes remain outside this Draft PR's parity claim.
- The untracked v1 `colorbook` table definitions, policies, grants, and data remain intentionally unreconstructed. The new migration creates only the schema required by the existing `pgrst.db_schemas` contract; recovering legacy table parity requires a separately approved read-only Production schema comparison.

## Review result

### Independent review result

- P1 / approval gate: `public.vw_search_index` has no tracked Production definition. The conditional empty compatibility view preserves an existing Production view and is adequate only as an explicitly documented clean-DB CI scaffold. It must not be represented as a Production reconstruction. Before Ready, merge, or any Production application, obtain approved read-only Production DDL or explicit approval for the scaffold.
- P2 / resolved: the schema-bootstrap contract test now reads `src/types/database.ts` directly and `deepEqual`s each of the six `Row` key lists against the SQL `CREATE TABLE` columns.
- Review outcome: conditionally passed for Draft PR; P1 remains an approval gate.

## Manager final decision

_Reserved for the manager._

## Change history

- 2026-07-25 / 작업자 / Created from the user-provided work order; validation pending.
- 2026-07-25 / 작업자 / Completed local implementation and validation; submitted for independent review.
- 2026-07-25 / 작업자 / Independent review conditionally passed; Draft PR #91 opened with the search-view approval gate retained.
- 2026-07-25 / 작업자 / User-issued PostgREST follow-up resumed the same Draft PR; colorbook schema and real PostgREST CI gate implemented and validated locally.
- 2026-07-25 / 작업자 / Follow-up implementation completed and submitted to review; no Production action, Ready transition, merge, or force-push was performed.
