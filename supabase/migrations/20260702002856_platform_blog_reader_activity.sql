-- PR-D: DB-backed private blog reader activity.
-- Scope: helpful votes, saved articles, and private article questions.
-- Public comments are intentionally out of scope.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'blog_question_status'
      AND typnamespace = 'platform'::regnamespace
  ) THEN
    CREATE TYPE platform.blog_question_status AS ENUM (
      'private',
      'pending_review',
      'approved',
      'rejected',
      'archived'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS platform.blog_article_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
  post_slug TEXT NOT NULL,
  post_title_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_article_helpful_votes_user_post_unique UNIQUE (user_id, post_id),
  CONSTRAINT blog_article_helpful_votes_slug_check CHECK (post_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS platform.blog_article_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
  post_slug TEXT NOT NULL,
  post_title_snapshot TEXT NOT NULL,
  post_excerpt_snapshot TEXT,
  post_published_at_snapshot TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_article_saves_user_post_unique UNIQUE (user_id, post_id),
  CONSTRAINT blog_article_saves_slug_check CHECK (post_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS platform.blog_article_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES showroom.blog_posts(id) ON DELETE SET NULL,
  post_slug TEXT NOT NULL,
  post_title_snapshot TEXT NOT NULL,
  question_body TEXT NOT NULL,
  approved_question TEXT,
  approved_answer TEXT,
  status platform.blog_question_status NOT NULL DEFAULT 'private',
  admin_note TEXT,
  reviewed_by UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  published_block_id UUID REFERENCES showroom.blog_blocks(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_article_questions_slug_check CHECK (post_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT blog_article_questions_body_check CHECK (
    length(btrim(question_body)) BETWEEN 2 AND 2000
  ),
  CONSTRAINT blog_article_questions_approved_text_check CHECK (
    (
      approved_question IS NULL
      OR length(btrim(approved_question)) BETWEEN 2 AND 240
    )
    AND (
      approved_answer IS NULL
      OR length(btrim(approved_answer)) BETWEEN 2 AND 2000
    )
  ),
  CONSTRAINT blog_article_questions_review_check CHECK (
    status NOT IN ('approved', 'rejected', 'archived')
    OR reviewed_at IS NOT NULL
  ),
  CONSTRAINT blog_article_questions_approved_publish_check CHECK (
    status <> 'approved'
    OR (
      approved_question IS NOT NULL
      AND approved_answer IS NOT NULL
      AND published_block_id IS NOT NULL
      AND published_at IS NOT NULL
    )
  )
);

DROP TRIGGER IF EXISTS set_timestamp_blog_article_questions ON platform.blog_article_questions;
CREATE TRIGGER set_timestamp_blog_article_questions
BEFORE UPDATE ON platform.blog_article_questions
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS blog_article_helpful_votes_post_idx
  ON platform.blog_article_helpful_votes(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_article_helpful_votes_user_idx
  ON platform.blog_article_helpful_votes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_article_helpful_votes_slug_idx
  ON platform.blog_article_helpful_votes(post_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS blog_article_saves_post_idx
  ON platform.blog_article_saves(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_article_saves_user_idx
  ON platform.blog_article_saves(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_article_saves_slug_idx
  ON platform.blog_article_saves(post_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS blog_article_questions_post_idx
  ON platform.blog_article_questions(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_article_questions_user_idx
  ON platform.blog_article_questions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_article_questions_status_idx
  ON platform.blog_article_questions(status, created_at DESC);

ALTER TABLE platform.blog_article_helpful_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.blog_article_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.blog_article_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_or_admin_blog_helpful_votes ON platform.blog_article_helpful_votes;
CREATE POLICY select_own_or_admin_blog_helpful_votes
  ON platform.blog_article_helpful_votes
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR platform_private.is_admin()
  );

DROP POLICY IF EXISTS insert_own_blog_helpful_votes ON platform.blog_article_helpful_votes;
CREATE POLICY insert_own_blog_helpful_votes
  ON platform.blog_article_helpful_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS delete_own_blog_helpful_votes ON platform.blog_article_helpful_votes;
CREATE POLICY delete_own_blog_helpful_votes
  ON platform.blog_article_helpful_votes
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR platform_private.is_admin()
  );

DROP POLICY IF EXISTS select_own_or_admin_blog_saves ON platform.blog_article_saves;
CREATE POLICY select_own_or_admin_blog_saves
  ON platform.blog_article_saves
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR platform_private.is_admin()
  );

DROP POLICY IF EXISTS insert_own_blog_saves ON platform.blog_article_saves;
CREATE POLICY insert_own_blog_saves
  ON platform.blog_article_saves
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS delete_own_blog_saves ON platform.blog_article_saves;
CREATE POLICY delete_own_blog_saves
  ON platform.blog_article_saves
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR platform_private.is_admin()
  );

DROP POLICY IF EXISTS select_own_or_admin_blog_questions ON platform.blog_article_questions;
CREATE POLICY select_own_or_admin_blog_questions
  ON platform.blog_article_questions
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR platform_private.is_admin()
  );

DROP POLICY IF EXISTS insert_own_blog_questions ON platform.blog_article_questions;
CREATE POLICY insert_own_blog_questions
  ON platform.blog_article_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status IN ('private', 'pending_review')
    AND approved_question IS NULL
    AND approved_answer IS NULL
    AND admin_note IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND published_block_id IS NULL
    AND published_at IS NULL
  );

DROP POLICY IF EXISTS update_admin_blog_questions ON platform.blog_article_questions;
CREATE POLICY update_admin_blog_questions
  ON platform.blog_article_questions
  FOR UPDATE
  TO authenticated
  USING (platform_private.is_admin())
  WITH CHECK (platform_private.is_admin());

GRANT SELECT, INSERT, DELETE ON platform.blog_article_helpful_votes TO authenticated;
GRANT SELECT, INSERT, DELETE ON platform.blog_article_saves TO authenticated;
GRANT SELECT, INSERT, UPDATE ON platform.blog_article_questions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON platform.blog_article_helpful_votes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.blog_article_saves TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.blog_article_questions TO service_role;

NOTIFY pgrst, 'reload schema';
