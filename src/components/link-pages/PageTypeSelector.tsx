'use client'

import { Compass, CornerDownRight } from 'lucide-react'
import type { LinkPageRole } from '@/lib/link-pages/model'
import styles from './PageTypeSelector.module.css'

type PageTypeSelectorProps = {
  onSelect: (role: LinkPageRole) => void
}

export function PageTypeSelector({ onSelect }: PageTypeSelectorProps) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.lead}>이 페이지를 고객이 어떻게 찾게 할지 먼저 선택하세요.</p>
      <div className={styles.options}>
        <button type="button" onClick={() => onSelect('navigation')}>
          <span className={styles.icon}><Compass aria-hidden="true" /></span>
          <span className={styles.copy}>
            <strong>네비게이션 페이지</strong>
            <small>공개 페이지 상단 메뉴에 노출되는 독립 페이지</small>
          </span>
        </button>
        <button type="button" onClick={() => onSelect('child')}>
          <span className={styles.icon}><CornerDownRight aria-hidden="true" /></span>
          <span className={styles.copy}>
            <strong>자식 페이지</strong>
            <small>상위 페이지에 연결되지만 상단 메뉴에는 자동 노출되지 않는 자료 페이지</small>
          </span>
        </button>
      </div>
    </div>
  )
}
