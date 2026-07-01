import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, HelpCircle, Info, MapPin } from 'lucide-react'
import { normalizeGuideBoxBlock, normalizeLinkButtonBlock } from '@/lib/content-os/blog-body-blocks'
import type { BlogRelatedPost, BlogRenderBlock, BlogRenderData, BlogRenderMedia, BlogRenderMode } from '@/lib/content-os/blog-rendering'
import BlogArticleActions from './BlogArticleActions'
import styles from './BlogPostRenderer.module.css'

const CATEGORY_LABEL: Record<string, string> = {
  case_study: '시공 사례',
  product_guide: '제품 가이드',
  customer_qa: '고객 Q&A',
  field_knowhow: '현장 노하우',
  price_guide: '견적 가이드',
  area_guide: '지역 안내',
}

const HERO_PROOFS = [
  '무료 방문실측',
  '집 구조 확인',
  '직접 제작·전속 시공',
]

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

function cleanQaQuestion(value: string | null | undefined) {
  return (value ?? '')
    .replace(/^(\s*(?:Q|질문)\s*[.:：)]\s*)+/i, '')
    .split(/\s+(?:A|답변)\s*[.:：)]\s*/i)[0]
    ?.trim() ?? ''
}

function cleanQaAnswer(value: string | null | undefined) {
  return (value ?? '').replace(/^(\s*(?:A|답변)\s*[.:：)]\s*)+/i, '').trim()
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

function CtaBlock({ text, final = false }: { text: string | null; final?: boolean }) {
  return (
    <aside className={`${styles.ctaBlock} ${final ? styles.finalCtaBlock : ''}`}>
      <div>
        <span>무료 방문실측으로 확인</span>
        <strong>{text?.trim() || '문 종류를 정하기 전에, 우리 집 구조와 시공 조건부터 같이 확인해드립니다.'}</strong>
      </div>
      <Link href="/portal/measure/new" aria-label="무료 방문실측으로 우리 집 조건 확인하기">
        우리 집 조건 확인하기
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </aside>
  )
}

function LinkButtonBlock({ block }: { block: BlogRenderBlock }) {
  const link = normalizeLinkButtonBlock(block)
  if (!link) return null

  return (
    <aside className={styles.linkButtonBlock}>
      <div>
        <span>이어 확인하기</span>
        {link.description && <p>{link.description}</p>}
      </div>
      <Link href={link.href}>
        {link.label}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </aside>
  )
}

