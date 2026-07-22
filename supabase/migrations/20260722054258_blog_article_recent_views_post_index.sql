CREATE INDEX IF NOT EXISTS blog_article_recent_views_post_id_idx
  ON platform.blog_article_recent_views (post_id);
