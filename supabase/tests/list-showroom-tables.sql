-- This query is intentionally separate from verify-showroom-table-count.sql.
-- `supabase db query --file` submits one prepared statement at a time.
SELECT tablename
FROM pg_catalog.pg_tables
WHERE schemaname = 'showroom'
ORDER BY tablename;
