DROP POLICY IF EXISTS auth_all_site_settings ON showroom.site_settings;
DROP POLICY IF EXISTS auth_all_site_hero_media ON showroom.site_hero_media;

CREATE POLICY authenticated_read_site_settings
ON showroom.site_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY administrator_write_site_settings
ON showroom.site_settings
FOR ALL
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

CREATE POLICY authenticated_read_site_hero_media
ON showroom.site_hero_media
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY administrator_write_site_hero_media
ON showroom.site_hero_media
FOR ALL
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

CREATE OR REPLACE FUNCTION showroom.save_site_settings(p_settings JSONB, p_media JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = showroom, pg_temp
AS $$
DECLARE
  v_media_count INTEGER;
  v_slide_interval INTEGER;
  v_card_position TEXT;
  v_transition TEXT;
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

  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION 'settings payload must be an object';
  END IF;

  IF p_media IS NULL OR jsonb_typeof(p_media) <> 'array' THEN
    RAISE EXCEPTION 'media payload must be an array';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_settings) AS setting(key)
    WHERE setting.key NOT IN (
      'site_title',
      'site_description',
      'og_image_url',
      'reservation_url',
      'store_url',
      'hero_enabled',
      'hero_video_url',
      'hero_mobile_video_url',
      'hero_title',
      'hero_subtitle',
      'hero_description',
      'hero_slide_interval',
      'hero_slide_transition',
      'card_text_position'
    )
  ) THEN
    RAISE EXCEPTION 'settings payload contains unsupported fields';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_settings) AS setting(key, value)
    WHERE setting.key IN (
      'site_title',
      'site_description',
      'og_image_url',
      'reservation_url',
      'store_url',
      'hero_video_url',
      'hero_mobile_video_url',
      'hero_title',
      'hero_subtitle',
      'hero_description',
      'hero_slide_transition',
      'card_text_position'
    )
      AND jsonb_typeof(setting.value) NOT IN ('string', 'null')
  ) THEN
    RAISE EXCEPTION 'settings text fields must be strings or null';
  END IF;

  v_media_count := jsonb_array_length(p_media);
  IF v_media_count > 20 THEN
    RAISE EXCEPTION 'site hero media cannot exceed 20 items';
  END IF;

  IF jsonb_typeof(p_settings -> 'hero_enabled') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'hero_enabled must be a boolean';
  END IF;

  IF jsonb_typeof(p_settings -> 'hero_slide_interval') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'hero_slide_interval must be a number';
  END IF;

  v_slide_interval := (p_settings ->> 'hero_slide_interval')::INTEGER;
  IF v_slide_interval < 1 OR v_slide_interval > 60 THEN
    RAISE EXCEPTION 'hero_slide_interval must be between 1 and 60';
  END IF;

  v_card_position := p_settings ->> 'card_text_position';
  IF v_card_position IS NULL OR v_card_position NOT IN ('overlay', 'below') THEN
    RAISE EXCEPTION 'card_text_position is invalid';
  END IF;

  v_transition := p_settings ->> 'hero_slide_transition';
  IF v_transition IS NULL OR v_transition NOT IN ('fade', 'slide') THEN
    RAISE EXCEPTION 'hero_slide_transition is invalid';
  END IF;

  IF NULLIF(btrim(p_settings ->> 'site_title'), '') IS NULL THEN
    RAISE EXCEPTION 'site_title is required';
  END IF;

  IF length(p_settings ->> 'site_title') > 160
    OR length(COALESCE(p_settings ->> 'site_description', '')) > 5000
    OR length(COALESCE(p_settings ->> 'hero_title', '')) > 300
    OR length(COALESCE(p_settings ->> 'hero_subtitle', '')) > 500
    OR length(COALESCE(p_settings ->> 'hero_description', '')) > 5000 THEN
    RAISE EXCEPTION 'settings text exceeds the allowed length';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      NULLIF(btrim(p_settings ->> 'og_image_url'), ''),
      NULLIF(btrim(p_settings ->> 'reservation_url'), ''),
      NULLIF(btrim(p_settings ->> 'store_url'), ''),
      NULLIF(btrim(p_settings ->> 'hero_video_url'), ''),
      NULLIF(btrim(p_settings ->> 'hero_mobile_video_url'), '')
    ]) AS candidate(url)
    WHERE candidate.url IS NOT NULL
      AND (length(candidate.url) > 2048 OR candidate.url !~ '^https?://')
  ) THEN
    RAISE EXCEPTION 'settings URLs must be absolute HTTP(S) URLs';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_media) AS media(item)
    WHERE jsonb_typeof(media.item) <> 'object'
      OR NULLIF(btrim(media.item ->> 'image_url'), '') IS NULL
      OR length(media.item ->> 'image_url') > 2048
      OR media.item ->> 'image_url' !~ '^https?://'
      OR media.item ->> 'device_type' IS NULL
      OR media.item ->> 'device_type' NOT IN ('desktop', 'mobile')
      OR media.item ->> 'media_type' IS NULL
      OR media.item ->> 'media_type' NOT IN ('image', 'video')
  ) THEN
    RAISE EXCEPTION 'site hero media payload is invalid';
  END IF;

  INSERT INTO showroom.site_settings (
    id,
    site_title,
    site_description,
    og_image_url,
    reservation_url,
    store_url,
    hero_enabled,
    hero_video_url,
    hero_mobile_video_url,
    hero_title,
    hero_subtitle,
    hero_description,
    hero_slide_interval,
    hero_slide_transition,
    card_text_position,
    updated_at
  ) VALUES (
    'singleton',
    NULLIF(btrim(p_settings ->> 'site_title'), ''),
    NULLIF(btrim(p_settings ->> 'site_description'), ''),
    NULLIF(btrim(p_settings ->> 'og_image_url'), ''),
    NULLIF(btrim(p_settings ->> 'reservation_url'), ''),
    NULLIF(btrim(p_settings ->> 'store_url'), ''),
    (p_settings ->> 'hero_enabled')::BOOLEAN,
    NULLIF(btrim(p_settings ->> 'hero_video_url'), ''),
    NULLIF(btrim(p_settings ->> 'hero_mobile_video_url'), ''),
    NULLIF(btrim(p_settings ->> 'hero_title'), ''),
    NULLIF(btrim(p_settings ->> 'hero_subtitle'), ''),
    NULLIF(btrim(p_settings ->> 'hero_description'), ''),
    v_slide_interval,
    v_transition,
    v_card_position,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    site_title = EXCLUDED.site_title,
    site_description = EXCLUDED.site_description,
    og_image_url = EXCLUDED.og_image_url,
    reservation_url = EXCLUDED.reservation_url,
    store_url = EXCLUDED.store_url,
    hero_enabled = EXCLUDED.hero_enabled,
    hero_video_url = EXCLUDED.hero_video_url,
    hero_mobile_video_url = EXCLUDED.hero_mobile_video_url,
    hero_title = EXCLUDED.hero_title,
    hero_subtitle = EXCLUDED.hero_subtitle,
    hero_description = EXCLUDED.hero_description,
    hero_slide_interval = EXCLUDED.hero_slide_interval,
    hero_slide_transition = EXCLUDED.hero_slide_transition,
    card_text_position = EXCLUDED.card_text_position,
    updated_at = EXCLUDED.updated_at;

  DELETE FROM showroom.site_hero_media;

  INSERT INTO showroom.site_hero_media (
    image_url,
    device_type,
    media_type,
    display_order
  )
  SELECT
    media.item ->> 'image_url',
    media.item ->> 'device_type',
    media.item ->> 'media_type',
    (media.ordinality - 1)::INTEGER
  FROM jsonb_array_elements(p_media) WITH ORDINALITY AS media(item, ordinality);

  RETURN jsonb_build_object('media_count', v_media_count);
END;
$$;

REVOKE ALL ON FUNCTION showroom.save_site_settings(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION showroom.save_site_settings(JSONB, JSONB) FROM anon;
REVOKE ALL ON FUNCTION showroom.save_site_settings(JSONB, JSONB) FROM service_role;
GRANT EXECUTE ON FUNCTION showroom.save_site_settings(JSONB, JSONB) TO authenticated;
