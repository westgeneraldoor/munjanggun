'use client'

import Link from 'next/link'
import { ArrowLeft, Newspaper, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import styles from './BlogReadingTopBar.module.css'

const TOP_HIDE_THRESHOLD = 96
const SCROLL_DELTA = 8

export default function BlogReadingTopBar() {
  const [visible, setVisible] = useState(false)
  const lastScrollY = useRef(0)
  const hiddenLinkTabIndex = visible ? undefined : -1

  useEffect(() => {
    let frameId: number | null = null

    const syncVisibility = () => {
      const currentY = window.scrollY
      const delta = currentY - lastScrollY.current

      if (currentY < TOP_HIDE_THRESHOLD) {
        setVisible(false)
      } else if (delta < -SCROLL_DELTA) {
        setVisible(true)
      } else if (delta > SCROLL_DELTA) {
        setVisible(false)
      }

      lastScrollY.current = currentY
      frameId = null
    }

    const handleScroll = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(syncVisibility)
    }

    lastScrollY.current = window.scrollY
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (frameId !== null) window.cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <nav
      className={styles.bar}
      aria-label="글 읽기 상단 메뉴"
      data-visible={visible ? 'true' : 'false'}
      aria-hidden={visible ? undefined : true}
      onFocus={() => setVisible(true)}
    >
      <Link href="/blog" className={styles.iconLink} aria-label="블로그로 돌아가기" tabIndex={hiddenLinkTabIndex}>
        <ArrowLeft size={19} aria-hidden="true" />
      </Link>
      <Link href="/blog" className={styles.homeLink} aria-label="문장군 블로그 홈" tabIndex={hiddenLinkTabIndex}>
        <Newspaper size={17} aria-hidden="true" />
        <span>문장군 블로그</span>
      </Link>
      <Link href="/portal" className={styles.iconLink} aria-label="마이페이지로 이동" tabIndex={hiddenLinkTabIndex}>
        <UserRound size={19} aria-hidden="true" />
      </Link>
    </nav>
  )
}
