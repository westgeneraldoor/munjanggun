CREATE OR REPLACE FUNCTION showroom.reorder_nodes(
  p_parent_id UUID,
  p_ordered_node_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  current_node_ids UUID[];
  requested_node_ids UUID[];
  updated_count INTEGER;
BEGIN
  IF p_ordered_node_ids IS NULL OR cardinality(p_ordered_node_ids) = 0 THEN
    RAISE EXCEPTION 'ordered node ids are required';
  END IF;

  SELECT array_agg(locked_node.id ORDER BY locked_node.id)
  INTO current_node_ids
  FROM (
    SELECT node.id
    FROM showroom.nodes AS node
    WHERE node.parent_id IS NOT DISTINCT FROM p_parent_id
    FOR UPDATE
  ) AS locked_node;

  SELECT array_agg(requested_node.id ORDER BY requested_node.id)
  INTO requested_node_ids
  FROM unnest(p_ordered_node_ids) AS requested_node(id);

  IF current_node_ids IS DISTINCT FROM requested_node_ids THEN
    RAISE EXCEPTION 'ordered node ids must match the complete parent node set';
  END IF;

  UPDATE showroom.nodes AS node
  SET display_order = requested_node.ordinality::INTEGER - 1
  FROM unnest(p_ordered_node_ids) WITH ORDINALITY AS requested_node(id, ordinality)
  WHERE node.id = requested_node.id
    AND node.parent_id IS NOT DISTINCT FROM p_parent_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> cardinality(p_ordered_node_ids) THEN
    RAISE EXCEPTION 'node reorder affected an unexpected row count';
  END IF;

  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION showroom.reorder_nodes(UUID, UUID[])
IS 'Atomically rewrites the complete display order for one showroom node parent. Runs with caller privileges and RLS.';

REVOKE ALL ON FUNCTION showroom.reorder_nodes(UUID, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION showroom.reorder_nodes(UUID, UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION showroom.reorder_nodes(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION showroom.reorder_nodes(UUID, UUID[]) TO service_role;
