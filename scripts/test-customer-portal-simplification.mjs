import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

const [login, loginCss, portal, portalCss, collection, intakeNav, intakeNavCss, measureCss, asCss] = await Promise.all([
  source('src/app/login/page.tsx'),
  source('src/app/login/login.module.css'),
  source('src/app/portal/page.tsx'),
  source('src/app/portal/portal.module.css'),
  source('src/components/platform/customer/CustomerCollectionPanel.tsx'),
  source('src/components/platform/customer/CustomerIntakeTopNav.tsx'),
  source('src/components/platform/customer/CustomerIntakeTopNav.module.css'),
  source('src/app/portal/measure/new/measure-form.module.css'),
  source('src/app/portal/as/new/as-form.module.css'),
])

for (const surface of [login, portal]) {
  assert.match(surface, /<MunjanggunWordmark label="MY"/)
  assert.doesNotMatch(surface, />쇼룸 홈</)
  assert.doesNotMatch(surface, /className=\{styles\.brandKo\}/)
}

assert.doesNotMatch(login, /import \{[^}]*\bHome\b[^}]*\} from 'lucide-react'/)
assert.equal((login.match(/href="\/blog"/g) ?? []).length, 1, 'login must expose one clear return path to the blog')
assert.match(loginCss, /\.title\s*\{[\s\S]*?font-family:\s*var\(--mg-font-body\)/)
assert.doesNotMatch(loginCss, /\.homeLink\s*\{/)
assert.doesNotMatch(portalCss, /\.brandKo\s*\{/)
assert.match(portalCss, /\.accountMenu button\s*\{[\s\S]*?min-height:\s*44px/)
assert.match(portalCss, /\.requestActions button\s*\{[\s\S]*?min-height:\s*44px/)
assert.match(portal, /<label[^>]*htmlFor="customer-action-memo"/)
assert.match(portal, /if \(event\.key === 'Escape'/)
assert.match(portal, /modalTextareaRef\.current\?\.focus\(\)/)
assert.match(collection, /function getQuestionStatusLabel\(/)
assert.doesNotMatch(collection, /\? item\.status === 'private' \? '비공개' : item\.status/)
assert.match(portal, /const \[activityError, setActivityError\]/)
assert.match(portal, /errorMessage=\{activityError\}/)
assert.match(collection, /errorMessage\?: string \| null/)
assert.match(collection, /role="alert"/)
assert.match(intakeNav, /<MunjanggunWordmark label="MY"/)
assert.doesNotMatch(intakeNav, /\bHome\b|className=\{styles\.iconLink\}/)

for (const stylesheet of [intakeNavCss, measureCss, asCss]) {
  assert.doesNotMatch(
    stylesheet,
    /font-family:\s*var\(--mg-font-brand-ko\)/,
    'small and wrapping customer-interface headings must use the body typeface',
  )
}

console.log('customer portal simplification contracts passed')
