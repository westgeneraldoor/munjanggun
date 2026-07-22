'use client'

import Link from 'next/link'
import { Clock3, Heart, MessageSquareText } from 'lucide-react'
import { useMemo, useState } from 'react'
import styles from './CustomerCollectionPanel.module.css'

export interface CustomerBlogActivityPost {
  id: string
  post_slug: string
  post_title_snapshot: string
  created_at?: string
  last_viewed_at?: string
}

export interface CustomerBlogActivityQuestion {
  id: string
  post_slug: string
  post_title_snapshot: string
  status: string
  created_at: string
}

type ActivityKey = 'likes' | 'questions' | 'recent'

interface CustomerCollectionPanelProps {
  likedPosts?: CustomerBlogActivityPost[]
  questions?: CustomerBlogActivityQuestion[]
  recentViewedPosts?: CustomerBlogActivityPost[]
  likesCount?: number
  questionsCount?: number
  recentViewedCount?: number
  errorMessage?: string | null
}

function formatDate(value: string | undefined) {
  if (!value) return ''

  return new Date(value).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  })
}

function getQuestionStatusLabel(status: string) {
  if (status === 'approved') return '답변 완료'
  if (status === 'rejected' || status === 'archived') return '확인 완료'
  return '확인 중'
}

export function CustomerCollectionPanel({
  likedPosts = [],
  questions = [],
  recentViewedPosts = [],
  likesCount = likedPosts.length,
  questionsCount = questions.length,
  recentViewedCount = recentViewedPosts.length,
  errorMessage = null,
}: CustomerCollectionPanelProps) {
  const [selected, setSelected] = useState<ActivityKey>('likes')

  const activities = useMemo(() => ([
    {
      key: 'likes' as const,
      title: '좋아요한 글',
      count: likesCount,
      Icon: Heart,
      items: likedPosts,
      empty: '좋아요한 글이 아직 없어요.',
    },
    {
      key: 'questions' as const,
      title: '내 질문',
      count: questionsCount,
      Icon: MessageSquareText,
      items: questions,
      empty: '남긴 질문이 아직 없어요.',
    },
    {
      key: 'recent' as const,
      title: '최근 본 글',
      count: recentViewedCount,
      Icon: Clock3,
      items: recentViewedPosts,
      empty: '최근 본 글이 아직 없어요.',
    },
  ]), [likedPosts, likesCount, questions, questionsCount, recentViewedCount, recentViewedPosts])

  const current = activities.find(activity => activity.key === selected) ?? activities[0]

  return (
    <section className={styles.section} aria-labelledby="portal-activity-title">
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>나의 활동</p>
          <h2 id="portal-activity-title">다시 확인할 내용</h2>
        </div>
      </div>

      <div className={styles.selector} role="group" aria-label="나의 활동 선택">
        {activities.map(({ key, title, count, Icon }) => {
          const isSelected = selected === key
          return (
            <button
              key={key}
              type="button"
              className={`${styles.selectorButton} ${isSelected ? styles.selected : ''}`}
              aria-pressed={isSelected}
              onClick={() => setSelected(key)}
            >
              <Icon size={20} aria-hidden="true" strokeWidth={1.8} />
              <span>{title}</span>
              <strong>{count}</strong>
            </button>
          )
        })}
      </div>

      <div className={styles.listPanel} aria-live="polite">
        <div className={styles.listHeader}>
          <h3>{current.title}</h3>
          <span>{current.count}개</span>
        </div>

        {errorMessage ? (
          <p className={styles.errorState} role="alert">{errorMessage}</p>
        ) : current.items.length === 0 ? (
          <p className={styles.emptyState}>{current.empty}</p>
        ) : (
          <ul className={styles.activityList}>
            {current.items.map(item => (
              <li key={item.id}>
                <Link href={`/blog/${item.post_slug}`}>{item.post_title_snapshot}</Link>
                <span>
                  {'status' in item
                    ? getQuestionStatusLabel(item.status)
                    : formatDate(item.last_viewed_at ?? item.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
