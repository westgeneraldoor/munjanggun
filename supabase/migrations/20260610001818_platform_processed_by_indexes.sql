create index if not exists measurement_requests_processed_by_idx
  on platform.measurement_requests (processed_by)
  where processed_by is not null;

create index if not exists as_requests_processed_by_idx
  on platform.as_requests (processed_by)
  where processed_by is not null;
