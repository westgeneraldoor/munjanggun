import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import uiTokenPolicyConfig from './ui-token-policy.config.mjs'
import { verifyUiTokenPolicy } from './verify-ui-token-policy.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function listCssFiles(relativeDirectory) {
  const absoluteDirectory = path.join(projectRoot, relativeDirectory)
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const relativePath = path.posix.join(relativeDirectory, entry.name)
    return entry.isDirectory() ? listCssFiles(relativePath) : [relativePath]
  }))

  return files.flat().filter(file => file.endsWith('.css'))
}

const protectedAdminCss = [
  ...await listCssFiles('src/app/admin'),
  ...await listCssFiles('src/components/admin'),
].sort()

{
  const configuredCss = new Set(uiTokenPolicyConfig.files)
  const omittedCss = protectedAdminCss.filter(file => !configuredCss.has(file))

  assert.deepEqual(
    omittedCss,
    [],
    'every admin and CMS stylesheet must be covered by the UI token policy',
  )
  assert.deepEqual(
    uiTokenPolicyConfig.requiredCssDirectories,
    ['src/app/admin', 'src/components/admin'],
    'the standalone verifier must discover future admin and CMS stylesheets',
  )
}

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map(value => Number.parseInt(value, 16) / 255)
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
}

function contrastRatio(left, right) {
  const brightest = Math.max(relativeLuminance(left), relativeLuminance(right))
  const darkest = Math.min(relativeLuminance(left), relativeLuminance(right))
  return (brightest + 0.05) / (darkest + 0.05)
}

