-- source_evidence remains internal provenance. It is no longer a human-entered
-- readiness signal, and content readiness no longer depends on a manual date.
ALTER TABLE showroom.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_ready_required_fields_check;

ALTER TABLE showroom.blog_posts
  ADD CONSTRAINT blog_posts_ready_required_fields_check CHECK (
    status NOT IN ('ready', 'published')
    OR (
      length(btrim(title)) > 0
      AND length(btrim(slug)) > 0
      AND length(btrim(coalesce(meta_description, ''))) BETWEEN 50 AND 180
      AND length(btrim(coalesce(target_question, ''))) > 0
      AND length(btrim(coalesce(summary_answer, ''))) > 20
    )
  );

COMMENT ON COLUMN showroom.blog_posts.source_evidence IS
  'Server-generated internal provenance. Never exposed publicly or used as a readiness gate.';
