-- Server routes and admin server components use the Supabase service role
-- through PostgREST. Bypass RLS is not enough for custom schemas; the role
-- also needs explicit schema/table privileges.

GRANT USAGE ON SCHEMA platform TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA platform
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA platform
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
