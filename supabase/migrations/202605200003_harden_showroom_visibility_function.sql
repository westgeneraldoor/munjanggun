create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_node_visible(target_node_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  all_published boolean;
begin
  with recursive ancestor_chain as (
    select id, parent_id, status
    from showroom.nodes
    where id = target_node_id

    union all

    select n.id, n.parent_id, n.status
    from showroom.nodes n
    inner join ancestor_chain ac on n.id = ac.parent_id
  )
  select bool_and(status = 'published') into all_published
  from ancestor_chain;

  return coalesce(all_published, false);
end;
$$;

revoke all on function private.is_node_visible(uuid) from public;
grant execute on function private.is_node_visible(uuid) to anon, authenticated;

drop policy if exists anon_read_visible_nodes on showroom.nodes;
create policy anon_read_visible_nodes on showroom.nodes
  for select to anon
  using (status = 'published' and private.is_node_visible(id));

drop policy if exists anon_read_hero_media on showroom.hero_media;
create policy anon_read_hero_media on showroom.hero_media
  for select to anon
  using (private.is_node_visible(node_id));

drop policy if exists anon_read_gallery_photos on showroom.gallery_photos;
create policy anon_read_gallery_photos on showroom.gallery_photos
  for select to anon
  using (private.is_node_visible(node_id));

revoke execute on function showroom.is_node_visible(uuid) from public, anon, authenticated;
revoke execute on function showroom.get_preview_payload(text) from authenticated;
