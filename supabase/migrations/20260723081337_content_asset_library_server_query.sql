CREATE OR REPLACE FUNCTION showroom.content_asset_library_matching_ids(
  p_search TEXT DEFAULT NULL,
  p_view TEXT DEFAULT 'active',
  p_category TEXT DEFAULT NULL,
  p_product_type TEXT DEFAULT NULL,
  p_space_type TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_usage_purpose TEXT DEFAULT NULL,
  p_tag_id UUID DEFAULT NULL
)
RETURNS TABLE (
  asset_id UUID,
  created_at TIMESTAMPTZ,
  sort_name TEXT,
  sort_size_bytes BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    asset.id AS asset_id,
    asset.created_at,
    lower(COALESCE(
      NULLIF(btrim(upload_event.original_file_name), ''),
      NULLIF(btrim(asset.title), ''),
      NULLIF(btrim(asset.description), ''),
      ''
    )) AS sort_name,
    COALESCE((
      SELECT MAX(file.size_bytes) FILTER (WHERE file.file_role = 'original'::showroom.content_asset_file_role)
      FROM showroom.content_asset_files AS file
      WHERE file.asset_id = asset.id
    ), (
      SELECT MAX(file.size_bytes) FILTER (WHERE file.file_role = 'web'::showroom.content_asset_file_role)
      FROM showroom.content_asset_files AS file
      WHERE file.asset_id = asset.id
    ), (
      SELECT MAX(file.size_bytes) FILTER (WHERE file.file_role = 'thumbnail'::showroom.content_asset_file_role)
      FROM showroom.content_asset_files AS file
      WHERE file.asset_id = asset.id
    ), 0)::BIGINT AS sort_size_bytes
  FROM showroom.content_assets AS asset
  LEFT JOIN LATERAL (
    SELECT event.metadata ->> 'file_name' AS original_file_name
    FROM showroom.content_asset_events AS event
    WHERE event.asset_id = asset.id
      AND event.event_type = 'uploaded'
      AND NULLIF(btrim(event.metadata ->> 'file_name'), '') IS NOT NULL
    ORDER BY event.created_at ASC, event.id ASC
    LIMIT 1
  ) AS upload_event ON TRUE
  WHERE
    CASE
      WHEN p_view = 'archived'
        THEN asset.library_state = 'archived'::showroom.content_asset_library_state
      ELSE asset.library_state <> 'archived'::showroom.content_asset_library_state
    END
    AND (p_category IS NULL OR asset.category = p_category)
    AND (p_product_type IS NULL OR asset.product_type = p_product_type)
    AND (p_space_type IS NULL OR asset.space_type = p_space_type)
    AND (p_region IS NULL OR asset.region = p_region)
    AND (p_usage_purpose IS NULL OR asset.usage_purpose = p_usage_purpose)
    AND (
      p_tag_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM showroom.content_asset_tag_links AS tag_link
        WHERE tag_link.asset_id = asset.id
          AND tag_link.tag_id = p_tag_id
      )
    )
    AND (
      p_search IS NULL
      OR position(
        lower(btrim(p_search))
        IN lower(concat_ws(
          ' ',
          upload_event.original_file_name,
          asset.title,
          asset.description,
          asset.category,
          asset.product_type,
          asset.space_type,
          asset.region,
          asset.usage_purpose,
          (
            SELECT string_agg(tag.name, ' ' ORDER BY tag.name)
            FROM showroom.content_asset_tag_links AS search_link
            JOIN showroom.content_asset_tags AS tag ON tag.id = search_link.tag_id
            WHERE search_link.asset_id = asset.id
          )
        ))
      ) > 0
    );
$$;

