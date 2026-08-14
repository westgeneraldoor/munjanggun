import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(
  new URL('../supabase/migrations/20260723081337_content_asset_library_server_query.sql', import.meta.url),
  'utf8',
)
const db = new PGlite()

await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE SCHEMA showroom;

  CREATE TYPE showroom.content_asset_library_state AS ENUM ('available', 'hidden', 'archived');
  CREATE TYPE showroom.content_asset_file_role AS ENUM ('original', 'web', 'thumbnail');

  CREATE TABLE showroom.content_assets (
    id UUID PRIMARY KEY,
    title TEXT,
    description TEXT,
    category TEXT,
    product_type TEXT,
    space_type TEXT,
    region TEXT,
    usage_purpose TEXT,
    library_state showroom.content_asset_library_state NOT NULL DEFAULT 'available',
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE showroom.content_asset_files (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES showroom.content_assets(id),
    file_role showroom.content_asset_file_role NOT NULL,
    size_bytes BIGINT
  );
  CREATE TABLE showroom.content_asset_tags (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE showroom.content_asset_tag_links (
    asset_id UUID NOT NULL REFERENCES showroom.content_assets(id),
    tag_id UUID NOT NULL REFERENCES showroom.content_asset_tags(id),
    PRIMARY KEY (asset_id, tag_id)
  );
  CREATE TABLE showroom.content_asset_events (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES showroom.content_assets(id),
    event_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL
  );

  CREATE OR REPLACE FUNCTION showroom.archive_content_assets_safely(
    p_asset_ids UUID[],
    p_actor_id UUID,
    p_restore BOOLEAN DEFAULT FALSE
  )
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
  AS $$
  DECLARE
    v_results JSONB;
  BEGIN
    UPDATE showroom.content_assets
    SET library_state = CASE
      WHEN p_restore THEN 'available'::showroom.content_asset_library_state
      ELSE 'archived'::showroom.content_asset_library_state
    END
    WHERE id = ANY(p_asset_ids);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'assetId', candidate,
      'changed', TRUE,
      'reason', CASE WHEN p_restore THEN 'restored' ELSE 'archived' END,
      'references', '[]'::JSONB
    ) ORDER BY candidate), '[]'::JSONB)
    INTO v_results
    FROM unnest(p_asset_ids) AS candidate;

    RETURN jsonb_build_object('results', v_results);
  END;
  $$;
