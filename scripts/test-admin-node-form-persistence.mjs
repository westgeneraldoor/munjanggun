import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8').catch(() => '')

const [page, form, formStyles, gallery, hero, imageUploader, siteSettings, migration, fixture] = await Promise.all([
  read('src/app/admin/nodes/[id]/page.tsx'),
  read('src/components/admin/NodeForm.tsx'),
  read('src/components/admin/NodeForm.module.css'),
  read('src/components/admin/GalleryManager.tsx'),
  read('src/components/admin/HeroConfigurator.tsx'),
  read('src/components/admin/ImageUploader.tsx'),
  read('src/components/admin/SiteSettingsForm.tsx'),
  read('supabase/migrations/20260720074917_atomic_node_save.sql'),
  read('src/app/test-fixtures/admin-node-form/page.tsx'),
])

for (const primitive of ['PlatformPageHeader', 'PlatformPanel', 'PlatformStatePanel', 'PlatformLinkButton']) {
  assert.match(page, new RegExp(`\\b${primitive}\\b`), `node page must use ${primitive}`)
}
assert.match(page, /profile\?\.role === 'administrator'/, 'node editing must fail closed for non-administrators')
for (const errorName of ['nodeError', 'heroMediaError', 'galleryPhotosError', 'childCountError']) {
  assert.match(page, new RegExp(`\\b${errorName}\\b`), `${errorName} must be handled explicitly`)
}
assert.doesNotMatch(page, /(?:media|photos|count)\s*\|\|\s*(?:\[\]|0)/, 'load failures must not be disguised as empty data')
assert.doesNotMatch(page, /node\.type\s*===\s*['"]listing['"][\s\S]{0,180}from\(['"]hero_media['"]\)/, 'hero media must load even while hidden so type conversion cannot erase it')
assert.doesNotMatch(page, /node\.type\s*===\s*['"]detail['"][\s\S]{0,180}from\(['"]gallery_photos['"]\)/, 'gallery media must load even while hidden so type conversion cannot erase it')

for (const primitive of ['PlatformField', 'PlatformSelect', 'PlatformButton', 'PlatformPanel', 'PlatformStatePanel', 'PlatformSwitch']) {
  assert.match(form, new RegExp(`\\b${primitive}\\b`), `node form must use ${primitive}`)
}
assert.doesNotMatch(form, /<(?:input|select|textarea)\b/, 'node form core controls must use shared field primitives')
assert.match(form, /\.rpc\(['"]save_node['"]/, 'node and media must be saved through one RPC')
assert.match(form, /p_hero_media:\s*heroMedia\.map/, 'hidden hero media must remain in the atomic payload')
assert.match(form, /p_gallery_photos:\s*galleryPhotos\.map/, 'hidden gallery media must remain in the atomic payload')
assert.doesNotMatch(form, /\.from\(['"](?:nodes|hero_media|gallery_photos)['"]\)/, 'the node form must not write node tables directly')
assert.match(form, /isLoading=\{isLoading\}/, 'the save button must expose its loading state')
assert.match(form, /hasPendingUploads/, 'node save must track child uploader state')
assert.match(form, /disabled=\{isLoading \|\| hasPendingUploads\}/, 'node save must remain disabled while any upload is pending')
assert.ok((form.match(/disabled=\{isLoading \|\| hasPendingUploads\}/g) ?? []).length >= 4, 'save, type switch, hero switch, and media managers must all lock during uploads')
assert.match(form, /if \(hasPendingUploads\)/, 'the submit handler must defend against upload/save races')
assert.match(form, /setSuccess\(false\)/, 'editing after save must clear stale success feedback')
assert.match(form, /\.maybeSingle\(\)/, 'a missing preview token must remain a valid state')
assert.match(form, /previewLoadError/, 'preview token load errors must be visible without blocking node edits')
assert.match(form, /await navigator\.clipboard\.writeText/, 'clipboard failures must be observable')
assert.doesNotMatch(form, /\balert\(/, 'node form errors must use inline feedback instead of alerts')
assert.doesNotMatch(formStyles, /rgba?\(|(?:36|40)px|\.submitBtn|\.cancelBtn|\.input\b|\.textarea\b|\.select\b|\.typeSwitchBtn/i, 'legacy raw-control styling must not return')

assert.match(gallery, /PlatformField/, 'gallery captions must use the shared field primitive')
assert.match(gallery, /PlatformIconButton/, 'gallery actions must use the shared icon button primitive')
assert.doesNotMatch(gallery, /<(?:input|button)\b/, 'gallery controls must not use raw interactive elements')
assert.match(gallery, /onUploadStateChange/, 'gallery uploaders must forward pending state')
assert.match(gallery, /disabled=\{disabled \|\| index === 0\}/, 'gallery reorder controls must not unmount or mutate uploaders while pending')
assert.match(gallery, /variant="danger"[\s\S]*?disabled=\{disabled\}/, 'gallery delete must lock while uploads are pending')
assert.match(hero, /onUploadStateChange/, 'hero uploaders must forward pending state')
assert.ok((hero.match(/disabled=\{disabled/g) ?? []).length >= 8, 'hero accordions and media actions must lock while uploads are pending')
assert.match(imageUploader, /onUploadStateChange/, 'the shared uploader must expose pending state')
assert.match(imageUploader, /onUploadStateChange\?\.\(fileInputId, true\)/, 'upload start must register the keyed pending task')
assert.match(imageUploader, /onUploadStateChange\?\.\(fileInputId, false\)/, 'the actual upload completion must clear the keyed pending task')
assert.doesNotMatch(imageUploader, /return \(\) => \{[\s\S]{0,120}onUploadStateChange/, 'unmount must not report an in-flight upload as complete')
assert.match(siteSettings, /hasPendingUploads/, 'site settings must also coordinate shared uploader state')
assert.match(siteSettings, /disabled=\{isLoading \|\| hasPendingUploads\}/, 'site settings save must remain disabled during uploads')
assert.match(siteSettings, /<fieldset[^>]*disabled=\{isLoading \|\| hasPendingUploads\}/, 'site settings must prevent hero uploader unmount while uploads are pending')

assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.save_node\(\s*p_node_id UUID,\s*p_node JSONB,\s*p_hero_media JSONB,\s*p_gallery_photos JSONB\s*\)/i)
assert.match(migration, /SECURITY INVOKER/i)
assert.match(migration, /SET search_path = showroom, pg_temp/i)
for (const table of ['nodes', 'hero_media', 'gallery_photos']) {
  assert.match(migration, new RegExp(`DROP POLICY IF EXISTS auth_all_${table}`, 'i'))
  assert.match(migration, new RegExp(`CREATE POLICY authenticated_read_${table}[\\s\\S]*?FOR SELECT[\\s\\S]*?USING \\(true\\)`, 'i'))
  assert.match(migration, new RegExp(`CREATE POLICY administrator_write_${table}[\\s\\S]*?platform_private\\.is_admin`, 'i'))
}
assert.match(migration, /FROM platform\.profiles[\s\S]*?profile\.id = auth\.uid\(\)[\s\S]*?administrator/i)
assert.match(migration, /jsonb_typeof\(p_hero_media\) <> 'array'/i)
assert.match(migration, /jsonb_typeof\(p_gallery_photos\) <> 'array'/i)
assert.match(migration, /jsonb_array_length\(p_hero_media\)[\s\S]*?> 20/i)
assert.match(migration, /jsonb_array_length\(p_gallery_photos\)[\s\S]*?> 50/i)
assert.match(migration, /EXISTS[\s\S]*?parent_id = p_node_id[\s\S]*?type.*detail/i, 'server must reject detail conversion while children exist')
assert.match(migration, /sibling\.parent_id IS NOT DISTINCT FROM v_parent_id/i, 'slug collisions must be checked within the immutable parent scope')
assert.match(migration, /showroom\.nodes\.slug:[\s\S]*?v_parent_id/i, 'slug advisory locks must include the parent scope')
assert.equal((migration.match(/DELETE FROM showroom\.hero_media/gi) ?? []).length, 1, 'hero replacement must use one transactional delete')
assert.equal((migration.match(/DELETE FROM showroom\.gallery_photos/gi) ?? []).length, 1, 'gallery replacement must use one transactional delete')
assert.match(migration, /WITH ORDINALITY/i)
assert.match(migration, /INSERT INTO showroom\.hero_media[\s\S]*?INSERT INTO showroom\.gallery_photos/i, 'both media sets must be restored in the same transaction')
assert.doesNotMatch(migration, /IF v_type = 'listing' THEN[\s\S]*?INSERT INTO showroom\.hero_media[\s\S]*?ELSE[\s\S]*?INSERT INTO showroom\.gallery_photos/i, 'inactive media must not be erased during type conversion')
assert.doesNotMatch(migration, /EXCEPTION\s+WHEN/i, 'the RPC must not swallow failures that should roll back the transaction')
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.save_node\(UUID, JSONB, JSONB, JSONB\) FROM PUBLIC/i)
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.save_node\(UUID, JSONB, JSONB, JSONB\) FROM anon/i)
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.save_node\(UUID, JSONB, JSONB, JSONB\) FROM service_role/i)
assert.match(migration, /GRANT EXECUTE ON FUNCTION showroom\.save_node\(UUID, JSONB, JSONB, JSONB\) TO authenticated/i)

assert.match(fixture, /process\.env\.NODE_ENV === 'production'/, 'the fixture must be disabled in production')
assert.match(fixture, /notFound\(\)/, 'the fixture must return a production 404')

console.log('admin node form persistence contract passed')
