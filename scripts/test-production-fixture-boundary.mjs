import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = path.join(projectRoot, 'src', 'app', 'test-fixtures')
const [proxy, robots] = await Promise.all([
  readFile(path.join(projectRoot, 'src', 'proxy.ts'), 'utf8'),
  readFile(path.join(projectRoot, 'src', 'app', 'robots.ts'), 'utf8'),
])

assert.match(
  proxy,
  /process\.env\.NODE_ENV === 'production'[\s\S]*?pathname\.startsWith\('\/test-fixtures(?:\/|')/,
  'Proxy must recognize every production /test-fixtures path before route rendering',
)
assert.match(robots, /['"]\/test-fixtures\/['"]/, 'robots must also disallow fixture crawling')
assert.match(
  proxy,
  /isProductionTestFixture[\s\S]*?new NextResponse\([\s\S]*?status:\s*404/i,
  'Proxy must return a direct 404 for production fixtures',
)
assert.match(
  proxy,
  /['"]X-Robots-Tag['"]:\s*['"]noindex, nofollow['"]/i,
  'Fixture 404 responses must also carry an explicit noindex boundary',
)
assert.match(
  proxy,
  /matcher:\s*\[[\s\S]*?['"]\/test-fixtures\/:path\*['"]/,
  'The explicit matcher must include extension routes such as animated.gif',
)

const expectedFixtureRoutes = [
  'admin-choice',
  'admin-detail',
  'admin-modal',
  'admin-node-form',
  'admin-node-list',
  'admin-queue',
  'admin-site-settings',
  'admin-switch',
  'blog-public-gif',
  'blog-public-gif/animated.gif',
]

const discoveredRoutes = []
async function discoverRoutes(directory, segments = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      await discoverRoutes(path.join(directory, entry.name), [...segments, entry.name])
      continue
    }
    if (entry.name === 'page.tsx' || entry.name === 'route.ts') {
      discoveredRoutes.push(segments.join('/'))
    }
  }
}
await discoverRoutes(fixtureRoot)

assert.deepEqual(discoveredRoutes.sort(), expectedFixtureRoutes.sort())

console.log(`production fixture boundary contract passed (${discoveredRoutes.length} routes)`)
