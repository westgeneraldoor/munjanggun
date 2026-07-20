import React from 'react'
import styles from './PlatformPreviewFrame.module.css'

export interface PlatformPreviewFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  viewportClassName?: string
}

export function PlatformPreviewFrame({ label, viewportClassName, className, children, ...props }: PlatformPreviewFrameProps) {
  const frameClasses = [styles.frame, className ?? ''].filter(Boolean).join(' ')
  const viewportClasses = [styles.viewport, viewportClassName ?? ''].filter(Boolean).join(' ')

  return (
    <div {...props} className={frameClasses} role="group" aria-label={label} data-platform-preview-frame>
      <div className={styles.chrome} aria-hidden="true"><span /></div>
      <div className={viewportClasses} data-platform-preview-viewport>
        {children}
      </div>
    </div>
  )
}
