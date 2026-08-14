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
  /type SaveBlogEditorResult[\s\S]*ok: true[\s\S]*updatedAt: string[\s\S]*blockIds: string\[\][\s\S]*ok: false[\s\S]*code\?: 'stale_revision'/,
  'draft save results must return the exact persisted revision and a typed stale conflict',
)
assert.match(
  actions,
  /type PublishBlogPostResult[\s\S]*ok: true[\s\S]*updatedAt: string[\s\S]*ok: false/,
  'publish results must return the exact persisted post revision',
)
assert.match(
  actions,
  /type UpdateBlogPostStatusResult[\s\S]*ok: true[\s\S]*updatedAt: string[\s\S]*ok: false[\s\S]*code\?: 'revision_unknown'/,
  'archive and restore results must return the exact persisted post revision',
)
assert.match(
  editor,
  /setPublishMessage\(\{ ok: result\.ok, text: result\.message, issues: result\.issues, code: result\.code \}\)[\s\S]*handleRestore[\s\S]*setPublishMessage\(\{ ok: result\.ok, text: result\.message, issues: result\.issues, code: result\.code \}\)/,
  'archive and restore must preserve revision-recovery codes for the inline reload action',
)
assert.match(
  editor,
  /publishMessage\.code === 'revision_unknown'/,
  'unknown status-transition revisions must offer the latest-revision recovery action',
)
assert.match(
  actions,
  /if \(trashTransitionError\) \{[\s\S]*code: 'revision_unknown'/,
  'ambiguous archive or restore RPC failures must also direct the editor to reload the current revision',
)
assert.match(actions, /blockIds: string\[\]/)
assert.match(actions, /savedBlockIds\.push\(savedBlockId\)[\s\S]*blockIds: savedBlockIds/)
assert.match(
  actions,
  /const requestedUpdatedAt = new Date\(\)\.toISOString\(\)[\s\S]*updated_at: requestedUpdatedAt[\s\S]*select\('id, updated_at'\)[\s\S]*현재 내용을 임시저장했습니다[\s\S]*updatedAt: updatedPostRows\[0\]\.updated_at,[\s\S]*blockIds: savedBlockIds/,
  'draft save must return the revision that the database actually persisted, not a client clock value',
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
  /if \(result\.ok\) \{[\s\S]*setCurrentRevision\(result\.updatedAt\)[\s\S]*setSavedEditorSignature/,
  'a successful draft save must acknowledge the persisted revision before marking the editor clean',
)
assert.match(
  editor,
  /const result = await publishBlogEditor\(buildPayload\(\)\)[\s\S]*if \(result\.ok\) \{[\s\S]*setCurrentRevision\(result\.updatedAt\)[\s\S]*setPost/,
  'a successful atomic publish must acknowledge its persisted revision before refresh preserves client state',
)
assert.match(
  editor,
  /const result = await updateBlogPostStatus\(post\.id, 'archived'\)[\s\S]*if \(result\.ok\) \{[\s\S]*setCurrentRevision\(result\.updatedAt\)[\s\S]*setPost/,
  'archive must acknowledge its persisted revision before the next edit can save',
)
assert.match(
  editor,
  /const result = await updateBlogPostStatus\(post\.id, 'reviewing'\)[\s\S]*if \(result\.ok\) \{[\s\S]*setCurrentRevision\(result\.updatedAt\)[\s\S]*setPost/,
  'restore must acknowledge its persisted revision before the next edit can save',
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
assert.match(
  actions,
  /typeof updatedPostRows\[0\]\.updated_at !== 'string'[\s\S]*code: 'stale_revision'/,
  'an acknowledged save without a readable revision must keep the editor inline and offer latest-revision recovery',
)

console.log('blog editor revision state contract passed')
