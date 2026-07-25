-- The asset library needs whole-result semantics, but ordinary page loads must
-- not repeatedly walk every file, event, and tag row for every asset. Keep the
-- fields used for search and sorting on the asset row and maintain them at each
-- write boundary. Existing assets are backfilled below.

ALTER TABLE showroom.content_assets
  ADD COLUMN IF NOT EXISTS library_sort_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS library_sort_size_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS library_search_text TEXT NOT NULL DEFAULT '';

ALTER TABLE showroom.content_assets
  DROP CONSTRAINT IF EXISTS content_assets_library_sort_size_bytes_check;
ALTER TABLE showroom.content_assets
  ADD CONSTRAINT content_assets_library_sort_size_bytes_check
  CHECK (library_sort_size_bytes >= 0);

CREATE OR REPLACE FUNCTION showroom.refresh_content_asset_library_projection(
  p_asset_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_asset showroom.content_assets%ROWTYPE;
  v_file_name TEXT;
  v_size_bytes BIGINT := 0;
  v_tag_text TEXT := '';
BEGIN
  SELECT asset.*
  INTO v_asset
  FROM showroom.content_assets AS asset
  WHERE asset.id = p_asset_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT NULLIF(pg_catalog.btrim(event.metadata ->> 'file_name'), '')
  INTO v_file_name
  FROM showroom.content_asset_events AS event
  WHERE event.asset_id = p_asset_id
    AND event.event_type = 'uploaded'
    AND NULLIF(pg_catalog.btrim(event.metadata ->> 'file_name'), '') IS NOT NULL
  ORDER BY event.created_at ASC, event.id ASC
  LIMIT 1;

  SELECT COALESCE(
    MAX(file.size_bytes) FILTER (WHERE file.file_role = 'original'::showroom.content_asset_file_role),
    MAX(file.size_bytes) FILTER (WHERE file.file_role = 'web'::showroom.content_asset_file_role),
    MAX(file.size_bytes) FILTER (WHERE file.file_role = 'thumbnail'::showroom.content_asset_file_role),
    0
  )::BIGINT
  INTO v_size_bytes
  FROM showroom.content_asset_files AS file
  WHERE file.asset_id = p_asset_id;

  SELECT COALESCE(pg_catalog.string_agg(tag.name, ' ' ORDER BY tag.name), '')
  INTO v_tag_text
  FROM showroom.content_asset_tag_links AS link
  JOIN showroom.content_asset_tags AS tag ON tag.id = link.tag_id
  WHERE link.asset_id = p_asset_id;

  UPDATE showroom.content_assets AS asset
  SET
    library_sort_name = pg_catalog.lower(COALESCE(
      NULLIF(pg_catalog.btrim(v_file_name), ''),
      NULLIF(pg_catalog.btrim(asset.title), ''),
      NULLIF(pg_catalog.btrim(asset.description), ''),
      ''
    )),
    library_sort_size_bytes = v_size_bytes,
    library_search_text = pg_catalog.lower(pg_catalog.concat_ws(
      ' ',
      v_file_name,
      asset.title,
      asset.description,
      asset.category,
      asset.product_type,
      asset.space_type,
      asset.region,
      asset.usage_purpose,
      v_tag_text
    ))
  WHERE asset.id = p_asset_id;
END;
$$;

CREATE OR REPLACE FUNCTION showroom.refresh_content_asset_library_projection_from_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM showroom.refresh_content_asset_library_projection(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION showroom.refresh_content_asset_library_projection_from_file()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM showroom.refresh_content_asset_library_projection(CASE WHEN TG_OP = 'DELETE' THEN OLD.asset_id ELSE NEW.asset_id END);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION showroom.refresh_content_asset_library_projection_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM showroom.refresh_content_asset_library_projection(CASE WHEN TG_OP = 'DELETE' THEN OLD.asset_id ELSE NEW.asset_id END);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION showroom.refresh_content_asset_library_projection_from_tag_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM showroom.refresh_content_asset_library_projection(CASE WHEN TG_OP = 'DELETE' THEN OLD.asset_id ELSE NEW.asset_id END);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION showroom.refresh_content_asset_library_projection_from_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tag_id UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  v_asset_id UUID;
BEGIN
  FOR v_asset_id IN
    SELECT link.asset_id
    FROM showroom.content_asset_tag_links AS link
    WHERE link.tag_id = v_tag_id
  LOOP
    PERFORM showroom.refresh_content_asset_library_projection(v_asset_id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS refresh_content_asset_library_projection_asset ON showroom.content_assets;
CREATE TRIGGER refresh_content_asset_library_projection_asset
AFTER INSERT OR UPDATE OF title, description, category, product_type, space_type, region, usage_purpose
ON showroom.content_assets
FOR EACH ROW EXECUTE FUNCTION showroom.refresh_content_asset_library_projection_from_asset();

DROP TRIGGER IF EXISTS refresh_content_asset_library_projection_file ON showroom.content_asset_files;
CREATE TRIGGER refresh_content_asset_library_projection_file
AFTER INSERT OR UPDATE OF file_role, size_bytes OR DELETE
ON showroom.content_asset_files
FOR EACH ROW EXECUTE FUNCTION showroom.refresh_content_asset_library_projection_from_file();

DROP TRIGGER IF EXISTS refresh_content_asset_library_projection_event ON showroom.content_asset_events;
CREATE TRIGGER refresh_content_asset_library_projection_event
AFTER INSERT OR UPDATE OF event_type, metadata OR DELETE
ON showroom.content_asset_events
FOR EACH ROW EXECUTE FUNCTION showroom.refresh_content_asset_library_projection_from_event();

DROP TRIGGER IF EXISTS refresh_content_asset_library_projection_tag_link ON showroom.content_asset_tag_links;
CREATE TRIGGER refresh_content_asset_library_projection_tag_link
AFTER INSERT OR UPDATE OF asset_id, tag_id OR DELETE
ON showroom.content_asset_tag_links
FOR EACH ROW EXECUTE FUNCTION showroom.refresh_content_asset_library_projection_from_tag_link();

DROP TRIGGER IF EXISTS refresh_content_asset_library_projection_tag ON showroom.content_asset_tags;
CREATE TRIGGER refresh_content_asset_library_projection_tag
AFTER UPDATE OF name OR DELETE
ON showroom.content_asset_tags
FOR EACH ROW EXECUTE FUNCTION showroom.refresh_content_asset_library_projection_from_tag();

SELECT showroom.refresh_content_asset_library_projection(asset.id)
FROM showroom.content_assets AS asset;

CREATE INDEX IF NOT EXISTS content_assets_library_created_asc_idx
  ON showroom.content_assets(library_state, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS content_assets_library_created_desc_idx
  ON showroom.content_assets(library_state, created_at DESC, id ASC);
CREATE INDEX IF NOT EXISTS content_assets_library_name_asc_idx
  ON showroom.content_assets(library_state, library_sort_name ASC, id ASC);
CREATE INDEX IF NOT EXISTS content_assets_library_name_desc_idx
  ON showroom.content_assets(library_state, library_sort_name DESC, id ASC);
CREATE INDEX IF NOT EXISTS content_assets_library_size_asc_idx
  ON showroom.content_assets(library_state, library_sort_size_bytes ASC, id ASC);
CREATE INDEX IF NOT EXISTS content_assets_library_size_desc_idx
  ON showroom.content_assets(library_state, library_sort_size_bytes DESC, id ASC);

-- The normal admin view includes available and hidden assets. Partial indexes
-- let its deterministic page order stay index-backed without a leading
-- inequality over library_state; the six state-leading indexes above retain
-- the archive-view path.
CREATE INDEX IF NOT EXISTS content_assets_library_active_created_asc_idx
  ON showroom.content_assets(created_at ASC, id ASC)
  WHERE library_state <> 'archived'::showroom.content_asset_library_state;
CREATE INDEX IF NOT EXISTS content_assets_library_active_created_desc_idx
  ON showroom.content_assets(created_at DESC, id ASC)
  WHERE library_state <> 'archived'::showroom.content_asset_library_state;
CREATE INDEX IF NOT EXISTS content_assets_library_active_name_asc_idx
  ON showroom.content_assets(library_sort_name ASC, id ASC)
  WHERE library_state <> 'archived'::showroom.content_asset_library_state;
CREATE INDEX IF NOT EXISTS content_assets_library_active_name_desc_idx
  ON showroom.content_assets(library_sort_name DESC, id ASC)
  WHERE library_state <> 'archived'::showroom.content_asset_library_state;
CREATE INDEX IF NOT EXISTS content_assets_library_active_size_asc_idx
  ON showroom.content_assets(library_sort_size_bytes ASC, id ASC)
  WHERE library_state <> 'archived'::showroom.content_asset_library_state;
CREATE INDEX IF NOT EXISTS content_assets_library_active_size_desc_idx
  ON showroom.content_assets(library_sort_size_bytes DESC, id ASC)
  WHERE library_state <> 'archived'::showroom.content_asset_library_state;
CREATE INDEX IF NOT EXISTS content_asset_tag_links_tag_asset_idx
  ON showroom.content_asset_tag_links(tag_id, asset_id);
CREATE INDEX IF NOT EXISTS content_asset_events_library_projection_idx
  ON showroom.content_asset_events(asset_id, event_type, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS content_asset_files_library_projection_idx
  ON showroom.content_asset_files(asset_id, file_role, size_bytes DESC);

-- pg_trgm is available on Supabase. PGlite does not ship every PostgreSQL
-- extension, so its local contract run intentionally skips only this optional
-- physical index; query semantics remain identical and isolated Supabase must
-- verify the actual plan before Ready.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm is unavailable in this migration runtime; search index is deferred to a Supabase PostgreSQL runtime';
  END;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS content_assets_library_search_trgm_idx ON showroom.content_assets USING GIN (library_search_text gin_trgm_ops)';
  END IF;
END;
$$;

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
  sort_size_bytes BIGINT,
  category TEXT,
  product_type TEXT,
  space_type TEXT,
  region TEXT,
  usage_purpose TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    asset.id AS asset_id,
    asset.created_at,
    asset.library_sort_name AS sort_name,
    asset.library_sort_size_bytes AS sort_size_bytes,
    asset.category,
    asset.product_type,
    asset.space_type,
    asset.region,
    asset.usage_purpose
  FROM showroom.content_assets AS asset
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
      OR asset.library_search_text ILIKE '%' || pg_catalog.lower(pg_catalog.btrim(p_search)) || '%'
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
  v_order_by TEXT;
  v_page_asset_ids JSONB;
  v_result JSONB;
BEGIN
  IF p_view NOT IN ('active', 'archived') THEN
    RAISE EXCEPTION 'unsupported asset library view';
  END IF;
  IF p_sort NOT IN ('newest', 'oldest', 'nameAsc', 'nameDesc', 'sizeDesc', 'sizeAsc') THEN
    RAISE EXCEPTION 'unsupported asset library sort';
  END IF;

  v_offset := (v_page - 1) * v_page_size;
  v_order_by := CASE p_sort
    WHEN 'newest' THEN 'created_at DESC NULLS LAST, asset_id ASC'
    WHEN 'oldest' THEN 'created_at ASC NULLS LAST, asset_id ASC'
    WHEN 'nameAsc' THEN 'sort_name ASC NULLS LAST, asset_id ASC'
    WHEN 'nameDesc' THEN 'sort_name DESC NULLS LAST, asset_id ASC'
    WHEN 'sizeDesc' THEN 'sort_size_bytes DESC NULLS LAST, asset_id ASC'
    WHEN 'sizeAsc' THEN 'sort_size_bytes ASC NULLS LAST, asset_id ASC'
  END;

  EXECUTE pg_catalog.format(
    'SELECT COALESCE(pg_catalog.to_jsonb(ARRAY(SELECT source.asset_id FROM showroom.content_asset_library_matching_ids($1,$2,$3,$4,$5,$6,$7,$8) AS source ORDER BY %s LIMIT $9 OFFSET $10)), ''[]''::JSONB)',
    v_order_by
  )
  INTO v_page_asset_ids
  USING
    NULLIF(pg_catalog.btrim(p_search), ''),
    p_view,
    NULLIF(pg_catalog.btrim(p_category), ''),
    NULLIF(pg_catalog.btrim(p_product_type), ''),
    NULLIF(pg_catalog.btrim(p_space_type), ''),
    NULLIF(pg_catalog.btrim(p_region), ''),
    NULLIF(pg_catalog.btrim(p_usage_purpose), ''),
    p_tag_id,
    v_page_size,
    v_offset;

  WITH matching AS MATERIALIZED (
    SELECT *
    FROM showroom.content_asset_library_matching_ids(
      NULLIF(pg_catalog.btrim(p_search), ''), p_view,
      NULLIF(pg_catalog.btrim(p_category), ''), NULLIF(pg_catalog.btrim(p_product_type), ''),
      NULLIF(pg_catalog.btrim(p_space_type), ''), NULLIF(pg_catalog.btrim(p_region), ''),
      NULLIF(pg_catalog.btrim(p_usage_purpose), ''), p_tag_id
    )
  ),
  facet_values AS (
    SELECT DISTINCT facet.name, facet.value
    FROM matching
    CROSS JOIN LATERAL (VALUES
      ('categories'::TEXT, matching.category),
      ('productTypes'::TEXT, matching.product_type),
      ('spaceTypes'::TEXT, matching.space_type),
      ('regions'::TEXT, matching.region),
      ('usagePurposes'::TEXT, matching.usage_purpose)
    ) AS facet(name, value)
    WHERE facet.value IS NOT NULL AND pg_catalog.btrim(facet.value) <> ''
  ),
  facets AS (
    SELECT COALESCE(pg_catalog.jsonb_object_agg(grouped.name, grouped.values), '{}'::JSONB) AS value
    FROM (
      SELECT name, pg_catalog.jsonb_agg(value ORDER BY value) AS values
      FROM facet_values
      GROUP BY name
    ) AS grouped
  ),
  tag_facets AS (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', tag.id, 'name', tag.name) ORDER BY tag.name, tag.id), '[]'::JSONB) AS value
    FROM (
      SELECT DISTINCT link.tag_id
      FROM matching
      JOIN showroom.content_asset_tag_links AS link ON link.asset_id = matching.asset_id
    ) AS matching_tags
    JOIN showroom.content_asset_tags AS tag ON tag.id = matching_tags.tag_id
  )
  SELECT pg_catalog.jsonb_build_object(
    'assetIds', v_page_asset_ids,
    'totalCount', (SELECT COUNT(*) FROM matching),
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', greatest(1, ceil((SELECT COUNT(*) FROM matching)::NUMERIC / v_page_size)::INTEGER),
    'facets', (SELECT facets.value || pg_catalog.jsonb_build_object('tags', tag_facets.value) FROM facets, tag_facets)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION showroom.prepare_content_asset_search_results_selection(
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
BEGIN
  IF p_view NOT IN ('active', 'archived') OR p_sort NOT IN ('newest', 'oldest', 'nameAsc', 'nameDesc', 'sizeDesc', 'sizeAsc') THEN
    RAISE EXCEPTION 'unsupported asset library selection query';
  END IF;

  RETURN (
    WITH matching AS MATERIALIZED (
      SELECT asset_id
      FROM showroom.content_asset_library_matching_ids(
        NULLIF(pg_catalog.btrim(p_search), ''), p_view,
        NULLIF(pg_catalog.btrim(p_category), ''), NULLIF(pg_catalog.btrim(p_product_type), ''),
        NULLIF(pg_catalog.btrim(p_space_type), ''), NULLIF(pg_catalog.btrim(p_region), ''),
        NULLIF(pg_catalog.btrim(p_usage_purpose), ''), p_tag_id
      )
    )
    SELECT pg_catalog.jsonb_build_object(
      'totalCount', COUNT(*),
      'selectionToken', pg_catalog.md5(COALESCE(pg_catalog.string_agg(asset_id::TEXT, ',' ORDER BY asset_id), ''))
    )
    FROM matching
  );
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

  SELECT COALESCE(pg_catalog.array_agg(matching.asset_id ORDER BY matching.asset_id), ARRAY[]::UUID[])
  INTO v_asset_ids
  FROM showroom.content_asset_library_matching_ids(
    NULLIF(pg_catalog.btrim(p_search), ''), p_view,
    NULLIF(pg_catalog.btrim(p_category), ''), NULLIF(pg_catalog.btrim(p_product_type), ''),
    NULLIF(pg_catalog.btrim(p_space_type), ''), NULLIF(pg_catalog.btrim(p_region), ''),
    NULLIF(pg_catalog.btrim(p_usage_purpose), ''), p_tag_id
  ) AS matching;

  v_current_count := pg_catalog.cardinality(v_asset_ids);
  v_current_token := pg_catalog.md5(COALESCE(pg_catalog.array_to_string(v_asset_ids, ','), ''));
  IF p_expected_count < 1
    OR v_current_count <> p_expected_count
    OR v_current_token IS DISTINCT FROM p_expected_token
  THEN
    RETURN pg_catalog.jsonb_build_object(
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

  RETURN pg_catalog.jsonb_build_object(
    'ok', TRUE,
    'reason', CASE WHEN p_restore THEN 'restored' ELSE 'archived' END,
    'expectedCount', p_expected_count,
    'currentCount', v_current_count,
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION showroom.refresh_content_asset_library_projection(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.refresh_content_asset_library_projection(UUID) TO service_role;
REVOKE ALL ON FUNCTION showroom.refresh_content_asset_library_projection_from_asset() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.refresh_content_asset_library_projection_from_asset() TO service_role;
REVOKE ALL ON FUNCTION showroom.refresh_content_asset_library_projection_from_file() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.refresh_content_asset_library_projection_from_file() TO service_role;
REVOKE ALL ON FUNCTION showroom.refresh_content_asset_library_projection_from_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.refresh_content_asset_library_projection_from_event() TO service_role;
REVOKE ALL ON FUNCTION showroom.refresh_content_asset_library_projection_from_tag_link() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.refresh_content_asset_library_projection_from_tag_link() TO service_role;
REVOKE ALL ON FUNCTION showroom.refresh_content_asset_library_projection_from_tag() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.refresh_content_asset_library_projection_from_tag() TO service_role;
REVOKE ALL ON FUNCTION showroom.content_asset_library_matching_ids(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.content_asset_library_matching_ids(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION showroom.list_content_assets_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.list_content_assets_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION showroom.prepare_content_asset_search_results_selection(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.prepare_content_asset_search_results_selection(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION showroom.archive_content_asset_search_results_safely(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BIGINT, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.archive_content_asset_search_results_safely(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BIGINT, TEXT, UUID, BOOLEAN) TO service_role;

COMMENT ON FUNCTION showroom.list_content_assets_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER)
IS 'Service-role-only complete-dataset search, scoped facets, indexed deterministic pages, exact count, and bounded pagination for the admin asset library.';
COMMENT ON FUNCTION showroom.prepare_content_asset_search_results_selection(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER)
IS 'Computes the exact count and membership token only after an administrator explicitly selects every matching result.';

NOTIFY pgrst, 'reload schema';
