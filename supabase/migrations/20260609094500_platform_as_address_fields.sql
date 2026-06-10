alter table platform.as_requests
  add column if not exists postcode text,
  add column if not exists road_address text,
  add column if not exists jibun_address text,
  add column if not exists address_extra text,
  add column if not exists is_manual_address boolean not null default false;

create index if not exists as_requests_address_lookup_idx
  on platform.as_requests (road_address, created_at desc);
