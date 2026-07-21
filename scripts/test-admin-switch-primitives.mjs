import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8').catch(() => '')

const [component, styles, uiIndex, nodeForm, siteForm, tokenPolicy, fixture] = await Promise.all([
  read('src/components/platform/ui/PlatformSwitch.tsx'),
  read('src/components/platform/ui/PlatformSwitch.module.css'),
  read('src/components/platform/ui/index.ts'),
  read('src/components/admin/NodeForm.tsx'),
  read('src/components/admin/SiteSettingsForm.tsx'),
  read('scripts/ui-token-policy.config.mjs'),
  read('src/app/test-fixtures/admin-switch/page.tsx'),
])

assert.match(component, /<button\b/, 'the switch must use a native button')
assert.match(component, /role="switch"/, 'the switch must expose the switch role')
assert.match(component, /aria-checked=\{checked\}/, 'the switch must expose its checked state')
assert.match(component, /disabled=\{disabled\}/, 'the switch must expose its disabled state')
assert.match(component, /onCheckedChange\(!checked\)/, 'the switch must emit its next checked state')
assert.match(uiIndex, /export \{ PlatformSwitch \}/, 'the shared switch must be exported')

for (const [name, source] of [['NodeForm', nodeForm], ['SiteSettingsForm', siteForm]]) {
  assert.match(source, /\bPlatformSwitch\b/, `${name} must use the shared switch`)
}
assert.doesNotMatch(nodeForm, /styles\.switch(?:Thumb|Container)?\b/, 'NodeForm must remove its bespoke switch shell')
assert.doesNotMatch(siteForm, /width:\s*'44px'[\s\S]*?setHeroEnabled/, 'SiteSettingsForm must remove its inline clickable switch')
assert.doesNotMatch(styles, /#[\da-f]{3,8}\b|rgba?\(|(?<![-\w])(?:-?\d*\.\d+|-?\d+)(?:px|rem|em)\b/i, 'shared switch styles must use canonical tokens')
assert.ok(tokenPolicy.includes('src/components/platform/ui/PlatformSwitch.module.css'), 'switch styles must be governed by the UI token policy')
assert.match(fixture, /process\.env\.NODE_ENV === 'production'/, 'the switch fixture must be disabled in production')
assert.match(fixture, /notFound\(\)/, 'the switch fixture must return a production 404')

console.log('admin switch primitive contract passed')
