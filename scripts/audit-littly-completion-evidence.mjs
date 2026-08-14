import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const evidenceRoot = path.join(
  projectRoot,
  'docs',
  'littly-clone',
  'full-product-research',
  'completion-pass',
)

const artifactFolders = ['screenshots', 'raw', 'measurements']

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(absolute))
    if (entry.isFile()) files.push(absolute)
  }

  return files
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function jpegDimensions(bytes) {
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = bytes[offset + 1]
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2
      continue
    }

    const length = bytes.readUInt16BE(offset + 2)
    if (length < 2) break
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      }
    }
    offset += length + 2
  }
  return null
}

function inspectImage(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return {
      format: 'png',
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      validMagic: true,
    }
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return {
      format: 'jpeg',
      ...jpegDimensions(bytes),
      validMagic: true,
    }
  }

  return { format: 'unknown', width: null, height: null, validMagic: false }
}

function visibilityFor(relativePath) {
  return relativePath.includes('CP-MARKETING-') ? 'PRIVATE_ONLY' : 'PUBLIC_CANDIDATE'
}

const artifacts = []
const invalidImages = []
const invalidJson = []
const emptyRaw = []

for (const folder of artifactFolders) {
  const directory = path.join(evidenceRoot, folder)
  const files = await walk(directory)
  for (const absolute of files.sort()) {
    const bytes = await fs.readFile(absolute)
    const relativePath = path.relative(evidenceRoot, absolute).replaceAll('\\', '/')
    const artifact = {
      path: relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes),
      visibility: visibilityFor(relativePath),
    }

    if (/\.(?:jpe?g|png)$/i.test(relativePath)) {
      artifact.image = inspectImage(bytes)
      if (!artifact.image.validMagic || !artifact.image.width || !artifact.image.height) {
        invalidImages.push(relativePath)
      }
    }

    if (relativePath.endsWith('.json')) {
      try {
        JSON.parse(bytes.toString('utf8'))
      } catch (error) {
        invalidJson.push({ path: relativePath, error: String(error) })
      }
    }

    if (relativePath.startsWith('raw/') && bytes.length === 0) emptyRaw.push(relativePath)
    artifacts.push(artifact)
  }
}

const duplicateHashes = Object.entries(Object.groupBy(artifacts, artifact => artifact.sha256))
  .filter(([, entries]) => entries.length > 1)
  .map(([hash, entries]) => ({ hash, paths: entries.map(entry => entry.path) }))

const generatedAt = new Date().toISOString()
const counts = Object.fromEntries(
  artifactFolders.map(folder => [folder, artifacts.filter(item => item.path.startsWith(`${folder}/`)).length]),
)

const manifest = {
  schemaVersion: 2,
  research: 'Littly Chrome completion pass',
  generatedAt,
  browser: 'Chrome',
  authority: 'completion-pass evidence; see COVERAGE.md for claim status',
  counts,
  artifacts,
}

const validation = {
  schemaVersion: 2,
  validatedAt: generatedAt,
  passed: invalidImages.length === 0 && invalidJson.length === 0 && emptyRaw.length === 0,
  counts,
  invalidImages,
  invalidJson,
  emptyRaw,
  duplicateHashes,
  imageFormats: artifacts
    .filter(item => item.image)
    .reduce((result, item) => {
      result[item.image.format] = (result[item.image.format] ?? 0) + 1
      return result
    }, {}),
}

await fs.writeFile(path.join(evidenceRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await fs.writeFile(path.join(evidenceRoot, 'validation.json'), `${JSON.stringify(validation, null, 2)}\n`)

console.log(JSON.stringify({ passed: validation.passed, counts, invalidImages, invalidJson, emptyRaw }, null, 2))

if (!validation.passed) process.exitCode = 1
