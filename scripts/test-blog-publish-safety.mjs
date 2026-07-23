import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

const [actions, editor, proxy] = await Promise.all([
  readFile(path.join(projectRoot, 'src/app/admin/platform/blog/[id]/actions.ts'), 'utf8'),
  readFile(path.join(projectRoot, 'src/app/admin/platform/blog/[id]/BlogEditorClient.tsx'), 'utf8'),
  readFile(path.join(projectRoot, 'src/proxy.ts'), 'utf8'),
])

assert.match(
  actions,
  /if \(currentPost\.status === 'archived'\)\s*\{[\s\S]*?휴지통의 글은 발행할 수 없습니다/,
  'the server action must reject archived posts before publication side effects',
)
assert.equal(
  (actions.match(/요약 답변은 21자 이상 작성해야 합니다/g) ?? []).length,
  2,
  'ready and publish server gates must both enforce the DB 21-character boundary',
)
assert.match(editor, /post\.summaryAnswer\?\.trim\(\)\.length \?\? 0\) > 20/)
assert.match(
  editor,
  /publishBlogEditor\(buildPayload\(\)\)/,
  'publish must send the current editor payload through the atomic save-and-publish action',
)
assert.doesNotMatch(editor, /publishBlogPost\(post\.id\)/)
assert.doesNotMatch(editor, /먼저 저장한 뒤 발행해주세요|먼저 임시저장해 주세요/)
assert.doesNotMatch(editor, /disabled=\{[^}]*hasUnsavedEditorChanges[^}]*\}/)
assert.match(editor, /발행 중/)
assert.match(editor, /const isArchived = post\.status === 'archived'/)
assert.match(
  actions,
  /export async function publishBlogPost[\s\S]*?이전 발행 방식은 더 이상 지원하지 않습니다/,
  'the legacy id-only publication action must fail closed instead of bypassing the atomic editor payload',
)
assert.match(
  proxy,
  /if \(isAdminRoute && !isAdminLoginRoute && userRole !== 'administrator'\)\s*\{[\s\S]*?new URL\('\/portal', request\.url\)/,
  'every administrator route must fail closed when the profile is absent or non-administrator',
)
assert.doesNotMatch(proxy, /profileExists && userRole !== 'administrator'/)

console.log('blog publication and administrator route safety contracts passed')
