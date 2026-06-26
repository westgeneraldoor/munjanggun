-- MVP-CONTENTOS-01 / PR-01 follow-up: indexes for Content OS foreign keys.
-- Added after Supabase performance advisor flagged unindexed FKs.

CREATE INDEX IF NOT EXISTS blog_posts_created_by_idx
  ON showroom.blog_posts(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS blog_posts_reviewed_by_idx
  ON showroom.blog_posts(reviewed_by)
  WHERE reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS blog_posts_published_by_idx
  ON showroom.blog_posts(published_by)
  WHERE published_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS blog_media_approved_by_idx
  ON showroom.blog_media(approved_by)
  WHERE approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS blog_post_events_actor_idx
  ON showroom.blog_post_events(actor_id)
  WHERE actor_id IS NOT NULL;