CREATE OR REPLACE FUNCTION showroom.list_content_assets_admin(
  p_search TEXT DEFAULT NULL,
  p_view TEXT DEFAULT 'active',
  p_category TEXT DEFAULT NULL,
  p_product_type TEXT DEFAULT NULL,
  p_space_type TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_usage_purpose TEXT DEFAULT NULL,
  p_tag_id UUID DEFAULT NULL,
  p_sort TEXT DEFAULT 'newest',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 48
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_page INTEGER := greatest(1, least(COALESCE(p_page, 1), 100000));
  v_page_size INTEGER := greatest(1, least(COALESCE(p_page_size, 48), 96));
  v_offset INTEGER;
  v_result JSONB;
BEGIN
  IF p_view NOT IN ('active', 'archived') THEN
    RAISE EXCEPTION 'unsupported asset library view';
  END IF;

  IF p_sort NOT IN ('newest', 'oldest', 'nameAsc', 'nameDesc', 'sizeDesc', 'sizeAsc') THEN
    RAISE EXCEPTION 'unsupported asset library sort';
  END IF;

  v_offset := (v_page - 1) * v_page_size;

  WITH matching AS MATERIALIZED (
    SELECT *
    FROM showroom.content_asset_library_matching_ids(
      NULLIF(btrim(p_search), ''),
      p_view,
      NULLIF(btrim(p_category), ''),
      NULLIF(btrim(p_product_type), ''),
      NULLIF(btrim(p_space_type), ''),
      NULLIF(btrim(p_region), ''),
      NULLIF(btrim(p_usage_purpose), ''),
      p_tag_id
    )
  ),
  ordered AS (
    SELECT
      matching.asset_id,
      row_number() OVER (
        ORDER BY
          CASE WHEN p_sort = 'newest' THEN matching.created_at END DESC NULLS LAST,
          CASE WHEN p_sort = 'oldest' THEN matching.created_at END ASC NULLS LAST,
          CASE WHEN p_sort = 'nameAsc' THEN matching.sort_name END ASC NULLS LAST,
          CASE WHEN p_sort = 'nameDesc' THEN matching.sort_name END DESC NULLS LAST,
          CASE WHEN p_sort = 'sizeDesc' THEN matching.sort_size_bytes END DESC NULLS LAST,
          CASE WHEN p_sort = 'sizeAsc' THEN matching.sort_size_bytes END ASC NULLS LAST,
          matching.asset_id ASC
      ) AS ordinal
    FROM matching
  ),
  page_rows AS (
    SELECT ordered.asset_id, ordered.ordinal
    FROM ordered
    ORDER BY ordered.ordinal
    LIMIT v_page_size
    OFFSET v_offset
  ),
  facets AS (
    SELECT jsonb_build_object(
      'categories', COALESCE((
        SELECT jsonb_agg(value ORDER BY value)
        FROM (
          SELECT DISTINCT asset.category AS value
          FROM showroom.content_assets AS asset
          WHERE asset.category IS NOT NULL AND btrim(asset.category) <> ''
        ) AS facet_values
      ), '[]'::JSONB),
      'productTypes', COALESCE((
        SELECT jsonb_agg(value ORDER BY value)
        FROM (
          SELECT DISTINCT asset.product_type AS value
          FROM showroom.content_assets AS asset
          WHERE asset.product_type IS NOT NULL AND btrim(asset.product_type) <> ''
        ) AS facet_values
      ), '[]'::JSONB),
      'spaceTypes', COALESCE((
        SELECT jsonb_agg(value ORDER BY value)
        FROM (
          SELECT DISTINCT asset.space_type AS value
          FROM showroom.content_assets AS asset
          WHERE asset.space_type IS NOT NULL AND btrim(asset.space_type) <> ''
        ) AS facet_values
      ), '[]'::JSONB),
      'regions', COALESCE((
        SELECT jsonb_agg(value ORDER BY value)
        FROM (
          SELECT DISTINCT asset.region AS value
          FROM showroom.content_assets AS asset
          WHERE asset.region IS NOT NULL AND btrim(asset.region) <> ''
        ) AS facet_values
      ), '[]'::JSONB),
      'usagePurposes', COALESCE((
        SELECT jsonb_agg(value ORDER BY value)
        FROM (
          SELECT DISTINCT asset.usage_purpose AS value
          FROM showroom.content_assets AS asset
          WHERE asset.usage_purpose IS NOT NULL AND btrim(asset.usage_purpose) <> ''
        ) AS facet_values
      ), '[]'::JSONB)
    ) AS value
  )
  SELECT jsonb_build_object(
    'assetIds', COALESCE((
      SELECT jsonb_agg(page_rows.asset_id ORDER BY page_rows.ordinal)
      FROM page_rows
    ), '[]'::JSONB),
    'totalCount', (SELECT COUNT(*) FROM matching),
    'selectionToken', md5(COALESCE((
      SELECT string_agg(matching.asset_id::TEXT, ',' ORDER BY matching.asset_id)
      FROM matching
    ), '')),
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', greatest(1, ceil((SELECT COUNT(*) FROM matching)::NUMERIC / v_page_size)::INTEGER),
    'facets', (SELECT facets.value FROM facets)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION showroom.archive_content_asset_search_results_safely(
  p_search TEXT DEFAULT NULL,
  p_view TEXT DEFAULT 'active',
  p_category TEXT DEFAULT NULL,
  p_product_type TEXT DEFAULT NULL,
  p_space_type TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_usage_purpose TEXT DEFAULT NULL,
  p_tag_id UUID DEFAULT NULL,
  p_expected_count BIGINT DEFAULT 0,
  p_expected_token TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_restore BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_asset_ids UUID[];
  v_current_count BIGINT;
  v_current_token TEXT;
  v_offset INTEGER := 1;
  v_chunk UUID[];
  v_chunk_result JSONB;
  v_results JSONB := '[]'::JSONB;
BEGIN
  IF p_view NOT IN ('active', 'archived') THEN
    RAISE EXCEPTION 'unsupported asset library view';
  END IF;

  SELECT COALESCE(array_agg(matching.asset_id ORDER BY matching.asset_id), ARRAY[]::UUID[])
  INTO v_asset_ids
  FROM showroom.content_asset_library_matching_ids(
    NULLIF(btrim(p_search), ''),
    p_view,
    NULLIF(btrim(p_category), ''),
    NULLIF(btrim(p_product_type), ''),
    NULLIF(btrim(p_space_type), ''),
    NULLIF(btrim(p_region), ''),
    NULLIF(btrim(p_usage_purpose), ''),
    p_tag_id
  ) AS matching;

  v_current_count := cardinality(v_asset_ids);
  v_current_token := md5(COALESCE(array_to_string(v_asset_ids, ','), ''));
  IF p_expected_count < 1
    OR v_current_count <> p_expected_count
    OR v_current_token IS DISTINCT FROM p_expected_token
  THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'reason', 'result_set_changed',
      'expectedCount', p_expected_count,
      'currentCount', v_current_count,
      'currentToken', v_current_token,
      'results', '[]'::JSONB
    );
  END IF;

  WHILE v_offset <= v_current_count LOOP
    v_chunk := v_asset_ids[v_offset:least(v_offset + 299, v_current_count)];
    v_chunk_result := showroom.archive_content_assets_safely(v_chunk, p_actor_id, p_restore);
    v_results := v_results || COALESCE(v_chunk_result->'results', '[]'::JSONB);
    v_offset := v_offset + 300;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'reason', CASE WHEN p_restore THEN 'restored' ELSE 'archived' END,
    'expectedCount', p_expected_count,
    'currentCount', v_current_count,
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION showroom.content_asset_library_matching_ids(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.content_asset_library_matching_ids(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
) TO service_role;

REVOKE ALL ON FUNCTION showroom.list_content_assets_admin(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.list_content_assets_admin(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER
) TO service_role;

REVOKE ALL ON FUNCTION showroom.archive_content_asset_search_results_safely(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BIGINT, TEXT, UUID, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.archive_content_asset_search_results_safely(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BIGINT, TEXT, UUID, BOOLEAN
) TO service_role;

COMMENT ON FUNCTION showroom.list_content_assets_admin(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER
) IS 'Service-role-only complete-dataset search, filter, deterministic sort, exact count, and bounded pagination for the admin asset library.';

COMMENT ON FUNCTION showroom.archive_content_asset_search_results_safely(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BIGINT, TEXT, UUID, BOOLEAN
) IS 'Re-resolves a confirmed complete asset-library result set, verifies its count and deterministic membership token, and applies the reference-locking trash/restore RPC in one transaction.';

NOTIFY pgrst, 'reload schema';
