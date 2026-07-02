import React from 'react'
import styles from './PlatformCard.module.css'

type PlatformCardVariant = 'default' | 'subtle' | 'inverse'
type PlatformCardElement = 'div' | 'article' | 'section'

export interface PlatformCardProps extends React.HTMLAttributes<HTMLElement> {
  as?: PlatformCardElement
  variant?: PlatformCardVariant
}

export function PlatformCard({
  as: Element = 'div',
  variant = 'default',
  className,
  children,
  ...props
}: PlatformCardProps) {
  const classes = [styles.card, styles[variant], className ?? ''].filter(Boolean).join(' ')

  return (
    <Element {...props} className={classes}>
      {children}
    </Element>
  )
}
