import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  buildDescendantGallery,
  paginateDescendantGallery,
} from '../src/lib/showroom/descendant-gallery.mjs'

const root = process.cwd()
const read = relativePath => readFile(path.join(root, relativePath), 'utf8')

const nodes = [
  { id: 'root', parent_id: null, name: '3연동 중문', slug: 'middle-door', display_order: 0 },
  { id: 'white', parent_id: 'root', name: '화이트', slug: 'white', display_order: 0 },
  { id: 'black', parent_id: 'root', name: '블랙', slug: 'black', display_order: 1 },
  { id: 'wood', parent_id: 'root', name: '우드', slug: 'wood', display_order: 2 },
  { id: 'white-mid', parent_id: 'white', name: '화이트 기본', slug: 'basic', display_order: 0 },
  { id: 'white-leaf', parent_id: 'white-mid', name: '화이트 유리', slug: 'glass', display_order: 0 },
  { id: 'black-leaf', parent_id: 'black', name: '블랙 유리', slug: 'glass', display_order: 0 },
  { id: 'wood-leaf', parent_id: 'wood', name: '우드 유리', slug: 'glass', display_order: 0 },
]

const photo = (id, nodeId, displayOrder, assetId = id) => ({
  id,
  node_id: nodeId,
  image_url: `https://images.example/${assetId}.jpg`,
  caption: null,
  display_order: displayOrder,
  asset_id: assetId,
})

const mixedDepthPhotos = [
  photo('white-1', 'white-mid', 0),
  photo('white-2', 'white-leaf', 0),
  photo('white-3', 'white-leaf', 1),
  photo('black-1', 'black-leaf', 0),
  photo('wood-1', 'wood-leaf', 0),
  photo('wood-2', 'wood-leaf', 1),
]

const gallery = buildDescendantGallery({
  currentNodeId: 'root',
  nodes: [...nodes].reverse(),
  photos: [...mixedDepthPhotos].reverse(),
})

assert.deepEqual(
  gallery.items.map(item => item.id),
  ['white-1', 'black-1', 'wood-1', 'white-2', 'wood-2', 'white-3'],
  'direct child options must interleave in display order even when their photos live on intermediate and leaf nodes',
)
assert.deepEqual(
  gallery.items.map(item => item.optionName),
  ['화이트 기본', '블랙 유리', '우드 유리', '화이트 유리', '우드 유리', '화이트 유리'],
  'every rendered photo must name the option node that owns the image',
)
assert.equal(gallery.items[1].sourceNodeUrl, '/middle-door/black/glass')
assert.equal(gallery.items[1].optionUrl, '/middle-door/black/glass')
assert.deepEqual(
  gallery.items[1].optionBreadcrumb,
  [nodes[0].name, nodes[2].name, nodes[6].name],
  'each card must retain its owner node breadcrumb for customer-facing context',
)
assert.deepEqual(
  gallery.items.map(item => item.bucketName),
  ['화이트', '블랙', '우드', '화이트', '우드', '화이트'],
  'the internal round-robin buckets must remain the current node direct children',
)

const deterministicRepeat = buildDescendantGallery({
  currentNodeId: 'root',
  nodes,
  photos: mixedDepthPhotos,
})
assert.deepEqual(
  deterministicRepeat.items.map(item => item.id),
  gallery.items.map(item => item.id),
  'the same data must always generate the same ordering regardless of input row ordering',
)

const withEmptyOption = buildDescendantGallery({
  currentNodeId: 'root',
  nodes,
  photos: [photo('black-only', 'black-leaf', 0)],
})
assert.deepEqual(withEmptyOption.buckets.map(bucket => bucket.name), ['블랙'])
assert.deepEqual(withEmptyOption.items.map(item => item.id), ['black-only'])

const withCurrentPhotos = buildDescendantGallery({
  currentNodeId: 'root',
  nodes,
  photos: [
    photo('all-1', 'root', 0),
    photo('all-2', 'root', 1),
    photo('white-1', 'white-leaf', 0),
    photo('black-1', 'black-leaf', 0),
  ],
})
assert.deepEqual(withCurrentPhotos.buckets.map(bucket => bucket.name), ['전체', '화이트', '블랙'])
assert.deepEqual(withCurrentPhotos.items.map(item => item.id), ['all-1', 'white-1', 'black-1', 'all-2'])

