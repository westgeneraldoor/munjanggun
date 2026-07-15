import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  PINNED_SOURCE_COMMIT,
  collectCssCustomPropertyNames,
  collectJsonCssTokenNames,
  generateBrandSnapshot,
  normalizeLineEndings,
  resolveBrandRoot,
  stableJson,
} from './brand-token-snapshot.mjs'
import { syncBrandTokens } from './sync-brand-tokens.mjs'
import { verifyBrandTokens } from './verify-brand-tokens.mjs'
import { checkBrandTokenDrift } from './check-brand-token-drift.mjs'

const FONT_SOURCE = '../design-system/assets/fonts/TmoneyRoundWindExtraBold.ttf'

const fixtureCss = `@font-face { src: url("${FONT_SOURCE}"); }\n:root {\n  --mg-alpha: #fff;\n  --mg-beta: 8px;\n}\n`
const fixtureJson = `${JSON.stringify({
  meta: { version: 'fixture-v1' },
  primitive: {
    alpha: { value: '#fff', css: '--mg-alpha' },
    beta: { value: '8px', css: '--mg-beta' },
  },
}, null, 2)}\n`

function generateFixture(overrides = {}) {
  return generateBrandSnapshot({
    cssSource: fixtureCss,
    jsonSource: fixtureJson,
    sourceCommit: 'a'.repeat(40),
    expectedTokenCount: 2,
    ...overrides,
  })
}

assert.equal(normalizeLineEndings('a\r\nb\rc\n'), 'a\nb\nc\n')
assert.deepEqual([...collectCssCustomPropertyNames(fixtureCss)], ['--mg-alpha', '--mg-beta'])
assert.deepEqual([...collectJsonCssTokenNames(JSON.parse(fixtureJson))], ['--mg-alpha', '--mg-beta'])

