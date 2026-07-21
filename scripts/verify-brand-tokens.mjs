import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  GENERATED_PATHS,
  PINNED_MANIFEST,
  collectCssCustomPropertyNames,
  collectJsonCssTokenNames,
  normalizeLineEndings,
  sha256,
  stableJson,
} from './brand-token-snapshot.mjs'

const projectRootFromScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function assertManifestShape(manifest) {
  const topLevelKeys = Object.keys(manifest).sort()
  const expectedKeys = ['designVersion', 'generated', 'schemaVersion', 'source', 'sourceCommit', 'tokenCount']
  if (JSON.stringify(topLevelKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`Brand manifest top-level keys are invalid: ${topLevelKeys.join(', ')}`)
  }
  if (manifest.schemaVersion !== 1) throw new Error('Brand manifest schemaVersion must be 1.')
  if (!/^[0-9a-f]{40}$/.test(manifest.sourceCommit)) throw new Error('Brand manifest sourceCommit must be a full Git SHA.')
}

export async function verifyBrandTokens({
  projectRoot = projectRootFromScript,
  expectedManifest = PINNED_MANIFEST,
} = {}) {
  const [css, json, manifestText] = await Promise.all([
    readFile(path.join(projectRoot, GENERATED_PATHS.css), 'utf8'),
    readFile(path.join(projectRoot, GENERATED_PATHS.json), 'utf8'),
    readFile(path.join(projectRoot, GENERATED_PATHS.manifest), 'utf8'),
  ])
  const manifest = JSON.parse(normalizeLineEndings(manifestText))
  assertManifestShape(manifest)

  if (stableJson(manifest) !== stableJson(expectedManifest)) {
    throw new Error('Brand manifest does not match the immutable snapshot contract.')
  }

  const normalizedCss = normalizeLineEndings(css)
  const normalizedJson = normalizeLineEndings(json)
  if (sha256(normalizedCss) !== expectedManifest.generated.css.sha256) {
    throw new Error('Generated CSS hash mismatch.')
  }
  if (sha256(normalizedJson) !== expectedManifest.generated.json.sha256) {
    throw new Error('Generated JSON hash mismatch.')
  }

  const parsedJson = JSON.parse(normalizedJson)
  const cssNames = collectCssCustomPropertyNames(normalizedCss)
  const jsonNames = collectJsonCssTokenNames(parsedJson)
  if (JSON.stringify(cssNames) !== JSON.stringify(jsonNames)) {
    throw new Error('Generated CSS and JSON token sets differ.')
  }
  if (cssNames.length !== expectedManifest.tokenCount) {
    throw new Error(`Generated token count mismatch: manifest ${expectedManifest.tokenCount}, generated ${cssNames.length}.`)
  }

  return { manifest, tokenCount: cssNames.length }
}

async function main() {
  const result = await verifyBrandTokens()
  console.log(`brand token snapshot verified offline: ${result.tokenCount} tokens`)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