{
  const [generated, adapter, editor, intake, queue, ...adminCssSources] = await Promise.all([
    readFile(path.join(projectRoot, 'src/styles/generated/brand.css'), 'utf8'),
    readFile(path.join(projectRoot, 'src/styles/munjanggun-brand.css'), 'utf8'),
    readFile(path.join(projectRoot, 'src/app/admin/platform/blog/[id]/blog-editor.module.css'), 'utf8'),
    readFile(path.join(projectRoot, 'src/app/admin/platform/blog/new/approved-manuscript-intake.module.css'), 'utf8'),
    readFile(path.join(projectRoot, 'src/app/admin/platform/blog/blog-draft-queue.module.css'), 'utf8'),
    ...protectedAdminCss.map(file => readFile(path.join(projectRoot, file), 'utf8')),
  ])
  const warningHex = generated.match(/--mg-color-warning-600:\s*(#[0-9a-f]{6})/i)?.[1]
  const surfaceHex = generated.match(/--mg-color-neutral-0:\s*(#[0-9a-f]{6})/i)?.[1]

  assert.match(adapter, /--mg-admin-accent-text:\s*var\(--mg-color-warning-600\)/)
  assert.ok(contrastRatio(warningHex, surfaceHex) >= 4.5, 'admin accent text must meet WCAG AA on a light surface')
  assert.equal(
    adminCssSources.some(source => /(^|[;{]\s*)color:\s*var\(--admin-accent\)/m.test(source)),
    false,
    'admin accent gold may not be used as low-contrast text',
  )
  assert.match(editor, /\.primaryButton \{[\s\S]*?background:\s*var\(--mg-action-primary-bg\)/)
  assert.match(editor, /\.primaryButton:hover:not\(:disabled\)[\s\S]*?background:\s*var\(--mg-action-primary-hover\)/)
  assert.match(intake, /\.primaryButton \{[\s\S]*?background:\s*var\(--mg-action-primary-bg\)/)
  assert.match(intake, /\.primaryButton:hover:not\(:disabled\)[\s\S]*?background:\s*var\(--mg-action-primary-hover\)/)
  assert.match(intake, /\.primaryButton:active:not\(:disabled\)[\s\S]*?background:\s*var\(--mg-action-primary-active\)/)
  assert.match(intake, /\.queueLink:active,[\s\S]*?color:\s*var\(--mg-color-ink-900\)/)
  assert.match(editor, /\.editorModeActive \{[\s\S]*?background:\s*var\(--mg-admin-accent-surface\)/)
  assert.match(queue, /\.rowSelected td \{[\s\S]*?background:\s*var\(--mg-admin-accent-surface\)/)
}

const baseConfig = {
  generatedFiles: ['src/styles/generated/brand.css'],
  tokenDefinitionFiles: [],
  globalDefinitionFiles: [],
  sharedLayoutConstants: [],
  declarationAllowlist: ['--mg-project-surface', '--mg-project-gap', '--mg-external-brand-color'],
  rawValueTokenAllowlist: ['--mg-external-brand-color'],
  externalDefinitions: ['--external-token'],
  generatedTokenOverrideScopes: [
    {
      file: 'src/styles/munjanggun-brand.css',
      selectors: ['[data-mg-theme="portal"]'],
    },
  ],
  layoutConstants: [
    {
      name: 'approved-preview-gap',
      file: 'src/styles/munjanggun-brand.css',
      property: '--mg-project-gap',
      value: '28px',
    },
    {
      name: 'approved-mobile-breakpoint',
      file: 'src/styles/munjanggun-brand.css',
      property: '@media',
      value: '640px',
    },
  ],
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [{
      path: 'src/components/admin/Card.module.css',
      content: '.one { color: red; background: oklch(60% 0.2 30); border-color: transparent; --local-tone: blue; outline-color: var(--external-token, red); }\n',
    }],
  })

  assert.equal(result.diagnostics.filter(item => /unauthorized raw color red/.test(item)).length, 1)
  assert.ok(result.diagnostics.some(item => /unauthorized raw color oklch\(60% 0\.2 30\)/.test(item)))
  assert.ok(result.diagnostics.some(item => /unauthorized raw color blue/.test(item)))
  assert.equal(result.diagnostics.some(item => /unauthorized raw color transparent/.test(item)), false)
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [
      {
        path: 'src/components/admin/Local.module.css',
        content: '.local { --local-only: var(--external-token); color: var(--local-only); }\n',
      },
      {
        path: 'src/components/admin/Other.module.css',
        content: '.other { color: var(--local-only); }\n',
      },
    ],
  })

  assert.ok(result.diagnostics.some(item => /Other\.module\.css:1: undefined variable --local-only/.test(item)))
  assert.equal(result.diagnostics.some(item => /Local\.module\.css:1: undefined variable --local-only/.test(item)), false)
}

{
  const result = verifyUiTokenPolicy({
    config: {
      ...baseConfig,
      layoutConstants: [],
      sharedLayoutConstants: [
        { name: 'admin-tablet-breakpoint', property: '@media', value: '768px' },
      ],
    },
    files: [{
      path: 'src/components/admin/Card.module.css',
      content: '@media (min-width: 768px) { .card { color: var(--external-token); } }\n',
    }],
  })

  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual(result.usedLayoutConstants, ['admin-tablet-breakpoint'])
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [{
      path: 'src/components/admin/Card.module.css',
      content: '.card { box-shadow: 0 0 0 var(--external-token); text-shadow: 0 0 var(--external-token); filter: drop-shadow(0 0 var(--external-token)); }\n',
    }],
  })
  assert.equal(result.diagnostics.filter(item => /unauthorized raw shadow/.test(item)).length, 3)
}

{
  const result = verifyUiTokenPolicy({
    config: {
      ...baseConfig,
      tokenDefinitionFiles: ['src/app/globals.css'],
      tokenDefinitionScopes: [{ file: 'src/app/globals.css', selectors: [':root'] }],
    },
    files: [
      {
        path: 'src/app/globals.css',
        content: ':root { --legacy-admin-surface: #ffffff; --legacy-admin-gap: 17px; --mg-bg: #000000; }\n.leak { color: #123456; }\n',
      },
      {
        path: 'src/styles/generated/brand.css',
        content: ':root { --mg-bg: #ffffff; }\n',
      },
      {
        path: 'src/components/admin/Card.module.css',
        content: '.card { color: var(--legacy-admin-surface); width: 17px; gap: 19px; }\n',
      },
    ],
  })

  assert.equal(result.diagnostics.some(item => /src\/app\/globals\.css:1: unauthorized raw/.test(item)), false)
  assert.ok(result.diagnostics.some(item => /central token collision --mg-bg/.test(item)))
  assert.ok(result.diagnostics.some(item => /src\/app\/globals\.css:2: unauthorized raw color #123456/.test(item)))
  assert.equal(result.diagnostics.some(item => /undefined variable --legacy-admin-surface/.test(item)), false)
  assert.equal(result.diagnostics.some(item => /unauthorized layout constant 17px/.test(item)), false)
  assert.ok(result.diagnostics.some(item => /unauthorized layout constant 19px/.test(item)))
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [{
      path: 'src/styles/munjanggun-brand.css',
      content: ':root {\n  --mg-project-gap: 28px;\n  --mg-external-brand-color: #fee500;\n}\n',
    }],
  })
  assert.deepEqual(
    result.diagnostics.filter(item => !item.includes('approved-mobile-breakpoint')),
    [],
    'an explicitly allowlisted external-brand token may own its raw color',
  )
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [{
      path: 'src/styles/munjanggun-brand.css',
      content: '.card { --mg-project-gap: 28px; color: #123456; padding: 17px; }\n@media (max-width: 640px) { .card { color: var(--external-token); } }\n',
    }],
  })
  assert.ok(result.diagnostics.some(item => /unauthorized raw color #123456/.test(item)))
  assert.ok(result.diagnostics.some(item => /unauthorized layout constant 17px/.test(item)))
  assert.deepEqual(result.usedLayoutConstants, ['approved-mobile-breakpoint', 'approved-preview-gap'])
}

{
  const generated = ':root { --mg-bg: #fff; }\n'
  const allowed = verifyUiTokenPolicy({
    config: baseConfig,
    files: [
      { path: 'src/styles/generated/brand.css', content: generated },
      {
        path: 'src/styles/munjanggun-brand.css',
        content: '[data-mg-theme="portal"] { --mg-bg: var(--external-token); --mg-project-gap: 28px; }\n@media (max-width: 640px) {}\n',
      },
    ],
  })
  assert.equal(allowed.diagnostics.some(item => /central token collision/.test(item)), false)

  const collision = verifyUiTokenPolicy({
    config: baseConfig,
    files: [
      { path: 'src/styles/generated/brand.css', content: generated },
      {
        path: 'src/styles/munjanggun-brand.css',
        content: ':root { --mg-bg: var(--external-token); --mg-project-gap: 28px; }\n@media (max-width: 640px) {}\n',
      },
    ],
  })
  assert.ok(collision.diagnostics.some(item => /central token collision --mg-bg in selector :root/.test(item)))
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [{
      path: 'src/styles/munjanggun-brand.css',
      content: '@media (max-width: 640px) {\n  :root { --mg-project-gap: 28px; }\n}\n',
    }],
  })
  assert.deepEqual(result.diagnostics, [], 'named media-query layout constants are explicit policy exceptions')
  assert.deepEqual(result.usedLayoutConstants, ['approved-mobile-breakpoint', 'approved-preview-gap'])
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [
      {
        path: 'src/styles/generated/brand.css',
        content: ':root {\n  --mg-color-ink: #171717;\n}\n',
      },
      {
        path: 'src/styles/munjanggun-brand.css',
        content: ':root {\n  --mg-project-surface: var(--mg-color-ink);\n  --mg-project-gap: 28px;\n  color: var(--external-token);\n}\n',
      },
    ],
  })
  assert.deepEqual(
    result.diagnostics.filter(item => !item.includes('approved-mobile-breakpoint')),
    [],
    'generated tokens, approved declarations, external definitions, and named constants pass',
  )
  assert.deepEqual(result.usedLayoutConstants, ['approved-preview-gap'])
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [{ path: 'src/styles/munjanggun-brand.css', content: ':root {\n  color: #123456;\n}\n' }],
  })
  assert.ok(result.diagnostics.includes('src/styles/munjanggun-brand.css:2: unauthorized raw color #123456'))
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [{ path: 'src/styles/munjanggun-brand.css', content: '.card {\n  padding: 17px;\n}\n' }],
  })
  assert.ok(result.diagnostics.some(item => /:2: unauthorized layout constant 17px$/.test(item)))
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [{ path: 'src/styles/munjanggun-brand.css', content: '.card {\n  color: var(--missing-token);\n}\n' }],
  })
  assert.ok(result.diagnostics.some(item => /:2: undefined variable --missing-token$/.test(item)))
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [{ path: 'src/styles/munjanggun-brand.css', content: ':root {\n  --mg-surprise: var(--external-token);\n}\n' }],
  })
  assert.ok(result.diagnostics.some(item => /:2: unauthorized token declaration --mg-surprise$/.test(item)))
}

{
  const result = verifyUiTokenPolicy({
    config: baseConfig,
    files: [{ path: 'src/styles/munjanggun-brand.css', content: ':root {\n  --mg-project-gap: 29px;\n}\n' }],
  })
  assert.ok(result.diagnostics.some(item => /unauthorized layout constant 29px/.test(item)))
assert.ok(result.diagnostics.some(item => /named layout constant approved-preview-gap was not used/.test(item)))
}

{
  const adapter = await readFile(new URL('../src/styles/munjanggun-brand.css', import.meta.url), 'utf8')
  for (const selector of ['portal', 'admin']) {
    const scope = adapter.match(new RegExp(`\\[data-mg-theme="${selector}"\\] \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
    assert.match(scope, /--mg-action-primary-bg:\s*var\(--mg-color-ink-900\)/)
    assert.match(scope, /--mg-action-primary-hover:\s*var\(--mg-color-ink-700\)/)
  }
}

console.log('UI token policy fixture contract passed')