{
  const first = generateFixture()
  const second = generateFixture()
  assert.deepEqual(first, second, 'the pure generator must be byte deterministic')
  assert.equal(first.css.includes(FONT_SOURCE), false, 'the central relative font URL must not escape into the project')
  assert.equal(first.css.includes('/assets/fonts/TmoneyRoundWindExtraBold.ttf'), true)
  assert.equal(first.manifest.tokenCount, 2)
  assert.equal(first.manifest.sourceCommit, 'a'.repeat(40))
  assert.equal(first.manifest.generated.css.path, 'src/styles/generated/brand.css')
  assert.equal(first.manifest.generated.json.path, 'src/styles/generated/brand.tokens.json')
  assert.equal(first.manifest.source.css.path, 'tokens/brand.css')
  assert.equal(first.manifest.source.json.path, 'tokens/brand.tokens.json')
  assert.doesNotMatch(stableJson(first.manifest), /timestamp|username|sourceRoot|\\Users\\|\/home\//i)
}

{
  const lf = generateFixture()
  const crlf = generateFixture({
    cssSource: fixtureCss.replaceAll('\n', '\r\n'),
    jsonSource: fixtureJson.replaceAll('\n', '\r\n'),
  })
  assert.deepEqual(crlf, lf, 'CRLF and LF inputs must generate identical bytes')
}

assert.throws(
  () => generateFixture({ cssSource: fixtureCss.replace('}\n', '  --mg-css-only: 1px;\n}\n') }),
  /CSS-only.*--mg-css-only/i,
)
assert.throws(
  () => generateFixture({
    jsonSource: fixtureJson.replace('"--mg-beta"', '"--mg-json-only"'),
  }),
  /CSS-only.*--mg-beta[\s\S]*JSON-only.*--mg-json-only/i,
)
assert.throws(() => generateFixture({ expectedTokenCount: 3 }), /token count.*expected 3.*received 2/i)
assert.throws(() => generateFixture({ cssSource: fixtureCss.replace(FONT_SOURCE, './missing.ttf') }), /font URL.*exactly once.*found 0/i)
assert.throws(
  () => generateFixture({ cssSource: fixtureCss.replace('</never>', '').replace(':root {', `/* ${FONT_SOURCE} */\n:root {`) }),
  /font URL.*exactly once.*found 2/i,
)

{
  const override = path.resolve('C:/brand-override')
  assert.equal(await resolveBrandRoot({ env: { MUNJANGGUN_BRAND_ROOT: override } }), override)

  const commonDir = path.resolve('C:/workspace/munjanggun/.git')
  const resolved = await resolveBrandRoot({
    cwd: path.resolve('C:/workspace/munjanggun/.worktrees/task'),
    env: {},
    gitCommonDir: async () => commonDir,
  })
  assert.equal(resolved, path.resolve('C:/workspace/문장군_브랜드'))
}

const tempRoot = await mkdtemp(path.join(tmpdir(), 'munjanggun-brand-snapshot-'))
try {
  const projectRoot = path.join(tempRoot, 'project')
  const brandRoot = path.join(tempRoot, 'brand')
  await mkdir(path.join(projectRoot, 'src', 'styles', 'generated'), { recursive: true })
  await mkdir(path.join(brandRoot, 'tokens'), { recursive: true })
  await writeFile(path.join(brandRoot, 'tokens', 'brand.css'), fixtureCss)
  await writeFile(path.join(brandRoot, 'tokens', 'brand.tokens.json'), fixtureJson)

  const snapshot = await syncBrandTokens({
    projectRoot,
    brandRoot,
    sourceCommit: 'b'.repeat(40),
    expectedTokenCount: 2,
    readPinnedSource: async (_root, _commit, relativePath) => readFile(path.join(brandRoot, relativePath), 'utf8'),
  })
  assert.equal(snapshot.manifest.sourceCommit, 'b'.repeat(40), 'sync must honor its pinned source commit')

  const before = await Promise.all([
    readFile(path.join(projectRoot, 'src/styles/generated/brand.css'), 'utf8'),
    readFile(path.join(projectRoot, 'src/styles/generated/brand.tokens.json'), 'utf8'),
    readFile(path.join(projectRoot, 'src/styles/generated/brand.manifest.json'), 'utf8'),
  ])
  await syncBrandTokens({
    projectRoot,
    brandRoot,
    sourceCommit: 'b'.repeat(40),
    expectedTokenCount: 2,
    readPinnedSource: async (_root, _commit, relativePath) => readFile(path.join(brandRoot, relativePath), 'utf8'),
  })
  const after = await Promise.all([
    readFile(path.join(projectRoot, 'src/styles/generated/brand.css'), 'utf8'),
    readFile(path.join(projectRoot, 'src/styles/generated/brand.tokens.json'), 'utf8'),
    readFile(path.join(projectRoot, 'src/styles/generated/brand.manifest.json'), 'utf8'),
  ])
  assert.deepEqual(after, before, 'repeated sync must be byte-identical')

  const offline = await verifyBrandTokens({ projectRoot })
  assert.equal(offline.tokenCount, 2, 'offline verify must not require the central checkout')

  await writeFile(path.join(projectRoot, 'src/styles/generated/brand.css'), `${before[0]}/* tamper */\n`)
  await assert.rejects(() => verifyBrandTokens({ projectRoot }), /generated CSS hash mismatch/i)
  await writeFile(path.join(projectRoot, 'src/styles/generated/brand.css'), before[0])

  const matchingDrift = await checkBrandTokenDrift({
    projectRoot,
    brandRoot,
    readHead: async () => 'b'.repeat(40),
  })
  assert.equal(matchingDrift.status, 'current')
  await assert.rejects(
    () => checkBrandTokenDrift({ projectRoot, brandRoot, readHead: async () => 'c'.repeat(40) }),
    /source commit drift/i,
  )
  await writeFile(path.join(brandRoot, 'tokens', 'brand.css'), `${fixtureCss}/* drift */\n`)
  await assert.rejects(
    () => checkBrandTokenDrift({ projectRoot, brandRoot, readHead: async () => 'b'.repeat(40) }),
    /source CSS hash drift/i,
  )
  const skipped = await checkBrandTokenDrift({
    projectRoot,
    brandRoot: path.join(tempRoot, 'absent-default'),
    brandRootWasExplicit: false,
  })
  assert.equal(skipped.status, 'skipped')
  await assert.rejects(
    () => checkBrandTokenDrift({
      projectRoot,
      brandRoot: path.join(tempRoot, 'absent-override'),
      brandRootWasExplicit: true,
    }),
    /explicit brand root.*does not exist/i,
  )
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

assert.equal(PINNED_SOURCE_COMMIT, 'e6b6eb618e08b907307497d87f58995bd945531c')
console.log('brand token snapshot contract passed')
