-- Canonical private blog activity: likes and recent views.
-- Legacy saves/helpful rows are retained for rollback and evidence only.

CREATE TABLE IF NOT EXISTS platform.blog_article_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
  post_slug TEXT NOT NULL,
  post_title_snapshot TEXT NOT NULL,
  post_excerpt_snapshot TEXT,
  post_published_at_snapshot TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_article_likes_user_post_unique UNIQUE (user_id, post_id),
  CONSTRAINT blog_article_likes_slug_check CHECK (post_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS platform.blog_article_recent_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
  post_slug TEXT NOT NULL,
  post_title_snapshot TEXT NOT NULL,
  post_excerpt_snapshot TEXT,
  post_published_at_snapshot TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_article_recent_views_user_post_unique UNIQUE (user_id, post_id),
  CONSTRAINT blog_article_recent_views_slug_check CHECK (post_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- This union deliberately prefers the richer save snapshot when both old
-- records exist. The canonical unique key makes re-running safe.
WITH legacy_rows AS (
  SELECT
    user_id,
    post_id,
    post_slug,
    post_title_snapshot,
    post_excerpt_snapshot,
    post_published_at_snapshot,
    created_at,
    0 AS source_rank
  FROM platform.blog_article_saves
  UNION ALL
  SELECT
    user_id,
    post_id,
    post_slug,
    post_title_snapshot,
    NULL::TEXT AS post_excerpt_snapshot,
    NULL::TIMESTAMPTZ AS post_published_at_snapshot,
    created_at,
    1 AS source_rank
  FROM platform.blog_article_helpful_votes
),
deduplicated_rows AS (
  SELECT DISTINCT ON (user_id, post_id)
    user_id,
    post_id,
    post_slug,
    post_title_snapshot,
    post_excerpt_snapshot,
    post_published_at_snapshot,
    created_at
  FROM legacy_rows
  ORDER BY user_id, post_id, source_rank, created_at ASC
)
INSERT INTO platform.blog_article_likes (
  user_id,
  post_id,
  post_slug,
  post_title_snapshot,
  post_excerpt_snapshot,
  post_published_at_snapshot,
  created_at
)
SELECT
  user_id,
  post_id,
  post_slug,
  post_title_snapshot,
  post_excerpt_snapshot,
  post_published_at_snapshot,
  created_at
FROM deduplicated_rows
ON CONFLICT (user_id, post_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS blog_article_likes_post_idx
  ON platform.blog_article_likes(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_article_likes_user_idx
  ON platform.blog_article_likes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_article_recent_views_user_last_viewed_idx
  ON platform.blog_article_recent_views(user_id, last_viewed_at DESC);

ALTER TABLE platform.blog_article_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.blog_article_recent_views ENABLE ROW LEVEL SECURITY;

-- Authenticated clients do not have direct SELECT access to showroom.blog_posts.
-- Keep the published-state guard inside a narrow, schema-qualified definer
-- function instead of widening the showroom read surface just for RLS checks.
CREATE OR REPLACE FUNCTION platform.is_published_blog_post(target_post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM showroom.blog_posts AS post
    WHERE post.id = target_post_id
      AND post.status = 'published'
  );
$$;

REVOKE ALL ON FUNCTION platform.is_published_blog_post(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.is_published_blog_post(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS select_own_blog_article_likes ON platform.blog_article_likes;
CREATE POLICY select_own_blog_article_likes
  ON platform.blog_article_likes
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS insert_own_blog_article_likes ON platform.blog_article_likes;
CREATE POLICY insert_own_blog_article_likes
  ON platform.blog_article_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND platform.is_published_blog_post(post_id)
  );
DROP POLICY IF EXISTS delete_own_blog_article_likes ON platform.blog_article_likes;
CREATE POLICY delete_own_blog_article_likes
  ON platform.blog_article_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS select_own_blog_article_recent_views ON platform.blog_article_recent_views;
CREATE POLICY select_own_blog_article_recent_views
  ON platform.blog_article_recent_views
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS insert_own_blog_article_recent_views ON platform.blog_article_recent_views;
CREATE POLICY insert_own_blog_article_recent_views
  ON platform.blog_article_recent_views
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND platform.is_published_blog_post(post_id)
  );
DROP POLICY IF EXISTS update_own_blog_article_recent_views ON platform.blog_article_recent_views;
CREATE POLICY update_own_blog_article_recent_views
  ON platform.blog_article_recent_views
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND platform.is_published_blog_post(post_id)
  );

GRANT SELECT, INSERT, DELETE ON platform.blog_article_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON platform.blog_article_recent_views TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.blog_article_likes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.blog_article_recent_views TO service_role;

-- Production verification SQL (run before and after applying this migration):
-- SELECT COUNT(*) AS legacy_saves FROM platform.blog_article_saves;
-- SELECT COUNT(*) AS legacy_helpful FROM platform.blog_article_helpful_votes;
-- SELECT COUNT(*) AS legacy_union FROM (
--   SELECT user_id, post_id FROM platform.blog_article_saves
--   UNION
--   SELECT user_id, post_id FROM platform.blog_article_helpful_votes
-- ) AS legacy;
-- SELECT COUNT(*) AS canonical_likes FROM platform.blog_article_likes;
-- SELECT COUNT(*) AS duplicate_like_pairs FROM (
--   SELECT user_id, post_id FROM platform.blog_article_likes GROUP BY user_id, post_id HAVING COUNT(*) > 1
-- ) AS duplicates;
-- SELECT COUNT(*) AS legacy_rows_preserved FROM platform.blog_article_saves;
-- SELECT COUNT(*) AS legacy_helpful_rows_preserved FROM platform.blog_article_helpful_votes;

NOTIFY pgrst, 'reload schema';
