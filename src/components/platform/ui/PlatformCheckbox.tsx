import React from 'react'
import styles from './PlatformCheckbox.module.css'

export interface PlatformCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children: React.ReactNode
}

export const PlatformCheckbox = React.forwardRef<HTMLInputElement, PlatformCheckboxProps>(function PlatformCheckbox(
  { children, className, ...props },
  ref,
) {
  const controlClasses = [styles.control, className ?? ''].filter(Boolean).join(' ')

  return (
    <label className={styles.root}>
      <input {...props} ref={ref} type="checkbox" className={controlClasses} />
      <span className={styles.label}>{children}</span>
    </label>
  )
})
