'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import BlogBrandWordmark from './BlogBrandWordmark'
import { BLOG_HOME_MEDIA } from './blog-home-assets'
import styles from './BlogFinalExperience.module.css'

const COPY_STATES = [
  {
    eyebrow: '사진 밖의 조건까지 확인하는 방법',
    title: <>우리 집의 답은<br />현장에 있습니다.</>,
    description: '사진으로 좁힌 선택을 실제 공간의 조건으로 이어서 확인합니다.',
  },
  {
    eyebrow: '01 · 우리 집을 이해하는 시작',
    title: <>구조를<br />보고</>,
  },
  {
    eyebrow: '02 · 생활하는 움직임까지',
    title: <>동선을<br />재고</>,
  },
  {
    eyebrow: '03 · 필요한 선택만 남도록',
    title: <>선택을<br />좁힙니다.</>,
  },
  {
    eyebrow: '무료 방문실측에서 이어서 확인합니다',
    title: <>직접 보고,<br />재고, 함께 결정합니다.</>,
    description: '구조, 옵션과 견적 조건까지 우리 집 안에서 차근차근 확인합니다.',
  },
]

type BlogFinalExperienceProps = {
  hasPosts: boolean
  hasLatestPosts: boolean
}

export default function BlogFinalExperience({ hasPosts, hasLatestPosts }: BlogFinalExperienceProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const footerRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [activeState, setActiveState] = useState(0)
  const [actionReady, setActionReady] = useState(false)

  useEffect(() => {
    let animationFrame = 0

    const updateScene = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const track = trackRef.current
        const footer = footerRef.current
        const panel = panelRef.current
        if (!track || !footer || !panel) return

        const trackRect = track.getBoundingClientRect()
        const footerRect = footer.getBoundingClientRect()
        const journeyDistance = Math.max(1, track.offsetHeight - window.innerHeight)
        const journey = Math.min(1, Math.max(0, -trackRect.top / journeyDistance))
        const reveal = Math.min(1, Math.max(0, (window.innerHeight - footerRect.top) / (window.innerHeight * 0.72)))
        const nextState = journey < 0.14 ? 0 : journey < 0.34 ? 1 : journey < 0.54 ? 2 : journey < 0.72 ? 3 : 4

        panel.style.setProperty('--journey', journey.toFixed(3))
        panel.style.setProperty('--reveal', reveal.toFixed(3))
        const nextActionReady = journey >= 0.78
        setActiveState(current => current === nextState ? current : nextState)
        setActionReady(current => current === nextActionReady ? current : nextActionReady)
      })
    }

    window.addEventListener('scroll', updateScene, { passive: true })
    window.addEventListener('resize', updateScene)
    updateScene()

    return () => {
      window.removeEventListener('scroll', updateScene)
      window.removeEventListener('resize', updateScene)
      window.cancelAnimationFrame(animationFrame)
    }
  }, [])

  return (
    <section id="blog-final-cta" className={styles.ending} aria-label="문장군 무료 방문실측과 블로그 푸터">
      <div ref={trackRef} id="blog-final-cta-track" className={styles.track} data-testid="blog-final-cta-track">
        <div className={styles.sticky}>
          <div
            ref={panelRef}
            className={`${styles.panel} ${actionReady ? styles.actionReady : ''}`}
            data-testid="blog-final-cta-panel"
            data-active-state={activeState}
          >
            <Image
              src={BLOG_HOME_MEDIA.finalConsultation.src}
              alt={BLOG_HOME_MEDIA.finalConsultation.alt}
              fill
              sizes="100vw"
              className={styles.image}
              style={{ objectPosition: BLOG_HOME_MEDIA.finalConsultation.focalPoint }}
            />
            <div className={styles.veil} aria-hidden="true" />

            <div className={styles.copyStage} aria-live="polite">
              {COPY_STATES.map((state, index) => (
                <div
                  key={state.eyebrow}
                  className={`${styles.copyState} ${index === activeState ? styles.copyActive : ''} ${index < activeState ? styles.copyExiting : ''} ${index > 0 && index < 4 ? styles.copyBeat : ''}`}
                  aria-hidden={index !== activeState}
                  inert={index !== activeState ? true : undefined}
                >
                  <span>{state.eyebrow}</span>
                  <h2>{state.title}</h2>
                  {state.description && <p>{state.description}</p>}
                  {index === 4 && (
                    <div className={styles.actions}>
                      <Link href="/portal/measure/new" tabIndex={activeState === 4 && actionReady ? 0 : -1}>무료 방문실측 상담 <ArrowRight size={16} /></Link>
                      <a href="#blog-home" tabIndex={activeState === 4 && actionReady ? 0 : -1}>블로그 처음으로</a>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.progress} aria-hidden="true"><span /></div>
            <span className={styles.scrollLabel}>계속 스크롤</span>
          </div>
        </div>
      </div>

      <footer ref={footerRef} id="blog-footer" className={styles.footer} data-testid="blog-footer">
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.footerTop}>
          <div>
            <span>문장군과 다음 이야기를 시작하세요</span>
            <h2>우리 집 조건은 현장에서<br />더 정확하게 보입니다.</h2>
          </div>
          <div className={styles.footerContact}>
            <p>중문과 도어가 고민될 때, 무료 방문실측으로 실제 공간부터 함께 확인합니다.</p>
            <Link href="/portal/measure/new">무료 방문실측 상담 <ArrowRight size={15} /></Link>
          </div>
        </div>

        <div className={styles.footerLinks}>
          <div className={styles.footerBrand}>
            <BlogBrandWordmark />
            <p>고객이 상담 뒤에도 디자인과 현장 기준을 다시 살펴볼 수 있도록 기록합니다.</p>
          </div>
          <div className={styles.footerColumn}>
            <span>EXPLORE</span>
            {hasPosts ? (
              <>
                <a href="#blog-topics">상황별 가이드</a>
                <a href="#blog-story">공간 이야기</a>
                {hasLatestPosts && <a href="#blog-latest">최근 글</a>}
              </>
            ) : (
              <a href="#blog-home">블로그 홈</a>
            )}
          </div>
          <div className={styles.footerColumn}>
            <span>SERVICE</span>
            <Link href="/portal/measure/new">무료 방문실측</Link>
            <Link href="/showroom">디지털 쇼룸</Link>
            <Link href="/portal">고객 포털</Link>
          </div>
          <div className={styles.footerColumn}>
            <span>ABOUT</span>
            <Link href="/brand">문장군 브랜드</Link>
            <a href="#blog-home">블로그 홈</a>
          </div>
        </div>

        <div className={styles.signoff}><BlogBrandWordmark /></div>
        <div className={styles.meta}><span>© MUNJANGGUN</span><span>중문과 도어, 공간을 보는 기준</span></div>
      </footer>
    </section>
  )
}
