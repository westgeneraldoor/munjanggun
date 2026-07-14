'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowUp, FilePlus2, Plus, Trash2 } from 'lucide-react'
import { createApprovedManuscript } from '../manuscript-actions'
import type {
  ApprovedManuscriptBlockType,
  ApprovedManuscriptCategory,
} from '@/lib/content-os/approved-manuscript'
import styles from './approved-manuscript-intake.module.css'

type EditableBlock = {
  id: number
  type: ApprovedManuscriptBlockType
  headingLevel: 2 | 3
  text: string
  answer: string
}

type EditableEvidence = {
  id: number
  reference: string
  status: 'vetted' | 'publishable'
  checkedAt: string
}

const CATEGORY_OPTIONS: Array<{ value: ApprovedManuscriptCategory; label: string }> = [
  { value: 'case_study', label: '시공사례' },
  { value: 'product_guide', label: '제품가이드' },
  { value: 'customer_qa', label: '고객 Q&A' },
  { value: 'field_knowhow', label: '현장 노하우' },
  { value: 'price_guide', label: '가격/견적' },
  { value: 'area_guide', label: '지역안내' },
]

const BLOCK_OPTIONS: Array<{ value: ApprovedManuscriptBlockType; label: string }> = [
  { value: 'heading', label: '제목' },
  { value: 'paragraph', label: '문단' },
  { value: 'qa', label: 'Q&A' },
  { value: 'cta', label: 'CTA' },
]

function makeBlock(id: number, type: ApprovedManuscriptBlockType): EditableBlock {
  return {
    id,
    type,
    headingLevel: 2,
    text: '',
    answer: '',
  }
}

