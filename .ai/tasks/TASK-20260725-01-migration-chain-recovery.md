# TASK-20260725-01 Migration chain recovery

## Task information

- Status: 검토 중
- Current role: 작업자
- Review required: yes
- Current repeated failure: none
- Same-solution attempt count: 0
- Created: 2026-07-25
- Last updated: 2026-07-25

## Original request

Recover the six missing `showroom` table definitions without modifying existing migrations; add a secretless CI gate that applies the complete migration chain to an empty database; correct PGlite test/documentation claims; prove the chain on local PostgreSQL 17; keep the PR Draft and do not apply any Production migration.

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

### Changed files

- `.ai/tasks/TASK-20260725-01-migration-chain-recovery.md`
- `.github/workflows/ci.yml`
- `docs/platform/MIGRATION_CHAIN_VALIDATION.md`
- `package.json`
- `scripts/test-showroom-schema-bootstrap.mjs`
- `scripts/test-supabase-stabilization-migrations.mjs`
- `scripts/test-official-media-evidence-docs.mjs`
- `supabase/config.toml` and `supabase/.gitignore`
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

### Deviations from the work order

- A pre-existing documentation-contract regex was LF-only and failed after the clean Windows worktree checked tracked documents out as CRLF. The test now normalizes CRLF while reading fixtures; no assertion, CI job, or product behavior was removed.
- The requested 18-table count refers to the tables represented in `src/types/database.ts`. The migration tree also tracks `showroom.blog_editor_save_leases`, which is intentionally not represented in those types. CI asserts every typed table exists and lists all physical tables rather than falsely failing on this tracked internal table.

### Remaining risks

- Production-only constraints, indexes, defaults, and triggers cannot be inferred from TypeScript Row types and will be documented rather than guessed.
- The actual `public.vw_search_index` definition and its search semantics are absent from version control. The compatibility shell is sufficient only for a clean-chain rebuild; read-only Production DDL comparison and explicit review are required before any parity or Production-migration claim.
- Any unknown Production grants, ownership, anonymous policies for `site_settings`/`site_hero_media`, default expressions, constraints, triggers, or indexes remain outside this Draft PR's parity claim.

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
