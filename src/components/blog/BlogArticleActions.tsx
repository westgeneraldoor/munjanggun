'use client'

import Link from 'next/link'
import { CheckCircle2, MessageCircleQuestion, Share2, ThumbsUp } from 'lucide-react'
import { useCallback, useState, useSyncExternalStore } from 'react'
import styles from './BlogArticleActions.module.css'

type BlogArticleActionsProps = {
  postSlug: string
  postTitle: string
}

type ShareStatus = 'idle' | 'copied' | 'shared' | 'failed'

const HELPFUL_STORAGE_PREFIX = 'munjanggun:blog-helpful:'
const HELPFUL_CHANGE_EVENT = 'munjanggun:blog-helpful-change'

function getHelpfulStorageKey(postSlug: string) {
  return `${HELPFUL_STORAGE_PREFIX}${postSlug}`
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
  const getHelpfulSnapshot = useCallback(() => readHelpfulSnapshot(postSlug), [postSlug])
  const isHelpful = useSyncExternalStore(subscribeToHelpfulChange, getHelpfulSnapshot, () => false)

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

  function markHelpful() {
    try {
      window.localStorage.setItem(getHelpfulStorageKey(postSlug), 'true')
    } catch {
      // The visible acknowledgement still helps even when storage is unavailable.
    }
    window.dispatchEvent(new Event(HELPFUL_CHANGE_EVENT))
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
        >
          {isHelpful ? <CheckCircle2 size={17} aria-hidden="true" /> : <ThumbsUp size={17} aria-hidden="true" />}
          도움돼요
        </button>
        <Link href="/portal/measure/new" className={styles.primaryLink}>
          <MessageCircleQuestion size={17} aria-hidden="true" />
          무료 방문실측 상담
        </Link>
      </div>

      <div className={styles.status} aria-live="polite">
        {shareMessage && <span>{shareMessage}</span>}
        {isHelpful && <span>도움 표시를 저장했어요.</span>}
      </div>
    </section>
  )
}
