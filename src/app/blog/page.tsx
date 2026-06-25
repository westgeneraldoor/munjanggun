import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedBlogPosts } from '@/lib/content-os/blog-rendering'
import styles from './blog.module.css'

const CATEGORY_LABEL: Record<string, string> = {
  case_study: '시공 사례',
  product_guide: '제품 가이드',
  customer_qa: '고객 Q&A',
  field_knowhow: '현장 노하우',
  price_guide: '견적 가이드',
  area_guide: '지역 안내',
}

export const metadata: Metadata = {
  title: '문장군 블로그',
  description: '문장군 공식 콘텐츠 OS에 발행된 시공 사례, 제품 가이드, 고객 Q&A를 모아봅니다.',
}

export const revalidate = 60

function formatDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value))
}

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts()

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>MUNJANGGUN CONTENT OS</span>
            <h1>문과 현장을 이해하는 글</h1>
            <p>
              중문, 방문, ABS도어, 현관문 시공을 고민하는 분들이 실제 선택 전에 확인해야 할 기준을 정리합니다.
            </p>
          </div>
          <aside className={styles.headerAside}>
            <strong>글은 발행 승인된 콘텐츠만 공개됩니다.</strong>
            <span>AI 초안, 검수 메모, 미승인 사진, private 후보 이미지는 이 화면에 노출되지 않습니다.</span>
          </aside>
        </header>

        {posts.length === 0 ? (
          <div className={styles.empty}>아직 발행된 문장군 블로그 글이 없습니다.</div>
        ) : (
          <div className={styles.grid}>
            {posts.map(post => {
              const publishedDate = formatDate(post.publishedAt)
              return (
                <Link key={post.id} href={`/blog/${post.slug}`} className={styles.card}>
                  <div className={styles.thumb}>
                    {post.coverMedia?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.coverMedia.url} alt={post.coverMedia.altText || post.title} />
                    ) : (
                      <div className={styles.thumbFallback}>{CATEGORY_LABEL[post.category] ?? post.category}</div>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.metaRow}>
                      <span>{CATEGORY_LABEL[post.category] ?? post.category}</span>
                      {publishedDate && <time dateTime={post.publishedAt ?? undefined}>{publishedDate}</time>}
                    </div>
                    <h2>{post.title}</h2>
                    {post.excerpt && <p>{post.excerpt}</p>}
                    <div className={styles.tagRow}>
                      {post.primaryKeyword && <span>{post.primaryKeyword}</span>}
                      {post.serviceArea && <span>{post.serviceArea}</span>}
                      {post.productType && <span>{post.productType}</span>}
                    </div>
                    {post.targetQuestion && <div className={styles.question}>{post.targetQuestion}</div>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
