-- Recoverable photo-library archive. This intentionally never deletes storage.objects.
-- Apply only after explicit production approval.
CREATE OR REPLACE FUNCTION showroom.archive_content_assets_safely(
  p_asset_ids UUID[],
  p_actor_id UUID,
  p_restore BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_asset_id UUID;
  v_references JSONB;
  v_results JSONB := '[]'::JSONB;
  v_current_state showroom.content_asset_library_state;
BEGIN
  IF p_asset_ids IS NULL OR cardinality(p_asset_ids) = 0 OR cardinality(p_asset_ids) > 300 THEN
    RAISE EXCEPTION 'provide between one and 300 assets';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'actor must be an administrator';
  END IF;

  FOR v_asset_id IN SELECT DISTINCT unnest(p_asset_ids)
  LOOP
    SELECT asset.library_state
    INTO v_current_state
    FROM showroom.content_assets AS asset
    WHERE asset.id = v_asset_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'assetId', v_asset_id, 'changed', FALSE, 'reason', 'not_found', 'references', '[]'::JSONB
      ));
      CONTINUE;
    END IF;

    IF p_restore THEN
      IF v_current_state = 'archived'::showroom.content_asset_library_state THEN
        UPDATE showroom.content_assets
        SET library_state = 'available'::showroom.content_asset_library_state,
            updated_by = p_actor_id,
            updated_at = clock_timestamp()
        WHERE id = v_asset_id;
        INSERT INTO showroom.content_asset_events (asset_id, event_type, actor_id, metadata)
        VALUES (v_asset_id, 'restored_from_library_archive', p_actor_id, '{}'::JSONB);
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'assetId', v_asset_id, 'changed', TRUE, 'reason', 'restored', 'references', '[]'::JSONB
        ));
      ELSE
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'assetId', v_asset_id, 'changed', FALSE, 'reason', 'not_archived', 'references', '[]'::JSONB
        ));
      END IF;
      CONTINUE;
    END IF;

    -- Lock direct media and the ledger before recomputing. used_count is deliberately never read.
    PERFORM 1 FROM showroom.blog_media AS media WHERE media.content_asset_id = v_asset_id FOR UPDATE;
    PERFORM 1 FROM showroom.content_asset_usages AS usage WHERE usage.asset_id = v_asset_id FOR UPDATE;

    SELECT coalesce(jsonb_agg(reference ORDER BY reference->>'postTitle', reference->>'location'), '[]'::JSONB)
    INTO v_references
    FROM (
      SELECT DISTINCT jsonb_build_object(
        'postId', post.id,
        'postTitle', post.title,
        'status', post.status,
        'location', CASE WHEN media.used_as_cover THEN 'cover' ELSE 'blog_media' END
      ) AS reference
      FROM showroom.blog_media AS media
      JOIN showroom.blog_posts AS post ON post.id = media.post_id
      WHERE media.content_asset_id = v_asset_id

      UNION

      SELECT DISTINCT jsonb_build_object(
        'postId', post.id,
        'postTitle', post.title,
        'status', post.status,
        'location', 'body'
      ) AS reference
      FROM showroom.blog_media AS media
      JOIN showroom.blog_blocks AS block ON block.media_id = media.id
      JOIN showroom.blog_posts AS post ON post.id = block.post_id
      WHERE media.content_asset_id = v_asset_id

      UNION

      SELECT DISTINCT jsonb_build_object(
        'postId', post.id,
        'postTitle', post.title,
        'status', post.status,
        'location', CASE WHEN usage.role = 'cover' THEN 'cover' ELSE 'body' END
      ) AS reference
      FROM showroom.content_asset_usages AS usage
      JOIN showroom.blog_posts AS post
        ON usage.ref_table = 'showroom.blog_posts' AND usage.ref_id = post.id
      WHERE usage.asset_id = v_asset_id

      UNION

      SELECT DISTINCT jsonb_build_object(
        'postId', post.id,
        'postTitle', post.title,
        'status', post.status,
        'location', 'body'
      ) AS reference
      FROM showroom.content_asset_usages AS usage
      JOIN showroom.blog_blocks AS block
        ON usage.ref_table = 'showroom.blog_blocks' AND usage.ref_id = block.id
      JOIN showroom.blog_posts AS post ON post.id = block.post_id
      WHERE usage.asset_id = v_asset_id

      UNION

      SELECT DISTINCT jsonb_build_object(
        'postId', NULL,
        'postTitle', usage.ref_table || ':' || usage.ref_id,
        'status', 'linked',
        'location', usage.role
      ) AS reference
      FROM showroom.content_asset_usages AS usage
      WHERE usage.asset_id = v_asset_id
        AND usage.ref_table NOT IN ('showroom.blog_posts', 'showroom.blog_blocks')
    ) AS references;

    IF jsonb_array_length(v_references) > 0 THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'assetId', v_asset_id, 'changed', FALSE, 'reason', 'in_use', 'references', v_references
      ));
      CONTINUE;
    END IF;

    IF v_current_state <> 'archived'::showroom.content_asset_library_state THEN
      UPDATE showroom.content_assets
      SET library_state = 'archived'::showroom.content_asset_library_state,
          updated_by = p_actor_id,
          updated_at = clock_timestamp()
      WHERE id = v_asset_id;
      INSERT INTO showroom.content_asset_events (asset_id, event_type, actor_id, metadata)
      VALUES (v_asset_id, 'archived_from_photo_library', p_actor_id, '{}'::JSONB);
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'assetId', v_asset_id, 'changed', TRUE, 'reason', 'archived', 'references', '[]'::JSONB
      ));
    ELSE
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'assetId', v_asset_id, 'changed', FALSE, 'reason', 'already_archived', 'references', '[]'::JSONB
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('results', v_results);
END;
$$;

