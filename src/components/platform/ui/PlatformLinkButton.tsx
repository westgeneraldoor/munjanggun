import React from 'react'
import Link from 'next/link'
import styles from './PlatformButton.module.css'

type PlatformLinkButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type PlatformLinkButtonSize = 'md' | 'sm'

export interface PlatformLinkButtonProps extends React.ComponentPropsWithoutRef<typeof Link> {
  variant?: PlatformLinkButtonVariant
  size?: PlatformLinkButtonSize
  fullWidth?: boolean
}

export function PlatformLinkButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  ...props
}: PlatformLinkButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <Link {...props} className={classes}>
      {children}
    </Link>
  )
}
