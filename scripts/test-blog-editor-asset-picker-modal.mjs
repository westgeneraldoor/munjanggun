import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const editor = await readFile(new URL('../src/app/admin/platform/blog/[id]/BlogEditorClient.tsx', import.meta.url), 'utf8')
const editorStyles = await readFile(new URL('../src/app/admin/platform/blog/[id]/blog-editor.module.css', import.meta.url), 'utf8')
const modal = await readFile(new URL('../src/components/platform/ui/PlatformModal.tsx', import.meta.url), 'utf8')
const modalStyles = await readFile(new URL('../src/components/platform/ui/PlatformModal.module.css', import.meta.url), 'utf8')

assert.match(editor, /\bPlatformModal\b/, 'asset picker must reuse the shared modal contract')
assert.match(editor, /size="wide"/, 'asset picker must use the shared wide modal size')
assert.match(editor, /closeDisabled=\{pending \|\| isUploadPending\}/, 'asset picker must not close during attachment or upload')
assert.match(editor, /closeLabel="사진보관함 닫기"/, 'asset picker close control must retain its accessible name')
assert.match(editor, /data-modal-initial-focus/, 'asset picker must declare a stable initial focus target')
assert.doesNotMatch(editor, /assetPickerOverlay|asset-picker-title/, 'asset picker must not duplicate shared dialog semantics')
assert.doesNotMatch(editorStyles, /\.assetPickerOverlay\b/, 'editor styles must not duplicate the shared modal overlay')
assert.match(editorStyles, /\.assetPickerContent\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/, 'conditional picker content must use a clipping-safe column layout')
assert.doesNotMatch(editorStyles, /\.assetPickerContent\s*\{[\s\S]*?grid-template-rows:/, 'picker content must not assign conditional children to fixed grid rows')
assert.match(modal, /size\?: 'sm' \| 'md' \| 'wide'/, 'shared modal must expose the wide size')
assert.match(modal, /closeLabel\?: string/, 'shared modal must allow route-specific close labels')
assert.match(modalStyles, /\.wide\s*\{[\s\S]*?max-width:/, 'shared modal must style the wide size')

console.log('blog editor asset picker modal contract passed')
