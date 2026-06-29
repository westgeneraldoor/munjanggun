'use client'

import Link from 'next/link'
import { ArrowRight, Search, X } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
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

type BlogTopic = {
  id: string
  title: string
  description: string
  categories: string[]
  keywords: string[]
}

const TOPICS: BlogTopic[] = [
  {
    id: 'choice',
    title: '중문과 도어 고르기',
    description: '제품명보다 우리 집 구조와 쓰임새를 먼저 보는 이야기',
    categories: ['product_guide', 'customer_qa'],
    keywords: ['중문', '도어', '문짝', '선택', '제품'],
  },
  {
    id: 'field',
    title: '현장에서 확인하는 것',
    description: '신발장, 스위치, 바닥 단차, 벽공간처럼 시공 전에 보는 조건',
    categories: ['field_knowhow'],
    keywords: ['현장', '구조', '신발장', '스위치', '단차', '벽공간'],
  },
  {
    id: 'price',
    title: '가격과 견적',
    description: '가격이 집마다 달라지는 이유와 실측 때 확인하는 항목',
    categories: ['price_guide'],
    keywords: ['가격', '견적', '추가금', '실측', '비용'],
  },
  {
    id: 'case',
    title: '시공 사례',
    description: '실제 집에서 어떤 문제를 어떻게 풀었는지 보는 기록',
    categories: ['case_study'],
    keywords: ['시공', '사례', '전후', '현관', '마감'],
  },
  {
    id: 'qa',
    title: '고객 질문',
    description: '상담에서 자주 묻는 질문을 짧고 쉽게 풀어둔 글',
    categories: ['customer_qa'],
    keywords: ['가능한가요', '왜', '어려운가요', '질문', 'Q&A'],
  },
  {
    id: 'making',
    title: '제작과 운영 이야기',
    description: '문장군이 직접 제작하고 전속 시공으로 운영하는 방식',
    categories: ['product_guide', 'field_knowhow'],
    keywords: ['제작', '공장', '전속', '운영', 'A/S', 'AS'],
  },
]

const INITIAL_VISIBLE_POSTS = 12

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
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return dateFormatter.format(date)
}

