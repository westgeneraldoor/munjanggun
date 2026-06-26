import Link from 'next/link'
import { ArrowRight, CheckCircle2, HelpCircle, MapPin } from 'lucide-react'
import type { BlogRenderBlock, BlogRenderData, BlogRenderMedia, BlogRenderMode } from '@/lib/content-os/blog-rendering'
import styles from './BlogPostRenderer.module.css'

const CATEGORY_LABEL: Record<string, string> = {
  case_study: '시공 사례',
  product_guide: '제품 가이드',
  customer_qa: '고객 Q&A',
  field_knowhow: '현장 노하우',
  price_guide: '견적 가이드',
  area_guide: '지역 안내',
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value))
}

function splitParagraphs(text: string) {
  return text.split(/\n{2,}/).map(item => item.trim()).filter(Boolean)
}

function mediaById(media: BlogRenderMedia[]) {
  return new Map(media.map(item => [item.id, item]))
}

function BlogImage({
  media,
  preview,
  showCaption = true,
}: {
  media: BlogRenderMedia
  preview: boolean
  showCaption?: boolean
}) {
  if (!media.url) {
    if (!preview) return null
    return <div className={styles.previewMissing}>미리보기 이미지 URL을 만들 수 없습니다.</div>
  }

  return (
    <figure className={styles.figure}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media.url} alt={media.altText || media.sourceLabel || '문장군 블로그 이미지'} className={styles.image} />
      {showCaption && media.caption && <figcaption>{media.caption}</figcaption>}
    </figure>
  )
}

function CtaBlock({ text }: { text: string | null }) {
  return (
    <aside className={styles.ctaBlock}>
      <div>
        <span>무료 방문 실측견적 상담</span>
        <strong>{text?.trim() || '우리 집에 맞는 문과 시공 조건을 먼저 확인해보세요.'}</strong>
      </div>
      <Link href="/portal/measure/new">
        상담 신청
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </aside>
  )
}

function RenderBlock({
  block,
  mediaMap,
  mode,
}: {
  block: BlogRenderBlock
  mediaMap: Map<string, BlogRenderMedia>
  mode: BlogRenderMode
}) {
  if (block.type === 'heading') {
    if (!block.text?.trim()) return null
    if (block.headingLevel === 3) return <h3 className={styles.headingBlock}>{block.text}</h3>
    if (block.headingLevel === 4) return <h4 className={styles.headingBlock}>{block.text}</h4>
    return <h2 className={styles.headingBlock}>{block.text}</h2>
  }

  if (block.type === 'paragraph') {
    if (!block.text?.trim()) return null
    return (
      <div className={styles.paragraphBlock}>
        {splitParagraphs(block.text).map(paragraph => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    )
  }

  if (block.type === 'image') {
    const media = block.mediaId ? mediaMap.get(block.mediaId) : null
    if (!media || media.usageStatus === 'rejected') {
      if (mode !== 'preview') return null
      return (
        <div className={styles.previewMissing}>
          이 사진 자리는 아직 미리보기로 표시할 사진이 없습니다.
        </div>
      )
    }

    return <BlogImage media={media} preview={mode === 'preview'} />
  }

  if (block.type === 'qa') {
    const answer = block.metadata.answer || block.metadata.qa_answer
    if (!block.text?.trim() && !answer?.trim()) return null
    return (
      <section className={styles.qaBlock}>
        <div className={styles.qaQuestion}>
          <HelpCircle size={18} aria-hidden="true" />
          <h2>{block.text || '자주 묻는 질문'}</h2>
        </div>
        {answer && <p>{answer}</p>}
      </section>
    )
  }

  if (block.type === 'cta') {
    return <CtaBlock text={block.text} />
  }

  return null
}

export default function BlogPostRenderer({
  data,
  mode,
}: {
  data: BlogRenderData
  mode: BlogRenderMode
}) {
  const { post, blocks, media } = data
  const publishedDate = formatDate(post.publishedAt)
  const updatedDate = formatDate(post.updatedAt)
  const cover = media.find(item => item.usedAsCover && item.url) ?? null
  const mediaMap = mediaById(media.filter(item => item.usageStatus !== 'rejected'))

  return (
    <main className={`${styles.page} ${mode === 'preview' ? styles.previewPage : ''}`}>
      {mode === 'preview' && (
        <div className={styles.previewBanner}>
          <strong>미리보기 모드</strong>
          <span>검색에 노출되지 않는 관리자 확인용 화면입니다.</span>
        </div>
      )}

      <article className={styles.article}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <div className={styles.metaRow}>
              <span>{CATEGORY_LABEL[post.category] ?? post.category}</span>
              {post.serviceArea && (
                <span>
                  <MapPin size={14} aria-hidden="true" />
                  {post.serviceArea}
                </span>
              )}
              {publishedDate && <time dateTime={post.publishedAt ?? undefined}>{publishedDate}</time>}
              {!publishedDate && updatedDate && <time dateTime={post.updatedAt}>업데이트 {updatedDate}</time>}
            </div>
            <h1>{post.title}</h1>
            {post.targetQuestion && <p className={styles.question}>{post.targetQuestion}</p>}
            {post.summaryAnswer && <p className={styles.summary}>{post.summaryAnswer}</p>}
            <div className={styles.keywordRow}>
              {post.primaryKeyword && <span>{post.primaryKeyword}</span>}
              {post.productType && <span>{post.productType}</span>}
            </div>
          </div>

          {cover && (
            <div className={styles.coverWrap}>
              <BlogImage media={cover} preview={mode === 'preview'} showCaption={false} />
            </div>
          )}
        </header>

        <div className={styles.content}>
          {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}

          {blocks.length === 0 ? (
            <div className={styles.emptyBody}>아직 렌더링할 본문 블록이 없습니다.</div>
          ) : (
            blocks.map(block => (
              <RenderBlock key={block.id} block={block} mediaMap={mediaMap} mode={mode} />
            ))
          )}

          {post.relatedQuestions.length > 0 && (
            <section className={styles.relatedQuestions}>
              <h2>함께 확인할 질문</h2>
              <ul>
                {post.relatedQuestions.map(question => (
                  <li key={question}>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>
      </article>
    </main>
  )
}
