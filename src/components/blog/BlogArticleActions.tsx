'use client'

import Link from 'next/link'
import { Bookmark, CheckCircle2, HelpCircle, MessageCircleQuestion, MoreHorizontal, Ruler, Share2, ThumbsUp } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import styles from './BlogArticleActions.module.css'

type BlogArticleActionsProps = {
  postSlug: string
  postTitle: string
}

type ShareStatus = 'idle' | 'copied' | 'shared' | 'failed'
type ReaderStatus = 'idle' | 'saved' | 'removed' | 'questionSaved' | 'loginRequired' | 'failed'

type ReaderPayload = {
  counts: {
    helpful: number
  }
  viewer: null | {
    isAuthenticated: true
    helpful: boolean
    saved: boolean
    privateQuestionCount: number
  }
}

const HELPFUL_STORAGE_PREFIX = 'munjanggun:blog-helpful:'
const HELPFUL_CHANGE_EVENT = 'munjanggun:blog-helpful-change'
const QUESTION_DRAFT_STORAGE_PREFIX = 'munjanggun:blog-question-draft:'

function getHelpfulStorageKey(postSlug: string) {
  return `${HELPFUL_STORAGE_PREFIX}${postSlug}`
}

function getQuestionDraftStorageKey(postSlug: string) {
  return `${QUESTION_DRAFT_STORAGE_PREFIX}${postSlug}`
}

