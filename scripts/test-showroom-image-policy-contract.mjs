import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../supabase/migrations/20260723082228_showroom_image_derivatives.sql', import.meta.url),
  'utf8',
)

const policyStatements = migration.match(
  /CREATE POLICY\s+[a-z0-9_]+\s+ON\s+showroom\.(?:image_sources|image_derivatives)[\s\S]*?;/gi,
) ?? []

function selectPolicies(table, role) {
  return policyStatements.filter(statement => {
    const header = statement.split(/\bUSING\b|\bWITH\s+CHECK\b/i, 1)[0]
    const tableMatch = statement.match(/ON\s+showroom\.([a-z0-9_]+)/i)
    const commandMatch = header.match(/FOR\s+([A-Z]+)/i)
    const rolesMatch = statement.match(/TO\s+([a-z0-9_,\s]+?)\s+USING/i)
    const command = commandMatch?.[1].toUpperCase() ?? 'ALL'
    if (!tableMatch || /\bAS\s+RESTRICTIVE\b/i.test(header)) return false
    const roles = rolesMatch
      ? rolesMatch[1].split(',').map(value => value.trim().toLowerCase())
      : ['public']
    return tableMatch[1] === table
      && ['SELECT', 'ALL'].includes(command)
      && (roles.includes(role) || roles.includes('public'))
  })
}

for (const table of ['image_sources', 'image_derivatives']) {
  const anonPolicies = selectPolicies(table, 'anon')
  const authenticatedPolicies = selectPolicies(table, 'authenticated')

  assert.equal(
    anonPolicies.length,
    1,
    `${table} must expose exactly one permissive SELECT path to anon`,
  )
  assert.equal(
    authenticatedPolicies.length,
    1,
    `${table} must expose exactly one permissive SELECT path to authenticated`,
  )
  assert.match(
    anonPolicies[0],
    /private\.is_public_showroom_image_url/i,
    `${table} anon reads must use only the public visibility predicate`,
  )
  assert.doesNotMatch(
    anonPolicies[0],
    /platform_private\.is_admin/i,
    `${table} anon reads must never enter the administrator path`,
  )
  assert.match(
    authenticatedPolicies[0],
    /platform_private\.is_admin\(\)[\s\S]*?\bOR\b[\s\S]*?private\.is_public_showroom_image_url/i,
    `${table} authenticated reads must combine administrator OR public access in one policy`,
  )
  assert.doesNotMatch(
    authenticatedPolicies[0],
    /USING\s*\(\s*true\s*\)/i,
    `${table} customers must not gain unrestricted authenticated reads`,
  )
}

for (const role of ['anon', 'authenticated']) {
  assert.equal(
    selectPolicies('image_sources', role).length,
    1,
    `image_sources ${role} SELECT must not have duplicate permissive policies`,
  )
  assert.equal(
    selectPolicies('image_derivatives', role).length,
    1,
    `image_derivatives ${role} SELECT must not have duplicate permissive policies`,
  )
}

assert.match(
  selectPolicies('image_derivatives', 'anon')[0],
  /transform_status\s*=\s*'ready'/i,
  'anon must never read skipped or failed derivative metadata',
)
assert.match(
  selectPolicies('image_derivatives', 'authenticated')[0],
  /transform_status\s*=\s*'ready'/i,
  'the authenticated public path must never expose skipped or failed derivative metadata',
)
assert.match(
  selectPolicies('image_derivatives', 'authenticated')[0],
  /USING\s*\(\s*\(SELECT\s+platform_private\.is_admin\(\)\)\s+OR\s+\(\s*transform_status\s*=\s*'ready'[\s\S]*?private\.is_public_showroom_image_url\(source\.source_url\)[\s\S]*?\)\s*\)\s*;/i,
  'administrators must bypass the ready-only public branch and retain full derivative visibility',
)
assert.match(
  selectPolicies('image_sources', 'authenticated')[0],
  /USING\s*\(\s*\(SELECT\s+platform_private\.is_admin\(\)\)\s+OR\s+private\.is_public_showroom_image_url\(source_url\)\s*\)\s*;/i,
  'source visibility must remain exactly administrator-all OR public-only',
)

const publicPredicate = migration.match(
  /CREATE OR REPLACE FUNCTION private\.is_public_showroom_image_url\(p_source_url TEXT\)[\s\S]*?\$\$;/i,
)?.[0] ?? ''
assert.match(publicPredicate, /node\.status\s*=\s*'published'/i, 'draft node sources must stay hidden')
assert.match(publicPredicate, /private\.is_node_visible\(node\.id\)/i)
assert.match(publicPredicate, /private\.is_node_visible\(media\.node_id\)/i)
assert.match(publicPredicate, /private\.is_node_visible\(photo\.node_id\)/i)

