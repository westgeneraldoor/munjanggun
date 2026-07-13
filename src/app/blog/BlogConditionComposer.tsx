'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BLOG_HOME_MEDIA } from './blog-home-assets'
import type { BlogHomePost } from './blog-home-model'
import styles from './BlogConditionComposer.module.css'

type ComposerOption = {
  label: string
  sentence: string
  focus: string
}

type ComposerStep = {
  kicker: string
  title: string
  label: string
  options: ComposerOption[]
}

const STEPS: ComposerStep[] = [
  {
    kicker: 'STEP 01',
    title: '우리 집 공간은 어떤가요?',
    label: '공간 조건을 선택하세요',
    options: [
      { label: '좁은 현관', sentence: '현관이 좁아서', focus: '42% center' },
      { label: '공간 분리', sentence: '거실과 현관이 바로 이어져', focus: '58% center' },
      { label: '단차 있음', sentence: '바닥 단차가 있어서', focus: '72% center' },
    ],
  },
  {
    kicker: 'STEP 02',
    title: '무엇을 바꾸고 싶나요?',
    label: '원하는 변화를 선택하세요',
    options: [
      { label: '냉기·소음 완화', sentence: '냉기와 소음을 줄일', focus: '64% center' },
      { label: '채광 유지', sentence: '빛은 그대로 통하는', focus: '54% center' },
      { label: '디자인 조화', sentence: '집과 자연스럽게 어울릴', focus: '76% center' },
    ],
  },
  {
    kicker: 'STEP 03',
    title: '가장 궁금한 건 무엇인가요?',
    label: '마지막 궁금증을 선택하세요',
    options: [
      { label: '설치 가능 여부', sentence: '중문 설치가 가능한지', focus: '50% center' },
      { label: '제품과 디자인', sentence: '어떤 제품이 잘 맞는지', focus: '68% center' },
      { label: '가격·견적 조건', sentence: '견적 조건이 어떻게 되는지', focus: '58% center' },
    ],
  },
]

const EMPTY_SELECTIONS: Array<ComposerOption | null> = STEPS.map(() => null)
const EMPTY_LABELS = ['우리 집 공간은?', '바꾸고 싶은 점은?', '가장 궁금한 건?']

type BlogConditionComposerProps = {
  posts: BlogHomePost[]
}

