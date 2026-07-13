import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getPublishedBlogPosts } from '@/lib/content-os/blog-rendering'
import BlogExplorerClient from './BlogExplorerClient'
import BlogFinalExperience from './BlogFinalExperience'
import BlogHomeHero from './BlogHomeHero'
import { BLOG_HOME_MEDIA } from './blog-home-assets'
import { buildBlogHomeModel, type BlogHomeCategory, type BlogHomePost } from './blog-home-model'
import styles from './blog.module.css'

const CATEGORY_LABEL: Record<string, string> = {
  case_study: '시공 사례',
  product_guide: '중문·도어 선택',
  customer_qa: '고객 질문',
  field_knowhow: '현장 조건',
  price_guide: '가격·견적',
  area_guide: '지역 상담 안내',
}

const CATEGORY_ORDER = [
  'case_study',
  'product_guide',
  'customer_qa',
  'field_knowhow',
  'price_guide',
  'area_guide',
]

export const metadata: Metadata = {
  title: '문장군 블로그',
  description: '중문과 도어, 현장 조건, 고객 질문, 제작과 시공 이야기를 모아두는 문장군 공식 블로그입니다.',
}

export const revalidate = 60

export default async function BlogIndexPage() {
  await connection()

  const posts = await getPublishedBlogPosts()
  const categoryCounts = posts.reduce((counts, post) => {
    counts.set(post.category, (counts.get(post.category) ?? 0) + 1)
    return counts
  }, new Map<string, number>())
  const categories: BlogHomeCategory[] = [
    { value: 'all', label: '전체', count: posts.length },
    ...CATEGORY_ORDER.filter(category => categoryCounts.has(category)).map(category => ({
      value: category,
      label: CATEGORY_LABEL[category] ?? category,
      count: categoryCounts.get(category) ?? 0,
    })),
  ]
  const explorerPosts: BlogHomePost[] = posts.map(post => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    category: post.category,
    categoryLabel: CATEGORY_LABEL[post.category] ?? post.category,
    primaryKeyword: post.primaryKeyword,
    targetQuestion: post.targetQuestion,
    summaryAnswer: post.summaryAnswer,
    serviceArea: post.serviceArea,
    productType: post.productType,
    publishedAt: post.publishedAt,
    coverMedia: post.coverMedia
      ? {
          url: post.coverMedia.url,
          altText: post.coverMedia.altText,
        }
      : null,
  }))
  const homeModel = buildBlogHomeModel(explorerPosts, categories)

  return (
    <main className={styles.page} data-mg-theme="blog" data-mg-blog-experience="showroom">
      <BlogHomeHero
        media={BLOG_HOME_MEDIA.hero}
        hasPosts={posts.length > 0}
        searchPosts={explorerPosts}
      />

      {posts.length === 0 ? (
        <div className={styles.empty}>
          <strong>아직 공개된 블로그 글이 없습니다.</strong>
          <span>문장군이 실제 상담과 현장 기준을 바탕으로 차근차근 채워가겠습니다.</span>
        </div>
      ) : (
        <BlogExplorerClient posts={explorerPosts} categories={categories} homeModel={homeModel} />
      )}

      <BlogFinalExperience
        hasPosts={posts.length > 0}
        hasLatestPosts={homeModel.latestPosts.length > 0}
      />
    </main>
  )
}
