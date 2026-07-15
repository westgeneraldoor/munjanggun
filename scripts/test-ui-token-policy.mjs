import assert from 'node:assert/strict'

import { verifyUiTokenPolicy } from './verify-ui-token-policy.mjs'

const baseConfig = {
  generatedFiles: ['src/styles/generated/brand.css'],
  declarationAllowlist: ['--mg-project-surface', '--mg-project-gap', '--mg-external-brand-color'],
  rawValueTokenAllowlist: ['--mg-external-brand-color'],
  externalDefinitions: ['--external-token'],
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

console.log('UI token policy fixture contract passed')
