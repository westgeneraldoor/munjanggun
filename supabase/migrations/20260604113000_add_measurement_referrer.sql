ALTER TABLE platform.measurement_requests
  ADD COLUMN IF NOT EXISTS referrer_name TEXT;
