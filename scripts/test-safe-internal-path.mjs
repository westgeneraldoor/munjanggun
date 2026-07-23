import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = path => readFileSync(resolve(root, path), 'utf8')
const helperSource = read('src/lib/safe-internal-path.ts')
const loginSource = read('src/app/login/page.tsx')
const callbackSource = read('src/app/auth/callback/route.ts')
const proxySource = read('src/proxy.ts')

const { outputText } = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'safe-internal-path.ts',
})
const helperModuleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
const { getSafeInternalPath, getSafeInternalUrl } = await import(helperModuleUrl)

const APP_ORIGIN = 'https://app.munjanggun.test'
const ATTACK_PATH = '/%2e%2e/%2e%2e//evil.com'
const ATTACK_QUERY = 'next=%2F%252e%252e%2F%252e%252e%2F%2Fevil.com'

function assertSafeFallback(label, value, fallback = '/portal') {
  const next = getSafeInternalPath(value, fallback)
  assert.equal(next, fallback, `${label} must use the safe fallback`)
  const sink = new URL(next, APP_ORIGIN)
  assert.equal(sink.origin, APP_ORIGIN, `${label} must stay on the application origin`)
  assert.ok(sink.pathname.startsWith('/') && !sink.pathname.startsWith('//'), `${label} must keep a single leading slash`)
}

assert.equal(
  new URL(`https://app.munjanggun.test/login?${ATTACK_QUERY}`).searchParams.get('next'),
  ATTACK_PATH,
  'the real query double-encoding must reach the helper as the reported attack path',
)

assertSafeFallback('direct helper attack', ATTACK_PATH)
assertSafeFallback('raw dot-segment attack', '/..//evil.com')
assertSafeFallback('normalized dot-segment attack', '/a/%2e%2e//evil.com')
assertSafeFallback('network-path reference', '//evil.com')
assertSafeFallback('absolute URL', 'https://evil.com/')
assertSafeFallback('script URL', 'javascript:alert(1)')
assertSafeFallback('literal backslash attack', '/\\evil.com')
assertSafeFallback('encoded backslash attack', '/%5c%5cevil.com')
assertSafeFallback('double-encoded backslash attack', '/%255c%255cevil.com')
assertSafeFallback('encoded network-path attack', '/%2f%2fevil.com')
assertSafeFallback('double-encoded network-path attack', '/%252f%252fevil.com')

const attackRequestUrl = new URL(`https://app.munjanggun.test/login?${ATTACK_QUERY}`)
assertSafeFallback('login OTP success', attackRequestUrl.searchParams.get('next'))
for (const context of ['auth callback', 'authenticated proxy redirect']) {
  const redirectUrl = getSafeInternalUrl(attackRequestUrl.searchParams.get('next'), APP_ORIGIN)
  assert.equal(redirectUrl.href, `${APP_ORIGIN}/portal`, `${context} must resolve to the same-origin fallback URL`)
}

for (const legitimatePath of [
  '/measure',
  '/portal/measure/new?concern=finish',
  '/portal/measure/new?concern=finish#visit',
  '/portal/%EC%8B%A4%EC%B8%A1?source=measure',
]) {
  assert.equal(getSafeInternalPath(legitimatePath), legitimatePath, `legitimate path must be preserved: ${legitimatePath}`)
  assert.equal(new URL(getSafeInternalPath(legitimatePath), APP_ORIGIN).origin, APP_ORIGIN)
}

assert.match(
  loginSource,
  /const nextParam = getSafeInternalPath\(requestedNext\)[\s\S]*window\.location\.href = nextParam/,
  'login OTP success must send only the guarded next path to window.location.href',
)
assert.match(
  callbackSource,
  /getSafeInternalUrl\(searchParams\.get\('next'\), origin\)[\s\S]*NextResponse\.redirect\(redirectUrl\)/,
  'auth callback must use the shared same-origin URL guard at its redirect sink',
)
assert.match(
  proxySource,
  /getSafeInternalUrl\(request\.nextUrl\.searchParams\.get\('next'\), request\.url\)[\s\S]*NextResponse\.redirect\(getSafeLoginRedirectUrl\(request\)\)/,
  'authenticated proxy redirect must use the shared same-origin URL guard at its redirect sink',
)

console.log('safe internal path contract: PASS')
