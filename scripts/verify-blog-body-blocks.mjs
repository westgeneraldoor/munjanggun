import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const sourceUrl = new URL('../src/lib/content-os/blog-body-blocks.ts', import.meta.url)
const source = await readFile(sourceUrl, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    isolatedModules: true,
  },
}).outputText
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
const {
  BLOG_BODY_BLOCK_FORBIDDEN_PUBLIC_TERMS,
  normalizeGuideBoxBlock,
  normalizeLinkButtonBlock,
  normalizeChecklistBlock,
  normalizePlaceBlock,
  normalizeQuoteBlock,
  normalizeRelatedPostBlock,
  normalizeQuizBlock,
  normalizeVideoBlock,
  youtubeVideoId,
} = await import(moduleUrl)

{
  const link = normalizeLinkButtonBlock({
    text: '  우리 집 조건 확인하기  ',
    metadata: {
      href: '/portal/measure/new',
      description: '무료 방문실측으로 현장 조건을 확인합니다.',
    },
  })

  assert.deepEqual(link, {
    label: '우리 집 조건 확인하기',
    href: '/portal/measure/new',
    description: '무료 방문실측으로 현장 조건을 확인합니다.',
  }, 'link_button should keep a compact internal action contract')
}

{
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
  assert.equal(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=43'), 'dQw4w9WgXcQ')
  assert.equal(youtubeVideoId('https://www.youtube.com/embed/not-an-id'), null)
  assert.equal(normalizeVideoBlock({ text: '', metadata: { youtube_url: 'https://evil.example/embed/dQw4w9WgXcQ' } }), null)
  assert.equal(normalizeQuoteBlock({ text: '인용문', metadata: { source_url: 'javascript:alert(1)' } }), null)
  assert.deepEqual(
    normalizeQuoteBlock({ text: '  현장 점검은 설치 전 확인이 중요합니다.  ', metadata: { attribution: ' 문장군 ', source_url: 'https://munjanggun.com/guide' } }),
    { quote: '현장 점검은 설치 전 확인이 중요합니다.', attribution: '문장군', sourceUrl: 'https://munjanggun.com/guide' },
  )
  assert.deepEqual(normalizeChecklistBlock({ text: '', metadata: { items: '첫 항목\n\n둘째 항목' } })?.items, ['첫 항목', '둘째 항목'])
  assert.equal(normalizeQuizBlock({ text: '질문', metadata: { answer: '정답' } })?.answer, '정답')
  assert.equal(normalizeQuizBlock({ text: '질문', metadata: { answer: '' } }), null)
  assert.equal(normalizePlaceBlock({ text: '문장군', metadata: { place_url: 'https://www.google.com/' } }), null)
  assert.equal(normalizePlaceBlock({ text: '문장군', metadata: { place_url: 'https://www.google.com/maps/search/?api=1&query=munjanggun' } })?.provider, 'Google')
  assert.equal(normalizePlaceBlock({ text: '문장군', metadata: { place_url: 'https://maps.google.com.evil.example/maps/search/?query=munjanggun' } }), null)
  assert.equal(normalizePlaceBlock({ text: '문장군', metadata: { place_url: 'https://map.kakao.com/?q=munjanggun' } })?.provider, 'Kakao')
  assert.deepEqual(
    normalizeRelatedPostBlock({ text: '', metadata: { related_post_title: '공개된 관련 글', related_post_slug: 'published-related-post' } }),
    { title: '공개된 관련 글', slug: 'published-related-post' },
  )
  assert.equal(normalizeRelatedPostBlock({ text: '', metadata: { related_post_title: '비공개 글', related_post_slug: '../admin' } }), null)
}

{
  assert.equal(
    normalizeLinkButtonBlock({
      text: '외부 링크',
      metadata: { href: 'https://example.com' },
    }),
    null,
    'link_button should reject external URLs until external-link policy is designed',
  )

  assert.equal(
    normalizeLinkButtonBlock({
      text: '관리자 링크',
      metadata: { href: '/admin/platform/blog' },
    }),
    null,
    'link_button should not expose admin or preview paths in public body content',
  )
}

{
  const guide = normalizeGuideBoxBlock({
    text: '신발장, 스위치, 바닥 단차는 실측 때 함께 확인하면 판단하기 쉽습니다.',
    metadata: {
      title: '실측 전에 보면 좋은 조건',
      tone: 'condition',
    },
  })

  assert.deepEqual(guide, {
    title: '실측 전에 보면 좋은 조건',
    body: '신발장, 스위치, 바닥 단차는 실측 때 함께 확인하면 판단하기 쉽습니다.',
    tone: 'condition',
    label: '현장 조건',
  }, 'guide_box should normalize customer-facing field-condition guidance')
}

{
  const guide = normalizeGuideBoxBlock({
    text: '현장 구조에 따라 검토가 필요합니다.',
    metadata: {
      title: '',
      tone: 'unknown',
    },
  })

  assert.equal(guide?.tone, 'guide', 'guide_box should fall back to the calm guide tone')
  assert.equal(guide?.label, '안내', 'guide_box should use a customer-facing default label')
}

{
  const publicTerms = [
    '안내',
    '알아두세요',
    '현장 조건',
    '주의',
    ...BLOG_BODY_BLOCK_FORBIDDEN_PUBLIC_TERMS,
  ]

  assert.ok(
    publicTerms.some(term => BLOG_BODY_BLOCK_FORBIDDEN_PUBLIC_TERMS.includes(term)),
    'test fixture should include forbidden internal terms',
  )
  assert.ok(
    BLOG_BODY_BLOCK_FORBIDDEN_PUBLIC_TERMS.every(term => /AEO|GEO|LLMO|콘텐츠 그래프|검색 노출/.test(term)),
    'forbidden public terms should track internal optimization language',
  )
  assert.ok(
    ['안내', '알아두세요', '현장 조건', '주의'].every(label => !BLOG_BODY_BLOCK_FORBIDDEN_PUBLIC_TERMS.includes(label)),
    'guide labels should remain customer-facing',
  )
}

console.log('blog body block verification passed')
