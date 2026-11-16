import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const editor = await readFile(
  path.join(projectRoot, 'src/app/admin/platform/blog/[id]/BlogEditorClient.tsx'),
  'utf8',
)

assert.doesNotMatch(editor, /NEXT_PUBLIC_BLOG_BODY_BLOCK_EXPANSION/)
assert.doesNotMatch(editor, /BLOG_BODY_BLOCK_EXPANSION_ENABLED/)
assert.doesNotMatch(editor, /전용 DB 마이그레이션 적용 후/)

for (const type of ['quote', 'video', 'related_post', 'place', 'quiz', 'checklist']) {
  assert.match(editor, new RegExp(`addBlock\\('${type}'\\)`), `${type} must remain available in the block toolbar`)
}

assert.match(
  editor,
  /const previewBlocks = useMemo\([\s\S]*?related_post[\s\S]*?publishedRelatedPosts/,
  'related post preview metadata must be resolved from the current unsaved editor state',
)
assert.match(editor, /blocks: previewBlocks/)

console.log('blog body block availability and preview contracts passed')
