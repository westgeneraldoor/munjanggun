import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const sourceUrl = new URL('../src/lib/content-os/blog-status-transitions.ts', import.meta.url)
const source = await readFile(sourceUrl, 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText
const { isAllowedManualBlogStatusTransition } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)

const statuses = ['ai_draft', 'reviewing', 'needs_media', 'ready', 'published', 'archived']
const expected = new Set([
  'ai_draft:reviewing',
  'reviewing:needs_media',
  'reviewing:ready',
  'needs_media:reviewing',
  'needs_media:ready',
  'ready:reviewing',
  'ready:needs_media',
  'archived:reviewing',
])

for (const status of statuses) {
  if (status !== 'archived') expected.add(`${status}:archived`)
}

for (const from of statuses) {
  for (const to of statuses) {
    assert.equal(
      isAllowedManualBlogStatusTransition(from, to),
      expected.has(`${from}:${to}`),
      `${from} -> ${to} must ${expected.has(`${from}:${to}`) ? 'be allowed' : 'be rejected'}`,
    )
  }
}

for (const from of statuses) {
  assert.equal(isAllowedManualBlogStatusTransition(from, 'published'), false, `${from} must use the dedicated publish action`)
}

console.log('all blog status transition contracts passed')
