'use client'

import { useEffect, useState } from 'react'
import BlogNavigation, { type BlogNavigationSearchPost } from './BlogNavigation'

type BlogReadingTopBarProps = {
  searchPosts: BlogNavigationSearchPost[]
}

export default function BlogReadingTopBar({ searchPosts }: BlogReadingTopBarProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frameId: number | null = null

    const syncProgress = () => {
      const article = document.getElementById('blog-article')
      if (!article) {
        setProgress(0)
        frameId = null
        return
      }

      const articleTop = article.getBoundingClientRect().top + window.scrollY
      const articleBottom = articleTop + article.offsetHeight
      const articleScrollRange = articleBottom - window.innerHeight - articleTop
      const nextProgress = articleScrollRange <= 0
        ? (window.scrollY >= articleTop ? 100 : 0)
        : Math.min(100, Math.max(0, ((window.scrollY - articleTop) / articleScrollRange) * 100))
      setProgress(nextProgress)
      frameId = null
    }

    const handleScroll = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(syncProgress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      if (frameId !== null) window.cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <BlogNavigation
      variant="article"
      surface="light"
      searchPosts={searchPosts}
      readingProgress={progress}
      hasPosts={searchPosts.length > 0}
    />
  )
}
