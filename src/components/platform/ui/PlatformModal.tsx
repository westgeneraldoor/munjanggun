'use client'

import React, { useEffect, useEffectEvent, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { PlatformIconButton } from './PlatformIconButton'
import styles from './PlatformModal.module.css'

const INITIAL_FOCUS_SELECTOR = '[data-modal-initial-focus]:not([disabled])'
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface PlatformModalProps {
  isOpen: boolean
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  onClose: () => void
  size?: 'sm' | 'md'
  showCloseButton?: boolean
  closeOnBackdrop?: boolean
  closeDisabled?: boolean
  className?: string
}

export function PlatformModal({
  isOpen,
  title,
  description,
  children,
  footer,
  onClose,
  size = 'sm',
  showCloseButton = false,
  closeOnBackdrop = false,
  closeDisabled = false,
  className,
}: PlatformModalProps) {
  const generatedId = useId().replaceAll(':', '')
  const titleId = `platform-modal-title-${generatedId}`
  const descriptionId = description ? `platform-modal-description-${generatedId}` : undefined
  const dialogRef = useRef<HTMLDivElement>(null)
  const requestClose = useEffectEvent(() => {
    if (!closeDisabled) onClose()
  })

  useEffect(() => {
    if (!isOpen) return

    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>(INITIAL_FOCUS_SELECTOR)
        ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      target?.focus({ preventScroll: true })
      if (document.activeElement !== target) dialogRef.current?.focus({ preventScroll: true })
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActiveElement?.focus({ preventScroll: true })
    }
  }, [isOpen])

  if (!isOpen) return null

  const modalClasses = [styles.modal, styles[size], className ?? ''].filter(Boolean).join(' ')

  return (
    <div
      className={styles.overlay}
      data-platform-modal-overlay
      onClick={event => {
        if (event.target === event.currentTarget && closeOnBackdrop && !closeDisabled) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={modalClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          {showCloseButton ? (
            <PlatformIconButton
              type="button"
              variant="ghost"
              aria-label="닫기"
              onClick={onClose}
              disabled={closeDisabled}
            >
              <X aria-hidden="true" />
            </PlatformIconButton>
          ) : null}
        </header>
        <div className={styles.body}>
          {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
          {children}
        </div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>
  )
}
