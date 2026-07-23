import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const client = await readFile(new URL('../src/app/admin/platform/assets/ContentAssetsClient.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/app/admin/platform/assets/assets.module.css', import.meta.url), 'utf8')
const actions = await readFile(new URL('../src/app/admin/platform/assets/actions.ts', import.meta.url), 'utf8')
const previewRoute = await readFile(new URL('../src/app/admin/platform/assets/[assetId]/preview/route.ts', import.meta.url), 'utf8')
const archiveMigration = await readFile(new URL('../supabase/migrations/20260722090100_content_asset_recoverable_archive.sql', import.meta.url), 'utf8')

for (const primitive of [
  'PlatformButton',
  'PlatformCheckbox',
  'PlatformField',
  'PlatformPageHeader',
  'PlatformPanel',
  'PlatformSegmentedControl',
  'PlatformSelect',
  'PlatformStatePanel',
  'PlatformStatusBadge',
]) {
  assert.match(client, new RegExp(`\\b${primitive}\\b`), `${primitive} must be used by the assets route`)
}

assert.doesNotMatch(client, /className=\{styles\.(?:primaryButton|secondaryButton|errorState|emptyState)\}/, 'shared control and state styles must not be reimplemented')
assert.doesNotMatch(client, /<input[^>]*aria-label="사진 검색"/, 'asset search must use the shared field')
assert.doesNotMatch(client, /<select\b/, 'asset filters must use the shared select')
assert.doesNotMatch(client, /<input[^>]*type="checkbox"/, 'asset review checks must use the shared checkbox')
assert.doesNotMatch(styles, /\.(?:primaryButton|secondaryButton|errorState|emptyState)\s*\{/, 'duplicate primitive CSS must be removed')
assert.doesNotMatch(styles, /\.(?:uploadFields|detailForm|selectedPreviewBody)\s+(?:input|textarea)/, 'route CSS must not override shared field controls')
assert.doesNotMatch(styles, /\.filterGrid\s+(?:label|select)|\.searchBox|\.uploadReview\s+input/, 'route CSS must not reimplement shared filter and checkbox controls')
assert.doesNotMatch(styles, /#[0-9a-f]{3,8}|rgba?\(/i, 'route CSS must use semantic tokens instead of raw colors')
assert.match(styles, /\.cardThumb\s*\{[^}]*aspect-ratio:\s*1(?:\s*\/\s*1)?/s, 'asset cards must use square image thumbnails')
assert.match(styles, /\.cardTitle\s*\{[^}]*white-space:\s*nowrap[^}]*text-overflow:\s*ellipsis/s, 'asset cards must show a single-line truncated title')
assert.match(client, /const SORT_OPTIONS[\s\S]*최신순[\s\S]*오래된순[\s\S]*파일명 오름차순[\s\S]*파일명 내림차순[\s\S]*용량 큰순[\s\S]*용량 작은순/, 'asset toolbar must expose all six requested sort orders')
assert.match(client, /const \[selectionMode, setSelectionMode\]/, 'asset selection must be an explicit mode')
assert.match(client, /selectionMode\s*\?\s*\([\s\S]*PlatformCheckbox/, 'asset checkboxes must only render in selection mode')
assert.match(client, /shiftKey/, 'asset selection must support Shift range selection')
assert.match(client, /onPointerDown=\{handlePointerDown\}[\s\S]*onPointerMove=\{handlePointerMove\}[\s\S]*onPointerUp=\{handlePointerUp\}/, 'asset grid must support desktop pointer-drag selection')
assert.match(client, /현재 결과 전체 선택/, 'current results must support accessible bulk selection')
assert.match(client, /현재 결과 전체 해제/, 'current results must support accessible bulk clear')
assert.match(client, /visibleItems[\s\S]*더 보기/, 'large result sets must use progressive rendering')
assert.match(client, /data-asset-card-button[\s\S]*aria-label=\{selectionMode[\s\S]*선택 해제[\s\S]*상세 보기/, 'the whole asset card must expose its current detail or selection action')
assert.match(client, /<PlatformModal[\s\S]*closeOnBackdrop[\s\S]*showCloseButton[\s\S]*closeLabel="사진 상세 닫기"/, 'asset detail must close by backdrop, Escape, or an explicit close button')
assert.match(client, /loading="lazy"/, 'asset thumbnails must remain viewport-near lazy loaded')
assert.match(client, /role="status" aria-live="polite"/, 'asset detail save feedback must be announced')
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/, 'asset route animation must respect reduced motion')
assert.match(styles, /content-visibility:\s*auto/, 'large asset collections should skip off-screen rendering work')
assert.match(client, /사용처 확인 후 휴지통으로 이동/, 'trash confirmation must state the server-side reference check')
assert.match(client, /사용처 보기/, 'blocked archive results must provide a usage-view action')
assert.match(client, /휴지통에서 복원/, 'trashed assets must have a restore path')
assert.match(client, /안전한 미리보기를 불러오지 못했습니다/, 'broken image states must explain recovery')
assert.match(actions, /archive_content_assets_safely/, 'archive actions must use the atomic server RPC')
const archiveActionSlice = actions.slice(actions.indexOf('export async function archiveContentAssets'))
assert.doesNotMatch(archiveActionSlice, /storage\.from\([^\n]+\)\.remove/, 'archive actions must never remove storage objects')
assert.match(previewRoute, /createPlatformClient/, 'preview route must authenticate through platform cookies')
assert.match(previewRoute, /profile\?\.role !== 'administrator'/, 'preview route must require administrator role')
assert.match(previewRoute, /export async function HEAD/, 'image recovery probe must use the same authenticated opaque route')
assert.match(previewRoute, /private, no-store, max-age=0/, 'preview route must not permit shared caching')
assert.doesNotMatch(previewRoute, /createSignedUrl/, 'preview route must stream opaque bytes rather than leak signed storage URLs')
assert.match(archiveMigration, /FOR UPDATE/, 'archive RPC must lock rows before rechecking references')
assert.match(archiveMigration, /FOR KEY SHARE/, 'new references must serialize against the archive row lock')
assert.match(archiveMigration, /FROM unnest\(p_asset_ids\) AS candidate_id[\s\S]*ORDER BY candidate_id/, 'bulk archive must lock assets in a deterministic order')
assert.match(archiveMigration, /reject_archived_content_asset_blog_media_reference/, 'blog media inserts must reject archived assets at the database boundary')
assert.match(archiveMigration, /reject_archived_content_asset_usage_reference/, 'usage-ledger writes must reject archived assets at the database boundary')
assert.match(archiveMigration, /showroom\.blog_media/, 'archive RPC must inspect direct blog media references')
assert.match(archiveMigration, /showroom\.blog_blocks/, 'archive RPC must inspect body block references')
assert.match(archiveMigration, /showroom\.content_asset_usages/, 'archive RPC must inspect the asset usage ledger')
assert.doesNotMatch(archiveMigration, /\bAS\s+references\b/i, 'archive migration must not use the reserved REFERENCES keyword as an alias')
assert.doesNotMatch(archiveMigration, /DELETE\s+FROM\s+(?:storage\.|showroom\.content_assets)/i, 'archive migration must remain recoverable and never delete assets')

console.log('admin assets primitive contract passed')
