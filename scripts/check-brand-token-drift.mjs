import { execFile as execFileCallback } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import {
  SOURCE_PATHS,
  hasExplicitBrandRoot,
  normalizeLineEndings,
  resolveBrandRoot,
  sha256,
} from './brand-token-snapshot.mjs'
import { verifyBrandTokens } from './verify-brand-tokens.mjs'

const execFile = promisify(execFileCallback)
const projectRootFromScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function pathExists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function readGitHead(brandRoot) {
  const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: brandRoot, encoding: 'utf8' })
  return stdout.trim().toLowerCase()
}

export async function checkBrandTokenDrift({
  projectRoot = projectRootFromScript,
  brandRoot,
  brandRootWasExplicit = brandRoot !== undefined || hasExplicitBrandRoot(process.env),
  readHead = readGitHead,
} = {}) {
  const resolvedBrandRoot = brandRoot ?? await resolveBrandRoot({ cwd: projectRoot })
  if (!await pathExists(resolvedBrandRoot)) {
    if (brandRootWasExplicit) {
      throw new Error(`Explicit brand root does not exist: ${resolvedBrandRoot}`)
    }
    return { status: 'skipped', reason: `default central brand checkout is absent: ${resolvedBrandRoot}` }
  }

  const { manifest } = await verifyBrandTokens({ projectRoot })
  const head = await readHead(resolvedBrandRoot)
  if (head !== manifest.sourceCommit) {
    throw new Error(`Source commit drift: manifest ${manifest.sourceCommit}, central HEAD ${head}.`)
  }

  const [cssSource, jsonSource] = await Promise.all([
    readFile(path.join(resolvedBrandRoot, SOURCE_PATHS.css), 'utf8'),
    readFile(path.join(resolvedBrandRoot, SOURCE_PATHS.json), 'utf8'),
  ])
  if (sha256(normalizeLineEndings(cssSource)) !== manifest.source.css.sha256) {
    throw new Error('Source CSS hash drift.')
  }
  if (sha256(normalizeLineEndings(jsonSource)) !== manifest.source.json.sha256) {
    throw new Error('Source JSON hash drift.')
  }

  return { status: 'current', sourceCommit: head, tokenCount: manifest.tokenCount }
}

async function main() {
  const result = await checkBrandTokenDrift()
  if (result.status === 'skipped') {
    console.log(`brand token drift check skipped: ${result.reason}`)
    return
  }
  console.log(`brand token source is current: ${result.sourceCommit}`)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
