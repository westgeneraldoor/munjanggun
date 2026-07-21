'use client'

import Link from 'next/link'
import { Search, Sparkles, TrendingUp, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import BlogBrandWordmark from '@/app/blog/BlogBrandWordmark'
import PublicUserMenu from '@/components/customer/PublicUserMenu'
import styles from './BlogNavigation.module.css'

const CATEGORY_LABEL: Record<string, string> = {
  case_study: '시공 사례',
  product_guide: '중문·도어 선택',
  customer_qa: '고객 질문',
  field_knowhow: '현장 조건',
  price_guide: '가격·견적',
  area_guide: '지역 상담 안내',
}

const SEARCH_SUGGESTIONS = ['설치 가능', '좁은 현관', '중문 디자인']

export type BlogNavigationSearchPost = {
  id: string
  title: string
  slug: string
  category: string
  excerpt: string | null
  targetQuestion: string | null
  primaryKeyword: string | null
  productType: string | null
  serviceArea: string | null
}

type BlogNavigationProps = {
  searchPosts: BlogNavigationSearchPost[]
  variant: 'home' | 'article'
  surface?: 'hero' | 'light' | 'dark'
  condensed?: boolean
  readingProgress?: number
  hasPosts?: boolean
}

function normalize(value: string | null | undefined) {
  return (value ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR')
}

export default function BlogNavigation({
  searchPosts,
  variant,
  surface = 'light',
  condensed = false,
  readingProgress,
  hasPosts = true,
}: BlogNavigationProps) {
  const navigationRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const searchToggleRef = useRef<HTMLButtonElement | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [query, setQuery] = useState('')

  const links = variant === 'home'
    ? [
        { label: '상황별 가이드', href: '#blog-topics' },
        { label: '공간 이야기', href: '#blog-story' },
        { label: '우리 집 글 찾기', href: '#blog-condition' },
      ]
    : [
        { label: '상황별 가이드', href: '/blog#blog-topics' },
        { label: '공간 이야기', href: '/blog#blog-story' },
        { label: '우리 집 글 찾기', href: '/blog#blog-condition' },
      ]

  const results = useMemo(() => {
    const needle = normalize(query.trim())
    if (!needle) return []

    return searchPosts.filter(post => normalize([
      post.title,
      post.excerpt,
      post.targetQuestion,
      post.primaryKeyword,
      post.productType,
      post.serviceArea,
      CATEGORY_LABEL[post.category] ?? post.category,
    ].filter(Boolean).join(' ')).includes(needle)).slice(0, 5)
  }, [query, searchPosts])

  useEffect(() => {
    const navigation = navigationRef.current
    navigation?.setAttribute('data-hydrated', 'true')
    return () => navigation?.removeAttribute('data-hydrated')
  }, [])

  useEffect(() => {
    if (!searchOpen) return
    inputRef.current?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      if (navigationRef.current && !navigationRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSearch()
        window.requestAnimationFrame(() => searchToggleRef.current?.focus())
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [searchOpen])

  function openSearch() {
    setAccountOpen(false)
    setSearchOpen(true)
  }

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
  }

  function handleAccountOpenChange(nextOpen: boolean) {
    setAccountOpen(nextOpen)
    if (nextOpen) closeSearch()
  }

  const tone = surface === 'hero' ? 'hero' : surface === 'light' ? 'light' : 'dark'

  return (
    <nav
      ref={navigationRef}
      className={[
        styles.navigation,
        variant === 'home' ? styles.homeNavigation : styles.articleNavigation,
        condensed ? styles.condensed : '',
        surface === 'hero' ? styles.hero : surface === 'light' ? styles.light : styles.dark,
        searchOpen ? styles.searchOpen : '',
      ].filter(Boolean).join(' ')}
      aria-label="문장군 블로그"
      data-testid="blog-navigation"
      data-condensed={condensed ? 'true' : 'false'}
      data-surface={surface}
    >
      <Link href="/blog" className={styles.brand} aria-label="문장군 블로그 홈">
        <BlogBrandWordmark compact />
      </Link>

      <div className={styles.center}>
        {hasPosts ? (
          <div className={styles.links}>
            {links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
          </div>
        ) : null}
      </div>

      <div className={styles.utilities}>
        <button
          ref={searchToggleRef}
          type="button"
          className={styles.searchToggle}
          onClick={searchOpen ? closeSearch : openSearch}
          aria-label={searchOpen ? '블로그 검색 닫기' : '블로그 검색 열기'}
          aria-expanded={searchOpen}
          aria-controls="blog-navigation-search-panel"
        >
          {searchOpen ? <X size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
          <span>{searchOpen ? '닫기' : '검색'}</span>
        </button>
        <PublicUserMenu
          variant="blog"
          tone={tone}
          open={accountOpen}
          onOpenChange={handleAccountOpenChange}
        />
      </div>

      <div
        id="blog-navigation-search-panel"
        className={styles.searchPanel}
        data-testid="blog-navigation-search"
        aria-hidden={!searchOpen}
        inert={!searchOpen ? true : undefined}
      >
        <div className={styles.searchGuide}>
          <span><Sparkles size={14} aria-hidden="true" /> 문장군의 현장 기록에서</span>
          <strong>지금 궁금한 걸 찾아보세요.</strong>
          <p>제품 이름을 몰라도 괜찮아요. 공간이나 고민을 짧게 입력해보세요.</p>
        </div>

        <label className={styles.searchField}>
          <Search size={19} aria-hidden="true" />
          <span className={styles.srOnly}>블로그 글 검색</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="예: 좁은 현관, 냉기, 설치 가능"
            aria-label="블로그 글 검색"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>

        {query.trim() ? (
          <>
            <div className={styles.resultHeading}>
              <span>검색 결과</span>
              <strong>{results.length}개</strong>
            </div>
            <div className={styles.results} data-testid="blog-navigation-results">
              {results.length > 0 ? results.map(post => (
                <Link key={post.id} href={`/blog/${post.slug}`} onClick={closeSearch}>
                  <span>{CATEGORY_LABEL[post.category] ?? post.category}</span>
                  <strong>{post.title}</strong>
                  {(post.targetQuestion || post.excerpt) && <p>{post.targetQuestion || post.excerpt}</p>}
                </Link>
              )) : (
                <div className={styles.emptyResult}>
                  <strong>딱 맞는 글을 찾지 못했어요.</strong>
                  <span>한두 단어로 짧게 다시 찾아보세요.</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.popularSearches}>
            <span><TrendingUp size={14} aria-hidden="true" /> 지금 많이 찾는 질문</span>
            <div className={styles.suggestions}>
              {SEARCH_SUGGESTIONS.map(suggestion => (
                <button key={suggestion} type="button" onClick={() => setQuery(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {typeof readingProgress === 'number' && (
        <div
          className={styles.readingProgress}
          role="progressbar"
          aria-label="글 읽기 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(readingProgress)}
        >
          <span style={{ transform: `scaleX(${readingProgress / 100})` }} />
        </div>
      )}
    </nav>
  )
}
