import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { getPublishedBlogPosts } from '@/lib/content-os/blog-rendering'
import BlogExplorerClient, { type BlogExplorerCategory, type BlogExplorerPost } from './BlogExplorerClient'
import styles from './blog.module.css'

const CATEGORY_LABEL: Record<string, string> = {
  case_study: '시공 사례',
  product_guide: '제품 가이드',
  customer_qa: '고객 Q&A',
  field_knowhow: '현장 노하우',
  price_guide: '견적 가이드',
  area_guide: '지역 안내',
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
  title: '문장군 시공 가이드',
  description: '중문과 도어 시공 전, 우리 집 구조와 견적 조건을 먼저 확인할 수 있는 문장군 공식 가이드입니다.',
}

export const revalidate = 60

const TRUST_ITEMS = [
  '무료 방문실측',
  '직접 제작·전속 시공',
  '공개 가능한 실제 사례',
]

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts()
  const categoryCounts = posts.reduce((counts, post) => {
    counts.set(post.category, (counts.get(post.category) ?? 0) + 1)
    return counts
  }, new Map<string, number>())
  const categories: BlogExplorerCategory[] = [
    { value: 'all', label: '전체', count: posts.length },
    ...CATEGORY_ORDER.filter(category => categoryCounts.has(category)).map(category => ({
      value: category,
      label: CATEGORY_LABEL[category] ?? category,
      count: categoryCounts.get(category) ?? 0,
    })),
  ]
  const explorerPosts: BlogExplorerPost[] = posts.map(post => ({
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

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>문장군 시공 가이드</span>
            <h1>우리 집 문, 고르기 전에 확인할 것들</h1>
            <p>
              중문과 도어는 제품명보다 현장 구조가 먼저입니다. 신발장, 스위치, 바닥 단차, 벽공간처럼
              견적과 시공 방식에 영향을 주는 기준을 고객 눈높이로 정리합니다.
            </p>
            <div className={styles.trustRow} aria-label="문장군 블로그 신뢰 기준">
              {TRUST_ITEMS.map(item => (
                <span key={item}>
                  <CheckCircle2 size={15} aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <aside className={styles.headerAside}>
            <strong>정확한 견적은 집마다 달라집니다.</strong>
            <span>사진과 글로 먼저 기준을 보고, 무료 방문실측에서 구조와 옵션을 함께 확인하세요.</span>
            <Link href="/portal/measure/new" className={styles.headerCta}>
              무료방문 실측견적 신청
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </aside>
        </header>

        {posts.length === 0 ? (
          <div className={styles.empty}>
            <strong>아직 공개된 시공 가이드가 없습니다.</strong>
            <span>문장군이 실제 상담과 현장 기준을 바탕으로 차근차근 채워가겠습니다.</span>
          </div>
        ) : (
          <>
            <BlogExplorerClient posts={explorerPosts} categories={categories} featuredPost={explorerPosts[0] ?? null} />

            <section className={styles.bottomCta} aria-label="문장군 무료 방문실측 안내">
              <div>
                <span>우리 집 조건은 사진만으로 단정하지 않습니다.</span>
                <strong>무료 방문실측에서 구조, 옵션, 견적 조건을 함께 확인하세요.</strong>
              </div>
              <Link href="/portal/measure/new">
                상담 신청
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
