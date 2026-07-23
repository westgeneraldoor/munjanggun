-- Preserve the visibility state across trash/restore. In particular, a hidden
-- central-brand candidate must not become publicly selectable after restore.
ALTER TABLE showroom.content_assets
  ADD COLUMN IF NOT EXISTS library_state_before_archive showroom.content_asset_library_state,
  ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ;

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
  v_previous_state showroom.content_asset_library_state;
BEGIN
  IF p_asset_ids IS NULL OR cardinality(p_asset_ids) = 0 OR cardinality(p_asset_ids) > 300 THEN
    RAISE EXCEPTION 'provide between one and 300 assets';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'actor must be an administrator';
  END IF;

  FOR v_asset_id IN
    SELECT DISTINCT candidate_id
    FROM unnest(p_asset_ids) AS candidate_id
    ORDER BY candidate_id
  LOOP
    SELECT asset.library_state, asset.library_state_before_archive
    INTO v_current_state, v_previous_state
    FROM showroom.content_assets AS asset
    WHERE asset.id = v_asset_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'assetId', v_asset_id,
        'changed', FALSE,
        'reason', 'not_found',
        'references', '[]'::JSONB
      ));
      CONTINUE;
    END IF;

    IF p_restore THEN
      IF v_current_state = 'archived'::showroom.content_asset_library_state THEN
        UPDATE showroom.content_assets
        SET
          library_state = COALESCE(
            v_previous_state,
            -- Legacy archived rows predate the previous-state column. Restore
            -- them privately instead of exposing an unknown prior state.
            'hidden'::showroom.content_asset_library_state
          ),
          library_state_before_archive = NULL,
          trashed_at = NULL,
          updated_by = p_actor_id,
          updated_at = clock_timestamp()
        WHERE id = v_asset_id
          AND library_state = 'archived'::showroom.content_asset_library_state;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'asset changed while it was being restored';
        END IF;

        INSERT INTO showroom.content_asset_events (
          asset_id,
          event_type,
          actor_id,
          metadata
        ) VALUES (
          v_asset_id,
          'restored_from_library_trash',
          p_actor_id,
          jsonb_build_object('restored_state', COALESCE(v_previous_state, 'hidden'))
        );
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'assetId', v_asset_id,
          'changed', TRUE,
          'reason', 'restored',
          'references', '[]'::JSONB
        ));
      ELSE
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'assetId', v_asset_id,
          'changed', FALSE,
          'reason', 'not_archived',
          'references', '[]'::JSONB
        ));
      END IF;
      CONTINUE;
    END IF;

    -- Lock direct bridges and the usage ledger before recomputing references.
    PERFORM 1
    FROM showroom.blog_media AS media
    WHERE media.content_asset_id = v_asset_id
    ORDER BY media.id
    FOR UPDATE;

    PERFORM 1
    FROM showroom.content_asset_usages AS usage
    WHERE usage.asset_id = v_asset_id
    ORDER BY usage.id
    FOR UPDATE;

    SELECT COALESCE(
      jsonb_agg(reference ORDER BY reference->>'postTitle', reference->>'location'),
      '[]'::JSONB
    )
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
        ON usage.ref_table = 'showroom.blog_posts'
        AND usage.ref_id = post.id
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
        ON usage.ref_table = 'showroom.blog_blocks'
        AND usage.ref_id = block.id
      JOIN showroom.blog_posts AS post ON post.id = block.post_id
      WHERE usage.asset_id = v_asset_id

      UNION

      SELECT DISTINCT jsonb_build_object(
        'postId', NULL,
        'postTitle', '다른 콘텐츠에서 사용 중',
        'status', 'linked',
        'location', usage.role
      ) AS reference
      FROM showroom.content_asset_usages AS usage
      WHERE usage.asset_id = v_asset_id
        AND usage.ref_table NOT IN ('showroom.blog_posts', 'showroom.blog_blocks')
    ) AS reference_rows;

    IF jsonb_array_length(v_references) > 0 THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'assetId', v_asset_id,
        'changed', FALSE,
        'reason', 'in_use',
        'references', v_references
      ));
      CONTINUE;
    END IF;

    IF v_current_state <> 'archived'::showroom.content_asset_library_state THEN
      UPDATE showroom.content_assets
      SET
        library_state_before_archive = v_current_state,
        library_state = 'archived'::showroom.content_asset_library_state,
        trashed_at = clock_timestamp(),
        updated_by = p_actor_id,
        updated_at = clock_timestamp()
      WHERE id = v_asset_id
        AND library_state = v_current_state;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'asset changed while it was being moved to trash';
      END IF;

      INSERT INTO showroom.content_asset_events (
        asset_id,
        event_type,
        actor_id,
        metadata
      ) VALUES (
        v_asset_id,
        'moved_to_photo_library_trash',
        p_actor_id,
        jsonb_build_object('previous_state', v_current_state)
      );
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'assetId', v_asset_id,
        'changed', TRUE,
        'reason', 'archived',
        'references', '[]'::JSONB
      ));
    ELSE
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'assetId', v_asset_id,
        'changed', FALSE,
        'reason', 'already_archived',
        'references', '[]'::JSONB
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('results', v_results);
END;
$$;

DROP POLICY IF EXISTS content_assets_admin_delete ON showroom.content_assets;
REVOKE DELETE ON showroom.content_assets FROM authenticated;
REVOKE UPDATE ON showroom.content_assets FROM authenticated;
GRANT UPDATE (
  title,
  description,
  category,
  labels,
  product_type,
  space_type,
  region,
  usage_purpose,
  privacy_checked,
  promotion_consent_checked,
  updated_by,
  updated_at
) ON showroom.content_assets TO authenticated;

REVOKE ALL ON FUNCTION showroom.archive_content_assets_safely(UUID[], UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.archive_content_assets_safely(UUID[], UUID, BOOLEAN)
  TO service_role;

COMMENT ON FUNCTION showroom.archive_content_assets_safely(UUID[], UUID, BOOLEAN) IS
  'Admin-only trash/restore. Rechecks all references and restores the previous available/hidden state; never deletes storage.';

NOTIFY pgrst, 'reload schema';
