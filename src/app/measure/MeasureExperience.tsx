'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  DoorOpen,
  Images,
  Ruler,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import PublicUserMenu from '@/components/customer/PublicUserMenu'
import { PlatformWordmark } from '@/components/platform/customer/PlatformWordmark'
import styles from './measure.module.css'

const MEASURE_CTA = '/portal/measure/new'

const conditions = [
  {
    id: 'cabinet',
    title: '신발장과 중문 자리가 가깝다면',
    short: '신발장 간섭',
    image: '/images/measure/illustrative-condition-study.png',
    alt: '신발장과 현관문 주변 벽면이 보이는 가상의 현관 공간',
    description: '문틀을 세울 벽 공간과 신발장 문이 열리는 방향을 함께 봅니다.',
    checks: ['중문틀이 고정될 벽 공간', '신발장 문과 손잡이 간섭', '리폼 또는 다른 구조 검토 여부'],
    hotspots: [
      { label: '벽 공간', x: '66%', y: '25%' },
      { label: '신발장 동선', x: '31%', y: '62%' },
    ],
  },
  {
    id: 'finish',
    title: '스위치·몰딩이 가까운 자리라면',
    short: '마감 간섭',
    image: '/images/measure/illustrative-photo-guide.png',
    alt: '스위치와 문틀, 신발장 경계가 보이는 가상의 현관 공간',
    description: '스위치 위치와 천장·바닥 마감이 문틀과 만나는 방식을 확인합니다.',
    checks: ['스위치와 벽체의 간격', '몰딩·걸레받이 마감', '현장에 맞는 간섭 완화 방식'],
    hotspots: [
      { label: '스위치·벽체', x: '70%', y: '40%' },
      { label: '몰딩·마감', x: '47%', y: '18%' },
    ],
  },
  {
    id: 'level',
    title: '바닥 단차나 기둥이 있다면',
    short: '바닥·수직',
    image: '/images/measure/illustrative-level-study.png',
    alt: '레이저 수평기와 바닥 단차가 보이는 가상의 현관 공간',
    description: '바닥의 높이 차이와 수직·수평을 측정해 시공 가능 조건을 살핍니다.',
    checks: ['바닥 단차와 보강 검토', '레이저 기준 수직·수평', '기둥과 문짝 개폐 공간'],
    hotspots: [
      { label: '수직·수평', x: '60%', y: '31%' },
      { label: '바닥 단차', x: '49%', y: '75%' },
    ],
  },
] as const

const fieldChecks = [
  ['구조', '문틀을 세울 벽과 문이 움직일 공간'],
  ['수직·수평', '레이저 기준으로 보는 벽·바닥의 상태'],
  ['사이즈', '폭과 높이, 단차를 포함한 실제 치수'],
  ['시공 가능 여부', '현장 구조에서 검토 가능한 방식'],
  ['마감 간섭', '신발장·스위치·바닥·기둥·몰딩'],
  ['견적 변수', '보강·철거·마감 등 추가 검토 조건'],
  ['선택', '색상·유리·디자인을 함께 좁히는 상담'],
] as const

const flow = [
  ['01', '접수', '연락처와 방문 주소, 관심 품목을 남깁니다.'],
  ['02', '담당자 확인', '주소·품목·희망일을 확인해 연락드립니다.'],
  ['03', '방문 실측', '현장 구조와 마감, 시공 가능 조건을 확인합니다.'],
  ['04', '견적 안내', '확인한 조건과 선택 내용을 기준으로 안내합니다.'],
  ['05', '진행 결정', '안내를 받은 뒤 진행 여부를 결정합니다.'],
] as const

const photoGuides = [
  { number: '01', title: '현관 전체', description: '바닥과 천장이 함께 보이도록 멀리서', image: '/images/measure/illustrative-photo-guide.png', alt: '현관 전체 구조를 보여주는 설명용 가상 이미지' },
  { number: '02', title: '설치 위치', description: '중문이 들어갈 벽과 주변 동선이 보이도록', image: '/images/measure/illustrative-condition-study.png', alt: '설치 위치와 벽면을 보여주는 설명용 가상 이미지' },
  { number: '03', title: '간섭 요소', description: '신발장·스위치·몰딩·단차·기둥이 보이도록', image: '/images/measure/illustrative-level-study.png', alt: '바닥 단차와 마감 요소를 보여주는 설명용 가상 이미지' },
] as const

const faqs = [
  ['방문 실측 상담에 비용이 드나요?', '무료 방문 실측견적 상담은 비용이 들지 않습니다. 상담 후 진행 여부는 안내를 받은 뒤 결정하실 수 있습니다.'],
  ['사진을 꼭 준비해야 하나요?', '사진은 필수가 아닙니다. 다만 현관 전체와 설치 위치, 주변 간섭 요소가 보이면 방문 전 상담에 도움이 됩니다.'],
  ['방문 시간은 언제 알 수 있나요?', '접수 단계에서는 가능한 방문일을 고르고, 담당자가 방문 전날 오후 4~5시쯤 코스를 마감한 뒤 직접 안내드립니다.'],
  ['현장에서 바로 견적과 제품이 확정되나요?', '현장 조건과 고객이 고른 옵션을 확인한 뒤 견적을 안내드립니다. 안내를 받은 뒤 진행 여부를 결정하실 수 있습니다.'],
] as const

