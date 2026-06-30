'use client'

import Link from 'next/link'
import { ArrowRight, Search, X } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import {
  BLOG_INITIAL_VISIBLE_POSTS,
  BLOG_TOPICS,
  searchBlogPosts,
  selectTopicPosts,
  type BlogHomeCategory,
  type BlogHomeModel,
  type BlogHomePost,
} from './blog-home-model'
import styles from './blog.module.css'

export type BlogExplorerPost = BlogHomePost
export type BlogExplorerCategory = BlogHomeCategory

type BlogExplorerClientProps = {
  posts: BlogExplorerPost[]
  categories: BlogExplorerCategory[]
  homeModel: BlogHomeModel
}

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
})

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return dateFormatter.format(date)
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

function FeaturedCard({ post }: { post: BlogExplorerPost }) {
  const publishedDate = formatDate(post.publishedAt)

  return (
    <Link href={`/blog/${post.slug}`} className={styles.featuredCard}>
      <div className={styles.featuredImage}>
        {post.coverMedia?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverMedia.url} alt={post.coverMedia.altText || post.title} />
        ) : (
          <div className={styles.thumbFallback}>{post.categoryLabel}</div>
        )}
      </div>
      <div className={styles.featuredBody}>
        <div className={styles.metaRow}>
          <span>{post.categoryLabel}</span>
          {publishedDate && <time dateTime={post.publishedAt ?? undefined}>{publishedDate}</time>}
        </div>
        <h3>{post.title}</h3>
        {post.summaryAnswer && <p>{post.summaryAnswer}</p>}
        {!post.summaryAnswer && post.excerpt && <p>{post.excerpt}</p>}
        {post.targetQuestion && <strong>{post.targetQuestion}</strong>}
        <span className={styles.readMore}>
          글 보기
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}