const nestedOptionDiversityNodes = [
  { id: 'nested-root', parent_id: null, name: '3연동 중문', slug: 'three-panel', display_order: 0 },
  { id: 'collection', parent_id: 'nested-root', name: '컬렉션', slug: 'collection', display_order: 0 },
  { id: 'color', parent_id: 'nested-root', name: '컬러', slug: 'color', display_order: 1 },
  { id: 'full-window', parent_id: 'collection', name: '풀윈도우', slug: 'full-window', display_order: 0 },
  { id: 'arch', parent_id: 'collection', name: '아치', slug: 'arch', display_order: 1 },
  { id: 'olive', parent_id: 'color', name: '올리브그린', slug: 'olive', display_order: 0 },
  { id: 'black', parent_id: 'color', name: '딥블랙', slug: 'black', display_order: 1 },
]

const nestedOptionDiversity = buildDescendantGallery({
  currentNodeId: 'nested-root',
  nodes: nestedOptionDiversityNodes,
  photos: [
    photo('full-window-1', 'full-window', 0),
    photo('full-window-2', 'full-window', 1),
    photo('arch-1', 'arch', 0),
    photo('olive-1', 'olive', 0),
    photo('olive-2', 'olive', 1),
    photo('black-1', 'black', 0),
  ],
})
assert.deepEqual(
  nestedOptionDiversity.items.map(item => item.id),
  ['full-window-1', 'olive-1', 'arch-1', 'black-1', 'full-window-2', 'olive-2'],
  'when a direct child is a category, its photo-owning descendants must also rotate before a single owner repeats',
)

const virtualRootGallery = buildDescendantGallery({
  currentNodeId: 'showroom-root',
  nodes: [
    { id: 'showroom-root', parent_id: null, name: '', slug: '', display_order: -1 },
    { id: 'middle-door', parent_id: 'showroom-root', name: '중문', slug: 'middle-door', display_order: 0 },
    { id: 'door', parent_id: 'showroom-root', name: '도어', slug: 'door', display_order: 1 },
    { id: 'three-panel', parent_id: 'middle-door', name: '3연동 중문', slug: '3panel', display_order: 0 },
    { id: 'swing-door', parent_id: 'door', name: '스윙도어', slug: 'swing', display_order: 0 },
  ],
  photos: [
    photo('middle-door-photo', 'three-panel', 0),
    photo('door-photo', 'swing-door', 0),
  ],
})
assert.deepEqual(virtualRootGallery.items.map(item => item.id), ['middle-door-photo', 'door-photo'])
assert.equal(virtualRootGallery.items[0].optionUrl, '/middle-door/3panel')
assert.equal(virtualRootGallery.items[1].optionUrl, '/door/swing')
assert.deepEqual(virtualRootGallery.items[0].optionBreadcrumb, ['중문', '3연동 중문'])
assert.deepEqual(virtualRootGallery.items[1].optionBreadcrumb, ['도어', '스윙도어'])

const duplicateAsset = buildDescendantGallery({
  currentNodeId: 'root',
  nodes,
  photos: [
    photo('white-original', 'white-leaf', 0, 'shared-asset'),
    photo('black-copy', 'black-leaf', 0, 'shared-asset'),
    photo('wood-unique', 'wood-leaf', 0, 'wood-asset'),
  ],
})
assert.deepEqual(
  duplicateAsset.items.map(item => item.id),
  ['white-original', 'wood-unique'],
  'a stable asset identifier must appear once and retain the earliest option bucket',
)

const selfCycleGallery = buildDescendantGallery({
  currentNodeId: 'self',
  nodes: [
    { id: 'self', parent_id: 'self', name: '순환 옵션', slug: 'self', display_order: 0 },
  ],
  photos: [photo('self-cycle-photo', 'self', 0)],
})
assert.deepEqual(
  selfCycleGallery.items.map(item => item.id),
  ['self-cycle-photo'],
  'a node that references itself must render once instead of repeatedly traversing its own child entry',
)
assert.deepEqual(
  buildDescendantGallery({
    currentNodeId: 'self',
    nodes: [
      { id: 'self', parent_id: 'self', name: '순환 옵션', slug: 'self', display_order: 0 },
    ],
    photos: [photo('self-cycle-photo', 'self', 0)],
  }),
  selfCycleGallery,
  'a self-cycle must remain finite and deterministic across rebuilds',
)

