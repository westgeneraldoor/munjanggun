import React from 'react'
import styles from './PlatformPanel.module.css'

type PlatformPanelElement = 'div' | 'section' | 'aside' | 'article'
type PlatformPanelVariant = 'default' | 'subtle'

export interface PlatformPanelProps extends React.HTMLAttributes<HTMLElement> {
  as?: PlatformPanelElement
  variant?: PlatformPanelVariant
}

export function PlatformPanel({
  as: Element = 'div',
  variant = 'default',
  className,
  children,
  ...props
}: PlatformPanelProps) {
  const classes = [styles.panel, styles[variant], className ?? ''].filter(Boolean).join(' ')
  return <Element {...props} className={classes}>{children}</Element>
}