`)

await db.exec(migration)

const tagId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const archivedTagId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
await db.query(`INSERT INTO showroom.content_asset_tags(id, name) VALUES ($1, '대표 태그')`, [tagId])
await db.query(`INSERT INTO showroom.content_asset_tags(id, name) VALUES ($1, '휴지통 전용 태그')`, [archivedTagId])

for (let index = 1; index <= 110; index += 1) {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  const archived = index > 105
  const title = index === 73 ? 'zzz-target' : `asset-${String(index % 7).padStart(2, '0')}`
  await db.query(`
    INSERT INTO showroom.content_assets(
      id, title, description, category, product_type, space_type, region,
      usage_purpose, library_state, created_at
    ) VALUES (
      $1, $2, $3, $4, '중문', '현관', $5, '블로그',
      $6::showroom.content_asset_library_state, '2026-07-23T00:00:00Z'
    )
  `, [
    id,
    title,
    index === 73 ? '두 번째 서버 페이지 검색 대상' : index === 88 ? '설명으로 찾는 사진' : null,
    index % 2 === 0 ? '시공후' : '현장',
    index % 3 === 0 ? '동탄' : '서울',
    archived ? 'archived' : 'available',
  ])
  const originalFileName = index === 73
    ? 'zzz-field-photo.jpg'
    : index === 88
      ? 'aaa-field-photo.jpg'
      : `photo-${String(index).padStart(3, '0')}.jpg`
  await db.query(`
    INSERT INTO showroom.content_asset_events(id, asset_id, event_type, metadata, created_at)
    VALUES ($1, $2, 'uploaded', jsonb_build_object('file_name', $3::TEXT), '2026-07-23T00:00:00Z')
  `, [`20000000-0000-4000-8000-${String(index).padStart(12, '0')}`, id, originalFileName])
  await db.query(`
    INSERT INTO showroom.content_asset_files(id, asset_id, file_role, size_bytes)
    VALUES ($1, $2, 'web', $3)
  `, [`10000000-0000-4000-8000-${String(index).padStart(12, '0')}`, id, index * 1000])
  await db.query(`
    INSERT INTO showroom.content_asset_files(id, asset_id, file_role, size_bytes)
    VALUES ($1, $2, 'original', $3)
  `, [`30000000-0000-4000-8000-${String(index).padStart(12, '0')}`, id, (111 - index) * 10_000])
  if (index === 73) {
    await db.query(
      `INSERT INTO showroom.content_asset_tag_links(asset_id, tag_id) VALUES ($1, $2)`,
      [id, tagId],
    )
  }
}

await db.query(
  `INSERT INTO showroom.content_asset_tag_links(asset_id, tag_id) VALUES ($1, $2)`,
  ['00000000-0000-4000-8000-000000000106', archivedTagId],
)

async function list(args = {}) {
  const defaults = {
    p_search: null,
    p_view: 'active',
    p_category: null,
    p_product_type: null,
    p_space_type: null,
    p_region: null,
    p_usage_purpose: null,
    p_tag_id: null,
    p_sort: 'newest',
    p_page: 1,
    p_page_size: 48,
  }
  const values = { ...defaults, ...args }
  const result = await db.query(`
    SELECT showroom.list_content_assets_admin(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    ) AS payload
  `, Object.values(values))
  return result.rows[0].payload
}

async function prepareAllResultsSelection(args = {}) {
  const defaults = {
    p_search: null,
    p_view: 'active',
    p_category: null,
    p_product_type: null,
    p_space_type: null,
    p_region: null,
    p_usage_purpose: null,
    p_tag_id: null,
    p_sort: 'newest',
    p_page: 1,
    p_page_size: 48,
  }
  const values = { ...defaults, ...args }
  const result = await db.query(`
    SELECT showroom.prepare_content_asset_search_results_selection(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    ) AS payload
  `, Object.values(values))
  return result.rows[0].payload
}

const first = await list()
const second = await list({ p_page: 2 })
const third = await list({ p_page: 3 })
assert.equal(first.totalCount, 105)
assert.equal(first.selectionToken, undefined, 'ordinary page reads must not hash the complete matching result set')
assert.equal(first.assetIds.length, 48)
assert.equal(second.assetIds.length, 48)
assert.equal(third.assetIds.length, 9)
assert.equal(new Set([...first.assetIds, ...second.assetIds, ...third.assetIds]).size, 105)
assert.deepEqual([...first.assetIds, ...second.assetIds, ...third.assetIds], [...first.assetIds, ...second.assetIds, ...third.assetIds].sort())

const search = await list({ p_search: '두 번째 서버 페이지' })
assert.equal(search.totalCount, 1)
assert.equal(search.assetIds[0], '00000000-0000-4000-8000-000000000073')

const descriptionSearch = await list({ p_search: '설명으로 찾는' })
assert.equal(descriptionSearch.totalCount, 1)
assert.equal(descriptionSearch.assetIds[0], '00000000-0000-4000-8000-000000000088')
const fileNameSearch = await list({ p_search: 'aaa-field-photo.jpg' })
assert.equal(fileNameSearch.totalCount, 1)
assert.equal(fileNameSearch.assetIds[0], '00000000-0000-4000-8000-000000000088')

const tagSearch = await list({ p_tag_id: tagId })
assert.equal(tagSearch.totalCount, 1)
assert.equal(tagSearch.assetIds[0], '00000000-0000-4000-8000-000000000073')
assert.deepEqual(tagSearch.facets.tags.map(tag => tag.id), [tagId], 'tag facets must respect the active tag filter')

const categoryValue = (
  await db.query(`SELECT category FROM showroom.content_assets WHERE id = $1`, ['00000000-0000-4000-8000-000000000073'])
).rows[0].category
const categorySearch = await list({ p_category: categoryValue })
assert.deepEqual(categorySearch.facets.categories, [categoryValue], 'facets must respect the active metadata filter')

const archived = await list({ p_view: 'archived' })
assert.deepEqual(archived.facets.tags.map(tag => tag.id), [archivedTagId], 'facets must not show active-view values in the trash view')

const regionFilter = await list({ p_region: '동탄' })
assert.equal(regionFilter.totalCount, 35)

const sizeDescending = await list({ p_sort: 'sizeDesc' })
assert.equal(sizeDescending.assetIds[0], '00000000-0000-4000-8000-000000000001')
const sizeAscending = await list({ p_sort: 'sizeAsc' })
assert.equal(sizeAscending.assetIds[0], '00000000-0000-4000-8000-000000000105')
const nameAscending = await list({ p_sort: 'nameAsc' })
assert.equal(nameAscending.assetIds[0], '00000000-0000-4000-8000-000000000088')
const nameDescending = await list({ p_sort: 'nameDesc' })
assert.equal(nameDescending.assetIds[0], '00000000-0000-4000-8000-000000000073')
const oldest = await list({ p_sort: 'oldest' })
assert.deepEqual(oldest.assetIds, first.assetIds, 'equal timestamps must fall back to ascending asset id')

await db.query(
  `UPDATE showroom.content_asset_events
   SET metadata = jsonb_build_object('file_name', 'projection-refresh.jpg')
   WHERE asset_id = $1`,
  ['00000000-0000-4000-8000-000000000001'],
)
const refreshedFileName = await list({ p_search: 'projection-refresh.jpg' })
assert.deepEqual(refreshedFileName.assetIds, ['00000000-0000-4000-8000-000000000001'], 'event writes must refresh the server search projection')

await db.query(
  `UPDATE showroom.content_asset_files
   SET size_bytes = 9999999
   WHERE asset_id = $1 AND file_role = 'original'`,
  ['00000000-0000-4000-8000-000000000105'],
)
assert.equal((await list({ p_sort: 'sizeDesc' })).assetIds[0], '00000000-0000-4000-8000-000000000105', 'file writes must refresh the server size projection')

await db.query(`UPDATE showroom.content_asset_tags SET name = 'projection-tag-refresh' WHERE id = $1`, [tagId])
const refreshedTagName = await list({ p_search: 'projection-tag-refresh' })
assert.deepEqual(refreshedTagName.assetIds, ['00000000-0000-4000-8000-000000000073'], 'tag writes must refresh the server search projection')

const selectedAll = await prepareAllResultsSelection()
assert.equal(selectedAll.totalCount, 105)
assert.match(selectedAll.selectionToken, /^[0-9a-f]{32}$/)

const actorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const changedResult = await db.query(`
  SELECT showroom.archive_content_asset_search_results_safely(
    NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 104, $1, $2, FALSE
  ) AS payload
