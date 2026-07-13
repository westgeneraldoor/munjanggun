'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import {
  BLOG_INITIAL_VISIBLE_POSTS,
  searchBlogPosts,
  type BlogHomeCategory,
  type BlogHomeModel,
  type BlogHomePost,
} from './blog-home-model'
import BlogConditionComposer from './BlogConditionComposer'
import BlogStoryStage from './BlogStoryStage'
import BlogTopicRail from './BlogTopicRail'
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
      <div className={styles.thumb} data-brand-asset-slot="blogThumbnail">
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
      <div className={styles.featuredImage} data-brand-asset-slot="blogThumbnail">
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
  const resultSectionRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(BLOG_INITIAL_VISIBLE_POSTS)

  const searchResults = useMemo(() => {
    return searchBlogPosts(posts, query)
  }, [posts, query])

  const selectedCategoryConfig = categories.find(category => category.value === selectedCategory) ?? null
  const selectedCategoryPosts = useMemo(() => {
    if (!selectedCategoryConfig) return []
    return homeModel.allPosts.filter(post => post.category === selectedCategoryConfig.value)
  }, [homeModel.allPosts, selectedCategoryConfig])

  const hasSearch = Boolean(query.trim())
  const hasCategoryFilter = Boolean(selectedCategoryConfig)
  const focusedResultsTitle = selectedCategoryConfig?.label ?? '전체 이야기'
  const selectedResultPosts = selectedCategoryPosts
  const visibleSearchResults = searchResults.slice(0, visibleCount)
  const visibleSelectedResults = selectedResultPosts.slice(0, visibleCount)
  const visibleAllPosts = homeModel.allPosts.slice(0, visibleCount)
  const firstStarterPost = homeModel.starterPosts[0] ?? null
  const secondaryStarterPosts = homeModel.starterPosts.slice(1)
  const showHomeSections = true

  function showMore() {
    setVisibleCount(count => count + BLOG_INITIAL_VISIBLE_POSTS)
  }

  function startSearch(value: string) {
    setQuery(value)
    setSelectedCategory(null)
    setVisibleCount(BLOG_INITIAL_VISIBLE_POSTS)
  }

  function startQuickSearch(value: string) {
    startSearch(value)
    moveToResults()
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

  function selectCategory(categoryValue: string) {
    setQuery('')
    setSelectedCategory(categoryValue)
    setVisibleCount(BLOG_INITIAL_VISIBLE_POSTS)
    moveToResults()
  }

  function resetCategory() {
    setQuery('')
    setSelectedCategory(null)
    setVisibleCount(BLOG_INITIAL_VISIBLE_POSTS)
  }

  return (
    <>
      {hasSearch && (
        <section
          ref={resultSectionRef}
          className={styles.searchResultStrip}
          aria-labelledby="search-result-title"
          data-testid="blog-search-results"
          data-result-count={searchResults.length}
        >
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
        <section id="blog-starter" className={styles.featured} aria-labelledby="featured-blog-title">
          <div className={styles.sectionHeader}>
            <span>오늘 가장 많이 찾는 이야기</span>
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

      {showHomeSections && <BlogTopicRail posts={posts} onExplore={startQuickSearch} />}

      {showHomeSections && <BlogStoryStage />}

      {showHomeSections && <BlogConditionComposer posts={homeModel.allPosts} />}

      {homeModel.latestPosts.length > 0 && showHomeSections && (
        <section id="blog-latest" className={styles.postSection} aria-labelledby="latest-posts-title">
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

      {hasCategoryFilter && (
            <section ref={resultSectionRef} className={styles.postSection} aria-labelledby="topic-result-title">
              <div className={styles.sectionHeader}>
                <span>선택한 이야기</span>
                <h2 id="topic-result-title">{focusedResultsTitle}</h2>
              </div>
              <div className={styles.resultHeader}>
                <span>{selectedResultPosts.length}개 글</span>
                <button type="button" onClick={resetCategory}>
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
