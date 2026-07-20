import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

const [
  adminLayout,
  barrel,
  button,
  buttonCss,
  iconButtonCss,
  linkButton,
  segmentedControl,
  segmentedControlCss,
  statusBadge,
  pageHeader,
  statePanel,
  queue,
  queueCss,
  intakeLoading,
  tokenPolicyConfig,
  adminSidebar,
  adminSidebarCss,
] = await Promise.all([
  source('src/app/admin/layout.tsx'),
  source('src/components/platform/ui/index.ts'),
  source('src/components/platform/ui/PlatformButton.tsx'),
  source('src/components/platform/ui/PlatformButton.module.css'),
  source('src/components/platform/ui/PlatformIconButton.module.css'),
  source('src/components/platform/ui/PlatformLinkButton.tsx'),
  source('src/components/platform/ui/PlatformSegmentedControl.tsx'),
  source('src/components/platform/ui/PlatformSegmentedControl.module.css'),
  source('src/components/platform/ui/PlatformStatusBadge.tsx'),
  source('src/components/platform/ui/PlatformPageHeader.tsx'),
  source('src/components/platform/ui/PlatformStatePanel.tsx'),
  source('src/app/admin/platform/blog/BlogDraftQueueClient.tsx'),
  source('src/app/admin/platform/blog/blog-draft-queue.module.css'),
  source('src/app/admin/platform/blog/new/loading.tsx'),
  source('scripts/ui-token-policy.config.mjs'),
  source('src/components/admin/AdminSidebar.tsx'),
  source('src/components/admin/AdminSidebar.module.css'),
])

assert.match(adminLayout, /data-mg-theme=["']admin["']/)

for (const name of [
  'PlatformCheckbox',
  'PlatformChip',
  'PlatformLinkButton',
  'PlatformList',
  'PlatformEditorSection',
  'PlatformSegmentedControl',
  'PlatformStatusBadge',
  'PlatformPageHeader',
  'PlatformPanel',
  'PlatformPreviewFrame',
  'PlatformStatePanel',
  'PlatformToolbar',
  'PlatformTabPanel',
  'PlatformTabs',
  'PlatformTable',
]) {
  assert.match(barrel, new RegExp(`export \\{ ${name} \\}`), `${name} must be exported from the shared UI barrel`)
}

assert.match(button, /loadingLabel\s*=\s*['"]처리 중…['"]/)
assert.match(button, /aria-live=["']polite["']/)
assert.match(button, /className=\{styles\.content\}/)
assert.match(buttonCss, /min-height:\s*var\(--mg-control-size-min\)/)
assert.doesNotMatch(buttonCss, /\.sm\s*\{[\s\S]*?min-height:\s*var\(--mg-button-height-sm\)/)
assert.match(buttonCss, /\.content\s*\{[\s\S]*?display:\s*inline-flex[\s\S]*?gap:\s*var\(--mg-space-2\)/)
assert.match(iconButtonCss, /(?:min-width|width):\s*var\(--mg-control-size-min\)/)
assert.match(iconButtonCss, /(?:min-height|height):\s*var\(--mg-control-size-min\)/)

assert.match(linkButton, /import Link from ['"]next\/link['"]/)
assert.match(linkButton, /React\.ComponentPropsWithoutRef<typeof Link>/)
assert.match(segmentedControl, /role=["']group["']/)
assert.match(segmentedControl, /aria-pressed=\{item\.value === value\}/)
assert.match(segmentedControl, /type=["']button["']/)
assert.match(segmentedControlCss, /min-height:\s*var\(--mg-control-size-min\)/)
assert.match(segmentedControlCss, /prefers-reduced-motion:\s*reduce/)
assert.doesNotMatch(statusBadge, /role=["']status["']/)
assert.match(pageHeader, /<h1>\{title\}<\/h1>/)
assert.match(statePanel, /tone === ['"]error['"] \? ['"]alert['"] : ['"]status['"]/)

for (const primitive of [
  'PlatformLinkButton',
  'PlatformSegmentedControl',
  'PlatformStatusBadge',
  'PlatformPageHeader',
  'PlatformPanel',
  'PlatformStatePanel',
]) {
  assert.match(queue, new RegExp(`\\b${primitive}\\b`), `blog queue must prove the ${primitive} contract`)
}

assert.doesNotMatch(queue, /className=\{styles\.(?:intakeLink|tabs|tab|statusBadge|empty|errorState)\}/)
assert.doesNotMatch(queueCss, /^\.(?:intakeLink|tabs|tab|statusBadge|empty|errorState)\b/m)
assert.match(intakeLoading, /AdminRouteLoading/)
assert.doesNotMatch(intakeLoading, /approved-manuscript-intake\.module\.css/)
assert.match(adminSidebar, /aria-expanded=\{isOpen\}/)
assert.match(adminSidebar, /aria-controls=["']admin-sidebar["']/)
assert.match(adminSidebar, /aria-current=\{isActive \? ['"]page['"] : undefined\}/)
assert.match(adminSidebar, /event\.key === ['"]Escape['"]/)
assert.match(adminSidebar, /event\.key === ['"]Tab['"]/)
assert.match(adminSidebar, /window\.matchMedia\(['"]\(max-width: 1023px\)['"]\)/)
assert.match(adminSidebar, /if \(!event\.matches\) setIsOpen\(false\)/)
assert.match(adminSidebar, /mainContent\.inert = true/)
assert.match(adminSidebar, /role=\{isOpen \? ['"]dialog['"] : undefined\}/)
assert.match(adminSidebar, /aria-modal=\{isOpen \|\| undefined\}/)
assert.match(adminSidebar, /PlatformIconButton/)
assert.match(adminSidebarCss, /\.sidebar\s*\{[\s\S]*?visibility:\s*hidden/)
assert.match(adminSidebarCss, /@media \(min-width: 1024px\)[\s\S]*?\.sidebar\s*\{[\s\S]*?visibility:\s*visible/)

for (const cssFile of [
  'PlatformCheckbox.module.css',
  'PlatformChip.module.css',
  'PlatformButton.module.css',
  'PlatformEditorSection.module.css',
  'PlatformIconButton.module.css',
  'PlatformList.module.css',
  'PlatformSegmentedControl.module.css',
  'PlatformStatusBadge.module.css',
  'PlatformPageHeader.module.css',
  'PlatformPanel.module.css',
  'PlatformPreviewFrame.module.css',
  'PlatformStatePanel.module.css',
  'PlatformToolbar.module.css',
  'PlatformTabs.module.css',
  'PlatformTable.module.css',
]) {
  assert.match(tokenPolicyConfig, new RegExp(cssFile.replace('.', '\\.')), `${cssFile} must be governed by the raw-token policy`)
}

console.log('admin UI primitive contract passed')
