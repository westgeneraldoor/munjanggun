-- Optimize public showroom navigation queries.
--
-- Customer pages resolve node paths by parent + slug and list child cards by
-- parent + status + display_order. These indexes keep those paths responsive
-- as the digital showroom grows.

create index if not exists idx_showroom_nodes_parent_slug_status
  on showroom.nodes (parent_id, slug, status);

create index if not exists idx_showroom_nodes_parent_status_order
  on showroom.nodes (parent_id, status, display_order);

create index if not exists idx_showroom_site_hero_media_display_order
  on showroom.site_hero_media (display_order);