export default function MeasureExperience() {
  const [activeCondition, setActiveCondition] = useState(0)
  const [activeFlow, setActiveFlow] = useState(0)
  const condition = conditions[activeCondition]

  return (
    <div className={styles.page} data-mg-theme="portal">
      <a className={styles.skipLink} href="#measure-main">본문으로 건너뛰기</a>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand} aria-label="문장군 홈으로 이동">
          <PlatformWordmark />
        </Link>
        <nav className={styles.navLinks} aria-label="무료방문 실측견적 안내">
          <a href="#conditions">현장 조건</a>
          <a href="#process">진행 순서</a>
          <a href="#prepare">사진 준비</a>
        </nav>
        <div className={styles.navActions}>
          <Link className={styles.navPortal} href="/portal">마이페이지</Link>
          <PublicUserMenu variant="inline" tone="light" />
        </div>
      </header>

      <main id="measure-main">
        <section className={styles.hero} aria-labelledby="measure-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>MUNJANGGUN FREE VISIT MEASUREMENT</p>
            <h1 id="measure-title">집에 맞는 문은<br />현장에서 먼저<br /><em>확인합니다.</em></h1>
            <p className={styles.heroBody}>무료 방문 실측으로 구조와 마감, 시공 가능 조건을 살핀 뒤 집에 맞는 선택을 함께 좁혀드립니다.</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryCta} href={MEASURE_CTA} data-testid="measure-hero-cta">무료방문 실측견적 신청 <ArrowRight size={18} aria-hidden="true" /></Link>
              <a className={styles.textCta} href="#conditions">무엇을 확인하는지 보기 <ArrowRight size={16} aria-hidden="true" /></a>
            </div>
            <ul className={styles.heroFacts} aria-label="상담 안내">
              <li>상담 비용 없음</li>
              <li>방문 전 일정 확인</li>
              <li>안내 후 진행 결정</li>
            </ul>
          </div>
          <div className={styles.heroVisual}>
            <Image src="/images/measure/illustrative-entryway-hero.png" alt="문틀과 바닥 단차, 현관 수납장이 보이는 설명용 가상 현관" fill loading="eager" sizes="(max-width: 900px) 100vw, 54vw" className={styles.coverImage} />
            <div className={styles.heroOverlay} />
            <div className={styles.heroStamp}><Ruler size={20} aria-hidden="true" /><span>현장 구조를<br />먼저 확인합니다</span></div>
            <p className={styles.imageCaption}><span>설명용 이미지 · 실제 시공 사례가 아닙니다.</span>방문 실측은 제품을 고르기 전, 집의 조건을 확인하는 상담입니다.</p>
          </div>
        </section>

        <section id="conditions" className={styles.conditions} aria-labelledby="conditions-title">
          <div className={styles.sectionLead}>
            <p className={styles.eyebrow}>SPACE CONDITIONS</p>
            <h2 id="conditions-title">현관의 작은 차이가<br />선택의 기준이 됩니다.</h2>
            <p>우리 집에서 자주 보이는 조건을 골라보세요. 사진과 함께 현장에서 확인할 기준을 살펴볼 수 있습니다.</p>
          </div>
          <div className={styles.conditionLayout}>
            <div className={styles.conditionTabs} role="group" aria-label="현관 조건 선택">
              {conditions.map((item, index) => (
                <button key={item.id} type="button" aria-pressed={activeCondition === index} className={activeCondition === index ? styles.conditionTabActive : styles.conditionTab} onClick={() => setActiveCondition(index)}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item.short}</strong>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className={styles.conditionStage} aria-live="polite">
              <div className={styles.conditionImage}>
                {conditions.map((item, index) => (
                  <Image key={item.id} src={item.image} alt={activeCondition === index ? item.alt : ''} fill sizes="(max-width: 900px) 100vw, 52vw" className={`${styles.coverImage} ${activeCondition === index ? styles.conditionImageActive : styles.conditionImageIdle}`} />
                ))}
                <div className={styles.hotspots} aria-hidden="true">
                  {condition.hotspots.map((spot) => <span key={spot.label} style={{ left: spot.x, top: spot.y }}><i />{spot.label}</span>)}
                </div>
                <span className={styles.illustrationLabel}>설명용 이미지</span>
              </div>
              <div className={styles.conditionCopy}>
                <p className={styles.conditionIndex}>CONDITION {String(activeCondition + 1).padStart(2, '0')}</p>
                <h3>{condition.title}</h3>
                <p>{condition.description}</p>
                <ul>{condition.checks.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.fieldChecks} aria-labelledby="checks-title">
          <div className={styles.sectionLead}>
            <p className={styles.eyebrow}>ON-SITE CHECKLIST</p>
            <h2 id="checks-title">눈으로 보고, 재고,<br />가능한 방식을 판단합니다.</h2>
          </div>
          <div className={styles.checkGrid}>
            {fieldChecks.map(([title, description], index) => <article key={title} className={styles.checkCard}><span>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </section>

        <section id="process" className={styles.process} aria-labelledby="process-title">
          <div className={styles.processImage}><Image src="/images/measure/illustrative-level-study.png" alt="레이저 수평기와 바닥 경계가 보이는 설명용 가상 현관" fill sizes="(max-width: 900px) 100vw, 44vw" className={styles.coverImage} /><span className={styles.illustrationLabel}>설명용 이미지</span></div>
          <div className={styles.processContent}>
            <p className={styles.eyebrow}>FROM REQUEST TO DECISION</p>
            <h2 id="process-title">접수부터 결정까지,<br />한 단계씩 분명하게.</h2>
            <div className={styles.flowList} aria-label="무료방문 실측견적 진행 순서">
              {flow.map(([number, title, description], index) => (
                <div key={number} className={activeFlow === index ? styles.flowRowActive : styles.flowRow}>
                  <button type="button" className={activeFlow === index ? styles.flowActive : styles.flowItem} onClick={() => setActiveFlow(index)} aria-expanded={activeFlow === index} aria-controls={`measure-flow-${number}`}>
                    <span>{number}</span><strong>{title}</strong><ChevronDown size={18} aria-hidden="true" />
                  </button>
                  <p id={`measure-flow-${number}`} className={styles.flowDescription} hidden={activeFlow !== index}>{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="prepare" className={styles.photoGuide} aria-labelledby="prepare-title">
          <div className={styles.photoLead}>
            <Images size={22} aria-hidden="true" />
            <p className={styles.eyebrow}>BEFORE YOU APPLY</p>
            <h2 id="prepare-title">이 세 장이면<br />상담이 더 정확해집니다.</h2>
            <p>사진은 필수는 아닙니다. 다만 구조를 함께 볼 수 있으면 방문 전 안내가 더 수월해집니다.</p>
          </div>
          <ol className={styles.photoSteps}>
            {photoGuides.map((guide) => <li key={guide.number}><div className={styles.photoIllustration}><Image src={guide.image} alt={guide.alt} fill sizes="(max-width: 620px) 100vw, 33vw" className={styles.coverImage} /><span className={styles.illustrationLabel}>설명용 이미지</span></div><span>{guide.number}</span><div><strong>{guide.title}</strong><p>{guide.description}</p></div></li>)}
          </ol>
        </section>

        <section className={styles.trust} aria-labelledby="trust-title">
          <div className={styles.trustImage}><Image src="/images/measure/illustrative-condition-study.png" alt="문틀과 수납장 경계가 보이는 설명용 가상 현관" fill sizes="(max-width: 900px) 100vw, 45vw" className={styles.coverImage} /><span className={styles.illustrationLabel}>설명용 이미지</span></div>
          <div className={styles.trustCopy}><Sparkles size={22} aria-hidden="true" /><p className={styles.eyebrow}>THE MUNJANGGUN STANDARD</p><h2 id="trust-title">직접 제작부터 전속 시공,<br />A/S까지 이어지는 선택.</h2><p>문장군은 문짝만의 문제가 아니라 설치와 마감까지 함께 살핍니다. 그래서 실측에서 구조와 선택 기준을 충분히 확인합니다.</p><ul><li><DoorOpen size={17} aria-hidden="true" />집에 맞는 구조를 먼저 검토</li><li><Compass size={17} aria-hidden="true" />현장 조건과 원하는 디자인을 함께 상담</li><li><ShieldCheck size={17} aria-hidden="true" />시공 뒤 A/S 접수까지 이어지는 고객 여정</li></ul></div>
        </section>

        <section className={styles.faq} aria-labelledby="faq-title">
          <div className={styles.sectionLead}><p className={styles.eyebrow}>FAQ</p><h2 id="faq-title">신청 전, 자주 묻는 질문.</h2></div>
          <div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={20} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className={styles.finalCta} aria-label="무료방문 실측견적 신청">
          <p className={styles.eyebrow}>FREE VISIT MEASUREMENT</p><h2>우리 집 조건을<br />먼저 확인해볼까요?</h2><p>주소와 관심 품목, 가능한 방문일을 남기면 담당자가 확인 후 안내드립니다.</p><Link className={styles.primaryCta} href={MEASURE_CTA} data-testid="measure-final-cta">무료방문 실측견적 신청 <ArrowRight size={18} aria-hidden="true" /></Link>
        </section>
      </main>
      <div className={styles.mobileCta}><Link href={MEASURE_CTA} data-testid="measure-mobile-cta">무료방문 실측견적 신청 <ArrowRight size={18} aria-hidden="true" /></Link></div>
    </div>
  )
}
