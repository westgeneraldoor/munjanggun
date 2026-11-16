# Migration Chain Validation

## Purpose

The repository must be able to rebuild an empty local Supabase/PostgreSQL 17 database by applying every file in `supabase/migrations` in lexical version order. This is a repository-chain guarantee, not evidence of any Production database mutation.

The secretless CI `migration-chain` job starts an isolated local Supabase stack including Auth, Kong, and PostgREST, runs `supabase db reset --local --no-seed`, then asserts and lists the rebuilt tables with the two SQL files in `supabase/tests/`. It also performs an anonymous `showroom.nodes` REST request and prints the PostgREST container log, so a schema-cache failure identifies the failing schema or object in the job log. The CLI's reset output is intentionally preserved as well, so a migration failure identifies the migration that failed.

The assertion checks the 18 tables represented by `src/types/database.ts`, which is the stated recovery contract. The tracked `showroom.blog_editor_save_leases` table is a service-RPC implementation detail created by `20260720005052_atomic_official_asset_blog_placement.sql` and is not represented in that type contract; therefore the rebuilt physical schema currently lists 19 tables. The assertion detects any missing typed table without incorrectly rejecting that tracked internal table.

## Local reproduction

From this repository, use the Supabase CLI version pinned by CI:

```powershell
npx --yes --package supabase@2.109.1 supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --ignore-health-check
npx --yes --package supabase@2.109.1 supabase db reset --local --no-seed
npx --yes --package supabase@2.109.1 supabase db query --local --file supabase/tests/verify-showroom-table-count.sql
npx --yes --package supabase@2.109.1 supabase db query --local --file supabase/tests/list-showroom-tables.sql
node scripts/verify-postgrest-migration-chain.mjs
```

The local project ID is `migration-chain-recovery`, so these commands do not select or mutate a linked or Production project. Do not add `--linked`, `--db-url`, or `supabase db push` to this validation flow.

## Colorbook schema boundary

`20260602073953_include_platform_in_postgrest_schemas.sql` already configures PostgREST with `colorbook`. A 2026-07-25 read-only Production REST probe confirmed that `colorbook.installation_photos` still exists. Current application source uses `showroom` and `platform`; the only tracked colorbook reader is the unregistered manual `scripts/compress-existing-photos.mjs` legacy maintenance script.

`20260602073000_colorbook_schema_bootstrap.sql` therefore creates only `colorbook` with `CREATE SCHEMA IF NOT EXISTS`, before the existing PostgREST configuration migration. It preserves the existing Production schema and unblocks an empty rebuild's schema cache, but deliberately does not invent the untracked v1 tables, columns, policies, grants, or data. Recovering those legacy table definitions requires a separately approved read-only Production schema comparison.

## What PGlite tests prove

PGlite runtime tests are selected SQL-behavior contracts. They may create roles, schemas, and tables manually, then apply only the migration fragments needed for the behavior under test. They do **not** prove that this repository's complete Supabase migration chain applies in order, that Supabase bootstrap schemas/roles match, or that PostgREST/RLS behavior was exercised.

This distinction applies to the PGlite tests introduced by the separate Draft PR #84 as well as any future PGlite test. The chain job above is the sole CI gate for a clean database applying every tracked migration in sequence. PR #84 and its worktree are not changed by this recovery work.

## Recovery scope and Production parity boundary

`20260720074000_showroom_schema_bootstrap.sql` restores six tables that were present in Production but absent from the migration tree:

- `showroom.nodes`
- `showroom.gallery_photos`
- `showroom.hero_media`
- `showroom.preview_tokens`
- `showroom.site_settings`
- `showroom.site_hero_media`

It also restores the source-controlled `private.is_node_visible(uuid)` helper because later RLS policies require it. The six table columns come from `src/types/database.ts`; recoverable indexes and the visibility policies come from historic repository migrations; documented constraints and defaults come from `docs/showroom/PRD_v2.0.md` and existing application behavior.

The repository also contains a later `ALTER VIEW public.vw_search_index` without any tracked `CREATE VIEW` definition. `20260721044937_restore_search_index_view.sql` creates an empty compatibility view only when that view is absent, so the existing hardening migration can apply to a clean database without replacing a Production view. Its columns and search semantics are not known and are not a functional search implementation.

The repository contains no historical `CREATE TABLE` migration for these six tables and no historical definition of `public.vw_search_index`. Therefore this change does not claim Production parity for unversioned details, including actual default expressions, extra constraints, triggers, indexes, grants, ownership, view definitions, or any anonymous access policy for `site_settings` and `site_hero_media`. The latter two public-read policies are intentionally not invented here. A separate approved, read-only Production schema comparison is required before claiming parity or making any Production migration change.
