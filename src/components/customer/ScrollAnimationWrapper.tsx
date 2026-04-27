'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './ScrollAnimationWrapper.module.css'

interface ScrollAnimationWrapperProps {
  children: React.ReactNode
  delay?: number // ms
  className?: string
}

export default function ScrollAnimationWrapper({
  children,
  delay = 0,
  className = '',
}: ScrollAnimationWrapperProps) {
  const [isVisible, setIsVisible] = useState(false)
  const domRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = domRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            if (el) {
              observer.unobserve(el)
            }
          }
        })
      },
      {
        threshold: 0.15,
        rootMargin: '50px 0px 0px 0px'
      }
    )

    if (el) {
      observer.observe(el)
    }

    return () => {
      if (el) {
        observer.unobserve(el)
      }
    }
  }, [])

  return (
    <div
      ref={domRef}
      className={`${styles.wrapper} ${isVisible ? styles.visible : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
