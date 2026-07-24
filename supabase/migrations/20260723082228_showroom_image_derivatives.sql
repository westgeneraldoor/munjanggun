-- Stored showroom image derivatives.
-- Existing source URLs remain canonical and no Storage object is deleted here.

CREATE TABLE showroom.image_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_bucket TEXT NOT NULL,
  source_object_path TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_mime_type TEXT NOT NULL,
  source_size_bytes BIGINT NOT NULL,
  source_width INTEGER NOT NULL,
  source_height INTEGER NOT NULL,
  source_checksum_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT image_sources_object_unique UNIQUE (source_bucket, source_object_path),
  CONSTRAINT image_sources_bucket_not_blank CHECK (length(btrim(source_bucket)) > 0),
  CONSTRAINT image_sources_path_not_blank CHECK (length(btrim(source_object_path)) > 0),
  CONSTRAINT image_sources_url_http CHECK (source_url ~ '^https://'),
  CONSTRAINT image_sources_size_positive CHECK (source_size_bytes > 0),
  CONSTRAINT image_sources_width_positive CHECK (source_width > 0),
  CONSTRAINT image_sources_height_positive CHECK (source_height > 0),
  CONSTRAINT image_sources_checksum_sha256 CHECK (source_checksum_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE TABLE showroom.image_derivatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES showroom.image_sources(id) ON DELETE RESTRICT,
  variant TEXT NOT NULL,
  recipe_version INTEGER NOT NULL,
  target_width INTEGER NOT NULL,
  transform_status TEXT NOT NULL,
  skip_reason TEXT,
  derivative_bucket TEXT,
  derivative_object_path TEXT,
  public_url TEXT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  size_bytes BIGINT,
  checksum_sha256 TEXT,
  transform_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT image_derivatives_source_variant_recipe_unique UNIQUE (source_id, variant, recipe_version),
  CONSTRAINT image_derivatives_variant_check
    CHECK (variant IN ('thumbnail', 'card', 'display', 'large')),
  CONSTRAINT image_derivatives_status_check
    CHECK (transform_status IN ('ready', 'skipped', 'failed')),
  CONSTRAINT image_derivatives_recipe_positive CHECK (recipe_version > 0),
  CONSTRAINT image_derivatives_target_width_positive CHECK (target_width > 0),
  CONSTRAINT image_derivatives_width_positive CHECK (width IS NULL OR width > 0),
  CONSTRAINT image_derivatives_height_positive CHECK (height IS NULL OR height > 0),
  CONSTRAINT image_derivatives_size_positive CHECK (size_bytes IS NULL OR size_bytes > 0),
  CONSTRAINT image_derivatives_checksum_sha256 CHECK (
    checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT image_derivatives_ready_shape CHECK (
    transform_status <> 'ready'
    OR (
      skip_reason IS NULL
      AND derivative_bucket IS NOT NULL
      AND derivative_object_path IS NOT NULL
      AND public_url IS NOT NULL
      AND public_url ~ '^https://'
      AND mime_type IS NOT NULL
      AND mime_type = 'image/webp'
      AND width IS NOT NULL
      AND height IS NOT NULL
      AND size_bytes IS NOT NULL
      AND checksum_sha256 IS NOT NULL
      AND transform_error IS NULL
    )
  ),
  CONSTRAINT image_derivatives_skipped_shape CHECK (
    transform_status <> 'skipped'
    OR (
      skip_reason IS NOT NULL
      AND skip_reason IN ('no-upscale', 'not-smaller', 'animated-or-gif')
      AND derivative_bucket IS NULL
      AND derivative_object_path IS NULL
      AND public_url IS NULL
      AND mime_type IS NULL
      AND width IS NULL
      AND height IS NULL
      AND size_bytes IS NULL
      AND checksum_sha256 IS NULL
      AND transform_error IS NULL
    )
  ),
  CONSTRAINT image_derivatives_failed_shape CHECK (
    transform_status <> 'failed'
    OR (
      transform_error IS NOT NULL
      AND length(btrim(transform_error)) > 0
      AND derivative_bucket IS NULL
      AND derivative_object_path IS NULL
      AND public_url IS NULL
    )
  )
);

CREATE INDEX image_derivatives_ready_source_idx
  ON showroom.image_derivatives(source_id, variant, recipe_version)
  WHERE transform_status = 'ready';

CREATE INDEX image_derivatives_object_idx
  ON showroom.image_derivatives(derivative_bucket, derivative_object_path)
  WHERE derivative_bucket IS NOT NULL AND derivative_object_path IS NOT NULL;

CREATE INDEX image_sources_url_idx ON showroom.image_sources(source_url);

CREATE OR REPLACE TRIGGER set_timestamp_image_sources
BEFORE UPDATE ON showroom.image_sources
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

CREATE OR REPLACE TRIGGER set_timestamp_image_derivatives
BEFORE UPDATE ON showroom.image_derivatives
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

ALTER TABLE showroom.image_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.image_derivatives ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON showroom.image_sources FROM PUBLIC, anon, authenticated;
REVOKE ALL ON showroom.image_derivatives FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_public_showroom_image_url(p_source_url TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM showroom.nodes AS node
      WHERE node.image_url = p_source_url
        AND node.status = 'published'
        AND private.is_node_visible(node.id)
    )
    OR EXISTS (
      SELECT 1
      FROM showroom.hero_media AS media
      WHERE media.image_url = p_source_url
        AND private.is_node_visible(media.node_id)
    )
    OR EXISTS (
      SELECT 1
      FROM showroom.gallery_photos AS photo
      WHERE photo.image_url = p_source_url
        AND private.is_node_visible(photo.node_id)
    )
    OR EXISTS (
      SELECT 1
      FROM showroom.site_hero_media AS media
      WHERE media.image_url = p_source_url
    )
    OR EXISTS (
      SELECT 1
      FROM showroom.site_settings AS settings
      WHERE settings.og_image_url = p_source_url
    );
$$;

REVOKE ALL ON FUNCTION private.is_public_showroom_image_url(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_public_showroom_image_url(TEXT) TO anon, authenticated;

CREATE POLICY image_sources_anon_select
ON showroom.image_sources
FOR SELECT
TO anon
USING (private.is_public_showroom_image_url(source_url));

CREATE POLICY image_sources_authenticated_select
ON showroom.image_sources
FOR SELECT
TO authenticated
USING (
  (SELECT platform_private.is_admin())
  OR private.is_public_showroom_image_url(source_url)
);

CREATE POLICY image_derivatives_anon_select
ON showroom.image_derivatives
FOR SELECT
TO anon
USING (
  transform_status = 'ready'
  AND EXISTS (
    SELECT 1
    FROM showroom.image_sources AS source
    WHERE source.id = source_id
      AND private.is_public_showroom_image_url(source.source_url)
  )
);

CREATE POLICY image_derivatives_authenticated_select
ON showroom.image_derivatives
FOR SELECT
TO authenticated
USING (
  (SELECT platform_private.is_admin())
  OR (
    transform_status = 'ready'
    AND EXISTS (
      SELECT 1
      FROM showroom.image_sources AS source
      WHERE source.id = source_id
        AND private.is_public_showroom_image_url(source.source_url)
    )
  )
);

GRANT SELECT (id, source_url) ON showroom.image_sources TO anon;
GRANT SELECT (id, source_url) ON showroom.image_sources TO authenticated;
GRANT SELECT (
  id,
  source_id,
  variant,
  recipe_version,
  target_width,
  public_url,
  mime_type,
  width,
  height,
  size_bytes
) ON showroom.image_derivatives TO anon;
GRANT SELECT (
  id,
  source_id,
  variant,
  recipe_version,
  target_width,
  public_url,
  mime_type,
  width,
  height,
  size_bytes
) ON showroom.image_derivatives TO authenticated;

GRANT SELECT, INSERT, UPDATE ON showroom.image_sources TO service_role;
GRANT SELECT, INSERT, UPDATE ON showroom.image_derivatives TO service_role;

CREATE OR REPLACE FUNCTION showroom.commit_image_derivatives(
  p_source JSONB,
  p_derivatives JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source_id UUID;
  v_item JSONB;
  v_variant TEXT;
  v_status TEXT;
BEGIN
  IF p_source IS NULL OR jsonb_typeof(p_source) <> 'object' THEN
    RAISE EXCEPTION 'source payload must be an object';
  END IF;

  IF p_derivatives IS NULL
    OR jsonb_typeof(p_derivatives) <> 'array'
    OR jsonb_array_length(p_derivatives) <> 4
    OR (
      SELECT count(DISTINCT item ->> 'variant')
      FROM jsonb_array_elements(p_derivatives) AS item
    ) <> 4
  THEN
    RAISE EXCEPTION 'exactly four unique derivative variants are required';
  END IF;

  INSERT INTO showroom.image_sources (
    source_bucket,
    source_object_path,
    source_url,
    source_mime_type,
    source_size_bytes,
    source_width,
    source_height,
    source_checksum_sha256,
    last_verified_at
  )
  VALUES (
    p_source ->> 'source_bucket',
    p_source ->> 'source_object_path',
    p_source ->> 'source_url',
    p_source ->> 'source_mime_type',
    (p_source ->> 'source_size_bytes')::BIGINT,
    (p_source ->> 'source_width')::INTEGER,
    (p_source ->> 'source_height')::INTEGER,
    p_source ->> 'source_checksum_sha256',
    NOW()
  )
  ON CONFLICT (source_bucket, source_object_path)
  DO UPDATE SET
    source_url = EXCLUDED.source_url,
    source_mime_type = EXCLUDED.source_mime_type,
    source_size_bytes = EXCLUDED.source_size_bytes,
    source_width = EXCLUDED.source_width,
    source_height = EXCLUDED.source_height,
    last_verified_at = NOW()
  WHERE showroom.image_sources.source_checksum_sha256 = EXCLUDED.source_checksum_sha256
  RETURNING id INTO v_source_id;

  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'source object checksum changed at the same bucket/path';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_derivatives)
  LOOP
    v_variant := v_item ->> 'variant';
    v_status := v_item ->> 'transform_status';

    IF v_variant NOT IN ('thumbnail', 'card', 'display', 'large')
      OR v_status NOT IN ('ready', 'skipped', 'failed')
    THEN
      RAISE EXCEPTION 'invalid derivative variant or status';
    END IF;

    INSERT INTO showroom.image_derivatives (
      source_id,
      variant,
      recipe_version,
      target_width,
      transform_status,
      skip_reason,
      derivative_bucket,
      derivative_object_path,
      public_url,
      mime_type,
      width,
      height,
      size_bytes,
      checksum_sha256,
      transform_error
    )
    VALUES (
      v_source_id,
      v_variant,
      (v_item ->> 'recipe_version')::INTEGER,
      (v_item ->> 'target_width')::INTEGER,
      v_status,
      NULLIF(v_item ->> 'skip_reason', ''),
      NULLIF(v_item ->> 'derivative_bucket', ''),
      NULLIF(v_item ->> 'derivative_object_path', ''),
      NULLIF(v_item ->> 'public_url', ''),
      NULLIF(v_item ->> 'mime_type', ''),
      NULLIF(v_item ->> 'width', '')::INTEGER,
      NULLIF(v_item ->> 'height', '')::INTEGER,
      NULLIF(v_item ->> 'size_bytes', '')::BIGINT,
      NULLIF(v_item ->> 'checksum_sha256', ''),
      NULLIF(v_item ->> 'transform_error', '')
    )
    ON CONFLICT (source_id, variant, recipe_version)
    DO UPDATE SET
      target_width = EXCLUDED.target_width,
      transform_status = CASE
        WHEN showroom.image_derivatives.transform_status = 'ready'
          AND EXCLUDED.transform_status <> 'ready'
          THEN showroom.image_derivatives.transform_status
        ELSE EXCLUDED.transform_status
      END,
      skip_reason = CASE
        WHEN showroom.image_derivatives.transform_status = 'ready'
          AND EXCLUDED.transform_status <> 'ready'
          THEN showroom.image_derivatives.skip_reason
        ELSE EXCLUDED.skip_reason
      END,
      derivative_bucket = COALESCE(EXCLUDED.derivative_bucket, showroom.image_derivatives.derivative_bucket),
      derivative_object_path = COALESCE(EXCLUDED.derivative_object_path, showroom.image_derivatives.derivative_object_path),
      public_url = COALESCE(EXCLUDED.public_url, showroom.image_derivatives.public_url),
      mime_type = COALESCE(EXCLUDED.mime_type, showroom.image_derivatives.mime_type),
      width = COALESCE(EXCLUDED.width, showroom.image_derivatives.width),
      height = COALESCE(EXCLUDED.height, showroom.image_derivatives.height),
      size_bytes = COALESCE(EXCLUDED.size_bytes, showroom.image_derivatives.size_bytes),
      checksum_sha256 = COALESCE(EXCLUDED.checksum_sha256, showroom.image_derivatives.checksum_sha256),
      transform_error = CASE
        WHEN showroom.image_derivatives.transform_status = 'ready'
          AND EXCLUDED.transform_status <> 'ready'
          THEN showroom.image_derivatives.transform_error
        ELSE EXCLUDED.transform_error
      END;
  END LOOP;

  RETURN v_source_id;
END;
$$;

REVOKE ALL ON FUNCTION showroom.commit_image_derivatives(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.commit_image_derivatives(JSONB, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION showroom.resolve_preview_image_derivatives(
  p_token TEXT,
  p_source_urls TEXT[]
)
RETURNS TABLE (
  source_url TEXT,
  variant TEXT,
  public_url TEXT,
  width INTEGER,
  height INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_source_urls IS NULL OR cardinality(p_source_urls) > 100 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    source.source_url,
    derivative.variant,
    derivative.public_url,
    derivative.width,
    derivative.height
  FROM showroom.preview_tokens AS token
  JOIN showroom.image_sources AS source
    ON source.source_url = ANY(p_source_urls)
  JOIN showroom.image_derivatives AS derivative
    ON derivative.source_id = source.id
   AND derivative.transform_status = 'ready'
   AND derivative.recipe_version = 1
  WHERE token.token = p_token
    AND token.expires_at > NOW()
    AND (
      EXISTS (
        SELECT 1
        FROM showroom.nodes AS node
        WHERE node.id = token.node_id
          AND node.image_url = source.source_url
      )
      OR EXISTS (
        SELECT 1
        FROM showroom.hero_media AS media
        WHERE media.node_id = token.node_id
          AND media.image_url = source.source_url
      )
      OR EXISTS (
        SELECT 1
        FROM showroom.gallery_photos AS photo
        WHERE photo.node_id = token.node_id
          AND photo.image_url = source.source_url
      )
      OR EXISTS (
        SELECT 1
        FROM showroom.nodes AS child
        WHERE child.parent_id = token.node_id
          AND child.image_url = source.source_url
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION showroom.resolve_preview_image_derivatives(TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION showroom.resolve_preview_image_derivatives(TEXT, TEXT[]) FROM authenticated;
REVOKE ALL ON FUNCTION showroom.resolve_preview_image_derivatives(TEXT, TEXT[]) FROM service_role;
GRANT EXECUTE ON FUNCTION showroom.resolve_preview_image_derivatives(TEXT, TEXT[]) TO anon;

COMMENT ON TABLE showroom.image_sources IS
  'Stable showroom image source ledger keyed by immutable Storage bucket and object path.';
COMMENT ON TABLE showroom.image_derivatives IS
  'Stored, recipe-versioned showroom image variants. Missing or skipped variants fall back to the source URL.';
COMMENT ON FUNCTION showroom.commit_image_derivatives(JSONB, JSONB) IS
  'Service-role-only atomic metadata commit. Storage objects are uploaded separately with upsert disabled.';
COMMENT ON FUNCTION showroom.resolve_preview_image_derivatives(TEXT, TEXT[]) IS
  'Intentional anon SECURITY DEFINER preview exception: returns ready recipe-versioned rows only for a valid unexpired token, at most 100 caller-supplied candidate URLs, and media owned by the token node (its node image, hero, gallery, or direct child node image); no broad lookup is permitted; execute is granted only to anon after revoking PUBLIC, authenticated, and service_role.';

NOTIFY pgrst, 'reload schema';
