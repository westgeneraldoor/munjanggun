import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import {
  EXPECTED_TOKEN_COUNT,
  GENERATED_PATHS,
  PINNED_SOURCE_COMMIT,
  SOURCE_PATHS,
  generateBrandSnapshot,
  resolveBrandRoot,
} from './brand-token-snapshot.mjs'

const execFile = promisify(execFileCallback)
const projectRootFromScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readGitFile(brandRoot, commit, relativePath) {
  const { stdout } = await execFile('git', ['show', `${commit}:${relativePath}`], {
    cwd: brandRoot,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  return stdout
}

export async function syncBrandTokens({
  projectRoot = projectRootFromScript,
  brandRoot,
  sourceCommit = PINNED_SOURCE_COMMIT,
  expectedTokenCount = EXPECTED_TOKEN_COUNT,
  readPinnedSource = readGitFile,
} = {}) {
  const resolvedBrandRoot = brandRoot ?? await resolveBrandRoot({ cwd: projectRoot })
  const [cssSource, jsonSource] = await Promise.all([
    readPinnedSource(resolvedBrandRoot, sourceCommit, SOURCE_PATHS.css),
    readPinnedSource(resolvedBrandRoot, sourceCommit, SOURCE_PATHS.json),
  ])
  const snapshot = generateBrandSnapshot({ cssSource, jsonSource, sourceCommit, expectedTokenCount })
  const outputDirectory = path.join(projectRoot, 'src', 'styles', 'generated')
  await mkdir(outputDirectory, { recursive: true })

  await Promise.all([
    writeFile(path.join(projectRoot, GENERATED_PATHS.css), snapshot.css, 'utf8'),
    writeFile(path.join(projectRoot, GENERATED_PATHS.json), snapshot.json, 'utf8'),
    writeFile(path.join(projectRoot, GENERATED_PATHS.manifest), snapshot.manifestJson, 'utf8'),
  ])

  return snapshot
}

async function main() {
  const snapshot = await syncBrandTokens()
  console.log(`brand tokens synced: ${snapshot.manifest.tokenCount} tokens`)
  console.log(`generated CSS sha256: ${snapshot.manifest.generated.css.sha256}`)
  console.log(`generated JSON sha256: ${snapshot.manifest.generated.json.sha256}`)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