function searchableText(post: BlogExplorerPost) {
  return [
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
}

function matchesTopic(post: BlogExplorerPost, topic: BlogTopic) {
  if (topic.categories.includes(post.category)) return true

  const compactText = [post.primaryKeyword, post.productType, post.categoryLabel].map(normalize).join(' ')

  if (topic.id === 'choice') {
    return ['중문', '도어', '문짝', '제품'].some(keyword => compactText.includes(keyword))
  }

  if (topic.id === 'field') {
    return ['현장', '구조', '신발장', '스위치', '단차'].some(keyword => compactText.includes(keyword))
  }

  if (topic.id === 'price') {
    return ['가격', '견적', '추가금', '비용'].some(keyword => compactText.includes(keyword))
  }

  if (topic.id === 'making') {
    return ['제작', '공장', '전속', '운영'].some(keyword => compactText.includes(keyword))
  }

  return topic.keywords.some(keyword => compactText.includes(normalize(keyword)))
}

function BlogCard({ post, compact = false }: { post: BlogExplorerPost; compact?: boolean }) {
  const publishedDate = formatDate(post.publishedAt)

  return (
    <Link href={`/blog/${post.slug}`} className={`${styles.card} ${compact ? styles.cardCompact : ''}`}>
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
}

export default function BlogExplorerClient({ posts, categories, featuredPost }: BlogExplorerClientProps) {
  const searchInputId = useId()
  const resultSectionRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_POSTS)

  const topicCounts = useMemo(() => {
    return new Map(TOPICS.map(topic => [topic.id, posts.filter(post => matchesTopic(post, topic)).length]))
  }, [posts])

  const selectedTopicConfig = TOPICS.find(topic => topic.id === selectedTopic) ?? null

  const visibleTopicPosts = useMemo(() => {
    if (!selectedTopicConfig) return posts
    return posts.filter(post => matchesTopic(post, selectedTopicConfig))
  }, [posts, selectedTopicConfig])

  const searchResults = useMemo(() => {
    const normalizedQuery = normalize(query)
    if (!normalizedQuery) return []

    return posts.filter(post => searchableText(post).includes(normalizedQuery))
  }, [posts, query])

  const categoryGroups = useMemo(() => {
    return categories
      .filter(category => category.value !== 'all')
      .map(category => ({
        category,
        posts: posts.filter(post => post.category === category.value),
      }))
      .filter(group => group.posts.length > 0)
  }, [categories, posts])

  const selectedCategoryConfig = categories.find(category => category.value === selectedCategory) ?? null
  const selectedCategoryPosts = useMemo(() => {
    if (!selectedCategoryConfig) return []
    return posts.filter(post => post.category === selectedCategoryConfig.value)
  }, [posts, selectedCategoryConfig])

  const threadItems = useMemo(() => {
    if (!featuredPost) return []

    return [
      featuredPost.targetQuestion,
      featuredPost.primaryKeyword,
      featuredPost.productType,
      featuredPost.serviceArea,
    ]
      .filter((value): value is string => Boolean(value))
      .slice(0, 4)
  }, [featuredPost])

  const hasSearch = Boolean(query.trim())
  const hasTopicFilter = selectedTopic !== 'all'
  const hasCategoryFilter = Boolean(selectedCategoryConfig)
  const selectedTopicTitle = selectedTopicConfig?.title ?? '전체 이야기'
  const focusedResultsTitle = selectedCategoryConfig?.label ?? selectedTopicTitle
  const selectedResultPosts = hasCategoryFilter ? selectedCategoryPosts : visibleTopicPosts
  const visibleSearchResults = searchResults.slice(0, visibleCount)
  const visibleSelectedResults = selectedResultPosts.slice(0, visibleCount)
  const visibleAllPosts = posts.slice(0, visibleCount)

  function showMore() {
    setVisibleCount(count => count + INITIAL_VISIBLE_POSTS)
  }

  function startSearch(value: string) {
    setQuery(value)
    setSelectedTopic('all')
    setSelectedCategory(null)
    setVisibleCount(INITIAL_VISIBLE_POSTS)
  }

  function resetSearch() {
    setQuery('')
    setVisibleCount(INITIAL_VISIBLE_POSTS)
  }

  function moveToResults() {
    window.requestAnimationFrame(() => {
      resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function selectTopic(topicId: string) {
    setQuery('')
    setSelectedCategory(null)
    setSelectedTopic(topicId)
    setVisibleCount(INITIAL_VISIBLE_POSTS)
    if (topicId !== 'all') moveToResults()
  }

  function selectCategory(categoryValue: string) {
    setQuery('')
    setSelectedTopic('all')
    setSelectedCategory(categoryValue)
    setVisibleCount(INITIAL_VISIBLE_POSTS)
    moveToResults()
  }

  function resetTopic() {
    setQuery('')
    setSelectedTopic('all')
    setSelectedCategory(null)
    setVisibleCount(INITIAL_VISIBLE_POSTS)
  }

  return (
    <>
      <section id="blog-topics" className={styles.topicMap} aria-labelledby="blog-topics-title">
        <div className={styles.topicIntro}>
          <div>
            <span>카테고리</span>
            <h2 id="blog-topics-title">궁금한 이야기부터 골라보세요</h2>
            <p>제품, 현장, 견적, 고객 질문, 시공 사례를 서로 이어서 읽을 수 있게 소개합니다.</p>
          </div>
          <div className={styles.searchBox}>
            <Search size={18} aria-hidden="true" />
            <label htmlFor={searchInputId} className={styles.srOnly}>
              블로그 글 검색
            </label>
            <input
              id={searchInputId}
              type="search"
              value={query}
              onChange={event => startSearch(event.target.value)}
              placeholder="블로그 글 검색"
            />
            {query.trim() && (
              <button type="button" onClick={resetSearch} aria-label="검색어 지우기">
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className={styles.topicGrid} aria-label="블로그 주제별 입구">
          <button
            type="button"
            className={`${styles.topicCard} ${selectedTopic === 'all' ? styles.topicCardActive : ''}`}
            onClick={resetTopic}
            aria-pressed={selectedTopic === 'all'}
          >
            <span>전체 글</span>
            <strong>{posts.length}개</strong>
            <p>문장군 블로그에 공개된 모든 글을 최신순으로 봅니다.</p>
          </button>
          {TOPICS.map(topic => {
            const count = topicCounts.get(topic.id) ?? 0
            return (
              <button
                key={topic.id}
                type="button"
                className={`${styles.topicCard} ${selectedTopic === topic.id ? styles.topicCardActive : ''}`}
                onClick={() => selectTopic(topic.id)}
                aria-pressed={selectedTopic === topic.id}
              >
                <span>{topic.title}</span>
                <strong>{count > 0 ? `${count}개` : '준비 중'}</strong>
                <p>{topic.description}</p>
              </button>
            )
          })}
        </div>
      </section>

      {hasSearch && (
        <section className={styles.searchResultStrip} aria-labelledby="search-result-title">
          <div>
            <span>검색 결과</span>
            <h2 id="search-result-title">{query.trim()}로 찾은 글</h2>
          </div>
          <div className={styles.resultHeader}>
            <span>{searchResults.length}개 글</span>
            <button type="button" onClick={resetSearch}>
              검색 초기화
            </button>
          </div>
          {searchResults.length === 0 ? (
            <div className={styles.emptyResult}>
              <strong>아직 맞는 글이 없습니다.</strong>
              <span>다른 단어로 검색하거나 카테고리에서 이어서 살펴보세요.</span>
            </div>
          ) : (
            <div className={styles.grid}>
              {visibleSearchResults.map(post => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          )}
          {searchResults.length > visibleSearchResults.length && (
            <button type="button" className={styles.moreButton} onClick={showMore}>
              더 보기
            </button>
          )}
        </section>
      )}

      {featuredPost && !hasSearch && !hasTopicFilter && !hasCategoryFilter && (
            <section className={styles.featured} aria-labelledby="featured-blog-title">
              <div className={styles.sectionHeader}>
                <span>먼저 읽기 좋은 글</span>
                <h2 id="featured-blog-title">처음 오셨다면 이 이야기부터</h2>
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

      {threadItems.length > 0 && !hasSearch && !hasTopicFilter && !hasCategoryFilter && (
            <section className={styles.threadPanel} aria-labelledby="thread-title">
              <div>
                <span>이어 읽기</span>
                <h2 id="thread-title">한 글에서 다음 질문으로</h2>
              </div>
              <div className={styles.threadList}>
                {threadItems.map(item => (
                  <button key={item} type="button" onClick={() => startSearch(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </section>
      )}

      {(hasTopicFilter || hasCategoryFilter) && (
            <section ref={resultSectionRef} className={styles.postSection} aria-labelledby="topic-result-title">
              <div className={styles.sectionHeader}>
                <span>선택한 이야기</span>
                <h2 id="topic-result-title">{focusedResultsTitle}</h2>
              </div>
              <div className={styles.resultHeader}>
                <span>{selectedResultPosts.length}개 글</span>
                <button type="button" onClick={resetTopic}>
                  전체 보기
                </button>
              </div>
              {selectedResultPosts.length === 0 ? (
                <div className={styles.emptyResult}>
                  <strong>이 주제의 글은 아직 준비 중입니다.</strong>
                  <span>관련 글이 준비되면 이곳에서 이어서 볼 수 있습니다.</span>
                </div>
              ) : (
                <div className={styles.grid}>
                  {visibleSelectedResults.map(post => (
                    <BlogCard key={post.id} post={post} />
                  ))}
                </div>
              )}
              {selectedResultPosts.length > visibleSelectedResults.length && (
                <button type="button" className={styles.moreButton} onClick={showMore}>
                  더 보기
                </button>
              )}
            </section>
      )}

      {!hasSearch && !hasCategoryFilter && (
          <section className={styles.categoryStories} aria-labelledby="category-stories-title">
            <div className={styles.sectionHeader}>
              <span>카테고리별 이야기</span>
              <h2 id="category-stories-title">주제별로 모아보기</h2>
            </div>
            <div className={styles.storyGroups}>
              {categoryGroups.map(group => (
                <article key={group.category.value} className={styles.storyGroup}>
                  <div className={styles.storyGroupHeader}>
                    <div>
                      <span>{group.category.label}</span>
                      <strong>{group.posts.length}개 글</strong>
                    </div>
                    <button type="button" onClick={() => selectCategory(group.category.value)}>
                      더 보기
                    </button>
                  </div>
                  <div className={styles.storyList}>
                    {group.posts.slice(0, 3).map(post => (
                      <Link key={post.id} href={`/blog/${post.slug}`} className={styles.storyLink}>
                        <strong>{post.title}</strong>
                        {post.targetQuestion && <span>{post.targetQuestion}</span>}
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
      )}

      {!hasSearch && !hasCategoryFilter && (
          <section className={styles.postSection} aria-labelledby="all-posts-title">
            <div className={styles.sectionHeader}>
              <span>{posts.length}개 글</span>
              <h2 id="all-posts-title">전체 글</h2>
            </div>
            <div className={styles.grid}>
              {visibleAllPosts.map(post => (
                <BlogCard key={post.id} post={post} compact />
              ))}
            </div>
            {posts.length > visibleAllPosts.length && (
              <button type="button" className={styles.moreButton} onClick={showMore}>
                더 보기
              </button>
            )}
          </section>
      )}
    </>
  )
}
