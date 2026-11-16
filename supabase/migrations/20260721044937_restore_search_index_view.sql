-- 20260721044938 hardens this view but never creates it. No tracked source
-- defines its Production query, so preserve an existing view and create only
-- an empty-database compatibility shell. Do not infer or claim search
-- semantics from this migration.
DO $$
BEGIN
  IF to_regclass('public.vw_search_index') IS NULL THEN
    EXECUTE $create_view$
      CREATE VIEW public.vw_search_index AS
      SELECT NULL::TEXT AS unavailable
      WHERE FALSE
    $create_view$;
  END IF;
END;
$$;
