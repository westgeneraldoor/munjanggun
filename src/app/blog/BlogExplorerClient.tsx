'use client'

import Link from 'next/link'
import { ArrowRight, Search, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import styles from './blog.module.css'

export type BlogExplorerPost = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string
  categoryLabel: string
  primaryKeyword: string | null
  targetQuestion: string | null
  summaryAnswer: string | null
  serviceArea: string | null
  productType: string | null
  publishedAt: string | null
  coverMedia: {
    url: string | null
    altText: string | null
  } | null
}

export type BlogExplorerCategory = {
  value: string
  label: string
  count: number
}

type BlogExplorerClientProps = {
  posts: BlogExplorerPost[]
  categories: BlogExplorerCategory[]
  featuredPost: BlogExplorerPost | null
}

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
})

function normalize(value: string | null | undefined) {
  return value?.toLocaleLowerCase('ko-KR').trim() ?? ''
}

function formatDate(value: string | null) {
  if (!value) return null
  return dateFormatter.format(new Date(value))
}

export default function BlogExplorerClient({ posts, categories, featuredPost }: BlogExplorerClientProps) {
  const searchInputId = useId()
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const categoryLabelByValue = useMemo(() => {
    return new Map(categories.map(category => [category.value, category.label]))
  }, [categories])

  const filteredPosts = useMemo(() => {
    const normalizedQuery = normalize(query)

    return posts.filter(post => {
      const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory
      if (!matchesCategory) return false
      if (!normalizedQuery) return true

      const searchableText = [
        post.title,
        post.excerpt,
        post.categoryLabel,
        post.primaryKeyword,
        post.targetQuestion,
        post.summaryAnswer,
        post.serviceArea,
        post.productType,
      ]
        .map(normalize)
        .join(' ')

      return searchableText.includes(normalizedQuery)
    })
  }, [posts, query, selectedCategory])

  const selectedCategoryLabel = categoryLabelByValue.get(selectedCategory) ?? '전체'
  const hasActiveFilter = Boolean(query.trim()) || selectedCategory !== 'all'

  function resetFilters() {
    setQuery('')
    setSelectedCategory('all')
  }

  return (
    <>
      <section className={styles.explorer} aria-labelledby="all-blog-title">
        <div className={styles.explorerHeader}>
          <div>
            <span>전체 글</span>
            <h2 id="all-blog-title">필요한 기준을 바로 찾아보세요</h2>
            <p>중문, 견적, 현장 조건, 지역처럼 궁금한 단어로 찾거나 카테고리별로 골라볼 수 있습니다.</p>
          </div>
          <strong className={styles.totalPill}>{posts.length}개 글</strong>
        </div>

        <div className={styles.searchPanel}>
          <div className={styles.searchBox}>
            <Search size={18} aria-hidden="true" />
            <label htmlFor={searchInputId} className={styles.srOnly}>
              블로그 글 검색
            </label>
            <input
              id={searchInputId}
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="중문, 견적, 신발장, 지역으로 검색"
            />
            {query.trim() && (
              <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기">
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className={styles.categoryTabs} aria-label="카테고리별 글 보기">
            {categories.map(category => (
              <button
                key={category.value}
                type="button"
                className={`${styles.categoryTab} ${category.value === selectedCategory ? styles.categoryTabActive : ''}`}
                onClick={() => setSelectedCategory(category.value)}
                aria-pressed={category.value === selectedCategory}
              >
                <span>{category.label}</span>
                <strong>{category.count}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      {featuredPost && !hasActiveFilter && (
        <section className={styles.featured} aria-labelledby="featured-blog-title">
          <div className={styles.sectionHeader}>
            <span>먼저 읽기 좋은 글</span>
            <h2 id="featured-blog-title">선택 전에 확인할 핵심 기준</h2>
          </div>
          <Link href={`/blog/${featuredPost.slug}`} className={styles.featuredCard}>
            <div className={styles.featuredImage}>
              {featuredPost.coverMedia?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featuredPost.coverMedia.url} alt={featuredPost.coverMedia.altText || featuredPost.title} />
              ) : (
                <div className={styles.thumbFallback}>{featuredPost.categoryLabel}</div>
              )}
            </div>
            <div className={styles.featuredBody}>
              <div className={styles.metaRow}>
                <span>{featuredPost.categoryLabel}</span>
                {formatDate(featuredPost.publishedAt) && (
                  <time dateTime={featuredPost.publishedAt ?? undefined}>{formatDate(featuredPost.publishedAt)}</time>
                )}
              </div>
              <h3>{featuredPost.title}</h3>
              {featuredPost.summaryAnswer && <p>{featuredPost.summaryAnswer}</p>}
              {!featuredPost.summaryAnswer && featuredPost.excerpt && <p>{featuredPost.excerpt}</p>}
              {featuredPost.targetQuestion && <strong>{featuredPost.targetQuestion}</strong>}
              <span className={styles.readMore}>
                글 보기
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </div>
          </Link>
        </section>
      )}

      <section className={styles.postSection} aria-labelledby="latest-blog-title">
        <div className={styles.sectionHeader}>
          <span>{posts.length}개의 공개 가이드</span>
          <h2 id="latest-blog-title">전체 시공 가이드</h2>
        </div>
        <div className={styles.resultHeader}>
          <span>
            {selectedCategoryLabel}에서 {filteredPosts.length}개 글
            {query.trim() ? ` · "${query.trim()}" 검색` : ''}
          </span>
          {hasActiveFilter && (
            <button type="button" onClick={resetFilters}>
              필터 초기화
            </button>
          )}
        </div>

        {filteredPosts.length === 0 ? (
          <div className={styles.emptyResult}>
            <strong>조건에 맞는 글이 없습니다.</strong>
            <span>검색어를 줄이거나 전체 카테고리에서 다시 확인해보세요.</span>
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredPosts.map(post => {
              const publishedDate = formatDate(post.publishedAt)
              return (
                <Link key={post.id} href={`/blog/${post.slug}`} className={styles.card}>
                  <div className={styles.thumb}>
                    {post.coverMedia?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.coverMedia.url} alt={post.coverMedia.altText || post.title} />
                    ) : (
                      <div className={styles.thumbFallback}>{post.categoryLabel}</div>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.metaRow}>
                      <span>{post.categoryLabel}</span>
                      {publishedDate && <time dateTime={post.publishedAt ?? undefined}>{publishedDate}</time>}
                    </div>
                    <h3>{post.title}</h3>
                    {post.excerpt && <p>{post.excerpt}</p>}
                    <div className={styles.tagRow}>
                      {post.primaryKeyword && <span>{post.primaryKeyword}</span>}
                      {post.serviceArea && <span>{post.serviceArea}</span>}
                      {post.productType && <span>{post.productType}</span>}
                    </div>
                    {post.targetQuestion && <div className={styles.question}>{post.targetQuestion}</div>}
                    <span className={styles.cardAction}>
                      글 보기
                      <ArrowRight size={15} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