function GuideBoxBlock({ block }: { block: BlogRenderBlock }) {
  const guide = normalizeGuideBoxBlock(block)
  if (!guide) return null
  const Icon = guide.tone === 'caution' ? AlertTriangle : Info

  return (
    <aside className={`${styles.guideBox} ${styles[`guideBox_${guide.tone}`]}`}>
      <div className={styles.guideBoxLabel}>
        <Icon size={17} aria-hidden="true" />
        <span>{guide.label}</span>
      </div>
      {guide.title && <strong>{guide.title}</strong>}
      <div className={styles.guideBoxBody}>
        {splitParagraphs(guide.body).map(paragraph => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </aside>
  )
}

function RelatedPostCard({ post }: { post: BlogRelatedPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className={styles.relatedPostCard}>
      {post.coverMedia?.url && (
        <span className={styles.relatedPostImage}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverMedia.url} alt={post.coverMedia.altText || post.title} />
        </span>
      )}
      <span className={styles.relatedPostBody}>
        <span className={styles.relatedPostMeta}>
          {post.relationLabel}
          <span aria-hidden="true">·</span>
          {CATEGORY_LABEL[post.category] ?? post.category}
        </span>
        <strong>{post.title}</strong>
        {post.relationReason && <span className={styles.relatedPostReason}>{post.relationReason}</span>}
        {post.targetQuestion && <span className={styles.relatedPostQuestion}>{post.targetQuestion}</span>}
        <span className={styles.relatedPostAction}>
          이어서 읽기
          <ArrowRight size={15} aria-hidden="true" />
        </span>
      </span>
    </Link>
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

  if (block.type === 'link_button') {
    return <LinkButtonBlock block={block} />
  }

  if (block.type === 'guide_box') {
    return <GuideBoxBlock block={block} />
  }

  if (block.type === 'qa') {
    const question = cleanQaQuestion(block.text)
    const answer = cleanQaAnswer(block.metadata.answer || block.metadata.qa_answer)
    if (!question && !answer) return null
    block = { ...block, text: question || '자주 묻는 질문' }
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
  const { post, blocks, media, contentGraphSections, relatedPosts, nextPost } = data
  const publishedDate = formatDate(post.publishedAt)
  const updatedDate = formatDate(post.updatedAt)
  const cover = media.find(item => item.usedAsCover && item.url) ?? null
  const mediaMap = mediaById(media.filter(item => item.usageStatus !== 'rejected'))
  const hasCtaBlock = blocks.some(block => block.type === 'cta')
  const visibleContentGraphSections = contentGraphSections.filter(section => section.posts.length > 0)
  const fallbackRelatedPosts = visibleContentGraphSections.length === 0 ? relatedPosts : []
  const hasReadingPath = visibleContentGraphSections.length > 0 || fallbackRelatedPosts.length > 0 || Boolean(nextPost)

  return (
    <main className={`${styles.page} ${mode === 'preview' ? styles.previewPage : ''}`}>
      {mode === 'preview' && (
        <div className={styles.previewBanner}>
          <strong>미리보기 모드</strong>
          <span>검색에 노출되지 않는 관리자 확인용 화면입니다.</span>
        </div>
      )}

      <article className={styles.article}>
        {mode === 'public' && (
          <Link href="/blog" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            블로그로 돌아가기
          </Link>
        )}

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
            <div className={styles.heroProofRow} aria-label="문장군 확인 기준">
              {HERO_PROOFS.map(item => (
                <span key={item}>
                  <CheckCircle2 size={15} aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {cover && (
            <div className={styles.coverWrap}>
              <BlogImage media={cover} preview={mode === 'preview'} showCaption={false} />
            </div>
          )}
        </header>

        <div className={styles.content}>
          {post.excerpt && (
            <section className={styles.excerpt} aria-label="먼저 확인할 핵심">
              <span>먼저 확인할 핵심</span>
              <p>{post.excerpt}</p>
            </section>
          )}

          {blocks.length === 0 ? (
            <div className={styles.emptyBody}>아직 공개할 본문이 준비되지 않았습니다. 다른 글을 먼저 살펴보세요.</div>
          ) : (
            blocks.map(block => (
              <RenderBlock key={block.id} block={block} mediaMap={mediaMap} mode={mode} />
            ))
          )}

          {post.relatedQuestions.length > 0 && (
            <section className={styles.relatedQuestions}>
              <h2>다음으로 많이 묻는 질문</h2>
              <p>가격과 시공 가능 여부는 집 구조, 사이즈, 옵션에 따라 달라질 수 있습니다.</p>
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

          {hasReadingPath && (
            <section className={styles.readingPath} aria-labelledby="reading-path-title">
              <div className={styles.readingPathHeader}>
                <span>이어 읽기</span>
                <h2 id="reading-path-title">이 글 다음에 보면 좋은 길</h2>
                <p>제품군, 현장 조건, 고객 질문이 가까운 글을 묶어서 볼 수 있게 정리했습니다.</p>
              </div>

              {visibleContentGraphSections.map(section => (
                <section key={section.id} className={styles.contentGraphSection} aria-labelledby={`content-graph-${section.id}`}>
                  <div className={styles.contentGraphSectionHeader}>
                    <h3 id={`content-graph-${section.id}`}>{section.title}</h3>
                    <p>{section.description}</p>
                  </div>
                  <div className={styles.relatedPostGrid}>
                    {section.posts.map(item => (
                      <RelatedPostCard key={item.id} post={item} />
                    ))}
                  </div>
                </section>
              ))}

              {fallbackRelatedPosts.length > 0 && (
                <div className={styles.relatedPostGrid}>
                  {fallbackRelatedPosts.map(item => (
                    <RelatedPostCard key={item.id} post={item} />
                  ))}
                </div>
              )}

              {nextPost && (
                <Link href={`/blog/${nextPost.slug}`} className={styles.nextPostLink}>
                  <span>다음 글</span>
                  <strong>{nextPost.title}</strong>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </section>
          )}

          {mode === 'public' && (
            <BlogArticleActions postSlug={post.slug} postTitle={post.title} />
          )}

          {(!hasCtaBlock || hasReadingPath) && (
            <CtaBlock text={null} final />
          )}
        </div>
      </article>
    </main>
  )
}
