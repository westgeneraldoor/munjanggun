'use client'

import { ArrowRight, CheckCircle2, Ruler } from 'lucide-react'
import { useState } from 'react'
import styles from './BlogConditionChecklist.module.css'

type ChecklistItem = {
  id: string
  label: string
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'width', label: '문을 놓을 자리의 폭을 대략 알고 있어요' },
  { id: 'switch', label: '신발장, 스위치, 콘센트 위치가 걱정돼요' },
  { id: 'safety', label: '아이 동선 때문에 안전성이 중요해요' },
  { id: 'sound', label: '소음 차단이나 냉난방 분리가 필요해요' },
  { id: 'care', label: '청소와 관리가 쉬운 쪽이 좋아요' },
]

function scrollToConsultation() {
  const target = document.getElementById('article-final-cta') ?? document.getElementById('blog-question-panel')
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export default function BlogConditionChecklist({ question }: { question: string | null }) {
  const [checkedItems, setCheckedItems] = useState<string[]>([])
  const hasCheckedItems = checkedItems.length > 0

  function toggleItem(id: string) {
    setCheckedItems(items => (
      items.includes(id) ? items.filter(item => item !== id) : [...items, id]
    ))
  }

  return (
    <section id="article-checklist" className={styles.checklist} aria-labelledby="article-checklist-title">
      <div className={styles.copy}>
        <span>
          <Ruler size={16} aria-hidden="true" />
          우리 집 조건 체크
        </span>
        <h2 id="article-checklist-title">읽기 전에 우리 집 조건을 표시해보세요</h2>
        <p>{question || '정확한 판단은 실측에서 함께 확인하지만, 먼저 떠오르는 조건을 체크해두면 상담이 훨씬 쉬워집니다.'}</p>
      </div>

      <div className={styles.items}>
        {CHECKLIST_ITEMS.map(item => {
          const checked = checkedItems.includes(item.id)
          return (
            <label key={item.id} className={styles.item}>
              <span className={styles.checkbox} data-checked={checked ? 'true' : 'false'}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleItem(item.id)}
                />
                <CheckCircle2 size={17} aria-hidden="true" />
              </span>
              <span>{item.label}</span>
            </label>
          )
        })}
      </div>

      <div className={styles.result}>
        <p>
          {hasCheckedItems
            ? '체크한 항목은 방문실측 때 구조와 옵션을 함께 확인하면 좋습니다.'
            : '아직 잘 몰라도 괜찮습니다. 현장에서 폭, 단차, 주변 구조부터 같이 봅니다.'}
        </p>
        <button type="button" onClick={scrollToConsultation}>
          상담에서 이어 보기
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