const twoNodeCycleInput = {
  currentNodeId: 'cycle-a',
  nodes: [
    { id: 'cycle-a', parent_id: 'cycle-b', name: 'A 옵션', slug: 'a', display_order: 0 },
    { id: 'cycle-b', parent_id: 'cycle-a', name: 'B 옵션', slug: 'b', display_order: 0 },
  ],
  photos: [
    photo('cycle-a-photo', 'cycle-a', 0),
    photo('cycle-b-photo', 'cycle-b', 0),
  ],
}
const twoNodeCycleGallery = buildDescendantGallery(twoNodeCycleInput)
assert.deepEqual(
  twoNodeCycleGallery.items.map(item => item.id),
  ['cycle-a-photo', 'cycle-b-photo'],
  'an A-to-B-to-A cycle must render each reachable photo once in stable queue order',
)
assert.deepEqual(
  buildDescendantGallery(twoNodeCycleInput).items.map(item => item.id),
  twoNodeCycleGallery.items.map(item => item.id),
  'a two-node cycle must remain finite and deterministic across rebuilds',
)
assert.deepEqual(
  buildDescendantGallery({
    ...twoNodeCycleInput,
    nodes: [...twoNodeCycleInput.nodes].reverse(),
    photos: [...twoNodeCycleInput.photos].reverse(),
  }).items.map(item => item.id),
  twoNodeCycleGallery.items.map(item => item.id),
  'a two-node cycle must preserve its ordering when source rows are reordered',
)

const firstPage = paginateDescendantGallery(gallery, 0, 2)
const secondPage = paginateDescendantGallery(gallery, firstPage.nextOffset, 2)
const thirdPage = paginateDescendantGallery(gallery, secondPage.nextOffset, 2)
assert.deepEqual(firstPage.items.map(item => item.id), ['white-1', 'black-1'])
assert.deepEqual(secondPage.items.map(item => item.id), ['wood-1', 'white-2'])
assert.deepEqual(thirdPage.items.map(item => item.id), ['wood-2', 'white-3'])
assert.equal(thirdPage.nextOffset, null)
assert.equal(new Set([...firstPage.items, ...secondPage.items, ...thirdPage.items].map(item => item.assetKey)).size, 6)

assert.deepEqual(
  buildDescendantGallery({ currentNodeId: 'root', nodes, photos: [] }),
  { buckets: [], items: [], total: 0 },
  'an empty gallery must remain an explicit, safe empty state',
)

const galleryComponent = await read('src/components/customer/DescendantGallery.tsx').catch(() => '')
assert.match(galleryComponent, /purpose="card"/)
assert.match(galleryComponent, /IntersectionObserver/)
assert.match(galleryComponent, /seenAssetKeys/)
assert.match(galleryComponent, /scrollActivationRef/)
assert.match(galleryComponent, /sessionStorage/)
assert.match(galleryComponent, /MODAL_HISTORY_KEY/)
assert.match(galleryComponent, /initialSnapshot/)
assert.match(galleryComponent, /gallery_snapshot_stale|SnapshotMismatch/)
assert.doesNotMatch(galleryComponent, /_next\/image|_vercel\/image/)
assert.match(galleryComponent, /option_breadcrumb: item\.optionBreadcrumb/)
assert.match(galleryComponent, /galleryScope === 'root'/)
assert.match(galleryComponent, /완성된 공간/)
assert.doesNotMatch(galleryComponent, /현재 선택|쇼룸 갤러리|이미지 갤러리/)

const lightboxComponent = await read('src/components/customer/ImageLightbox.tsx')
assert.match(lightboxComponent, /option_breadcrumb\?: string\[\]/)
assert.match(lightboxComponent, /const optionBreadcrumb = currentPhoto\.option_breadcrumb/)
assert.match(lightboxComponent, /requestShowroomScrollReset/)
assert.match(lightboxComponent, /isNavigatingToOptionRef/)
assert.match(lightboxComponent, /scroll=\{false\}/)
assert.doesNotMatch(lightboxComponent, /window\.scrollTo\(\{ top: 0, behavior: 'instant' \}\)/)
assert.match(lightboxComponent, /focus\(\{ preventScroll: true \}\)/)

