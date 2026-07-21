import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const editor = readFileSync('src/app/admin/platform/blog/[id]/BlogEditorClient.tsx', 'utf8')
const statePanel = readFileSync('src/components/platform/ui/PlatformStatePanel.tsx', 'utf8')

assert.match(editor, /import \{ PlatformStatePanel \}/, 'editor feedback must use the shared state primitive')
assert.match(editor, /function EditorStateMessage\(/, 'editor must centralize success and error semantics')
assert.match(editor, /tone=\{ok \? 'success' : 'error'\}/, 'success and failure tones must be explicit')
assert.match(editor, /details=\{issues && issues\.length > 0/, 'issue lists must use the flow-content details slot')
assert.match(statePanel, /details \? <div[^>]*>\{details\}<\/div>/, 'state details must render in a flow container')
assert.doesNotMatch(statePanel, /<p>\{details\}<\/p>/, 'state detail lists must never be wrapped in a paragraph')
assert.equal(
  (editor.match(/<EditorStateMessage\b/g) ?? []).length >= 6,
  true,
  'all editor action result paths must use the shared state message',
)
assert.doesNotMatch(
  editor,
  /className=\{`\$\{styles\.saveMessage\}[\s\S]{0,160}?role="status"/,
  'error-capable editor messages must not always use polite status semantics',
)

console.log('blog editor state semantics contract passed')
