'use client'

import React from 'react'
import styles from './PlatformTabs.module.css'

export type PlatformTabItem<Value extends string> = {
  value: Value
  label: string
  disabled?: boolean
}

export interface PlatformTabsProps<Value extends string> {
  id: string
  label: string
  items: ReadonlyArray<PlatformTabItem<Value>>
  value: Value
  onChange: (value: Value) => void
  className?: string
}

export function PlatformTabs<Value extends string>({
  id,
  label,
  items,
  value,
  onChange,
  className,
}: PlatformTabsProps<Value>) {
  const classes = [styles.tabList, className ?? ''].filter(Boolean).join(' ')
  const enabledItems = items.filter(item => !item.disabled)
  const focusValue = enabledItems.some(item => item.value === value)
    ? value
    : enabledItems[0]?.value

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, itemValue: Value) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return

    const currentIndex = enabledItems.findIndex(item => item.value === itemValue)
    if (currentIndex < 0 || enabledItems.length === 0) return

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextItem = event.key === 'Home'
      ? enabledItems[0]
      : event.key === 'End'
        ? enabledItems.at(-1)
        : enabledItems[(currentIndex + direction + enabledItems.length) % enabledItems.length]
    if (!nextItem) return

    onChange(nextItem.value)
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${id}-tab-${nextItem.value}`)}`)
      ?.focus()
  }

  return (
    <div className={classes} role="tablist" aria-label={label}>
      {items.map(item => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            id={`${id}-tab-${item.value}`}
            type="button"
            className={styles.tab}
            role="tab"
            aria-selected={selected}
            aria-controls={`${id}-panel-${item.value}`}
            tabIndex={item.value === focusValue ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            onKeyDown={event => handleKeyDown(event, item.value)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
