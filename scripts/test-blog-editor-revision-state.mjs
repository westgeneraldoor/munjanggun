import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const actions = await readFile(
  new URL('../src/app/admin/platform/blog/[id]/actions.ts', import.meta.url),
  'utf8',
)
const editor = await readFile(
  new URL('../src/app/admin/platform/blog/[id]/BlogEditorClient.tsx', import.meta.url),
  'utf8',
)

assert.match(
  actions,
  /type SaveBlogEditorResult[\s\S]*updatedAt\?: string[\s\S]*code\?: 'stale_revision'/,
  'draft save results must return the exact persisted revision and a typed stale conflict',
)
assert.match(actions, /blockIds\?: string\[\]/)
assert.match(actions, /savedBlockIds\.push\(savedBlockId\)[\s\S]*blockIds: savedBlockIds/)
assert.match(
  actions,
  /const updatedAt = new Date\(\)\.toISOString\(\)[\s\S]*updated_at: updatedAt[\s\S]*현재 내용을 임시저장했습니다[\s\S]*updatedAt,[\s\S]*blockIds: savedBlockIds/,
  'draft save must return the same timestamp written to blog_posts.updated_at',
)
assert.match(
  editor,
  /const \[currentRevision, setCurrentRevision\] = useState\(initialPost\.updatedAt\)/,
  'the editor must own the current server revision instead of pinning the initial prop forever',
)
assert.match(editor, /result\.blockIds\?\.length === blocks\.length[\s\S]*setBlocks\(savedBlocks\)/)
assert.match(
  editor,
  /expectedUpdatedAt: currentRevision/,
  'save and publish payloads must use the latest acknowledged server revision',
)
assert.match(
  editor,
  /function createEditorContentSignature\(payload: SaveBlogEditorPayload\)[\s\S]*postId: payload\.postId,[\s\S]*post: payload\.post,[\s\S]*blocks: payload\.blocks/,
  'dirty-state signatures must exclude the server revision token',
)
assert.match(editor, /currentEditorSignature = createEditorContentSignature\(buildPayload\(\)\)/)
assert.match(
  editor,
  /result\.ok && result\.updatedAt[\s\S]*setCurrentRevision\(result\.updatedAt\)[\s\S]*setSavedEditorSignature/,
  'a successful draft save must acknowledge the persisted revision before marking the editor clean',
)
assert.match(
  editor,
  /saveMessage\.code === 'stale_revision'[\s\S]*window\.location\.reload\(\)[\s\S]*최신본 다시 불러오기/,
  'stale conflicts must stay inline and offer a full reload of the latest server revision',
)
assert.match(
  editor,
  /publishMessage\.code === 'stale_revision' \|\| publishMessage\.code === 'publication_unknown'[\s\S]*window\.location\.reload\(\)/,
  'publish conflicts and ambiguous outcomes must offer the same inline reload recovery',
)

console.log('blog editor revision state contract passed')
