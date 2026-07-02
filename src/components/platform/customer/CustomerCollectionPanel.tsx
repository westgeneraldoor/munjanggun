import Link from 'next/link'
import { Bookmark, HelpCircle, MessageSquareText } from 'lucide-react'
import { PlatformBadge, PlatformCard } from '@/components/platform/ui'
import styles from './CustomerCollectionPanel.module.css'

export interface CustomerBlogActivityPost {
  id: string
  post_slug: string
  post_title_snapshot: string
  created_at: string
}

export interface CustomerBlogActivityQuestion {
  id: string
  post_slug: string
  post_title_snapshot: string
  status: string
  created_at: string
}

interface CustomerCollectionPanelProps {
  savedPosts?: CustomerBlogActivityPost[]
  helpfulPosts?: CustomerBlogActivityPost[]
  questions?: CustomerBlogActivityQuestion[]
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  })
}

function ActivityList({ items }: { items: CustomerBlogActivityPost[] }) {
  if (items.length === 0) return null

  return (
    <ul className={styles.activityList}>
      {items.slice(0, 3).map(item => (
        <li key={item.id}>
          <Link href={`/blog/${item.post_slug}`}>{item.post_title_snapshot}</Link>
          <span>{formatDate(item.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}

function QuestionList({ items }: { items: CustomerBlogActivityQuestion[] }) {
  if (items.length === 0) return null

  return (
    <ul className={styles.activityList}>
      {items.slice(0, 3).map(item => (
        <li key={item.id}>
          <Link href={`/blog/${item.post_slug}`}>{item.post_title_snapshot}</Link>
          <span>{item.status === 'private' ? '비공개' : item.status}</span>
        </li>
      ))}
    </ul>
  )
}

export function CustomerCollectionPanel({
  savedPosts = [],
  helpfulPosts = [],
  questions = [],
}: CustomerCollectionPanelProps) {
  const activityItems = [
    {
      key: 'saved',
      title: '저장한 글',
      description: savedPosts.length > 0 ? '다시 확인할 글을 모아두었어요.' : '마음에 둔 글을 저장하면 여기에 모입니다.',
      badge: `${savedPosts.length}개`,
      Icon: Bookmark,
      content: <ActivityList items={savedPosts} />,
    },
    {
      key: 'helpful',
      title: '도움된 글',
      description: helpfulPosts.length > 0 ? '도움됐다고 표시한 글입니다.' : '도움된 글을 표시하면 상담 전에 다시 보기 쉬워요.',
      badge: `${helpfulPosts.length}개`,
      Icon: HelpCircle,
      content: <ActivityList items={helpfulPosts} />,
    },
    {
      key: 'questions',
      title: '내 질문',
      description: questions.length > 0 ? '블로그 글에서 남긴 비공개 질문입니다.' : '비공개 질문을 남기면 이곳에서 다시 볼 수 있어요.',
      badge: `${questions.length}개`,
      Icon: MessageSquareText,
      content: <QuestionList items={questions} />,
    },
  ]

  return (
    <section className={styles.section} aria-label="나의 블로그 활동">
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>블로그 활동</p>
          <h2>나의 블로그 활동</h2>
        </div>
        <PlatformBadge tone="neutral">마이페이지 통합</PlatformBadge>
      </div>
      <div className={styles.grid}>
        {activityItems.map(({ key, title, description, badge, Icon, content }) => (
          <PlatformCard key={key} as="article" variant="subtle" className={styles.item}>
            <div className={styles.itemTopline}>
              <span className={styles.iconWrap}>
                <Icon size={20} aria-hidden="true" strokeWidth={1.8} />
              </span>
              <PlatformBadge tone="neutral">{badge}</PlatformBadge>
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            {content}
          </PlatformCard>
        ))}
      </div>
    </section>
  )
}
