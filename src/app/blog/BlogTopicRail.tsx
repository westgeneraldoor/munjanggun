'use client'

import Image from 'next/image'
import { ArrowLeft, ArrowRight, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import BlogAutoplayVideo from './BlogAutoplayVideo'
import { BLOG_HOME_MEDIA, type BlogHomeMediaSlot } from './blog-home-assets'
import { searchBlogPosts, type BlogHomePost } from './blog-home-model'
import styles from './BlogTopicRail.module.css'

type TopicCard = {
  id: string
  category: string
  eyebrow: string
  title: string
  description: string
  query: string
  media: BlogHomeMediaSlot
  videoHint?: boolean
}

const TOPIC_CARDS: TopicCard[] = [
  {
    id: 'install',
    category: '설치 조건',
    eyebrow: '가장 먼저 확인할 질문',
    title: '우리 집에도 중문을 설치할 수 있을까?',
    description: '벽체, 폭, 단차와 열림 동선에서 먼저 확인할 기준을 모았습니다.',
    query: '설치 가능',
    media: BLOG_HOME_MEDIA.topicInstall,
  },
  {
    id: 'narrow',
    category: '좁은 현관',
    eyebrow: '공간을 덜 차지하는 방법',
    title: '좁아 보여도 괜찮을까?',
    description: '열림 방식과 프레임의 선을 기준으로 공간감을 살펴봅니다.',
    query: '좁은 현관',
    media: BLOG_HOME_MEDIA.topicNarrow,
  },
  {
    id: 'comfort',
    category: '생활 변화',
    eyebrow: '생활에서 먼저 느끼는 차이',
    title: '냉기와 소음은 얼마나 달라질까?',
    description: '제품보다 먼저 우리 집에서 체감하고 싶은 변화를 확인합니다.',
    query: '냉기 소음',
    media: BLOG_HOME_MEDIA.topicComfort,
    videoHint: true,
  },
  {
    id: 'light',
    category: '채광',
    eyebrow: '공간은 나누고 빛은 남기기',
    title: '빛은 그대로 통하게 할 수 있을까?',
    description: '유리와 프레임을 고를 때 채광과 시선이 달라지는 지점을 봅니다.',
    query: '채광 유리',
    media: BLOG_HOME_MEDIA.topicLight,
  },
  {
    id: 'design',
    category: '디자인',
    eyebrow: '색보다 먼저 보는 선',
    title: '우리 집과 잘 어울리는 문은?',
    description: '프레임, 유리와 손잡이가 공간에 남기는 인상을 살펴봅니다.',
    query: '디자인 프레임',
    media: BLOG_HOME_MEDIA.topicDesign,
  },
  {
    id: 'case',
    category: '현장 기록',
    eyebrow: '완성된 장면에서 확인하기',
    title: '실제 시공은 어떻게 달라졌을까?',
    description: '카탈로그가 아닌 현장 사진과 조건을 함께 읽습니다.',
    query: '시공 사례',
    media: BLOG_HOME_MEDIA.topicCase,
  },
]

type BlogTopicRailProps = {
  posts: BlogHomePost[]
  onExplore: (query: string) => void
}

export default function BlogTopicRail({ posts, onExplore }: BlogTopicRailProps) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const pointerDownRef = useRef(false)
  const movedRef = useRef(false)
  const pausedRef = useRef(false)
  const activeIdRef = useRef<string | null>(null)
  const pointerStartRef = useRef({ x: 0, scrollLeft: 0 })
  const wheelTargetRef = useRef<number | null>(null)
  const resumeTimerRef = useRef<number | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  const pauseFor = useCallback((duration: number) => {
    pausedRef.current = true
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false
      resumeTimerRef.current = null
    }, duration)
  }, [])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => () => {
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current)
  }, [])

  useEffect(() => {
    const finishPointerInteraction = () => {
      if (!pointerDownRef.current) return
      pointerDownRef.current = false
      pauseFor(650)
      window.setTimeout(() => {
        movedRef.current = false
      }, 650)
    }

    window.addEventListener('pointerup', finishPointerInteraction)
    window.addEventListener('pointercancel', finishPointerInteraction)
    return () => {
      window.removeEventListener('pointerup', finishPointerInteraction)
      window.removeEventListener('pointercancel', finishPointerInteraction)
    }
  }, [pauseFor])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animationFrame = 0
    let autoDirection = 1
    let autoHoldUntil = 0
    let autoPosition = rail.scrollLeft
    let lastFrame = window.performance.now()

    const updatePositionState = () => {
      const maxScroll = Math.max(1, rail.scrollWidth - rail.clientWidth)
      const ratio = Math.min(1, Math.max(0, rail.scrollLeft / maxScroll))
      setProgress(current => (Math.abs(current - ratio) < 0.002 ? current : ratio))

      const center = rail.scrollLeft + rail.clientWidth / 2
      let nearestIndex = 0
      let nearestDistance = Number.POSITIVE_INFINITY
      Array.from(rail.children).forEach((child, index) => {
        const card = child as HTMLElement
        const cardCenter = card.offsetLeft + card.offsetWidth / 2
        const distance = Math.abs(center - cardCenter)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = index
        }
      })
      setCurrentIndex(current => (current === nearestIndex ? current : nearestIndex))
    }

    const animate = (now: number) => {
      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth)
      const elapsed = Math.min(34, now - lastFrame)
      lastFrame = now

      if (wheelTargetRef.current !== null) {
        const easing = Math.min(1, elapsed * 0.009)
        autoPosition += (wheelTargetRef.current - autoPosition) * easing
        rail.scrollLeft = autoPosition
        if (Math.abs(wheelTargetRef.current - autoPosition) < 0.35) {
          autoPosition = wheelTargetRef.current
          rail.scrollLeft = wheelTargetRef.current
          wheelTargetRef.current = null
        }
      } else if (pausedRef.current || activeIdRef.current || reduceMotion.matches) {
        autoPosition = rail.scrollLeft
      } else if (now >= autoHoldUntil && maxScroll > 0) {
        autoPosition += autoDirection * elapsed * 0.06
        autoPosition = Math.min(maxScroll, Math.max(0, autoPosition))
        rail.scrollLeft = autoPosition

        if (autoDirection > 0 && autoPosition >= maxScroll - 1) {
          autoDirection = -1
          autoHoldUntil = now + 1200
        } else if (autoDirection < 0 && autoPosition <= 1) {
          autoDirection = 1
          autoHoldUntil = now + 1200
        }
      }

      updatePositionState()
      animationFrame = window.requestAnimationFrame(animate)
    }

    animationFrame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [])

  function moveRail(direction: -1 | 1) {
    const rail = railRef.current
    if (!rail) return
    pauseFor(820)
    rail.scrollBy({ left: direction * Math.min(520, rail.clientWidth * 0.72), behavior: 'smooth' })
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const rail = railRef.current
    if (!rail) return
    pointerDownRef.current = true
    movedRef.current = false
    pauseFor(900)
    pointerStartRef.current = { x: event.clientX, scrollLeft: rail.scrollLeft }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const rail = railRef.current
    if (!rail || !pointerDownRef.current) return
    const delta = event.clientX - pointerStartRef.current.x
    if (Math.abs(delta) > 5) movedRef.current = true
    rail.scrollLeft = pointerStartRef.current.scrollLeft - delta * 1.15
  }

  function handlePointerUp() {
    if (!pointerDownRef.current) return
    pointerDownRef.current = false
    pauseFor(650)
    window.setTimeout(() => {
      movedRef.current = false
    }, 650)
  }

  const handleWheel = useCallback((event: WheelEvent) => {
    const rail = railRef.current
    if (!rail || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth)
    const movingForward = event.deltaY > 0
    const movingBackward = event.deltaY < 0
    const canMoveForward = rail.scrollLeft < maxScroll - 2
    const canMoveBackward = rail.scrollLeft > 2

    if ((movingForward && canMoveForward) || (movingBackward && canMoveBackward)) {
      event.preventDefault()
      pauseFor(760)
      const currentTarget = wheelTargetRef.current ?? rail.scrollLeft
      wheelTargetRef.current = Math.min(maxScroll, Math.max(0, currentTarget + event.deltaY * 0.38))
      return
    }

    wheelTargetRef.current = null
    window.scrollBy({ top: event.deltaY, behavior: 'auto' })
  }, [pauseFor])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    rail.addEventListener('wheel', handleWheel, { passive: false })
    return () => rail.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  function toggleCard(cardId: string, card: HTMLElement) {
    if (movedRef.current) return
    const nextId = activeId === cardId ? null : cardId
    setActiveId(nextId)
    if (nextId) {
      pausedRef.current = true
      window.requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }))
    } else {
      pauseFor(520)
    }
  }

  return (
    <section id="blog-topics" className={styles.section} aria-labelledby="blog-topics-title">
      <div className={styles.heading}>
        <div>
          <span>우리 집 상황별 가이드</span>
          <h2 id="blog-topics-title">궁금한 이야기부터<br />골라보세요.</h2>
          <p>실제 공간을 넘겨보듯 살펴보고, 우리 집과 가까운 질문에서 글을 이어서 읽을 수 있습니다.</p>
        </div>
        <div className={styles.controls} aria-label="이미지 주제 카드 이동">
          <button type="button" onClick={() => moveRail(-1)} aria-label="이전 카드"><ArrowLeft size={18} /></button>
          <button type="button" onClick={() => moveRail(1)} aria-label="다음 카드"><ArrowRight size={18} /></button>
        </div>
      </div>

      <div
        ref={railRef}
        className={`${styles.rail} ${activeId ? styles.hasActive : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => { pausedRef.current = true }}
        onMouseLeave={() => { if (!pointerDownRef.current) pausedRef.current = false }}
        onFocus={() => { pausedRef.current = true }}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) pausedRef.current = false }}
        data-testid="blog-topic-rail"
      >
        {TOPIC_CARDS.map((card, index) => {
          const isActive = card.id === activeId
          const focusDistance = Math.abs(index - currentIndex)
          const resultCount = searchBlogPosts(posts, card.query).length

          return (
            <article
              key={card.id}
              className={[
                styles.card,
                focusDistance === 0 ? styles.cardFocused : focusDistance === 1 ? styles.cardNear : styles.cardFar,
                isActive ? styles.cardActive : '',
              ].filter(Boolean).join(' ')}
              data-testid="blog-topic-card"
              data-active={isActive ? 'true' : 'false'}
              data-focus-distance={Math.min(focusDistance, 2)}
            >
              <button
                type="button"
                className={styles.cardSelect}
                aria-expanded={isActive}
                onClick={event => toggleCard(card.id, event.currentTarget.parentElement as HTMLElement)}
              >
                <span className={styles.media}>
                  {card.media.kind === 'video' ? (
                    <BlogAutoplayVideo src={card.media.src} poster={card.media.poster} alt={card.media.alt} />
                  ) : (
                    <Image
                      src={card.media.src}
                      alt={card.media.alt}
                      fill
                      sizes="(max-width: 760px) 82vw, 520px"
                      style={{ objectPosition: card.media.focalPoint }}
                    />
                  )}
                </span>
                <span className={styles.overlay} aria-hidden="true" />
                <span className={styles.cardTop}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {card.videoHint ? <span className={styles.play}><Play size={14} fill="currentColor" /></span> : <span className={styles.category}>{card.category}</span>}
                </span>
                <span className={styles.cardCopy}>
                  <span className={styles.eyebrow}>{card.eyebrow}</span>
                  <strong>{card.title}</strong>
                  <span className={styles.description}>{card.description}</span>
                </span>
              </button>
              <button
                type="button"
                className={styles.cardAction}
                onClick={() => onExplore(card.query)}
                tabIndex={isActive ? 0 : -1}
              >
                {resultCount > 0 ? `관련 글 ${resultCount}개 보기` : '가까운 글 찾아보기'}
                <ArrowRight size={15} />
              </button>
            </article>
          )
        })}
      </div>

      <div className={styles.railFooter}>
        <span>드래그하거나 가로로 스크롤</span>
        <span className={styles.progressTrack}><span style={{ transform: `translateX(${progress * 400}%)` }} /></span>
        <span>{String(currentIndex + 1).padStart(2, '0')} / {String(TOPIC_CARDS.length).padStart(2, '0')}</span>
      </div>
    </section>
  )
}
