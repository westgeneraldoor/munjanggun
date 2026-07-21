import { notFound } from 'next/navigation'
import BlogPostRenderer from '@/components/blog/BlogPostRenderer'
import type { BlogRenderData } from '@/lib/content-os/blog-rendering'

export const dynamic = 'force-dynamic'

const data: BlogRenderData = {
  post: {
    id: '00000000-0000-4000-8000-000000000101',
    title: '공개 GIF 렌더링 회귀 검증',
    slug: 'public-gif-regression',
    excerpt: '공개 블로그가 GIF 원본 애니메이션을 그대로 재생하는지 확인합니다.',
    seoTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    category: 'product_guide',
    status: 'published',
    primaryKeyword: '중문 GIF',
    targetQuestion: 'GIF 원본이 공개 글에서 움직이나요?',
    summaryAnswer: '공개 렌더러는 검증된 GIF 원본 URL을 img 요소에 그대로 전달합니다.',
    relatedQuestions: [],
    serviceArea: null,
    productType: '3연동 중문 베이직',
    publishedAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  },
  blocks: [
    {
      id: '00000000-0000-4000-8000-000000000102',
      type: 'image',
      headingLevel: null,
      text: null,
      mediaId: '00000000-0000-4000-8000-000000000103',
      metadata: {},
      displayOrder: 0,
    },
  ],
  media: [
    {
      id: '00000000-0000-4000-8000-000000000103',
      usageStatus: 'published',
      url: '/test-fixtures/blog-public-gif/animated.gif',
      altText: '문장군 베이직 제품 동작 예시',
      caption: 'GIF 원본 애니메이션 검증용 캡션',
      sourceLabel: 'official_reviewed contract fixture',
      usedAsCover: false,
    },
  ],
  contentGraphSections: [],
  relatedPosts: [],
  nextPost: null,
}

export default function BlogPublicGifFixturePage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <BlogPostRenderer data={data} surface="public-page" />
}
