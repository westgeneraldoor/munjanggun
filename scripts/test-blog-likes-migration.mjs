import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = await readFile(
  path.join(projectRoot, 'supabase/migrations/20260722044841_20260722015610_blog_likes_and_recent_views.sql'),
  'utf8',
)
const recentViewsPostIndexMigration = await readFile(
  path.join(projectRoot, 'supabase/migrations/20260722052726_blog_article_recent_views_post_index.sql'),
  'utf8',
)
const readerRoute = await readFile(
  path.join(projectRoot, 'src/app/api/blog/posts/[slug]/reader/route.ts'),
  'utf8',
)
const recentViewRoute = await readFile(
  path.join(projectRoot, 'src/app/api/blog/posts/[slug]/reader/view/route.ts'),
  'utf8',
)
const platformServer = await readFile(
  path.join(projectRoot, 'src/lib/supabase/platform-server.ts'),
  'utf8',
)
const showroomAdmin = await readFile(
  path.join(projectRoot, 'src/lib/supabase/admin.ts'),
  'utf8',
)

assert.match(migration, /CREATE TABLE IF NOT EXISTS platform\.blog_article_likes/i)
assert.match(migration, /CREATE TABLE IF NOT EXISTS platform\.blog_article_recent_views/i)
assert.match(migration, /FROM platform\.blog_article_saves/i)
assert.match(migration, /FROM platform\.blog_article_helpful_votes/i)
assert.match(migration, /FROM deduplicated_rows AS legacy[\s\S]*?JOIN showroom\.blog_posts AS post[\s\S]*?post\.status = 'published'/i)
assert.match(migration, /SELECT[\s\S]*?legacy\.created_at[\s\S]*?FROM deduplicated_rows AS legacy/i)
assert.match(migration, /ON CONFLICT \(user_id, post_id\) DO NOTHING/i)
assert.match(migration, /blog_article_likes_user_post_unique UNIQUE \(user_id, post_id\)/i)
assert.match(migration, /blog_article_recent_views_user_post_unique UNIQUE \(user_id, post_id\)/i)
assert.match(migration, /blog_article_recent_views_user_last_viewed_idx/i)
assert.match(
  recentViewsPostIndexMigration,
  /CREATE INDEX IF NOT EXISTS blog_article_recent_views_post_id_idx\s+ON platform\.blog_article_recent_views \(post_id\)/i,
  'the recent-view post foreign key needs a covering index for joined post lookups',
)
assert.match(migration, /CREATE OR REPLACE FUNCTION platform_private\.is_published_blog_post/i)
assert.match(migration, /SECURITY DEFINER/i)
assert.match(migration, /SET search_path = pg_catalog/i)
assert.match(migration, /FROM showroom\.blog_posts AS post[\s\S]*?post\.status = 'published'/i)
assert.match(migration, /REVOKE ALL ON FUNCTION platform_private\.is_published_blog_post\(UUID\) FROM PUBLIC/i)
assert.match(migration, /GRANT EXECUTE ON FUNCTION platform_private\.is_published_blog_post\(UUID\) TO authenticated, service_role/i)
assert.equal(
  (migration.match(/platform_private\.is_published_blog_post\(post_id\)/gi) ?? []).length,
  8,
  'published-post checks must cover canonical and cutover legacy RLS',
)
assert.match(
  migration,
  /CREATE POLICY select_own_blog_article_likes[\s\S]*?FOR SELECT TO authenticated[\s\S]*?platform_private\.is_published_blog_post\(post_id\)/i,
)
assert.match(
  migration,
  /CREATE POLICY select_own_blog_article_recent_views[\s\S]*?FOR SELECT TO authenticated[\s\S]*?platform_private\.is_published_blog_post\(post_id\)/i,
)
assert.match(
  migration,
  /CREATE POLICY update_own_blog_article_likes[\s\S]*?FOR UPDATE TO authenticated[\s\S]*?USING \(user_id = \(SELECT auth\.uid\(\)\)\)[\s\S]*?WITH CHECK \([\s\S]*?platform_private\.is_published_blog_post\(post_id\)[\s\S]*?\)/i,
  'like upserts must be allowed to refresh an existing owned row without bypassing the published-post guard',
)
assert.match(
  migration,
  /GRANT SELECT, INSERT, UPDATE, DELETE ON platform\.blog_article_likes TO authenticated/i,
  'authenticated like upserts need UPDATE in addition to ownership RLS',
)
for (const legacyTable of ['blog_article_saves', 'blog_article_helpful_votes']) {
  assert.match(
    migration,
    new RegExp(`CREATE POLICY insert_own_${legacyTable.replace('blog_article_', 'blog_')}[\\s\\S]*?FOR INSERT TO authenticated[\\s\\S]*?platform_private\\.is_published_blog_post\\(post_id\\)`, 'i'),
    `legacy ${legacyTable} writes must reject unpublished posts during the cutover`,
  )
}

for (const table of ['blog_article_likes', 'blog_article_recent_views']) {
  assert.match(migration, new RegExp(`ALTER TABLE platform\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'))
  assert.match(migration, new RegExp(`TO authenticated[\\s\\S]*?user_id = \\(SELECT auth\\.uid\\(\\)\\)`, 'i'))
}

assert.doesNotMatch(migration, /blog_article_recent_views[\s\S]{0,800}platform_private\.is_admin\(\)/i)
assert.match(migration, /Production verification SQL/i)
assert.match(migration, /legacy_union/i)
assert.match(migration, /legacy_published_union/i)
assert.match(migration, /duplicate_like_pairs/i)
assert.match(migration, /legacy_rows_preserved/i)
for (const legacyTable of ['blog_article_saves', 'blog_article_helpful_votes']) {
  assert.match(
    migration,
    new RegExp(`CREATE TRIGGER sync_${legacyTable}_to_likes[\\s\\S]*?AFTER INSERT OR UPDATE OR DELETE[\\s\\S]*?ON platform\\.${legacyTable}`, 'i'),
    `legacy ${legacyTable} writes during cutover must stay synchronized with canonical likes`,
  )
}
assert.match(migration, /SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog/i)
assert.match(migration, /TG_OP = 'DELETE'/i)
assert.equal(
  (migration.match(/IF NOT platform_private\.is_published_blog_post\(NEW\.post_id\) THEN/gi) ?? []).length,
  2,
  'legacy save/helpful triggers must not materialize likes for unpublished posts',
)
assert.equal(
  (migration.match(/pg_advisory_xact_lock\(hashtextextended\(/gi) ?? []).length,
  6,
  'legacy trigger writes must serialize same user/post cutover updates and deletes',
)
assert.equal(
  (migration.match(/TG_OP = 'UPDATE'[\s\S]*?IS DISTINCT FROM \(OLD\.user_id, OLD\.post_id\)/gi) ?? []).length,
  2,
  'legacy trigger key updates must remove an orphaned old canonical pair before syncing the new pair',
)

assert.match(readerRoute, /blog_article_likes/i)
assert.doesNotMatch(readerRoute, /blog_article_helpful_votes|blog_article_saves|helpful\??:|saved\??:/i)
assert.match(recentViewRoute, /blog_article_recent_views/i)
assert.match(recentViewRoute, /eq\('status', 'published'\)/i)
assert.match(recentViewRoute, /onConflict: 'user_id,post_id'/i)
assert.match(platformServer, /^import 'server-only'/)
assert.match(showroomAdmin, /^import 'server-only'/)

console.log('Blog likes and recent-views migration contracts passed')