REVOKE ALL ON FUNCTION showroom.archive_content_assets_safely(UUID[], UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.archive_content_assets_safely(UUID[], UUID, BOOLEAN) TO service_role;

COMMENT ON FUNCTION showroom.archive_content_assets_safely(UUID[], UUID, BOOLEAN) IS
  'Admin-only recoverable library archive/restore. Rechecks blog_media, blocks and asset usages in transaction; never deletes storage.';

-- A new reference takes a key-share lock on the asset. That conflicts with the
-- archive function's FOR UPDATE lock, so either the reference is committed
-- first (and archive sees it) or it is rejected after the archive commits.
CREATE OR REPLACE FUNCTION showroom.reject_archived_content_asset_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.content_asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM showroom.content_assets AS asset
  WHERE asset.id = NEW.content_asset_id
    AND asset.library_state = 'available'::showroom.content_asset_library_state
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'archived or unavailable content assets cannot be referenced'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_archived_content_asset_blog_media_reference ON showroom.blog_media;
CREATE TRIGGER reject_archived_content_asset_blog_media_reference
BEFORE INSERT OR UPDATE OF content_asset_id ON showroom.blog_media
FOR EACH ROW
EXECUTE FUNCTION showroom.reject_archived_content_asset_reference();

CREATE OR REPLACE FUNCTION showroom.reject_archived_content_asset_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1
  FROM showroom.content_assets AS asset
  WHERE asset.id = NEW.asset_id
    AND asset.library_state = 'available'::showroom.content_asset_library_state
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'archived or unavailable content assets cannot be referenced'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_archived_content_asset_usage_reference ON showroom.content_asset_usages;
CREATE TRIGGER reject_archived_content_asset_usage_reference
BEFORE INSERT OR UPDATE OF asset_id ON showroom.content_asset_usages
FOR EACH ROW
EXECUTE FUNCTION showroom.reject_archived_content_asset_usage();

REVOKE ALL ON FUNCTION showroom.reject_archived_content_asset_reference() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION showroom.reject_archived_content_asset_usage() FROM PUBLIC, anon, authenticated;
