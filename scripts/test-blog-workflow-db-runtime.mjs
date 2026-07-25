import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const projectRoot = path.resolve(import.meta.dirname, '..')
const readMigration = name => readFile(path.join(projectRoot, 'supabase/migrations', name), 'utf8')
const timestampMillis = value => new Date(value).getTime()
const [hiddenAllowlist, leaseMigration, workflowMigration, assetTrashMigration] = await Promise.all([
  readMigration('20260723062040_allow_hidden_content_asset_draft_references.sql'),
  readMigration('20260720005052_atomic_official_asset_blog_placement.sql'),
  readMigration('20260723070030_admin_cms_atomic_publish_trash_and_revision.sql'),
  readMigration('20260723070034_preserve_content_asset_trash_state_v2.sql'),
])

const db = new PGlite()
await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE SCHEMA platform;
  CREATE SCHEMA showroom;

  CREATE TYPE platform.profile_role AS ENUM ('customer', 'sales_manager', 'administrator');
  CREATE TYPE platform.blog_question_status AS ENUM ('private', 'pending_review', 'approved', 'rejected', 'archived');
  CREATE TYPE showroom.blog_post_status AS ENUM ('ai_draft', 'reviewing', 'needs_media', 'ready', 'published', 'archived');
  CREATE TYPE showroom.blog_content_category AS ENUM ('case_study', 'product_guide', 'customer_qa', 'field_knowhow', 'price_guide', 'area_guide');
  CREATE TYPE showroom.blog_block_type AS ENUM ('heading', 'paragraph', 'image', 'cta', 'qa', 'link_button', 'guide_box', 'quote', 'video', 'related_post', 'place', 'quiz', 'checklist');
  CREATE TYPE showroom.blog_media_usage_status AS ENUM ('candidate', 'approved', 'published', 'rejected');
  CREATE TYPE showroom.content_asset_library_state AS ENUM ('available', 'hidden', 'archived');
  CREATE TYPE showroom.content_asset_usage_context AS ENUM ('blog_post', 'blog_block', 'showroom_page', 'area_page', 'service_page', 'instagram', 'reels', 'proposal', 'other');
  CREATE TYPE showroom.content_asset_usage_role AS ENUM ('cover', 'body', 'inline', 'before', 'after', 'detail', 'thumbnail', 'other');

  CREATE TABLE platform.profiles (
    id UUID PRIMARY KEY,
    role platform.profile_role NOT NULL
  );

  CREATE TABLE showroom.blog_posts (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    seo_title TEXT,
    meta_description TEXT,
    canonical_url TEXT,
    status showroom.blog_post_status NOT NULL,
    category showroom.blog_content_category NOT NULL,
    primary_keyword TEXT,
    target_question TEXT,
    summary_answer TEXT,
    related_questions JSONB NOT NULL DEFAULT '[]',
    service_area TEXT,
    product_type TEXT,
    source_evidence JSONB NOT NULL DEFAULT '[]',
    brand_check_result JSONB NOT NULL DEFAULT '{}',
    ai_model TEXT,
    source_prompt TEXT,
    ai_citation_ready BOOLEAN NOT NULL DEFAULT FALSE,
    last_fact_checked_at TIMESTAMPTZ,
    media_missing_reason TEXT,
    created_by UUID REFERENCES platform.profiles(id),
    reviewed_by UUID REFERENCES platform.profiles(id),
    published_by UUID REFERENCES platform.profiles(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE showroom.content_assets (
    id UUID PRIMARY KEY,
    title TEXT,
    description TEXT,
    category TEXT,
    labels JSONB NOT NULL DEFAULT '{}',
    product_type TEXT,
    space_type TEXT,
    region TEXT,
    usage_purpose TEXT,
    library_state showroom.content_asset_library_state NOT NULL DEFAULT 'available',
    privacy_checked BOOLEAN NOT NULL DEFAULT FALSE,
    promotion_consent_checked BOOLEAN NOT NULL DEFAULT FALSE,
    used_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES platform.profiles(id),
    updated_by UUID REFERENCES platform.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE showroom.blog_media (
    id UUID PRIMARY KEY,
    post_id UUID REFERENCES showroom.blog_posts(id) ON DELETE SET NULL,
    content_asset_id UUID REFERENCES showroom.content_assets(id) ON DELETE SET NULL,
    public_bucket TEXT,
    public_object_path TEXT,
    public_url TEXT,
    alt_text TEXT,
    caption TEXT,
    source_label TEXT,
    usage_status showroom.blog_media_usage_status NOT NULL DEFAULT 'candidate',
    privacy_checked BOOLEAN NOT NULL DEFAULT FALSE,
    promotion_consent_checked BOOLEAN NOT NULL DEFAULT FALSE,
    used_as_cover BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by UUID REFERENCES platform.profiles(id),
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE showroom.blog_blocks (
    id UUID PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    type showroom.blog_block_type NOT NULL,
    heading_level INTEGER,
    text TEXT,
    media_id UUID REFERENCES showroom.blog_media(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, display_order),
    CONSTRAINT blog_blocks_image_media_check CHECK (type <> 'image' OR media_id IS NOT NULL)
  );

  CREATE TABLE showroom.blog_editor_save_leases (
    post_id UUID PRIMARY KEY REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
    lease_token UUID NOT NULL UNIQUE,
    actor_id UUID NOT NULL REFERENCES platform.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE showroom.content_asset_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES showroom.content_assets(id) ON DELETE CASCADE,
    usage_context showroom.content_asset_usage_context NOT NULL,
    ref_table TEXT NOT NULL,
    ref_id UUID NOT NULL,
    role showroom.content_asset_usage_role NOT NULL,
    caption_override TEXT,
    alt_text_override TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES platform.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE showroom.content_asset_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES showroom.content_assets(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id UUID REFERENCES platform.profiles(id),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE showroom.blog_post_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES platform.profiles(id),
    event_type TEXT NOT NULL,
    from_status showroom.blog_post_status,
    to_status showroom.blog_post_status,
    memo TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE platform.blog_article_questions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES platform.profiles(id),
    post_id UUID REFERENCES showroom.blog_posts(id) ON DELETE SET NULL,
    post_slug TEXT NOT NULL,
    post_title_snapshot TEXT NOT NULL,
    question_body TEXT NOT NULL,
    approved_question TEXT,
    approved_answer TEXT,
    status platform.blog_question_status NOT NULL DEFAULT 'private',
    admin_note TEXT,
    reviewed_by UUID REFERENCES platform.profiles(id),
    reviewed_at TIMESTAMPTZ,
    published_block_id UUID REFERENCES showroom.blog_blocks(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA showroom TO authenticated;
`)

await db.exec(leaseMigration.slice(0, leaseMigration.indexOf('CREATE OR REPLACE FUNCTION showroom.reconcile_blog_editor_save_lease')))
await db.exec(hiddenAllowlist)
await db.exec(workflowMigration)
await db.exec(assetTrashMigration)
await db.exec(`
  CREATE TRIGGER reject_archived_content_asset_blog_media_reference
    BEFORE INSERT OR UPDATE OF content_asset_id ON showroom.blog_media
    FOR EACH ROW EXECUTE FUNCTION showroom.reject_archived_content_asset_reference();
  CREATE TRIGGER reject_archived_content_asset_usage_reference
    BEFORE INSERT OR UPDATE OF asset_id ON showroom.content_asset_usages
    FOR EACH ROW EXECUTE FUNCTION showroom.reject_archived_content_asset_usage();
`)

const adminId = '00000000-0000-0000-0000-000000000001'
const postId = '00000000-0000-0000-0000-000000000010'
const mediaId = '00000000-0000-0000-0000-000000000020'
const blockId = '00000000-0000-0000-0000-000000000030'
const deletionAttemptId = '00000000-0000-0000-0000-000000000031'
await db.exec(`
  INSERT INTO platform.profiles(id, role) VALUES ('${adminId}', 'administrator');
  INSERT INTO showroom.blog_posts(id, title, slug, status, category)
    VALUES ('${postId}', '삭제 계약 글', 'delete-contract', 'archived', 'case_study');
  INSERT INTO showroom.blog_media(
    id, post_id, public_bucket, public_object_path, public_url, alt_text,
    usage_status, privacy_checked, promotion_consent_checked, approved_by, approved_at
  ) VALUES (
    '${mediaId}', '${postId}', 'blog-media', '${postId}/legacy.webp', 'https://example.invalid/legacy.webp',
    '대체 텍스트', 'approved', TRUE, TRUE, '${adminId}', NOW()
  );
  INSERT INTO showroom.blog_blocks(id, post_id, display_order, type, media_id)
    VALUES ('${blockId}', '${postId}', 0, 'image', '${mediaId}');
  INSERT INTO showroom.blog_publication_attempts(
    id, post_id, actor_id, expected_updated_at, status, object_paths
  ) VALUES (
    '${deletionAttemptId}', '${postId}', '${adminId}', NOW(), 'staged',
    ARRAY['${postId}/reserved.webp']
  );
`)

await assert.rejects(
  db.query(
    `SELECT showroom.permanently_delete_blog_post($1, $2, $3) AS result`,
    [postId, adminId, '삭제 계약 글'],
  ),
  /publication attempt is still in progress/,
)
await db.query(
  `UPDATE showroom.blog_publication_attempts
   SET staging_expires_at = NOW() - INTERVAL '1 minute'
   WHERE id = $1`,
  [deletionAttemptId],
)
assert.equal(
  (
    await db.query(
      `SELECT showroom.claim_expired_blog_publication_attempt($1, $2) AS claimed`,
      [deletionAttemptId, adminId],
    )
  ).rows[0].claimed,
  true,
)
await assert.rejects(
  db.query(
    `SELECT showroom.permanently_delete_blog_post($1, $2, $3) AS result`,
    [postId, adminId, '삭제 계약 글'],
  ),
  /publication attempt is still in progress/,
)
await db.query(
  `UPDATE showroom.blog_publication_attempts SET status = 'abandoned' WHERE id = $1`,
  [deletionAttemptId],
)
const deletion = await db.query(
  `SELECT showroom.permanently_delete_blog_post($1, $2, $3) AS result`,
  [postId, adminId, '삭제 계약 글'],
)
assert.equal(deletion.rows.length, 1)
assert.equal((await db.query(`SELECT count(*)::int AS count FROM showroom.blog_posts WHERE id = $1`, [postId])).rows[0].count, 0)
assert.equal((await db.query(`SELECT count(*)::int AS count FROM showroom.storage_cleanup_jobs`, [])).rows[0].count, 1)
assert.equal(
  (await db.query(`SELECT post_id FROM showroom.blog_publication_attempts WHERE id = $1`, [deletionAttemptId])).rows[0].post_id,
  null,
)

const rollbackPostId = '00000000-0000-0000-0000-000000000060'
const rollbackBlockId = '00000000-0000-0000-0000-000000000061'
const rollbackAttemptId = '00000000-0000-0000-0000-000000000062'
await db.exec(`
  INSERT INTO showroom.blog_posts(
    id, title, slug, status, category, updated_at
  ) VALUES (
    '${rollbackPostId}', '원자적 롤백 계약 글', 'atomic-rollback-contract',
    'reviewing', 'case_study', '2026-07-23T07:00:00Z'
  );
  INSERT INTO showroom.blog_blocks(id, post_id, display_order, type, text)
    VALUES ('${rollbackBlockId}', '${rollbackPostId}', 0, 'paragraph', '기존 저장 블록');
`)
await db.query(
  `SELECT showroom.create_blog_publication_attempt($1, $2, $3, $4)`,
  [rollbackAttemptId, rollbackPostId, adminId, '2026-07-23T07:00:00Z'],
)

const validPublicationPost = {
  title: '원자적 롤백 계약 글',
  slug: 'atomic-rollback-contract',
  excerpt: '발행 저장 트랜잭션 롤백을 검증합니다.',
  category: 'case_study',
  seo_title: '원자적 롤백 계약 글',
  meta_description: '저장과 발행을 하나의 데이터베이스 트랜잭션으로 처리하고 오류 발생 시 기존 본문을 보존하는 계약을 검증합니다.',
  canonical_url: null,
  primary_keyword: '원자적 발행',
  target_question: '발행 도중 오류가 나면 기존 본문이 보존되나요?',
  summary_answer: '발행 트랜잭션이 실패하면 글과 블록 변경은 모두 이전 상태로 되돌아갑니다.',
  related_questions: [],
  service_area: null,
  product_type: null,
  ai_citation_ready: true,
  media_missing_reason: '런타임 계약 테스트에는 공개 사진을 사용하지 않습니다.',
}
const duplicateBlockId = '00000000-0000-0000-0000-000000000063'
const duplicateBlocks = [
  {
    id: duplicateBlockId,
    display_order: 0,
    type: 'paragraph',
    heading_level: null,
    text: '새 본문',
    media_id: null,
    metadata: {},
    created_at: '2026-07-23T07:00:01Z',
  },
  {
    id: duplicateBlockId,
    display_order: 1,
    type: 'cta',
    heading_level: null,
    text: '상담하기',
    media_id: null,
    metadata: {},
    created_at: '2026-07-23T07:00:01Z',
  },
]
await assert.rejects(
  db.query(
    `SELECT showroom.save_and_publish_blog_post(
      $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8
    )`,
    [
      rollbackAttemptId,
      rollbackPostId,
      '2026-07-23T07:00:00Z',
      adminId,
      JSON.stringify(validPublicationPost),
      JSON.stringify(duplicateBlocks),
      '[]',
      '2026-07-23T07:00:01Z',
    ],
  ),
  /duplicate key/,
)
assert.equal(
  (await db.query(`SELECT text FROM showroom.blog_blocks WHERE id = $1`, [rollbackBlockId])).rows[0].text,
  '기존 저장 블록',
)
assert.equal(
  (await db.query(`SELECT status::text AS status FROM showroom.blog_posts WHERE id = $1`, [rollbackPostId])).rows[0].status,
  'reviewing',
)
assert.equal(
  (await db.query(`SELECT status FROM showroom.blog_publication_attempts WHERE id = $1`, [rollbackAttemptId])).rows[0].status,
  'staged',
)
const heartbeat = await db.query(
  `SELECT showroom.heartbeat_blog_publication_attempt($1, $2) AS expires_at`,
  [rollbackAttemptId, adminId],
)
assert.ok(new Date(heartbeat.rows[0].expires_at).getTime() > Date.now())
await assert.rejects(
  db.query(`SELECT showroom.transition_blog_post_trash($1, $2, FALSE)`, [rollbackPostId, adminId]),
  /publication attempt is still in progress/,
)
await db.query(
  `UPDATE showroom.blog_publication_attempts
   SET staging_expires_at = NOW() - INTERVAL '1 minute'
   WHERE id = $1`,
  [rollbackAttemptId],
)
assert.equal(
  (
    await db.query(
      `SELECT showroom.claim_expired_blog_publication_attempt($1, $2) AS claimed`,
      [rollbackAttemptId, adminId],
    )
  ).rows[0].claimed,
  true,
)
assert.equal(
  (await db.query(`SELECT status FROM showroom.blog_publication_attempts WHERE id = $1`, [rollbackAttemptId])).rows[0].status,
  'reconcile',
)
await db.query(
  `UPDATE showroom.blog_publication_attempts SET status = 'abandoned' WHERE id = $1`,
  [rollbackAttemptId],
)
await db.query(`SELECT showroom.transition_blog_post_trash($1, $2, FALSE)`, [rollbackPostId, adminId])
await db.query(
  `SELECT showroom.permanently_delete_blog_post($1, $2, $3)`,
  [rollbackPostId, adminId, '원자적 롤백 계약 글'],
)
assert.equal(
  (await db.query(`SELECT post_id FROM showroom.blog_publication_attempts WHERE id = $1`, [rollbackAttemptId])).rows[0].post_id,
  null,
)

const retiredPostId = '00000000-0000-0000-0000-000000000070'
const retiredAttemptId = '00000000-0000-0000-0000-000000000071'
const retiredObjectPath = `${retiredPostId}/previous/public.webp`
await db.exec(`
  CREATE OR REPLACE FUNCTION showroom.force_post_revision()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$
  BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
  END;
  $$;
  CREATE TRIGGER force_post_revision
    BEFORE UPDATE ON showroom.blog_posts
    FOR EACH ROW EXECUTE FUNCTION showroom.force_post_revision();
`)
await db.exec(`
  INSERT INTO showroom.blog_posts(id, title, slug, status, category, updated_at)
    VALUES (
      '${retiredPostId}', '교체 사진 정리 계약 글', 'retired-cleanup-contract',
      'reviewing', 'case_study', '2026-07-23T07:10:00Z'
    );
  INSERT INTO showroom.blog_public_media_objects(
    post_id, publication_attempt_id, bucket, object_path, state
  ) VALUES (
    '${retiredPostId}', '${retiredPostId}', 'blog-media', '${retiredObjectPath}', 'active'
  );
`)
await db.query(
  `SELECT showroom.create_blog_publication_attempt($1, $2, $3, $4)`,
  [retiredAttemptId, retiredPostId, adminId, '2026-07-23T07:10:00Z'],
)
const retiredPublicationPost = {
  ...validPublicationPost,
  title: '교체 사진 정리 계약 글',
  slug: 'retired-cleanup-contract',
}
const validBlocks = [
  {
    id: '00000000-0000-0000-0000-000000000072',
    display_order: 0,
    type: 'paragraph',
    heading_level: null,
    text: '교체된 공개 사진 정리 계약 본문',
    media_id: null,
    metadata: {},
    created_at: '2026-07-23T07:10:01Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000073',
    display_order: 1,
    type: 'cta',
    heading_level: null,
    text: '상담하기',
    media_id: null,
    metadata: {},
    created_at: '2026-07-23T07:10:01Z',
  },
]
const retiredPublication = await db.query(
  `SELECT showroom.save_and_publish_blog_post(
    $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8
  ) AS result`,
  [
    retiredAttemptId,
    retiredPostId,
    '2026-07-23T07:10:00Z',
    adminId,
    JSON.stringify(retiredPublicationPost),
    JSON.stringify(validBlocks),
    '[]',
    '2026-07-23T07:10:01Z',
  ],
)
assert.deepEqual(retiredPublication.rows[0].result.retired_public_paths, [retiredObjectPath])
assert.ok(retiredPublication.rows[0].result.retired_cleanup_job_id)
const publishedRevision = (
  await db.query(`SELECT updated_at FROM showroom.blog_posts WHERE id = $1`, [retiredPostId])
).rows[0].updated_at
assert.equal(
  timestampMillis(retiredPublication.rows[0].result.updated_at),
  timestampMillis(publishedRevision),
  'publish must return the post revision after a database timestamp trigger runs',
)
assert.notEqual(
  publishedRevision,
  '2026-07-23T07:10:01.000Z',
  'the test trigger must prove client/RPC clock values are not treated as authoritative',
)
const archivedPublication = await db.query(
  `SELECT showroom.transition_blog_post_trash($1, $2, FALSE) AS result`,
  [retiredPostId, adminId],
)
const archivedRevision = (
  await db.query(`SELECT updated_at FROM showroom.blog_posts WHERE id = $1`, [retiredPostId])
).rows[0].updated_at
assert.equal(
  timestampMillis(archivedPublication.rows[0].result.changed_at),
  timestampMillis(archivedRevision),
  'archive must return the post revision after a database timestamp trigger runs',
)
const restoredPublication = await db.query(
  `SELECT showroom.transition_blog_post_trash($1, $2, TRUE) AS result`,
  [retiredPostId, adminId],
)
const restoredRevision = (
  await db.query(`SELECT updated_at FROM showroom.blog_posts WHERE id = $1`, [retiredPostId])
).rows[0].updated_at
assert.equal(
  timestampMillis(restoredPublication.rows[0].result.changed_at),
  timestampMillis(restoredRevision),
  'restore must return the post revision after a database timestamp trigger runs',
)
await db.query(
  `SELECT showroom.acquire_blog_editor_save_lease($1, $2, $3, $4)`,
  [retiredPostId, adminId, '00000000-0000-0000-0000-000000000074', restoredRevision],
)
await db.query(
  `SELECT showroom.release_blog_editor_save_lease($1, $2, $3)`,
  [retiredPostId, adminId, '00000000-0000-0000-0000-000000000074'],
)
await assert.rejects(
  db.query(
    `SELECT showroom.acquire_blog_editor_save_lease($1, $2, $3, $4)`,
    [retiredPostId, adminId, '00000000-0000-0000-0000-000000000075', archivedRevision],
  ),
  /blog post changed since the editor loaded/,
)
assert.equal(
  (
    await db.query(
      `SELECT count(*)::int AS count
       FROM showroom.storage_cleanup_jobs
       WHERE reason = $1`,
      [`retired_blog_publication:${retiredAttemptId}`],
    )
  ).rows[0].count,
  1,
)

const hiddenAssetId = '00000000-0000-0000-0000-000000000040'
const draftPostId = '00000000-0000-0000-0000-000000000041'
await db.exec(`
  INSERT INTO showroom.content_assets(id, title, library_state)
    VALUES ('${hiddenAssetId}', '비공개 후보', 'hidden');
  INSERT INTO showroom.blog_posts(id, title, slug, status, category)
    VALUES ('${draftPostId}', '초안', 'draft-contract', 'reviewing', 'case_study');
  INSERT INTO showroom.blog_media(id, post_id, content_asset_id)
    VALUES ('00000000-0000-0000-0000-000000000042', '${draftPostId}', '${hiddenAssetId}');
`)
await db.exec(`UPDATE showroom.content_assets SET library_state = 'archived' WHERE id = '${hiddenAssetId}'`)
await assert.rejects(
  db.exec(`
    INSERT INTO showroom.blog_media(id, post_id, content_asset_id)
      VALUES ('00000000-0000-0000-0000-000000000043', '${draftPostId}', '${hiddenAssetId}')
  `),
  /archived content assets cannot be referenced/,
)

const legacyAssetId = '00000000-0000-0000-0000-000000000050'
await db.exec(`
  INSERT INTO showroom.content_assets(id, title, library_state)
    VALUES ('${legacyAssetId}', '이전 휴지통 사진', 'archived')
`)
await db.query(
  `SELECT showroom.archive_content_assets_safely($1::uuid[], $2::uuid, TRUE)`,
  [[legacyAssetId], adminId],
)
assert.equal(
  (await db.query(`SELECT library_state::text AS state FROM showroom.content_assets WHERE id = $1`, [legacyAssetId])).rows[0].state,
  'hidden',
)

await db.exec(`SET ROLE authenticated`)
await assert.rejects(
  db.exec(`UPDATE showroom.blog_posts SET status = 'published' WHERE id = '${draftPostId}'`),
  /permission denied/,
)
await assert.rejects(
  db.exec(`DELETE FROM showroom.blog_posts WHERE id = '${draftPostId}'`),
  /permission denied/,
)
await db.exec(`RESET ROLE`)

const customerId = '00000000-0000-0000-0000-000000000080'
await db.exec(`INSERT INTO platform.profiles(id, role) VALUES ('${customerId}', 'customer')`)
await assert.rejects(
  db.query(
    `SELECT showroom.create_blog_publication_attempt($1, $2, $3, $4)`,
    ['00000000-0000-0000-0000-000000000081', draftPostId, customerId, new Date().toISOString()],
  ),
  /actor must be an administrator/,
)
await db.exec(`SET ROLE authenticated`)
await assert.rejects(
  db.query(
    `SELECT showroom.create_blog_publication_attempt($1, $2, $3, $4)`,
    ['00000000-0000-0000-0000-000000000082', draftPostId, adminId, new Date().toISOString()],
  ),
  /permission denied/,
)
await db.exec(`RESET ROLE`)
await db.exec(`SET ROLE anon`)
await assert.rejects(
  db.query(
    `SELECT showroom.save_and_publish_blog_post(
      $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8
    )`,
    [
      retiredAttemptId,
      retiredPostId,
      '2026-07-23T07:10:00Z',
      adminId,
      JSON.stringify(retiredPublicationPost),
      JSON.stringify(validBlocks),
      '[]',
      '2026-07-23T07:10:01Z',
    ],
  ),
  /permission denied/,
)
await db.exec(`RESET ROLE`)

await db.close()
console.log('runtime migration, rollback, race gate, cleanup ledger, hidden allowlist, restore, and privilege contracts passed')
