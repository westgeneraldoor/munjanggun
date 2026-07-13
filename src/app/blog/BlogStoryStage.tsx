'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import BlogAutoplayVideo from './BlogAutoplayVideo'
import { BLOG_HOME_MEDIA, type BlogHomeMediaSlot } from './blog-home-assets'
import styles from './BlogStoryStage.module.css'

type StoryItem = {
  number: string
  label: string
  title: string
  description: string
  actionLabel: string
  href: string
  media: BlogHomeMediaSlot
}

const STORY_ITEMS: StoryItem[] = [
  {
    number: '01',
    label: '공간',
    title: '우리 집의 흐름부터 봅니다.',
    description: '현관과 거실, 주방이 어떻게 이어지는지에 따라 필요한 문과 열림 방식이 달라집니다.',
    actionLabel: '상황별 가이드 보기',
    href: '#blog-topics',
    media: BLOG_HOME_MEDIA.condition,
  },
  {
    number: '02',
    label: '디자인',
    title: '색과 선이 남기는 인상을 좁힙니다.',
    description: '프레임의 굵기와 색, 유리와 손잡이까지 실제 공간에 놓였을 때의 분위기로 살펴봅니다.',
    actionLabel: '우리 집 조건 고르기',
    href: '#blog-condition',
    media: BLOG_HOME_MEDIA.design,
  },
  {
    number: '03',
    label: '시공',
    title: '완성된 현장에서 답을 확인합니다.',
    description: '카탈로그 한 장보다 실제 시공 사진 한 장이 더 많은 판단 기준을 보여줄 때가 있습니다.',
    actionLabel: '우리 집 조건 찾기',
    href: '#blog-condition',
    media: BLOG_HOME_MEDIA.installation,
  },
  {
    number: '04',
    label: '상담',
    title: '사진 밖의 조건은 직접 확인합니다.',
    description: '사진으로 좁힌 선택을 무료 방문실측에서 구조와 옵션, 견적 조건까지 이어서 확인합니다.',
    actionLabel: '무료 방문실측 상담',
    href: '/portal/measure/new',
    media: BLOG_HOME_MEDIA.consultation,
  },
]

function StoryMedia({ media, priority = false }: { media: BlogHomeMediaSlot; priority?: boolean }) {
  if (media.kind === 'video') {
    return <BlogAutoplayVideo src={media.src} poster={media.poster} alt={media.alt} />
  }

  return (
    <Image
      src={media.src}
      alt={media.alt}
      fill
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      sizes="(max-width: 760px) 100vw, 96vw"
      style={{ objectPosition: media.focalPoint }}
    />
  )
}

export default function BlogStoryStage() {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    let animationFrame = 0

    const updateActiveItem = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const track = trackRef.current
        const stage = stageRef.current
        if (!track || !stage) return

        const rect = track.getBoundingClientRect()
        const scrollableDistance = Math.max(1, rect.height - stage.offsetHeight)
        const progress = Math.min(1, Math.max(0, -rect.top / scrollableDistance))
        const nextIndex = Math.min(STORY_ITEMS.length - 1, Math.floor(progress * STORY_ITEMS.length))
        setActiveIndex(current => (current === nextIndex ? current : nextIndex))
      })
    }

    window.addEventListener('scroll', updateActiveItem, { passive: true })
    window.addEventListener('resize', updateActiveItem)
    updateActiveItem()

    return () => {
      window.removeEventListener('scroll', updateActiveItem)
      window.removeEventListener('resize', updateActiveItem)
      window.cancelAnimationFrame(animationFrame)
    }
  }, [])

  function moveToStory(index: number) {
    const track = trackRef.current
    const stage = stageRef.current
    if (!track || !stage) return

    const trackTop = window.scrollY + track.getBoundingClientRect().top
    const scrollableDistance = Math.max(0, track.offsetHeight - stage.offsetHeight)
    const target = trackTop + scrollableDistance * (index / STORY_ITEMS.length)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: target, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  const activeItem = STORY_ITEMS[activeIndex]

  return (
    <section id="blog-story" className={styles.section} aria-labelledby="blog-story-title">
      <div className={styles.intro}>
        <span>공간을 보는 네 가지 장면</span>
        <h2 id="blog-story-title">사진에서 시작해, 우리 집의 기준으로 이어집니다.</h2>
        <p>공간 조건과 디자인, 실제 현장과 상담까지 선택에 필요한 흐름을 장면으로 이어봅니다.</p>
      </div>

      <div ref={trackRef} className={styles.desktopTrack} data-testid="blog-story-track">
        <div
          ref={stageRef}
          className={styles.stickyStage}
          data-active-index={activeIndex}
          data-testid="blog-story-stage"
        >
          <div key={`${activeItem.media.src}-${activeIndex}`} className={styles.stageMedia}>
            <StoryMedia media={activeItem.media} priority={activeIndex === 0} />
            <div className={styles.stageVeil} aria-hidden="true" />
          </div>

          <div key={`copy-${activeItem.number}`} className={styles.stageCopy} aria-live="polite">
            <span>{activeItem.number} / {activeItem.label}</span>
            <h3>{activeItem.title}</h3>
            <p>{activeItem.description}</p>
            {activeItem.href.startsWith('/') ? (
              <Link href={activeItem.href}>
                {activeItem.actionLabel}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <a href={activeItem.href}>
                {activeItem.actionLabel}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            )}
          </div>

          <ol className={styles.chapterList} aria-label="공간 이야기 목차">
            {STORY_ITEMS.map((item, index) => (
              <li key={item.number}>
                <button
                  type="button"
                  className={index === activeIndex ? styles.chapterActive : ''}
                  onClick={() => moveToStory(index)}
                  aria-current={index === activeIndex ? 'step' : undefined}
                >
                  <span>{item.number}</span>
                  <strong>{item.label}</strong>
                </button>
              </li>
            ))}
          </ol>

          <div className={styles.progress} aria-hidden="true">
            <span style={{ transform: `scaleX(${(activeIndex + 1) / STORY_ITEMS.length})` }} />
          </div>
        </div>

        <div className={styles.scrollSteps} aria-hidden="true">
          {STORY_ITEMS.map(item => <div key={item.number} />)}
        </div>
      </div>

    </section>
  )
}