`, [selectedAll.selectionToken, actorId])
assert.equal(changedResult.rows[0].payload.ok, false)
assert.equal(changedResult.rows[0].payload.currentCount, 105)
assert.equal(
  (await db.query(`SELECT count(*)::INTEGER AS count FROM showroom.content_assets WHERE library_state = 'archived'`)).rows[0].count,
  5,
)

await db.exec(`
  UPDATE showroom.content_assets
  SET library_state = 'archived'
  WHERE id = '00000000-0000-4000-8000-000000000001';
  UPDATE showroom.content_assets
  SET library_state = 'available'
  WHERE id = '00000000-0000-4000-8000-000000000106';
`)
const sameCountReplacement = await db.query(`
  SELECT showroom.archive_content_asset_search_results_safely(
    NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 105, $1, $2, FALSE
  ) AS payload
`, [selectedAll.selectionToken, actorId])
assert.equal(sameCountReplacement.rows[0].payload.ok, false)
assert.equal(sameCountReplacement.rows[0].payload.reason, 'result_set_changed')
assert.equal(
  (await db.query(`SELECT count(*)::INTEGER AS count FROM showroom.content_assets WHERE library_state = 'archived'`)).rows[0].count,
  5,
)
await db.exec(`
  UPDATE showroom.content_assets
  SET library_state = 'available'
  WHERE id = '00000000-0000-4000-8000-000000000001';
  UPDATE showroom.content_assets
  SET library_state = 'archived'
  WHERE id = '00000000-0000-4000-8000-000000000106';
`)

const archiveResult = await db.query(`
  SELECT showroom.archive_content_asset_search_results_safely(
    NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 105, $1, $2, FALSE
  ) AS payload
`, [selectedAll.selectionToken, actorId])
assert.equal(archiveResult.rows[0].payload.ok, true)
assert.equal(archiveResult.rows[0].payload.results.length, 105)
assert.equal(
  (await db.query(`SELECT count(*)::INTEGER AS count FROM showroom.content_assets WHERE library_state = 'archived'`)).rows[0].count,
  110,
)

console.log('content asset library database runtime passed')