export default function BlogExplorerClient({ posts, categories, homeModel }: BlogExplorerClientProps) {
  const searchInputId = useId()
  const resultSectionRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(BLOG_INITIAL_VISIBLE_POSTS)

  const selectedTopicConfig = BLOG_TOPICS.find(topic => topic.id === selectedTopic) ?? null

  const visibleTopicPosts = useMemo(() => {
    return selectTopicPosts(posts, selectedTopic)
  }, [posts, selectedTopic])

  const searchResults = useMemo(() => {
    return searchBlogPosts(posts, query)
  }, [posts, query])

  const selectedCategoryConfig = categories.find(category => category.value === selectedCategory) ?? null
  const selectedCategoryPosts = useMemo(() => {
    if (!selectedCategoryConfig) return []
    return homeModel.allPosts.filter(post => post.category === selectedCategoryConfig.value)
  }, [homeModel.allPosts, selectedCategoryConfig])

  const hasSearch = Boolean(query.trim())
  const hasTopicFilter = selectedTopic !== 'all'
  const hasCategoryFilter = Boolean(selectedCategoryConfig)
  const selectedTopicTitle = selectedTopicConfig?.title ?? '전체 이야기'
  const focusedResultsTitle = selectedCategoryConfig?.label ?? selectedTopicTitle
  const selectedResultPosts = hasCategoryFilter ? selectedCategoryPosts : visibleTopicPosts
  const visibleSearchResults = searchResults.slice(0, visibleCount)
  const visibleSelectedResults = selectedResultPosts.slice(0, visibleCount)
  const visibleAllPosts = homeModel.allPosts.slice(0, visibleCount)
  const firstStarterPost = homeModel.starterPosts[0] ?? null
  const secondaryStarterPosts = homeModel.starterPosts.slice(1)
  const showHomeSections = !hasSearch && !hasTopicFilter && !hasCategoryFilter

  function showMore() {
    setVisibleCount(count => count + BLOG_INITIAL_VISIBLE_POSTS)
  }

  function startSearch(value: string) {
    setQuery(value)
    setSelectedTopic('all')
    setSelectedCategory(null)
    setVisibleCount(BLOG_INITIAL_VISIBLE_POSTS)
  }

  function resetSearch() {
    setQuery('')
    setVisibleCount(BLOG_INITIAL_VISIBLE_POSTS)
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
    setVisibleCount(BLOG_INITIAL_VISIBLE_POSTS)
    if (topicId !== 'all') moveToResults()
  }

  function selectCategory(categoryValue: string) {
    setQuery('')
    setSelectedTopic('all')
    setSelectedCategory(categoryValue)
    setVisibleCount(BLOG_INITIAL_VISIBLE_POSTS)
    moveToResults()
  }

  function resetTopic() {
    setQuery('')
    setSelectedTopic('all')
    setSelectedCategory(null)
    setVisibleCount(BLOG_INITIAL_VISIBLE_POSTS)
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
          {BLOG_TOPICS.map(topic => {
            const count = homeModel.topicCounts[topic.id] ?? 0
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
            <h2 id="search-result-title">{query.trim()} 검색 결과</h2>
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

      {firstStarterPost && showHomeSections && (
        <section className={styles.featured} aria-labelledby="featured-blog-title">
          <div className={styles.sectionHeader}>
            <span>먼저 읽기 좋은 글</span>
            <h2 id="featured-blog-title">처음 오셨다면 여기부터</h2>
            <p>가격, 가능 여부, 현장 조건처럼 상담 전에 많이 헷갈리는 글을 먼저 골랐습니다.</p>
          </div>
          <div className={`${styles.starterLayout} ${secondaryStarterPosts.length === 0 ? styles.starterLayoutSingle : ''}`}>
            <FeaturedCard post={firstStarterPost} />
            {secondaryStarterPosts.length > 0 && (
              <div className={styles.starterSide} aria-label="처음 읽기 좋은 추가 글">
                {secondaryStarterPosts.map(post => (
                  <BlogCard key={post.id} post={post} compact />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {homeModel.latestPosts.length > 0 && showHomeSections && (
        <section className={styles.postSection} aria-labelledby="latest-posts-title">
          <div className={styles.sectionHeader}>
            <span>최근 올라온 글</span>
            <h2 id="latest-posts-title">새로 발행된 이야기</h2>
            <p>문장군이 최근 상담과 현장 기준을 바탕으로 정리한 글입니다.</p>
          </div>
          <div className={styles.grid}>
            {homeModel.latestPosts.map(post => (
              <BlogCard key={post.id} post={post} compact />
            ))}
          </div>
        </section>
      )}

      {homeModel.threadItems.length > 0 && showHomeSections && (
        <section className={styles.threadPanel} aria-labelledby="thread-title">
          <div>
            <span>궁금한 단어로 이어보기</span>
            <h2 id="thread-title">비슷한 조건을 찾아보기</h2>
            <p>단어를 누르면 관련 글만 모아볼 수 있습니다.</p>
          </div>
          <div className={styles.threadList}>
            {homeModel.threadItems.map(item => (
              <button key={item} type="button" onClick={() => startSearch(item)}>
                <span>{item}</span>
                <ArrowRight size={15} aria-hidden="true" />
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

      {showHomeSections && homeModel.categoryGroups.length > 0 && (
        <section className={styles.categoryStories} aria-labelledby="category-stories-title">
          <div className={styles.sectionHeader}>
            <span>카테고리별 이야기</span>
            <h2 id="category-stories-title">주제별로 모아보기</h2>
            <p>글이 쌓인 주제만 묶어서 보여줍니다. 준비 중인 주제는 위에서 먼저 확인할 수 있습니다.</p>
          </div>
          <div className={styles.storyGroups}>
            {homeModel.categoryGroups.map(group => (
              <article key={group.category.value} className={styles.storyGroup}>
                <div className={styles.storyGroupHeader}>
                  <div>
                    <span>{group.category.label}</span>
                    <strong>{group.totalCount}개 글</strong>
                  </div>
                  <button type="button" onClick={() => selectCategory(group.category.value)}>
                    더 보기
                  </button>
                </div>
                <div className={styles.storyList}>
                  {group.posts.map(post => (
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

      {showHomeSections && homeModel.showAllPosts && (
        <section className={styles.postSection} aria-labelledby="all-posts-title">
          <div className={styles.sectionHeader}>
            <span>{posts.length}개 글</span>
            <h2 id="all-posts-title">모든 글</h2>
            <p>처음 읽기 좋은 글과 최근 글을 지나, 전체 발행 글을 최신순으로 볼 수 있습니다.</p>
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
