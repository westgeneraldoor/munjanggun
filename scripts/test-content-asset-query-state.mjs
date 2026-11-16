import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(
  new URL('../src/app/admin/platform/assets/query-state.ts', import.meta.url),
  'utf8',
)
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const {
  ASSET_LIBRARY_PAGE_SIZE,
  assetLibraryRpcArgs,
  buildAssetLibraryUrl,
  parseAssetLibrarySearchParams,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const defaults = parseAssetLibrarySearchParams({})
assert.deepEqual(defaults, {
  search: '',
  view: 'active',
  category: '',
  productType: '',
  spaceType: '',
  region: '',
  usagePurpose: '',
  tagId: '',
  sort: 'newest',
  page: 1,
})
assert.equal(buildAssetLibraryUrl(defaults), '/admin/platform/assets')

const parsed = parseAssetLibrarySearchParams({
  q: '  현관   중문  ',
  view: 'archived',
  category: '시공후',
  product: '중문',
  space: '현관',
  region: '동탄',
  purpose: '블로그',
  tag: '11111111-1111-4111-8111-111111111111',
  sort: 'sizeDesc',
  page: '3',
})
assert.equal(
  buildAssetLibraryUrl(parsed),
  '/admin/platform/assets?q=%ED%98%84%EA%B4%80+%EC%A4%91%EB%AC%B8&view=archived&category=%EC%8B%9C%EA%B3%B5%ED%9B%84&product=%EC%A4%91%EB%AC%B8&space=%ED%98%84%EA%B4%80&region=%EB%8F%99%ED%83%84&purpose=%EB%B8%94%EB%A1%9C%EA%B7%B8&tag=11111111-1111-4111-8111-111111111111&sort=sizeDesc&page=3',
)
assert.deepEqual(assetLibraryRpcArgs(parsed), {
  p_search: '현관 중문',
  p_view: 'archived',
  p_category: '시공후',
  p_product_type: '중문',
  p_space_type: '현관',
  p_region: '동탄',
  p_usage_purpose: '블로그',
  p_tag_id: '11111111-1111-4111-8111-111111111111',
  p_sort: 'sizeDesc',
  p_page: 3,
  p_page_size: ASSET_LIBRARY_PAGE_SIZE,
})

const rejected = parseAssetLibrarySearchParams({
  q: ['ignored-array'],
  view: 'unknown',
  tag: 'not-a-uuid',
  sort: 'random',
  page: '-7',
})
assert.deepEqual(rejected, defaults)

console.log('content asset query-state contract passed')
