import { execFileSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const docsRoot = path.join(projectRoot, 'docs', 'littly-clone')

function gitLines(args) {
  const output = execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
  })
  return output.split(/\r?\n/).filter(Boolean)
}

function inspectImage(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'png'
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }
  return 'unknown'
}

const publicFiles = gitLines([
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  '--',
  'docs/littly-clone',
])

const requiredPrivateFiles = [
  'docs/littly-clone/evidence/supplemental-screenshots/user-provided/01-page-editor-profile.png',
  'docs/littly-clone/evidence/supplemental-screenshots/user-provided/02-music-editor-soundcloud.png',
  'docs/littly-clone/direct-research/dom/DIR-054-analysis.txt',
  'docs/littly-clone/direct-research/dom/DIR-055-manage.txt',
  'docs/littly-clone/direct-research/dom/DIR-056-marketing.txt',
  'docs/littly-clone/direct-research/dom/DIR-064-manage-customer-detail.txt',
  'docs/littly-clone/direct-research/dom/DIR-064-manage-customer-detail-a11y.txt',
]

const privateRuleFailures = []
for (const relativePath of requiredPrivateFiles) {
  try {
    gitLines(['check-ignore', '--', relativePath])
  } catch {
    privateRuleFailures.push(relativePath)
  }
}

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.svg', '.txt'])
const imageExtensions = new Set(['.jpg', '.jpeg', '.png'])
const findings = []
const invalidJson = []
const invalidImages = []
let textFileCount = 0
let imageFileCount = 0

const detectors = [
  ['email', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  ['local-user-path', /[A-Z]:\\Users\\[^\\\s"']+/gi],
  ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
  ['secret-assignment', /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password)\b\s*[:=]\s*["']?[A-Za-z0-9_./+-]{16,}/gi],
  ['phone', /\b01[016789](?:[-\s]?\d{3,4})[-\s]?\d{4}\b/g],
]

for (const relativePath of publicFiles) {
  const absolutePath = path.join(projectRoot, relativePath)
  const extension = path.extname(relativePath).toLowerCase()
  const bytes = await fs.readFile(absolutePath)

  if (textExtensions.has(extension)) {
    textFileCount += 1
    const source = bytes.toString('utf8')
    if (extension === '.json') {
      try {
        JSON.parse(source)
      } catch (error) {
        invalidJson.push({ path: relativePath, error: String(error) })
      }
    }

    const scanText = source
      .replace(/\b[a-f0-9]{64}\b/gi, '[SHA256]')
      .replaceAll('01012345678', '[DUMMY_PHONE]')

    for (const [kind, pattern] of detectors) {
      const matches = [...scanText.matchAll(pattern)]
      for (const match of matches.slice(0, 5)) {
        findings.push({ kind, path: relativePath, sample: match[0] })
      }
    }
  }

  if (imageExtensions.has(extension)) {
    imageFileCount += 1
    const format = inspectImage(bytes)
    const expected = extension === '.png' ? 'png' : 'jpeg'
    if (format !== expected) invalidImages.push({ path: relativePath, expected, actual: format })
  }
}

const passed = findings.length === 0
  && invalidJson.length === 0
  && invalidImages.length === 0
  && privateRuleFailures.length === 0

const report = {
  passed,
  publicFileCount: publicFiles.length,
  textFileCount,
  imageFileCount,
  findings,
  invalidJson,
  invalidImages,
  privateRuleFailures,
  docsRoot: path.relative(projectRoot, docsRoot).replaceAll('\\', '/'),
}

console.log(JSON.stringify(report, null, 2))
if (!passed) process.exitCode = 1
