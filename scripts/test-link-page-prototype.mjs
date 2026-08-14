import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [model, studio, renderer, publicClient, publicRoute, repository, studioCss, rendererCss] = await Promise.all([
  read('src/lib/link-pages/model.ts'),
  read('src/components/link-pages/LinkPageStudio.tsx'),
  read('src/components/link-pages/LinkPageRenderer.tsx'),
  read('src/components/link-pages/PublicLinkPageClient.tsx'),
  read('src/app/l/[slug]/page.tsx'),
  read('src/lib/link-pages/browser-repository.ts'),
  read('src/components/link-pages/LinkPageStudio.module.css'),
  read('src/components/link-pages/LinkPageRenderer.module.css'),
])

const allowedKinds = ['profile', 'singleLink', 'groupLink', 'text', 'gallery', 'video', 'fileShare']
for (const kind of allowedKinds) assert.match(model, new RegExp(`\\| '${kind}'|kind: '${kind}'`), `missing block kind ${kind}`)

const typeSection = model.match(/export type LinkBlockKind =([\s\S]*?)export type AssetReference/)?.[1] ?? ''
const declaredKinds = [...typeSection.matchAll(/'([^']+)'/g)].map((match) => match[1])
assert.deepEqual(declaredKinds, allowedKinds, 'the prototype must expose exactly the approved seven block kinds')

assert.match(studio, /import \{ LinkPageRenderer \} from '\.\/LinkPageRenderer'/, 'editor preview must import the canonical renderer')
assert.match(publicClient, /import \{ LinkPageRenderer \} from '\.\/LinkPageRenderer'/, 'public page must import the canonical renderer')
assert.equal((renderer.match(/function BlockRenderer/g) ?? []).length, 1, 'one block renderer entry point is required')
assert.match(publicRoute, /const \{ slug \} = await params/, 'Next 16 dynamic params must be awaited')
assert.match(publicClient, /router\.replace\(`\/l\/\$\{resolved\.page\.slug\}`\)/, 'old slugs must resolve to the canonical flat URL')
assert.match(model, /slugAliases: string\[\]/, 'slug aliases are required')
assert.match(model, /Boolean\(url\.hostname\)/, 'http URLs must include a real hostname')
assert.match(model, /page\.slugAliases\.filter\(\(alias\) => alias !== slug\)/, 'returning to an old slug must remove it from aliases')
assert.match(model, /parentId: string \| null/, 'tree parent_id equivalent is required')
assert.match(model, /sortOrder: number/, 'stable ordering is required')
assert.match(model, /getPageDescendantIds/, 'tree pages must support arbitrary depth')
assert.match(model, /canSetPageParent/, 'tree page edits must reject cycles')
assert.match(model, /getOrderedPageTree/, 'page rail must render a depth-first tree')
assert.match(model, /normalizePageOrders/, 'page sibling orders must be normalized after mutations')
assert.match(model, /profileCount !== 1/, 'stored state must validate the fixed profile block')
assert.match(publicClient, /pageViewEvent\.current\?\.pageId !== result\.page\.id/, 'page views need a fresh event id per page')
assert.match(model, /clone\.id = createId\(\)/, 'block copies must receive a new immutable ID')
assert.match(repository, /LINK_PAGE_STORAGE_KEY/, 'structured prototype state must persist')
assert.match(repository, /recordEvent\(event/, 'event recording must exist')
assert.match(studio, /id: 'analytics'/)
assert.match(studio, /id: 'manage'/)
assert.match(studio, /id: 'marketing'/)
assert.match(studio, /BLOCK_PICKER[\s\S]*singleLink[\s\S]*groupLink[\s\S]*text[\s\S]*gallery[\s\S]*video[\s\S]*fileShare/)
assert.match(studio, /draggable=\{block\.kind !== 'profile'\}/, 'non-profile blocks must support drag reordering')
assert.match(studio, /className=\{styles\.insertBlock\}/, 'blocks need the observed between-card insertion affordance')
assert.match(studio, /originalPrice/, 'link editors must expose the observed original price field')
assert.match(studio, /title="그룹 링크 편집"/, 'group link items need a complete editing dialog')
assert.match(studio, /이미지 슬라이드/, 'gallery slideshow must be configurable')
assert.match(studioCss, /\.uploadBox/, 'file and image inputs need the observed upload-card affordance')
assert.match(studioCss, /\.layoutPicker/, 'layout choices need the observed pictogram-tile affordance')
assert.match(studio, /disabled=\{!valid\} onClick=\{saveItem\}/, 'group items must not save before required fields are valid')
assert.match(renderer, /className=\{styles\.groupPrice\}/, 'group link prices must reach the shared renderer')
assert.doesNotMatch(studio, /data-block-picker-kind=\"(music|map|contact|reservation|payment)\"/, 'out-of-scope blocks must not enter the picker')
assert.match(studioCss, /@media \(max-width: 540px\)/, 'editor needs a narrow-screen safety layout')
assert.match(rendererCss, /@media \(max-width: 540px\)/, 'public renderer needs a 390px layout')
assert.match(rendererCss, /\.public \{ width: 100%; box-shadow: none; \}/, 'mobile public view must remove the desktop frame')

const hybridWorker = await read('infra/cloudflare/hybrid-preview/src/index.ts')
assert.match(hybridWorker, /'\/l'/, 'public flat URLs must route to the app origin')
assert.match(hybridWorker, /'\/link-pages'/, 'the prototype editor must route to the app origin')

console.log('Link page prototype source contracts passed')