const tableGrantStatements = migration.match(
  /GRANT\s+[^;]*?\s+ON\s+(?:TABLE\s+)?showroom\.(?:image_sources|image_derivatives)\s+TO\s+[^;]+;/gi,
) ?? []

for (const table of ['image_sources', 'image_derivatives']) {
  assert.match(
    migration,
    new RegExp(`REVOKE ALL ON showroom\\.${table} FROM PUBLIC, anon, authenticated`, 'i'),
  )
  for (const statement of tableGrantStatements) {
    const tableMatch = statement.match(/ON\s+(?:TABLE\s+)?showroom\.([a-z0-9_]+)/i)
    const privilegeMatch = statement.match(/GRANT\s+([\s\S]*?)\s+ON\s+(?:TABLE\s+)?showroom\./i)
    const rolesMatch = statement.match(/\s+TO\s+([^;]+);/i)
    if (!tableMatch || !privilegeMatch || !rolesMatch || tableMatch[1] !== table) continue
    const roles = rolesMatch[1].split(',').map(value => value.trim().toLowerCase())
    if (!roles.some(role => ['public', 'anon', 'authenticated'].includes(role))) continue
    assert.doesNotMatch(
      privilegeMatch[1],
      /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL)\b/i,
      `${table} anon/authenticated writes must remain denied, including mixed grants`,
    )
  }
  assert.match(
    migration,
    new RegExp(`GRANT SELECT, INSERT, UPDATE ON showroom\\.${table} TO service_role`, 'i'),
    `${table} service-role ingestion grants must remain explicit`,
  )
}
assert.doesNotMatch(
  migration,
  /GRANT\s+[^;]*\b(?:INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL)\b[^;]*\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+showroom\s+TO\s+[^;]*(?:PUBLIC|anon|authenticated)[^;]*;/i,
  'schema-wide grants must not restore showroom write privileges to public roles',
)

assert.match(migration, /UNIQUE\s*\(\s*source_bucket,\s*source_object_path\s*\)/i)
assert.match(migration, /UNIQUE\s*\(\s*source_id,\s*variant,\s*recipe_version\s*\)/i)
assert.match(
  migration,
  /CONSTRAINT\s+image_derivatives_recipe_target_width_check\s+CHECK\s*\([\s\S]*recipe_version\s*<>\s*1[\s\S]*variant\s*=\s*'thumbnail'\s+AND\s+target_width\s*=\s*192[\s\S]*variant\s*=\s*'card'\s+AND\s+target_width\s*=\s*960[\s\S]*variant\s*=\s*'display'\s+AND\s+target_width\s*=\s*1600[\s\S]*variant\s*=\s*'large'\s+AND\s+target_width\s*=\s*2560/i,
  'recipe version 1 must have one database-enforced canonical target width per variant',
)
assert.match(
  migration,
  /IF\s+v_recipe_version\s*=\s*1[\s\S]*v_target_width\s*<>\s*CASE\s+v_variant[\s\S]*RAISE EXCEPTION[\s\S]*recipe version 1 target width mismatch/i,
  'the service-role commit function must reject noncanonical recipe version 1 payloads before writing',
)
assert.match(migration, /ON CONFLICT\s*\(\s*source_bucket,\s*source_object_path\s*\)/i)
assert.match(migration, /source object checksum changed at the same bucket\/path/i)
assert.match(
  migration,
  /WHEN showroom\.image_derivatives\.transform_status = 'ready'[\s\S]*?EXCLUDED\.transform_status <> 'ready'[\s\S]*?THEN showroom\.image_derivatives\.transform_status/i,
  'duplicate commits must not downgrade an existing ready derivative',
)
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION showroom\.commit_image_derivatives\(JSONB, JSONB\) FROM PUBLIC, anon, authenticated/i,
)
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION showroom\.commit_image_derivatives\(JSONB, JSONB\) TO service_role/i,
)

function functionExecuteGrantRoles(signature) {
  const grants = migration.match(
    new RegExp(`GRANT\\s+(?:EXECUTE|ALL(?:\\s+PRIVILEGES)?)\\s+ON\\s+FUNCTION\\s+${signature}\\s+TO\\s+[^;]+;`, 'gi'),
  ) ?? []
  return grants.flatMap(statement => {
    const rolesMatch = statement.match(/\s+TO\s+([^;]+);/i)
    return rolesMatch
      ? rolesMatch[1].split(',').map(value => value.trim().toLowerCase())
      : []
  })
}

