import React from 'react'
import styles from './PlatformIconButton.module.css'

type PlatformIconButtonVariant = 'secondary' | 'ghost' | 'danger'
type AccessibleIconButtonLabel =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-label'?: never; 'aria-labelledby': string }

export type PlatformIconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & AccessibleIconButtonLabel & {
  variant?: PlatformIconButtonVariant
}

export function PlatformIconButton({
  variant = 'secondary',
  className,
  children,
  ...props
}: PlatformIconButtonProps) {
  const classes = [styles.button, styles[variant], className ?? ''].filter(Boolean).join(' ')

  return (
    <button {...props} className={classes}>
      {children}
    </button>
  )
}
