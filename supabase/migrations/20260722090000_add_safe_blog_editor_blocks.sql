-- Intentionally unapplied: this migration must be reviewed and approved before any
-- environment database is changed. The application feature flag keeps these values
-- unavailable until the target database confirms this enum extension.
alter type showroom.blog_block_type add value if not exists 'quote';
alter type showroom.blog_block_type add value if not exists 'video';
alter type showroom.blog_block_type add value if not exists 'related_post';
alter type showroom.blog_block_type add value if not exists 'place';
alter type showroom.blog_block_type add value if not exists 'quiz';
alter type showroom.blog_block_type add value if not exists 'checklist';
