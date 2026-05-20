-- Harden showroom preview links.
--
-- Preview pages need to show draft nodes to anyone who has a valid token,
-- but anon clients should not be able to list showroom.preview_tokens.

create or replace function showroom.get_preview_payload(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preview showroom.preview_tokens%rowtype;
  v_node showroom.nodes%rowtype;
begin
  select *
  into v_preview
  from showroom.preview_tokens
  where token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  if v_preview.expires_at <= now() then
    return jsonb_build_object('expired', true);
  end if;

  select *
  into v_node
  from showroom.nodes
  where id = v_preview.node_id
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'expired', false,
    'node', to_jsonb(v_node),
    'heroMedia', (
      select coalesce(jsonb_agg(to_jsonb(hm) order by hm.display_order), '[]'::jsonb)
      from showroom.hero_media hm
      where hm.node_id = v_node.id
        and v_node.type = 'listing'
    ),
    'childNodes', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', n.id,
            'name', n.name,
            'image_url', n.image_url
          )
          order by n.display_order
        ),
        '[]'::jsonb
      )
      from showroom.nodes n
      where n.parent_id = v_node.id
        and v_node.type = 'listing'
    ),
    'galleryPhotos', (
      select coalesce(jsonb_agg(to_jsonb(gp) order by gp.display_order), '[]'::jsonb)
      from showroom.gallery_photos gp
      where gp.node_id = v_node.id
        and v_node.type = 'detail'
    )
  );
end;
$$;

revoke all on function showroom.get_preview_payload(text) from public;
grant execute on function showroom.get_preview_payload(text) to anon, authenticated;

drop policy if exists anon_read_preview_tokens on showroom.preview_tokens;
revoke select on showroom.preview_tokens from anon;

create index if not exists idx_showroom_gallery_photos_node_id
  on showroom.gallery_photos (node_id);

create index if not exists idx_showroom_hero_media_node_id
  on showroom.hero_media (node_id);

create index if not exists idx_showroom_preview_tokens_node_id
  on showroom.preview_tokens (node_id);