function getCurrentArticleUrl() {
  if (typeof window === 'undefined') return ''
  return window.location.href
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the selection-based fallback below.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

function subscribeToHelpfulChange(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(HELPFUL_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(HELPFUL_CHANGE_EVENT, onStoreChange)
  }
}

function readHelpfulSnapshot(postSlug: string) {
  try {
    return window.localStorage.getItem(getHelpfulStorageKey(postSlug)) === 'true'
  } catch {
    return false
  }
}

export default function BlogArticleActions({ postSlug, postTitle }: BlogArticleActionsProps) {
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle')
  const [readerStatus, setReaderStatus] = useState<ReaderStatus>('idle')
  const [readerPayload, setReaderPayload] = useState<ReaderPayload>({
    counts: { helpful: 0 },
    viewer: null,
  })
  const [readerLoaded, setReaderLoaded] = useState(false)
  const [readerBusy, setReaderBusy] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [questionDraft, setQuestionDraft] = useState('')
  const [questionSaved, setQuestionSaved] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const questionPanelRef = useRef<HTMLDivElement>(null)
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null)
  const questionDraftEditedRef = useRef(false)
  const getHelpfulSnapshot = useCallback(() => readHelpfulSnapshot(postSlug), [postSlug])
  const localHelpful = useSyncExternalStore(subscribeToHelpfulChange, getHelpfulSnapshot, () => false)
  const isHelpful = readerPayload.viewer?.helpful ?? localHelpful
  const isSaved = readerPayload.viewer?.saved ?? false
  const questionHref = `/portal/measure/new?source=blog-question&post=${encodeURIComponent(postSlug)}`
  const questionAnchorHref = '#blog-question-panel'
  const readerEndpoint = `/api/blog/posts/${encodeURIComponent(postSlug)}/reader`

  const closeMobileMoreMenu = useCallback((restoreFocus = false) => {
    setMoreOpen(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => moreButtonRef.current?.focus())
    }
  }, [])

  useEffect(() => {
    if (!moreOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeMobileMoreMenu(true)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (moreMenuRef.current?.contains(target) || moreButtonRef.current?.contains(target)) return
      closeMobileMoreMenu(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [closeMobileMoreMenu, moreOpen])

  useEffect(() => {
    questionDraftEditedRef.current = false

    const timer = window.setTimeout(() => {
      if (questionDraftEditedRef.current) return

      try {
        setQuestionDraft(window.sessionStorage.getItem(getQuestionDraftStorageKey(postSlug)) ?? '')
      } catch {
        setQuestionDraft('')
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [postSlug])

  useEffect(() => {
    let active = true

    async function loadReaderState() {
      try {
        const response = await fetch(readerEndpoint, { credentials: 'same-origin' })
        if (!response.ok) return
        const payload = await response.json() as ReaderPayload
        if (active) setReaderPayload(payload)
      } catch {
        // Keep local fallback behavior when the reader API is unavailable.
      } finally {
        if (active) setReaderLoaded(true)
      }
    }

    void loadReaderState()

    return () => {
      active = false
    }
  }, [readerEndpoint])

  async function shareArticle() {
    const url = getCurrentArticleUrl()

    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: postTitle,
            url,
          })
          setShareStatus('shared')
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
        }
      }

      setShareStatus(await copyTextToClipboard(url) ? 'copied' : 'failed')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareStatus('failed')
    }
  }

  async function patchReaderAction(body: { helpful?: boolean; saved?: boolean }) {
    const response = await fetch(readerEndpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })

    if (response.status === 401) {
      setReaderStatus('loginRequired')
      return null
    }

    if (!response.ok) throw new Error('Reader action failed')

    const payload = await response.json() as ReaderPayload
    setReaderPayload(payload)
    return payload
  }

  async function markHelpful() {
    setReaderStatus('idle')

    if (readerLoaded) {
      setReaderBusy(true)
      try {
        const nextHelpful = !isHelpful
        const payload = await patchReaderAction({ helpful: nextHelpful })
        if (!payload) {
          if (nextHelpful) {
            try {
              window.localStorage.setItem(getHelpfulStorageKey(postSlug), 'true')
            } catch {
              // The visible acknowledgement still helps even when storage is unavailable.
            }
            window.dispatchEvent(new Event(HELPFUL_CHANGE_EVENT))
            setReaderStatus('idle')
          }
          return
        }
        setReaderStatus(nextHelpful ? 'saved' : 'removed')
      } catch {
        setReaderStatus('failed')
      } finally {
        setReaderBusy(false)
      }
      return
    }

    try {
      window.localStorage.setItem(getHelpfulStorageKey(postSlug), 'true')
    } catch {
      // The visible acknowledgement still helps even when storage is unavailable.
    }
    window.dispatchEvent(new Event(HELPFUL_CHANGE_EVENT))
  }

  async function toggleSavedArticle() {
    setReaderStatus('idle')

    setReaderBusy(true)
    try {
      const nextSaved = !isSaved
      const payload = await patchReaderAction({ saved: nextSaved })
      if (!payload) return
      setReaderStatus(nextSaved ? 'saved' : 'removed')
    } catch {
      setReaderStatus('failed')
    } finally {
      setReaderBusy(false)
    }
  }

  async function submitPrivateQuestion() {
    const question = questionDraft.trim()
    setReaderStatus('idle')

    if (question.length < 2) {
      saveQuestionDraft()
      return
    }

    setReaderBusy(true)
    try {
      const response = await fetch(readerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ question }),
      })

      if (response.status === 401) {
        saveQuestionDraft()
        setReaderStatus('loginRequired')
        return
      }

      if (!response.ok) throw new Error('Private question failed')

      const payload = await response.json() as ReaderPayload
      setReaderPayload(payload)
      setQuestionDraft('')
      setQuestionSaved(false)
      try {
        window.sessionStorage.removeItem(getQuestionDraftStorageKey(postSlug))
      } catch {
        // Ignore unavailable session storage.
      }
      setReaderStatus('questionSaved')
    } catch {
      setReaderStatus('failed')
    } finally {
      setReaderBusy(false)
    }
  }

  function saveQuestionDraft() {
    const draft = questionDraft.trim()

    try {
      if (draft) {
        window.sessionStorage.setItem(getQuestionDraftStorageKey(postSlug), draft)
      } else {
        window.sessionStorage.removeItem(getQuestionDraftStorageKey(postSlug))
      }
      setQuestionSaved(Boolean(draft))
    } catch {
      setQuestionSaved(false)
    }
  }

  function focusQuestionPanel() {
    closeMobileMoreMenu(false)
    window.requestAnimationFrame(() => {
      questionPanelRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      questionTextareaRef.current?.focus()
    })
  }

  async function shareFromMobileMenu() {
    await shareArticle()
    closeMobileMoreMenu(true)
  }

  const shareMessage =
    shareStatus === 'copied'
      ? '링크를 복사했어요.'
      : shareStatus === 'shared'
        ? '공유 창을 열었어요.'
        : shareStatus === 'failed'
          ? '지금은 링크를 복사하지 못했어요.'
          : null

  return (
    <section className={styles.actions} aria-label="글을 읽은 뒤 할 수 있는 일">
      <div className={styles.copy}>
        <span>읽고 난 뒤</span>
        <h2>우리 집 조건도 같이 확인해볼까요?</h2>
        <p>글로 판단하기 애매한 구조라면 무료 방문실측에서 폭, 단차, 신발장과 스위치 위치를 함께 봅니다.</p>
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.secondaryButton} onClick={shareArticle}>
          <Share2 size={17} aria-hidden="true" />
          공유하기
        </button>
        <button
          type="button"
          className={`${styles.secondaryButton} ${isHelpful ? styles.activeButton : ''}`}
          onClick={markHelpful}
          aria-pressed={isHelpful}
          disabled={readerBusy}
          data-testid="blog-helpful-action"
        >
          {isHelpful ? <CheckCircle2 size={17} aria-hidden="true" /> : <ThumbsUp size={17} aria-hidden="true" />}
          도움돼요
        </button>
        <button
          type="button"
          className={`${styles.secondaryButton} ${isSaved ? styles.activeButton : ''}`}
          onClick={toggleSavedArticle}
          aria-pressed={isSaved}
          disabled={readerBusy}
          data-testid="blog-save-action"
        >
          {isSaved ? <CheckCircle2 size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}
          저장
        </button>
        <Link href={questionHref} className={styles.primaryLink} onClick={saveQuestionDraft} data-testid="blog-question-intake-desktop">
          <MessageCircleQuestion size={17} aria-hidden="true" />
          무료 방문실측 상담
        </Link>
      </div>

      <div
        id="blog-question-panel"
        ref={questionPanelRef}
        className={styles.questionPanel}
        aria-label="블로그 글 기반 비공개 질문"
        data-testid="blog-question-panel"
      >
        <div className={styles.questionCopy}>
          <span>비공개 질문</span>
          <strong>이 글을 읽고 궁금한 점을 상담 폼으로 이어갈 수 있어요.</strong>
          <p>이곳에는 이름, 전화번호, 상세주소, 현장 사진 같은 개인정보를 적지 마세요. 필요한 개인정보는 로그인 후 실측 상담 폼에서 동의와 함께 받습니다.</p>
        </div>
        <label className={styles.questionField}>
          <span>글 기준 질문 메모</span>
          <textarea
            ref={questionTextareaRef}
            value={questionDraft}
            onChange={event => {
              questionDraftEditedRef.current = true
              setQuestionDraft(event.target.value)
              setQuestionSaved(false)
            }}
            placeholder="예: 이 글의 조건과 비슷한 집도 실측 상담이 가능한지 궁금해요."
            rows={3}
            data-testid="blog-question-draft"
          />
        </label>
        <div className={styles.questionActions}>
          <button type="button" className={styles.secondaryButton} onClick={saveQuestionDraft} data-testid="blog-question-save">
            질문 메모 저장
          </button>
          <button type="button" className={styles.secondaryButton} onClick={submitPrivateQuestion} disabled={readerBusy} data-testid="blog-question-private-submit">
            비공개 질문 저장
          </button>
          <Link href={questionHref} className={styles.primaryLink} onClick={saveQuestionDraft} data-testid="blog-question-continue">
            상담 폼에서 이어가기
          </Link>
        </div>
      </div>

      <div className={styles.status} role="status" aria-live="polite">
        {shareMessage && <span>{shareMessage}</span>}
        {isHelpful && <span>도움 표시를 저장했어요.</span>}
        {isSaved && <span>마이페이지에 저장했어요.</span>}
        {questionSaved && <span>질문 메모를 현재 탭에 임시 저장했어요.</span>}
        {readerStatus === 'questionSaved' && <span>비공개 질문을 마이페이지에 저장했어요.</span>}
        {readerStatus === 'loginRequired' && <span>로그인하면 저장과 비공개 질문을 마이페이지에 남길 수 있어요.</span>}
        {readerStatus === 'failed' && <span>지금은 저장하지 못했어요. 잠시 후 다시 시도해 주세요.</span>}
      </div>
      <nav className={styles.mobileBar} aria-label="블로그 글 하단 빠른 작업" data-testid="blog-mobile-bottom-actions">
        <button
          type="button"
          className={`${styles.mobileAction} ${isHelpful ? styles.mobileActionActive : ''}`}
          onClick={markHelpful}
          aria-label="모바일 도움돼요"
          aria-pressed={isHelpful}
          disabled={readerBusy}
          data-testid="blog-mobile-helpful"
        >
          {isHelpful ? <CheckCircle2 size={18} aria-hidden="true" /> : <ThumbsUp size={18} aria-hidden="true" />}
          <span>도움돼요</span>
        </button>
        <Link href={questionAnchorHref} className={styles.mobileAction} onClick={focusQuestionPanel} aria-label="모바일 질문하기" data-testid="blog-mobile-question">
          <HelpCircle size={18} aria-hidden="true" />
          <span>질문하기</span>
        </Link>
        <Link href={questionHref} className={`${styles.mobileAction} ${styles.mobilePrimaryAction}`} onClick={saveQuestionDraft} aria-label="모바일 무료 실측" data-testid="blog-mobile-measure">
          <Ruler size={18} aria-hidden="true" />
          <span>무료 실측</span>
        </Link>
        <button
          ref={moreButtonRef}
          type="button"
          className={styles.mobileAction}
          onClick={() => setMoreOpen(open => !open)}
          aria-label="모바일 더보기"
          aria-expanded={moreOpen}
          aria-controls="blog-mobile-more-actions"
          data-testid="blog-mobile-more"
        >
          <MoreHorizontal size={19} aria-hidden="true" />
          <span>더보기</span>
        </button>
      </nav>

      {moreOpen && (
        <div ref={moreMenuRef} className={styles.mobileMoreMenu} id="blog-mobile-more-actions" data-testid="blog-mobile-more-actions">
          <button type="button" onClick={toggleSavedArticle} aria-label="모바일 저장하기" aria-pressed={isSaved} disabled={readerBusy} data-testid="blog-mobile-save">
            {isSaved ? <CheckCircle2 size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}
            저장하기
          </button>
          <button type="button" onClick={shareFromMobileMenu} aria-label="모바일 공유하기" data-testid="blog-mobile-share">
            <Share2 size={17} aria-hidden="true" />
            공유하기
          </button>
        </div>
      )}
    </section>
  )
}
