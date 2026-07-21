import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

const [barrel, table, list, queue, queueCss, tokenPolicy] = await Promise.all([
  source('src/components/platform/ui/index.ts'),
  source('src/components/platform/ui/PlatformTable.tsx'),
  source('src/components/platform/ui/PlatformList.tsx'),
  source('src/app/admin/platform/blog/BlogDraftQueueClient.tsx'),
  source('src/app/admin/platform/blog/blog-draft-queue.module.css'),
  source('scripts/ui-token-policy.config.mjs'),
])

for (const primitive of ['PlatformTable', 'PlatformList']) {
  assert.match(barrel, new RegExp(`export \\{ ${primitive} \\}`), `${primitive} must be exported from the shared UI barrel`)
  assert.match(queue, new RegExp(`\\b${primitive}\\b`), `blog queue must use ${primitive}`)
}

assert.match(table, /<table/)
assert.match(table, /data-platform-table/)
assert.match(table, /containerClassName/)
assert.match(list, /<ul/)
assert.match(list, /data-platform-list/)
assert.doesNotMatch(queue, /<table\b/)
assert.doesNotMatch(queue, /<ul\s+className=\{styles\.mobileList\}/)
assert.doesNotMatch(queue, /<tr[\s\S]*?role=["']link["']/)
assert.doesNotMatch(queue, /<tr[\s\S]*?tabIndex=\{0\}/)
assert.match(queue, /<PlatformTable[\s\S]*?<Link[\s\S]*?에디터 열기/)
assert.match(queue, /closest\(["']a,button,input,select,textarea["']\)/)
assert.match(queue, /\.sort\(\(a, b\) => String\(b\.updatedAt\)\.localeCompare/)
assert.match(queue, /router\.push\(`\/admin\/platform\/blog\/\$\{row\.id\}`\)/)
assert.doesNotMatch(queueCss, /\.(?:tableWrap|table)\b/)

for (const cssFile of ['PlatformTable.module.css', 'PlatformList.module.css']) {
  assert.match(tokenPolicy, new RegExp(cssFile.replace('.', '\\.')), `${cssFile} must be governed by the raw-token policy`)
}

console.log('blog queue list primitive contract passed')