assert.deepEqual(
  [...new Set(functionExecuteGrantRoles('showroom\\.commit_image_derivatives\\(JSONB, JSONB\\)'))],
  ['service_role'],
  'commit RPC execute grants must remain service-role-only',
)

const previewResolver = migration.match(
  /CREATE OR REPLACE FUNCTION showroom\.resolve_preview_image_derivatives\([\s\S]*?\$\$;/i,
)?.[0] ?? ''
assert.match(previewResolver, /SECURITY DEFINER/i)
assert.match(previewResolver, /p_source_urls IS NULL OR cardinality\(p_source_urls\) > 100/i)
assert.match(previewResolver, /token\.token = p_token/i)
assert.match(previewResolver, /token\.expires_at > NOW\(\)/i)
assert.match(previewResolver, /node\.id = token\.node_id[\s\S]*?node\.image_url = source\.source_url/i)
assert.match(previewResolver, /media\.node_id = token\.node_id[\s\S]*?media\.image_url = source\.source_url/i)
assert.match(previewResolver, /photo\.node_id = token\.node_id[\s\S]*?photo\.image_url = source\.source_url/i)
assert.match(previewResolver, /child\.parent_id = token\.node_id[\s\S]*?child\.image_url = source\.source_url/i)
assert.match(previewResolver, /derivative\.transform_status = 'ready'/i)
assert.match(previewResolver, /derivative\.recipe_version = 1/i)
assert.doesNotMatch(
  previewResolver,
  /private\.is_public_showroom_image_url/i,
  'preview resolution must stay token-scoped instead of becoming a broad public lookup',
)
const ownershipScope = previewResolver.match(
  /\n\s+AND\s+\(\s*\n([\s\S]*?)\n\s+\);\s*\nEND;/i,
)?.[1] ?? ''
const expectedOwnershipScope = `
  EXISTS (
    SELECT 1
    FROM showroom.nodes AS node
    WHERE node.id = token.node_id
      AND node.image_url = source.source_url
  )
  OR EXISTS (
    SELECT 1
    FROM showroom.hero_media AS media
    WHERE media.node_id = token.node_id
      AND media.image_url = source.source_url
  )
  OR EXISTS (
    SELECT 1
    FROM showroom.gallery_photos AS photo
    WHERE photo.node_id = token.node_id
      AND photo.image_url = source.source_url
  )
  OR EXISTS (
    SELECT 1
    FROM showroom.nodes AS child
    WHERE child.parent_id = token.node_id
      AND child.image_url = source.source_url
  )
`
const normalizeSql = value => value.replace(/\s+/g, ' ').trim().toLowerCase()
assert.equal(
  normalizeSql(ownershipScope),
  normalizeSql(expectedOwnershipScope),
  'preview token ownership must remain limited to the exact node, hero, gallery, and direct-child scopes',
)
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION showroom\.resolve_preview_image_derivatives\(TEXT, TEXT\[\]\) FROM PUBLIC/i,
)
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION showroom\.resolve_preview_image_derivatives\(TEXT, TEXT\[\]\) FROM authenticated/i,
)
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION showroom\.resolve_preview_image_derivatives\(TEXT, TEXT\[\]\) FROM service_role/i,
)
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION showroom\.resolve_preview_image_derivatives\(TEXT, TEXT\[\]\) TO anon/i,
)
assert.deepEqual(
  [...new Set(functionExecuteGrantRoles('showroom\\.resolve_preview_image_derivatives\\(TEXT, TEXT\\[\\]\\)'))],
  ['anon'],
  'preview resolver execute grants must remain anon-only',
)
assert.doesNotMatch(
  migration,
  /GRANT\s+(?:EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+showroom\s+TO\s+[^;]*(?:PUBLIC|anon|authenticated|service_role)[^;]*;/i,
  'schema-wide function grants must not bypass the exact commit and preview execute boundaries',
)
assert.match(
  migration,
  /COMMENT ON FUNCTION showroom\.resolve_preview_image_derivatives\(TEXT, TEXT\[\]\)[\s\S]*?intentional anon SECURITY DEFINER preview exception[\s\S]*?unexpired token[\s\S]*?at most 100[\s\S]*?token node[\s\S]*?execute is granted only to anon/i,
  'the intentional preview exception and its full boundary must stay documented in the migration',
)

console.log('Showroom image RLS and privileged-function policy contract passed.')
