import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = await readFile(
  path.join(projectRoot, 'supabase/migrations/20260722015610_blog_likes_and_recent_views.sql'),
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

assert.match(migration, /CREATE TABLE IF NOT EXISTS platform\.blog_article_likes/i)
assert.match(migration, /CREATE TABLE IF NOT EXISTS platform\.blog_article_recent_views/i)
assert.match(migration, /FROM platform\.blog_article_saves/i)
assert.match(migration, /FROM platform\.blog_article_helpful_votes/i)
assert.match(migration, /ON CONFLICT \(user_id, post_id\) DO NOTHING/i)
assert.match(migration, /blog_article_likes_user_post_unique UNIQUE \(user_id, post_id\)/i)
assert.match(migration, /blog_article_recent_views_user_post_unique UNIQUE \(user_id, post_id\)/i)
assert.match(migration, /blog_article_recent_views_user_last_viewed_idx/i)
assert.match(migration, /CREATE OR REPLACE FUNCTION platform\.is_published_blog_post/i)
assert.match(migration, /SECURITY DEFINER/i)
assert.match(migration, /SET search_path = pg_catalog/i)
assert.match(migration, /FROM showroom\.blog_posts AS post[\s\S]*?post\.status = 'published'/i)
assert.match(migration, /REVOKE ALL ON FUNCTION platform\.is_published_blog_post\(UUID\) FROM PUBLIC/i)
assert.match(migration, /GRANT EXECUTE ON FUNCTION platform\.is_published_blog_post\(UUID\) TO authenticated, service_role/i)
assert.equal((migration.match(/platform\.is_published_blog_post\(post_id\)/gi) ?? []).length, 3)

for (const table of ['blog_article_likes', 'blog_article_recent_views']) {
  assert.match(migration, new RegExp(`ALTER TABLE platform\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'))
  assert.match(migration, new RegExp(`TO authenticated[\\s\\S]*?user_id = \\(SELECT auth\\.uid\\(\\)\\)`, 'i'))
}

assert.doesNotMatch(migration, /blog_article_recent_views[\s\S]{0,800}platform_private\.is_admin\(\)/i)
assert.match(migration, /Production verification SQL/i)
assert.match(migration, /legacy_union/i)
assert.match(migration, /duplicate_like_pairs/i)
assert.match(migration, /legacy_rows_preserved/i)

assert.match(readerRoute, /blog_article_likes/i)
assert.doesNotMatch(readerRoute, /blog_article_helpful_votes|blog_article_saves|helpful\??:|saved\??:/i)
assert.match(recentViewRoute, /blog_article_recent_views/i)
assert.match(recentViewRoute, /eq\('status', 'published'\)/i)
assert.match(recentViewRoute, /onConflict: 'user_id,post_id'/i)

console.log('Blog likes and recent-views migration contracts passed')
