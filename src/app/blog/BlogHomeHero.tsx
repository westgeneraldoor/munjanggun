'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import BlogAutoplayVideo from './BlogAutoplayVideo'
import BlogNavigation, { type BlogNavigationSearchPost } from '@/components/blog/BlogNavigation'
import type { BlogHomeMediaSlot } from './blog-home-assets'
import styles from './BlogHomeHero.module.css'

type BlogHomeHeroProps = {
  media: BlogHomeMediaSlot
  hasPosts: boolean
  searchPosts: BlogNavigationSearchPost[]
}

export default function BlogHomeHero({ media, hasPosts, searchPosts }: BlogHomeHeroProps) {
  const [condensed, setCondensed] = useState(false)
  const [onDark, setOnDark] = useState(false)

  useEffect(() => {
    let animationFrame = 0

    const updateNavigation = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const darkTrack = document.getElementById('blog-final-cta-track')
        const footer = document.getElementById('blog-footer')
        const probe = 84
        const darkRect = darkTrack?.getBoundingClientRect()
        const footerRect = footer?.getBoundingClientRect()

        setCondensed(window.scrollY > 72)
        setOnDark(Boolean(
          darkRect
          && darkRect.top <= probe
          && darkRect.bottom > probe
          && (!footerRect || footerRect.top > probe),
        ))
      })
    }

    window.addEventListener('scroll', updateNavigation, { passive: true })
    updateNavigation()

    return () => {
      window.removeEventListener('scroll', updateNavigation)
      window.cancelAnimationFrame(animationFrame)
    }
  }, [])

  return (
    <header id="blog-home" className={styles.hero} data-testid="blog-home-hero">
      <BlogNavigation
        variant="home"
        surface={onDark ? 'dark' : condensed ? 'light' : 'hero'}
        condensed={condensed}
        hasPosts={hasPosts}
        searchPosts={searchPosts}
      />

      <div className={styles.mediaFrame}>
        {media.kind === 'video' ? (
          <BlogAutoplayVideo src={media.src} poster={media.poster} alt={media.alt} />
        ) : (
          <Image
            src={media.src}
            alt={media.alt}
            fill
            loading="eager"
            fetchPriority="high"
            quality={85}
            sizes="100vw"
            style={{ objectPosition: media.focalPoint }}
          />
        )}
        <div className={styles.imageVeil} aria-hidden="true" />

        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>문장군의 공간 기록</span>
          <h1><span>문 하나가,</span><span>집의 흐름을 바꿉니다.</span></h1>
          <p>
            중문과 도어를 고르기 전, 실제 공간과 완성된 장면을 먼저 보세요.
            상담에서 나눈 기준을 집에서도 다시 이어볼 수 있습니다.
          </p>
          <div className={styles.heroActions}>
            {hasPosts && (
              <a href="#blog-starter" className={styles.primaryAction}>
                우리 집 고민부터 보기
                <ArrowDown size={16} aria-hidden="true" />
              </a>
            )}
            <Link href="/measure" className={styles.secondaryAction}>
              무료 방문실측 상담
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {hasPosts && (
          <a href="#blog-starter" className={styles.scrollCue} aria-label="블로그 내용으로 이동">
            <span>Scroll</span>
            <ArrowDown size={16} aria-hidden="true" />
          </a>
        )}
      </div>
    </header>
  )
}
