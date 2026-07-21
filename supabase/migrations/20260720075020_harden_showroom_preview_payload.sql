-- A preview token is a 72-hour bearer capability. Anonymous callers may
-- exchange one exact UUID-shaped token for a narrow showroom payload, but may
-- not read or list the token table itself.
CREATE OR REPLACE FUNCTION showroom.get_preview_payload(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_node_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_node showroom.nodes%ROWTYPE;
BEGIN
  IF p_token IS NULL
    OR length(p_token) <> 36
    OR p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RETURN NULL;
  END IF;

  SELECT preview.node_id, preview.expires_at
  INTO v_node_id, v_expires_at
  FROM showroom.preview_tokens AS preview
  WHERE preview.token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object('expired', TRUE);
  END IF;

  SELECT node.*
  INTO v_node
  FROM showroom.nodes AS node
  WHERE node.id = v_node_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'expired', FALSE,
    'node', jsonb_build_object(
      'id', v_node.id,
      'type', v_node.type,
      'name', v_node.name,
      'status', v_node.status,
      'image_url', v_node.image_url,
      'tagline', v_node.tagline,
      'description', v_node.description
    ),
    'heroMedia', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', media.id,
            'image_url', media.image_url,
            'device_type', media.device_type,
            'media_type', media.media_type,
            'display_order', media.display_order
          ) ORDER BY media.display_order
        ),
        '[]'::JSONB
      )
      FROM showroom.hero_media AS media
      WHERE media.node_id = v_node.id
        AND v_node.type = 'listing'
    ),
    'childNodes', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', child.id,
            'name', child.name,
            'image_url', child.image_url
          ) ORDER BY child.display_order
        ),
        '[]'::JSONB
      )
      FROM showroom.nodes AS child
      WHERE child.parent_id = v_node.id
        AND v_node.type = 'listing'
    ),
    'galleryPhotos', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', photo.id,
            'image_url', photo.image_url,
            'caption', photo.caption,
            'display_order', photo.display_order
          ) ORDER BY photo.display_order
        ),
        '[]'::JSONB
      )
      FROM showroom.gallery_photos AS photo
      WHERE photo.node_id = v_node.id
        AND v_node.type = 'detail'
    )
  );
END;
$$;

DROP POLICY IF EXISTS anon_read_preview_tokens ON showroom.preview_tokens;
REVOKE ALL ON showroom.preview_tokens FROM anon;

REVOKE ALL ON FUNCTION showroom.get_preview_payload(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION showroom.get_preview_payload(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION showroom.get_preview_payload(TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION showroom.get_preview_payload(TEXT) TO anon;

COMMENT ON FUNCTION showroom.get_preview_payload(TEXT) IS
  'Anonymous exchange of one unexpired UUID-shaped preview token for an explicitly allowlisted showroom payload.';
