'use client'

import React, { useLayoutEffect, useRef } from 'react'
import styles from './PlatformToolbar.module.css'

type ToolbarElement = HTMLButtonElement | HTMLAnchorElement

export interface PlatformToolbarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'aria-label'> {
  label: string
}

const TOOLBAR_ITEM_SELECTOR = 'button:not(:disabled), a[href]'

function getToolbarItems(toolbar: HTMLDivElement) {
  return Array.from(toolbar.querySelectorAll<ToolbarElement>(TOOLBAR_ITEM_SELECTOR))
}

function setActiveItem(items: ToolbarElement[], activeItem: ToolbarElement) {
  items.forEach(item => {
    item.tabIndex = item === activeItem ? 0 : -1
  })
}

export function PlatformToolbar({ label, className, children, onBlurCapture, onFocusCapture, onKeyDown, ...props }: PlatformToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const focusWithinRef = useRef(false)
  const classes = [styles.toolbar, className ?? ''].filter(Boolean).join(' ')

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const items = getToolbarItems(toolbar)
    const activeItem = items.find(item => item.tabIndex === 0) ?? items[0]
    if (!activeItem) return

    const focusedElement = document.activeElement
    const focusedItemUnavailable = focusedElement instanceof HTMLButtonElement && focusedElement.disabled
    const shouldRestoreFocus = focusWithinRef.current && (
      focusedElement === document.body ||
      !focusedElement ||
      !toolbar.contains(focusedElement) ||
      focusedItemUnavailable
    )

    setActiveItem(items, activeItem)
    if (shouldRestoreFocus) activeItem.focus()
  })

  const handleFocusCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    onFocusCapture?.(event)
    const target = event.target
    if (!(target instanceof HTMLElement)) return

    const activeItem = target.closest<ToolbarElement>(TOOLBAR_ITEM_SELECTOR)
    if (!activeItem || !event.currentTarget.contains(activeItem)) return
    focusWithinRef.current = true
    setActiveItem(getToolbarItems(event.currentTarget), activeItem)
  }

  const handleBlurCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    onBlurCapture?.(event)
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
    if (nextTarget === null || nextTarget === document.body) return
    focusWithinRef.current = false
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (event.key === 'Tab') {
      focusWithinRef.current = false
      return
    }

    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return

    const items = getToolbarItems(event.currentTarget)
    const target = event.target
    const currentItem = target instanceof HTMLElement ? target.closest<ToolbarElement>(TOOLBAR_ITEM_SELECTOR) : null
    const currentIndex = currentItem ? items.indexOf(currentItem) : -1
    if (currentIndex < 0 || items.length === 0) return

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextItem = event.key === 'Home'
      ? items[0]
      : event.key === 'End'
        ? items.at(-1)
        : items[(currentIndex + direction + items.length) % items.length]
    if (!nextItem) return
    setActiveItem(items, nextItem)
    nextItem.focus()
  }

  return (
    <div
      {...props}
      ref={toolbarRef}
      className={classes}
      role="toolbar"
      aria-label={label}
      onBlurCapture={handleBlurCapture}
      onFocusCapture={handleFocusCapture}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  )
}
