DROP POLICY IF EXISTS auth_all_nodes ON showroom.nodes;
DROP POLICY IF EXISTS auth_all_hero_media ON showroom.hero_media;
DROP POLICY IF EXISTS auth_all_gallery_photos ON showroom.gallery_photos;

CREATE POLICY authenticated_read_nodes
ON showroom.nodes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY administrator_write_nodes
ON showroom.nodes
FOR ALL
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

CREATE POLICY authenticated_read_hero_media
ON showroom.hero_media
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY administrator_write_hero_media
ON showroom.hero_media
FOR ALL
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

CREATE POLICY authenticated_read_gallery_photos
ON showroom.gallery_photos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY administrator_write_gallery_photos
ON showroom.gallery_photos
FOR ALL
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

CREATE OR REPLACE FUNCTION showroom.save_node(
  p_node_id UUID,
  p_node JSONB,
  p_hero_media JSONB,
  p_gallery_photos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = showroom, pg_temp
AS $$
DECLARE
  v_type TEXT;
  v_name TEXT;
  v_slug TEXT;
  v_status TEXT;
  v_card_position TEXT;
  v_transition TEXT;
  v_slide_interval INTEGER;
  v_hero_count INTEGER;
  v_gallery_count INTEGER;
  v_saved_id UUID;
  v_existing_slug TEXT;
  v_parent_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = auth.uid()
      AND profile.role::TEXT = 'administrator'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'administrator role is required';
  END IF;

  IF p_node_id IS NULL THEN
    RAISE EXCEPTION 'node id is required';
  END IF;

  IF p_node IS NULL OR jsonb_typeof(p_node) <> 'object' THEN
    RAISE EXCEPTION 'node payload must be an object';
  END IF;

  IF p_hero_media IS NULL OR jsonb_typeof(p_hero_media) <> 'array' THEN
    RAISE EXCEPTION 'hero media payload must be an array';
  END IF;

  IF p_gallery_photos IS NULL OR jsonb_typeof(p_gallery_photos) <> 'array' THEN
    RAISE EXCEPTION 'gallery photos payload must be an array';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_node) AS field(key)
    WHERE field.key NOT IN (
      'name', 'slug', 'card_subtitle', 'card_text_position', 'status', 'type',
      'image_url', 'hero_enabled', 'hero_video_url', 'hero_mobile_video_url',
      'hero_title', 'hero_subtitle', 'hero_description', 'hero_slide_interval',
      'hero_slide_transition', 'tagline', 'description'
    )
  ) THEN
    RAISE EXCEPTION 'node payload contains unsupported fields';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_node) AS field(key, value)
    WHERE field.key IN (
      'name', 'slug', 'card_subtitle', 'card_text_position', 'status', 'type',
      'image_url', 'hero_video_url', 'hero_mobile_video_url', 'hero_title',
      'hero_subtitle', 'hero_description', 'hero_slide_transition', 'tagline', 'description'
    )
      AND jsonb_typeof(field.value) NOT IN ('string', 'null')
  ) THEN
    RAISE EXCEPTION 'node text fields must be strings or null';
  END IF;

  IF jsonb_typeof(p_node -> 'hero_enabled') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'hero_enabled must be a boolean';
  END IF;

  IF jsonb_typeof(p_node -> 'hero_slide_interval') IS DISTINCT FROM 'number'
    OR (p_node ->> 'hero_slide_interval') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'hero_slide_interval must be an integer';
  END IF;

  v_name := NULLIF(btrim(p_node ->> 'name'), '');
  v_slug := NULLIF(btrim(p_node ->> 'slug'), '');
  v_type := p_node ->> 'type';
  v_status := p_node ->> 'status';
  v_card_position := p_node ->> 'card_text_position';
  v_transition := p_node ->> 'hero_slide_transition';
  v_slide_interval := (p_node ->> 'hero_slide_interval')::INTEGER;
  v_hero_count := jsonb_array_length(p_hero_media);
  v_gallery_count := jsonb_array_length(p_gallery_photos);

  IF v_name IS NULL OR length(v_name) > 200 THEN
    RAISE EXCEPTION 'node name is required and cannot exceed 200 characters';
  END IF;

  IF v_slug IS NULL OR length(v_slug) > 200
    OR v_slug !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'node slug is invalid';
  END IF;

  IF v_type IS NULL OR v_type NOT IN ('listing', 'detail') THEN
    RAISE EXCEPTION 'node type is invalid';
  END IF;

  IF v_status IS NULL OR v_status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'node status is invalid';
  END IF;

  IF v_card_position IS NULL OR v_card_position NOT IN ('overlay', 'below') THEN
    RAISE EXCEPTION 'card_text_position is invalid';
  END IF;

  IF v_transition IS NULL OR v_transition NOT IN ('fade', 'slide') THEN
    RAISE EXCEPTION 'hero_slide_transition is invalid';
  END IF;

  IF v_slide_interval < 1 OR v_slide_interval > 60 THEN
    RAISE EXCEPTION 'hero_slide_interval must be between 1 and 60';
  END IF;

  IF v_hero_count > 20 THEN
    RAISE EXCEPTION 'hero media cannot exceed 20 items';
  END IF;

  IF v_gallery_count > 50 THEN
    RAISE EXCEPTION 'gallery photos cannot exceed 50 items';
  END IF;

  IF length(COALESCE(p_node ->> 'card_subtitle', '')) > 500
    OR length(COALESCE(p_node ->> 'hero_title', '')) > 300
    OR length(COALESCE(p_node ->> 'hero_subtitle', '')) > 500
    OR length(COALESCE(p_node ->> 'hero_description', '')) > 5000
    OR length(COALESCE(p_node ->> 'tagline', '')) > 500
    OR length(COALESCE(p_node ->> 'description', '')) > 20000 THEN
    RAISE EXCEPTION 'node text exceeds the allowed length';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      NULLIF(btrim(p_node ->> 'image_url'), ''),
      NULLIF(btrim(p_node ->> 'hero_video_url'), ''),
      NULLIF(btrim(p_node ->> 'hero_mobile_video_url'), '')
    ]) AS candidate(url)
    WHERE candidate.url IS NOT NULL
      AND (length(candidate.url) > 2048 OR candidate.url !~ '^https?://')
  ) THEN
    RAISE EXCEPTION 'node media URLs must be absolute HTTP(S) URLs';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_hero_media) AS media(item)
    WHERE jsonb_typeof(media.item) <> 'object'
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(media.item) AS field(key)
        WHERE field.key NOT IN ('image_url', 'device_type', 'media_type', 'display_order')
      )
      OR NULLIF(btrim(media.item ->> 'image_url'), '') IS NULL
      OR length(media.item ->> 'image_url') > 2048
      OR media.item ->> 'image_url' !~ '^https?://'
      OR media.item ->> 'device_type' NOT IN ('desktop', 'mobile')
      OR media.item ->> 'media_type' NOT IN ('image', 'video')
  ) THEN
    RAISE EXCEPTION 'hero media payload is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_gallery_photos) AS photo(item)
    WHERE jsonb_typeof(photo.item) <> 'object'
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(photo.item) AS field(key)
        WHERE field.key NOT IN ('image_url', 'caption', 'display_order')
      )
      OR NULLIF(btrim(photo.item ->> 'image_url'), '') IS NULL
      OR length(photo.item ->> 'image_url') > 2048
      OR photo.item ->> 'image_url' !~ '^https?://'
      OR length(COALESCE(photo.item ->> 'caption', '')) > 1000
      OR (photo.item ? 'caption' AND jsonb_typeof(photo.item -> 'caption') NOT IN ('string', 'null'))
  ) THEN
    RAISE EXCEPTION 'gallery photo payload is invalid';
  END IF;

  SELECT existing.slug, existing.parent_id
  INTO v_existing_slug, v_parent_id
  FROM showroom.nodes AS existing
  WHERE existing.id = p_node_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'node not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM showroom.nodes AS child
    WHERE child.parent_id = p_node_id
  ) AND v_type = 'detail' THEN
    RAISE EXCEPTION 'a node with children cannot be converted to detail';
  END IF;

  IF v_slug <> v_existing_slug THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'showroom.nodes.slug:' || COALESCE(v_parent_id::TEXT, 'root') || ':' || v_slug,
      0
    ));
  END IF;

  IF v_slug <> v_existing_slug AND EXISTS (
    SELECT 1
    FROM showroom.nodes AS sibling
    WHERE sibling.slug = v_slug
      AND sibling.parent_id IS NOT DISTINCT FROM v_parent_id
      AND sibling.id <> p_node_id
  ) THEN
    RAISE EXCEPTION 'another node already uses this slug';
  END IF;

  UPDATE showroom.nodes SET
    name = v_name,
    slug = v_slug,
    card_subtitle = NULLIF(btrim(p_node ->> 'card_subtitle'), ''),
    card_text_position = v_card_position,
    status = v_status,
    type = v_type,
    image_url = NULLIF(btrim(p_node ->> 'image_url'), ''),
    hero_enabled = (p_node ->> 'hero_enabled')::BOOLEAN,
    hero_video_url = NULLIF(btrim(p_node ->> 'hero_video_url'), ''),
    hero_mobile_video_url = NULLIF(btrim(p_node ->> 'hero_mobile_video_url'), ''),
    hero_title = NULLIF(btrim(p_node ->> 'hero_title'), ''),
    hero_subtitle = NULLIF(btrim(p_node ->> 'hero_subtitle'), ''),
    hero_description = NULLIF(btrim(p_node ->> 'hero_description'), ''),
    hero_slide_interval = v_slide_interval,
    hero_slide_transition = v_transition,
    tagline = NULLIF(btrim(p_node ->> 'tagline'), ''),
    description = NULLIF(btrim(p_node ->> 'description'), ''),
    updated_at = now()
  WHERE id = p_node_id
  RETURNING id INTO v_saved_id;

  DELETE FROM showroom.hero_media WHERE node_id = p_node_id;
  DELETE FROM showroom.gallery_photos WHERE node_id = p_node_id;

  INSERT INTO showroom.hero_media (node_id, image_url, device_type, media_type, display_order)
  SELECT
    p_node_id,
    media.item ->> 'image_url',
    media.item ->> 'device_type',
    media.item ->> 'media_type',
    (media.ordinality - 1)::INTEGER
  FROM jsonb_array_elements(p_hero_media) WITH ORDINALITY AS media(item, ordinality);

  INSERT INTO showroom.gallery_photos (node_id, image_url, caption, display_order)
  SELECT
    p_node_id,
    photo.item ->> 'image_url',
    NULLIF(btrim(photo.item ->> 'caption'), ''),
    (photo.ordinality - 1)::INTEGER
  FROM jsonb_array_elements(p_gallery_photos) WITH ORDINALITY AS photo(item, ordinality);

  RETURN jsonb_build_object(
    'node_id', v_saved_id,
    'hero_media_count', v_hero_count,
    'gallery_photo_count', v_gallery_count
  );
END;
$$;

REVOKE ALL ON FUNCTION showroom.save_node(UUID, JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION showroom.save_node(UUID, JSONB, JSONB, JSONB) FROM anon;
REVOKE ALL ON FUNCTION showroom.save_node(UUID, JSONB, JSONB, JSONB) FROM service_role;
GRANT EXECUTE ON FUNCTION showroom.save_node(UUID, JSONB, JSONB, JSONB) TO authenticated;
