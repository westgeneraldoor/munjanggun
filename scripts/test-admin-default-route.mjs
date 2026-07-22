import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

const [adminPage, loginPage, proxy, devLogin] = await Promise.all([
  source('src/app/admin/page.tsx'),
  source('src/app/admin/login/page.tsx'),
  source('src/proxy.ts'),
  source('src/app/api/dev/playwright-login/route.ts'),
])

assert.match(adminPage, /redirect\('\/admin\/platform'\)/)
assert.match(loginPage, /router\.push\('\/admin\/platform'\)/)
assert.match(proxy, /userRole === 'administrator'[\s\S]{0,160}new URL\('\/admin\/platform', request\.url\)/)
assert.match(devLogin, /role === 'administrator' \? '\/admin\/platform' : '\/portal'/)

for (const sourceText of [adminPage, loginPage, proxy]) {
  assert.doesNotMatch(sourceText, /['"]\/admin\/nodes['"]/, 'the default administrator route must not point to node management')
}

console.log('admin default route contract passed')
