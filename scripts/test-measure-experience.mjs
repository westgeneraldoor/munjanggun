import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const measure = read('src/app/measure/MeasureExperience.tsx')
const measureCss = read('src/app/measure/measure.module.css')
const login = read('src/app/login/page.tsx')
const loginLayout = read('src/app/login/layout.tsx')
const portalPage = read('src/app/portal/measure/new/page.tsx')
const measureForm = read('src/app/portal/measure/new/MeasureForm.tsx')
const userMenu = read('src/components/customer/PublicUserMenu.tsx')
const callback = read('src/app/auth/callback/route.ts')
const proxy = read('src/proxy.ts')
const safeInternalPath = read('src/lib/safe-internal-path.ts')
const manifest = JSON.parse(read('public/images/measure/v2/manifest.json'))

assert.match(measure, /aria-pressed=\{activeHotspot === index\}/, 'hotspots must be real pressed buttons')
assert.match(measure, /\?concern=\$\{condition\.id\}/, 'condition choice must reach the application URL')
assert.match(measure, /IntersectionObserver/, 'mobile CTA and journey must use viewport state')
assert.match(measure, /data-visible=\{showMobileCta\}/, 'mobile CTA must expose deterministic visibility state')
assert.doesNotMatch(measure, /illustrative-(entryway|condition|level|photo)/, 'legacy multi-megabyte images must not be referenced')
assert.match(measureCss, /transform: translateY\(calc\(-100% - var\(--mg-space-4\)\)\)/, 'skip link must begin fully outside the viewport')
assert.match(measureCss, /\.skipLink:focus \{ transform: translateY\(0\); \}/, 'skip link must return on focus')
assert.match(measureCss, /\.hotspot \{ width: var\(--mg-control-size-min\); min-height: var\(--mg-control-size-min\)/, 'mobile hotspots need a 44px tokenized hit area')
assert.doesNotMatch(measureCss, /conditionCopy h3[^}]*font-family: var\(--mg-font-brand-ko\)/s, 'small headings must not use the Korean display face')

assert.match(loginLayout, /title: '문장군 로그인'/, 'login route needs explicit metadata')
assert.match(login, /실측견적 안내로 돌아가기/, 'measure login must preserve its return context')
assert.match(login, /source'\) === 'blog-question'/, 'blog-question login must preserve its own return context')
assert.match(login, /블로그 글로 돌아가기/, 'blog-question login must offer a visible blog return link')
assert.doesNotMatch(login, /10초 만에/, 'login copy must not make an unverified speed claim')
assert.match(login, /href: '\/measure'/, 'measure login return link must go back to the explainer')
assert.match(portalPage, /cabinet:.*finish:.*level:/s, 'application concern values must be allowlisted')
assert.match(portalPage, /Object\.hasOwn\(MEASURE_CONCERNS, concernParam\)/, 'concern allowlist must reject inherited object keys')
assert.match(portalPage, /nextParams\.set\('concern', concern\.id\)/, 'login next must preserve the safe concern')
assert.match(measureForm, /buildMeasureConcernMessage/, 'selected concern must prefill the application context')
assert.doesNotMatch(measureForm, /4~5시|오후 4/, 'visit time copy must not promise an unverified exact window')
assert.match(userMenu, /showLabelOnMobile/, 'measure navigation must support discoverable mobile login text')
assert.match(safeInternalPath, /value\.includes\('\\\\'\)/, 'internal next paths must reject backslashes')
assert.match(safeInternalPath, /parsed\.origin !== INTERNAL_BASE/, 'internal next paths must resolve against a fixed same-origin base')
assert.match(login, /getSafeInternalPath\(requestedNext\)/, 'login must use the shared next-path guard')
assert.match(callback, /getSafeInternalPath\(searchParams\.get\('next'\)\)/, 'OAuth callback must use the shared next-path guard')
assert.match(proxy, /getSafeInternalPath\(request\.nextUrl\.searchParams\.get\('next'\)\)/, 'authenticated login redirect must use the shared next-path guard')

assert.equal(manifest.assets.length, 6, 'exactly six generated explanatory assets are expected')
let largestHero = 0
let largestAvifSet = 0
for (const asset of manifest.assets) {
  let largestAssetAvif = 0
  for (const width of asset.widths) {
    for (const format of asset.formats) {
      const path = resolve(root, `public/images/measure/v2/${asset.id}-${width}.${format}`)
      assert.ok(existsSync(path), `missing responsive asset: ${path}`)
      const bytes = statSync(path).size
      if (asset.id === 'hero') largestHero = Math.max(largestHero, bytes)
      if (format === 'avif') largestAssetAvif = Math.max(largestAssetAvif, bytes)
    }
  }
  largestAvifSet += largestAssetAvif
}

assert.ok(largestHero <= 450 * 1024, `hero exceeds 450KB: ${largestHero}`)
assert.ok(largestAvifSet <= 1.5 * 1024 * 1024, `largest AVIF set exceeds 1.5MB: ${largestAvifSet}`)
console.log(`measure experience contract: PASS (hero ${largestHero}B, largest AVIF set ${largestAvifSet}B)`)
