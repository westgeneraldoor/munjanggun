import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const measure = read('src/app/measure/MeasureExperience.tsx')
const measureCss = read('src/app/measure/measure.module.css')
const brandCss = read('src/styles/munjanggun-brand.css')
const login = read('src/app/login/page.tsx')
const loginLayout = read('src/app/login/layout.tsx')
const portalPage = read('src/app/portal/measure/new/page.tsx')
const measureForm = read('src/app/portal/measure/new/MeasureForm.tsx')
const visitDatePicker = read('src/components/platform/VisitDatePicker.tsx')
const userMenu = read('src/components/customer/PublicUserMenu.tsx')
const callback = read('src/app/auth/callback/route.ts')
const proxy = read('src/proxy.ts')
const safeInternalPath = read('src/lib/safe-internal-path.ts')
const manifest = JSON.parse(read('public/images/measure/v2/manifest.json'))

assert.match(measure, /aria-pressed=\{activeHotspot === index\}/, 'hotspots must be real pressed buttons')
assert.match(measure, /import BlogBrandWordmark from '@\/app\/blog\/BlogBrandWordmark'/, 'measure must reuse the approved blog wordmark family')
assert.match(measure, /href="\/blog"[\s\S]*aria-label="문장군 블로그로 이동"/, 'measure wordmark must link to the blog')
assert.match(measure, /<BlogBrandWordmark[\s\S]*label="무료견적"/, 'measure wordmark must read MUNJANGGUN 무료견적')
assert.match(measure, /selectedConditionId/, 'measure must track an explicit condition choice separately from the displayed tab')
assert.match(measure, /selectedConditionId[\s\S]*\? `\/portal\/measure\/new\?concern=\$\{selectedConditionId\}`[\s\S]*: '\/portal\/measure\/new'/, 'only an explicit condition choice may reach the application URL')
assert.match(measure, /IntersectionObserver/, 'mobile CTA and journey must use viewport state')
assert.match(measure, /data-visible=\{showMobileCta\}/, 'mobile CTA must expose deterministic visibility state')
assert.doesNotMatch(measure, /illustrative-(entryway|condition|level|photo)/, 'legacy multi-megabyte images must not be referenced')
assert.match(measureCss, /transform: translateY\(calc\(-100% - var\(--mg-space-4\)\)\)/, 'skip link must begin fully outside the viewport')
assert.match(measureCss, /\.skipLink:focus \{ transform: translateY\(0\); \}/, 'skip link must return on focus')
assert.match(measureCss, /\.brand \{[\s\S]*min-height: var\(--mg-control-size-min\)/, 'wordmark link needs a tokenized 44px touch target')
assert.match(measureCss, /\.conditions, \.process, \.prepare \{ scroll-margin-top:/, 'sticky navigation targets need a scroll offset')
assert.match(measureCss, /\.hotspot \{ width: var\(--mg-control-size-min\); min-height: var\(--mg-control-size-min\)/, 'mobile hotspots need a 44px tokenized hit area')
assert.doesNotMatch(measureCss, /conditionCopy h3[^}]*font-family: var\(--mg-font-brand-ko\)/s, 'small headings must not use the Korean display face')

assert.match(loginLayout, /title: '문장군 로그인'/, 'login route needs explicit metadata')
assert.match(login, /실측견적 안내로 돌아가기/, 'measure login must preserve its return context')
assert.match(login, /parsedNext\.pathname === '\/measure'/, 'top navigation login must recognize the measure explainer context')
assert.match(login, /source'\) === 'blog-question'/, 'blog-question login must preserve its own return context')
assert.match(login, /블로그 글로 돌아가기/, 'blog-question login must offer a visible blog return link')
assert.doesNotMatch(login, /10초 만에/, 'login copy must not make an unverified speed claim')
assert.match(login, /href: '\/measure'/, 'measure login return link must go back to the explainer')
assert.match(portalPage, /cabinet:.*finish:.*level:/s, 'application concern values must be allowlisted')
assert.match(portalPage, /Object\.hasOwn\(MEASURE_CONCERNS, concernParam\)/, 'concern allowlist must reject inherited object keys')
assert.match(portalPage, /nextParams\.set\('concern', concern\.id\)/, 'login next must preserve the safe concern')
assert.match(measureForm, /buildMeasureConcernMessage/, 'selected concern must prefill the application context')
const unsupportedVisitPromise = /방문\s*전날|오후\s*4\s*[~～-]\s*5시|전날\s*코스|코스(?:를)?\s*(?:마감|확정)/
assert.doesNotMatch(measureForm, unsupportedVisitPromise, 'measure form must not promise an unsupported visit schedule')
assert.doesNotMatch(visitDatePicker, unsupportedVisitPromise, 'visit date picker must not promise an unsupported visit schedule')
assert.match(measureForm, /희망일과 지역별 방문 코스를 확인한 뒤 방문 시간을 안내드립니다/, 'measure form must use neutral visit-time guidance')
assert.match(visitDatePicker, /희망일과 지역별 방문 코스를 확인한 뒤 연락으로 안내드립니다/, 'visit date picker must use neutral visit-time guidance')
assert.match(userMenu, /showLabelOnMobile/, 'measure navigation must support discoverable mobile login text')
assert.match(safeInternalPath, /value\.includes\('\\\\'\)/, 'internal next paths must reject backslashes')
assert.match(safeInternalPath, /parsed\.origin !== INTERNAL_BASE/, 'internal next paths must resolve against a fixed same-origin base')
assert.match(login, /getSafeInternalPath\(requestedNext\)/, 'login must use the shared next-path guard')
assert.match(callback, /getSafeInternalUrl\(searchParams\.get\('next'\), origin\)/, 'OAuth callback must use the shared same-origin URL guard')
assert.match(proxy, /getSafeInternalUrl\(request\.nextUrl\.searchParams\.get\('next'\), request\.url\)/, 'authenticated login redirect must use the shared same-origin URL guard')

const optimizedFontPath = resolve(root, 'public/assets/fonts/TmoneyRoundWindExtraBold.measure.woff2')
assert.ok(existsSync(optimizedFontPath), 'measure needs an optimized Tmoney WOFF2 subset')
assert.ok(statSync(optimizedFontPath).size <= 400 * 1024, `optimized Tmoney subset exceeds 400KB: ${statSync(optimizedFontPath).size}`)
assert.match(brandCss, /font-family: "Tmoney RoundWind Measure"/, 'project adapter must register the optimized measure font')

const iconPath = resolve(root, 'src/app/icon.png')
assert.ok(statSync(iconPath).size <= 24 * 1024, `app icon exceeds 24KB: ${statSync(iconPath).size}`)

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
