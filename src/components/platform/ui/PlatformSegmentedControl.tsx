'use client'

import React from 'react'
import styles from './PlatformSegmentedControl.module.css'

export type PlatformSegmentedControlItem<Value extends string> = {
  value: Value
  label: string
  disabled?: boolean
}

export interface PlatformSegmentedControlProps<Value extends string> {
  label: string
  items: ReadonlyArray<PlatformSegmentedControlItem<Value>>
  value: Value
  onChange: (value: Value) => void
  className?: string
}

export function PlatformSegmentedControl<Value extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: PlatformSegmentedControlProps<Value>) {
  const classes = [styles.group, className ?? ''].filter(Boolean).join(' ')

  return (
    <div className={classes} role="group" aria-label={label}>
      {items.map(item => (
        <button
          key={item.value}
          type="button"
          className={styles.item}
          aria-pressed={item.value === value}
          disabled={item.disabled}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
