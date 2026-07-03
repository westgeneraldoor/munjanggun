/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarCheck, CheckCircle2, ClipboardList, HelpCircle, Ruler } from 'lucide-react'
import styles from './measure.module.css'

export const metadata: Metadata = {
  title: '무료방문 실측견적 안내 | 문장군',
  description: '문장군 무료방문 실측견적은 진행 여부와 관계없이 비용이 들지 않으며, 집 구조와 시공 가능 조건을 먼저 확인하는 상담입니다.',
}

const steps = [
  {
    title: '집 조건을 먼저 확인',
    desc: '신발장, 스위치, 벽공간, 바닥 단차처럼 사진만으로 판단하기 어려운 부분을 봅니다.',
  },
  {
    title: '가능한 방식 정리',
    desc: '우리 집에 맞는 중문·도어 방식과 주의해야 할 조건을 설명드립니다.',
  },
  {
    title: '견적 범위 안내',
    desc: '확정 가격처럼 말하지 않고, 실측으로 확인된 조건 기준으로 상담을 이어갑니다.',
  },
  {
    title: '진행 여부는 나중에 결정',
    desc: '상담을 받아도 바로 계약하거나 비용을 내야 하는 흐름이 아닙니다.',
  },
]

const fitCases = [
  '중문을 달 수 있는 구조인지 애매할 때',
  '신발장, 스위치, 바닥 단차가 걸릴 것 같을 때',
  '인터넷 가격만 보고는 우리 집 견적을 판단하기 어려울 때',
  '블로그를 읽었지만 현장 조건을 직접 확인받고 싶을 때',
]

const faqs = [
  {
    q: '상담만 받아도 비용이 생기나요?',
    a: '무료방문 실측견적 상담은 비용이 들지 않습니다. 진행 여부는 상담 후 천천히 판단하시면 됩니다.',
  },
  {
    q: '사진을 꼭 준비해야 하나요?',
    a: '필수는 아니지만 현관, 설치 희망 위치, 걸리는 부분을 찍어두면 상담이 더 빨라집니다.',
  },
  {
    q: '바로 신청 폼으로 가도 되나요?',
    a: '가능합니다. 아래 신청 버튼을 누르면 로그인 후 접수 화면으로 이어집니다.',
  },
]

export default function MeasureLandingPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="measure-title">
        <div className={styles.heroCopy}>
          <Link href="/blog" className={styles.backLink}>
            문장군 블로그로 돌아가기
          </Link>
          <span className={styles.eyebrow}>무료방문 실측견적 안내</span>
          <h1 id="measure-title">집에 맞는지 먼저 보고, 결정은 그 다음에 하세요.</h1>
          <p>
            중문과 도어는 제품보다 집 구조가 먼저입니다. 문장군은 방문 실측으로 가능 여부와 방향을 확인한 뒤
            상담을 이어갑니다.
          </p>
          <div className={styles.heroActions}>
            <Link href="/portal/measure/new" className={styles.primaryAction}>
              무료방문 실측견적 신청
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/blog" className={styles.secondaryAction}>
              글 더 읽어보기
            </Link>
          </div>
          <div className={styles.quickFacts} aria-label="무료방문 실측견적 핵심 안내">
            <span>상담 무료</span>
            <span>신청은 로그인 후 이어집니다</span>
            <span>접수 후 담당자 연락</span>
          </div>
        </div>
        <div className={styles.heroImage} aria-label="무료방문 실측견적 분위기 이미지">
          <img src="/images/blog-launch/measure-consultation-detail.png" alt="" />
          <div className={styles.heroNote}>
            <Ruler size={18} aria-hidden="true" />
            <span>상담을 받아도 진행하지 않으면 비용이 들지 않아요.</span>
          </div>
          <span className={styles.visualLabel}>이해를 돕는 이미지</span>
        </div>
      </section>

      <section className={styles.fitPanel} aria-labelledby="fit-title">
        <div>
          <span className={styles.sectionLabel}>이럴 때 신청하세요</span>
          <h2 id="fit-title">블로그로 판단이 끝나지 않는 순간이 있습니다.</h2>
        </div>
        <div className={styles.fitGrid}>
          {fitCases.map(item => (
            <div key={item} className={styles.fitItem}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.steps} aria-labelledby="step-title">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>진행 순서</span>
          <h2 id="step-title">접수는 짧게, 확인은 정확하게.</h2>
          <p>필요한 내용만 먼저 남겨주시면 담당자가 현장 조건을 기준으로 이어서 안내합니다.</p>
        </div>
        <div className={styles.stepGrid}>
          {steps.map((step, index) => (
            <article key={step.title} className={styles.stepCard}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.prepare} aria-labelledby="prepare-title">
        <div>
          <CalendarCheck size={22} aria-hidden="true" />
          <h2 id="prepare-title">신청 전에 준비하면 좋은 것</h2>
        </div>
        <p>
          설치를 생각하는 위치 사진, 대략적인 희망 제품, 연락 가능한 시간대가 있으면 충분합니다. 정확한 판단은
          방문 실측에서 함께 확인합니다.
        </p>
      </section>

      <section className={styles.faq} aria-labelledby="faq-title">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>자주 묻는 질문</span>
          <h2 id="faq-title">신청 전에 궁금한 점</h2>
        </div>
        <div className={styles.faqGrid}>
          {faqs.map(item => (
            <article key={item.q}>
              <HelpCircle size={18} aria-hidden="true" />
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta} aria-label="무료방문 실측견적 신청">
        <div>
          <ClipboardList size={22} aria-hidden="true" />
          <strong>우리 집 조건을 먼저 확인해볼까요?</strong>
          <span>접수 후 담당자가 확인하고 연락드립니다.</span>
        </div>
        <Link href="/portal/measure/new">
          신청 폼으로 이동
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </main>
  )
}
