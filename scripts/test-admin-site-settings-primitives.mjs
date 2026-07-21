import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8').catch(() => '')

const [page, form, formStyles, heroConfigurator, imageUploader, migration, fixture] = await Promise.all([
  read('src/app/admin/settings/page.tsx'),
  read('src/components/admin/SiteSettingsForm.tsx'),
  read('src/components/admin/SiteSettingsForm.module.css'),
  read('src/components/admin/HeroConfigurator.tsx'),
  read('src/components/admin/ImageUploader.tsx'),
  read('supabase/migrations/20260720074843_atomic_site_settings_save.sql'),
  read('src/app/test-fixtures/admin-site-settings/page.tsx'),
])

for (const primitive of ['PlatformPageHeader', 'PlatformPanel', 'PlatformStatePanel']) {
  assert.match(page, new RegExp(`\\b${primitive}\\b`), `settings page must use ${primitive}`)
}
assert.match(page, /settingsError/, 'settings query errors must be handled explicitly')
assert.match(page, /heroMediaError/, 'hero media query errors must be handled explicitly')
assert.match(page, /profile\?\.role === 'administrator'/, 'the settings page must fail closed for non-administrators')
assert.match(page, /\.eq\('id', 'singleton'\)[\s\S]*?\.maybeSingle\(\)/, 'a missing singleton must remain an initializable state')
assert.doesNotMatch(page, /heroMedia\s*\|\|\s*\[\]/, 'load errors must not be disguised as an empty media list')

for (const primitive of ['PlatformField', 'PlatformSelect', 'PlatformButton', 'PlatformStatePanel', 'PlatformSwitch']) {
  assert.match(form, new RegExp(`\\b${primitive}\\b`), `settings form must use ${primitive}`)
}
assert.doesNotMatch(form, /<(?:input|select|textarea|button)\b/, 'settings form core controls must use shared primitives')
assert.match(form, /\.rpc\(['"]save_site_settings['"]/, 'settings and hero media must be saved through one RPC')
assert.doesNotMatch(form, /\.from\(['"](?:site_settings|site_hero_media)['"]\)/, 'the form must not write settings tables directly')
assert.match(form, /isLoading=\{isLoading\}/, 'the save button must expose its loading state')
assert.match(form, /const updateField[\s\S]*?setSuccess\(false\)/, 'editing after save must clear the success state')
assert.doesNotMatch(formStyles, /rgba?\(|(?:36|40)px|\.submitBtn|\.input\b|\.textarea\b|\.select\b/i, 'legacy raw-control styling must not return')

assert.doesNotMatch(heroConfigurator, /<div className=\{styles\.sectionHeader\} onClick=/, 'hero sections must not use click-only divs')
assert.match(heroConfigurator, /className=\{styles\.sectionHeader\}[\s\S]*?aria-expanded=/, 'hero section buttons must expose their expanded state')
assert.match(heroConfigurator, /aria-controls=/, 'hero section buttons must identify their controlled panel')
assert.doesNotMatch(heroConfigurator, /image_url\s*=\s*''/, 'removing hero media must remove the item instead of persisting an empty URL')
assert.match(heroConfigurator, /htmlFor=\{desktopVideoInputId\}/, 'the desktop video URL must have a label')
assert.match(heroConfigurator, /htmlFor=\{mobileVideoInputId\}/, 'the mobile video URL must have a label')
assert.doesNotMatch(imageUploader, /<div\s+[^>]*className=\{`\$\{styles\.dropzone\}/, 'the empty uploader must not be a click-only div')
assert.match(imageUploader, /<button\s+[^>]*className=\{`\$\{styles\.dropzone\}/, 'the empty uploader must use a native button')
assert.match(imageUploader, /aria-label="이미지 파일 선택"/, 'the hidden file input must retain an accessible name')
assert.doesNotMatch(imageUploader, /storage\.from\(bucketName\)\.remove/, 'the client uploader must not delete stored originals before the enclosing form commits')

assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.save_site_settings\(p_settings JSONB, p_media JSONB\)/i)
assert.match(migration, /SECURITY INVOKER/i)
assert.match(migration, /SET search_path = showroom, pg_temp/i)
assert.match(migration, /DROP POLICY IF EXISTS auth_all_site_settings/i)
assert.match(migration, /DROP POLICY IF EXISTS auth_all_site_hero_media/i)
assert.match(migration, /CREATE POLICY authenticated_read_site_settings[\s\S]*?FOR SELECT[\s\S]*?USING \(true\)/i)
assert.match(migration, /CREATE POLICY administrator_write_site_settings[\s\S]*?platform_private\.is_admin/i)
assert.match(migration, /CREATE POLICY authenticated_read_site_hero_media[\s\S]*?FOR SELECT[\s\S]*?USING \(true\)/i)
assert.match(migration, /CREATE POLICY administrator_write_site_hero_media[\s\S]*?platform_private\.is_admin/i)
assert.match(migration, /IF NOT EXISTS[\s\S]*?FROM platform\.profiles[\s\S]*?profile\.id = auth\.uid\(\)[\s\S]*?administrator/i)
assert.match(migration, /jsonb_typeof\(p_media\) <> 'array'/i)
assert.match(migration, /v_media_count\s*:=\s*jsonb_array_length\(p_media\)/i)
assert.match(migration, /IF v_media_count > 20/i)
assert.match(migration, /DELETE FROM showroom\.site_hero_media/i)
assert.match(migration, /WITH ORDINALITY/i)
assert.equal((migration.match(/DELETE FROM showroom\.site_hero_media/gi) ?? []).length, 1, 'hero media must be replaced by one delete inside the RPC')
assert.doesNotMatch(migration, /EXCEPTION\s+WHEN/i, 'the RPC must not swallow failures that should roll back the transaction')
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.save_site_settings\(JSONB, JSONB\) FROM PUBLIC/i)
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.save_site_settings\(JSONB, JSONB\) FROM anon/i)
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.save_site_settings\(JSONB, JSONB\) FROM service_role/i)
assert.match(migration, /GRANT EXECUTE ON FUNCTION showroom\.save_site_settings\(JSONB, JSONB\) TO authenticated/i)

assert.match(fixture, /process\.env\.NODE_ENV === 'production'/, 'the fixture must be disabled in production')
assert.match(fixture, /notFound\(\)/, 'the fixture must return a production 404')

console.log('admin site settings primitive contract passed')