export default function BlogConditionComposer({ posts }: BlogConditionComposerProps) {
  const timeoutRef = useRef<number | null>(null)
  const changeAnimationFrameRef = useRef<number | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [selections, setSelections] = useState<Array<ComposerOption | null>>(EMPTY_SELECTIONS)
  const [resultOpen, setResultOpen] = useState(false)
  const [changedIndex, setChangedIndex] = useState<number | null>(null)
  const [focus, setFocus] = useState('50% center')
  const resultPosts = posts.slice(0, 4)
  const completedCount = selections.filter(Boolean).length

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    if (changeAnimationFrameRef.current !== null) window.cancelAnimationFrame(changeAnimationFrameRef.current)
  }, [])

  function chooseOption(option: ComposerOption) {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    const nextSelections = selections.map((selection, index) => index === stepIndex ? option : selection)
    setSelections(nextSelections)
    setChangedIndex(null)
    if (changeAnimationFrameRef.current !== null) window.cancelAnimationFrame(changeAnimationFrameRef.current)
    changeAnimationFrameRef.current = window.requestAnimationFrame(() => {
      setChangedIndex(stepIndex)
      changeAnimationFrameRef.current = null
    })
    setFocus(option.focus)
    setResultOpen(false)

    timeoutRef.current = window.setTimeout(() => {
      const nextEmptyIndex = nextSelections.findIndex((selection, index) => index > stepIndex && !selection)
      const firstEmptyIndex = nextSelections.findIndex(selection => !selection)

      if (nextEmptyIndex >= 0) {
        setStepIndex(nextEmptyIndex)
      } else if (firstEmptyIndex >= 0) {
        setStepIndex(firstEmptyIndex)
      } else {
        setResultOpen(true)
      }
      timeoutRef.current = null
    }, 430)
  }

  function editStep(index: number) {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    setStepIndex(index)
    setResultOpen(false)
  }

  function restart() {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    setSelections(EMPTY_SELECTIONS)
    setStepIndex(0)
    setResultOpen(false)
    setChangedIndex(null)
    setFocus('50% center')
  }

  function goBack() {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    setResultOpen(false)
    setStepIndex(current => Math.max(0, current - 1))
  }

  const currentStep = STEPS[stepIndex]

  return (
    <section id="blog-condition" className={styles.section} aria-labelledby="blog-condition-title">
      <header className={styles.intro}>
        <span>3초 만에 우리 집과 비슷한 글 찾기</span>
        <h2 id="blog-condition-title">검색어는 몰라도 괜찮아요. 세 가지만 골라보세요.</h2>
        <p>우리 집 상황을 세 번 누르면, 지금 먼저 읽으면 좋은 글을 바로 골라드려요.</p>
      </header>

      <div className={styles.stage}>
        <div
          className={styles.composer}
          data-testid="blog-condition-composer"
          data-complete={completedCount === STEPS.length ? 'true' : 'false'}
        >
          <Image
            src={BLOG_HOME_MEDIA.conditionComposer.src}
            alt={BLOG_HOME_MEDIA.conditionComposer.alt}
            fill
            sizes="100vw"
            className={styles.image}
            style={{ objectPosition: focus }}
          />
          <div className={styles.veil} aria-hidden="true" />

          <div className={styles.content}>
            <div className={styles.sentencePanel}>
              <span className={styles.stepLabel}>{resultOpen ? '완성 · 가까운 이야기를 찾았습니다' : `${completedCount} / ${STEPS.length} · 하나씩 골라보세요`}</span>
              <p className={styles.sentence}>
                우리 집은<br />
                {selections.map((selection, index) => (
                  <span key={STEPS[index].kicker}>
                    <button
                      type="button"
                      className={`${styles.word} ${selection ? styles.wordFilled : styles.wordEmpty} ${changedIndex === index ? styles.wordChanged : ''}`}
                      onClick={() => editStep(index)}
                      aria-label={selection ? `${STEPS[index].label} 수정` : STEPS[index].label}
                      data-testid={`blog-condition-word-${index}`}
                    >
                      {selection ? (
                        <>{selection.sentence}<small>다시 고르기</small></>
                      ) : (
                        <><Plus size={18} aria-hidden="true" /><em>{EMPTY_LABELS[index]}</em></>
                      )}
                    </button><br />
                  </span>
                ))}
                {completedCount === STEPS.length && <span className={styles.sentenceTail}>궁금해요.</span>}
              </p>
              <p className={styles.microcopy}>{resultOpen ? '완성된 문장은 검색어가 아니라 상담의 출발점이 됩니다.' : '빈칸이나 채워진 문장을 누르면 언제든 다시 고를 수 있어요.'}</p>
            </div>

            <aside className={styles.selector} aria-labelledby="blog-condition-step-title">
              <div className={styles.selectorHeader}>
                <div className={styles.selectorTitle}>
                  <button type="button" className={styles.backButton} onClick={goBack} disabled={stepIndex === 0} aria-label="이전 질문으로 돌아가기">
                    <ArrowLeft size={17} aria-hidden="true" />
                  </button>
                  <div><span>{currentStep.kicker}</span><h3 id="blog-condition-step-title">{currentStep.title}</h3></div>
                </div>
                <div className={styles.progress} aria-label={`${stepIndex + 1} / ${STEPS.length} 단계`}>
                  {STEPS.map((step, index) => <i key={step.kicker} className={selections[index] ? styles.progressActive : index === stepIndex ? styles.progressCurrent : ''} />)}
                </div>
              </div>
              <div className={styles.choices}>
                {currentStep.options.map((option, index) => {
                  const selected = selections[stepIndex]?.label === option.label
                  return (
                    <button
                      key={option.label}
                      type="button"
                      className={selected ? styles.choiceSelected : ''}
                      onClick={() => chooseOption(option)}
                      data-testid={`blog-condition-choice-${stepIndex}-${index}`}
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{option.label}</strong>
                      <ArrowRight size={16} />
                    </button>
                  )
                })}
              </div>
            </aside>
          </div>
        </div>
      </div>

      <div
        className={`${styles.results} ${resultOpen ? styles.resultsOpen : ''}`}
        aria-live="polite"
        aria-hidden={!resultOpen}
        inert={!resultOpen ? true : undefined}
        data-testid="blog-condition-results"
        data-open={resultOpen ? 'true' : 'false'}
      >
        <div className={styles.resultPanel}>
          <div className={styles.resultTitle}>
            <span>선택한 조건과 가까운 기록</span>
            <h3>{resultPosts.length > 0 ? `먼저 읽어볼 이야기 ${resultPosts.length}개` : '가까운 이야기를 준비하고 있습니다'}</h3>
          </div>
          <div className={styles.resultList}>
            {resultPosts.map(post => (
              <Link key={post.id} href={`/blog/${post.slug}`} tabIndex={resultOpen ? 0 : -1}>
                <span>{post.categoryLabel}</span>
                <strong>{post.title}</strong>
              </Link>
            ))}
          </div>
          <div className={styles.resultActions}>
            {resultPosts[0] && <Link href={`/blog/${resultPosts[0].slug}`} tabIndex={resultOpen ? 0 : -1}>첫 글 읽기 <ArrowRight size={15} /></Link>}
            <button type="button" onClick={restart} tabIndex={resultOpen ? 0 : -1}><RotateCcw size={15} /> 처음부터 다시</button>
          </div>
        </div>
      </div>
    </section>
  )
}
