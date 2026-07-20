'use client'

import { useState, useTransition, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowUp, FilePlus2, Plus, Trash2 } from 'lucide-react'
import { PlatformButton } from '@/components/platform/ui/PlatformButton'
import { PlatformEditorSection } from '@/components/platform/ui/PlatformEditorSection'
import { PlatformField } from '@/components/platform/ui/PlatformField'
import { PlatformIconButton } from '@/components/platform/ui/PlatformIconButton'
import { PlatformLinkButton } from '@/components/platform/ui/PlatformLinkButton'
import { PlatformSelect } from '@/components/platform/ui/PlatformSelect'
import { PlatformToolbar } from '@/components/platform/ui/PlatformToolbar'
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

const BLOCK_SELECT_OPTIONS = BLOCK_OPTIONS.map(option => ({ ...option, label: `${option.label} 블록` }))
const HEADING_LEVEL_OPTIONS = [{ value: '2', label: 'H2' }, { value: '3', label: 'H3' }]

function makeBlock(id: number, type: ApprovedManuscriptBlockType): EditableBlock {
  return {
    id,
    type,
    headingLevel: 2,
    text: '',
    answer: '',
  }
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
  const [nextBlockId, setNextBlockId] = useState(2)
  const [blockTypeToAdd, setBlockTypeToAdd] = useState<ApprovedManuscriptBlockType>('paragraph')
  const [blocks, setBlocks] = useState<EditableBlock[]>([makeBlock(1, 'paragraph')])
  const [feedback, setFeedback] = useState('')

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
        <PlatformLinkButton href="/admin/platform/blog" variant="secondary" size="sm" className={styles.queueLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          콘텐츠 큐로 돌아가기
        </PlatformLinkButton>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <PlatformEditorSection title="기본 정보" disabled={isPending}>
          <div className={styles.fieldGrid}>
            <PlatformField label="제목" value={title} onChange={event => setTitle(event.target.value)} required />
            <PlatformField
              label="slug"
              value={slug}
              onChange={event => setSlug(event.target.value)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="english-lowercase-slug"
              hint="영문 소문자, 숫자, 하이픈만 사용합니다."
              required
            />
            <PlatformSelect
              label="카테고리"
              value={category}
              onChange={event => setCategory(event.target.value as ApprovedManuscriptCategory)}
              options={CATEGORY_OPTIONS}
            />
            <PlatformField label="핵심 키워드" value={primaryKeyword} onChange={event => setPrimaryKeyword(event.target.value)} />
            <PlatformField className={styles.fieldWide} label="요약" multiline value={excerpt} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setExcerpt(event.target.value)} rows={3} required />
          </div>
        </PlatformEditorSection>

        <PlatformEditorSection title="검색·질문 정보" disabled={isPending}>
          <div className={styles.fieldGrid}>
            <PlatformField className={styles.fieldWide} label="SEO 제목" value={seoTitle} onChange={event => setSeoTitle(event.target.value)} required />
            <PlatformField className={styles.fieldWide} label="메타 설명" multiline value={metaDescription} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMetaDescription(event.target.value)} rows={3} required />
            <PlatformField className={styles.fieldWide} label="대상 질문" value={targetQuestion} onChange={event => setTargetQuestion(event.target.value)} required />
            <PlatformField className={styles.fieldWide} label="요약 답변" multiline value={summaryAnswer} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setSummaryAnswer(event.target.value)} rows={3} required />
            <PlatformField
              className={styles.fieldWide}
              label="관련 질문"
              multiline
              value={relatedQuestions}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setRelatedQuestions(event.target.value)}
              rows={3}
              placeholder="질문 하나를 한 줄에 입력하세요."
            />
            <PlatformField label="서비스 지역" value={serviceArea} onChange={event => setServiceArea(event.target.value)} />
            <PlatformField label="제품군" value={productType} onChange={event => setProductType(event.target.value)} />
          </div>
        </PlatformEditorSection>

        <PlatformEditorSection
          title="본문 블록"
          description="이미지 블록은 여기서 등록하지 않습니다. 원고 등록 뒤 기존 에디터에서 승인된 사진을 연결하세요."
          disabled={isPending}
        >

          <div className={styles.blockControls}>
            <PlatformSelect
              label="추가할 블록 유형"
              containerClassName={styles.compactField}
              value={blockTypeToAdd}
              onChange={event => setBlockTypeToAdd(event.target.value as ApprovedManuscriptBlockType)}
              options={BLOCK_SELECT_OPTIONS}
            />
            <PlatformButton type="button" variant="secondary" className={styles.addBlockButton} onClick={addBlock}>
              <Plus size={16} aria-hidden="true" />
              블록 추가
            </PlatformButton>
          </div>

          <ol className={styles.blockList}>
            {blocks.map((block, index) => (
              <li key={block.id} className={styles.blockCard}>
                <div className={styles.blockHeader}>
                  <strong>{index + 1}. {BLOCK_OPTIONS.find(option => option.value === block.type)?.label} 블록</strong>
                  <PlatformToolbar label={`${index + 1}번 블록 작업`} className={styles.blockActions}>
                    <PlatformIconButton
                      type="button"
                      onClick={() => moveBlock(block.id, -1)}
                      disabled={index === 0}
                      aria-label={`${index + 1}번 블록 위로 이동`}
                    >
                      <ArrowUp size={16} aria-hidden="true" />
                    </PlatformIconButton>
                    <PlatformIconButton
                      type="button"
                      onClick={() => moveBlock(block.id, 1)}
                      disabled={index === blocks.length - 1}
                      aria-label={`${index + 1}번 블록 아래로 이동`}
                    >
                      <ArrowDown size={16} aria-hidden="true" />
                    </PlatformIconButton>
                    <PlatformIconButton
                      type="button"
                      variant="danger"
                      onClick={() => removeBlock(block.id)}
                      disabled={blocks.length === 1}
                      aria-label={`${index + 1}번 블록 삭제`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </PlatformIconButton>
                  </PlatformToolbar>
                </div>

                {block.type === 'heading' && (
                  <PlatformSelect
                    label="제목 수준"
                    value={String(block.headingLevel)}
                    onChange={event => updateBlock(block.id, { headingLevel: Number(event.target.value) as 2 | 3 })}
                    options={HEADING_LEVEL_OPTIONS}
                  />
                )}

                <PlatformField
                  label={blockTextLabel(block.type)}
                  multiline
                  value={block.text}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateBlock(block.id, { text: event.target.value })}
                  rows={block.type === 'paragraph' ? 5 : 3}
                  required
                />

                {block.type === 'qa' && (
                  <PlatformField
                    label="답변"
                    multiline
                    value={block.answer}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateBlock(block.id, { answer: event.target.value })}
                    rows={4}
                    required
                  />
                )}
              </li>
            ))}
          </ol>
        </PlatformEditorSection>

        <div className={styles.submitRow}>
          <p className={styles.feedback} aria-live="polite">{feedback}</p>
          <PlatformButton type="submit" className={styles.submitButton} disabled={isPending} isLoading={isPending} loadingLabel="등록 중…">
            <FilePlus2 size={17} aria-hidden="true" />
            승인 원고 등록
          </PlatformButton>
        </div>
      </form>
    </main>
  )
}
