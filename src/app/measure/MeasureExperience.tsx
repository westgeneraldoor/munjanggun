'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, Camera, Check, ChevronDown, Ruler, ShieldCheck } from 'lucide-react'
import BlogBrandWordmark from '@/app/blog/BlogBrandWordmark'
import PublicUserMenu from '@/components/customer/PublicUserMenu'
import styles from './measure.module.css'

type ResponsivePictureProps = {
  id: 'hero' | 'cabinet' | 'finish' | 'level' | 'photo-guide' | 'consultation'
  alt: string
  portrait?: boolean
  eager?: boolean
  sizes: string
}

function ResponsivePicture({ id, alt, portrait = false, eager = false, sizes }: ResponsivePictureProps) {
  const widths = portrait ? [480, 720, 960] : [640, 960, 1440]
  const srcSet = (format: 'avif' | 'webp') => widths
    .map((width) => `/images/measure/v2/${id}-${width}.${format} ${width}w`)
    .join(', ')

  return (
    <picture>
      <source type="image/avif" srcSet={srcSet('avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet('webp')} sizes={sizes} />
      <img
        className={styles.coverImage}
        src={`/images/measure/v2/${id}-${widths.at(-1)}.webp`}
        width={portrait ? 960 : 1440}
        height={portrait ? 1200 : 960}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
      />
    </picture>
  )
}

const conditions = [
  {
    id: 'cabinet' as const,
    tab: '신발장 간섭',
    title: '신발장 문이 중문 자리와 겹치나요?',
    description: '신발장 문이 열리는 방향과 문틀을 고정할 벽 폭을 함께 확인합니다.',
    alt: '현관문 옆 열린 신발장과 문틀 사이 공간',
    checks: ['신발장 문과 손잡이의 회전 반경', '중문틀을 고정할 수 있는 벽 폭', '구조 변경이나 리폼 검토가 필요한지'],
    hotspots: [
      { label: '신발장 동선', detail: '문짝과 손잡이가 열릴 때 중문과 부딪히는지 봅니다.', x: '67%', y: '51%' },
      { label: '고정 벽 폭', detail: '중문틀이 흔들리지 않게 고정될 벽면을 확인합니다.', x: '39%', y: '35%' },
    ],
  },
  {
    id: 'finish' as const,
    tab: '스위치·몰딩',
    title: '스위치나 몰딩이 문틀 가까이에 있나요?',
    description: '스위치 위치와 천장·바닥 마감이 중문틀과 만나는 방식을 살핍니다.',
    alt: '현관 벽 스위치와 천장 몰딩을 가리키는 손',
    checks: ['스위치와 설치 벽면 사이의 거리', '천장 몰딩과 바닥 걸레받이의 높이', '마감 손상을 줄일 수 있는 설치 방식'],
    hotspots: [
      { label: '스위치 간격', detail: '문틀을 세운 뒤에도 스위치를 편하게 쓸 수 있어야 합니다.', x: '68%', y: '53%' },
      { label: '천장 몰딩', detail: '몰딩을 끊거나 덧대야 하는 구간을 미리 확인합니다.', x: '52%', y: '18%' },
    ],
  },
  {
    id: 'level' as const,
    tab: '바닥·수직',
    title: '바닥 단차나 기둥이 보이나요?',
    description: '레이저 기준으로 바닥 높이와 벽의 수직을 재고, 문이 안정적으로 움직일 조건을 확인합니다.',
    alt: '현관 바닥 단차를 확인하는 레이저 수평기와 자',
    checks: ['현관과 실내 바닥 사이의 높이 차이', '벽과 바닥의 수직·수평 상태', '기둥과 문짝이 움직일 여유 공간'],
    hotspots: [
      { label: '바닥 단차', detail: '단차 높이에 따라 하부 마감과 문틀 기준이 달라집니다.', x: '42%', y: '66%' },
      { label: '수직 기준', detail: '레이저 선으로 벽과 문틀이 설 기준을 잡습니다.', x: '61%', y: '38%' },
    ],
  },
] as const

const journey = [
  { title: '구조를 봅니다', body: '문틀을 세울 벽, 문이 움직일 자리, 신발장과 스위치의 간섭을 먼저 찾습니다.' },
  { title: '레이저로 잽니다', body: '폭과 높이뿐 아니라 바닥 단차와 벽의 수직·수평을 같은 기준에서 측정합니다.' },
  { title: '가능한 방식을 좁힙니다', body: '현장 조건과 원하는 디자인을 함께 놓고 설치 방식과 견적 변수를 설명합니다.' },
] as const

const faqs = [
  ['방문 실측 상담에 비용이 드나요?', '무료 방문 실측견적 상담에는 비용이 들지 않습니다. 안내를 받은 뒤 진행 여부를 결정하실 수 있습니다.'],
  ['사진을 꼭 준비해야 하나요?', '필수는 아닙니다. 현관 전체와 설치 위치, 주변 간섭 요소가 보이는 사진이 있으면 방문 전 상담이 더 수월합니다.'],
  ['방문 시간은 언제 알 수 있나요?', '신청한 희망일과 지역을 담당자가 확인한 뒤, 방문 코스가 정리되면 연락으로 안내드립니다.'],
  ['현장에서 바로 제품이 확정되나요?', '현장 조건과 선택한 옵션을 확인한 뒤 견적을 안내합니다. 설명을 충분히 들은 다음 진행 여부를 결정하시면 됩니다.'],
] as const

export default function MeasureExperience() {
  const [activeCondition, setActiveCondition] = useState(0)
  const [activeHotspot, setActiveHotspot] = useState(0)
  const [activeJourney, setActiveJourney] = useState(0)
  const [heroVisible, setHeroVisible] = useState(true)
  const [finalVisible, setFinalVisible] = useState(false)
  const heroCtaRef = useRef<HTMLAnchorElement>(null)
  const finalCtaRef = useRef<HTMLAnchorElement>(null)
  const journeyRefs = useRef<Array<HTMLElement | null>>([])
  const condition = conditions[activeCondition]
  const applicationHref = `/portal/measure/new?concern=${condition.id}`
  const showMobileCta = !heroVisible && !finalVisible

  useEffect(() => {
    const heroNode = heroCtaRef.current
    const finalNode = finalCtaRef.current
    if (!heroNode || !finalNode) return

    const heroObserver = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { threshold: 0.15 })
    const finalObserver = new IntersectionObserver(([entry]) => setFinalVisible(entry.isIntersecting), { threshold: 0.15 })
    heroObserver.observe(heroNode)
    finalObserver.observe(finalNode)
    return () => {
      heroObserver.disconnect()
      finalObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const nodes = journeyRefs.current.filter((node): node is HTMLElement => Boolean(node))
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setActiveJourney(Number((visible.target as HTMLElement).dataset.index))
    }, { rootMargin: '-28% 0px -36%', threshold: [0.2, 0.55] })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const selectCondition = (index: number) => {
    setActiveCondition(index)
    setActiveHotspot(0)
  }

  return (
    <div className={styles.page} data-mg-theme="portal">
      <a className={styles.skipLink} href="#measure-main">본문으로 건너뛰기</a>
      <header className={styles.nav}>
        <Link href="/blog" prefetch={false} className={styles.brand} aria-label="문장군 블로그로 이동">
          <BlogBrandWordmark label="무료견적" compact />
        </Link>
        <nav className={styles.navLinks} aria-label="무료방문 실측견적 안내">
          <a href="#conditions">현장 조건</a>
          <a href="#process">실측 방식</a>
          <a href="#prepare">사진 준비</a>
        </nav>
        <div className={styles.navActions}>
          <Link className={styles.navPortal} href="/portal" prefetch={false}>마이페이지</Link>
          <Link
            className={styles.mobileNavCta}
            href={applicationHref}
            prefetch={false}
            data-visible={showMobileCta}
            aria-hidden={!showMobileCta}
            tabIndex={showMobileCta ? 0 : -1}
            data-testid="measure-mobile-cta"
          >신청 <ArrowRight size={16} aria-hidden="true" /></Link>
          <PublicUserMenu variant="inline" tone="light" showLabelOnMobile disablePrefetch />
        </div>
      </header>

      <main id="measure-main">
        <section className={styles.hero} aria-labelledby="measure-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>무료 방문 실측견적</p>
            <h1 id="measure-title">중문 고르기 전,<br />우리 집 조건부터<br /><em>제대로 잽니다.</em></h1>
            <p className={styles.heroBody}>사진만으로 알기 어려운 벽과 바닥의 차이까지 현장에서 확인합니다. 구조를 설명하고, 가능한 선택을 함께 좁혀드려요.</p>
            <div className={styles.heroActions}>
              <Link ref={heroCtaRef} className={styles.primaryCta} href="/portal/measure/new" prefetch={false} data-testid="measure-hero-cta">무료방문 실측견적 신청 <ArrowRight size={18} aria-hidden="true" /></Link>
              <a className={styles.textCta} href="#conditions">우리 집 조건 먼저 보기 <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
            <p className={styles.heroNote}><ShieldCheck size={18} aria-hidden="true" /> 비용 없이 확인하고, 안내를 들은 뒤 결정합니다.</p>
          </div>
          <figure className={styles.heroVisual}>
            <ResponsivePicture id="hero" portrait eager sizes="(max-width: 760px) 100vw, 48vw" alt="현관에서 레이저와 줄자로 설치 폭을 확인하는 손" />
            <div className={styles.heroLine} aria-hidden="true"><span>폭</span></div>
            <figcaption><span>설명용 생성 이미지</span> 실제 실측은 현장 구조와 선택 조건에 따라 진행합니다.</figcaption>
          </figure>
        </section>

        <section id="conditions" className={styles.conditions} aria-labelledby="conditions-title">
          <div className={styles.sectionLead}>
            <p className={styles.eyebrow}>현관 조건 진단</p>
            <h2 id="conditions-title">사진 속 표시를 눌러<br />확인할 곳을 짚어보세요.</h2>
            <p>가장 비슷한 현관 조건을 고르면 이미지와 신청 맥락이 함께 바뀝니다.</p>
          </div>
          <div className={styles.conditionTabs} role="group" aria-label="현관 조건 선택">
            {conditions.map((item, index) => (
              <button key={item.id} type="button" aria-pressed={activeCondition === index} className={styles.conditionTab} onClick={() => selectCondition(index)}>
                {item.tab}
              </button>
            ))}
          </div>
          <div className={styles.conditionBoard} aria-live="polite">
            <div className={styles.conditionImage}>
              <ResponsivePicture key={condition.id} id={condition.id} sizes="(max-width: 760px) 100vw, 58vw" alt={condition.alt} />
              <span className={styles.generatedLabel}>설명용 생성 이미지</span>
              <div className={styles.hotspots}>
                {condition.hotspots.map((spot, index) => (
                  <button
                    key={spot.label}
                    type="button"
                    className={styles.hotspot}
                    style={{ '--hotspot-x': spot.x, '--hotspot-y': spot.y } as CSSProperties}
                    aria-pressed={activeHotspot === index}
                    aria-label={`${spot.label}: ${spot.detail}`}
                    onClick={() => setActiveHotspot(index)}
                  ><i aria-hidden="true" /><span>{spot.label}</span></button>
                ))}
              </div>
            </div>
            <div className={styles.conditionCopy}>
              <p className={styles.conditionKicker}>{condition.tab}</p>
              <h3>{condition.title}</h3>
              <p>{condition.description}</p>
              <div className={styles.hotspotDetail} data-testid="hotspot-detail">
                <Ruler size={19} aria-hidden="true" />
                <div><strong>{condition.hotspots[activeHotspot].label}</strong><p>{condition.hotspots[activeHotspot].detail}</p></div>
              </div>
              <ul>{condition.checks.map((item) => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}</ul>
              <Link className={styles.contextCta} href={applicationHref} prefetch={false} data-testid="measure-context-cta">이 조건으로 신청 이어가기 <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section id="process" className={styles.process} aria-labelledby="process-title">
          <div className={styles.processIntro}>
            <p className={styles.eyebrow}>현장에서 하는 일</p>
            <h2 id="process-title">확인하고, 재고,<br />가능한 방식을 설명합니다.</h2>
            <p>단순히 폭과 높이만 적는 방문이 아닙니다. 설치 뒤 문이 잘 움직이고 마감이 자연스러운지까지 판단할 근거를 찾습니다.</p>
          </div>
          <div className={styles.journeyVisual} data-stage={activeJourney + 1}>
            <ResponsivePicture id="consultation" sizes="(max-width: 760px) 100vw, 44vw" alt="중문 구조 도면과 마감 샘플을 함께 살펴보는 상담 장면" />
            <div className={styles.journeyOverlay} aria-hidden="true"><span>{activeJourney + 1}</span><i /></div>
            <span className={styles.generatedLabel}>설명용 생성 이미지</span>
          </div>
          <ol className={styles.journeySteps}>
            {journey.map((item, index) => (
              <li key={item.title} ref={(node) => { journeyRefs.current[index] = node }} data-index={index} data-active={activeJourney === index}>
                <span>{String(index + 1).padStart(2, '0')}</span><div><h3>{item.title}</h3><p>{item.body}</p></div>
              </li>
            ))}
          </ol>
          <div className={styles.afterApply}>
            <strong>신청 다음은 이렇게 이어집니다.</strong>
            <p>담당자 확인 → 방문 일정 안내 → 무료 실측 → 견적 설명 → 진행 여부 결정</p>
          </div>
        </section>

        <section id="prepare" className={styles.prepare} aria-labelledby="prepare-title">
          <div className={styles.photoVisual}>
            <ResponsivePicture id="photo-guide" sizes="(max-width: 760px) 100vw, 52vw" alt="현관 전체가 들어오도록 휴대전화로 사진을 찍는 손" />
            <span className={styles.generatedLabel}>설명용 생성 이미지</span>
          </div>
          <div className={styles.prepareCopy}>
            <Camera size={24} aria-hidden="true" />
            <p className={styles.eyebrow}>사진은 선택 사항</p>
            <h2 id="prepare-title">세 방향을 담으면<br />첫 상담이 빨라집니다.</h2>
            <ol>
              <li><span>1</span><div><strong>현관 전체</strong><p>바닥과 천장이 함께 보이도록 한 걸음 뒤에서</p></div></li>
              <li><span>2</span><div><strong>설치할 자리</strong><p>중문이 들어갈 벽과 양옆 동선이 보이도록</p></div></li>
              <li><span>3</span><div><strong>가까운 간섭 요소</strong><p>신발장·스위치·몰딩·단차를 가까이서</p></div></li>
            </ol>
          </div>
        </section>

        <section className={styles.trustFaq} aria-labelledby="trust-title">
          <div className={styles.trustCopy}>
            <p className={styles.eyebrow}>문장군의 책임 범위</p>
            <h2 id="trust-title">현장 판단에서<br />시공 뒤 접수까지.</h2>
            <p>중문은 화성 공장에서 자체 제작하며, 전속 시공팀이 시공합니다. 실측에서 확인한 구조와 선택 내용을 견적과 시공까지 이어서 봅니다.</p>
            <ul>
              <li><Check size={18} aria-hidden="true" />현장 조건을 기준으로 설치 방식 설명</li>
              <li><Check size={18} aria-hidden="true" />견적을 확인한 뒤 진행 여부 결정</li>
              <li><Check size={18} aria-hidden="true" />시공 뒤 A/S 접수 경로 안내</li>
            </ul>
          </div>
          <div className={styles.faqList}>
            {faqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={20} aria-hidden="true" /></summary><p>{answer}</p></details>)}
          </div>
        </section>

        <section className={styles.finalCta} aria-label="무료방문 실측견적 신청">
          <p className={styles.eyebrow}>우리 집 조건부터 확인하세요.</p>
          <h2>잘 맞는 중문은<br />정확한 실측에서 시작합니다.</h2>
          <p>주소와 관심 품목, 가능한 방문일을 남기면 담당자가 확인한 뒤 안내드립니다.</p>
          <Link ref={finalCtaRef} className={styles.finalButton} href="/portal/measure/new" prefetch={false} data-testid="measure-final-cta">무료방문 실측견적 신청 <ArrowRight size={18} aria-hidden="true" /></Link>
        </section>
      </main>
    </div>
  )
}