const lightboxStyles = await read('src/components/customer/ImageLightbox.module.css')
assert.match(lightboxStyles, /\.optionBreadcrumb/)

const scrollRestorer = await read('src/components/customer/ScrollRestorer.tsx')
assert.match(scrollRestorer, /usePathname/)
assert.match(scrollRestorer, /catalog-scroll-y:/)
assert.match(scrollRestorer, /SHOWROOM_SCROLL_RESET_PATH_KEY/)
assert.match(scrollRestorer, /window\.location\.pathname/)
assert.match(scrollRestorer, /window\.scrollY\.toString\(\)/)
assert.match(scrollRestorer, /getItem\(SHOWROOM_SCROLL_RESET_PATH_KEY\) !== null/)
assert.match(scrollRestorer, /window\.sessionStorage\.removeItem\(storageKey\)/)
assert.match(scrollRestorer, /window\.scrollTo\(\{ top: 0, behavior: 'instant' \}\)/)

const galleryData = await read('src/lib/showroom/descendant-gallery-data.ts')
const galleryRoute = await read('src/app/api/showroom/descendant-gallery/route.ts')
assert.match(galleryData, /createHash\('sha256'\)/)
assert.match(galleryData, /DescendantGallerySnapshotMismatchError/)
assert.match(galleryData, /ROOT_DESCENDANT_GALLERY_ID/)
assert.match(galleryRoute, /status: 409/)
assert.match(galleryRoute, /scope === 'root'/)
assert.match(galleryData, /SHOWROOM_CATALOG_CACHE_TAG/)
assert.match(galleryData, /tags: \[SHOWROOM_CATALOG_CACHE_TAG\]/)

const catalogRevalidation = await read('src/app/admin/nodes/catalog-revalidation.ts')
assert.match(catalogRevalidation, /updateTag\(SHOWROOM_CATALOG_CACHE_TAG\)/)
assert.match(catalogRevalidation, /revalidatePath\('\/'\)/)
assert.match(catalogRevalidation, /revalidatePath\('\/\[\.\.\.slugs\]', 'page'\)/)

const nodeForm = await read('src/components/admin/NodeForm.tsx')
assert.match(nodeForm, /await refreshShowroomCatalogCache\(\)/)

const galleryStyles = await read('src/components/customer/DescendantGallery.module.css')
assert.match(galleryStyles, /aspect-ratio: 3 \/ 4/)
assert.match(galleryStyles, /object-fit: cover/)
assert.match(galleryStyles, /border-radius: var\(--radius-lg\)/)
assert.match(galleryStyles, /\.optionBreadcrumb/)
assert.match(galleryStyles, /cursor: pointer/)
assert.match(galleryStyles, /width: 100%/)
assert.match(galleryStyles, /margin-inline: auto/)
assert.match(galleryStyles, /\.imageButton:active \.imageFrame/)
assert.match(galleryStyles, /\.imageButton:hover \.imageFrame/)
assert.match(galleryStyles, /\.imageButton:hover:active \.imageFrame/)
assert.match(galleryStyles, /transform: scale\(1\.025\)/)

const nodeCardStyles = await read('src/components/customer/NodeCard.module.css')
assert.match(nodeCardStyles, /\.imageWrapper\s*\{[\s\S]*?aspect-ratio: 3 \/ 5/)
assert.match(nodeCardStyles, /\.content::before/)
assert.match(nodeCardStyles, /\.card:focus-visible/)
assert.match(nodeCardStyles, /transform: translateY\(-5px\)/)
assert.match(nodeCardStyles, /transform: scale\(1\.055\)/)
assert.match(nodeCardStyles, /\.card:hover:active/)

const nodeCard = await read('src/components/customer/NodeCard.tsx')
assert.match(nodeCard, /requestShowroomScrollReset\(href\)/)
assert.match(nodeCard, /scroll=\{false\}/)
assert.doesNotMatch(nodeCard, /window\.scrollTo\(\{ top: 0, behavior: 'instant' \}\)/)
assert.match(nodeCard, /event\.metaKey/)
