CREATE OR REPLACE FUNCTION showroom.register_approved_manuscript(p_post jsonb, p_blocks jsonb, p_event jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_post_id uuid;
  v_actor_id uuid := (p_event ->> 'actor_id')::uuid;
BEGIN
  INSERT INTO showroom.blog_posts (
    title,
    slug,
    excerpt,
    seo_title,
    meta_description,
    canonical_url,
    status,
    category,
    primary_keyword,
    target_question,
    summary_answer,
    related_questions,
    service_area,
    product_type,
    source_evidence,
    brand_check_result,
    ai_model,
    source_prompt,
    ai_citation_ready,
    last_fact_checked_at,
    media_missing_reason,
    created_by,
    reviewed_by,
    published_by,
    published_at
  )
  VALUES (
    p_post ->> 'title',
    p_post ->> 'slug',
    p_post ->> 'excerpt',
    p_post ->> 'seo_title',
    p_post ->> 'meta_description',
    NULLIF(p_post ->> 'canonical_url', ''),
    'reviewing'::showroom.blog_post_status,
    (p_post ->> 'category')::showroom.blog_content_category,
    NULLIF(p_post ->> 'primary_keyword', ''),
    p_post ->> 'target_question',
    p_post ->> 'summary_answer',
    COALESCE(p_post -> 'related_questions', '[]'::jsonb),
    NULLIF(p_post ->> 'service_area', ''),
    NULLIF(p_post ->> 'product_type', ''),
    COALESCE(p_post -> 'source_evidence', '[]'::jsonb),
    COALESCE(p_post -> 'brand_check_result', '{}'::jsonb),
    NULL,
    NULL,
    FALSE,
    NULL,
    NULL,
    v_actor_id,
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO v_post_id;

  INSERT INTO showroom.blog_blocks (
    post_id,
    display_order,
    type,
    heading_level,
    text,
    media_id,
    metadata
  )
  SELECT
    v_post_id,
    blocks.display_order,
    (blocks.block ->> 'type')::showroom.blog_block_type,
    NULLIF(blocks.block ->> 'heading_level', '')::integer,
    NULLIF(blocks.block ->> 'text', ''),
    NULLIF(blocks.block ->> 'media_id', '')::uuid,
    COALESCE(blocks.block -> 'metadata', '{}'::jsonb)
  FROM pg_catalog.jsonb_array_elements(p_blocks) WITH ORDINALITY AS blocks(block, display_order);

  INSERT INTO showroom.blog_post_events (
    post_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    memo,
    metadata
  )
  VALUES (
    v_post_id,
    v_actor_id,
    'manuscript_registered',
    NULL,
    'reviewing'::showroom.blog_post_status,
    '승인된 외부 원고가 콘텐츠 큐에 등록되었습니다.',
    '{"intake": "approved_manuscript"}'::jsonb
  );

  RETURN v_post_id;
END;
$$;

REVOKE ALL ON FUNCTION showroom.register_approved_manuscript(p_post jsonb, p_blocks jsonb, p_event jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION showroom.register_approved_manuscript(p_post jsonb, p_blocks jsonb, p_event jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.register_approved_manuscript(p_post jsonb, p_blocks jsonb, p_event jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
