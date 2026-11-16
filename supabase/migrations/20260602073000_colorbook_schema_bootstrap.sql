-- The later 20260602073953 migration includes colorbook in pgrst.db_schemas.
-- Production still has legacy colorbook data, but its table DDL was never
-- tracked. Create only the schema required for PostgREST cache loading; do
-- not invent the untracked v1 tables, columns, policies, or grants.
CREATE SCHEMA IF NOT EXISTS colorbook;
