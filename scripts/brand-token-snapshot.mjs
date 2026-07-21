import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

export const PINNED_SOURCE_COMMIT = 'e6b6eb618e08b907307497d87f58995bd945531c'
export const DESIGN_VERSION = 'v5.0'
export const EXPECTED_TOKEN_COUNT = 114
export const SOURCE_PATHS = Object.freeze({
  css: 'tokens/brand.css',
  json: 'tokens/brand.tokens.json',
})
export const GENERATED_PATHS = Object.freeze({
  css: 'src/styles/generated/brand.css',
  json: 'src/styles/generated/brand.tokens.json',
  manifest: 'src/styles/generated/brand.manifest.json',
})

const CENTRAL_FONT_URL = '../design-system/assets/fonts/TmoneyRoundWindExtraBold.ttf'
const PROJECT_FONT_URL = '/assets/fonts/TmoneyRoundWindExtraBold.ttf'

export function normalizeLineEndings(value) {
  return String(value).replace(/\r\n?/g, '\n')
}

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function sortRecursively(value) {
  if (Array.isArray(value)) {
    return value.map(sortRecursively)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map(key => [key, sortRecursively(value[key])]),
    )
  }

  return value
}

export function stableJson(value) {
  return `${JSON.stringify(sortRecursively(value), null, 2)}\n`
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

export const PINNED_MANIFEST = deepFreeze(sortRecursively({
  schemaVersion: 1,
  designVersion: DESIGN_VERSION,
  sourceCommit: PINNED_SOURCE_COMMIT,
  source: {
    css: {
      path: SOURCE_PATHS.css,
      sha256: 'd1a803fa3592c66121d6637ddb2fc52014ae07f4c9e2e708a61005e923fdb87c',
    },
    json: {
      path: SOURCE_PATHS.json,
      sha256: '17a330d8a26761bcd64ca69ddb860d123afd25d967b1dbbea4715ce0693f9cab',
    },
  },
  generated: {
    css: {
      path: GENERATED_PATHS.css,
      sha256: 'c21af4766c6e3c707f92ff8736281d48b264efca564c16e708c2ff09dfdf0103',
    },
    json: {
      path: GENERATED_PATHS.json,
      sha256: 'ed985f552b11ed005788fa7c4cd84cbc8c70c6b640246e6e31822d6e015b1b28',
    },
  },
  tokenCount: EXPECTED_TOKEN_COUNT,
}))

export function collectCssCustomPropertyNames(cssSource) {
  const names = new Set()
  const declarationPattern = /(?:^|[;{]\s*|\n\s*)(--[A-Za-z0-9_-]+)\s*:/g
  const normalized = normalizeLineEndings(cssSource)
  let match

  while ((match = declarationPattern.exec(normalized)) !== null) {
    names.add(match[1])
  }

  return [...names].sort((left, right) => left.localeCompare(right))
}

export function collectJsonCssTokenNames(value) {
  const names = new Set()

  function visit(node) {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }

    if (!node || typeof node !== 'object') {
      return
    }

    if (typeof node.css === 'string') {
      names.add(node.css)
    }

    Object.values(node).forEach(visit)
  }

  visit(value)
  return [...names].sort((left, right) => left.localeCompare(right))
}

function assertTokenSetEquality(cssNames, jsonNames) {
  const cssSet = new Set(cssNames)
  const jsonSet = new Set(jsonNames)
  const cssOnly = cssNames.filter(name => !jsonSet.has(name))
  const jsonOnly = jsonNames.filter(name => !cssSet.has(name))

  if (cssOnly.length || jsonOnly.length) {
    throw new Error(
      `CSS/JSON token sets differ. CSS-only: ${cssOnly.join(', ') || '(none)'}. JSON-only: ${jsonOnly.join(', ') || '(none)'}.`,
    )
  }
}

function rewriteFontUrl(cssSource) {
  const count = cssSource.split(CENTRAL_FONT_URL).length - 1
  if (count !== 1) {
    throw new Error(`Central font URL must occur exactly once; found ${count}.`)
  }

  return cssSource.replace(CENTRAL_FONT_URL, PROJECT_FONT_URL)
}

export function generateBrandSnapshot({
  cssSource,
  jsonSource,
  sourceCommit = PINNED_SOURCE_COMMIT,
  expectedTokenCount = EXPECTED_TOKEN_COUNT,
} = {}) {
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    throw new Error(`Source commit must be a full 40-character Git SHA: ${sourceCommit}`)
  }

  const normalizedCssSource = normalizeLineEndings(cssSource)
  const normalizedJsonSource = normalizeLineEndings(jsonSource)
  let parsedJson
  try {
    parsedJson = JSON.parse(normalizedJsonSource)
  } catch (error) {
    throw new Error('Central token JSON is invalid.', { cause: error })
  }

  const cssNames = collectCssCustomPropertyNames(normalizedCssSource)
  const jsonNames = collectJsonCssTokenNames(parsedJson)
  assertTokenSetEquality(cssNames, jsonNames)

  if (cssNames.length !== expectedTokenCount) {
    throw new Error(`Token count mismatch: expected ${expectedTokenCount}, received ${cssNames.length}.`)
  }

  const generatedCss = rewriteFontUrl(normalizedCssSource)
  const generatedJson = `${JSON.stringify(parsedJson, null, 2)}\n`
  const designVersion = parsedJson?.meta?.version
  if (typeof designVersion !== 'string' || !designVersion.trim()) {
    throw new Error('Central token JSON must include meta.version.')
  }

  const manifest = sortRecursively({
    schemaVersion: 1,
    designVersion,
    sourceCommit: sourceCommit.toLowerCase(),
    source: {
      css: { path: SOURCE_PATHS.css, sha256: sha256(normalizedCssSource) },
      json: { path: SOURCE_PATHS.json, sha256: sha256(normalizedJsonSource) },
    },
    generated: {
      css: { path: GENERATED_PATHS.css, sha256: sha256(generatedCss) },
      json: { path: GENERATED_PATHS.json, sha256: sha256(generatedJson) },
    },
    tokenCount: cssNames.length,
  })

  return {
    css: generatedCss,
    json: generatedJson,
    manifest,
    manifestJson: stableJson(manifest),
  }
}

async function defaultGitCommonDir(cwd) {
  const { stdout } = await execFile(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { cwd, encoding: 'utf8' },
  )
  return stdout.trim()
}

export function hasExplicitBrandRoot(env = process.env) {
  return Object.prototype.hasOwnProperty.call(env, 'MUNJANGGUN_BRAND_ROOT')
}

export async function resolveBrandRoot({
  cwd = process.cwd(),
  env = process.env,
  gitCommonDir = defaultGitCommonDir,
} = {}) {
  if (hasExplicitBrandRoot(env)) {
    const override = String(env.MUNJANGGUN_BRAND_ROOT ?? '').trim()
    if (!override) {
      throw new Error('MUNJANGGUN_BRAND_ROOT is set but empty.')
    }
    return path.resolve(override)
  }

  const commonDir = path.resolve(await gitCommonDir(cwd))
  const repositoryRoot = path.dirname(commonDir)
  return path.resolve(path.dirname(repositoryRoot), '문장군_브랜드')
}
