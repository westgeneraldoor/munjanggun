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
  /if \(post\.status === 'archived'\)\s*\{[\s\S]*?보관된 글은 발행할 수 없습니다/,
  'the server action must reject archived posts before publication side effects',
)
assert.match(
  editor,
  /disabled=\{isPending \|\| isPublished \|\| isArchived \|\| hasUnsavedEditorChanges\}/,
  'the editor must not present an actionable publish control for archived posts',
)
assert.match(editor, /const isArchived = post\.status === 'archived'/)
assert.match(
  proxy,
  /if \(isAdminRoute && !isAdminLoginRoute && userRole !== 'administrator'\)\s*\{[\s\S]*?new URL\('\/portal', request\.url\)/,
  'every administrator route must fail closed when the profile is absent or non-administrator',
)
assert.doesNotMatch(proxy, /profileExists && userRole !== 'administrator'/)

console.log('blog publication and administrator route safety contracts passed')
