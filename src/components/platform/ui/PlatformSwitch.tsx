import React from 'react'
import styles from './PlatformSwitch.module.css'

export interface PlatformSwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'role'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: React.ReactNode
  description?: React.ReactNode
}

export const PlatformSwitch = React.forwardRef<HTMLButtonElement, PlatformSwitchProps>(function PlatformSwitch({
  checked,
  onCheckedChange,
  label,
  description,
  className,
  disabled,
  ...props
}, ref) {
  const classes = [styles.control, className ?? ''].filter(Boolean).join(' ')

  return (
    <button
      {...props}
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      className={classes}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className={styles.copy}>
        <span className={styles.label}>{label}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      <span className={styles.track} aria-hidden="true" data-platform-switch-track>
        <span className={styles.thumb} data-platform-switch-thumb />
      </span>
    </button>
  )
})