function makeEvidence(id: number): EditableEvidence {
  return { id, reference: '', status: 'vetted', checkedAt: '' }
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

function blockTextLabel(type: ApprovedManuscriptBlockType) {
  if (type === 'heading') return '제목'
  if (type === 'qa') return '질문'
  if (type === 'cta') return 'CTA 문구'
  return '본문'
}

export default function ApprovedManuscriptIntakeClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [category, setCategory] = useState<ApprovedManuscriptCategory>('product_guide')
  const [primaryKeyword, setPrimaryKeyword] = useState('')
  const [targetQuestion, setTargetQuestion] = useState('')
  const [summaryAnswer, setSummaryAnswer] = useState('')
  const [relatedQuestions, setRelatedQuestions] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [productType, setProductType] = useState('')
  const [nextEvidenceId, setNextEvidenceId] = useState(2)
  const [evidenceRows, setEvidenceRows] = useState<EditableEvidence[]>([makeEvidence(1)])
  const [nextBlockId, setNextBlockId] = useState(2)
  const [blockTypeToAdd, setBlockTypeToAdd] = useState<ApprovedManuscriptBlockType>('paragraph')
  const [blocks, setBlocks] = useState<EditableBlock[]>([makeBlock(1, 'paragraph')])
  const [feedback, setFeedback] = useState('')

  const updateEvidence = (id: number, update: Partial<EditableEvidence>) => {
    setEvidenceRows(current => current.map(row => (row.id === id ? { ...row, ...update } : row)))
  }

  const addEvidence = () => {
    setEvidenceRows(current => [...current, makeEvidence(nextEvidenceId)])
    setNextEvidenceId(current => current + 1)
  }

  const removeEvidence = (id: number) => {
    setEvidenceRows(current => (current.length > 1 ? current.filter(row => row.id !== id) : current))
  }

  const updateBlock = (id: number, update: Partial<EditableBlock>) => {
    setBlocks(current => current.map(block => (block.id === id ? { ...block, ...update } : block)))
  }

  const addBlock = () => {
    setBlocks(current => [...current, makeBlock(nextBlockId, blockTypeToAdd)])
    setNextBlockId(current => current + 1)
  }

  const removeBlock = (id: number) => {
    setBlocks(current => (current.length > 1 ? current.filter(block => block.id !== id) : current))
  }

  const moveBlock = (id: number, direction: -1 | 1) => {
    setBlocks(current => {
      const index = current.findIndex(block => block.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current

      const next = [...current]
      const [block] = next.splice(index, 1)
      next.splice(nextIndex, 0, block)
      return next
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback('')

    startTransition(async () => {
      try {
        const result = await createApprovedManuscript({
          title,
          slug,
          excerpt,
          seoTitle,
          metaDescription,
          category,
          primaryKeyword,
          targetQuestion,
          summaryAnswer,
          relatedQuestions: splitLines(relatedQuestions),
          serviceArea,
          productType,
          sourceEvidence: evidenceRows.map(row => ({
            claim_id: row.reference,
            status: row.status,
            checked_at: row.checkedAt,
          })),
          blocks: blocks.map(block => ({
            type: block.type,
            headingLevel: block.type === 'heading' ? block.headingLevel : null,
            text: block.text,
            metadata: block.type === 'qa' ? { answer: block.answer } : {},
          })),
        })

        if (result.ok && result.postId) {
          router.replace(`/admin/platform/blog/${result.postId}`)
          return
        }

        setFeedback(result.message || '승인 원고를 등록하지 못했습니다. 입력값을 확인해 주세요.')
      } catch {
        setFeedback('승인 원고를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>콘텐츠 큐 등록</p>
          <h1>승인 원고 등록</h1>
          <p>외부에서 완성한 원고를 검토중 상태로 등록합니다. 사진 연결과 발행은 기존 에디터에서 이어서 처리합니다.</p>
        </div>
        <Link href="/admin/platform/blog" className={styles.queueLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          콘텐츠 큐로 돌아가기
        </Link>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <fieldset className={styles.section} disabled={isPending}>
          <legend>기본 정보</legend>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>제목</span>
              <input value={title} onChange={event => setTitle(event.target.value)} required />
            </label>
            <label className={styles.field}>
              <span>slug</span>
              <input
                value={slug}
                onChange={event => setSlug(event.target.value)}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="english-lowercase-slug"
                required
              />
              <small>영문 소문자, 숫자, 하이픈만 사용합니다.</small>
            </label>
            <label className={styles.field}>
              <span>카테고리</span>
              <select value={category} onChange={event => setCategory(event.target.value as ApprovedManuscriptCategory)}>
                {CATEGORY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>핵심 키워드</span>
              <input value={primaryKeyword} onChange={event => setPrimaryKeyword(event.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>요약</span>
              <textarea value={excerpt} onChange={event => setExcerpt(event.target.value)} rows={3} required />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.section} disabled={isPending}>
          <legend>검색·질문 정보</legend>
          <div className={styles.fieldGrid}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>SEO 제목</span>
              <input value={seoTitle} onChange={event => setSeoTitle(event.target.value)} required />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>메타 설명</span>
              <textarea value={metaDescription} onChange={event => setMetaDescription(event.target.value)} rows={3} required />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>대상 질문</span>
              <input value={targetQuestion} onChange={event => setTargetQuestion(event.target.value)} required />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>요약 답변</span>
              <textarea value={summaryAnswer} onChange={event => setSummaryAnswer(event.target.value)} rows={3} required />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>관련 질문</span>
              <textarea
                value={relatedQuestions}
                onChange={event => setRelatedQuestions(event.target.value)}
                rows={3}
                placeholder="질문 하나를 한 줄에 입력하세요."
              />
            </label>
            <label className={styles.field}>
              <span>서비스 지역</span>
              <input value={serviceArea} onChange={event => setServiceArea(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>제품군</span>
              <input value={productType} onChange={event => setProductType(event.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.section} disabled={isPending}>
          <legend>근거</legend>
          <p className={styles.sectionHint}>원고에 사용한 근거를 모두 입력합니다. 확인이 끝난 vetted 또는 publishable 근거만 승인 원고로 등록할 수 있습니다.</p>
          {evidenceRows.map((row, index) => (
            <div className={styles.fieldGrid} key={row.id}>
              <label className={styles.field}>
                <span>근거 ID {index + 1}</span>
                <input value={row.reference} onChange={event => updateEvidence(row.id, { reference: event.target.value })} required />
              </label>
              <label className={styles.field}>
                <span>근거 상태</span>
                <select value={row.status} onChange={event => updateEvidence(row.id, { status: event.target.value as EditableEvidence['status'] })}>
                  <option value="vetted">vetted</option>
                  <option value="publishable">publishable</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>확인일</span>
                <input type="date" value={row.checkedAt} onChange={event => updateEvidence(row.id, { checkedAt: event.target.value })} />
              </label>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => removeEvidence(row.id)}
                disabled={evidenceRows.length === 1}
                aria-label={`${index + 1}번 근거 삭제`}
              >
                <Trash2 size={16} aria-hidden="true" />
                근거 삭제
              </button>
            </div>
          ))}
          <button type="button" className={styles.secondaryButton} onClick={addEvidence}>
            <Plus size={16} aria-hidden="true" />
            근거 추가
          </button>
        </fieldset>

        <fieldset className={styles.section} disabled={isPending}>
          <legend>본문 블록</legend>
          <p className={styles.sectionHint}>이미지 블록은 여기서 등록하지 않습니다. 원고 등록 뒤 기존 에디터에서 승인된 사진을 연결하세요.</p>

          <div className={styles.blockControls}>
            <label className={styles.compactField}>
              <span className={styles.srOnly}>추가할 블록 유형</span>
              <select value={blockTypeToAdd} onChange={event => setBlockTypeToAdd(event.target.value as ApprovedManuscriptBlockType)}>
                {BLOCK_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label} 블록</option>
                ))}
              </select>
            </label>
            <button type="button" className={styles.secondaryButton} onClick={addBlock}>
              <Plus size={16} aria-hidden="true" />
              블록 추가
            </button>
          </div>

          <ol className={styles.blockList}>
            {blocks.map((block, index) => (
              <li key={block.id} className={styles.blockCard}>
                <div className={styles.blockHeader}>
                  <strong>{index + 1}. {BLOCK_OPTIONS.find(option => option.value === block.type)?.label} 블록</strong>
                  <div className={styles.blockActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => moveBlock(block.id, -1)}
                      disabled={index === 0}
                      aria-label={`${index + 1}번 블록 위로 이동`}
                    >
                      <ArrowUp size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => moveBlock(block.id, 1)}
                      disabled={index === blocks.length - 1}
                      aria-label={`${index + 1}번 블록 아래로 이동`}
                    >
                      <ArrowDown size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => removeBlock(block.id)}
                      disabled={blocks.length === 1}
                      aria-label={`${index + 1}번 블록 삭제`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {block.type === 'heading' && (
                  <label className={styles.field}>
                    <span>제목 수준</span>
                    <select
                      value={block.headingLevel}
                      onChange={event => updateBlock(block.id, { headingLevel: Number(event.target.value) as 2 | 3 })}
                    >
                      <option value={2}>H2</option>
                      <option value={3}>H3</option>
                    </select>
                  </label>
                )}

                <label className={styles.field}>
                  <span>{blockTextLabel(block.type)}</span>
                  <textarea
                    value={block.text}
                    onChange={event => updateBlock(block.id, { text: event.target.value })}
                    rows={block.type === 'paragraph' ? 5 : 3}
                    required
                  />
                </label>

                {block.type === 'qa' && (
                  <label className={styles.field}>
                    <span>답변</span>
                    <textarea
                      value={block.answer}
                      onChange={event => updateBlock(block.id, { answer: event.target.value })}
                      rows={4}
                      required
                    />
                  </label>
                )}
              </li>
            ))}
          </ol>
        </fieldset>

        <div className={styles.submitRow}>
          <p className={styles.feedback} aria-live="polite">{feedback}</p>
          <button type="submit" className={styles.primaryButton} disabled={isPending}>
            <FilePlus2 size={17} aria-hidden="true" />
            {isPending ? '등록 중…' : '승인 원고 등록'}
          </button>
        </div>
      </form>
    </main>
  )
}
